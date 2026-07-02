import express from 'express';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';

const router = express.Router();

const STUDENTS_NAMESPACE = 'admin-student-management-students';
const CLASS_SUBJECTS_NAMESPACE = 'admin-subjects-class-mapping';
const TEACHERS_NAMESPACE = 'admin-teacher-management-list';

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

const readState = async (namespace) => {
  const record = await ModuleState.findOne({ namespace });
  const value = record?.value;
  return Array.isArray(value) ? value : [];
};

const getStudentClassName = (student = {}) => {
  const raw = student.rawProfile || {};
  return student.className || student.class || raw.targetClass || '';
};

const rosterFieldsForStudent = (student = {}, index = 0) => {
  const raw = student.rawProfile || {};
  return {
    rollNo: Number(student.rollNo || raw.rollNo || index + 1),
    displayName: student.displayName || student.name || raw.studentName || `Student ${index + 1}`,
    admissionNumber: student.admissionNumber || student.id || raw.admissionNumber || '',
    className: getStudentClassName(student),
    section: student.section || raw.section || '',
  };
};

const byRollNo = (a, b) => Number(a.rollNo) - Number(b.rollNo);

const buildRoster = (students, className, { includeGuardianPhone = false } = {}) => {
  const raw = students
    .filter((student) => getStudentClassName(student) === className)
    .map((student, index) => {
      const base = rosterFieldsForStudent(student, index);
      if (!includeGuardianPhone) return base;
      const rawProfile = student.rawProfile || {};
      return {
        ...base,
        guardianPhone:
          student.guardianPhone ||
          student.mobile ||
          rawProfile.guardianMobile ||
          rawProfile.mobileNo ||
          '',
      };
    });

  return raw.sort(byRollNo);
};

const buildSubjects = (className, classSubjects, teachers) => {
  const mapping = classSubjects.find((item) => item.className === className);
  const subjectNames = Array.isArray(mapping?.subjects) ? mapping.subjects : [];

  return subjectNames.map((subjectName) => {
    const teacher = teachers.find((item) =>
      (item.classAssignments || []).some(
        (assignment) => assignment.className === className && assignment.subject === subjectName
      )
    );

    return {
      subject: subjectName,
      teacher: teacher?.name || '',
    };
  });
};

router.get('/', ensureMongo, async (request, response) => {
  const { role } = request.auth || {};
  const requestedClassName = String(request.query.className || '').trim();

  let className = '';
  let includeGuardianPhone = false;

  if (role === 'student') {
    const profiles = Array.isArray(request.auth?.studentProfiles)
      ? request.auth.studentProfiles
      : [];
    const activeProfile = request.auth?.activeStudent || profiles[0] || null;
    className = activeProfile?.className || '';

    if (!className) {
      response.json({ className: '', roster: [], subjects: [] });
      return;
    }
  } else if (role === 'teacher') {
    const allottedClasses = Array.isArray(request.auth?.allottedClasses)
      ? request.auth.allottedClasses
      : [];

    if (!requestedClassName) {
      response.status(403).json({ message: 'A class must be specified to view class information.' });
      return;
    }

    if (!allottedClasses.includes(requestedClassName)) {
      response.status(403).json({ message: 'You are not allotted to this class.' });
      return;
    }

    className = requestedClassName;
    includeGuardianPhone = true;
  } else if (role === 'admin' || role === 'clerk') {
    if (!requestedClassName) {
      response.status(400).json({ message: 'className query parameter is required.' });
      return;
    }

    className = requestedClassName;
    includeGuardianPhone = true;
  } else {
    response.status(403).json({ message: 'You do not have permission to view class information.' });
    return;
  }

  const [students, classSubjects, teachers] = await Promise.all([
    readState(STUDENTS_NAMESPACE),
    readState(CLASS_SUBJECTS_NAMESPACE),
    readState(TEACHERS_NAMESPACE),
  ]);

  const roster = buildRoster(students, className, { includeGuardianPhone });
  const subjects = buildSubjects(className, classSubjects, teachers);

  response.json({ className, roster, subjects });
});

export default router;
