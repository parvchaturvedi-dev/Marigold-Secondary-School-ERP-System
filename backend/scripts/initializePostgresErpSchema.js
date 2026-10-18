import pg from 'pg';
import mongoose from 'mongoose';
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
const quoteIdentifier = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;
const toSnakeCase = (value) =>
  value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replaceAll('.', '_').toLowerCase();

const getModelColumns = (model) => {
  const roots = new Map();

  for (const [pathName, schemaType] of Object.entries(model.schema.paths)) {
    if (pathName === '_id' || pathName === '__v') continue;
    const rootName = pathName.split('.')[0];
    if (roots.has(rootName)) continue;

    const isNestedPath = pathName.includes('.');
    const sqlType = isNestedPath
      ? 'JSONB'
      : {
          String: 'TEXT',
          Number: 'DOUBLE PRECISION',
          Boolean: 'BOOLEAN',
          Date: 'TIMESTAMPTZ',
          Buffer: 'BYTEA',
          ObjectId: 'TEXT',
        }[schemaType.instance] || 'JSONB';

    roots.set(rootName, {
      name: rootName,
      column: toSnakeCase(rootName),
      sqlType,
    });
  }

  return [...roots.values()];
};

const toJson = (value) => (value === null || value === undefined ? null : EJSON.stringify(value, { relaxed: false }));

const toSqlValue = (value, sqlType) => {
  if (value === undefined || value === null) return null;
  if (sqlType === 'JSONB') return toJson(value);
  if (sqlType === 'TEXT' && typeof value === 'object') return value.toString();
  if (sqlType === 'BYTEA') {
    if (Buffer.isBuffer(value)) return value;
    if (value instanceof Uint8Array) return Buffer.from(value);
    if (value?._bsontype === 'Binary' && value.buffer) {
      return Buffer.from(value.buffer).subarray(0, value.position);
    }
    throw new Error('Encountered a binary field that cannot be converted to PostgreSQL BYTEA.');
  }
  return value;
};

const createTable = async (client, collectionName, model) => {
  const columns = model ? getModelColumns(model) : [];
  const columnDefinitions = [
    `${quoteIdentifier('id')} TEXT PRIMARY KEY`,
    `${quoteIdentifier('legacy_document')} JSONB NOT NULL`,
    ...columns.map(
      ({ column, sqlType }) => `${quoteIdentifier(column)} ${sqlType}`
    ),
  ];

  await client.query(
    `CREATE TABLE IF NOT EXISTS public.${quoteIdentifier(collectionName)} (${columnDefinitions.join(', ')})`
  );
  return columns;
};

const upsertDocument = async (client, collectionName, columns, row) => {
  const document = EJSON.parse(JSON.stringify(row.document), { relaxed: false });
  const fieldValues = columns.map(({ name, sqlType }) =>
    toSqlValue(document[name], sqlType)
  );
  const values = [row.source_id, JSON.stringify(row.document), ...fieldValues];
  const names = ['id', 'legacy_document', ...columns.map(({ column }) => column)];
  const placeholders = names.map((name, index) =>
    index === 1 ? `$${index + 1}::jsonb` : `$${index + 1}`
  );
  const updates = names
    .slice(1)
    .map((name) => `${quoteIdentifier(name)} = EXCLUDED.${quoteIdentifier(name)}`);

  await client.query(
    `INSERT INTO public.${quoteIdentifier(collectionName)}
      (${names.map(quoteIdentifier).join(', ')})
     VALUES (${placeholders.join(', ')})
     ON CONFLICT (${quoteIdentifier('id')})
     DO UPDATE SET ${updates.join(', ')}`,
    values
  );
};

const run = async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  if (!['postgres:', 'postgresql:'].includes(new URL(process.env.DATABASE_URL).protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();

  let transactionStarted = false;
  try {
    await client.query('BEGIN');
    transactionStarted = true;

    const latestRun = await client.query(
      `SELECT id, source_database
       FROM migration.runs
       WHERE status = 'completed'
       ORDER BY completed_at DESC
       LIMIT 1`
    );
    if (!latestRun.rowCount) {
      throw new Error('No completed MongoDB snapshot exists in the migration schema.');
    }

    const { id: runId, source_database: sourceDatabase } = latestRun.rows[0];
    const modelsByCollection = new Map(
      mongoose.modelNames().map((name) => {
        const model = mongoose.model(name);
        return [model.collection.collectionName, model];
      })
    );
    const collectionCounts = await client.query(
      `SELECT source_collection, source_count, migrated_count
       FROM migration.collection_counts
       WHERE run_id = $1
       ORDER BY source_collection`,
      [runId]
    );

    let totalExpected = 0;
    let totalLoaded = 0;
    for (const entry of collectionCounts.rows) {
      const {
        source_collection: collectionName,
        source_count: sourceCountValue,
        migrated_count: stagedCountValue,
      } = entry;
      const sourceCount = Number(sourceCountValue);
      const stagedCount = Number(stagedCountValue);
      if (sourceCount !== stagedCount) {
        throw new Error(`Staged count mismatch for "${collectionName}".`);
      }

      const columns = await createTable(
        client,
        collectionName,
        modelsByCollection.get(collectionName)
      );
      const documents = await client.query(
        `SELECT source_id, document
         FROM migration.mongo_documents
         WHERE run_id = $1 AND source_collection = $2
         ORDER BY source_id`,
        [runId, collectionName]
      );

      for (const row of documents.rows) {
        await upsertDocument(client, collectionName, columns, row);
      }

      const tableCount = await client.query(
        `SELECT count(*)::bigint AS count
         FROM public.${quoteIdentifier(collectionName)}`
      );
      const loadedCount = Number(tableCount.rows[0].count);
      if (loadedCount !== sourceCount || documents.rowCount !== sourceCount) {
        throw new Error(
          `PostgreSQL count mismatch for "${collectionName}": source ${sourceCount}, snapshot ${documents.rowCount}, target ${loadedCount}.`
        );
      }

      totalExpected += sourceCount;
      totalLoaded += loadedCount;
      console.log(`${collectionName}: ${loadedCount}/${sourceCount}`);
    }

    if (totalExpected !== totalLoaded) {
      throw new Error(`Overall PostgreSQL count mismatch: source ${totalExpected}, target ${totalLoaded}.`);
    }

    await client.query('COMMIT');
    transactionStarted = false;
    console.log(
      `Created and loaded ${collectionCounts.rowCount} ERP tables from MongoDB database "${sourceDatabase}"; verified ${totalLoaded} documents.`
    );
    console.log('MongoDB is unchanged; the backend is not yet switched to PostgreSQL.');
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('PostgreSQL ERP schema initialization failed:', error?.name || 'Unknown error');
  process.exitCode = 1;
});
