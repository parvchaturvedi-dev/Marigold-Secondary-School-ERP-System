import express from 'express';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { resolveDisplayNames } from '../utils/nameLookup.js';
import { createNotification, notifyMany } from '../utils/notify.js';
import { sendExpoPush } from '../utils/push.js';
import { requireRole } from '../middleware/auth.js';

export const NOTIFICATIONS_UPDATED_EVENT = 'mgps-erp-notifications-updated';

const router = express.Router();

const NOTIFICATION_ROLES = ['admin', 'clerk', 'teacher', 'student', 'employee'];
const LINK_PAGES_BY_ROLE = {
  admin: [
    'Dashboard', 'AI Assistant', 'Academic Calender', 'Application', 'Assignment',
    'Attendance', 'Admin Management', 'Class Management', 'Class Preferences',
    'Clerk Management', 'Documents Management', 'Events', 'Examinations',
    'Exam Creation', 'Paper Creation', 'Paper Analysis', 'Paper Selected',
    'Report Card Management', 'Marks Management', 'Finance', 'Stock & Inventory',
    'Payroll', 'Id Card', 'Transfer Certificate', 'Study Certificate',
    'Leave Requests', 'Meetings', 'Notices', 'Profile', 'Student Ledger',
    'Student Profile', 'Subject Management', 'Teacher Management', 'Teacher Assignment',
    'Teacher Profile', 'Employee Management', 'Employee Assignment Management',
    'Class Finance List', 'Timetable', 'Timetable Management', 'Settings',
    'Student Assigning', 'Student Management', 'Sibling Assigning', 'Fees Receipt',
    'Users Management', 'Vault', 'Certification', 'About Us',
  ],
  clerk: [
    'Dashboard', 'Academic Calender', 'Application', 'Assignment', 'Attendance',
    'Class Management', 'Class Preferences', 'Paathshala History',
    'Documents Management', 'Events', 'Examinations', 'Exam Creation',
    'Paper Creation', 'Paper Analysis', 'Paper Selected', 'Marks Management',
    'Id Card', 'Transfer Certificate', 'Study Certificate', 'Leave Requests',
    'Meetings', 'Notices', 'Profile', 'My Salary', 'Settings', 'Sibling Assigning',
    'Student Assigning', 'Student Management', 'Student Profile',
    'Subject Management', 'Teacher Assignment', 'Teacher Management',
    'Teacher Profile', 'Employee Management', 'Employee Assignment Management',
    'Timetable', 'Timetable Management', 'Vault', 'Certification', 'About Us',
  ],
  student: [
    'Dashboard', 'Academic Calender', 'My Class', 'Timetable', 'Application',
    'Assignment', 'Attendance', 'Events', 'Examinations', 'Fees', 'Id Card',
    'Leave Requests', 'Meetings', 'Notices', 'Profile', 'Settings', 'Vault',
    'Certification', 'About Us',
  ],
  teacher: [
    'Dashboard', 'Academic Calender', 'My Class', 'Timetable', 'Application',
    'Assignment', 'Attendance', 'Events', 'Examinations', 'Paper Analysis',
    'Marks Management', 'Id Card', 'Leave Requests', 'Meetings', 'Notices',
    'Profile', 'My Salary', 'Settings', 'Vault', 'Certification', 'About Us',
  ],
  employee: ['Dashboard', 'Attendance', 'Notices', 'Payroll', 'Id Card', 'Academic Calender'],
};

const getStudentClassNames = (profile = {}) => {
  const source = profile && typeof profile === 'object' ? profile : {};
  return [...new Set(
    [
      ...(Array.isArray(source.studentProfiles) ? source.studentProfiles : []),
      ...(source.className ? [{ className: source.className }] : []),
    ]
      .map((student) => String(student?.className || '').trim())
      .filter(Boolean)
  )];
};

const getStudentClassCount = (users, className) =>
  users.filter((user) => getStudentClassNames(user.profile).includes(className)).length;

const getUserDesignation = (profile = {}) => {
  const source = profile && typeof profile === 'object' ? profile : {};
  return String(
    source.designation ||
    source.teacherProfile?.designation ||
    source.employeeProfile?.designation ||
    ''
  ).trim();
};

const isExpoToken = (token) =>
  typeof token === 'string' &&
  (token.startsWith('ExponentPushToken') || token.startsWith('ExpoPushToken'));

const collectPushTokens = (users = []) =>
  [...new Set(users.flatMap((user) => Array.isArray(user.pushTokens) ? user.pushTokens : []).filter(isExpoToken))];

