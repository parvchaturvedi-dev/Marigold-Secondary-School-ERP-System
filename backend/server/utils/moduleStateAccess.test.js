import assert from 'node:assert/strict';
import test from 'node:test';
import {
  canReadModuleState,
  filterModuleStateValue,
  getModuleStateReadableRoles,
} from './moduleStateAccess.js';

test('module-state realtime recipients match sensitive read restrictions', () => {
  assert.deepEqual(getModuleStateReadableRoles('admin-employee-management-list'), ['admin', 'clerk']);
  assert.equal(canReadModuleState('student', 'admin-student-management-students'), false);
  assert.equal(canReadModuleState('employee', 'admin-student-management-students'), false);
  assert.deepEqual(getModuleStateReadableRoles('admin-notices-list'), [
    'admin',
    'clerk',
    'student',
    'teacher',
    'employee',
  ]);
  assert.equal(canReadModuleState('employee', 'admin-class-preferences'), false);
});

test('finance and staff namespaces are restricted to back-office roles', () => {
  for (const namespace of [
    'admin-finance-class-ledgers',
    'admin-finance-alumni-pending',
    'admin-finance-new-sensitive-report',
    'admin-employee-management-list',
    'admin-employee-designations',
    'admin-teacher-management-list',
    'admin-clerk-management-list',
  ]) {
    assert.deepEqual(getModuleStateReadableRoles(namespace), ['admin', 'clerk']);
  }
});

test('teachers receive only student records from their assigned classes', () => {
  const records = [
    { admissionNumber: 'A-1', class: 'Class 6' },
    { admissionNumber: 'A-2', className: 'Class 7' },
    { admissionNumber: 'A-3', rawProfile: { targetClass: 'Class 6' } },
  ];

  assert.deepEqual(
    filterModuleStateValue('teacher', 'admin-student-management-students', records, {
      allottedClasses: ['Class 6'],
      assignedClassTeacherFor: 'Class 8',
    }),
    [records[0], records[2]]
  );
  assert.deepEqual(
    filterModuleStateValue('teacher', 'admin-student-management-students', records, {}),
    []
  );
  assert.deepEqual(
    filterModuleStateValue('admin', 'admin-student-management-students', records, {}),
    records
  );
});
