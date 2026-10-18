import mongoose from 'mongoose';
import pg from 'pg';
import '../server/utils/loadEnv.js';
import '../server/models/AcademicCalendar.js';
import '../server/models/AiAuditLog.js';
import '../server/models/AiReceipt.js';
import '../server/models/Application.js';
import '../server/models/Assignment.js';
import '../server/models/AttendanceLog.js';
import '../server/models/AttendanceSetting.js';
import '../server/models/BiometricProfile.js';
import '../server/models/BoardExamAccess.js';
import '../server/models/BoardResultFile.js';
import '../server/models/BoardStudentResultFile.js';
import '../server/models/BoardTimetableFile.js';
import '../server/models/Event.js';
import '../server/models/ExaminationState.js';
import '../server/models/FraudAlert.js';
import '../server/models/LeaveRequest.js';
import '../server/models/Meeting.js';
import '../server/models/ModuleState.js';
import '../server/models/Notification.js';
import '../server/models/StudentDocumentFile.js';
import '../server/models/TeacherDocumentFile.js';
import '../server/models/Timetable.js';
import '../server/models/User.js';
import '../server/models/VaultItem.js';

const { EJSON } = mongoose.mongo.BSON;
const quote = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;

const stableValue = (value) => {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])])
  );
};

const withoutUpdatedAt = (document) => {
  const copy = { ...document };
  delete copy.updatedAt;
  return copy;
};

const hasSameContent = (source, target) =>
  JSON.stringify(stableValue(withoutUpdatedAt(source))) ===
  JSON.stringify(stableValue(withoutUpdatedAt(target)));

const dateValue = (value) => {
  if (value instanceof Date) return value;
  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (value?.$date) {
    const dateValue = value.$date.$numberLong || value.$date.$numberInt || value.$date;
    const date = new Date(
      typeof dateValue === 'string' && !/^-?\d+$/.test(dateValue)
        ? dateValue
        : Number(dateValue)
    );
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
};

const getModelColumns = (model) => {
  const columns = new Map();
  for (const [pathName, schemaType] of Object.entries(model.schema.paths)) {
    if (pathName === '_id' || pathName === '__v') continue;
    const root = pathName.split('.')[0];
    if (columns.has(root)) continue;
    const nested = pathName.includes('.');
    columns.set(root, {
      name: root,
      column: root.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase(),
      sqlType: nested
        ? 'JSONB'
        : {
            String: 'TEXT',
            Number: 'DOUBLE PRECISION',
            Boolean: 'BOOLEAN',
            Date: 'TIMESTAMPTZ',
            Buffer: 'BYTEA',
            ObjectId: 'TEXT',
          }[schemaType.instance] || 'JSONB',
    });
  }
  return [...columns.values()];
};

const toSqlValue = (value, sqlType) => {
  if (value === undefined || value === null) return null;
  if (sqlType === 'JSONB') return EJSON.stringify(value, { relaxed: false });
  if (sqlType === 'TEXT' && typeof value === 'object') return String(value);
  if (sqlType === 'BYTEA') {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (value?._bsontype === 'Binary' && value.buffer) {
      return Buffer.from(value.buffer).subarray(0, value.position);
    }
    throw new Error('Cannot encode this MongoDB binary value as PostgreSQL BYTEA.');
  }
  return value;
};

const makeUpsert = (model, document, columns) => {
  const ejson = EJSON.stringify(document, { relaxed: false });
  const value = EJSON.parse(ejson, { relaxed: false });
  const names = ['id', 'legacy_document', ...columns.map(({ column }) => column)];
  const values = [
    String(value._id),
    ejson,
    ...columns.map(({ name, sqlType }) => toSqlValue(value[name], sqlType)),
  ];
  const placeholders = names.map((_, index) =>
    index === 1 ? `$${index + 1}::jsonb` : `$${index + 1}`
  );
  const updates = names
    .slice(1)
    .map((name) => `${quote(name)} = EXCLUDED.${quote(name)}`);

  return {
    sql: `INSERT INTO public.${quote(model.collection.collectionName)}
      (${names.map(quote).join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT (id) DO UPDATE SET ${updates.join(', ')}`,
    values,
    ejson,
  };
};

const makeRawUpsert = (collectionName, document) => ({
  sql: `INSERT INTO public.${quote(collectionName)} (id, legacy_document)
    VALUES ($1, $2::jsonb)
    ON CONFLICT (id) DO UPDATE SET legacy_document = EXCLUDED.legacy_document`,
  values: [
    String(document._id),
    EJSON.stringify(document, { relaxed: false }),
  ],
});

const parseSession = (document) => {
  const value = typeof document.session === 'string'
    ? JSON.parse(document.session)
    : document.session;
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('A MongoDB session contains an invalid session payload.');
  }
  return value;
};

