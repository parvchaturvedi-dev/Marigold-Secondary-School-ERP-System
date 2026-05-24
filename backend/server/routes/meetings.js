import express from 'express';
import Meeting from '../models/Meeting.js';
import Notification from '../models/Notification.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { NOTIFICATIONS_UPDATED_EVENT } from './notifications.js';

const router = express.Router();
const MEETINGS_UPDATED_EVENT = 'mgps-erp-meetings-updated';

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

const toMeetingPayload = (meeting) => ({
  id: meeting._id.toString(),
  title: meeting.title,
  description: meeting.description,
  scopeType: meeting.scopeType,
  targetClasses: meeting.targetClasses || [],
  date: meeting.date,
  time: meeting.time,
  status: meeting.status,
  hostRole: meeting.hostRole,
  hostUsername: meeting.hostUsername,
  hostName: meeting.hostName,
  roomName: meeting.roomName,
  attendance: Object.fromEntries(meeting.attendance || []),
  createdAt: meeting.createdAt?.toISOString(),
  updatedAt: meeting.updatedAt?.toISOString(),
  endedAt: meeting.endedAt?.toISOString() || null,
});

const parseCsv = (value = '') =>
  String(value)
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const isPrivileged = (role) => role === 'admin' || role === 'clerk';

const createMeetingNotifications = async (meeting, request) => {
  const baseNotification = {
    title: meeting.title,
    description: meeting.description || `${meeting.hostName} started a Jitsi meeting.`,
    type: 'meeting',
    linkPage: 'Meetings',
    meetingId: meeting._id,
    createdByRole: request.auth?.role || '',
    createdByUsername: request.auth?.username || '',
  };

  const notifications = [];

  if (meeting.scopeType === 'class') {
    meeting.targetClasses.forEach((className) => {
      notifications.push({
        ...baseNotification,
        recipientRole: 'student',
        recipientClassName: className,
      });
      notifications.push({
        ...baseNotification,
        recipientRole: 'admin',
      });
      notifications.push({
        ...baseNotification,
        recipientRole: 'clerk',
      });
    });
  }

  if (meeting.scopeType === 'staff') {
    ['admin', 'clerk', 'teacher'].forEach((role) => {
      notifications.push({ ...baseNotification, recipientRole: role });
    });
  }

  if (meeting.scopeType === 'school') {
    ['admin', 'clerk', 'teacher', 'student'].forEach((role) => {
      notifications.push({ ...baseNotification, recipientRole: role });
    });
  }

  if (notifications.length) {
    await Notification.insertMany(notifications);
    emitRealtimeEvent(NOTIFICATIONS_UPDATED_EVENT);
  }
};

const canSeeMeeting = (meeting, { role, username, className, allottedClasses }) => {
  if (isPrivileged(role)) return true;
  if (role === 'student') {
    if (meeting.scopeType === 'staff') return false;
    if (meeting.scopeType === 'school') return true;
    return meeting.targetClasses.includes(className);
  }
  if (role === 'teacher') {
    if (meeting.hostUsername === username) return true;
    if (meeting.scopeType === 'staff') return true;
    if (meeting.scopeType === 'school') return false;
    return meeting.targetClasses.some((targetClass) => allottedClasses.includes(targetClass));
  }
  return false;
};

const canCreateMeeting = ({ actorRole, actorUsername, targetClasses, allottedClasses }) => {
  if (isPrivileged(actorRole)) return true;
  if (actorRole !== 'teacher') return false;
  if (!targetClasses.length) return false;
  return targetClasses.every((className) => allottedClasses.includes(className)) && actorUsername;
};

router.get('/', ensureMongo, async (request, response) => {
  const role = request.query.role || request.auth?.role || '';
  const username = request.query.username || request.auth?.username || '';
  const className = request.query.className || '';
  const allottedClasses = parseCsv(request.query.allottedClasses);
  const status = request.query.status;
  const query = status ? { status } : {};
  const meetings = await Meeting.find(query).sort({ createdAt: -1 }).limit(100);

  response.json(
    meetings
      .filter((meeting) => canSeeMeeting(meeting, { role, username, className, allottedClasses }))
      .map(toMeetingPayload)
  );
});

router.post('/', ensureMongo, async (request, response) => {
  const targetClasses = Array.isArray(request.body.targetClasses) ? request.body.targetClasses : [];
  const actorRole = request.auth?.role;
  const actorUsername = request.auth?.username;
  const allottedClasses = Array.isArray(request.body.allottedClasses) ? request.body.allottedClasses : [];

  if (!request.body.title || !request.body.date || !request.body.time || !request.body.roomName) {
    response.status(400).json({ message: 'Title, date, time, and Jitsi room are required.' });
    return;
  }

  if (request.body.scopeType === 'class' && !targetClasses.length) {
    response.status(400).json({ message: 'Select at least one class for a class meeting.' });
    return;
  }

  if (!canCreateMeeting({ actorRole, actorUsername, targetClasses, allottedClasses })) {
    response.status(403).json({ message: 'You cannot host meetings for the selected class.' });
    return;
  }

  const meeting = new Meeting({
    title: request.body.title,
    description: request.body.description || '',
    scopeType: request.body.scopeType || 'class',
    targetClasses,
    date: request.body.date,
    time: request.body.time,
    status: 'ongoing',
    hostRole: actorRole,
    hostUsername: actorUsername,
    hostName: request.body.hostName || actorUsername,
    roomName: request.body.roomName,
  });

  await meeting.save();
  await createMeetingNotifications(meeting, request);
  emitRealtimeEvent(MEETINGS_UPDATED_EVENT);
  response.status(201).json(toMeetingPayload(meeting));
});

router.patch('/:id/attendance', ensureMongo, async (request, response) => {
  const meeting = await Meeting.findById(request.params.id);

  if (!meeting) {
    response.status(404).json({ message: 'Meeting not found.' });
    return;
  }

  if (meeting.status === 'ended') {
    response.status(409).json({ message: 'This meeting has ended.' });
    return;
  }

  const entry = request.body.entry || {};
  const status = request.body.status || entry.status;
  const studentId = entry.studentId || request.body.studentId;

  if (!studentId || !['present', 'absent', 'rejected'].includes(status)) {
    response.status(400).json({ message: 'Student and attendance status are required.' });
    return;
  }

  if (
    request.auth?.role === 'student' &&
    meeting.scopeType === 'class' &&
    !meeting.targetClasses.includes(entry.className || request.body.className || '')
  ) {
    response.status(403).json({ message: 'This meeting is not assigned to your class.' });
    return;
  }

  meeting.attendance.set(studentId, {
    studentId,
    studentName: entry.studentName || request.body.studentName || studentId,
    className: entry.className || request.body.className || '',
    section: entry.section || request.body.section || '',
    status,
    respondedAt: new Date(),
  });

  await meeting.save();
  emitRealtimeEvent(MEETINGS_UPDATED_EVENT);
  response.json(toMeetingPayload(meeting));
});

router.patch('/:id/end', ensureMongo, async (request, response) => {
  const meeting = await Meeting.findById(request.params.id);

  if (!meeting) {
    response.status(404).json({ message: 'Meeting not found.' });
    return;
  }

  if (!isPrivileged(request.auth?.role) && meeting.hostUsername !== request.auth?.username) {
    response.status(403).json({ message: 'Only the host, admin, or clerk can end this meeting.' });
    return;
  }

  meeting.status = 'ended';
  meeting.endedAt = new Date();
  await meeting.save();
  emitRealtimeEvent(MEETINGS_UPDATED_EVENT);
  response.json(toMeetingPayload(meeting));
});

export default router;
