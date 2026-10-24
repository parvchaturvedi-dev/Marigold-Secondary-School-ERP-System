import pg from 'pg';
import mongoose from 'mongoose';

await import('../server/utils/loadEnv.js');

const modelFiles = [
  'AcademicCalendar',
  'AiAuditLog',
  'AiReceipt',
  'Application',
  'Assignment',
  'AttendanceLog',
  'AttendanceSetting',
  'BiometricProfile',
  'BoardExamAccess',
  'BoardResultFile',
  'BoardStudentResultFile',
  'BoardTimetableFile',
  'Event',
  'ExaminationState',
  'FraudAlert',
  'LeaveRequest',
  'Meeting',
  'ModuleState',
  'Notification',
  'StudentDocumentFile',
  'TeacherDocumentFile',
  'Timetable',
  'User',
  'VaultItem',
];

await Promise.all(
  modelFiles.map((name) => import(`../server/models/${name}.js`))
);

const quoteIdentifier = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;
const toSnakeCase = (value) =>
  value.replace(/([a-z0-9])([A-Z])/g, '$1_$2').replaceAll('.', '_').toLowerCase();

const getModelColumns = (model) => {
  const roots = new Map();

  for (const [pathName, schemaType] of Object.entries(model.schema.paths)) {
    if (pathName === '_id' || pathName === '__v') continue;
    const rootName = pathName.split('.')[0];
    if (roots.has(rootName)) continue;

    const sqlType = pathName.includes('.')
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
      column: toSnakeCase(rootName),
      sqlType,
    });
  }

  return [...roots.values()];
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

    const models = mongoose.modelNames().map((name) => mongoose.model(name));
    for (const model of models) {
      const columns = getModelColumns(model);
      const definitions = [
        `${quoteIdentifier('id')} TEXT PRIMARY KEY`,
        `${quoteIdentifier('legacy_document')} JSONB NOT NULL`,
        ...columns.map(
          ({ column, sqlType }) => `${quoteIdentifier(column)} ${sqlType}`
        ),
      ];

      await client.query(
        `CREATE TABLE IF NOT EXISTS public.${quoteIdentifier(model.collection.collectionName)}
         (${definitions.join(', ')})`
      );
    }

    await client.query(`
      CREATE TABLE IF NOT EXISTS public.cloudinary_assets (
        asset_id TEXT PRIMARY KEY,
        public_id TEXT NOT NULL,
        asset_folder TEXT NOT NULL DEFAULT '',
        resource_type TEXT NOT NULL,
        delivery_type TEXT NOT NULL,
        original_filename TEXT,
        format TEXT,
        mime_type TEXT NOT NULL,
        byte_size BIGINT NOT NULL,
        sha256 TEXT NOT NULL,
        created_at TIMESTAMPTZ,
        imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        source_metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
        data BYTEA NOT NULL,
        UNIQUE (resource_type, delivery_type, public_id)
      )
    `);

    await client.query('COMMIT');
    transactionStarted = false;

    const { connectPostgres, getPostgresPool } = await import('../server/db.js');
    try {
      await connectPostgres();
    } finally {
      await getPostgresPool().end();
    }

    console.log(`Initialized empty ERP schema for ${models.length} model tables.`);
    console.log('No student, staff, or other application records were created.');
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('Empty PostgreSQL initialization failed:', error?.message || error);
  process.exitCode = 1;
});
