const { app, safeStorage } = require('electron');
const { readFile } = require('node:fs/promises');
const path = require('node:path');
const { createSessionStore } = require('./sessionStore.cjs');

const bundlePath = process.argv.slice(2).find((argument) => !argument.startsWith('--'));
const applyImport = process.argv.includes('--apply');
const verifyArchives = process.argv.includes('--verify');

const validateBundle = (bundle) => {
  if (bundle?.format !== 'mgps-paathshala-session-import' || bundle?.version !== 1) {
    throw new Error('Unsupported Paathshala import bundle format.');
  }
  if (!Array.isArray(bundle.sessions) || bundle.sessions.length === 0) {
    throw new Error('The Paathshala import bundle contains no sessions.');
  }
  return bundle.sessions.map((session) => {
    if (
      !session ||
      typeof session.name !== 'string' ||
      !session.payload ||
      typeof session.payload !== 'object' ||
      Array.isArray(session.payload) ||
      !session.payload.collections?.['paathshala-history']
    ) {
      throw new Error('The Paathshala import bundle contains an invalid session.');
    }
    const recordCount = Number(session.recordCount);
    if (!Number.isSafeInteger(recordCount) || recordCount < 0) {
      throw new Error(`The record count for "${session.name}" is invalid.`);
    }
    const payloadBytes = Buffer.byteLength(JSON.stringify(session.payload), 'utf8');
    if (payloadBytes > 200 * 1024 * 1024) {
      throw new Error(`The session payload for "${session.name}" exceeds the 200 MB archive limit.`);
    }
    return { name: session.name, payload: session.payload, recordCount, payloadBytes };
  });
};

const run = async () => {
  let snapshots = [];
  if (!verifyArchives) {
    if (!bundlePath) throw new Error('Pass a Paathshala import bundle path.');
    const allowedRoot = path.resolve(
      process.env.LOCALAPPDATA || app.getPath('appData'),
      'PaathshalaERP',
      'staging-source'
    );
    const resolvedBundlePath = path.resolve(bundlePath);
    if (!resolvedBundlePath.toLowerCase().startsWith(`${allowedRoot}${path.sep}`.toLowerCase())) {
      throw new Error('The import bundle must be inside the local Paathshala staging folder.');
    }
    const bundle = JSON.parse(await readFile(resolvedBundlePath, 'utf8'));
    snapshots = validateBundle(bundle);
  }

  const dataPath = path.join(app.getPath('appData'), 'mgps-erp');
  const userDataPath = path.join(dataPath, 'session-archive.sqlite');

  if (!safeStorage.isEncryptionAvailable()) {
    throw new Error('Windows secure storage is unavailable; no local archives were changed.');
  }

  const store = createSessionStore({
    databasePath: userDataPath,
    keyPath: path.join(dataPath, 'archive-key.bin'),
    safeStorage,
  });

  try {
    if (verifyArchives) {
      const archives = store.list().filter(({ name, kind }) => name.startsWith('Paathshala ') && kind === 'snapshot');
      const verified = archives.map((archive) => {
        const history = store.readCollection(archive.id, 'paathshala-history');
        if (!history || !Number.isSafeInteger(history.sourceSessionId)) {
          throw new Error(`Archive verification failed for "${archive.name}".`);
        }
        const profiles = history.tables?.SAdmission || history.tables?.C_SAdmission || [];
        return {
          name: archive.name,
          recordCount: archive.recordCount,
          studentProfiles: profiles.length,
          namedStudents: profiles.filter((record) => {
            const nameField = Object.keys(record).find((field) =>
              ['stuname', "student's name", 'studentname', 'name'].includes(field.toLowerCase())
            );
            return nameField && String(record[nameField] || '').trim();
          }).length,
        };
      });
      console.log(JSON.stringify({
        archiveCount: verified.length,
        totalStudentProfiles: verified.reduce((total, archive) => total + archive.studentProfiles, 0),
        archives: verified,
      }, null, 2));
      return;
    }

    const totalRecords = snapshots.reduce((total, snapshot) => total + snapshot.recordCount, 0);
    const existingNames = new Set(store.list().map(({ name }) => name.toLocaleLowerCase('en-US')));
    const conflicts = snapshots
      .filter(({ name }) => existingNames.has(name.toLocaleLowerCase('en-US')))
      .map(({ name }) => name);
    const preview = {
      mode: applyImport ? 'apply' : 'dry-run',
      archiveDatabase: userDataPath,
      sessionCount: snapshots.length,
      totalRecords,
      totalPayloadBytes: snapshots.reduce((total, snapshot) => total + snapshot.payloadBytes, 0),
      conflicts,
      sessions: snapshots.map(({ name, recordCount, payloadBytes }) => ({
        name,
        recordCount,
        payloadBytes,
      })),
    };

    if (!applyImport) {
      console.log(JSON.stringify(preview, null, 2));
      return;
    }
    if (conflicts.length) {
      throw new Error(`Local archive name collision(s): ${conflicts.join(', ')}. No sessions were imported.`);
    }

    const created = store.createSnapshotsBatch(snapshots);
    for (const archive of created) {
      const history = store.readCollection(archive.id, 'paathshala-history');
      if (!history || !Number.isSafeInteger(history.sourceSessionId)) {
        throw new Error(`Archive verification failed for "${archive.name}".`);
      }
    }
    console.log(JSON.stringify({ ...preview, created: created.length }, null, 2));
  } finally {
    store.close();
  }
};

app.setName('mgps-erp');
app.whenReady()
  .then(run)
  .then(() => app.quit())
  .catch((error) => {
    console.error(error.stack || error.message);
    app.exit(1);
  });
