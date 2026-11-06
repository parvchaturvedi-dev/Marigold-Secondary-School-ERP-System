import express from 'express';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';

const router = express.Router();

const STUDENTS_NAMESPACE = 'admin-student-management-students';
const CLASS_SUBJECTS_NAMESPACE = 'admin-subjects-class-mapping';
const TEACHERS_NAMESPACE = 'admin-teacher-management-list';
const CLASSES_NAMESPACE = 'admin-class-management-classes';

const normalizeClassName = (value) => String(value || '').trim().toLowerCase();

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

export const rosterFieldsForStudent = (student = {}, index = 0, includePersonalDetails = false) => {
  const raw = student.rawProfile || {};
  const rosterEntry = {
    rollNo: Number(student.rollNo || raw.rollNo || index + 1),
    displayName: student.displayName || student.name || raw.studentName || `Student ${index + 1}`,
    admissionNumber: student.admissionNumber || student.id || raw.admissionNumber || '',
    className: getStudentClassName(student),
    section: student.section || raw.section || '',
  };

  if (!includePersonalDetails) return rosterEntry;

  return {
    ...rosterEntry,
    fatherName: student.fatherName || raw.fatherName || '',
    motherName: student.motherName || raw.motherName || '',
    guardianName: student.guardianName || raw.guardianName || '',
    studentMobile: student.mobile || raw.mobileNo || '',
    fatherMobile: student.fatherMobile || raw.fatherMobile || '',
    motherMobile: student.motherMobile || raw.motherMobile || '',
    guardianPhone:
      student.guardianPhone ||
      raw.guardianMobile ||
      student.mobile ||
      raw.mobileNo ||
      '',
    email: student.email || raw.email || '',
    guardianEmail: student.guardianEmail || raw.guardianEmail || student.email || raw.email || '',
    address: student.address || raw.permAddress || raw.tempAddress || '',
    dob: student.dob || raw.dob || '',
    gender: student.gender || raw.gender || '',
  };
};

const byRollNo = (a, b) => Number(a.rollNo) - Number(b.rollNo);

const buildRoster = (students, className, { includePersonalDetails = false } = {}) => {
  const raw = students
    .filter(
      (student) =>
        !student.promotedOut &&
        student.status !== 'Passed Out' &&
        normalizeClassName(getStudentClassName(student)) === normalizeClassName(className)
    )
    .map((student, index) => {
      return rosterFieldsForStudent(student, index, includePersonalDetails);
    });

  return raw.sort(byRollNo);
};

const getAssignmentClassName = (assignment = {}) =>
  assignment.className || assignment.class || assignment.targetClass || '';

const getAssignmentSubject = (assignment = {}) =>
  assignment.subject || assignment.subjectName || assignment.paperSubject || '';

const getTeacherName = (teacher = {}) => teacher.name || teacher.displayName || '';

const buildSubjects = (className, classSubjects, teachers) => {
  const mapping = classSubjects.find(
    (item) => normalizeClassName(item.className) === normalizeClassName(className)
  );
  const mappedSubjects = Array.isArray(mapping?.subjects)
    ? mapping.subjects.map((subject) => (typeof subject === 'string' ? subject : subject?.name || subject?.subject || ''))
    : [];
  const assignedSubjects = teachers.flatMap((teacher) =>
    (Array.isArray(teacher.classAssignments) ? teacher.classAssignments : [])
      .filter((assignment) => normalizeClassName(getAssignmentClassName(assignment)) === normalizeClassName(className))
      .map(getAssignmentSubject)
  );
  const subjectNames = [...new Set([...mappedSubjects, ...assignedSubjects].map((name) => String(name || '').trim()).filter(Boolean))];

  return subjectNames.map((subject) => {
    const assignedTeachers = teachers
      .filter((teacher) =>
        (Array.isArray(teacher.classAssignments) ? teacher.classAssignments : []).some(
          (assignment) =>
            normalizeClassName(getAssignmentClassName(assignment)) === normalizeClassName(className) &&
            String(getAssignmentSubject(assignment)).trim().toLowerCase() === subject.toLowerCase()
        )
      )
      .map(getTeacherName)
      .filter(Boolean);

    return { subject, teacher: [...new Set(assignedTeachers)].join(', '), teachers: [...new Set(assignedTeachers)] };
  });
};

