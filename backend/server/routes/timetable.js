import express from 'express';
import Timetable from '../models/Timetable.js';
import { isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { emitRealtimeEvent } from '../realtime.js';
import { createNotification } from '../utils/notify.js';

const router = express.Router();
const TIMETABLE_UPDATED_EVENT = 'mgps-timetable-updated';

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

const normalizeDate = (value = '') => {
  const raw = String(value || '').trim();
  if (!raw) return '';
  const date = new Date(`${raw.slice(0, 10)}T00:00:00.000Z`);
  return Number.isNaN(date.getTime()) ? '' : date.toISOString().slice(0, 10);
};

const normalizeStringList = (items = []) =>
  [...new Set((Array.isArray(items) ? items : []).map((item) => String(item || '').trim()).filter(Boolean))];

const normalizePeriods = (periods = []) =>
  (Array.isArray(periods) ? periods : [])
    .map((period, index) => ({
      id: String(period.id || `period-${index + 1}`).trim(),
      label: String(period.label || period.name || `Period ${index + 1}`).trim(),
      time: String(period.time || '').trim(),
    }))
    .filter((period) => period.id && period.label);

const toPayload = (record) => ({
  id: record._id.toString(),
  name: record.name,
  mode: record.mode,
  fromDate: record.fromDate,
  toDate: record.toDate,
  classes: record.classes || [],
  periods: record.periods || [],
  cells: record.cells || {},
  createdBy: record.createdBy,
  updatedBy: record.updatedBy,
  updatedAt: record.updatedAt?.toISOString() || record.createdAt?.toISOString(),
});

const findEffectiveTimetable = async (date) => {
  const requestedDate = normalizeDate(date) || new Date().toISOString().slice(0, 10);
  const override = await Timetable.findOne({
    mode: 'override',
    fromDate: { $lte: requestedDate },
    toDate: { $gte: requestedDate },
  }).sort({ updatedAt: -1 });

  if (override) return { record: override, requestedDate, source: 'override' };

  const fallback = await Timetable.findOne({ mode: 'default' }).sort({ updatedAt: -1 });
  return { record: fallback, requestedDate, source: 'default' };
};

const filterClass = (payload, className = '') => {
  const selectedClass = String(className || '').trim();
  if (!payload || !selectedClass || payload.classes.includes(selectedClass)) return payload;

  return {
    ...payload,
    classes: [],
    periods: payload.periods || [],
    cells: {},
  };
};

router.get('/', ensureMongo, async (request, response) => {
  const { record, requestedDate, source } = await findEffectiveTimetable(request.query.date);

  if (!record) {
    response.json({ timetable: null, requestedDate, source: 'empty' });
    return;
  }

  response.json({
    timetable: filterClass(toPayload(record), request.query.className),
    requestedDate,
    source,
  });
});

router.get('/templates', ensureMongo, async (_request, response) => {
  const records = await Timetable.find().sort({ mode: 1, fromDate: -1, updatedAt: -1 });
  response.json({ timetables: records.map(toPayload) });
});

router.post('/', ensureMongo, requireRole('admin', 'clerk'), async (request, response) => {
  const mode = request.body.mode === 'override' ? 'override' : 'default';
  const fromDate = mode === 'override' ? normalizeDate(request.body.fromDate) : '';
  const toDate = mode === 'override' ? normalizeDate(request.body.toDate || request.body.fromDate) : '';

  if (mode === 'override' && (!fromDate || !toDate || fromDate > toDate)) {
    response.status(400).json({ message: 'Valid from and to dates are required for a date-specific timetable.' });
    return;
  }

  const payload = {
    name: String(request.body.name || (mode === 'default' ? 'Default Timetable' : 'Special Timetable')).trim(),
    mode,
    fromDate,
    toDate,
    classes: normalizeStringList(request.body.classes),
    periods: normalizePeriods(request.body.periods),
    cells: request.body.cells && typeof request.body.cells === 'object' ? request.body.cells : {},
    updatedBy: request.auth?.displayName || request.auth?.username || request.auth?.role || '',
  };

  if (!payload.classes.length || !payload.periods.length) {
    response.status(400).json({ message: 'At least one class column and one period row are required.' });
    return;
  }

  let record;
  if (request.body.id) {
    record = await Timetable.findByIdAndUpdate(request.body.id, payload, { new: true });
    if (!record) {
      response.status(404).json({ message: 'Timetable was not found.' });
      return;
    }
  } else if (mode === 'default') {
    record = await Timetable.findOneAndUpdate(
      { mode: 'default' },
      { ...payload, createdBy: payload.updatedBy },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else {
    record = await Timetable.create({ ...payload, createdBy: payload.updatedBy });
  }

  emitRealtimeEvent(TIMETABLE_UPDATED_EVENT, toPayload(record));

  // Notify students of each class in the saved timetable. Non-blocking.
  for (const className of Array.isArray(record.classes) ? record.classes : []) {
    createNotification({
      title: 'Timetable Updated',
      description: `The timetable for ${className} has been updated.`,
      type: 'timetable',
      linkPage: 'Timetable',
      recipientRole: 'student',
      recipientClassName: className,
    }).catch(() => {});
  }

  response.status(request.body.id ? 200 : 201).json({ timetable: toPayload(record) });
});

router.delete('/:id', ensureMongo, requireRole('admin', 'clerk'), async (request, response) => {
  const record = await Timetable.findByIdAndDelete(request.params.id);
  if (!record) {
    response.status(404).json({ message: 'Timetable was not found.' });
    return;
  }

  emitRealtimeEvent(TIMETABLE_UPDATED_EVENT, { id: request.params.id, deleted: true });
  response.json({ message: 'Timetable removed.' });
});

export default router;
