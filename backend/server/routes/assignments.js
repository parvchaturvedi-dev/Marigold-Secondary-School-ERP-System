import express from 'express';
import multer from 'multer';
import Assignment from '../models/Assignment.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { requireRole } from '../middleware/auth.js';
import { resolveDisplayName } from '../utils/nameLookup.js';
import { notifyMany } from '../utils/notify.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 25 * 1024 * 1024,
  },
});

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

const applyAttachment = (assignment, file) => {
  if (!file) return;

  assignment.attachment = {
    name: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    data: file.buffer,
  };
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
    attachment: assignment.attachment?.data
      ? {
          name: assignment.attachment.name,
          mimeType: assignment.attachment.mimeType,
          size: assignment.attachment.size,
          dataUrl: `data:${assignment.attachment.mimeType};base64,${assignment.attachment.data.toString('base64')}`,
        }
      : null,
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

router.post('/', ensureMongo, upload.single('attachment'), async (request, response) => {
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

  applyAttachment(assignment, request.file);
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

router.patch('/:id', ensureMongo, upload.single('attachment'), async (request, response) => {
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

  const targetClasses = parseTargetClasses(request.body.targetClasses);
  assignment.title = request.body.title || assignment.title;
  assignment.description = request.body.description || assignment.description;
  assignment.subject = request.body.subject || assignment.subject;
  assignment.targetClasses = targetClasses.length ? targetClasses : assignment.targetClasses;
  assignment.updatedByName = request.body.actorName || assignment.updatedByName;

  if (request.body.removeAttachment === 'true') {
    assignment.attachment = null;
  }

  applyAttachment(assignment, request.file);
  await assignment.save();

  emitRealtimeEvent('mgps-erp-assignments-updated');
  response.json(await toAssignmentPayload(assignment));
});

router.patch('/:id/checking-date', ensureMongo, async (request, response) => {
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
  const result = await Assignment.deleteMany({});
  const cleared = typeof result?.deletedCount === 'number' ? result.deletedCount : 0;

  emitRealtimeEvent('mgps-erp-assignments-updated');
  response.json({ cleared });
});

export default router;
