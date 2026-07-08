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
import { createNotification } from '../utils/notify.js';

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

// Returns true when `dateKey` (YYYY-MM-DD) is a holiday / off day for the given
// group ('student' | 'teacher'), because it is outside the group's session
// range, falls on a recurring weekly-off weekday, or matches a declared off day
// whose scope covers the group. Weekday is computed in local time.
const isOffDay = (dateKey, group, setting = {}) => {
  const key = clean(dateKey);
  if (!key) return false;

  const sessionStart = clean(
    group === 'teacher' ? setting.teacherSessionStart : setting.studentSessionStart
  );
  const sessionEnd = clean(
    group === 'teacher' ? setting.teacherSessionEnd : setting.studentSessionEnd
  );
  if (sessionStart && key < sessionStart) return true;
  if (sessionEnd && key > sessionEnd) return true;

  const weeklyOffDays = Array.isArray(
    group === 'teacher' ? setting.teacherWeeklyOffDays : setting.studentWeeklyOffDays
  )
    ? group === 'teacher'
      ? setting.teacherWeeklyOffDays
      : setting.studentWeeklyOffDays
    : [];
  const weekday = new Date(`${key}T00:00:00`).getDay();
  if (weeklyOffDays.map(Number).includes(weekday)) return true;

  const offDays = Array.isArray(setting.offDays) ? setting.offDays : [];
  return offDays.some(
    (entry) =>
      clean(entry?.date) === key &&
      (entry?.scope === 'both' || entry?.scope === group)
  );
};

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
  const action = clean(request.body?.action).toLowerCase();
  const source = clean(request.body?.source).toLowerCase();
  // Any non-admin write must clear the geofence — closes the QR-scan bypass
  // where a teacher POSTed source:"qr" and skipped the fence entirely.
  const isSelfService =
    request.auth?.role !== 'admin' ||
    ['clock-in', 'clock-out'].includes(action) ||
    ['self-service', 'teacher-mobile', 'clerk-self'].includes(source) ||
    request.body?.requiresGeofence === true;

  // Staff self clock-in / clock-out MUST happen inside the school boundary.
  // Guard both directions: if the admin hasn't configured the fence yet, refuse
  // instead of silently letting people clock from anywhere.
  if (isSelfService) {
    if (!hasSchoolFence) {
      response.status(400).json({
        message: 'School location is not configured. Ask an admin to set the geofence in Attendance settings.',
      });
      return;
    }
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      response.status(403).json({ message: 'Location is required. Enable GPS and try again.' });
      return;
    }
    const distance = haversineDistanceMeters(
      { latitude, longitude },
      { latitude: setting.geofenceLatitude, longitude: setting.geofenceLongitude }
    );
    const allowed = Number(setting.geofenceRadiusMeters || 50);
    if (distance > allowed) {
      const label = action === 'clock-out' ? 'clock out' : 'clock in';
      // Best-effort alert to admins that a staff member tried to clock in/out
      // from outside the campus boundary. Never let notify failure change the
      // response — the fence rejection below is what the client acts on.
      const breachRole = request.auth?.role || 'staff';
      findDirectoryPerson({ entityType: breachRole, entityId: request.auth?.username })
        .then((breachPerson) => {
          const personName = breachPerson?.displayName || request.auth?.username || 'A staff member';
          return createNotification({
            title: 'Attendance Boundary Alert',
            description: `${personName} (${breachRole}) tried to ${label} ~${Math.round(distance)}m away from campus (allowed ${allowed}m).`,
            type: 'general',
            linkPage: 'Attendance',
            recipientRole: 'admin',
          });
        })
        .catch(() => {});
      response.status(403).json({
        message: `You are ${Math.round(distance)}m away from the school. You can only ${label} within ${allowed}m of the campus.`,
        distanceMeters: Math.round(distance),
        allowedMeters: allowed,
      });
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
    joinDate: clean(
      source.dateOfJoining ||
        source.joiningDate ||
        source.joinDate ||
        source.doj ||
        profile.dateOfJoining ||
        ''
    ),
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
  // clockInAt / clockOutAt only apply to staff clock flows; omit the keys
  // entirely for scans/registers so a full-document update never nulls them.
  ...(body.clockInAt !== undefined ? { clockInAt: body.clockInAt } : {}),
  ...(body.clockOutAt !== undefined ? { clockOutAt: body.clockOutAt } : {}),
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

// Normalizes an incoming set of weekday numbers (0=Sun..6=Sat), dropping
// anything out of range or non-numeric and de-duplicating.
const normalizeWeeklyOffDays = (value) => {
  if (!Array.isArray(value)) return [];
  const seen = new Set();
  for (const item of value) {
    const day = Number(item);
    if (Number.isInteger(day) && day >= 0 && day <= 6) seen.add(day);
  }
  return Array.from(seen).sort((a, b) => a - b);
};

// Normalizes declared off/holiday days to the stored shape.
const normalizeOffDays = (value) => {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const date = normalizeDateKey(entry?.date);
      const scope = ['student', 'teacher', 'both'].includes(entry?.scope)
        ? entry.scope
        : 'both';
      return { date, scope, reason: clean(entry?.reason) };
    })
    .filter((entry) => entry.date);
};