const adminTargets = async (_request, response) => {
  const users = await User.find({ isActive: true }).select('role profile pushTokens').lean();
  const roleOptions = NOTIFICATION_ROLES.map((role) => {
    const roleUsers = users.filter((user) => user.role === role);
    const designations = role === 'teacher' || role === 'employee'
      ? [...new Set(roleUsers.map((user) => getUserDesignation(user.profile)).filter(Boolean))]
          .sort()
          .map((name) => ({
            name,
            count: roleUsers.filter(
              (user) => getUserDesignation(user.profile).toLowerCase() === name.toLowerCase()
            ).length,
          }))
      : [];
    return {
      role,
      count: roleUsers.length,
      pushTokenAccounts: roleUsers.filter(
        (user) => Array.isArray(user.pushTokens) && user.pushTokens.some(isExpoToken)
      ).length,
      classes: role === 'student'
        ? [...new Set(roleUsers.flatMap((user) => getStudentClassNames(user.profile)))]
            .sort()
            .map((name) => ({ name, count: getStudentClassCount(roleUsers, name) }))
        : [],
      designations,
      linkPages: LINK_PAGES_BY_ROLE[role],
    };
  });
  response.json({ roles: roleOptions });
};

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

router.get('/admin-targets', ensureMongo, requireRole('admin'), adminTargets);

router.post('/admin-broadcast', ensureMongo, requireRole('admin'), async (request, response) => {
  const title = String(request.body?.title || '').trim();
  const description = String(request.body?.description || '').trim();
  const requestedRoles = Array.isArray(request.body?.recipientRoles)
    ? request.body.recipientRoles
    : [request.body?.recipientRole];
  const recipientRoles = [...new Set(
    requestedRoles
      .filter((role) => typeof role === 'string')
      .map((role) => role.trim())
      .filter(Boolean)
  )];
  const recipientClassName = String(request.body?.recipientClassName || '').trim();
  const recipientDesignation = String(request.body?.recipientDesignation || '').trim();
  const linkPage = recipientRoles.length > 1
    ? 'Dashboard'
    : String(request.body?.linkPage || '').trim();

  if (!title || title.length > 120 || description.length > 2000) {
    response.status(400).json({ message: 'A title is required (up to 120 characters); the description must be at most 2000 characters.' });
    return;
  }
  if (!recipientRoles.length || recipientRoles.some((role) => !NOTIFICATION_ROLES.includes(role))) {
    response.status(400).json({ message: 'Choose at least one valid recipient role.' });
    return;
  }
  if (recipientRoles.length > 1 && (recipientClassName || recipientDesignation)) {
    response.status(400).json({ message: 'Class or designation targeting requires choosing just one role.' });
    return;
  }
  const recipientRole = recipientRoles[0];
  if (recipientClassName && recipientRole !== 'student') {
    response.status(400).json({ message: 'Class targeting is available for student notifications only.' });
    return;
  }
  if (recipientDesignation && !['teacher', 'employee'].includes(recipientRole)) {
    response.status(400).json({ message: 'Designation targeting is available for teachers or employees only.' });
    return;
  }
  if (linkPage && recipientRoles.some((role) => !LINK_PAGES_BY_ROLE[role].includes(linkPage))) {
    response.status(400).json({ message: 'The selected page is not available to every recipient role.' });
    return;
  }

  const users = await User.find({ role: { $in: recipientRoles }, isActive: true })
    .select('username role profile pushTokens')
    .lean();
  const recipients = users.filter((user) => {
    if (recipientClassName && !getStudentClassNames(user.profile).includes(recipientClassName)) {
      return false;
    }
    if (recipientDesignation && getUserDesignation(user.profile).toLowerCase() !== recipientDesignation.toLowerCase()) {
      return false;
    }
    return true;
  });

  if (!recipients.length) {
    response.status(404).json({ message: 'No active users match this role and audience filter.' });
    return;
  }

  const createdByRole = request.auth?.role || '';
  const createdByUsername = request.auth?.username || '';
  const notificationDocuments = recipientDesignation
    ? recipients.map((user) => ({
        recipientRole,
        recipientUsername: user.username,
        title,
        description,
        type: 'general',
        linkPage,
        createdByRole,
        createdByUsername,
        readBy: [],
      }))
    : recipientRoles.map((role) => ({
        recipientRole: role,
        recipientClassName,
        title,
        description,
        type: 'general',
        linkPage,
        createdByRole,
        createdByUsername,
        readBy: [],
      }));
  const notifications = await Notification.insertMany(notificationDocuments);

  let pushSent = 0;
  let pushErrors = 0;
  const tokens = collectPushTokens(recipients);
  const pushTokenRecipientCount = recipients.filter(
    (user) => Array.isArray(user.pushTokens) && user.pushTokens.some(isExpoToken)
  ).length;
  if (tokens.length) {
    try {
      const pushResult = await sendExpoPush(tokens, {
        title,
        body: description || title,
        data: { type: 'general', linkPage },
        categoryId: 'general',
      });
      pushSent = pushResult.sent;
      pushErrors = pushResult.errors.length;
      if (pushErrors) {
        console.error('[notifications] Custom broadcast push errors:', pushResult.errors);
      }
      if (pushResult.invalidTokens.length) {
        await User.updateMany(
          { pushTokens: { $in: pushResult.invalidTokens } },
          { $pull: { pushTokens: { $in: pushResult.invalidTokens } } }
        );
      }
    } catch (error) {
      pushErrors += 1;
      console.error('[notifications] Custom broadcast push processing failed:', {
        name: error?.name,
        code: error?.code,
      });
    }
  }

  emitRealtimeEvent(NOTIFICATIONS_UPDATED_EVENT);
  response.status(201).json({
    created: notifications.length,
    recipientCount: recipients.length,
    pushTokenCount: tokens.length,
    accountsWithoutPushToken: recipients.length - pushTokenRecipientCount,
    pushSent,
    pushErrors,
  });
});

