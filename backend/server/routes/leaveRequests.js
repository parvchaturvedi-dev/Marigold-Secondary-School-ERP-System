import express from 'express';
import LeaveRequest from '../models/LeaveRequest.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { createNotification } from '../utils/notify.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

const LEAVE_STATUS = {
  pendingAdmin: 'pending_admin',
  pendingClassTeacher: 'pending_class_teacher',
  forwardedAdmin: 'forwarded_admin',
  approvedByAdmin: 'approved_by_admin',
  rejectedByAdmin: 'rejected_by_admin',
  approvedByTeacher: 'approved_by_teacher',
  rejectedByTeacher: 'rejected_by_teacher',
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

// Human-readable label for a raw leave status, for use in push/notification text.
const STATUS_LABELS = {
  [LEAVE_STATUS.pendingAdmin]: 'pending admin review',
  [LEAVE_STATUS.pendingClassTeacher]: 'pending class teacher review',
  [LEAVE_STATUS.forwardedAdmin]: 'forwarded to admin',
  [LEAVE_STATUS.approvedByAdmin]: 'approved',
  [LEAVE_STATUS.rejectedByAdmin]: 'rejected',
  [LEAVE_STATUS.approvedByTeacher]: 'approved',
  [LEAVE_STATUS.rejectedByTeacher]: 'rejected',
};

// Notify the applicant that their leave request status changed.
const notifyLeaveRequester = async (leaveRequest) => {
  if (!leaveRequest.applicantUsername) return;
  const label = STATUS_LABELS[leaveRequest.status] || leaveRequest.status;
  await createNotification({
    title: 'Leave Request Update',
    description: `Your leave request was ${label}`,
    type: 'leave',
    linkPage: 'Leave Requests',
    recipientRole: leaveRequest.applicantRole || '',
    recipientUsername: leaveRequest.applicantUsername,
  });
};

const toLeavePayload = (request) => ({
  id: request._id.toString(),
  title: request.title,
  description: request.description,
  applicantRole: request.applicantRole,
  applicantName: request.applicantName,
  applicantUsername: request.applicantUsername,
  applicantIdentityId: request.applicantIdentityId,
  applicantIdentity: request.applicantIdentity,
  className: request.className,
  metaInfo: request.metaInfo,
  leaveMode: request.leaveMode,
  startDate: request.startDate,
  endDate: request.endDate,
  status: request.status,
  classTeacherUsername: request.classTeacherUsername,
  classTeacherName: request.classTeacherName,
  adminActionBy: request.adminActionBy,
  adminActionAt: request.adminActionAt?.toISOString() || null,
  teacherActionBy: request.teacherActionBy,
  teacherActionAt: request.teacherActionAt?.toISOString() || null,
  createdAt: request.createdAt?.toISOString(),
  updatedAt: request.updatedAt?.toISOString(),
});

router.get('/', ensureMongo, async (request, response) => {
  const { role, username, identityId, identityName, className } = request.query;
  const query = {};

  if (role === 'teacher') {
    // A teacher may only see class-wide requests for a class they are allotted;
    // ignore an arbitrary ?className to prevent cross-class scope leakage.
    const allotted = Array.isArray(request.auth?.allottedClasses) ? request.auth.allottedClasses : [];
    const teacherClass = className && allotted.includes(className) ? className : '';
    query.$or = [
      { applicantUsername: username },
      { classTeacherUsername: username },
      ...(teacherClass ? [{ className: teacherClass }] : []),
    ];
  } else if (role === 'student') {
    query.applicantUsername = username;
    if (identityId || identityName) {
      query.$or = [
        { applicantIdentityId: identityId || '' },
        { applicantIdentity: identityName || '' },
        { applicantIdentityId: '' },
      ];
    }
  } else if (role !== 'admin') {
    query.applicantUsername = username;
  }

  const requests = await LeaveRequest.find(query).sort({ updatedAt: -1 });
  response.json(requests.map(toLeavePayload));
});

router.post('/', ensureMongo, async (request, response) => {
  const payload = request.body;
  // Force applicant identity from the authenticated session so a user cannot
  // spoof another username or escalate their role to reroute the approval flow.
  payload.applicantRole = request.auth.role;
  payload.applicantUsername = request.auth.username;
  const isStudent = payload.applicantRole === 'student';

  if (!payload.title || !payload.description || !payload.startDate) {
    response.status(400).json({ message: 'Title, description, and start date are required.' });
    return;
  }

  const leaveRequest = await LeaveRequest.create({
    title: payload.title,
    description: payload.description,
    applicantRole: payload.applicantRole,
    applicantName: payload.applicantName,
    applicantUsername: payload.applicantUsername,
    applicantIdentityId: payload.applicantIdentityId || '',
    applicantIdentity: payload.applicantIdentity || '',
    className: payload.className || '',
    metaInfo: payload.metaInfo || '',
    leaveMode: payload.leaveMode || 'single',
    startDate: payload.startDate,
    endDate: payload.leaveMode === 'single' ? payload.startDate : payload.endDate || payload.startDate,
    status: isStudent ? LEAVE_STATUS.pendingClassTeacher : LEAVE_STATUS.pendingAdmin,
    classTeacherUsername: isStudent ? payload.classTeacherUsername || '' : '',
    classTeacherName: isStudent ? payload.classTeacherName || '' : '',
  });

  emitRealtimeEvent('mgps-erp-leave-requests-updated');

  // Notify the approver about the new leave request (best-effort, non-blocking).
  try {
    if (isStudent && leaveRequest.classTeacherUsername) {
      await createNotification({
        title: 'New Leave Request',
        description: `${leaveRequest.applicantName || 'A student'} applied for leave.`,
        type: 'leave',
        linkPage: 'Leave Requests',
        recipientUsername: leaveRequest.classTeacherUsername,
      });
    } else {
      await createNotification({
        title: 'New Leave Request',
        description: `${leaveRequest.applicantName || 'Someone'} applied for leave.`,
        type: 'leave',
        linkPage: 'Leave Requests',
        recipientRole: 'admin',
      });
    }
  } catch (error) {
    console.error('[leaveRequests] create notify failed:', error?.message || error);
  }

  response.status(201).json(toLeavePayload(leaveRequest));
});

router.patch('/:id/admin-action', ensureMongo, requireRole('admin', 'clerk'), async (request, response) => {
  // Never trust adminUsername from body — take it from the authenticated session.
  request.body.adminUsername = request.auth.username;
  const leaveRequest = await LeaveRequest.findById(request.params.id);

  if (!leaveRequest) {
    response.status(404).json({ message: 'Leave request not found.' });
    return;
  }

  leaveRequest.status =
    request.body.action === 'approve' ? LEAVE_STATUS.approvedByAdmin : LEAVE_STATUS.rejectedByAdmin;
  leaveRequest.adminActionBy = request.body.adminUsername || 'Admin';
  leaveRequest.adminActionAt = new Date();
  await leaveRequest.save();

  emitRealtimeEvent('mgps-erp-leave-requests-updated');

  // Notify the requester that their leave request status changed (best-effort).
  try {
    await notifyLeaveRequester(leaveRequest);
  } catch (error) {
    console.error('[leaveRequests] admin-action notify failed:', error?.message || error);
  }

  response.json(toLeavePayload(leaveRequest));
});

router.patch('/:id/teacher-action', ensureMongo, requireRole('teacher', 'admin', 'clerk'), async (request, response) => {
  request.body.teacherUsername = request.auth.username;
  const leaveRequest = await LeaveRequest.findById(request.params.id);

  if (!leaveRequest) {
    response.status(404).json({ message: 'Leave request not found.' });
    return;
  }

  // Only the assigned class teacher (or an admin/clerk) may act on this request.
  const actorIsClassTeacher =
    !leaveRequest.classTeacherUsername ||
    (request.auth.role === 'teacher' && request.auth.username === leaveRequest.classTeacherUsername);
  if (!actorIsClassTeacher && !['admin', 'clerk'].includes(request.auth.role)) {
    response.status(403).json({ message: 'Only the assigned class teacher can act on this leave request.' });
    return;
  }

  const statusByAction = {
    approve: LEAVE_STATUS.approvedByTeacher,
    reject: LEAVE_STATUS.rejectedByTeacher,
    forward: LEAVE_STATUS.forwardedAdmin,
  };

  leaveRequest.status = statusByAction[request.body.action] || leaveRequest.status;
  leaveRequest.teacherActionBy = request.body.teacherUsername || 'Teacher';
  leaveRequest.teacherActionAt = new Date();
  await leaveRequest.save();

  emitRealtimeEvent('mgps-erp-leave-requests-updated');

  if (request.body.action === 'forward') {
    // Forwarded to admin — notify admin that a request needs review (best-effort).
    try {
      await createNotification({
        title: 'Leave Request Forwarded',
        description: 'A leave request needs admin review.',
        type: 'leave',
        linkPage: 'Leave Requests',
        recipientRole: 'admin',
      });
    } catch (error) {
      console.error('[leaveRequests] forward notify failed:', error?.message || error);
    }
  } else {
    // Approve/reject — notify the applicant that their request status changed (best-effort).
    try {
      await notifyLeaveRequester(leaveRequest);
    } catch (error) {
      console.error('[leaveRequests] teacher-action notify failed:', error?.message || error);
    }
  }

  response.json(toLeavePayload(leaveRequest));
});

export default router;
