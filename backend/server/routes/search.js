import express from 'express';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';

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

const STUDENTS_NAMESPACE = 'admin-student-management-students';
const TEACHERS_NAMESPACE = 'admin-teacher-management-list';
const CLASSES_NAMESPACE = 'admin-class-management-classes';

const MAX_RESULTS = 20;
const MIN_QUERY_LENGTH = 2;

// Static catalog of sidebar page shortcuts per role. The `page` value matches the
// exact page name the web Sidebar dispatches via onPageChange(item.name).
const PAGE_CATALOG = {
  admin: [
    'Dashboard',
    'Academic Calender',
    'Application',
    'Assignment',
    'Attendance',
    'Admin Management',
    'Biometric Attendance',
    'Class Management',
    'Class Preferences',
    'Clerk Management',
    'Communication',
    'Documents Management',
    'Events',
    'Exam Creation',
    'Paper Creation',
    'Paper Analysis',
    'Paper Selected',
    'Report Card Management',
    'Marks Management',
    'Feature Page',
    'Finance',
    'Timetable',
    'Teacher Management',
    'Teacher Assignment',
    'Id Card',
    'Leave Requests',
    'Meetings',
    'Notices',
    'Profile',
    'Student Management',
    'Student Assigning',
    'Sibling Assigning',
    'Users Management',
    'Vault',
    'Subject Management',
    'Settings',
  ],
  clerk: [
    'Dashboard',
    'Academic Calender',
    'Application',
    'Assignment',
    'Attendance',
    'Biometric Attendance',
    'Class Management',
    'Class Preferences',
    'Teacher Management',
    'Teacher Assignment',
    'Student Management',
    'Student Assigning',
    'Sibling Assigning',
    'Communication',
    'Documents Management',
    'Events',
    'Exam Creation',
    'Paper Creation',
    'Paper Analysis',
    'Paper Selected',
    'Marks Management',
    'Id Card',
    'Leave Requests',
    'Meetings',
    'Timetable',
    'Notices',
    'Profile',
    'Vault',
    'Subject Management',
    'Settings',
  ],
  teacher: [
    'Dashboard',
    'Academic Calender',
    'My Class',
    'Timetable',
    'Application',
    'Assignment',
    'Attendance',
    'Communication',
    'Events',
    'Paper Analysis',
    'Marks Management',
    'Id Card',
    'Leave Requests',
    'Meetings',
    'Notices',
    'Profile',
    'Vault',
    'Settings',
  ],
  student: [
    'Dashboard',
    'Academic Calender',
    'My Class',
    'Timetable',
    'Application',
    'Assignment',
    'Attendance',
    'Communication',
    'Events',
    'Examinations',
    'Fees',
    'Id Card',
    'Leave Requests',
    'Meetings',
    'Notices',
    'Profile',
    'Vault',
    'Settings',
  ],
};

const asArray = (value) => (Array.isArray(value) ? value : []);

const toText = (value) => (value === null || value === undefined ? '' : String(value));

const normalize = (value) => toText(value).trim().toLowerCase();

const matchesAny = (needle, fields) =>
  fields.some((field) => normalize(field).includes(needle));

const readState = async (namespace) => {
  const record = await ModuleState.findOne({ namespace });
  return asArray(record?.value);
};

const buildStudentResult = (student) => ({
  type: 'student',
  label: student.name || student.displayName || student.admissionNumber || 'Student',
  sublabel: [student.className, student.section && `Sec ${student.section}`, student.admissionNumber]
    .filter(Boolean)
    .join(' | '),
  page: 'Student Management',
  meta: {
    id: student.id || student.admissionNumber || '',
    admissionNumber: student.admissionNumber || '',
    className: student.className || student.class || '',
    section: student.section || '',
    fatherName: student.fatherName || '',
  },
});

const buildTeacherResult = (teacher) => ({
  type: 'teacher',
  label: teacher.name || teacher.displayName || teacher.id || 'Teacher',
  sublabel: [teacher.id, teacher.email].filter(Boolean).join(' | '),
  page: 'Teacher Management',
  meta: {
    id: teacher.id || '',
    email: teacher.email || '',
  },
});

