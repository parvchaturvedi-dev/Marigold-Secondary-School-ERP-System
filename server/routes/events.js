import express from 'express';
import multer from 'multer';
import Event from '../models/Event.js';
import { isMongoConnected } from '../db.js';

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
      message: 'MongoDB is not connected. Set MONGODB_URI and restart the API server.',
    });
    return;
  }

  next();
};

const toBoolean = (value) => value === true || value === 'true';

const toEventPayload = (event) => ({
  id: event._id.toString(),
  title: event.title,
  description: event.description,
  durationType: event.durationType,
  date: event.date,
  fromDate: event.fromDate,
  toDate: event.toDate,
  participationEnabled: event.participationEnabled,
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
  createdAt: event.createdAt?.toISOString(),
  updatedAt: event.updatedAt?.toISOString(),
});

const buildEventFields = (body) => ({
  title: body.title,
  description: body.description,
  durationType: body.durationType || 'single',
  date: body.durationType === 'multiple' ? '' : body.date || '',
  fromDate: body.durationType === 'multiple' ? body.fromDate || '' : '',
  toDate: body.durationType === 'multiple' ? body.toDate || '' : '',
  participationEnabled: toBoolean(body.participationEnabled),
  createdByRole: body.createdByRole,
  createdByUsername: body.createdByUsername,
});

const applyImageFields = (event, file) => {
  if (!file) return;

  event.imageName = file.originalname;
  event.imageType = file.mimetype;
  event.imageSize = file.size;
  event.imageData = file.buffer;
};

router.get('/', ensureMongo, async (_request, response) => {
  const events = await Event.find().sort({ createdAt: -1 });
  response.json(events.map(toEventPayload));
});

router.post('/', ensureMongo, upload.single('image'), async (request, response) => {
  const event = new Event({
    ...buildEventFields(request.body),
    participants: [],
  });

  applyImageFields(event, request.file);
  await event.save();

  response.status(201).json(toEventPayload(event));
});

router.patch('/:id', ensureMongo, upload.single('image'), async (request, response) => {
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

  response.json(toEventPayload(event));
});

router.delete('/:id', ensureMongo, async (request, response) => {
  await Event.findByIdAndDelete(request.params.id);
  response.json({ message: 'Event removed.' });
});

router.patch('/:id/participate', ensureMongo, async (request, response) => {
  const event = await Event.findById(request.params.id);

  if (!event) {
    response.status(404).json({ message: 'Event not found.' });
    return;
  }

  if (!event.participationEnabled) {
    response.status(409).json({ message: 'Participation is not enabled for this event.' });
    return;
  }

  const participant = request.body;
  event.participants = event.participants.filter(
    (entry) => entry.admissionNumber !== participant.admissionNumber
  );
  event.participants.push({
    admissionNumber: participant.admissionNumber,
    name: participant.name,
    fatherName: participant.fatherName,
    className: participant.className,
    username: participant.username,
  });
  await event.save();

  response.json(toEventPayload(event));
});

export default router;