// A session START date may only be changed while the currently-saved value is
// empty OR still in the future. Once it is today or past, it is locked.
// Returns the value to persist, or a { locked } marker on an illegal change.
const resolveSessionStart = (savedValue, incomingValue, today) => {
  const saved = clean(savedValue);
  const provided = incomingValue !== undefined && incomingValue !== null;
  const incoming = normalizeDateKey(incomingValue);
  const changed = provided && incoming !== saved;
  const isLocked = Boolean(saved) && saved <= today;
  if (changed && isLocked) return { locked: true, value: saved };
  if (!provided) return { locked: false, value: saved };
  return { locked: false, value: incoming };
};

router.put('/settings', requireRole('admin'), async (request, response) => {
  const current = await getSettings();
  const today = todayKey();

  const studentStart = resolveSessionStart(
    current.studentSessionStart,
    request.body.studentSessionStart,
    today
  );
  if (studentStart.locked) {
    response.status(400).json({
      message: 'The student session start date can no longer be changed because it has already begun.',
    });
    return;
  }
  const teacherStart = resolveSessionStart(
    current.teacherSessionStart,
    request.body.teacherSessionStart,
    today
  );
  if (teacherStart.locked) {
    response.status(400).json({
      message: 'The teacher session start date can no longer be changed because it has already begun.',
    });
    return;
  }

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
      studentSessionStart: studentStart.value,
      studentSessionEnd:
        request.body.studentSessionEnd !== undefined
          ? normalizeDateKey(request.body.studentSessionEnd)
          : clean(current.studentSessionEnd),
      teacherSessionStart: teacherStart.value,
      teacherSessionEnd:
        request.body.teacherSessionEnd !== undefined
          ? normalizeDateKey(request.body.teacherSessionEnd)
          : clean(current.teacherSessionEnd),
      studentWeeklyOffDays:
        request.body.studentWeeklyOffDays !== undefined
          ? normalizeWeeklyOffDays(request.body.studentWeeklyOffDays)
          : normalizeWeeklyOffDays(current.studentWeeklyOffDays),
      teacherWeeklyOffDays:
        request.body.teacherWeeklyOffDays !== undefined
          ? normalizeWeeklyOffDays(request.body.teacherWeeklyOffDays)
          : normalizeWeeklyOffDays(current.teacherWeeklyOffDays),
      offDays:
        request.body.offDays !== undefined
          ? normalizeOffDays(request.body.offDays)
          : normalizeOffDays(current.offDays),
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

  if (isOffDay(todayKey(), 'teacher', setting)) {
    response.status(409).json({ message: 'Today is a holiday. Attendance is closed.' });
    return;
  }

  const person = await findDirectoryPerson({
    entityType: request.auth.role,
    entityId: request.auth.username,
  });

  if (!person) {
    response.status(404).json({ message: 'No linked staff profile found for this account.' });
    return;
  }

  const attendanceDate = todayKey();
  const isClockOut = action === 'clock-out';
  const now = request.serverTimestamp || new Date();

  // Read today's existing state to enforce clock-in-once + clock-out ordering.
  const existing = await AttendanceLog.findOne({
    entityType: person.entityType,
    entityId: person.entityId,
    attendanceDate,
  }).lean();
  const hasClockIn = Boolean(existing?.clockInAt);
  const hasClockOut = Boolean(existing?.clockOutAt);

  if (isClockOut) {
    if (!hasClockIn) {
      response.status(409).json({ message: 'Please clock in first.' });
      return;
    }
    if (hasClockOut) {
      response.status(409).json({ message: 'You have already clocked out today.' });
      return;
    }
  } else if (hasClockIn) {
    response.status(409).json({ message: 'You have already clocked in today.', clockedIn: true });
    return;
  }

  // Clock-in decides the day's status (present / half-day by scan time). Clock-out
  // keeps whatever status the clock-in already established.
  let dayStatus;
  if (isClockOut) {
    dayStatus = existing?.status || 'present';
  } else {
    dayStatus = resolveStatus(setting, now);
    if (dayStatus === 'closed') dayStatus = 'half-day';
  }

  const clockFields = isClockOut
    ? { clockInAt: existing?.clockInAt || null, clockOutAt: now }
    : { clockInAt: now, clockOutAt: existing?.clockOutAt || null };

  const logPayload = buildLogPayload(
    person,
    {
      ...request.body,
      source,
      action: isClockOut ? 'clock-out' : 'clock-in',
      attendanceDate,
      status: dayStatus,
      recordedBy: request.auth.username,
      geofenceDistanceMeters: request.geofenceDistanceMeters,
      ...clockFields,
    },
    dayStatus,
    setting,
    now
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
  response.json({ message: `${isClockOut ? 'Clock-out' : 'Clock-in'} recorded.`, log, setting });
});

// Today's clock state for the signed-in staff member so the client can render
// exactly one action (Clock In → Clock Out → done).
router.get('/my-clock-status', requireRole('admin', 'clerk', 'teacher'), async (request, response) => {
  const attendanceDate = todayKey();
  const setting = await getSettings();
  const person = await findDirectoryPerson({
    entityType: request.auth.role,
    entityId: request.auth.username,
  });
  const entityType = person?.entityType || request.auth.role;
  const entityId = person?.entityId || upper(request.auth.username);

  // A holiday / off day means there is nothing to clock — surface it so the
  // client can hide the clock-in action and skip counting the day.
  if (isOffDay(attendanceDate, 'teacher', setting)) {
    response.json({
      clockedIn: false,
      clockedOut: false,
      clockInAt: null,
      clockOutAt: null,
      status: 'off',
      isOffDay: true,
    });
    return;
  }

  const log = await AttendanceLog.findOne({ entityType, entityId, attendanceDate }).lean();

  // Prefer the explicit clockInAt/clockOutAt fields; fall back to scannedAt+action
  // for any legacy row written before those fields existed.
  const toIso = (value) => (value ? new Date(value).toISOString() : null);
  const legacyStamp = log?.scannedAt ? new Date(log.scannedAt).toISOString() : null;
  const clockInAt =
    toIso(log?.clockInAt) || (log && log.action !== 'clock-out' ? legacyStamp : null);
  const clockOutAt =
    toIso(log?.clockOutAt) || (log && log.action === 'clock-out' ? legacyStamp : null);

  response.json({
    clockedIn: Boolean(clockInAt),
    clockedOut: Boolean(clockOutAt),
    clockInAt,
    clockOutAt,
    status: log?.status || 'absent',
  });
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
  if (isOffDay(attendanceDate, 'student', setting)) {
    response.status(409).json({
      message: 'This day is a declared holiday / off day. Student attendance is closed for this date.',
    });
    return;
  }
  const directory = await listDirectory();
  const studentsById = new Map(
    directory
      .filter((item) => item.entityType === 'student' && item.className === className)
      .map((item) => [item.entityId, item])
  );
  const scannedAt = new Date();
  const writes = [];
  const notifyTargets = [];

  for (const record of request.body.records) {
    const entityId = upper(record.entityId || record.admissionNumber);
    const person = studentsById.get(entityId);
    if (!person) continue;

    const status = clean(record.status).toLowerCase() === 'absent' ? 'absent' : 'present';
    // Notify EVERY marked student — present as well as absent/half-day.
    notifyTargets.push({ admissionNumber: person.admissionNumber, status });
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

  // Notify each marked student — present, absent and half-day. Non-blocking.
  for (const target of notifyTargets) {
    createNotification({
      title: 'Attendance Marked',
      description: `You were marked ${target.status} on ${attendanceDate} for ${className}.`,
      type: 'attendance',
      linkPage: 'Attendance',
      recipientRole: 'student',
      recipientStudentId: target.admissionNumber,
    }).catch(() => {});
  }

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

const toLocalKey = (date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const monthBounds = (reference = new Date()) => {
  const year = reference.getFullYear();
  const month = reference.getMonth();
  const first = new Date(year, month, 1);
  const last = new Date(year, month + 1, 0);
  return { from: toLocalKey(first), to: toLocalKey(last) };
};

router.get('/staff-records', requireRole('admin', 'clerk'), async (request, response) => {
  const defaults = monthBounds();
  const from = clean(request.query.from) || defaults.from;
  const to = clean(request.query.to) || defaults.to;

  const [directory, logs] = await Promise.all([
    listDirectory(),
    AttendanceLog.find({
      entityType: { $in: ['teacher', 'clerk'] },
      attendanceDate: { $gte: from, $lte: to },
    })
      .sort({ attendanceDate: 1, scannedAt: 1 })
      .lean(),
  ]);

  // Seed with every teacher/clerk from the directory so admins can see who
  // never clocked in (daysPresent 0, empty days list).
  const staffById = new Map();
  directory
    .filter((person) => person.entityType === 'teacher' || person.entityType === 'clerk')
    .forEach((person) => {
      staffById.set(person.entityId, {
        entityId: person.entityId,
        displayName: person.displayName || person.entityId,
        role: person.entityType,
        _days: new Map(),
      });
    });

  // Merge logs per (entityId, date). Only ONE AttendanceLog row can exist per
  // staff/day (unique index), but its `action` tells us whether the recorded
  // scannedAt is a clock-in or clock-out; clock-out logs still imply presence.
  logs.forEach((log) => {
    let staff = staffById.get(log.entityId);
    if (!staff) {
      staff = {
        entityId: log.entityId,
        displayName: log.displayName || log.entityId,
        role: log.entityType,
        _days: new Map(),
      };
      staffById.set(log.entityId, staff);
    }
    const date = log.attendanceDate;
    const day = staff._days.get(date) || { date, clockInAt: null, clockOutAt: null, status: log.status };
    const stamp = log.scannedAt ? new Date(log.scannedAt).toISOString() : null;
    if (log.action === 'clock-out') {
      day.clockOutAt = stamp;
    } else {
      day.clockInAt = stamp;
    }
    // Prefer a present-ish status label if any log for the day was present.
    if (log.status === 'present' || log.status === 'manual') day.status = log.status;
    else if (!day.status) day.status = log.status;
    staff._days.set(date, day);
  });

  const isPresentDay = (day) =>
    Boolean(day.clockInAt || day.clockOutAt) &&
    day.status !== 'absent';

  const staff = Array.from(staffById.values())
    .map((entry) => {
      const days = Array.from(entry._days.values()).sort((a, b) => a.date.localeCompare(b.date));
      const daysPresent = days.filter(isPresentDay).length;
      return {
        entityId: entry.entityId,
        displayName: entry.displayName,
        role: entry.role,
        daysPresent,
        days,
      };
    })
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  response.json({ from, to, staff });
});

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const pad2 = (value) => String(value).padStart(2, '0');
const normalizeDateKey = (value) => {
  const raw = clean(value);
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? '' : toLocalKey(parsed);
};

// Per-staff monthly attendance breakdown that powers the Staff Attendance
// screen (monthly cards + datewise detail + client-side export).
router.get('/staff-report', requireRole('admin', 'clerk'), async (request, response) => {
  const entityId = upper(request.query.entityId);
  if (!entityId) {
    response.status(400).json({ message: 'entityId is required.' });
    return;
  }

  const fromInput = normalizeDateKey(request.query.from);
  const toInput = normalizeDateKey(request.query.to);

  const [directory, logs, setting] = await Promise.all([
    listDirectory(),
    AttendanceLog.find({
      entityType: { $in: ['teacher', 'clerk', 'admin'] },
      entityId,
      ...(fromInput || toInput
        ? {
            attendanceDate: {
              ...(fromInput ? { $gte: fromInput } : {}),
              ...(toInput ? { $lte: toInput } : {}),
            },
          }
        : {}),
    })
      .sort({ attendanceDate: 1, scannedAt: 1 })
      .lean(),
    getSettings(),
  ]);

  const person = directory.find(
    (item) =>
      ['teacher', 'clerk', 'admin'].includes(item.entityType) && item.entityId === entityId
  );

  // One AttendanceLog row per staff/day; index it by date for O(1) day lookups.
  const logByDate = new Map();
  logs.forEach((log) => {
    const stamp = log.scannedAt ? new Date(log.scannedAt).toISOString() : null;
    const clockInAt = log.clockInAt
      ? new Date(log.clockInAt).toISOString()
      : log.action !== 'clock-out'
      ? stamp
      : null;
    const clockOutAt = log.clockOutAt
      ? new Date(log.clockOutAt).toISOString()
      : log.action === 'clock-out'
      ? stamp
      : null;
    logByDate.set(log.attendanceDate, { status: log.status, clockInAt, clockOutAt });
  });

  const today = todayKey();
  const earliestLog = logs.length ? logs[0].attendanceDate : '';
  const joinDate = normalizeDateKey(person?.joinDate) || earliestLog || today;

  // Effective span: explicit from/to when given, else joinDate → today.
  let start = fromInput || joinDate;
  let end = toInput || today;
  if (start > end) start = end;

  const months = [];
  let year = Number(start.slice(0, 4));
  let month = Number(start.slice(5, 7));
  const endYear = Number(end.slice(0, 4));
  const endMonth = Number(end.slice(5, 7));
  let guard = 0;

  while ((year < endYear || (year === endYear && month <= endMonth)) && guard < 240) {
    const monthKey = `${year}-${pad2(month)}`;
    const lastDayNum = new Date(year, month, 0).getDate();
    const monthStartKey = `${monthKey}-01`;
    const monthEndKey = `${monthKey}-${pad2(lastDayNum)}`;
    const dayFromKey = start > monthStartKey ? start : monthStartKey;
    const dayToKey = end < monthEndKey ? end : monthEndKey;
    const dayFrom = Number(dayFromKey.slice(8, 10));
    const dayTo = Number(dayToKey.slice(8, 10));

    const days = [];
    for (let dayNum = dayFrom; dayNum <= dayTo; dayNum += 1) {
      const dateKey = `${monthKey}-${pad2(dayNum)}`;
      const entry = logByDate.get(dateKey);
      const weekday = new Date(`${dateKey}T00:00:00`).toLocaleDateString('en-US', {
        weekday: 'short',
      });

      let status;
      if (isOffDay(dateKey, 'teacher', setting)) {
        // Declared / recurring holiday or outside the session — neither present
        // nor absent; excluded from every count below.
        status = 'off';
      } else if (entry?.status) {
        status = entry.status;
      } else if (dateKey < today) {
        // Working day, in the past, no clock log at all → auto-absent.
        status = 'absent';
      } else {
        // Today (not yet clocked) or a future day stays pending.
        status = 'unmarked';
      }

      days.push({
        date: dateKey,
        weekday,
        status,
        clockInAt: entry?.clockInAt || null,
        clockOutAt: entry?.clockOutAt || null,
      });
    }

    const schoolDays = days.filter(
      (day) => day.status !== 'unmarked' && day.status !== 'off'
    ).length;
    const presentDays = days.filter(
      (day) => day.status === 'present' || day.status === 'manual'
    ).length;
    const halfDays = days.filter((day) => day.status === 'half-day').length;
    const absentDays = days.filter((day) => day.status === 'absent').length;
    const percent = schoolDays
      ? Number(((presentDays / schoolDays) * 100).toFixed(1))
      : 0;

    months.push({
      month: monthKey,
      label: `${MONTH_NAMES[month - 1]} ${year}`,
      schoolDays,
      presentDays,
      absentDays,
      halfDays,
      percent,
      days,
    });

    month += 1;
    if (month > 12) {
      month = 1;
      year += 1;
    }
    guard += 1;
  }

  response.json({
    entityId,
    displayName: person?.displayName || logs[0]?.displayName || entityId,
    role: person?.entityType || logs[0]?.entityType || 'teacher',
    joinDate,
    months,
  });
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
  const isPastDate = date < todayKey();
  const buildCountsForType = (entityType) => {
    const group = entityType === 'student' ? 'student' : 'teacher';
    const people = directory.filter((item) => item.entityType === entityType);
    // Whole group is off on this date — count nobody present or absent.
    if (isOffDay(date, group, settings)) {
      return { total: 0, present: 0, absent: 0, late: 0, pending: 0, off: true };
    }
    const isStaff = group === 'teacher';
    return people.reduce(
      (acc, item) => {
        const status = logByKey.get(`${item.entityType}:${item.entityId}`)?.status || '';
        if (status === 'present' || status === 'manual') acc.present += 1;
        else if (status === 'half-day') acc.late += 1;
        else if (!status && isStaff && !isPastDate) {
          // Today (or future) staff who have not clocked yet are pending, not absent.
          acc.pending += 1;
        } else acc.absent += 1;
        acc.total += 1;
        return acc;
      },
      { total: 0, present: 0, absent: 0, late: 0, pending: 0 }
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
    isStudentOffDay: isOffDay(date, 'student', settings),
    isTeacherOffDay: isOffDay(date, 'teacher', settings),
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
