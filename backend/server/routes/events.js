import express from 'express';
import multer from 'multer';
import Event from '../models/Event.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { requireRole } from '../middleware/auth.js';
import { resolveDisplayName } from '../utils/nameLookup.js';
import { createNotification } from '../utils/notify.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 8 * 1024 * 1024,
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

const toBoolean = (value) => value === true || value === 'true';

const toEventPayload = async (event) => {
  const createdByName = await resolveDisplayName(event.createdByUsername);

  return {
  id: event._id.toString(),
  title: event.title,
  description: event.description,
  durationType: event.durationType,
  date: event.date,
  fromDate: event.fromDate,
  toDate: event.toDate,
  participationEnabled: event.participationEnabled,
  participationOpensAt: event.participationOpensAt,
  participationClosesAt: event.participationClosesAt,
  participationOpenNow: isParticipationOpenNow(event),
  imageName: event.imageName,
  imageType: event.imageType,
  imageSize: event.imageSize,
  imageDataUrl:
    event.imageData && event.imageType
      ? `data:${event.imageType};base64,${event.imageData.toString('base64')}`
      : '',
  participants: event.participants || [],
  createdByRole: event.createdByRole,
  createdByUsername: event.createdByUsername,
  createdByName,
  authorName: createdByName,
  createdAt: event.createdAt?.toISOString(),
  updatedAt: event.updatedAt?.toISOString(),
  };
};

const buildEventFields = (body) => ({
  title: body.title,
  description: body.description,
  durationType: body.durationType || 'single',
  date: body.durationType === 'multiple' ? '' : body.date || '',
  fromDate: body.durationType === 'multiple' ? body.fromDate || '' : '',
  toDate: body.durationType === 'multiple' ? body.toDate || '' : '',
  participationEnabled: toBoolean(body.participationEnabled),
  participationOpensAt: (body.participationOpensAt || '').trim(),
  participationClosesAt: (body.participationClosesAt || '').trim(),
  createdByRole: body.createdByRole,
  createdByUsername: body.createdByUsername,
});

const parseDate = (value) => {
  if (!value) return null;
  const iso = String(value).length <= 10 ? `${value}T00:00:00` : value;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
};

// Effective participation gate: manual toggle AND (if provided) time window.
const isParticipationOpenNow = (event) => {
  if (!event?.participationEnabled) return false;
  const now = new Date();
  const opens = parseDate(event.participationOpensAt);
  if (opens && now < opens) return false;
  const closes = parseDate(event.participationClosesAt);
  if (closes) {
    // If a plain YYYY-MM-DD close date is given, treat it as inclusive
    // (end of that day) so the day itself still counts as open.
    if (String(event.participationClosesAt).length <= 10) closes.setHours(23, 59, 59, 999);
    if (now > closes) return false;
  }
  return true;
};

const applyImageFields = (event, file) => {
  if (!file) return;

  event.imageName = file.originalname;
  event.imageType = file.mimetype;
  event.imageSize = file.size;
  event.imageData = file.buffer;
};

router.get('/', ensureMongo, async (_request, response) => {
  const events = await Event.find().sort({ createdAt: -1 });
  response.json(await Promise.all(events.map(toEventPayload)));
});

router.post('/', ensureMongo, requireRole('admin', 'clerk'), upload.single('image'), async (request, response) => {
  if (request.file && !String(request.file.mimetype || '').startsWith('image/')) {
    response.status(400).json({ message: 'Only image files are allowed.' });
    return;
  }

  const event = new Event({
    ...buildEventFields(request.body),
    participants: [],
  });

  applyImageFields(event, request.file);
  await event.save();

  emitRealtimeEvent('mgps-erp-events-updated');

  // Broadcast the new event to all students (empty className = all classes).
  try {
    await createNotification({
      title: 'New Event',
      description: event.title,
      type: 'event',
      linkPage: 'Events',
      recipientRole: 'student',
      recipientClassName: '',
    });
  } catch (error) {
    console.error('[events] notify failed:', error?.message || error);
  }

  response.status(201).json(await toEventPayload(event));
});

router.patch('/:id', ensureMongo, requireRole('admin', 'clerk'), upload.single('image'), async (request, response) => {
  if (request.file && !String(request.file.mimetype || '').startsWith('image/')) {
    response.status(400).json({ message: 'Only image files are allowed.' });
    return;
  }

  const event = await Event.findById(request.params.id);

  if (!event) {
    response.status(404).json({ message: 'Event not found.' });
    return;
  }

  Object.assign(event, buildEventFields(request.body));

  if (toBoolean(request.body.removeImage)) {
    event.imageName = '';
    event.imageType = '';
    event.imageSize = 0;
    event.imageData = null;
  }

  applyImageFields(event, request.file);
  await event.save();

  emitRealtimeEvent('mgps-erp-events-updated');
  response.json(await toEventPayload(event));
});

router.delete('/:id', ensureMongo, requireRole('admin', 'clerk'), async (request, response) => {
  await Event.findByIdAndDelete(request.params.id);
  emitRealtimeEvent('mgps-erp-events-updated');
  response.json({ message: 'Event removed.' });
});

router.patch('/:id/participate', ensureMongo, async (request, response) => {
  // Force participant identity from the authenticated session — students cannot
  // register someone else nor spoof another admission number.
  if (request.auth.role === 'student') {
    const s = request.auth.activeStudent || {};
    request.body.admissionNumber = s.admissionNumber || request.auth.username;
    request.body.name = s.displayName || request.auth.displayName || request.auth.username;
    request.body.fatherName = s.fatherName || request.body.fatherName || '';
    request.body.className = s.className || '';
    request.body.username = request.auth.username;
  }
  const event = await Event.findById(request.params.id);

  if (!event) {
    response.status(404).json({ message: 'Event not found.' });
    return;
  }

  if (!isParticipationOpenNow(event)) {
    response.status(409).json({ message: 'Participation is currently closed for this event.' });
    return;
  }

  const participant = request.body;
  const already = (event.participants || []).some(
    (entry) => (entry.admissionNumber || '') === (participant.admissionNumber || '')
  );
  if (already) {
    response.status(409).json({ message: 'Already participated.' });
    return;
  }
  event.participants.push({
    admissionNumber: participant.admissionNumber,
    name: participant.name,
    fatherName: participant.fatherName,
    className: participant.className,
    username: participant.username,
  });
  await event.save();

  emitRealtimeEvent('mgps-erp-events-updated');
  response.json(await toEventPayload(event));
});

export default router;
