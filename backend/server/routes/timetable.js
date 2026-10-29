import express from 'express';
import Timetable from '../models/Timetable.js';
import { isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { emitRealtimeInvalidation } from '../realtime.js';
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
  days: record.days || [],
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

  const weekly = await Timetable.findOne({ mode: 'weekly' }).sort({ updatedAt: -1 });
  if (weekly) return { record: weekly, requestedDate, source: 'weekly' };

  const fallback = await Timetable.findOne({ mode: 'default' }).sort({ updatedAt: -1 });
  return { record: fallback, requestedDate, source: 'default' };
};

const getDailyPayload = (payload, requestedDate) => {
  if (!payload?.days?.length) return payload;
  const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const weekday = weekdays[new Date(`${requestedDate}T00:00:00.000Z`).getUTCDay()];
  if (!payload.days.includes(weekday)) {
    return { ...payload, classes: payload.classes || [], cells: {}, selectedDay: weekday };
  }

  const cells = {};
  for (const className of payload.classes || []) {
    for (const period of payload.periods || []) {
      const cell = payload.cells?.[`${weekday}__${period.id}__${className}`];
      if (cell) cells[`${period.id}__${className}`] = cell;
    }
  }
  return { ...payload, cells, selectedDay: weekday };
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
    timetable: filterClass(getDailyPayload(toPayload(record), requestedDate), request.query.className),
    requestedDate,
    source,
  });
});

router.get('/templates', ensureMongo, async (_request, response) => {
  const records = await Timetable.find().sort({ mode: 1, fromDate: -1, updatedAt: -1 });
  response.json({ timetables: records.map(toPayload) });
});

router.post('/', ensureMongo, requireRole('admin', 'clerk'), async (request, response) => {
  const mode = ['override', 'weekly'].includes(request.body.mode) ? request.body.mode : 'default';
  const fromDate = mode === 'override' ? normalizeDate(request.body.fromDate) : '';
  const toDate = mode === 'override' ? normalizeDate(request.body.toDate || request.body.fromDate) : '';

  if (mode === 'override' && (!fromDate || !toDate || fromDate > toDate)) {
    response.status(400).json({ message: 'Valid from and to dates are required for a date-specific timetable.' });
    return;
  }

  const days = mode === 'weekly' ? normalizeStringList(request.body.days) : [];
  const payload = {
    name: String(request.body.name || (mode === 'default' ? 'Default Timetable' : 'Special Timetable')).trim(),
    mode,
    fromDate,
    toDate,
    days,
    classes: normalizeStringList(request.body.classes),
    periods: normalizePeriods(request.body.periods),
    cells: request.body.cells && typeof request.body.cells === 'object' ? request.body.cells : {},
    updatedBy: request.auth?.displayName || request.auth?.username || request.auth?.role || '',
  };

  if (!payload.classes.length || !payload.periods.length) {
    response.status(400).json({ message: 'At least one class column and one period row are required.' });
    return;
  }
  if (mode === 'weekly' && !payload.days.length) {
    response.status(400).json({ message: 'Select at least one weekday for a weekly timetable.' });
    return;
  }

  let record;
  if (request.body.id) {
    record = await Timetable.findByIdAndUpdate(request.body.id, payload, { new: true });
    if (!record) {
      response.status(404).json({ message: 'Timetable was not found.' });
      return;
    }
  } else if (mode !== 'override') {
    record = await Timetable.findOneAndUpdate(
      { mode },
      { ...payload, createdBy: payload.updatedBy },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  } else {
    record = await Timetable.create({ ...payload, createdBy: payload.updatedBy });
  }

  emitRealtimeInvalidation(TIMETABLE_UPDATED_EVENT, ['admin', 'clerk', 'teacher', 'student']);

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

  emitRealtimeInvalidation(TIMETABLE_UPDATED_EVENT, ['admin', 'clerk', 'teacher', 'student']);
  response.json({ message: 'Timetable removed.' });
});

export default router;
