import test from 'node:test';
import assert from 'node:assert/strict';
import { buildTeacherImportRecord } from './teacherBulkImport.js';

const validRow = {
  teacherId: 'tch-001',
  name: 'Demo Teacher',
  email: 'teacher@example.com',
  mobile: '9000000001',
  gender: 'Female',
  dob: '1990-05-12',
  maritalStatus: 'Married',
  category: 'General',
  husbandName: 'Demo Spouse',
  address: 'Demo Address',
  isClassTeacher: 'Yes',
  assignedClassTeacherFor: 'Class 6',
  classAssignments: 'Class 6:Mathematics;Class 7:Science',
  experience: 'Demo School|Teacher|3',
};

test('builds a teacher record using the ERP profile structure', () => {
  const result = buildTeacherImportRecord(validRow);
  assert.equal(result.error, undefined);
  assert.equal(result.record.id, 'TCH-001');
  assert.equal(result.record.husbandName, 'Demo Spouse');
  assert.equal(result.record.fatherName, '');
  assert.deepEqual(result.record.classAssignments, [
    { className: 'Class 6', subject: 'Mathematics' },
    { className: 'Class 7', subject: 'Science' },
  ]);
  assert.deepEqual(result.record.experience, [
    { organization: 'Demo School', position: 'Teacher', years: '3' },
  ]);
});

test('rejects missing required details, malformed assignments, and invalid Aadhaar', () => {
  assert.match(buildTeacherImportRecord({ teacherId: 'TCH-1' }).error, /ID and name/);
  assert.match(buildTeacherImportRecord({ ...validRow, classAssignments: 'Class 6' }).error, /Class assignments/);
  assert.match(buildTeacherImportRecord({ ...validRow, aadharNumber: '1234' }).error, /Aadhaar/);
});

test('accepts unmarried teacher without husband name and optional Aadhaar', () => {
  const result = buildTeacherImportRecord({
    ...validRow,
    gender: 'Male',
    maritalStatus: 'Single',
    fatherName: 'Demo Parent',
    husbandName: '',
    aadharNumber: '',
  });
  assert.equal(result.error, undefined);
  assert.equal(result.record.aadharNumber, '');
  assert.equal(result.record.fatherName, 'Demo Parent');
});

test('normalizes Excel serial dates for date-of-birth and joining-date cells', () => {
  const excelSerial = (date) =>
    (Date.parse(`${date}T00:00:00Z`) - Date.UTC(1899, 11, 30)) / 86400000;
  const result = buildTeacherImportRecord({
    ...validRow,
    dob: excelSerial('1990-05-12'),
    dateOfJoining: excelSerial('2024-04-01'),
  });
  assert.equal(result.record.dob, '1990-05-12');
  assert.equal(result.record.dateOfJoining, '2024-04-01');
});
