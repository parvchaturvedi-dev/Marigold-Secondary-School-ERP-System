import assert from 'node:assert/strict';
import test from 'node:test';
import { canTeacherPublishAssignment } from './assignmentAccess.js';

const teacherAuth = {
  role: 'teacher',
  teacherProfile: {
    classAssignments: [
      { className: 'Class 6', subject: 'Mathematics' },
      { className: 'Class 7', subject: 'Science' },
      { className: 'Class 7', subject: 'Mathematics' },
    ],
  },
};

test('teacher can publish only assigned subjects within assigned classes', () => {
  assert.equal(canTeacherPublishAssignment(teacherAuth, 'Mathematics', ['Class 6']), true);
  assert.equal(canTeacherPublishAssignment(teacherAuth, 'Science', ['Class 7']), true);
  assert.equal(canTeacherPublishAssignment(teacherAuth, 'science', [' class 7 ']), true);
});

test('teacher cannot publish an unassigned subject or target class', () => {
  assert.equal(canTeacherPublishAssignment(teacherAuth, 'Science', ['Class 6']), false);
  assert.equal(canTeacherPublishAssignment(teacherAuth, 'Mathematics', ['Class 8']), false);
  assert.equal(canTeacherPublishAssignment(teacherAuth, 'Mathematics', ['Class 6', 'Class 8']), false);
});

test('teacher cannot publish without an explicit class-subject assignment', () => {
  assert.equal(canTeacherPublishAssignment({ role: 'teacher', allottedClasses: ['Class 6'] }, 'General', ['Class 6']), false);
  assert.equal(canTeacherPublishAssignment(teacherAuth, '', ['Class 6']), false);
  assert.equal(canTeacherPublishAssignment(teacherAuth, 'Mathematics', []), false);
});

test('admin and clerk assignment publishing remains unrestricted by teacher mappings', () => {
  assert.equal(canTeacherPublishAssignment({ role: 'admin' }, 'General', ['Class 99']), true);
  assert.equal(canTeacherPublishAssignment({ role: 'clerk' }, 'General', ['Class 99']), true);
});
