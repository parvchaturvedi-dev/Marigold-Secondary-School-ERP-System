import { getAssignedClassNames } from './moduleStateAccess.js';

const normalizeIdentifier = (value) => String(value || '').trim().toUpperCase();
const normalizeClassName = (value) => String(value || '').trim().toLowerCase();
const normalizeSubjectName = (value) => String(value || '').trim().toLowerCase();

const getSubjectName = (row = {}) => {
  const candidates = [
    row?.subject,
    row?.subjectName,
    row?.paperSubject,
    row?.examSubject,
    row?.subjectCode,
    row?.subjectTitle,
  ];

  for (const candidate of candidates) {
    const text = String(candidate || '').trim();
    if (text) return text;
  }

  return '';
};

const getTeacherAssignmentMap = (auth = {}) => {
  const map = new Map();
  const rawAssignments = Array.isArray(auth.teacherProfile?.classAssignments)
    ? auth.teacherProfile.classAssignments
    : Array.isArray(auth.classAssignments)
      ? auth.classAssignments
      : [];

  for (const assignment of rawAssignments) {
    const className = normalizeClassName(assignment?.className || assignment?.class || '');
    const subject = normalizeSubjectName(
      assignment?.subject || assignment?.subjectName || assignment?.paperSubject || assignment?.examSubject
    );
    if (!className) continue;
    const assignedSubjects = map.get(className) || new Set();
    if (subject) assignedSubjects.add(subject);
    map.set(className, assignedSubjects);
  }

  for (const className of getAssignedClassNames(auth)) {
    if (!map.has(className)) map.set(className, new Set());
  }

  return map;
};

const canAccessTeacherRow = (row = {}, auth = {}) => {
  const className = normalizeClassName(row?.className || '');
  if (!className) return false;

  const teacherAssignments = getTeacherAssignmentMap(auth);
  if (!teacherAssignments.has(className)) return false;

  const allowedSubjects = teacherAssignments.get(className) || new Set();
  if (allowedSubjects.size === 0) return true;

  const rowSubject = normalizeSubjectName(getSubjectName(row));
  if (!rowSubject) return true;

  return allowedSubjects.has(rowSubject);
};

export const getStudentIdentifiers = (auth = {}) => {
  const profiles = [
    ...(Array.isArray(auth.studentProfiles) ? auth.studentProfiles : []),
    auth.activeStudent,
  ];
  const identifiers = new Set();

  for (const profile of profiles) {
    for (const value of [profile?.id, profile?.admissionNumber]) {
      const identifier = normalizeIdentifier(value);
      if (identifier) identifiers.add(identifier);
    }
  }

  return identifiers;
};

export const canReadBoardStudentResult = (auth = {}, admissionNumber = '') => {
  if (auth.role === 'admin' || auth.role === 'clerk') return true;
  return (
    auth.role === 'student' &&
    getStudentIdentifiers(auth).has(normalizeIdentifier(admissionNumber))
  );
};

const matchesStudent = (record, identifiers) =>
  [record?.studentId, record?.admissionNumber].some((value) => {
    const identifier = normalizeIdentifier(value);
    return identifier && identifiers.has(identifier);
  });

const filterClassRows = (rows, classes) =>
  rows.filter((row) => classes.has(normalizeClassName(row?.className)));

const filterTeacherRows = (rows, auth = {}) =>
  rows.filter((row) => canAccessTeacherRow(row, auth));

const filterStudentMarks = (marks, identifiers) =>
  marks
    .map((record) => {
      if (Array.isArray(record?.rows)) {
        const rows = record.rows.filter((row) => matchesStudent(row, identifiers));
        return rows.length ? { ...record, rows } : null;
      }

      return matchesStudent(record, identifiers) ? record : null;
    })
    .filter(Boolean);

export const filterExaminationState = (state, auth = {}) => {
  const role = auth.role;
  if (role === 'admin' || role === 'clerk') return state;

  if (role === 'teacher') {
    const classes = getAssignedClassNames(auth);
    return {
      ...state,
      papers: filterTeacherRows(state.papers, auth),
      schedules: filterTeacherRows(state.schedules, auth),
      marks: filterTeacherRows(state.marks, auth),
      deliveries: filterTeacherRows(state.deliveries, auth),
      boardClasses: state.boardClasses.filter((className) =>
        classes.has(normalizeClassName(className))
      ),
      boardResults: filterClassRows(state.boardResults, classes),
    };
  }

  const identifiers = getStudentIdentifiers(auth);
  const classes = new Set(
    [
      ...(Array.isArray(auth.studentProfiles) ? auth.studentProfiles : []),
      auth.activeStudent,
    ]
      .map((profile) => normalizeClassName(profile?.className))
      .filter(Boolean)
  );
  const boardResults = state.boardResults.filter((result) =>
    matchesStudent(result, identifiers)
  );

  return {
    ...state,
    papers: [],
    schedules: filterClassRows(state.schedules, classes),
    marks: filterStudentMarks(state.marks, identifiers),
    deliveries: [],
    boardClasses: state.boardClasses.filter((className) =>
      classes.has(normalizeClassName(className))
    ),
    boardResults,
  };
};

export class ExaminationAuthorizationError extends Error {
  constructor() {
    super('You do not have permission to change examination data outside your assigned classes.');
    this.statusCode = 403;
  }
}

const mergeAssignedRows = (currentRows, submittedRows, classes, auth = {}) => {
  const submitted = Array.isArray(submittedRows) ? submittedRows : [];
  const existingUnassignedIds = new Set(
    currentRows
      .filter((row) => !classes.has(normalizeClassName(row?.className)))
      .map((row) => row?.id)
      .filter(Boolean)
  );

  for (const row of submitted) {
    if (!classes.has(normalizeClassName(row?.className)) || !canAccessTeacherRow(row, auth)) {
      throw new ExaminationAuthorizationError();
    }
    if (existingUnassignedIds.has(row?.id)) {
      throw new ExaminationAuthorizationError();
    }
  }

  const retainedCurrentRows = currentRows.filter((row) => {
    const className = normalizeClassName(row?.className || '');
    if (!className) return false;
    if (!classes.has(className)) return true;
    return canAccessTeacherRow(row, auth);
  });

  const submittedIds = new Set(submitted.map((row) => row?.id).filter(Boolean));

  return [
    ...retainedCurrentRows.filter((row) => !submittedIds.has(row?.id)),
    ...submitted,
  ];
};

export const mergeTeacherExaminationState = (currentState, submittedState, auth = {}) => {
  const classes = getAssignedClassNames(auth);
  if (!classes.size) throw new ExaminationAuthorizationError();

  return {
    ...currentState,
    marks: mergeAssignedRows(currentState.marks, submittedState.marks, classes, auth),
    papers: mergeAssignedRows(currentState.papers, submittedState.papers, classes, auth),
    schedules: mergeAssignedRows(currentState.schedules, submittedState.schedules, classes, auth),
  };
};
