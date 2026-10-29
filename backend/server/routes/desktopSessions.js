import { createHash, randomUUID } from 'node:crypto';
import { gunzipSync, gzipSync } from 'node:zlib';
import express from 'express';
import mongoose from 'mongoose';
import { getPostgresPool } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { planSessionPromotion } from '../utils/desktopSessionLogic.js';

const router = express.Router();
const INITIAL_SESSION = '2026-27';
const EXCLUDED_ARCHIVE_MODELS = new Set(['User']);
const safeIdentifier = (value) => `"${String(value).replaceAll('"', '""')}"`;

const desktopOnly = (request, response, next) => {
  const origin = request.get('origin') || '';
  if (
    request.get('x-mgps-desktop') !== '1' ||
    !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/i.test(origin)
  ) {
    response.status(403).json({ message: 'This operation is available in the Clerk desktop app only.' });
    return;
  }
  next();
};

const currentSession = async (queryable, lock = false) => {
  const result = await queryable.query(
    `SELECT current_session_name
     FROM public.desktop_session_state
     WHERE id = 1${lock ? ' FOR UPDATE' : ''}`
  );
  if (!result.rows[0]) throw new Error('Desktop session state has not been initialized.');
  return result.rows[0].current_session_name;
};

const readModelRows = async (queryable, model) => {
  const table = safeIdentifier(model.collection.collectionName);
  const result = await queryable.query(`SELECT legacy_document FROM public.${table} ORDER BY id`);
  return result.rows.map((row) => row.legacy_document);
};

const readAssets = async (queryable) => {
  const result = await queryable.query(`
    SELECT asset_id, public_id, asset_folder, resource_type, delivery_type,
      original_filename, format, mime_type, byte_size, sha256, created_at,
      imported_at, source_metadata, data
    FROM public.cloudinary_assets
    ORDER BY asset_id
  `);
  return result.rows.map((row) => ({
    ...row,
    data: row.data ? row.data.toString('base64') : '',
  }));
};

const omitBinaryValues = (value) => {
  if (Array.isArray(value)) return value.map(omitBinaryValues);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !/^(data|fileData|imageData|photoDataUrl)$/i.test(key))
      .map(([key, entry]) => [key, omitBinaryValues(entry)])
  );
};

const makeSnapshot = async (queryable, sessionName) => {
  const tables = {};
  for (const name of mongoose.modelNames()) {
    if (EXCLUDED_ARCHIVE_MODELS.has(name)) continue;
    const model = mongoose.model(name);
    tables[model.collection.collectionName] = await readModelRows(queryable, model);
  }
  tables.cloudinary_assets = await readAssets(queryable);
  const digestInput = JSON.stringify({ sessionName, tables });
  return {
    snapshot: {
      schemaVersion: 1,
      sessionName,
      createdAt: new Date().toISOString(),
      recordCount: Object.values(tables).reduce((total, rows) => total + rows.length, 0),
      tables,
    },
    sha256: createHash('sha256').update(digestInput).digest('hex'),
  };
};

const getModuleState = async (client, namespace, lock = false) => {
  const model = mongoose.model('ModuleState');
  const result = await client.query(
    `SELECT id, legacy_document
     FROM public.${safeIdentifier(model.collection.collectionName)}
     WHERE namespace = $1${lock ? ' FOR UPDATE' : ''}`,
    [namespace]
  );
  const document = result.rows[0]?.legacy_document;
  return {
    id: result.rows[0]?.id || '',
    value: document?.value ?? null,
  };
};

