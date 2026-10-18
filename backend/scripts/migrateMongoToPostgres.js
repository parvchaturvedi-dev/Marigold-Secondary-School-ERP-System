import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import pg from 'pg';
import '../server/utils/loadEnv.js';

const { EJSON } = mongoose.mongo.BSON;
const batchSize = 100;

const createMigrationTables = async (client) => {
  await client.query(`
    CREATE SCHEMA IF NOT EXISTS migration;
    CREATE TABLE IF NOT EXISTS migration.runs (
      id UUID PRIMARY KEY,
      source_database TEXT NOT NULL,
      target_database TEXT NOT NULL,
      status TEXT NOT NULL CHECK (status IN ('running', 'completed')),
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      completed_at TIMESTAMPTZ
    );
    CREATE TABLE IF NOT EXISTS migration.collection_counts (
      run_id UUID NOT NULL REFERENCES migration.runs(id),
      source_collection TEXT NOT NULL,
      source_count BIGINT NOT NULL,
      migrated_count BIGINT NOT NULL,
      PRIMARY KEY (run_id, source_collection)
    );
    CREATE TABLE IF NOT EXISTS migration.mongo_documents (
      run_id UUID NOT NULL REFERENCES migration.runs(id),
      source_collection TEXT NOT NULL,
      source_id TEXT NOT NULL,
      document JSONB NOT NULL,
      PRIMARY KEY (run_id, source_collection, source_id)
    );
  `);
};

const insertBatch = async (client, runId, collectionName, records) => {
  if (records.length === 0) return;

  const values = [];
  const tuples = records.map((record, index) => {
    const offset = index * 4;
    values.push(runId, collectionName, record.sourceId, record.document);
    return `($${offset + 1}::uuid, $${offset + 2}, $${offset + 3}, $${offset + 4}::jsonb)`;
  });

  await client.query(
    `INSERT INTO migration.mongo_documents
      (run_id, source_collection, source_id, document)
     VALUES ${tuples.join(', ')}`,
    values
  );
};

const run = async () => {
  const mongoUri = process.env.MONGODB_URI;
  const databaseUrl = process.env.DATABASE_URL;
  if (!mongoUri) throw new Error('MONGODB_URI is not configured.');
  if (!databaseUrl) throw new Error('DATABASE_URL is not configured.');

  const targetDatabase = new URL(databaseUrl);
  if (!['postgres:', 'postgresql:'].includes(targetDatabase.protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }

  let client;
  let transactionStarted = false;
  const runId = randomUUID();
  let sourceTotal = 0;
  let migratedTotal = 0;

  try {
    await mongoose.connect(mongoUri, {
      dbName: process.env.MONGODB_DB_NAME || undefined,
      serverSelectionTimeoutMS: 10000,
    });
    client = new pg.Client({ connectionString: databaseUrl, connectionTimeoutMillis: 10000 });
    await client.connect();
    const sourceDb = mongoose.connection.db;

    await client.query('BEGIN');
    transactionStarted = true;
    await createMigrationTables(client);
    await client.query(
      `INSERT INTO migration.runs
        (id, source_database, target_database, status)
       VALUES ($1, $2, $3, 'running')`,
      [runId, sourceDb.databaseName, decodeURIComponent(targetDatabase.pathname.slice(1))]
    );

    const collections = await sourceDb.listCollections({}, { nameOnly: true }).toArray();
    for (const { name } of collections) {
      const collection = sourceDb.collection(name);
      const sourceCount = await collection.countDocuments();
      let migratedCount = 0;
      let batch = [];

      for await (const document of collection.find({})) {
        if (document._id === undefined || document._id === null) {
          throw new Error(`Collection "${name}" contains a document without _id.`);
        }

        batch.push({
          sourceId: String(document._id),
          document: EJSON.stringify(document, { relaxed: false }),
        });

        if (batch.length === batchSize) {
          await insertBatch(client, runId, name, batch);
          migratedCount += batch.length;
          batch = [];
        }
      }

      await insertBatch(client, runId, name, batch);
      migratedCount += batch.length;
      if (migratedCount !== sourceCount) {
        throw new Error(
          `Collection "${name}" changed during migration: counted ${sourceCount}, copied ${migratedCount}.`
        );
      }

      await client.query(
        `INSERT INTO migration.collection_counts
          (run_id, source_collection, source_count, migrated_count)
         VALUES ($1, $2, $3, $4)`,
        [runId, name, sourceCount, migratedCount]
      );
      sourceTotal += sourceCount;
      migratedTotal += migratedCount;
      console.log(`${name}: ${migratedCount}/${sourceCount}`);
    }

    const verification = await client.query(
      `SELECT count(*)::bigint AS migrated_count
       FROM migration.mongo_documents
       WHERE run_id = $1`,
      [runId]
    );
    const verifiedTotal = Number(verification.rows[0].migrated_count);
    if (sourceTotal !== migratedTotal || migratedTotal !== verifiedTotal) {
      throw new Error(
        `Migration verification failed: source ${sourceTotal}, copied ${migratedTotal}, PostgreSQL ${verifiedTotal}.`
      );
    }

    await client.query(
      `UPDATE migration.runs
       SET status = 'completed', completed_at = now()
       WHERE id = $1`,
      [runId]
    );
    await client.query('COMMIT');
    transactionStarted = false;

    console.log(`Completed migration ${runId}: ${verifiedTotal} documents verified.`);
    console.log('MongoDB was not modified. PostgreSQL data is in the migration schema for staged cutover.');
  } catch (error) {
    if (transactionStarted) await client.query('ROLLBACK');
    throw error;
  } finally {
    if (client) await client.end();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
  }
};

run().catch((error) => {
  console.error('MongoDB-to-PostgreSQL migration failed:', error?.name || 'Unknown error');
  process.exitCode = 1;
});
