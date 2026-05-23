import { useMemo } from 'react';
import { useMongoState } from './mongoState';

export const MASTER_NAMESPACES = {
  classes: 'admin-class-management-classes',
  students: 'admin-student-management-students',
  teachers: 'admin-teacher-management-list',
  subjects: 'admin-subjects-global',
  classSubjects: 'admin-subjects-class-mapping',
  documents: 'admin-document-requirements',
  notices: 'admin-notices-list',
};

export const DEFAULT_CLASS_NAMES = [
  'Nursery',
  'LKG',
  'UKG',
  'Class 1',
  'Class 2',
  'Class 3',
  'Class 4',
  'Class 5',
  'Class 6',
  'Class 7',
  'Class 8',
  'Class 9',
  'Class 10',
  'Class 11',
  'Class 12',
];

const classRank = (className = '') => {
  const normalized = String(className).trim().toLowerCase();
  if (normalized === 'nursery') return -3;
  if (normalized === 'lkg') return -2;
  if (normalized === 'ukg') return -1;
  return Number(String(className).match(/\d+/)?.[0] || 999);
};

export const sortClassNames = (classNames = []) =>
  [...new Set(classNames.filter(Boolean))]
    .sort((a, b) => classRank(a) - classRank(b) || String(a).localeCompare(String(b)));

export const getClassName = (classRecord = {}) =>
  classRecord.name || classRecord.className || classRecord.class || '';

export const normalizeStudentForDirectory = (student = {}, index = 0) => {
  const raw = student.rawProfile || {};
  const admissionNumber = student.admissionNumber || student.id || raw.admissionNumber || '';
  const displayName = student.displayName || student.name || raw.studentName || `Student ${index + 1}`;
  const className = student.className || student.class || raw.targetClass || '';

  return {
    ...student,
    id: admissionNumber || student.id || `student-${index + 1}`,
    displayName,
    name: student.name || displayName,
    className,
    class: student.class || className,
    section: student.section || raw.section || '',
    rollNo: Number(student.rollNo || index + 1),
    admissionNumber,
    fatherName: student.fatherName || raw.fatherName || '',
    motherName: student.motherName || raw.motherName || '',
    guardianPhone: student.guardianPhone || student.mobile || raw.mobileNo || raw.guardianMobile || '',
    guardianEmail: student.guardianEmail || student.email || raw.email || '',
  };
};

export const normalizeSubjectName = (subject = {}) =>
  subject.name || subject.subject || subject.title || '';

export const deriveMasterData = ({
  classRecords = [],
  students = [],
  teachers = [],
  subjects = [],
  classSubjects = [],
} = {}) => {
  const normalizedStudents = (Array.isArray(students) ? students : []).map(normalizeStudentForDirectory);
  const configuredClassNames = (Array.isArray(classRecords) ? classRecords : []).map(getClassName);
  const studentClassNames = normalizedStudents.map((student) => student.className);
  const mappedClassNames = (Array.isArray(classSubjects) ? classSubjects : []).map((item) => item.className);
  const classNames = sortClassNames([...configuredClassNames, ...studentClassNames, ...mappedClassNames]);
  const classes = classNames.map((name) => {
    const source = classRecords.find((item) => getClassName(item) === name) || {};
    return {
      ...source,
      id: source.id || name,
      name,
      studentCount: normalizedStudents.filter((student) => student.className === name).length,
    };
  });

  const subjectsByClass = classNames.reduce((acc, className) => {
    const mapping = classSubjects.find((item) => item.className === className);
    const mappedSubjects = Array.isArray(mapping?.subjects) ? mapping.subjects : [];
    acc[className] = mappedSubjects.map((subjectName) => {
      const teacher = teachers.find((item) =>
        (item.classAssignments || []).some(
          (assignment) => assignment.className === className && assignment.subject === subjectName
        )
      );

      return {
        subject: subjectName,
        teacherName: teacher?.name || '',
        teacherUsername: teacher?.id || teacher?.empId || '',
      };
    });
    return acc;
  }, {});

  const globalSubjectNames = (Array.isArray(subjects) ? subjects : [])
    .map(normalizeSubjectName)
    .filter(Boolean);

  return {
    classNames,
    classes,
    students: normalizedStudents,
    teachers: Array.isArray(teachers) ? teachers : [],
    subjects: Array.isArray(subjects) ? subjects : [],
    globalSubjectNames,
    classSubjects: Array.isArray(classSubjects) ? classSubjects : [],
    subjectsByClass,
  };
};

export const useMasterData = () => {
  const [classRecords, setClassRecords, classMeta] = useMongoState(MASTER_NAMESPACES.classes, []);
  const [students, setStudents, studentMeta] = useMongoState(MASTER_NAMESPACES.students, []);
  const [teachers, setTeachers, teacherMeta] = useMongoState(MASTER_NAMESPACES.teachers, []);
  const [subjects, setSubjects, subjectMeta] = useMongoState(MASTER_NAMESPACES.subjects, []);
  const [classSubjects, setClassSubjects, classSubjectMeta] = useMongoState(
    MASTER_NAMESPACES.classSubjects,
    []
  );

  const data = useMemo(
    () => deriveMasterData({ classRecords, students, teachers, subjects, classSubjects }),
    [classRecords, students, teachers, subjects, classSubjects]
  );

  return {
    ...data,
    raw: { classRecords, students, teachers, subjects, classSubjects },
    actions: { setClassRecords, setStudents, setTeachers, setSubjects, setClassSubjects },
    isLoading:
      classMeta.isLoading ||
      studentMeta.isLoading ||
      teacherMeta.isLoading ||
      subjectMeta.isLoading ||
      classSubjectMeta.isLoading,
    errors: [classMeta.error, studentMeta.error, teacherMeta.error, subjectMeta.error, classSubjectMeta.error].filter(Boolean),
  };
};