const setModuleState = async (client, namespace, value) => {
  const model = mongoose.model('ModuleState');
  const table = safeIdentifier(model.collection.collectionName);
  const found = await client.query(
    `SELECT id, legacy_document
     FROM public.${table}
     WHERE namespace = $1
     FOR UPDATE`,
    [namespace]
  );
  const now = new Date();
  if (found.rows[0]) {
    const document = { ...found.rows[0].legacy_document, value, updatedAt: now.toISOString() };
    await client.query(
      `UPDATE public.${table}
       SET legacy_document = $1::jsonb, value = $2::jsonb, updated_at = $3
       WHERE id = $4`,
      [JSON.stringify(document), JSON.stringify(value), now, found.rows[0].id]
    );
    return;
  }

  const id = new mongoose.Types.ObjectId().toString();
  const document = {
    _id: { $oid: id },
    namespace,
    value,
    createdAt: { $date: { $numberLong: String(now.getTime()) } },
    updatedAt: { $date: { $numberLong: String(now.getTime()) } },
  };
  await client.query(
    `INSERT INTO public.${table}
       (id, legacy_document, namespace, value, created_at, updated_at)
     VALUES ($1, $2::jsonb, $3, $4::jsonb, $5, $5)`,
    [id, JSON.stringify(document), namespace, JSON.stringify(value), now]
  );
};

const makePromotionPreview = async (queryable) => {
  const [students, preferences] = await Promise.all([
    getModuleState(queryable, 'admin-student-management-students'),
    getModuleState(queryable, 'admin-class-preferences'),
  ]);
  const plan = planSessionPromotion(students.value || [], preferences.value || []);
  return {
    ...plan.counts,
    classOrder: plan.classOrder,
    studentCount: Array.isArray(students.value) ? students.value.length : 0,
  };
};

const isValidSessionName = (value) =>
  typeof value === 'string' && value.trim().length > 0 && value.trim().length <= 32;

router.get('/current-session', requireRole('admin', 'clerk'), async (_request, response, next) => {
  try {
    response.json({ currentSession: await currentSession(getPostgresPool()) });
  } catch (error) {
    next(error);
  }
});

router.patch('/current-session', requireRole('admin'), async (request, response, next) => {
  const sessionName = String(request.body?.sessionName || '').trim();
  if (!isValidSessionName(sessionName)) {
    response.status(400).json({ message: 'Enter a session name (maximum 32 characters).' });
    return;
  }

  try {
    const result = await getPostgresPool().query(
      `UPDATE public.desktop_session_state
       SET current_session_name = $1, updated_at = now()
       WHERE id = 1
       RETURNING current_session_name`,
      [sessionName]
    );
    if (!result.rowCount) {
      throw new Error('Desktop session state has not been initialized.');
    }
    response.json({ currentSession: result.rows[0].current_session_name });
  } catch (error) {
    next(error);
  }
});

router.get('/archives', requireRole('admin', 'clerk'), async (_request, response, next) => {
  try {
    const result = await getPostgresPool().query(
      `SELECT id, source_session, target_session, snapshot_sha256, record_count,
              compressed_bytes, created_by, created_at
       FROM public.session_archives
       ORDER BY created_at DESC`
    );
    response.json(result.rows);
  } catch (error) {
    next(error);
  }
});

