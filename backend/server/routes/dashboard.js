import express from 'express';
import Assignment from '../models/Assignment.js';
import AttendanceLog from '../models/AttendanceLog.js';
import ModuleState from '../models/ModuleState.js';
import Notification from '../models/Notification.js';
import User from '../models/User.js';
import VaultItem from '../models/VaultItem.js';
import { isMongoConnected } from '../db.js';

const router = express.Router();

const STUDENTS_NAMESPACE = 'admin-student-management-students';
const TEACHERS_NAMESPACE = 'admin-teacher-management-list';
const CLERKS_NAMESPACE = 'admin-clerk-management-list';

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
const countArrayState = async (namespace) => {
  const record = await ModuleState.findOne({ namespace }).lean();
  return Array.isArray(record?.value) ? record.value.length : 0;
};

const activeStudentFromAuth = (auth = {}) => {
  const profiles = Array.isArray(auth.studentProfiles) ? auth.studentProfiles : [];
  const selected =
    profiles.find((student) => student.id === auth.selectedStudentId) ||
    auth.activeStudent ||
    profiles[0] ||
    null;

  return selected
    ? {
        id: selected.id || selected.admissionNumber || '',
        admissionNumber: upper(selected.admissionNumber || selected.id),
        displayName: selected.displayName || selected.name || auth.displayName || auth.username,
        className: clean(selected.className),
        section: clean(selected.section),
        rollNo: selected.rollNo || '',
      }
    : null;
};

const getNotificationCount = ({ role, username, student }) => {
  const filters = [{ recipientRole: role, recipientUsername: username }];

  if (role === 'student') {
    filters.push({ recipientRole: 'student', recipientUsername: '' });
    if (student?.id) filters.push({ recipientRole: 'student', recipientStudentId: student.id });
    if (student?.admissionNumber) filters.push({ recipientRole: 'student', recipientStudentId: student.admissionNumber });
    if (student?.className) filters.push({ recipientRole: 'student', recipientClassName: student.className });
  } else {
    filters.push({ recipientRole: role, recipientUsername: '' });
  }

  return Notification.countDocuments({
    $or: filters,
    readBy: { $ne: username },
  });
};

const buildStudentSummary = async (auth) => {
  const student = activeStudentFromAuth(auth);
  const className = student?.className || '';
  const studentId = student?.admissionNumber || upper(auth.username.replace(/^STD-/, ''));
  const assignmentQuery = className ? { targetClasses: className } : { _id: null };

  const [assignmentCount, unreadNotices, attendanceLogs, latestLog] = await Promise.all([
    Assignment.countDocuments(assignmentQuery),
    getNotificationCount({ role: 'student', username: auth.username, student }),
    AttendanceLog.find({ entityType: 'student', entityId: studentId }).sort({ attendanceDate: -1 }).limit(90).lean(),
    AttendanceLog.findOne({ entityType: 'student', entityId: studentId, attendanceDate: todayKey() }).lean(),
  ]);

  const countedLogs = attendanceLogs.filter((log) => ['present', 'manual', 'half-day', 'absent'].includes(log.status));
  const presentLogs = countedLogs.filter((log) => ['present', 'manual', 'half-day'].includes(log.status));
  const attendancePercent = countedLogs.length
    ? Math.round((presentLogs.length / countedLogs.length) * 100)
    : 0;

  return {
    role: 'student',
    profile: {
      displayName: student?.displayName || auth.displayName || auth.username,
      classLabel: [student?.className, student?.section].filter(Boolean).join(' - '),
      rollNo: student?.rollNo || '',
      admissionNumber: student?.admissionNumber || '',
    },
    action: {
      label: 'Today Attendance',
      title: latestLog?.status ? latestLog.status.replace('-', ' ').toUpperCase() : 'Not marked',
      subtitle: latestLog?.scannedAt ? new Date(latestLog.scannedAt).toLocaleTimeString('en-IN') : 'No attendance scan yet today',
    },
    stats: [
      { title: 'Attendance', value: `${attendancePercent}%`, subtitle: `${presentLogs.length}/${countedLogs.length || 0}`, color: '#22C55E' },
      { title: 'Assignments', value: String(assignmentCount), subtitle: 'Active', color: '#F97316' },
      { title: 'Notices', value: String(unreadNotices), subtitle: 'Unread', color: '#2563EB' },
    ],
  };
};

