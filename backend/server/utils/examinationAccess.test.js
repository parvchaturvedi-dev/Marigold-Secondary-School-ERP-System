import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canReadBoardStudentResult,
  filterExaminationState,
  getStudentIdentifiers,
  mergeTeacherExaminationState,
} from './examinationAccess.js';

const state = {
  exams: [{ id: 'EXAM-1' }],
  papers: [{ id: 'PAPER-1', className: 'Class 6' }, { id: 'PAPER-2', className: 'Class 7' }],
  schedules: [{ id: 'S-1', className: 'Class 6' }, { id: 'S-2', className: 'Class 7' }],
  marks: [
    {
      id: 'MARK-1',
      className: 'Class 6',
      rows: [
        { studentId: 'A-1', admissionNumber: 'A-1', marks: 90 },
        { studentId: 'A-2', admissionNumber: 'A-2', marks: 80 },
      ],
    },
    {
      id: 'MARK-2',
      className: 'Class 7',
      rows: [{ studentId: 'B-1', admissionNumber: 'B-1', marks: 70 }],
    },
  ],
  deliveries: [{ id: 'D-1', className: 'Class 6' }, { id: 'D-2', className: 'Class 7' }],
  boardClasses: ['Class 6', 'Class 7'],
  boardResults: [
    { admissionNumber: 'A-1', className: 'Class 6' },
    { admissionNumber: 'A-2', className: 'Class 6' },
    { admissionNumber: 'B-1', className: 'Class 7' },
  ],
  gradeScale: [{ grade: 'A' }],
  principalSignature: 'signature',
};

test('student examination response includes only linked students marks and results', () => {
  const result = filterExaminationState(state, {
    role: 'student',
    studentProfiles: [
      { id: 'A-1', admissionNumber: 'A-1', className: 'Class 6' },
      { id: 'A-2', admissionNumber: 'A-2', className: 'Class 6' },
    ],
  });

  assert.deepEqual(result.marks, [
    {
      id: 'MARK-1',
      className: 'Class 6',
      rows: [
        { studentId: 'A-1', admissionNumber: 'A-1', marks: 90 },
        { studentId: 'A-2', admissionNumber: 'A-2', marks: 80 },
      ],
    },
  ]);
  assert.deepEqual(result.boardResults, state.boardResults.slice(0, 2));
  assert.deepEqual(result.papers, []);
  assert.deepEqual(result.deliveries, []);
});

test('student examination response filters nested marks rows by stable identity', () => {
  const result = filterExaminationState(state, {
    role: 'student',
    studentProfiles: [{ id: 'A-2', admissionNumber: 'A-2', className: 'Class 6' }],
  });

  assert.deepEqual(result.marks[0].rows, [
    { studentId: 'A-2', admissionNumber: 'A-2', marks: 80 },
  ]);
  assert.deepEqual(getStudentIdentifiers({ studentProfiles: [{ id: 'A-2' }] }), new Set(['A-2']));
});

test('teachers receive examination rows only for assigned classes', () => {
  const result = filterExaminationState(state, {
    role: 'teacher',
    allottedClasses: ['Class 6'],
  });

  assert.deepEqual(result.papers, state.papers.slice(0, 1));
  assert.deepEqual(result.schedules, state.schedules.slice(0, 1));
  assert.deepEqual(result.marks, state.marks.slice(0, 1));
  assert.deepEqual(result.boardResults, state.boardResults.slice(0, 2));
});

test('admin and clerk retain complete examination state', () => {
  assert.equal(filterExaminationState(state, { role: 'admin' }), state);
  assert.equal(filterExaminationState(state, { role: 'clerk' }), state);
});

test('board result lookup is limited to a student account linked to the requested child', () => {
  const siblingAccount = {
    role: 'student',
    studentProfiles: [
      { id: 'A-1', admissionNumber: 'A-1' },
      { id: 'A-2', admissionNumber: 'A-2' },
    ],
  };

  assert.equal(canReadBoardStudentResult(siblingAccount, 'a-2'), true);
  assert.equal(canReadBoardStudentResult(siblingAccount, 'B-1'), false);
  assert.equal(canReadBoardStudentResult({ role: 'teacher' }, 'A-1'), false);
  assert.equal(canReadBoardStudentResult({ role: 'admin' }, 'B-1'), true);
  assert.equal(canReadBoardStudentResult({ role: 'clerk' }, 'B-1'), true);
});

test('teacher state writes preserve other classes and reject unauthorized classes', () => {
  const previous = {
    ...state,
    marks: state.marks,
    papers: state.papers,
    schedules: state.schedules,
    boardResults: state.boardResults,
  };
  const submitted = filterExaminationState(state, {
    role: 'teacher',
    allottedClasses: ['Class 6'],
  });
  submitted.marks = [{ ...submitted.marks[0], updatedAt: 'new' }];

  const merged = mergeTeacherExaminationState(previous, submitted, {
    role: 'teacher',
    allottedClasses: ['Class 6'],
  });
  assert.equal(merged.marks.find((record) => record.id === 'MARK-1').updatedAt, 'new');
  assert.deepEqual(merged.marks.find((record) => record.id === 'MARK-2'), state.marks[1]);
  assert.deepEqual(merged.papers.find((record) => record.id === 'PAPER-2'), state.papers[1]);
  assert.deepEqual(merged.boardResults, state.boardResults);

  assert.throws(
    () =>
      mergeTeacherExaminationState(previous, {
        ...submitted,
        marks: [{ id: 'MARK-2', className: 'Class 7' }],
      }, {
        role: 'teacher',
        allottedClasses: ['Class 6'],
      }),
    { statusCode: 403 }
  );
});
