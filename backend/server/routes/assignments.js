import express from 'express';
import multer from 'multer';
import Assignment from '../models/Assignment.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { requireRole } from '../middleware/auth.js';
import { resolveDisplayName } from '../utils/nameLookup.js';
import { notifyMany } from '../utils/notify.js';
import {
  isCloudinaryConfigured,
  resourceTypeForMime,
  uploadBuffer,
  signedUrlFor,
  deleteAsset,
} from '../utils/cloudinary.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

// Stable Cloudinary public_id per (assignmentId, fileName) so a re-upload of the
// same file overwrites its previous asset instead of orphaning it.
const ASSIGNMENT_FOLDER = 'mgps/assignments';
const assignmentPublicId = (assignmentId, fileName) =>
  `${assignmentId}__${String(fileName).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

const isLocked = (checkingDate) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(checkingDate);
  deadline.setHours(0, 0, 0, 0);
  return deadline < today;
};

// Attach an uploaded file to the assignment. Offloads the bytes to Cloudinary
// when configured; otherwise keeps the legacy inline Buffer so the app still
// works before keys are set. Returns false on a Cloudinary upload failure so the
// caller can respond 502; true otherwise (including the no-file case).
const applyAttachment = async (assignment, file) => {
  if (!file) return true;

  let storageFields;
  if (isCloudinaryConfigured()) {
    try {
      const uploaded = await uploadBuffer(file.buffer, {
        folder: ASSIGNMENT_FOLDER,
        publicId: assignmentPublicId(assignment._id, file.originalname),
        mimeType: file.mimetype,
      });
      storageFields = {
        storage: 'cloudinary',
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        data: undefined,
      };
    } catch (error) {
      return false;
    }
  } else {
    storageFields = { storage: 'mongo', publicId: '', resourceType: '', data: file.buffer };
  }

  assignment.attachment = {
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    ...storageFields,
  };
  return true;
};

// Best-effort delete of an attachment's backing Cloudinary asset (no-op for
// legacy Mongo-stored attachments). Never let a cleanup failure break a request.
const deleteAttachmentAsset = async (attachment) => {
  if (attachment && attachment.storage === 'cloudinary' && attachment.publicId) {
    await deleteAsset(attachment.publicId, attachment.resourceType || 'raw');
  }
};

// Build the attachment portion of the API payload. Keeps the exact
// { name, mimeType, size, dataUrl } | null shape the frontends expect: legacy
// Mongo attachments encode their inline Buffer; Cloudinary-offloaded attachments
// have their bytes fetched back (via a short-lived signed URL) and re-encoded so
// the contract is byte-for-byte identical and no frontend change is needed.
const resolveAttachmentPayload = async (attachment) => {
  if (!attachment) return null;

  const base = {
    name: attachment.name,
    mimeType: attachment.mimeType,
    size: attachment.size,
  };

  if (attachment.storage === 'cloudinary' && attachment.publicId) {
    try {
      const url = signedUrlFor(
        attachment.publicId,
        attachment.resourceType || resourceTypeForMime(attachment.mimeType)
      );
      const upstream = await fetch(url);
      if (!upstream.ok) return null;
      const arrayBuffer = await upstream.arrayBuffer();
      const base64 = Buffer.from(arrayBuffer).toString('base64');
      return { ...base, dataUrl: `data:${attachment.mimeType};base64,${base64}` };
    } catch (error) {
      return null;
    }
  }

  if (attachment.data) {
    return { ...base, dataUrl: `data:${attachment.mimeType};base64,${attachment.data.toString('base64')}` };
  }

  return null;
};

const toAssignmentPayload = async (assignment) => {
  // Resolve a human name server-side so the UI never shows a raw username/role-id.
  // Prefer the stored name only if it is a real name (not just the username echoed back).
  const storedName = (assignment.createdByName || '').trim();
  const createdByName =
    storedName && storedName !== assignment.createdByUsername
      ? storedName
      : await resolveDisplayName(assignment.createdByUsername);

  return {
    id: assignment._id.toString(),
    title: assignment.title,
    description: assignment.description,
    subject: assignment.subject,
    targetClasses: assignment.targetClasses,
    checkingDate: assignment.checkingDate,
    attachment: await resolveAttachmentPayload(assignment.attachment),
    createdByRole: assignment.createdByRole,
    createdByUsername: assignment.createdByUsername,
    createdByName,
    authorName: createdByName,
    updatedByName: assignment.updatedByName,
    extensionLogs: assignment.extensionLogs || [],
    createdAt: assignment.createdAt?.toISOString(),
    updatedAt: assignment.updatedAt?.toISOString(),
    isLocked: isLocked(assignment.checkingDate),
  };
};

const parseTargetClasses = (value) => {
  try {
    const parsed = JSON.parse(value || '[]');
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const canMutate = (assignment, actorRole, actorUsername) => {
  if (assignment.createdByUsername === actorUsername) return true;
  return actorRole === 'admin' || actorRole === 'clerk';
};

router.get('/', ensureMongo, async (request, response) => {
  const { role, className, username, allottedClasses = '' } = request.query;
  const query = {};

  if (role === 'student') {
    query.targetClasses = className || '';
  } else if (role === 'teacher') {
    const classes = allottedClasses.split(',').filter(Boolean);
    query.$or = [{ createdByUsername: username }, { targetClasses: { $in: classes } }];
  }

  const assignments = await Assignment.find(query).sort({ createdAt: -1 });
  response.json(await Promise.all(assignments.map(toAssignmentPayload)));
});

router.post('/', ensureMongo, requireRole('admin', 'clerk', 'teacher'), upload.single('attachment'), async (request, response) => {
  request.body.createdByRole = request.auth.role;
  request.body.createdByUsername = request.auth.username;
  request.body.createdByName = request.auth.displayName || request.auth.username;
  const targetClasses = parseTargetClasses(request.body.targetClasses);

  if (!request.body.title || !request.body.description || !request.body.checkingDate || targetClasses.length === 0) {
    response.status(400).json({ message: 'Title, description, checking date, and target classes are required.' });
    return;
  }

  const assignment = new Assignment({
    title: request.body.title,
    description: request.body.description,
    subject: request.body.subject || 'General',
    targetClasses,
    checkingDate: request.body.checkingDate,
    createdByRole: request.body.createdByRole,
    createdByUsername: request.body.createdByUsername,
    createdByName: request.body.createdByName,
    updatedByName: request.body.createdByName,
  });

  const attachmentOk = await applyAttachment(assignment, request.file);
  if (!attachmentOk) {
    response.status(502).json({ message: 'File storage upload failed. Please try again.' });
    return;
  }
  await assignment.save();

  emitRealtimeEvent('mgps-erp-assignments-updated');

  // Notify students of each target class about the new assignment (best-effort).
  try {
    await notifyMany(
      targetClasses.map((className) => ({
        title: 'New Assignment',
        description: `${assignment.title} (${assignment.subject})`,
        type: 'assignment',
        linkPage: 'Assignment',
        recipientRole: 'student',
        recipientClassName: className,
      }))
    );
  } catch (error) {
    console.error('[assignments] notify failed:', error?.message || error);
  }

  response.status(201).json(await toAssignmentPayload(assignment));
});

router.patch('/:id', ensureMongo, requireRole('admin', 'clerk', 'teacher'), upload.single('attachment'), async (request, response) => {
  request.body.actorRole = request.auth.role;
  request.body.actorUsername = request.auth.username;
  request.body.actorName = request.auth.displayName || request.auth.username;
  const assignment = await Assignment.findById(request.params.id);

  if (!assignment) {
    response.status(404).json({ message: 'Assignment not found.' });
    return;
  }

  if (isLocked(assignment.checkingDate)) {
    response.status(409).json({ message: 'Checking date has passed. Assignment is view-only.' });
    return;
  }

  if (!canMutate(assignment, request.body.actorRole, request.body.actorUsername)) {
    response.status(403).json({ message: 'You cannot update this assignment.' });
    return;
  }

  // Snapshot the current attachment's storage reference so we can clean up its
  // Cloudinary asset if this update replaces or removes it.
  const previousAttachment = assignment.attachment
    ? {
        storage: assignment.attachment.storage,
        publicId: assignment.attachment.publicId,
        resourceType: assignment.attachment.resourceType,
      }
    : null;

  const targetClasses = parseTargetClasses(request.body.targetClasses);
  assignment.title = request.body.title || assignment.title;
  assignment.description = request.body.description || assignment.description;
  assignment.subject = request.body.subject || assignment.subject;
  assignment.targetClasses = targetClasses.length ? targetClasses : assignment.targetClasses;
  assignment.updatedByName = request.body.actorName || assignment.updatedByName;

  if (request.body.removeAttachment === 'true') {
    assignment.attachment = null;
  }

  const attachmentOk = await applyAttachment(assignment, request.file);
  if (!attachmentOk) {
    response.status(502).json({ message: 'File storage upload failed. Please try again.' });
    return;
  }
  await assignment.save();

  // Drop the old Cloudinary asset if it was replaced (different publicId) or removed.
  if (previousAttachment?.storage === 'cloudinary' && previousAttachment.publicId) {
    const currentPublicId = assignment.attachment?.publicId || '';
    if (previousAttachment.publicId !== currentPublicId) {
      await deleteAsset(previousAttachment.publicId, previousAttachment.resourceType || 'raw');
    }
  }

  emitRealtimeEvent('mgps-erp-assignments-updated');
  response.json(await toAssignmentPayload(assignment));
});

router.patch('/:id/checking-date', ensureMongo, requireRole('admin', 'clerk', 'teacher'), async (request, response) => {
  request.body.actorRole = request.auth.role;
  request.body.actorUsername = request.auth.username;
  const assignment = await Assignment.findById(request.params.id);

  if (!assignment) {
    response.status(404).json({ message: 'Assignment not found.' });
    return;
  }

  if (isLocked(assignment.checkingDate)) {
    response.status(409).json({ message: 'Checking date has passed. Assignment is view-only.' });
    return;
  }

  if (!canMutate(assignment, request.body.actorRole, request.body.actorUsername)) {
    response.status(403).json({ message: 'You cannot extend this assignment.' });
    return;
  }

  const nextCheckingDate = request.body.checkingDate;
  if (!nextCheckingDate) {
    response.status(400).json({ message: 'New checking date is required.' });
    return;
  }

  assignment.extensionLogs.push({
    fromDate: assignment.checkingDate,
    toDate: nextCheckingDate,
    extendedByName: request.body.actorName,
    extendedByRole: request.body.actorRole,
  });
  assignment.checkingDate = nextCheckingDate;
  assignment.updatedByName = request.body.actorName;
  await assignment.save();

  emitRealtimeEvent('mgps-erp-assignments-updated');
  response.json(await toAssignmentPayload(assignment));
});

// Session promotion resets the assignment board: every promoted class starts fresh.
router.post('/reset', ensureMongo, requireRole('admin', 'clerk'), async (_request, response) => {
  // Collect Cloudinary-backed attachments so their assets can be cleaned up too.
  const cloudBacked = await Assignment.find({ 'attachment.storage': 'cloudinary' }).select('attachment');

  const result = await Assignment.deleteMany({});
  const cleared = typeof result?.deletedCount === 'number' ? result.deletedCount : 0;

  // Best-effort asset cleanup — deleteAsset swallows its own failures.
  for (const assignment of cloudBacked) {
    await deleteAttachmentAsset(assignment.attachment);
  }

  emitRealtimeEvent('mgps-erp-assignments-updated');
  response.json({ cleared });
});

export default router;
