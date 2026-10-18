const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const test = require('node:test');
const { createSessionStore } = require('./sessionStore.cjs');

test('encrypted session archive CRUD and snapshot immutability', async (t) => {
  const directory = mkdtempSync(path.join(os.tmpdir(), 'mgps-session-store-'));
  const databasePath = path.join(directory, 'sessions.sqlite');
  const keyPath = path.join(directory, 'archive-key.bin');
  const safeStorage = {
    encryptString: (value) => Buffer.from(value, 'base64'),
    decryptString: (value) => Buffer.from(value).toString('base64'),
  };
  const store = createSessionStore({ databasePath, keyPath, safeStorage });

  t.after(() => {
    store.close();
    rmSync(directory, { recursive: true, force: true });
  });

  const draft = store.createPastSession('  2024-25  ');
  assert.equal(draft.name, '2024-25');
  assert.equal(store.readCollection(draft.id, 'admin-student-management-students').length, 0);

  store.setActiveSession(draft.id);
  const students = [{ admissionNumber: 'MG-001', name: 'Sample Student' }];
  store.saveCollection(draft.id, 'admin-student-management-students', students);
  assert.deepEqual(
    store.readCollection(draft.id, 'admin-student-management-students'),
    students
  );
  assert.equal(store.read(draft.id).payload.collections['admin-student-management-students'][0].name, 'Sample Student');

  const copiedSetup = {
    'admin-class-management-classes': [
      {
        id: 'Class 6',
        name: 'Class 6',
        studentCount: 20,
        classTeacherId: 'TCH-OLD',
        classTeacherName: 'Old Teacher',
        teacher: 'Old Teacher',
      },
    ],
    'admin-class-preferences': ['Class 6'],
    'admin-subjects-global': [{ id: 'math', name: 'Mathematics' }],
    'admin-subjects-class-mapping': [{ className: 'Class 6', subjects: ['Mathematics'] }],
  };
  const copiedDraft = store.createPastSession('2025-26', copiedSetup);
  const copiedPayload = store.read(copiedDraft.id).payload.collections;
  assert.equal(copiedPayload['admin-class-management-classes'][0].name, 'Class 6');
  assert.equal(copiedPayload['admin-class-management-classes'][0].classTeacherId, undefined);
  assert.deepEqual(copiedPayload['admin-class-preferences'], ['Class 6']);
  assert.deepEqual(copiedPayload['admin-subjects-global'], copiedSetup['admin-subjects-global']);
  assert.deepEqual(copiedPayload['admin-subjects-class-mapping'], copiedSetup['admin-subjects-class-mapping']);
  assert.deepEqual(copiedPayload['admin-student-management-students'], []);
  assert.deepEqual(copiedPayload['admin-teacher-management-list'], []);

  assert.throws(
    () => store.createPastSession('Invalid setup', { 'admin-class-management-classes': [] }),
    /incomplete/
  );

  const snapshot = store.createSnapshot('2023-24 Backup', {
    tables: { students: [{ name: 'Archived Student' }] },
  }, 1);
  store.setActiveSession(snapshot.id);
  assert.throws(
    () => store.saveCollection(snapshot.id, 'admin-student-management-students', []),
    /read-only|Completed session snapshots/
  );
  assert.throws(
    () => store.save(snapshot.id, { tables: {} }),
    /cannot be edited/
  );

  const databaseBytes = readFileSync(databasePath);
  assert.equal(databaseBytes.includes(Buffer.from('Sample Student')), false);

  store.rename(draft.id, '2024-25 Revised');
  assert.equal(store.read(draft.id).archive.name, '2024-25 Revised');
  store.deleteDraft(draft.id);
  assert.throws(() => store.read(draft.id), /not found/);
});