const buildTeacherSummary = async (auth) => {
  const allottedClasses = Array.isArray(auth.allottedClasses) ? auth.allottedClasses : [];
  const assignedClass = clean(auth.assignedClassTeacherFor || auth.teacherProfile?.assignedClassTeacherFor);
  const classes = [...new Set([assignedClass, ...allottedClasses].filter(Boolean))];

  const [assignmentCount, unreadNotices, todayStaffLog] = await Promise.all([
    Assignment.countDocuments({
      $or: [{ createdByUsername: auth.username }, { targetClasses: { $in: classes } }],
    }),
    getNotificationCount({ role: 'teacher', username: auth.username }),
    AttendanceLog.findOne({ entityType: 'teacher', entityId: auth.username, attendanceDate: todayKey() }).lean(),
  ]);

  return {
    role: 'teacher',
    profile: {
      displayName: auth.displayName || auth.username,
      classLabel: assignedClass || classes.join(', '),
      designation: auth.teacherProfile?.designation || 'Faculty',
    },
    action: {
      label: 'Attendance Status',
      title: todayStaffLog?.status ? todayStaffLog.status.replace('-', ' ').toUpperCase() : 'Not marked',
      subtitle: assignedClass ? `Class teacher: ${assignedClass}` : `${classes.length} allotted classes`,
    },
    stats: [
      { title: 'Classes', value: String(classes.length), subtitle: 'Allotted', color: '#22C55E' },
      { title: 'Assignments', value: String(assignmentCount), subtitle: 'Visible', color: '#F97316' },
      { title: 'Notices', value: String(unreadNotices), subtitle: 'Unread', color: '#2563EB' },
    ],
  };
};

const buildStaffSummary = async (auth) => {
  const [students, teachers, clerks, admins, unreadNotices, vaultItems, todayStaffLog] = await Promise.all([
    countArrayState(STUDENTS_NAMESPACE),
    countArrayState(TEACHERS_NAMESPACE),
    countArrayState(CLERKS_NAMESPACE),
    User.countDocuments({ role: 'admin' }),
    getNotificationCount({ role: auth.role, username: auth.username }),
    VaultItem.countDocuments({ ownerUsername: auth.username }),
    AttendanceLog.findOne({ entityType: auth.role, entityId: auth.username, attendanceDate: todayKey() }).lean(),
  ]);

  const isAdmin = auth.role === 'admin';
  return {
    role: auth.role,
    profile: {
      displayName: auth.displayName || auth.username,
      designation: isAdmin ? auth.adminProfile?.designation || 'Administrator' : auth.clerkProfile?.designation || 'Office Administration',
      classLabel: isAdmin ? 'System administration' : 'Office desk',
    },
    action: {
      label: isAdmin ? 'System Directory' : 'Office Records',
      title: isAdmin ? `${students + teachers + clerks + admins} active profiles` : `${vaultItems} vault records`,
      subtitle: todayStaffLog?.status ? `Attendance: ${todayStaffLog.status}` : 'Attendance not marked today',
    },
    stats: isAdmin
      ? [
          { title: 'Students', value: String(students), subtitle: 'Enrolled', color: '#22C55E' },
          { title: 'Teachers', value: String(teachers), subtitle: 'Active', color: '#F97316' },
          { title: 'Notices', value: String(unreadNotices), subtitle: 'Unread', color: '#2563EB' },
        ]
      : [
          { title: 'Documents', value: String(vaultItems), subtitle: 'Vault', color: '#22C55E' },
          { title: 'Students', value: String(students), subtitle: 'Enrolled', color: '#F97316' },
          { title: 'Notices', value: String(unreadNotices), subtitle: 'Unread', color: '#2563EB' },
        ],
  };
};

router.get('/summary', ensureMongo, async (request, response) => {
  const auth = request.auth || {};

  if (auth.role === 'student') {
    response.json(await buildStudentSummary(auth));
    return;
  }

  if (auth.role === 'teacher') {
    response.json(await buildTeacherSummary(auth));
    return;
  }

  if (auth.role === 'admin' || auth.role === 'clerk') {
    response.json(await buildStaffSummary(auth));
    return;
  }

  response.status(403).json({ message: 'Dashboard summary is not available for this role.' });
});

export default router;
