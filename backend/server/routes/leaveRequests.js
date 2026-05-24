import express from 'express';
import LeaveRequest from '../models/LeaveRequest.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';

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
    query.$or = [
      { applicantUsername: username },
      { classTeacherUsername: username },
      ...(className ? [{ className }] : []),
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
  response.status(201).json(toLeavePayload(leaveRequest));
});

router.patch('/:id/admin-action', ensureMongo, async (request, response) => {
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
  response.json(toLeavePayload(leaveRequest));
});

router.patch('/:id/teacher-action', ensureMongo, async (request, response) => {
  const leaveRequest = await LeaveRequest.findById(request.params.id);

  if (!leaveRequest) {
    response.status(404).json({ message: 'Leave request not found.' });
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
  response.json(toLeavePayload(leaveRequest));
});

export default router;