const copyMongoSnapshot = async (sourceDb) => {
  const sourceSession = await mongoose.startSession();
  const snapshot = new Map();
  try {
    await sourceSession.withTransaction(async () => {
      const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
      for (const { name } of collections) {
        const documents = await sourceDb
          .collection(name)
          .find({}, { session: sourceSession })
          .toArray();
        snapshot.set(name, documents);
      }
    }, { readConcern: { level: 'snapshot' } });
  } finally {
    await sourceSession.endSession();
  }
  return snapshot;
};

const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const databaseUrl = process.env.DATABASE_URL;
  if (!mongoUri) throw new Error('MONGODB_URI is not configured.');
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured.');
  if (!['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }

  const client = new pg.Client({
    connectionString: databaseUrl,
    connectionTimeoutMillis: 10000,
  });
  let transactionStarted = false;

  try {
    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB_NAME || undefined,
      serverSelectionTimeoutMS: 10000,
    });
    const sourceDb = mongoose.connection.db;
    const snapshot = await copyMongoSnapshot(sourceDb);
    const models = new Map(
      mongoose.modelNames().map((name) => {
        const model = mongoose.model(name);
        return [model.collection.collectionName, model];
      })
    );
    const missingModelCollections = [...models.values()]
      .map((model) => model.collection.collectionName)
      .filter((name) => !snapshot.has(name));
    if (missingModelCollections.length) {
      throw new Error(`MongoDB is missing ERP model collections: ${missingModelCollections.join(', ')}.`);
    }

    await client.connect();
    const sourceTableNames = [...snapshot.keys()].filter((name) => name !== 'sessions');
    const targetTables = await client.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name = ANY($1::text[])`,
      [sourceTableNames]
    );
    const availableTables = new Set(targetTables.rows.map((row) => row.table_name));
    const missingTables = sourceTableNames.filter((name) => !availableTables.has(name));
    if (missingTables.length) {
      throw new Error(`PostgreSQL is missing MongoDB collection tables: ${missingTables.join(', ')}.`);
    }
    const rawSessionTable = await client.query(
      `SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name = 'sessions'
       LIMIT 1`
    );
    await client.query('BEGIN');
    transactionStarted = true;
    await client.query('SET LOCAL lock_timeout = \'15s\'');
    const tables = [
      ...sourceTableNames.map((name) => `public.${quote(name)}`),
      'public.user_sessions',
      ...(rawSessionTable.rowCount ? ['public."sessions"'] : []),
    ].sort();
    await client.query(`LOCK TABLE ${tables.join(', ')} IN SHARE ROW EXCLUSIVE MODE`);

    const result = {
      inserted: 0,
      updatedFromNewerMongo: 0,
      unchanged: 0,
      preservedNewerPostgres: 0,
      sessionsInserted: 0,
      sessionsAlreadyPresent: 0,
      sessionsExpiredOrInvalid: 0,
      postgresOnlyRowsPreserved: 0,
    };
    const counts = {};

    for (const [collectionName, sourceDocuments] of snapshot) {
      if (collectionName === 'sessions') continue;
      const model = models.get(collectionName);
      const tableName = quote(collectionName);
      const columns = model ? getModelColumns(model) : [];
      const targetResult = await client.query(
        `SELECT id, legacy_document FROM public.${tableName}`
      );
      const targetDocuments = new Map(
        targetResult.rows.map((row) => [String(row.id), row.legacy_document])
      );
      const sourceIds = new Set();
      const collectionCounts = { inserted: 0, updated: 0, unchanged: 0, preserved: 0 };

      for (const sourceDocument of sourceDocuments) {
        if (sourceDocument._id === undefined || sourceDocument._id === null) {
          throw new Error(`MongoDB collection "${collectionName}" contains a document without _id.`);
        }
        const sourceId = String(sourceDocument._id);
        sourceIds.add(sourceId);
        const sourceEjson = EJSON.stringify(sourceDocument, { relaxed: false });
        const sourceValue = JSON.parse(sourceEjson);
        const targetValue = targetDocuments.get(sourceId);

        if (!targetValue) {
          const upsert = model
            ? makeUpsert(model, sourceDocument, columns)
            : makeRawUpsert(collectionName, sourceDocument);
          await client.query(upsert.sql, upsert.values);
          result.inserted += 1;
          collectionCounts.inserted += 1;
          continue;
        }

        if (hasSameContent(sourceValue, targetValue)) {
          result.unchanged += 1;
          collectionCounts.unchanged += 1;
          continue;
        }

        const sourceUpdatedAt = dateValue(sourceValue.updatedAt);
        const targetUpdatedAt = dateValue(targetValue.updatedAt);
        if (
          sourceUpdatedAt &&
          targetUpdatedAt &&
          sourceUpdatedAt.getTime() > targetUpdatedAt.getTime()
        ) {
          const upsert = model
            ? makeUpsert(model, sourceDocument, columns)
            : makeRawUpsert(collectionName, sourceDocument);
          await client.query(upsert.sql, upsert.values);
          result.updatedFromNewerMongo += 1;
          collectionCounts.updated += 1;
        } else if (
          sourceUpdatedAt &&
          targetUpdatedAt &&
          sourceUpdatedAt.getTime() < targetUpdatedAt.getTime()
        ) {
          result.preservedNewerPostgres += 1;
          collectionCounts.preserved += 1;
        } else {
          throw new Error(
            `Conflicting changes in "${collectionName}" for record ${sourceId} have no safe timestamp winner; no changes were committed.`
          );
        }
      }

      const targetOnly = [...targetDocuments.keys()].filter((id) => !sourceIds.has(id)).length;
      result.postgresOnlyRowsPreserved += targetOnly;
      counts[collectionName] = collectionCounts;
    }

    const legacySessionDocuments = snapshot.get('sessions') || [];
    for (const document of legacySessionDocuments) {
      if (document._id === undefined || document._id === null) {
        throw new Error('MongoDB sessions collection contains a document without _id.');
      }
      const payload = parseSession(document);
      const expiresAt = dateValue(document.expires) || dateValue(payload.cookie?.expires);
      const username = String(payload.auth?.username || '').trim().toUpperCase();
      const role = String(payload.auth?.role || '').trim();
      if (!expiresAt || expiresAt.getTime() <= Date.now() || !username || !role) {
        result.sessionsExpiredOrInvalid += 1;
        continue;
      }
      const userResult = await client.query(
        `SELECT 1
         FROM public.${quote(mongoose.model('User').collection.collectionName)}
         WHERE upper(legacy_document ->> 'username') = $1
           AND legacy_document ->> 'role' = $2
           AND COALESCE((legacy_document ->> 'isActive')::boolean, true) = true
         LIMIT 1`,
        [username, role]
      );
      if (!userResult.rowCount) {
        result.sessionsExpiredOrInvalid += 1;
        continue;
      }

      const inserted = await client.query(
        `INSERT INTO public.user_sessions (sid, sess, expire)
         VALUES ($1, $2::json, $3)
         ON CONFLICT (sid) DO NOTHING`,
        [String(document._id), JSON.stringify(payload), expiresAt]
      );
      if (inserted.rowCount) result.sessionsInserted += 1;
      else result.sessionsAlreadyPresent += 1;
    }

    if (rawSessionTable.rowCount && legacySessionDocuments.length) {
      for (const document of legacySessionDocuments) {
        const serialized = EJSON.stringify(document, { relaxed: false });
        await client.query(
          `INSERT INTO public."sessions" (id, legacy_document)
           VALUES ($1, $2::jsonb)
           ON CONFLICT (id) DO UPDATE SET legacy_document = EXCLUDED.legacy_document`,
          [String(document._id), serialized]
        );
      }
    }

    await client.query('COMMIT');
    transactionStarted = false;
    console.log(JSON.stringify({
      sourceCollections: snapshot.size,
      collections: counts,
      summary: result,
      mongoWasNotModified: true,
    }));
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end().catch(() => {});
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('MongoDB-to-PostgreSQL sync failed:', error?.name || 'Unknown error');
  process.exitCode = 1;
});
