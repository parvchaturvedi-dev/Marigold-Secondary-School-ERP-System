import express from 'express';
import AttendanceLog from '../models/AttendanceLog.js';
import AttendanceSetting from '../models/AttendanceSetting.js';
import BiometricProfile from '../models/BiometricProfile.js';
import FraudAlert from '../models/FraudAlert.js';
import ModuleState from '../models/ModuleState.js';
import User from '../models/User.js';
import { isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { emitRealtimeEvent } from '../realtime.js';

const router = express.Router();
const STUDENTS_NAMESPACE = 'admin-student-management-students';
const TEACHERS_NAMESPACE = 'admin-teacher-management-list';
const CLERKS_NAMESPACE = 'admin-clerk-management-list';
const eventName = 'mgps-erp-attendance:updated';

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

const todayKey = () => new Date().toISOString().slice(0, 10);
const clean = (value = '') => String(value || '').trim();
const upper = (value = '') => clean(value).toUpperCase();
const toNumber = (value) => {
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
};
const normalizeBssid = (value = '') => upper(value).replace(/-/g, ':');

const haversineDistanceMeters = (pointA = {}, pointB = {}) => {
  const lat1 = toNumber(pointA.latitude);
  const lon1 = toNumber(pointA.longitude);
  const lat2 = toNumber(pointB.latitude);
  const lon2 = toNumber(pointB.longitude);
  if ([lat1, lon1, lat2, lon2].some((value) => value === null)) return Number.POSITIVE_INFINITY;

  const radius = 6371000;
  const toRadians = (degree) => (degree * Math.PI) / 180;
  const deltaLat = toRadians(lat2 - lat1);
  const deltaLon = toRadians(lon2 - lon1);
  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) * Math.sin(deltaLon / 2) ** 2;
  return 2 * radius * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
};

const logFraudAlert = async (request, reason, payload = {}, severity = 'high') =>
  FraudAlert.create({
    username: request.auth?.username || '',
    role: request.auth?.role || '',
    sessionId: request.sessionID || '',
    deviceId: clean(payload.deviceId || request.body?.deviceId),
    reason,
    severity,
    payload,
  }).catch((error) => {
    console.error('[attendance:fraud-alert]', { reason, message: error.message });
  });

const parseMinutes = (value = '00:00') => {
  const [hours = 0, minutes = 0] = String(value).split(':').map((part) => Number(part) || 0);
  return hours * 60 + minutes;
};

const getLocalMinutes = (date = new Date(), timezone = 'Asia/Kolkata') => {
  const parts = new Intl.DateTimeFormat('en-GB', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
    timeZone: timezone || 'Asia/Kolkata',
  }).formatToParts(date);
  const hour = Number(parts.find((part) => part.type === 'hour')?.value || 0);
  const minute = Number(parts.find((part) => part.type === 'minute')?.value || 0);
  return hour * 60 + minute;
};

const resolveStatus = (setting = {}, scannedAt = new Date()) => {
  const scanMinutes = getLocalMinutes(scannedAt, setting.timezone);
  if (scanMinutes <= parseMinutes(setting.presentUntil)) return 'present';
  if (scanMinutes <= parseMinutes(setting.halfDayUntil)) return 'half-day';
  if (scanMinutes <= parseMinutes(setting.closeAfter)) return 'half-day';
  return 'closed';
};