router.delete('/archives/:id', requireRole('admin'), async (request, response, next) => {
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) {
    response.status(400).json({ message: 'Session archive identifier is invalid.' });
    return;
  }

  try {
    const result = await getPostgresPool().query(
      'DELETE FROM public.session_archives WHERE id = $1 RETURNING id',
      [request.params.id]
    );
    if (!result.rowCount) {
      response.status(404).json({ message: 'Session archive not found.' });
      return;
    }
    response.json({ deleted: true, id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
});

router.get('/archives/:id', requireRole('admin', 'clerk'), async (request, response, next) => {
  if (!/^[0-9a-f-]{36}$/i.test(request.params.id)) {
    response.status(400).json({ message: 'Session archive identifier is invalid.' });
    return;
  }
  try {
    const tableName = String(request.query.table || '');
    const offset = Math.max(0, Number.parseInt(request.query.offset, 10) || 0);
    const limit = Math.min(100, Math.max(1, Number.parseInt(request.query.limit, 10) || 25));
    const result = await getPostgresPool().query(
      `SELECT id, source_session, target_session, snapshot_sha256, record_count,
              compressed_bytes, created_by, created_at, snapshot_gzip
       FROM public.session_archives
       WHERE id = $1`,
      [request.params.id]
    );
    if (!result.rowCount) {
      response.status(404).json({ message: 'Session archive not found.' });
      return;
    }

    const { snapshot_gzip: compressedSnapshot, ...archive } = result.rows[0];
    const snapshot = JSON.parse(gunzipSync(compressedSnapshot).toString('utf8'));
    const actualHash = createHash('sha256').update(JSON.stringify(snapshot)).digest('hex');
    if (actualHash !== archive.snapshot_sha256) {
      throw new Error(`Session archive integrity check failed for ${archive.id}.`);
    }
    const tables = Object.entries(snapshot.tables).map(([name, rows]) => ({
      name,
      rowCount: rows.length,
    }));
    if (!tableName) {
      response.json({ archive, tables });
      return;
    }

    const rows = snapshot.tables[tableName];
    if (!rows) {
      response.status(404).json({ message: 'Table was not found in this session archive.' });
      return;
    }
    const visibleRows = rows
      .slice(offset, offset + limit)
      .map(omitBinaryValues);
    response.json({
      archive,
      tables,
      table: tableName,
      offset,
      limit,
      rows: visibleRows,
    });
  } catch (error) {
    next(error);
  }
});

router.get('/current-snapshot', requireRole('clerk'), desktopOnly, async (_request, response, next) => {
  try {
    const sessionName = await currentSession(getPostgresPool());
    response.json(await makeSnapshot(getPostgresPool(), sessionName));
  } catch (error) {
    next(error);
  }
});

router.get('/rollover-preview', requireRole('admin', 'clerk'), async (_request, response, next) => {
  try {
    const pool = getPostgresPool();
    const sessionName = await currentSession(pool);
    response.json({
      currentSession: sessionName,
      preview: await makePromotionPreview(pool),
    });
  } catch (error) {
    if (/class hierarchy|No eligible students/i.test(error.message)) {
      response.status(422).json({ message: error.message });
      return;
    }
    next(error);
  }
});

router.post('/rollover', requireRole('admin', 'clerk'), async (request, response, next) => {
  const { sourceSession, targetSession: rawTarget, snapshotSha256, archiveId } = request.body || {};
  const targetSession = String(rawTarget || '').trim();
  if (!isValidSessionName(targetSession)) {
    response.status(400).json({ message: 'Enter a new session name (maximum 32 characters).' });
    return;
  }
  if (!/^[0-9a-f-]{36}$/i.test(String(archiveId || ''))) {
    response.status(400).json({ message: 'The session archive identifier is invalid.' });
    return;
  }

  const pool = getPostgresPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const source = await currentSession(client, true);
    const prior = await client.query(
      `SELECT source_session, target_session, result
       FROM public.desktop_session_rollovers
       WHERE archive_id = $1`,
      [archiveId]
    );
    if (prior.rows[0]) {
      if (prior.rows[0].source_session !== sourceSession || prior.rows[0].target_session !== targetSession) {
        await client.query('ROLLBACK');
        response.status(409).json({ message: 'This backup identifier was already used for a different rollover.' });
        return;
      }
      await client.query('COMMIT');
      response.json({ ...prior.rows[0].result, alreadyApplied: true });
      return;
    }
    if (source !== sourceSession) {
      await client.query('ROLLBACK');
      response.status(409).json({
        message: `The current session changed to ${source}. Refresh the session screen and create a fresh backup.`,
      });
      return;
    }
    if (source.toLowerCase() === targetSession.toLowerCase()) {
      await client.query('ROLLBACK');
      response.status(400).json({ message: 'The new session must have a different name.' });
      return;
    }

    const lockTables = [...new Set([
      ...mongoose.modelNames()
        .filter((name) => !EXCLUDED_ARCHIVE_MODELS.has(name))
        .map((name) => safeIdentifier(mongoose.model(name).collection.collectionName)),
      '"cloudinary_assets"',
    ])];
    await client.query(
      `LOCK TABLE ${lockTables.map((table) => `public.${table}`).join(', ')} IN SHARE ROW EXCLUSIVE MODE`
    );

    const liveSnapshot = await makeSnapshot(client, source);
    const snapshotBytes = Buffer.from(JSON.stringify(liveSnapshot.snapshot));
    const compressedSnapshot = gzipSync(snapshotBytes);
    const snapshotHash = createHash('sha256').update(snapshotBytes).digest('hex');
    if (snapshotSha256 && liveSnapshot.sha256 !== String(snapshotSha256).toLowerCase()) {
      await client.query('ROLLBACK');
      response.status(409).json({
        message: 'Online data changed after the local backup. No rollover changes were made; create a fresh backup and retry.',
      });
      return;
    }
    await client.query(
      `INSERT INTO public.session_archives
         (id, source_session, target_session, snapshot_sha256, record_count,
          compressed_bytes, snapshot_gzip, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        archiveId,
        source,
        targetSession,
        snapshotHash,
        liveSnapshot.snapshot.recordCount,
        compressedSnapshot.length,
        compressedSnapshot,
        String(request.auth?.username || ''),
      ]
    );

    const studentsState = await getModuleState(client, 'admin-student-management-students', true);
    const preferencesState = await getModuleState(client, 'admin-class-preferences', true);
    const plan = planSessionPromotion(studentsState.value || [], preferencesState.value || []);
    const classesState = await getModuleState(client, 'admin-class-management-classes', true);
    const alumniState = await getModuleState(client, 'admin-finance-alumni-pending', true);

    await setModuleState(client, 'admin-student-management-students', plan.remainingStudents);
    if (plan.newAlumni.length) {
      await setModuleState(client, 'admin-finance-alumni-pending', [
        ...(Array.isArray(alumniState.value) ? alumniState.value : []),
        ...plan.newAlumni,
      ]);
    }

    const classesByName = new Map(
      (Array.isArray(classesState.value) ? classesState.value : [])
        .map((classRecord) => [classRecord.name || classRecord.className || classRecord.class, classRecord])
        .filter(([name]) => name)
    );
    for (const className of plan.classOrder) {
      if (!classesByName.has(className)) classesByName.set(className, { id: className, name: className });
    }
    const nextClasses = [...classesByName.values()].map((classRecord) => {
      const name = classRecord.name || classRecord.className || classRecord.class;
      return { ...classRecord, studentCount: plan.studentCountByClass[name] || 0 };
    });
    await setModuleState(client, 'admin-class-management-classes', nextClasses);
    await setModuleState(client, 'admin-notices-list', []);

    const attendanceTable = safeIdentifier(mongoose.model('AttendanceLog').collection.collectionName);
    const assignmentTable = safeIdentifier(mongoose.model('Assignment').collection.collectionName);
    const examinationTable = safeIdentifier(mongoose.model('ExaminationState').collection.collectionName);
    const attendanceDeleted = await client.query(`DELETE FROM public.${attendanceTable}`);
    const assignmentsDeleted = await client.query(`DELETE FROM public.${assignmentTable}`);
    const examinationsDeleted = await client.query(`DELETE FROM public.${examinationTable}`);

    await client.query(
      `UPDATE public.desktop_session_state
       SET current_session_name = $1, updated_at = now()
       WHERE id = 1`,
      [targetSession]
    );
    const result = {
      sourceSession: source,
      currentSession: targetSession,
      ...plan.counts,
      retainedStudents: plan.remainingStudents.length - plan.counts.promotedCount,
      attendanceRecordsReset: attendanceDeleted.rowCount,
      assignmentsReset: assignmentsDeleted.rowCount,
      examinationStatesReset: examinationsDeleted.rowCount,
      localArchiveId: archiveId,
    };
    await client.query(
      `INSERT INTO public.desktop_session_rollovers
         (archive_id, source_session, target_session, snapshot_sha256, result, actor_username)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
      [
        archiveId,
        source,
        targetSession,
        snapshotHash,
        JSON.stringify(result),
        String(request.auth?.username || ''),
      ]
    );
    await client.query('COMMIT');
    response.json(result);
  } catch (error) {
    await client.query('ROLLBACK');
    if (/class hierarchy|No eligible students/i.test(error.message)) {
      response.status(422).json({ message: error.message });
      return;
    }
    next(error);
  } finally {
    client.release();
  }
});

export default router;
