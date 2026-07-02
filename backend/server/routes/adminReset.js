import express from 'express';
import ModuleState from '../models/ModuleState.js';
import User from '../models/User.js';
import AttendanceLog from '../models/AttendanceLog.js';
import Assignment from '../models/Assignment.js';
import Application from '../models/Application.js';
import Event from '../models/Event.js';
import Meeting from '../models/Meeting.js';
import Notification from '../models/Notification.js';
import AcademicCalendar from '../models/AcademicCalendar.js';
import ExaminationState from '../models/ExaminationState.js';
import VaultItem from '../models/VaultItem.js';
import AiReceipt from '../models/AiReceipt.js';
import LeaveRequest from '../models/LeaveRequest.js';
import Timetable from '../models/Timetable.js';
import { isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { syncIdentityUsersFromState } from '../utils/identity.js';

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

const VALID_SCOPES = new Set(['all', 'students', 'teachers', 'clerks']);

const STUDENT_NAMESPACES = [
  'admin-student-management-students',
  'admin-finance-alumni-pending',
  'admin-finance-class-ledgers',
];
const TEACHER_NAMESPACE = 'admin-teacher-management-list';
const CLERK_NAMESPACE = 'admin-clerk-management-list';

// Run a single delete op; record its count or its error so one failure never
// aborts the wider reset. `deleted`/`errors` are the accumulators returned to
// the caller.
const runOp = async (deleted, errors, key, fn) => {
  try {
    const result = await fn();
    deleted[key] = (deleted[key] || 0) + (result?.deletedCount ?? 0);
  } catch (error) {
    errors.push({ op: key, message: error?.message || String(error) });
  }
};

router.post('/factory-reset', ensureMongo, requireRole('admin'), async (request, response) => {
  const requested = Array.isArray(request.body?.scopes) ? request.body.scopes : [];
  const scopes = [...new Set(requested.map((scope) => String(scope || '').trim().toLowerCase()))]
    .filter((scope) => VALID_SCOPES.has(scope));

  if (!scopes.length) {
    response.status(400).json({
      message: "Provide scopes: a subset of ['all','students','teachers','clerks'].",
    });
    return;
  }

  // 'all' is a superset — collapse everything else into it.
  const effectiveScopes = scopes.includes('all') ? ['all'] : scopes;

  const deleted = {};
  const errors = [];

  if (effectiveScopes.includes('all')) {
    // ModuleState wholesale, every non-admin user, plus all satellite collections.
    // Admin User docs and their profiles are never touched.
    await runOp(deleted, errors, 'moduleState', () => ModuleState.deleteMany({}));
    await runOp(deleted, errors, 'users', () => User.deleteMany({ role: { $ne: 'admin' } }));
    await runOp(deleted, errors, 'attendanceLogs', () => AttendanceLog.deleteMany({}));
    await runOp(deleted, errors, 'assignments', () => Assignment.deleteMany({}));
    await runOp(deleted, errors, 'applications', () => Application.deleteMany({}));
    await runOp(deleted, errors, 'events', () => Event.deleteMany({}));
    await runOp(deleted, errors, 'meetings', () => Meeting.deleteMany({}));
    await runOp(deleted, errors, 'notifications', () => Notification.deleteMany({}));
    await runOp(deleted, errors, 'academicCalendar', () => AcademicCalendar.deleteMany({}));
    await runOp(deleted, errors, 'examinationState', () => ExaminationState.deleteMany({}));
    await runOp(deleted, errors, 'vaultItems', () => VaultItem.deleteMany({}));
    await runOp(deleted, errors, 'aiReceipts', () => AiReceipt.deleteMany({}));
    await runOp(deleted, errors, 'leaveRequests', () => LeaveRequest.deleteMany({}));
    await runOp(deleted, errors, 'timetables', () => Timetable.deleteMany({}));
  } else {
    if (effectiveScopes.includes('students')) {
      await runOp(deleted, errors, 'studentModuleState', () =>
        ModuleState.deleteMany({ namespace: { $in: STUDENT_NAMESPACES } })
      );
      await runOp(deleted, errors, 'studentUsers', () => User.deleteMany({ role: 'student' }));
      await runOp(deleted, errors, 'studentAttendanceLogs', () =>
        AttendanceLog.deleteMany({ entityType: 'student' })
      );
    }

    if (effectiveScopes.includes('teachers')) {
      await runOp(deleted, errors, 'teacherModuleState', () =>
        ModuleState.deleteMany({ namespace: TEACHER_NAMESPACE })
      );
      await runOp(deleted, errors, 'teacherUsers', () => User.deleteMany({ role: 'teacher' }));
      await runOp(deleted, errors, 'teacherAttendanceLogs', () =>
        AttendanceLog.deleteMany({ entityType: 'teacher' })
      );
    }

    if (effectiveScopes.includes('clerks')) {
      await runOp(deleted, errors, 'clerkModuleState', () =>
        ModuleState.deleteMany({ namespace: CLERK_NAMESPACE })
      );
      await runOp(deleted, errors, 'clerkUsers', () => User.deleteMany({ role: 'clerk' }));
      await runOp(deleted, errors, 'clerkAttendanceLogs', () =>
        AttendanceLog.deleteMany({ entityType: 'clerk' })
      );
    }
  }

  // Re-provision identity users from whatever master state remains (deactivates
  // logins whose source records were just wiped).
  try {
    await syncIdentityUsersFromState();
  } catch (error) {
    errors.push({ op: 'identitySync', message: error?.message || String(error) });
  }

  response.json({ ok: true, scopes: effectiveScopes, deleted, errors });
});

export default router;
