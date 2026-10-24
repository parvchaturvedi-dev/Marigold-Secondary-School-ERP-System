import { createHash } from 'node:crypto';
import pg from 'pg';
await import('../server/utils/loadEnv.js');
const [{ v2: cloudinary }, { isCloudinaryConfigured }] = await Promise.all([
  import('cloudinary'),
  import('../server/utils/cloudinary.js'),
]);

const PAGE_SIZE = 10;

const uploadAsset = (asset, data) =>
  new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: asset.asset_folder || 'mgps/migrated',
        public_id: asset.public_id,
        resource_type: 'raw',
        type: 'authenticated',
        overwrite: true,
        invalidate: true,
      },
      (error, result) => {
        if (error) {
          reject(error);
          return;
        }
        if (
          result?.public_id !== asset.public_id ||
          Number(result.bytes) !== data.length
        ) {
          reject(new Error(`Cloudinary byte-count verification failed for asset ${asset.asset_id}.`));
          return;
        }
        resolve(result);
      }
    );
    stream.end(data);
  });

const run = async () => {
  if (!isCloudinaryConfigured()) throw new Error('Cloudinary is not configured.');
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not configured.');
  if (!['postgres:', 'postgresql:'].includes(new URL(process.env.DATABASE_URL).protocol)) {
    throw new Error('DATABASE_URL must use PostgreSQL.');
  }

  const client = new pg.Client({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
  });
  await client.connect();

  try {
    let lastAssetId = '';
    let migratedCount = 0;
    let migratedBytes = 0;

    while (true) {
      const page = await client.query(
        `SELECT asset_id, public_id, asset_folder, byte_size, sha256, data
         FROM public.cloudinary_assets
         WHERE resource_type = 'postgres'
           AND octet_length(data) > 0
           AND asset_id > $1
         ORDER BY asset_id
         LIMIT $2`,
        [lastAssetId, PAGE_SIZE]
      );
      if (!page.rowCount) break;

      for (const asset of page.rows) {
        lastAssetId = asset.asset_id;
        const data = asset.data;
        const actualHash = createHash('sha256').update(data).digest('hex');
        if (data.length !== Number(asset.byte_size) || actualHash !== asset.sha256) {
          throw new Error(`PostgreSQL asset integrity check failed for asset ${asset.asset_id}.`);
        }

        await uploadAsset(asset, data);
        const cleared = await client.query(
          `UPDATE public.cloudinary_assets
           SET data = ''::bytea
           WHERE asset_id = $1
             AND resource_type = 'postgres'
             AND sha256 = $2
             AND octet_length(data) = $3`,
          [asset.asset_id, asset.sha256, data.length]
        );
        if (cleared.rowCount !== 1) {
          throw new Error(`Asset ${asset.asset_id} changed during migration; its database copy was kept.`);
        }

        migratedCount += 1;
        migratedBytes += data.length;
        console.log(`Migrated asset ${asset.asset_id} (${data.length} bytes).`);
      }
    }

    console.log(`Migrated ${migratedCount} assets (${migratedBytes} bytes) to Cloudinary.`);
    console.log('Database file bytes were cleared only after Cloudinary confirmed each upload.');
    console.log('PostgreSQL may need maintenance to reclaim disk space after the migration.');
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('PostgreSQL-to-Cloudinary migration failed:', error?.message || error);
  process.exitCode = 1;
});
