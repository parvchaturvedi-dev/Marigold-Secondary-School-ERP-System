import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assignClasswiseAlphabeticalRollNumbers,
  getAlphabeticalRollNumber,
} from './studentRollNumbers.js';

test('assigns sequential roll numbers alphabetically within each class', () => {
  const students = [
    { name: 'Zara', class: 'Class 1', admissionNumber: 'A3', rollNo: 9 },
    { name: 'Aarav', class: 'Class 1', admissionNumber: 'A1', rollNo: 9 },
    { name: 'Mina', class: 'Class 2', admissionNumber: 'B1', rollNo: 9 },
    { name: 'Aditi', class: 'Class 1', admissionNumber: 'A2', rollNo: 9 },
  ];

  const result = assignClasswiseAlphabeticalRollNumbers(students);

  assert.deepEqual(result.map(({ name, rollNo }) => [name, rollNo]), [
    ['Zara', 3],
    ['Aarav', 1],
    ['Mina', 1],
    ['Aditi', 2],
  ]);
  assert.deepEqual(result.map((student) => student.rawProfile.rollNo), [3, 1, 1, 2]);
  assert.deepEqual(students.map((student) => student.rollNo), [9, 9, 9, 9]);
});

test('uses admission number to break name ties and supports a single-class resequence', () => {
  const students = [
    { name: 'Same Name', class: 'Class 1', admissionNumber: 'B', rollNo: 7 },
    { name: 'Other Name', class: 'Class 1', admissionNumber: 'C', rollNo: 7 },
    { name: 'Same Name', class: 'Class 1', admissionNumber: 'A', rollNo: 7 },
    { name: 'Class Two', class: 'Class 2', admissionNumber: 'D', rollNo: 5 },
  ];

  const result = assignClasswiseAlphabeticalRollNumbers(students, 'Class 1');

  assert.deepEqual(result.map(({ admissionNumber, rollNo }) => [admissionNumber, rollNo]), [
    ['B', 3],
    ['C', 1],
    ['A', 2],
    ['D', 5],
  ]);
  assert.equal(result[3], students[3]);
});

test('keeps already-synchronized roll numbers idempotent', () => {
  const student = {
    name: 'Aarav',
    class: 'Class 1',
    rollNo: 1,
    rawProfile: { rollNo: 1, studentName: 'Aarav' },
  };

  assert.equal(assignClasswiseAlphabeticalRollNumbers([student])[0], student);
});

test('resolves a single student roll number from the complete class roster', () => {
  const roster = [
    { name: 'Zara', className: 'Class 1', admissionNumber: 'A3', rollNo: 1 },
    { name: 'Aarav', className: 'Class 1', admissionNumber: 'A1', rollNo: 2 },
  ];

  assert.equal(getAlphabeticalRollNumber(roster[0], roster), 2);
  assert.equal(getAlphabeticalRollNumber(roster[1], roster), 1);
  assert.equal(getAlphabeticalRollNumber(
    { name: 'Aditi', className: 'Class 1', admissionNumber: 'A2' },
    roster
  ), 2);
});