const getSettings = () =>
  AttendanceSetting.findOneAndUpdate(
    { key: 'default' },
    { $setOnInsert: { key: 'default' } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).lean();

const validateAttendanceExecution = async (request, response, next) => {
  const setting = await getSettings();
  request.attendanceSetting = setting;
  request.serverTimestamp = new Date();

  const metadata = request.body?.metadata || {};
  const mockLocation = request.body?.isMockLocation === true || metadata.isMockLocation === true || metadata.mockLocation === true;
  if (mockLocation) {
    await logFraudAlert(request, 'Mock location provider detected.', request.body, 'critical');
    if (request.session) request.session.fraudBlacklisted = true;
    response.status(403).json({ message: 'Mock location provider detected. Session blacklisted.' });
    return;
  }

  const latitude = toNumber(request.body?.gpsLatitude ?? request.body?.latitude ?? metadata.latitude);
  const longitude = toNumber(request.body?.gpsLongitude ?? request.body?.longitude ?? metadata.longitude);
  const hasSchoolFence = setting.geofenceLatitude !== null && setting.geofenceLongitude !== null;
  const requiresFence =
    hasSchoolFence &&
    (request.body?.requiresGeofence === true ||
      ['clock-in', 'clock-out'].includes(clean(request.body?.action).toLowerCase()) ||
      ['self-service', 'teacher-mobile', 'clerk-self'].includes(clean(request.body?.source).toLowerCase()));

  if (requiresFence) {
    const distance = haversineDistanceMeters(
      { latitude, longitude },
      { latitude: setting.geofenceLatitude, longitude: setting.geofenceLongitude }
    );
    if (distance > Number(setting.geofenceRadiusMeters || 100)) {
      response.status(403).json({ message: 'Out of school boundary', distanceMeters: Math.round(distance) });
      return;
    }
    request.geofenceDistanceMeters = Math.round(distance);
  }

  const incomingBssid = normalizeBssid(request.body?.wifiBssid || metadata.wifiBssid);
  const authorizedBssid = normalizeBssid(setting.authorizedWifiBssid);
  if (authorizedBssid && incomingBssid && incomingBssid !== authorizedBssid) {
    response.status(403).json({ message: 'Unauthorized school WiFi router.' });
    return;
  }

  if (setting.enforceReceptionQr && request.body?.receptionQrVerified === false) {
    response.status(403).json({ message: 'Reception QR verification is required.' });
    return;
  }

  next();
};

const readStateArray = async (namespace) => {
  const record = await ModuleState.findOne({ namespace }).lean();
  return Array.isArray(record?.value) ? record.value : [];
};

const normalizeStudent = (student = {}, index = 0) => {
  const raw = student.rawProfile || {};
  const admissionNumber = upper(student.admissionNumber || student.id || raw.admissionNumber);
  const displayName = clean(student.displayName || student.name || raw.studentName || `Student ${index + 1}`);
  const className = clean(student.className || student.class || raw.targetClass);
  return {
    entityType: 'student',
    entityId: admissionNumber,
    admissionNumber,
    displayName,
    className,
    section: clean(student.section || raw.section),
    rollNo: Number(student.rollNo || raw.rollNo || index + 1),
    fatherName: clean(student.fatherName || raw.fatherName),
    motherName: clean(student.motherName || raw.motherName),
    mobileNumber: clean(student.guardianPhone || student.mobile || raw.guardianMobile || raw.mobileNo),
  };
};

const normalizeStaffRecord = (person = {}, role = 'teacher', index = 0) => {
  const profile = person.profile || {};
  const source = profile.teacherProfile || profile.clerkProfile || person;
  const entityId = upper(person.username || source.id || source.empId || `${role}-${index + 1}`);
  return {
    entityType: role,
    entityId,
    admissionNumber: '',
    displayName: clean(person.displayName || source.displayName || source.name || entityId),
    className: clean(source.assignedClassTeacherFor || ''),
    section: clean(source.section || ''),
    rollNo: index + 1,
    fatherName: '',
    motherName: '',
    mobileNumber: clean(profile.mobile || source.mobile || source.phone),
  };
};

const listDirectory = async () => {
  const [students, teachers, clerks, admins] = await Promise.all([
    readStateArray(STUDENTS_NAMESPACE),
    readStateArray(TEACHERS_NAMESPACE),
    readStateArray(CLERKS_NAMESPACE),
    User.find({ role: 'admin' }).lean(),
  ]);

  return [
    ...students.map(normalizeStudent).filter((item) => item.entityId),
    ...teachers.map((item, index) => normalizeStaffRecord(item, 'teacher', index)).filter((item) => item.entityId),
    ...clerks.map((item, index) => normalizeStaffRecord(item, 'clerk', index)).filter((item) => item.entityId),
    ...admins.map((item, index) => normalizeStaffRecord(item, 'admin', index)).filter((item) => item.entityId),
  ];
};

const parseQrPayload = (payload = '') => {
  if (typeof payload === 'object' && payload) return payload;
  const value = clean(payload);
  if (!value) return {};

  try {
    return JSON.parse(value);
  } catch {
    const lines = value.split(/\r?\n/);
    return lines.reduce((acc, line) => {
      const [key, ...rest] = line.split(':');
      if (!key || !rest.length) return acc;
      acc[key.trim().toLowerCase().replace(/[^a-z0-9]+/g, '')] = rest.join(':').trim();
      return acc;
    }, {});
  }
};

const findDirectoryPerson = async ({ entityType = '', entityId = '', admissionNumber = '', qrPayload = '' }) => {
  const parsedQr = parseQrPayload(qrPayload);
  const lookupId = upper(
    entityId ||
      admissionNumber ||
      parsedQr.entityId ||
      parsedQr.admissionNumber ||
      parsedQr.admNo ||
      parsedQr.admno ||
      parsedQr['admno'] ||
      parsedQr.empId ||
      parsedQr.empid
  );
  const lookupType = clean(entityType || parsedQr.entityType || parsedQr.type).toLowerCase();
  const directory = await listDirectory();

  return directory.find((person) => {
    const matchesType = !lookupType || person.entityType === lookupType;
    const matchesId = person.entityId === lookupId || person.admissionNumber === lookupId;
    return matchesType && lookupId && matchesId;
  });
};

const buildLogPayload = (person, body, status, setting, scannedAt) => ({
  entityType: person.entityType,
  entityId: person.entityId,
  displayName: person.displayName,
  className: person.className,
  section: person.section,
  admissionNumber: person.admissionNumber,
  fatherName: person.fatherName,
  motherName: person.motherName,
  mobileNumber: person.mobileNumber,
  attendanceDate: clean(body.attendanceDate) || todayKey(),
  scannedAt,
  status,
  source: body.source,
  deviceId: clean(body.deviceId),
  deviceType: clean(body.deviceType),
  gpsLatitude: toNumber(body.gpsLatitude ?? body.latitude),
  gpsLongitude: toNumber(body.gpsLongitude ?? body.longitude),
  wifiBssid: normalizeBssid(body.wifiBssid),
  action: clean(body.action) || 'scan',
  note: clean(body.note),
  recordedBy: clean(body.recordedBy),
  audit: {
    presentUntil: setting.presentUntil,
    halfDayUntil: setting.halfDayUntil,
    closeAfter: setting.closeAfter,
    timezone: setting.timezone,
    geofenceDistanceMeters: body.geofenceDistanceMeters,
    serverTimestampApplied: true,
  },
});

const getPeriodRange = (period = 'monthly') => {
  const now = new Date();
  const start = new Date(now);
  if (period === 'weekly') start.setDate(now.getDate() - 6);
  else if (period === 'yearly') start.setMonth(now.getMonth() - 11);
  else start.setDate(now.getDate() - 30);
  return start.toISOString().slice(0, 10);
};

router.use(ensureMongo);

router.get('/settings', requireRole('admin', 'clerk', 'teacher'), async (_request, response) => {
  response.json(await getSettings());
});

router.put('/settings', requireRole('admin'), async (request, response) => {
  const setting = await AttendanceSetting.findOneAndUpdate(
    { key: 'default' },
    {
      presentUntil: clean(request.body.presentUntil) || '08:30',
      halfDayUntil: clean(request.body.halfDayUntil) || '10:30',
      closeAfter: clean(request.body.closeAfter) || '11:00',
      timezone: clean(request.body.timezone) || 'Asia/Kolkata',
      allowTeacherQrScan: request.body.allowTeacherQrScan !== false,
      schoolAddress: clean(request.body.schoolAddress),
      geofenceLatitude: toNumber(request.body.geofenceLatitude),
      geofenceLongitude: toNumber(request.body.geofenceLongitude),
      geofenceRadiusMeters: Math.max(25, Number(request.body.geofenceRadiusMeters) || 100),
      authorizedWifiBssid: normalizeBssid(request.body.authorizedWifiBssid),
      enforceReceptionQr: request.body.enforceReceptionQr === true,
      updatedBy: request.auth.username,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  emitRealtimeEvent(eventName, { type: 'settings', setting });
  response.json(setting);
});

router.get('/directory', requireRole('admin', 'clerk', 'teacher'), async (request, response) => {
  const type = clean(request.query.type).toLowerCase();
  const className = clean(request.query.className);
  const directory = await listDirectory();
  const biometrics = await BiometricProfile.find({}).lean();
  const biometricByKey = new Map(biometrics.map((item) => [`${item.entityType}:${item.entityId}`, item]));
  const rows = directory
    .filter((item) => !type || type === 'all' || item.entityType === type)
    .filter((item) => !className || item.className === className)
    .map((item) => ({
      ...item,
      biometric: biometricByKey.get(`${item.entityType}:${item.entityId}`) || null,
    }));

  response.json({ rows });
});

router.put('/biometrics', requireRole('admin', 'clerk'), async (request, response) => {
  const person = await findDirectoryPerson(request.body);
  if (!person) {
    response.status(404).json({ message: 'Matching ERP profile was not found for biometric registration.' });
    return;
  }

  const biometricToken = clean(request.body.biometricToken);
  if (biometricToken.length < 4) {
    response.status(400).json({ message: 'Biometric token/device template is required.' });
    return;
  }

  const biometric = await BiometricProfile.findOneAndUpdate(
    { entityType: person.entityType, entityId: person.entityId },
    {
      ...person,
      biometricToken,
      enrolledBy: request.auth.username,
      updatedBy: request.auth.username,
      isActive: request.body.isActive !== false,
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  emitRealtimeEvent(eventName, { type: 'biometric', biometric });
  response.json({ message: 'Biometric profile saved.', biometric });
});

router.post('/scan', requireRole('admin', 'clerk', 'teacher'), validateAttendanceExecution, async (request, response) => {
  const source = clean(request.body.source || request.body.mode || 'qr').toLowerCase();
  const setting = request.attendanceSetting || (await getSettings());

  if (source === 'biometric' && !['admin', 'clerk'].includes(request.auth.role)) {
    response.status(403).json({ message: 'Only admin and clerk can mark biometric attendance.' });
    return;
  }

  if (source === 'qr' && request.auth.role === 'teacher' && !setting.allowTeacherQrScan) {
    response.status(403).json({ message: 'Teacher QR scan is disabled by attendance settings.' });
    return;
  }

  let person = null;
  if (source === 'biometric') {
    const biometric = await BiometricProfile.findOne({
      biometricToken: clean(request.body.biometricToken),
      isActive: true,
    }).lean();
    if (biometric) person = biometric;
  } else {
    person = await findDirectoryPerson(request.body);
  }

  if (!person) {
    response.status(404).json({ message: 'No linked ERP profile found for this scan.' });
    return;
  }

  const scannedAt = request.serverTimestamp || new Date();
  const requestedStatus = clean(request.body.status).toLowerCase();
  const resolvedStatus = ['manual', 'absent', 'present', 'half-day'].includes(requestedStatus)
    ? requestedStatus
    : resolveStatus(setting, scannedAt);
  if (resolvedStatus === 'closed' && request.body.force !== true) {
    response.status(409).json({
      message: 'Attendance window is closed for this scan.',
      status: resolvedStatus,
      setting,
    });
    return;
  }

  const logPayload = buildLogPayload(
    person,
    {
      ...request.body,
      source,
      recordedBy: request.auth.username,
      geofenceDistanceMeters: request.geofenceDistanceMeters,
      action: request.body.action || 'scan',
    },
    resolvedStatus,
    setting,
    scannedAt
  );

  const log = await AttendanceLog.findOneAndUpdate(
    {
      entityType: logPayload.entityType,
      entityId: logPayload.entityId,
      attendanceDate: logPayload.attendanceDate,
    },
    logPayload,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  emitRealtimeEvent(eventName, { type: 'scan', log });
  response.json({ message: 'Attendance marked.', log, setting });
});

router.post('/clock', requireRole('admin', 'clerk', 'teacher'), validateAttendanceExecution, async (request, response) => {
  const source = clean(request.body.source || 'self-service').toLowerCase();
  const action = clean(request.body.action || 'clock-in').toLowerCase();
  const setting = request.attendanceSetting || (await getSettings());
  const person = await findDirectoryPerson({
    entityType: request.auth.role,
    entityId: request.auth.username,
  });

  if (!person) {
    response.status(404).json({ message: 'No linked staff profile found for this account.' });
    return;
  }

  const logPayload = buildLogPayload(
    person,
    {
      ...request.body,
      source,
      action: action === 'clock-out' ? 'clock-out' : 'clock-in',
      attendanceDate: todayKey(),
      status: 'present',
      recordedBy: request.auth.username,
      geofenceDistanceMeters: request.geofenceDistanceMeters,
    },
    'present',
    setting,
    request.serverTimestamp || new Date()
  );

  const log = await AttendanceLog.findOneAndUpdate(
    {
      entityType: logPayload.entityType,
      entityId: logPayload.entityId,
      attendanceDate: logPayload.attendanceDate,
    },
    logPayload,
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  emitRealtimeEvent(eventName, { type: 'clock', log });
  response.json({ message: `${action === 'clock-out' ? 'Clock-out' : 'Clock-in'} recorded.`, log, setting });
});

router.post('/students/batch', requireRole('admin', 'clerk', 'teacher'), async (request, response) => {
  const attendanceDate = clean(request.body.attendanceDate) || todayKey();
  const className = clean(request.body.className);
  const overrideToken = clean(request.body.adminOverrideToken);
  const isHistorical = attendanceDate !== todayKey();
  const isTeacher = request.auth.role === 'teacher';

  if (!className || !Array.isArray(request.body.records)) {
    response.status(400).json({ message: 'Class and attendance records are required.' });
    return;
  }

  if (isTeacher) {
    const user = await User.findOne({ username: request.auth.username }).lean();
    const assigned = clean(user?.profile?.teacherProfile?.assignedClassTeacherFor || user?.profile?.assignedClassTeacherFor);
    if (assigned !== className) {
      response.status(403).json({ message: 'Only the assigned class teacher can update this class register.' });
      return;
    }
    if (isHistorical && !overrideToken) {
      response.status(403).json({ message: 'Historical edits require an Admin override token.' });
      return;
    }
  }

  const setting = await getSettings();
  const directory = await listDirectory();
  const studentsById = new Map(
    directory
      .filter((item) => item.entityType === 'student' && item.className === className)
      .map((item) => [item.entityId, item])
  );
  const scannedAt = new Date();
  const writes = [];

  for (const record of request.body.records) {
    const entityId = upper(record.entityId || record.admissionNumber);
    const person = studentsById.get(entityId);
    if (!person) continue;

    const status = clean(record.status).toLowerCase() === 'absent' ? 'absent' : 'present';
    const logPayload = buildLogPayload(
      person,
      {
        source: 'manual',
        action: request.auth.role === 'admin' ? 'override' : 'student-register',
        attendanceDate,
        recordedBy: request.auth.username,
        note: clean(request.body.note) || (request.auth.role === 'admin' ? 'Admin override register update' : 'Class register update'),
      },
      status,
      setting,
      scannedAt
    );

    writes.push({
      updateOne: {
        filter: { entityType: 'student', entityId: person.entityId, attendanceDate },
        update: { $set: logPayload },
        upsert: true,
      },
    });
  }

  if (writes.length) await AttendanceLog.bulkWrite(writes);
  const logs = await AttendanceLog.find({ attendanceDate, className, entityType: 'student' }).lean();
  emitRealtimeEvent(eventName, { type: 'student-batch', attendanceDate, className });
  response.json({ message: `Saved ${writes.length} attendance records.`, count: writes.length, logs });
});

router.get('/logs', requireRole('admin', 'clerk', 'teacher', 'student'), async (request, response) => {
  const period = clean(request.query.period || 'monthly').toLowerCase();
  const attendanceDate = clean(request.query.date);
  const from = clean(request.query.from) || (attendanceDate ? '' : getPeriodRange(period));
  const query = {};

  if (attendanceDate) query.attendanceDate = attendanceDate;
  if (from) query.attendanceDate = { $gte: from };
  if (request.query.className) query.className = clean(request.query.className);
  if (request.query.entityType) query.entityType = clean(request.query.entityType).toLowerCase();
  if (request.query.entityId) query.entityId = upper(request.query.entityId);

  if (request.auth.role === 'student') {
    const user = await User.findOne({ username: request.auth.username }).lean();
    const profileIds = (user?.profile?.studentProfiles || [])
      .map((student) => upper(student.admissionNumber || student.id))
      .filter(Boolean);
    query.entityType = 'student';
    query.entityId = { $in: profileIds.length ? profileIds : [upper(request.auth.username.replace(/^STD-/, ''))] };
  }

  const logs = await AttendanceLog.find(query).sort({ attendanceDate: -1, scannedAt: -1 }).limit(1200).lean();
  response.json({ logs });
});

router.get('/overview', requireRole('admin', 'clerk', 'teacher'), async (request, response) => {
  const date = clean(request.query.date) || todayKey();
  const className = clean(request.query.className);
  const period = clean(request.query.period || 'monthly').toLowerCase();
  const [directory, logs, trendLogs, settings] = await Promise.all([
    listDirectory(),
    AttendanceLog.find({
      attendanceDate: date,
      ...(className ? { className } : {}),
    }).lean(),
    AttendanceLog.find({ attendanceDate: { $gte: getPeriodRange(period) } }).lean(),
    getSettings(),
  ]);

  const logByKey = new Map(logs.map((log) => [`${log.entityType}:${log.entityId}`, log]));
  const buildCountsForType = (entityType) => {
    const people = directory.filter((item) => item.entityType === entityType);
    return people.reduce(
      (acc, item) => {
        const status = logByKey.get(`${item.entityType}:${item.entityId}`)?.status || 'absent';
        if (status === 'present' || status === 'manual') acc.present += 1;
        else if (status === 'half-day') acc.late += 1;
        else acc.absent += 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0 }
    );
  };
  const roster = directory
    .filter((item) => item.entityType === 'student')
    .filter((item) => !className || item.className === className)
    .map((item) => ({ ...item, todayLog: logByKey.get(`${item.entityType}:${item.entityId}`) || null }));
  const counts = roster.reduce(
    (acc, item) => {
      const status = item.todayLog?.status || 'unmarked';
      acc[status] = (acc[status] || 0) + 1;
      acc.total += 1;
      return acc;
    },
    { total: 0, present: 0, 'half-day': 0, absent: 0, manual: 0, closed: 0, unmarked: 0 }
  );
  const trend = trendLogs.reduce((acc, log) => {
    const key = log.attendanceDate;
    acc[key] = acc[key] || { date: key, present: 0, halfDay: 0, absent: 0, manual: 0 };
    if (log.status === 'present') acc[key].present += 1;
    if (log.status === 'half-day') acc[key].halfDay += 1;
    if (log.status === 'absent') acc[key].absent += 1;
    if (log.status === 'manual') acc[key].manual += 1;
    return acc;
  }, {});

  response.json({
    date,
    settings,
    counts,
    roleSummary: {
      clerk: buildCountsForType('clerk'),
      teacher: buildCountsForType('teacher'),
      student: buildCountsForType('student'),
    },
    roster,
    logs,
    trend: Object.values(trend).sort((a, b) => a.date.localeCompare(b.date)),
  });
});

export default router;
