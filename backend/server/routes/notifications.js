import express from 'express';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { resolveDisplayName } from '../utils/nameLookup.js';
import { createNotification, notifyMany } from '../utils/notify.js';
import { requireRole } from '../middleware/auth.js';

export const NOTIFICATIONS_UPDATED_EVENT = 'mgps-erp-notifications-updated';

const router = express.Router();

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

const toPayload = async (notification, username = '') => {
  // Resolve the sender (createdByUsername) to a human name so "sent by TCH-983"
  // renders as "sent by <name>". Falls back to the username string if unresolved.
  const authorName = notification.createdByUsername
    ? await resolveDisplayName(notification.createdByUsername)
    : '';

  return {
    id: notification._id.toString(),
    title: notification.title,
    description: notification.description,
    text: notification.description || notification.title,
    type: notification.type,
    linkPage: notification.linkPage,
    meetingId: notification.meetingId?.toString() || '',
    recipientRole: notification.recipientRole,
    recipientUsername: notification.recipientUsername,
    recipientStudentId: notification.recipientStudentId,
    recipientClassName: notification.recipientClassName,
    createdByRole: notification.createdByRole,
    createdByUsername: notification.createdByUsername,
    createdByName: authorName,
    authorName,
    unread: !notification.readBy?.includes(username),
    time: notification.createdAt?.toISOString(),
    createdAt: notification.createdAt?.toISOString(),
  };
};

const getRecipientQuery = ({ role, username, className, studentId }) => {
  const filters = [{ recipientRole: role, recipientUsername: username }];

  if (role === 'student') {
    filters.push({ recipientRole: 'student', recipientUsername: '' });
    filters.push({ recipientRole: 'student', recipientStudentId: studentId });
    filters.push({ recipientRole: 'student', recipientClassName: className });
  }

  if (role === 'teacher') {
    filters.push({ recipientRole: 'teacher', recipientUsername: '' });
  }

  if (role === 'admin' || role === 'clerk') {
    filters.push({ recipientRole: role, recipientUsername: '' });
  }

  return { $or: filters };
};

router.get('/', ensureMongo, async (request, response) => {
  // Always read the recipient identity from the authenticated session so a
  // student cannot pass ?role=admin&username=ADM-001 to peek at admin's inbox.
  const role = request.auth?.role || '';
  const username = request.auth?.username || '';
  const activeStudent = request.auth?.activeStudent || {};
  const className = role === 'student'
    ? (activeStudent.className || '')
    : role === 'teacher'
      ? String(request.query.className || '') // teachers can filter by allotted class
      : String(request.query.className || '');
  const studentId = role === 'student'
    ? (activeStudent.admissionNumber || activeStudent.id || username)
    : String(request.query.studentId || '');
  const notifications = await Notification.find(
    getRecipientQuery({ role, username, className, studentId })
  )
    .sort({ createdAt: -1 })
    .limit(80);

  response.json(await Promise.all(notifications.map((item) => toPayload(item, username))));
});

router.patch('/read', ensureMongo, async (request, response) => {
  const ids = Array.isArray(request.body.ids) ? request.body.ids : [];
  const username = request.auth?.username || '';

  if (!ids.length) {
    response.json({ updated: 0 });
    return;
  }

  const result = await Notification.updateMany(
    { _id: { $in: ids } },
    { $addToSet: { readBy: username } }
  );

  emitRealtimeEvent(NOTIFICATIONS_UPDATED_EVENT);
  response.json({ updated: result.modifiedCount || 0 });
});

// Register an Expo push token for the authenticated user.
router.post('/register-token', ensureMongo, async (request, response) => {
  const token = typeof request.body?.token === 'string' ? request.body.token.trim() : '';
  const username = request.auth?.username || '';

  if (!token || !username) {
    response.status(400).json({ message: 'A token and authenticated user are required.' });
    return;
  }

  await User.updateOne({ username }, { $addToSet: { pushTokens: token } });
  response.json({ ok: true });
});

// Remove an Expo push token for the authenticated user (e.g. on logout).
router.post('/unregister-token', ensureMongo, async (request, response) => {
  const token = typeof request.body?.token === 'string' ? request.body.token.trim() : '';
  const username = request.auth?.username || '';

  if (!token || !username) {
    response.status(400).json({ message: 'A token and authenticated user are required.' });
    return;
  }

  await User.updateOne({ username }, { $pull: { pushTokens: token } });
  response.json({ ok: true });
});

// Create a notification (admin/clerk/teacher). Fans out an Expo push via createNotification.
router.post('/', ensureMongo, requireRole('admin', 'clerk', 'teacher'), async (request, response) => {
  const {
    title = '',
    description = '',
    type = 'general',
    linkPage = '',
    recipientRole = '',
    recipientUsername = '',
    recipientClassName = '',
    recipientStudentId = '',
  } = request.body || {};

  // Only admins can broadcast school-wide (recipientRole set without a
  // recipientUsername/StudentId/ClassName filter). Teachers/clerks must scope
  // to a specific class or student, otherwise the push would fan out to
  // everyone in the school.
  if (
    request.auth.role !== 'admin' &&
    recipientRole &&
    !recipientUsername &&
    !recipientStudentId &&
    !recipientClassName
  ) {
    response.status(403).json({ message: 'Only admins can broadcast to a whole role. Please scope by class or user.' });
    return;
  }

  if (!title) {
    response.status(400).json({ message: 'A notification title is required.' });
    return;
  }

  const notification = await createNotification({
    title,
    description,
    type,
    linkPage,
    recipientRole,
    recipientUsername,
    recipientClassName,
    recipientStudentId,
  });

  response.status(201).json(await toPayload(notification, request.auth?.username || ''));
});

// Bulk send — one scoped notification per item. Used by "Send fee reminder to
// all" so each pending student gets their own amount in one request (each item
// still fans out an in-app + push notification via createNotification).
router.post('/bulk', ensureMongo, requireRole('admin', 'clerk'), async (request, response) => {
  const items = Array.isArray(request.body?.items) ? request.body.items : [];
  // Every item must target a specific recipient — no whole-role broadcast here.
  const valid = items.filter(
    (item) =>
      item &&
      item.title &&
      (item.recipientStudentId || item.recipientUsername || item.recipientClassName)
  );

  if (!valid.length) {
    response.status(400).json({ message: 'No valid notification items to send.' });
    return;
  }

  await notifyMany(
    valid.map((item) => ({
      title: item.title,
      description: item.description || '',
      type: item.type || 'fee',
      linkPage: item.linkPage || '',
      recipientStudentId: item.recipientStudentId || '',
      recipientUsername: item.recipientUsername || '',
      recipientClassName: item.recipientClassName || '',
    }))
  );

  response.status(201).json({ sent: valid.length });
});

export default router;