const buildClassTeacher = (className, classes, teachers) => {
  const classRecord = classes.find(
    (item) => normalizeClassName(item.name || item.className || item.class) === normalizeClassName(className)
  );
  const teacherId = classRecord?.classTeacherId || classRecord?.teacherId || '';
  const storedName = classRecord?.classTeacherName || classRecord?.teacher || '';
  const teacher = teachers.find(
    (item) =>
      (teacherId && [item.id, item.teacherId, item.empId, item.employeeId].includes(teacherId)) ||
      (item.isClassTeacher === 'Yes' &&
        normalizeClassName(item.assignedClassTeacherFor) === normalizeClassName(className))
  );
  return teacher ? getTeacherName(teacher) : storedName;
};

export const getTeacherClassNames = (auth = {}) => {
  const assignments = Array.isArray(auth.teacherProfile?.classAssignments)
    ? auth.teacherProfile.classAssignments
    : [];
  const classes = new Map();
  [
    ...(Array.isArray(auth.allottedClasses) ? auth.allottedClasses : []),
    auth.assignedClassTeacherFor,
    auth.teacherProfile?.assignedClassTeacherFor,
    ...assignments.map(getAssignmentClassName),
  ].forEach((value) => {
    const className = String(value || '').trim();
    const key = normalizeClassName(className);
    if (key && !classes.has(key)) classes.set(key, className);
  });
  return [...classes.values()];
};

const buildClassInfo = (className, students, classSubjects, teachers, classes, includePersonalDetails) => ({
  className,
  classTeacher: buildClassTeacher(className, classes, teachers),
  roster: buildRoster(students, className, { includePersonalDetails }),
  subjects: buildSubjects(className, classSubjects, teachers),
});

router.get('/', ensureMongo, async (request, response) => {
  const { role } = request.auth || {};
  const requestedClassName = String(request.query.className || '').trim();

  let classNames = [];
  let includePersonalDetails = false;

  if (role === 'student') {
    const profiles = Array.isArray(request.auth?.studentProfiles)
      ? request.auth.studentProfiles
      : [];
    const activeProfile = request.auth?.activeStudent || profiles[0] || null;
    const className = activeProfile?.className || '';

    if (!className) {
      response.json({ className: '', roster: [], subjects: [] });
      return;
    }
    classNames = [className];
  } else if (role === 'teacher') {
    const teacherClasses = getTeacherClassNames(request.auth);

    if (requestedClassName) {
      const assignedClass = teacherClasses.find(
        (className) => normalizeClassName(className) === normalizeClassName(requestedClassName)
      );
      if (!assignedClass) {
        response.status(403).json({ message: 'You are not allotted to this class.' });
        return;
      }
      classNames = [assignedClass];
    } else {
      classNames = teacherClasses;
    }
    includePersonalDetails = true;
  } else if (role === 'admin' || role === 'clerk') {
    if (!requestedClassName) {
      response.status(400).json({ message: 'className query parameter is required.' });
      return;
    }

    classNames = [requestedClassName];
    includePersonalDetails = true;
  } else {
    response.status(403).json({ message: 'You do not have permission to view class information.' });
    return;
  }

  const [students, classSubjects, teachers, classes] = await Promise.all([
    readState(STUDENTS_NAMESPACE),
    readState(CLASS_SUBJECTS_NAMESPACE),
    readState(TEACHERS_NAMESPACE),
    readState(CLASSES_NAMESPACE),
  ]);

  const classDetails = classNames.map((className) =>
    buildClassInfo(className, students, classSubjects, teachers, classes, includePersonalDetails)
  );
  if (role === 'teacher' && !requestedClassName) {
    response.json({ classes: classDetails });
    return;
  }

  response.json(classDetails[0] || { className: '', classTeacher: '', roster: [], subjects: [] });
});

export default router;
