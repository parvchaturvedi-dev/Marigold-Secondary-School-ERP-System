import pg from 'pg';
import mongoose from 'mongoose';
import { configurePostgresModels } from './postgresModels.js';

const { Pool } = pg;
let pool = null;
let dbStatus = 'disconnected';

const quoteIdentifier = (identifier) => `"${String(identifier).replaceAll('"', '""')}"`;
const columnNameForPath = (path) =>
  path.replace(/\./g, '_').replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();

const createModelIndexes = async (activePool) => {
  for (const name of mongoose.modelNames()) {
    const model = mongoose.model(name);
    const tableName = model.collection.collectionName;
    for (const [keys, options] of model.schema.indexes()) {
      const indexName =
        options.name ||
        `${tableName}_${Object.keys(keys).map(columnNameForPath).join('_')}_idx`;
      const columns = Object.entries(keys)
        .map(([path, direction]) => `${quoteIdentifier(columnNameForPath(path))} ${direction < 0 ? 'DESC' : 'ASC'}`)
        .join(', ');
      const unique = options.unique ? 'UNIQUE ' : '';
      await activePool.query(
        `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdentifier(indexName)}
         ON public.${quoteIdentifier(tableName)} (${columns})`
      );
    }
  }
};

export const getPostgresPool = () => {
  if (pool) return pool;
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured.');
  if (!['postgres:', 'postgresql:'].includes(new URL(databaseUrl).protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }
  pool = new Pool({
    connectionString: databaseUrl,
    max: Number(process.env.PG_POOL_MAX) || 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  });
  return pool;
};

export const connectPostgres = async () => {
  try {
    const activePool = getPostgresPool();
    await activePool.query('SELECT 1');

    const requiredTables = mongoose.modelNames().map((name) => {
      const model = mongoose.model(name);
      return model.collection.collectionName;
    });
    requiredTables.push('cloudinary_assets');
    const result = await activePool.query(
      `SELECT table_name
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_type = 'BASE TABLE'
         AND table_name = ANY($1::text[])`,
      [requiredTables]
    );
    const availableTables = new Set(result.rows.map((row) => row.table_name));
    const missingTables = requiredTables.filter((tableName) => !availableTables.has(tableName));
    if (missingTables.length) {
      throw new Error(`Required PostgreSQL tables are missing: ${missingTables.join(', ')}.`);
    }

    configurePostgresModels(activePool);
    await createModelIndexes(activePool);
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS public.user_sessions (
        sid VARCHAR NOT NULL PRIMARY KEY,
        sess JSON NOT NULL,
        expire TIMESTAMP(6) NOT NULL
      );
      CREATE INDEX IF NOT EXISTS user_sessions_expire_idx
      ON public.user_sessions (expire);

      CREATE TABLE IF NOT EXISTS public.brevo_email_outbox (
        id UUID PRIMARY KEY,
        payload_ciphertext BYTEA,
        payload_iv BYTEA,
        payload_auth_tag BYTEA,
        status TEXT NOT NULL DEFAULT 'queued'
          CHECK (status IN ('queued', 'sending', 'sent', 'failed')),
        attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
        available_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        locked_at TIMESTAMPTZ,
        last_error_status INTEGER,
        message_id TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        sent_at TIMESTAMPTZ,
        CHECK (
          (status = 'sent' AND payload_ciphertext IS NULL AND payload_iv IS NULL AND payload_auth_tag IS NULL)
          OR (status <> 'sent' AND payload_ciphertext IS NOT NULL AND payload_iv IS NOT NULL AND payload_auth_tag IS NOT NULL)
        )
      );
      CREATE INDEX IF NOT EXISTS brevo_email_outbox_pending_idx
      ON public.brevo_email_outbox (available_at, created_at)
      WHERE status IN ('queued', 'sending')
    `);
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS public.desktop_session_state (
        id SMALLINT PRIMARY KEY CHECK (id = 1),
        current_session_name TEXT NOT NULL,
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      INSERT INTO public.desktop_session_state (id, current_session_name)
      VALUES (1, '2026-27')
      ON CONFLICT (id) DO NOTHING;

      CREATE TABLE IF NOT EXISTS public.desktop_session_rollovers (
        archive_id TEXT PRIMARY KEY,
        source_session TEXT NOT NULL,
        target_session TEXT NOT NULL,
        snapshot_sha256 TEXT NOT NULL,
        result JSONB NOT NULL,
        actor_username TEXT NOT NULL,
        completed_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );

      CREATE TABLE IF NOT EXISTS public.session_archives (
        id UUID PRIMARY KEY,
        source_session TEXT NOT NULL,
        target_session TEXT NOT NULL,
        snapshot_sha256 TEXT NOT NULL,
        record_count BIGINT NOT NULL,
        compressed_bytes BIGINT NOT NULL,
        snapshot_gzip BYTEA NOT NULL,
        created_by TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS session_archives_created_at_idx
      ON public.session_archives (created_at DESC)
    `);
    await activePool.query(`
      CREATE TABLE IF NOT EXISTS public.inventory_items (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL CHECK (length(trim(name)) > 0),
        category TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        quantity_received INTEGER NOT NULL DEFAULT 0 CHECK (quantity_received >= 0),
        stock_quantity INTEGER NOT NULL DEFAULT 0 CHECK (stock_quantity >= 0),
        purchase_price NUMERIC(12, 2) NOT NULL CHECK (purchase_price >= 0),
        stock_cost_value NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (stock_cost_value >= 0),
        selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
        purchase_expense NUMERIC(14, 2) NOT NULL DEFAULT 0 CHECK (purchase_expense >= 0),
        active BOOLEAN NOT NULL DEFAULT TRUE,
        created_by_username TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
      );
      CREATE INDEX IF NOT EXISTS inventory_items_active_name_idx
      ON public.inventory_items (active, name);

      CREATE TABLE IF NOT EXISTS public.inventory_issues (
        id UUID PRIMARY KEY,
        item_id UUID NOT NULL REFERENCES public.inventory_items(id) ON DELETE RESTRICT,
        student_id TEXT NOT NULL,
        student_name TEXT NOT NULL,
        class_name TEXT NOT NULL,
        purchase_price NUMERIC(12, 2) NOT NULL CHECK (purchase_price >= 0),
        selling_price NUMERIC(12, 2) NOT NULL CHECK (selling_price >= 0),
        issued_by_username TEXT NOT NULL,
        issued_at TIMESTAMPTZ NOT NULL DEFAULT now(),
        UNIQUE (item_id, student_id)
      );
      CREATE INDEX IF NOT EXISTS inventory_issues_class_item_idx
      ON public.inventory_issues (class_name, item_id);
      CREATE INDEX IF NOT EXISTS inventory_issues_student_idx
      ON public.inventory_issues (student_id);
    `);
    dbStatus = 'connected';
    console.log(`PostgreSQL connected (${requiredTables.length} ERP tables verified)`);
    return activePool;
  } catch (error) {
    dbStatus = 'error';
    console.error('PostgreSQL connection failed:', {
      name: error.name,
      code: error.code,
      message: error.message,
    });
    throw error;
  }
};

export const getDbStatus = () => dbStatus;

export const isDatabaseConnected = () => Boolean(pool && !pool.ended);

export const isMongoConnected = isDatabaseConnected;

export const ensureAssetTable = async () => {
  const activePool = getPostgresPool();
  await activePool.query(`
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
};

export const closePostgres = async () => {
  if (!pool) return;
  await pool.end();
  pool = null;
  dbStatus = 'disconnected';
};