const toPayload = (notification, username = '', authorNames = new Map()) => {
  const authorName = notification.createdByUsername
    ? authorNames.get(notification.createdByUsername) || notification.createdByUsername
    : '';
  const readReceipt = notification.readReceipts?.find((receipt) => receipt.username === username);
  const isRead = notification.readBy?.includes(username);
  const readAt = readReceipt?.readAt || (isRead ? notification.updatedAt : null);

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
    unread: !isRead,
    readAt: readAt?.toISOString?.() || null,
    time: notification.createdAt?.toISOString(),
    createdAt: notification.createdAt?.toISOString(),
  };
};

router.get('/admin-history', ensureMongo, requireRole('admin'), async (request, response) => {
  const parsedPage = Number.parseInt(request.query.page, 10);
  const parsedPageSize = Number.parseInt(request.query.pageSize, 10);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSize = Number.isInteger(parsedPageSize)
    ? Math.min(Math.max(parsedPageSize, 1), 100)
    : 50;
  const [total, items] = await Promise.all([
    Notification.countDocuments({}),
    Notification.find({})
      .sort({ createdAt: -1 })
      .skip((page - 1) * pageSize)
      .limit(pageSize)
      .lean(),
  ]);
  const authorNames = await resolveDisplayNames(items.map((item) => item.createdByUsername));
  response.json({
    items: items.map((item) => toPayload(item, '', authorNames)),
    page,
    pageSize,
    total,
    totalPages: Math.ceil(total / pageSize),
  });
});

router.delete('/admin-history', ensureMongo, requireRole('admin'), async (_request, response) => {
  const result = await Notification.deleteMany({});
  emitRealtimeEvent(NOTIFICATIONS_UPDATED_EVENT);
  response.json({ deleted: result.deletedCount || 0 });
});

const getRecipientQuery = ({ role, username, className, studentId }) => {
  const filters = [{ recipientRole: role, recipientUsername: username }];

  if (role === 'student') {
    filters.push({ recipientRole: 'student', recipientUsername: '' });
    filters.push({ recipientRole: 'student', recipientStudentId: studentId });
    filters.push({ recipientRole: 'student', recipientClassName: className });
  }

  if (role === 'teacher' || role === 'employee') {
    filters.push({ recipientRole: role, recipientUsername: '' });
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
    .limit(120);

  const authorNames = await resolveDisplayNames(
    notifications.map((item) => item.createdByUsername)
  );
  response.json(notifications.map((item) => toPayload(item, username, authorNames)));
});

router.patch('/read', ensureMongo, async (request, response) => {
  const ids = Array.isArray(request.body?.ids) ? request.body.ids : [];
  const username = request.auth?.username || '';
  const role = request.auth?.role || '';
  const activeStudent = request.auth?.activeStudent || {};
  const className = role === 'student'
    ? activeStudent.className || ''
    : String(request.body.className || '');
  const studentId = role === 'student'
    ? activeStudent.admissionNumber || activeStudent.id || username
    : String(request.body.studentId || '');

  if (!ids.length) {
    response.json({ updated: 0 });
    return;
  }

  const now = new Date();
  const result = await Notification.updateMany(
    {
      $and: [
        { _id: { $in: ids }, readBy: { $ne: username } },
        getRecipientQuery({ role, username, className, studentId }),
      ],
    },
    {
      $addToSet: {
        readBy: username,
        readReceipts: { username, readAt: now },
      },
    }
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
      recipientRole: 'student',
      recipientStudentId: item.recipientStudentId || '',
      recipientUsername: item.recipientUsername || '',
      recipientClassName: item.recipientClassName || '',
    }))
  );

  response.status(201).json({ sent: valid.length });
});

export default router;
