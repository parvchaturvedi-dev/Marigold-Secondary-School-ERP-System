// Notification creation helper: persists one Notification doc and best-effort
// fans out an Expo push to the resolved recipients. Push/token resolution is
// wrapped so a push failure never blocks the notification from being created.

import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { emitRealtimeEvent } from '../realtime.js';
import { sendExpoPush } from './push.js';

const NOTIFICATIONS_UPDATED_EVENT = 'mgps-erp-notifications-updated';

// Resolve the User docs that should receive a push for this notification,
// mirroring the notification's targeting fields.
const resolveRecipientUsers = async ({
  recipientUsername,
  recipientRole,
  recipientClassName,
  recipientStudentId,
}) => {
  // Most specific: a single named user.
  if (recipientUsername) {
    return User.find({ username: recipientUsername }).lean();
  }

  // Next most specific: a student targeted by admission number / studentId.
  // Look up their user account so only that student (and no one else) is paged.
  if (recipientStudentId) {
    const matched = await User.find({
      $or: [
        { username: recipientStudentId },
        { 'profile.admissionNumber': recipientStudentId },
        { 'profile.studentId': recipientStudentId },
        { 'profile.linkedStudents.admissionNumber': recipientStudentId },
      ],
    }).lean();
    if (matched.length) return matched;
    // Fall through only if we couldn't find anyone — no silent broadcast.
    return [];
  }

  // No role means we cannot safely target anyone.
  if (!recipientRole) {
    return [];
  }

  // If a class is specified, best-effort filter users of that role whose
  // profile.allottedClasses (or className) matches. If nothing matches on the
  // class filter, fall back to all users of that role.
  if (recipientClassName) {
    const classMatched = await User.find({
      role: recipientRole,
      $or: [
        { 'profile.allottedClasses': recipientClassName },
        { 'profile.className': recipientClassName },
      ],
    }).lean();

    if (classMatched.length) {
      return classMatched;
    }
  }

  return User.find({ role: recipientRole }).lean();
};

const collectTokens = (users = []) => {
  const tokens = [];
  for (const user of users) {
    if (Array.isArray(user?.pushTokens)) {
      tokens.push(...user.pushTokens);
    }
  }
  return [...new Set(tokens.filter(Boolean))];
};

export async function createNotification({
  title,
  description = '',
  type = 'general',
  linkPage = '',
  recipientRole = '',
  recipientUsername = '',
  recipientClassName = '',
  recipientStudentId = '',
}) {
  const notification = await Notification.create({
    title,
    description,
    type,
    linkPage,
    recipientRole,
    recipientUsername,
    recipientClassName,
    recipientStudentId,
    readBy: [],
  });

  // Best-effort push fan-out — never let this break notification creation.
  try {
    const users = await resolveRecipientUsers({
      recipientUsername,
      recipientRole,
      recipientClassName,
      recipientStudentId,
    });
    const tokens = collectTokens(users);

    if (tokens.length) {
      await sendExpoPush(tokens, {
        title,
        body: description || title,
        data: { type, linkPage },
      });
    }
  } catch (error) {
    // Swallow: notification is already persisted.
    console.error('[notify] push fan-out failed:', error?.message || error);
  }

  emitRealtimeEvent(NOTIFICATIONS_UPDATED_EVENT);

  return notification;
}

// Lightweight helper: create many notifications from a list of payloads.
export async function notifyMany(list = []) {
  const items = Array.isArray(list) ? list : [];
  return Promise.all(items.map((payload) => createNotification(payload)));
}

export default createNotification;
