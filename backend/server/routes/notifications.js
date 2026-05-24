import express from 'express';
import Notification from '../models/Notification.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';

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

const toPayload = (notification, username = '') => ({
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
  unread: !notification.readBy?.includes(username),
  time: notification.createdAt?.toISOString(),
  createdAt: notification.createdAt?.toISOString(),
});

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
  const role = request.query.role || request.auth?.role || '';
  const username = request.query.username || request.auth?.username || '';
  const className = request.query.className || '';
  const studentId = request.query.studentId || '';
  const notifications = await Notification.find(
    getRecipientQuery({ role, username, className, studentId })
  )
    .sort({ createdAt: -1 })
    .limit(80);

  response.json(notifications.map((item) => toPayload(item, username)));
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

export default router;
