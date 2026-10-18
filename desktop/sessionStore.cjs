const { createHash, randomBytes, createCipheriv, createDecipheriv, randomUUID } = require('node:crypto');
const { DatabaseSync } = require('node:sqlite');
const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { deflateRawSync, inflateRawSync } = require('node:zlib');

const normalizeName = (value) => String(value || '').trim().replace(/\s+/g, ' ');
const CLASS_SETUP_NAMESPACES = [
  'admin-class-management-classes',
  'admin-class-preferences',
  'admin-subjects-global',
  'admin-subjects-class-mapping',
];
const countRecords = (value) =>
  Object.values(value?.collections || {}).reduce(
    (total, rows) => total + (Array.isArray(rows) ? rows.length : 0),
    0
  );

const createSessionStore = ({ databasePath, keyPath, safeStorage }) => {
  let key;
  if (existsSync(keyPath)) {
    key = safeStorage.decryptString(readFileSync(keyPath));
  } else {
    key = randomBytes(32).toString('base64');
    writeFileSync(keyPath, safeStorage.encryptString(key), { mode: 0o600, flag: 'wx' });
  }
  const encryptionKey = Buffer.from(key, 'base64');
  if (encryptionKey.length !== 32) throw new Error('Local archive encryption key is invalid.');

  const db = new DatabaseSync(databasePath);
  let activeSessionId = '';
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    CREATE TABLE IF NOT EXISTS session_archives (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL COLLATE NOCASE UNIQUE,
      kind TEXT NOT NULL CHECK (kind IN ('past', 'snapshot')),
      status TEXT NOT NULL CHECK (status IN ('draft', 'complete')),
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      record_count INTEGER NOT NULL DEFAULT 0,
      sha256 TEXT NOT NULL,
      nonce BLOB NOT NULL,
      auth_tag BLOB NOT NULL,
      payload BLOB NOT NULL
    );
  `);

  const encrypt = (value) => {
    const plaintext = Buffer.from(JSON.stringify(value), 'utf8');
    const compressed = deflateRawSync(plaintext, { level: 9 });
    const nonce = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', encryptionKey, nonce);
    const payload = Buffer.concat([cipher.update(compressed), cipher.final()]);
    return {
      payload,
      nonce,
      authTag: cipher.getAuthTag(),
      sha256: createHash('sha256').update(plaintext).digest('hex'),
    };
  };

  const insertArchive = ({ name, kind, status, payload, recordCount = 0 }) => {
    const id = randomUUID();
    const now = new Date().toISOString();
    const encrypted = encrypt(payload);
    db.prepare(`
      INSERT INTO session_archives
        (id, name, kind, status, created_at, updated_at, record_count, sha256, nonce, auth_tag, payload)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      name,
      kind,
      status,
      now,
      now,
      Math.max(0, Math.trunc(Number(recordCount) || 0)),
      encrypted.sha256,
      encrypted.nonce,
      encrypted.authTag,
      encrypted.payload
    );
    return { id, name, kind, status, createdAt: now, updatedAt: now, recordCount };
  };

  const decrypt = (row) => {
    const decipher = createDecipheriv('aes-256-gcm', encryptionKey, row.nonce);
    decipher.setAuthTag(row.auth_tag);
    const compressed = Buffer.concat([decipher.update(row.payload), decipher.final()]);
    const plaintext = inflateRawSync(compressed);
    const digest = createHash('sha256').update(plaintext).digest('hex');
    if (digest !== row.sha256) throw new Error('Local archive integrity check failed.');
    return JSON.parse(plaintext.toString('utf8'));
  };

  return {
    list() {
      return db.prepare(`
        SELECT id, name, kind, status, created_at AS createdAt,
          updated_at AS updatedAt, record_count AS recordCount,
          length(payload) AS storageBytes
        FROM session_archives
        ORDER BY CASE kind WHEN 'snapshot' THEN 0 ELSE 1 END, created_at DESC
      `).all();
    },
    createPastSession(rawName, classSetup = null) {
      const name = normalizeName(rawName);
      if (!name || name.length > 32) throw new Error('Enter a session name (maximum 32 characters).');
      if (classSetup !== null && (!classSetup || typeof classSetup !== 'object' || Array.isArray(classSetup))) {
        throw new Error('Class setup must be an object containing class and subject data.');
      }
      if (
        classSetup &&
        CLASS_SETUP_NAMESPACES.some((namespace) => !Array.isArray(classSetup[namespace]))
      ) {
        throw new Error('Class setup is incomplete. Reload the current session and try again.');
      }
      const copiedClassSetup = classSetup
        ? {
            ...classSetup,
            'admin-class-management-classes': classSetup['admin-class-management-classes'].map(
              (classRecord) => {
                if (!classRecord || typeof classRecord !== 'object' || Array.isArray(classRecord)) {
                  throw new Error('Class setup contains an invalid class record.');
                }
                const classDetails = { ...classRecord };
                delete classDetails.classTeacherId;
                delete classDetails.classTeacherName;
                delete classDetails.teacherId;
                delete classDetails.teacher;
                return classDetails;
              }
            ),
          }
        : null;
      return insertArchive({
        name,
        kind: 'past',
        status: 'draft',
        payload: {
          collections: {
            'admin-student-management-students': [],
            'admin-teacher-management-list': [],
            'admin-class-management-classes': copiedClassSetup?.['admin-class-management-classes'] || [],
            'admin-class-preferences': copiedClassSetup?.['admin-class-preferences'] || [],
            'admin-subjects-global': copiedClassSetup?.['admin-subjects-global'] || [],
            'admin-subjects-class-mapping': copiedClassSetup?.['admin-subjects-class-mapping'] || [],
            'admin-finance-alumni-pending': [],
            'admin-document-requirements': [],
            'admin-notices-list': [],
            'desktop-examination-state': {
              exams: [],
              papers: [],
              schedules: [],
              marks: [],
              deliveries: [],
              boardClasses: [],
              boardResults: [],
            },
          },
          createdFrom: copiedClassSetup ? 'past-session-with-copied-class-setup' : 'blank-past-session',
        },
      });
    },
    createSnapshot(rawName, payload, recordCount) {
      const name = normalizeName(rawName);
      if (!name || name.length > 32) throw new Error('Enter a session name (maximum 32 characters).');
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        throw new Error('Session snapshot must be a JSON object.');
      }
      if (Buffer.byteLength(JSON.stringify(payload), 'utf8') > 200 * 1024 * 1024) {
        throw new Error('A local session snapshot cannot exceed 200 MB.');
      }
      return insertArchive({
        name,
        kind: 'snapshot',
        status: 'complete',
        payload,
        recordCount,
      });
    },
    read(id) {
      const row = db.prepare('SELECT * FROM session_archives WHERE id = ?').get(String(id || ''));
      if (!row) throw new Error('Session archive not found.');
      return {
        archive: {
          id: row.id,
          name: row.name,
          kind: row.kind,
          status: row.status,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          recordCount: row.record_count,
        },
        payload: decrypt(row),
      };
    },
    getActiveSession() {
      if (!activeSessionId) return null;
      const row = db.prepare(`
        SELECT id, name, kind, status
        FROM session_archives
        WHERE id = ?
      `).get(activeSessionId);
      if (!row) {
        activeSessionId = '';
        return null;
      }
      return { id: row.id, name: row.name, kind: row.kind, status: row.status };
    },
    setActiveSession(id) {
      const nextId = String(id || '');
      if (!nextId) {
        activeSessionId = '';
        return null;
      }
      const row = db.prepare(`
        SELECT id, name, kind, status
        FROM session_archives
        WHERE id = ?
      `).get(nextId);
      if (!row) throw new Error('Session archive not found.');
      activeSessionId = row.id;
      return { id: row.id, name: row.name, kind: row.kind, status: row.status };
    },
    readCollection(id, namespace) {
      const row = db.prepare('SELECT * FROM session_archives WHERE id = ?').get(String(id || ''));
      if (!row) throw new Error('Session archive not found.');
      const value = decrypt(row);
      if (value.collections && Object.hasOwn(value.collections, String(namespace))) {
        return value.collections[String(namespace)];
      }
      const moduleStateModel = Object.entries(value.tables || {}).find(([tableName]) =>
        tableName.replaceAll('_', '').toLowerCase().includes('modulestate')
      );
      const moduleStates = moduleStateModel?.[1] || [];
      const moduleValue = moduleStates.find((record) => record?.namespace === String(namespace))?.value;
      if (moduleValue !== undefined) return moduleValue;
      if (String(namespace) === 'desktop-examination-state') {
        const examinationTable = Object.entries(value.tables || {}).find(([tableName]) =>
          tableName.replaceAll('_', '').toLowerCase().includes('examinationstate')
        );
        return examinationTable?.[1]?.[0]?.state ?? {
          exams: [],
          papers: [],
          schedules: [],
          marks: [],
          deliveries: [],
          boardClasses: [],
          boardResults: [],
        };
      }
      return null;
    },
    saveCollection(id, namespace, collectionValue) {
      if (activeSessionId !== String(id || '')) {
        throw new Error('Switch back to this local session before saving its data.');
      }
      const row = db.prepare('SELECT * FROM session_archives WHERE id = ?').get(String(id || ''));
      if (!row) throw new Error('Session archive not found.');
      if (row.kind !== 'past' || row.status !== 'draft') {
        throw new Error('Completed session snapshots are read-only.');
      }
      if (!/^[a-z0-9-]{1,100}$/i.test(String(namespace || ''))) {
        throw new Error('Invalid local session data section.');
      }
      const value = decrypt(row);
      value.collections ||= {};
      value.collections[String(namespace)] = collectionValue;
      return this.save(row.id, value);
    },
    save(id, value) {
      const existing = db.prepare('SELECT id, kind FROM session_archives WHERE id = ?').get(String(id || ''));
      if (!existing) throw new Error('Session archive not found.');
      if (existing.kind !== 'past') throw new Error('A completed session snapshot cannot be edited.');
      if (!value || typeof value !== 'object' || Array.isArray(value)) {
        throw new Error('Session data must be a JSON object.');
      }
      const serialized = JSON.stringify(value);
      if (Buffer.byteLength(serialized, 'utf8') > 200 * 1024 * 1024) {
        throw new Error('A local session archive cannot exceed 200 MB.');
      }
      const encrypted = encrypt(value);
      const now = new Date().toISOString();
      db.prepare(`
        UPDATE session_archives
        SET payload = ?, nonce = ?, auth_tag = ?, sha256 = ?, updated_at = ?,
          record_count = ?, status = 'draft'
        WHERE id = ?
      `).run(
        encrypted.payload,
        encrypted.nonce,
        encrypted.authTag,
        encrypted.sha256,
        now,
        countRecords(value),
        existing.id
      );
      return { id: existing.id, updatedAt: now };
    },
    rename(id, rawName) {
      const name = normalizeName(rawName);
      if (!name || name.length > 32) throw new Error('Enter a session name (maximum 32 characters).');
      const result = db.prepare(`
        UPDATE session_archives SET name = ?, updated_at = ?
        WHERE id = ? AND kind = 'past'
      `).run(name, new Date().toISOString(), String(id || ''));
      if (!result.changes) throw new Error('Only a manually created past session can be renamed.');
      if (activeSessionId === String(id || '')) activeSessionId = String(id);
      return { id: String(id), name };
    },
    deleteDraft(id) {
      const result = db.prepare(`
        DELETE FROM session_archives WHERE id = ? AND kind = 'past' AND status = 'draft'
      `).run(String(id || ''));
      if (!result.changes) throw new Error('Only an uncompleted past-session draft can be deleted.');
      if (activeSessionId === String(id || '')) activeSessionId = '';
      return { deleted: true };
    },
    close() {
      db.close();
      encryptionKey.fill(0);
    },
  };
};

module.exports = { createSessionStore };
