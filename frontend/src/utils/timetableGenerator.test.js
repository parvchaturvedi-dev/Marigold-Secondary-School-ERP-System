import test from 'node:test';
import assert from 'node:assert/strict';
import { solveWeeklyTimetable, validateWeeklyTimetable, WEEKDAYS } from './timetableGenerator.js';

const periods = [
  { id: 'p1', label: 'Period 1' },
  { id: 'p2', label: 'Period 2' },
];

test('generates a weekly timetable without simultaneous teacher or class conflicts', () => {
  const result = solveWeeklyTimetable({
    days: WEEKDAYS.slice(0, 2),
    periods,
    classes: ['Class 1', 'Class 2'],
    assignments: [
      { className: 'Class 1', subject: 'Math', teacherId: 't1', teacherName: 'Teacher One', periodsPerWeek: 2 },
      { className: 'Class 2', subject: 'Science', teacherId: 't1', teacherName: 'Teacher One', periodsPerWeek: 2 },
      { className: 'Class 2', subject: 'English', teacherId: 't2', teacherName: 'Teacher Two', periodsPerWeek: 1 },
    ],
    teacherAvailability: { t1: 4, t2: 2 },
  });

  assert.equal(result.ok, true);
  assert.equal(result.scheduled.length, 5);
  assert.deepEqual(validateWeeklyTimetable({
    days: WEEKDAYS.slice(0, 2),
    periods,
    classes: ['Class 1', 'Class 2'],
    cells: result.cells,
  }), { valid: true });
});

test('reports impossible availability rather than returning a conflicting schedule', () => {
  const result = solveWeeklyTimetable({
    days: ['Monday'],
    periods,
    classes: ['Class 1', 'Class 2'],
    assignments: [
      { className: 'Class 1', subject: 'Math', teacherId: 't1', teacherName: 'Teacher One', periodsPerWeek: 2 },
      { className: 'Class 2', subject: 'Science', teacherId: 't1', teacherName: 'Teacher One', periodsPerWeek: 1 },
    ],
    teacherAvailability: { t1: 2 },
  });
  assert.equal(result.ok, false);
  assert.match(result.reason, /available|No conflict-free timetable/);
});

test('rejects teacher availability below the assigned weekly load', () => {
  const result = solveWeeklyTimetable({
    days: ['Monday', 'Tuesday'],
    periods,
    classes: ['Class 1'],
    assignments: [
      { className: 'Class 1', subject: 'Math', teacherId: 't1', teacherName: 'Teacher One', periodsPerWeek: 3 },
    ],
    teacherAvailability: { t1: 2 },
  });
  assert.equal(result.ok, false);
});
