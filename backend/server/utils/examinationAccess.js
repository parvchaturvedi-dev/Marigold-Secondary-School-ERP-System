import { getAssignedClassNames } from './moduleStateAccess.js';

const normalizeIdentifier = (value) => String(value || '').trim().toUpperCase();
const normalizeClassName = (value) => String(value || '').trim().toLowerCase();

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
      papers: filterClassRows(state.papers, classes),
      schedules: filterClassRows(state.schedules, classes),
      marks: filterClassRows(state.marks, classes),
      deliveries: filterClassRows(state.deliveries, classes),
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

const mergeAssignedRows = (currentRows, submittedRows, classes) => {
  const submitted = Array.isArray(submittedRows) ? submittedRows : [];
  const existingUnassignedIds = new Set(
    currentRows
      .filter((row) => !classes.has(normalizeClassName(row?.className)))
      .map((row) => row?.id)
      .filter(Boolean)
  );

  for (const row of submitted) {
    if (!classes.has(normalizeClassName(row?.className)) || existingUnassignedIds.has(row?.id)) {
      throw new ExaminationAuthorizationError();
    }
  }

  return [
    ...currentRows.filter((row) => !classes.has(normalizeClassName(row?.className))),
    ...submitted,
  ];
};

export const mergeTeacherExaminationState = (currentState, submittedState, auth = {}) => {
  const classes = getAssignedClassNames(auth);
  if (!classes.size) throw new ExaminationAuthorizationError();

  return {
    ...currentState,
    marks: mergeAssignedRows(currentState.marks, submittedState.marks, classes),
    papers: mergeAssignedRows(currentState.papers, submittedState.papers, classes),
    schedules: mergeAssignedRows(currentState.schedules, submittedState.schedules, classes),
  };
};
