import assert from 'node:assert/strict';
import test from 'node:test';
import { getTeacherClassNames, rosterFieldsForStudent } from './classInfo.js';

test('teacher class scope includes subject assignments, class-teacher assignment, and allotted classes once', () => {
  const classes = getTeacherClassNames({
    allottedClasses: ['Class 6', 'Class 7'],
    assignedClassTeacherFor: 'Class 8',
    teacherProfile: {
      classAssignments: [
        { className: 'Class 6', subject: 'Mathematics' },
        { className: 'Class 9', subject: 'Science' },
        { className: ' class 7 ', subject: 'English' },
      ],
    },
  });

  assert.deepEqual(classes, ['Class 6', 'Class 7', 'Class 8', 'Class 9']);
});

test('student class details expose contact fields only when explicitly requested', () => {
  const student = {
    displayName: 'A Student',
    className: 'Class 6',
    fatherName: 'Father',
    motherName: 'Mother',
    mobile: '9000000000',
    email: 'student@example.com',
  };

  const rosterEntry = rosterFieldsForStudent(student);
  assert.equal(rosterEntry.displayName, 'A Student');
  assert.equal('fatherName' in rosterEntry, false);

  const detailedEntry = rosterFieldsForStudent(student, 0, true);
  assert.equal(detailedEntry.fatherName, 'Father');
  assert.equal(detailedEntry.motherName, 'Mother');
  assert.equal(detailedEntry.studentMobile, '9000000000');
  assert.equal(detailedEntry.email, 'student@example.com');
});