const buildClassResult = (classRecord) => ({
  type: 'class',
  label: classRecord.name || classRecord.className || classRecord.id || 'Class',
  sublabel: 'Class',
  page: 'Class Management',
  meta: {
    id: classRecord.id || classRecord.name || '',
    name: classRecord.name || classRecord.className || '',
  },
});

const buildPageResults = (role, needle) =>
  asArray(PAGE_CATALOG[role])
    .filter((name) => normalize(name).includes(needle))
    .map((name) => ({
      type: 'page',
      label: name,
      sublabel: 'Page',
      page: name,
      meta: { role },
    }));

const classKeysFor = (student) => [
  student.className,
  student.class,
  student.targetClass,
  student.rawProfile?.targetClass,
];

const studentMatchesClasses = (student, allottedClasses) => {
  const allowed = allottedClasses.map(normalize).filter(Boolean);
  if (!allowed.length) return false;
  return classKeysFor(student).some((key) => key && allowed.includes(normalize(key)));
};

router.get('/', ensureMongo, async (request, response) => {
  const query = toText(request.query.q);
  const needle = query.trim().toLowerCase();

  if (needle.length < MIN_QUERY_LENGTH) {
    response.json({ results: [] });
    return;
  }

  const auth = request.auth || {};
  const role = auth.role;
  const results = [];

  if (role === 'admin' || role === 'clerk') {
    const [students, teachers, classes] = await Promise.all([
      readState(STUDENTS_NAMESPACE),
      readState(TEACHERS_NAMESPACE),
      readState(CLASSES_NAMESPACE),
    ]);

    for (const student of students) {
      if (
        matchesAny(needle, [
          student.name,
          student.displayName,
          student.admissionNumber,
          student.className,
          student.class,
          student.fatherName,
        ])
      ) {
        results.push(buildStudentResult(student));
      }
    }

    for (const teacher of teachers) {
      if (matchesAny(needle, [teacher.name, teacher.displayName, teacher.id, teacher.email])) {
        results.push(buildTeacherResult(teacher));
      }
    }

    for (const classRecord of classes) {
      if (matchesAny(needle, [classRecord.name, classRecord.className])) {
        results.push(buildClassResult(classRecord));
      }
    }
  } else if (role === 'teacher') {
    const allottedClasses = asArray(auth.allottedClasses);
    const [students, classes] = await Promise.all([
      readState(STUDENTS_NAMESPACE),
      readState(CLASSES_NAMESPACE),
    ]);

    for (const student of students) {
      if (!studentMatchesClasses(student, allottedClasses)) continue;
      if (
        matchesAny(needle, [
          student.name,
          student.displayName,
          student.admissionNumber,
          student.className,
          student.class,
          student.fatherName,
        ])
      ) {
        results.push(buildStudentResult(student));
      }
    }

    const allowedClassKeys = allottedClasses.map(normalize).filter(Boolean);
    for (const classRecord of classes) {
      const classKey = normalize(classRecord.name || classRecord.className);
      if (!classKey || !allowedClassKeys.includes(classKey)) continue;
      if (matchesAny(needle, [classRecord.name, classRecord.className])) {
        results.push(buildClassResult(classRecord));
      }
    }
  } else if (role === 'student') {
    for (const student of asArray(auth.studentProfiles)) {
      if (
        matchesAny(needle, [
          student.displayName,
          student.name,
          student.admissionNumber,
          student.className,
          student.fatherName,
        ])
      ) {
        results.push({
          type: 'student',
          label: student.displayName || student.name || student.admissionNumber || 'Student',
          sublabel: [student.className, student.section && `Sec ${student.section}`]
            .filter(Boolean)
            .join(' | '),
          page: 'Profile',
          meta: {
            id: student.id || '',
            admissionNumber: student.admissionNumber || '',
            className: student.className || '',
            section: student.section || '',
          },
        });
      }
    }
  }

  results.push(...buildPageResults(role, needle));

  response.json({ results: results.slice(0, MAX_RESULTS) });
});

export default router;
