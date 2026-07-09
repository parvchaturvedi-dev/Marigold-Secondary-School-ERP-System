import express from 'express';
import multer from 'multer';
import AcademicCalendar from '../models/AcademicCalendar.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { requireRole } from '../middleware/auth.js';
import { createNotification } from '../utils/notify.js';
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
    fileSize: 10 * 1024 * 1024,
  },
});

// Stable Cloudinary public_id derived from the calendar's file name so a
// re-upload of the same file overwrites the previous asset instead of orphaning
// it. Only one calendar is ever stored (POST deleteMany + create).
const CALENDAR_FOLDER = 'mgps/academic-calendar';
const cloudPublicId = (name) =>
  `academic-calendar__${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')}`;

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

// Rebuild the inline base64 dataUrl the frontends expect. For Cloudinary-backed
// records the bytes no longer live in Mongo, so fetch them back via a short-lived
// signed URL and re-encode; legacy Mongo records use their inline Buffer.
const toCalendarPayload = async (calendar) => {
  let base64;
  if (calendar.storage === 'cloudinary' && calendar.publicId) {
    const url = signedUrlFor(
      calendar.publicId,
      calendar.resourceType || resourceTypeForMime(calendar.type)
    );
    const upstream = await fetch(url);
    if (!upstream.ok) {
      throw new Error(`Cloudinary fetch failed (${upstream.status}).`);
    }
    const arrayBuffer = await upstream.arrayBuffer();
    base64 = Buffer.from(arrayBuffer).toString('base64');
  } else {
    base64 = calendar.fileData.toString('base64');
  }

  return {
    id: calendar._id.toString(),
    name: calendar.name,
    size: calendar.size,
    type: calendar.type,
    uploadedBy: calendar.uploadedBy,
    uploadedAt: calendar.updatedAt?.toISOString() || calendar.createdAt?.toISOString(),
    dataUrl: `data:${calendar.type};base64,${base64}`,
  };
};

router.get('/latest', ensureMongo, async (_request, response) => {
  const calendar = await AcademicCalendar.findOne().sort({ updatedAt: -1 });

  if (!calendar) {
    response.status(404).json({ message: 'No academic calendar PDF has been published.' });
    return;
  }

  try {
    response.json(await toCalendarPayload(calendar));
  } catch (error) {
    response.status(502).json({ message: 'Failed to load file from storage.' });
  }
});

router.post('/', ensureMongo, requireRole('admin', 'clerk'), upload.single('calendarPdf'), async (request, response) => {
  const file = request.file;

  if (!file) {
    response.status(400).json({ message: 'PDF file is required.' });
    return;
  }

  const isPdf = file.mimetype === 'application/pdf' || file.originalname.toLowerCase().endsWith('.pdf');
  if (!isPdf) {
    response.status(400).json({ message: 'Only PDF files are allowed.' });
    return;
  }

  // Offload the bytes to Cloudinary when configured; otherwise keep the legacy
  // inline Buffer so the app still works before keys are set.
  const mimeType = file.mimetype || 'application/pdf';
  let storageFields;
  if (isCloudinaryConfigured()) {
    try {
      const uploaded = await uploadBuffer(file.buffer, {
        folder: CALENDAR_FOLDER,
        publicId: cloudPublicId(file.originalname),
        mimeType,
      });
      storageFields = {
        storage: 'cloudinary',
        publicId: uploaded.publicId,
        resourceType: uploaded.resourceType,
        fileData: undefined,
      };
    } catch (error) {
      response.status(502).json({ message: 'File storage upload failed. Please try again.' });
      return;
    }
  } else {
    storageFields = {
      storage: 'mongo',
      publicId: '',
      resourceType: '',
      fileData: file.buffer,
    };
  }

  // Best-effort cleanup of any previously offloaded calendar asset before we
  // drop the old records (only one calendar is ever kept).
  const previous = await AcademicCalendar.find({ storage: 'cloudinary', publicId: { $ne: '' } })
    .select('publicId resourceType');
  await AcademicCalendar.deleteMany({});
  for (const old of previous) {
    if (old.publicId) {
      await deleteAsset(old.publicId, old.resourceType || 'raw');
    }
  }

  const calendar = await AcademicCalendar.create({
    name: file.originalname,
    size: file.size,
    type: mimeType,
    ...storageFields,
    uploadedBy: request.body.uploadedBy || 'Admin',
  });

  emitRealtimeEvent('mgps-academic-calendar-updated');

  // Notify all students and all teachers that a new calendar is published. Non-blocking.
  createNotification({
    title: 'Academic Calendar Updated',
    description: 'A new academic calendar has been published.',
    type: 'calendar',
    linkPage: 'Academic Calendar',
    recipientRole: 'student',
    recipientClassName: '',
  }).catch(() => {});
  createNotification({
    title: 'Academic Calendar Updated',
    description: 'A new academic calendar has been published.',
    type: 'calendar',
    linkPage: 'Academic Calendar',
    recipientRole: 'teacher',
    recipientClassName: '',
  }).catch(() => {});

  try {
    response.status(201).json(await toCalendarPayload(calendar));
  } catch (error) {
    response.status(502).json({ message: 'Failed to load file from storage.' });
  }
});

router.delete('/', ensureMongo, requireRole('admin', 'clerk'), async (_request, response) => {
  // Remove any offloaded Cloudinary assets alongside the Mongo records.
  const previous = await AcademicCalendar.find({ storage: 'cloudinary', publicId: { $ne: '' } })
    .select('publicId resourceType');
  await AcademicCalendar.deleteMany({});
  for (const old of previous) {
    if (old.publicId) {
      await deleteAsset(old.publicId, old.resourceType || 'raw');
    }
  }
  emitRealtimeEvent('mgps-academic-calendar-updated');
  response.json({ message: 'Academic calendar PDF removed.' });
});

export default router;
