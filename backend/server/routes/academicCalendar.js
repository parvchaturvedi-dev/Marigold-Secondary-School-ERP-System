import express from 'express';
import multer from 'multer';
import AcademicCalendar from '../models/AcademicCalendar.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';

const router = express.Router();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
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

const toCalendarPayload = (calendar) => ({
  id: calendar._id.toString(),
  name: calendar.name,
  size: calendar.size,
  type: calendar.type,
  uploadedBy: calendar.uploadedBy,
  uploadedAt: calendar.updatedAt?.toISOString() || calendar.createdAt?.toISOString(),
  dataUrl: `data:${calendar.type};base64,${calendar.fileData.toString('base64')}`,
});

router.get('/latest', ensureMongo, async (_request, response) => {
  const calendar = await AcademicCalendar.findOne().sort({ updatedAt: -1 });

  if (!calendar) {
    response.status(404).json({ message: 'No academic calendar PDF has been published.' });
    return;
  }

  response.json(toCalendarPayload(calendar));
});

router.post('/', ensureMongo, upload.single('calendarPdf'), async (request, response) => {
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

  await AcademicCalendar.deleteMany({});

  const calendar = await AcademicCalendar.create({
    name: file.originalname,
    size: file.size,
    type: file.mimetype || 'application/pdf',
    fileData: file.buffer,
    uploadedBy: request.body.uploadedBy || 'Admin',
  });

  emitRealtimeEvent('mgps-academic-calendar-updated');
  response.status(201).json(toCalendarPayload(calendar));
});

router.delete('/', ensureMongo, async (_request, response) => {
  await AcademicCalendar.deleteMany({});
  emitRealtimeEvent('mgps-academic-calendar-updated');
  response.json({ message: 'Academic calendar PDF removed.' });
});

export default router;
