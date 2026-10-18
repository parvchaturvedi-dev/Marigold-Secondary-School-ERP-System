import { createHash } from 'node:crypto';
import pg from 'pg';
await import('../server/utils/loadEnv.js');
const [{ v2: cloudinary }, { isCloudinaryConfigured }] = await Promise.all([
  import('cloudinary'),
  import('../server/utils/cloudinary.js'),
]);

const PAGE_SIZE = 100;
const SAMPLE_FOLDER = 'samples';

const createTable = async (client) => {
  await client.query(`
    CREATE TABLE IF NOT EXISTS public.cloudinary_assets (
      asset_id TEXT PRIMARY KEY,
      public_id TEXT NOT NULL,
      asset_folder TEXT NOT NULL,
      resource_type TEXT NOT NULL,
      delivery_type TEXT NOT NULL,
      original_filename TEXT,
      format TEXT,
      mime_type TEXT NOT NULL,
      byte_size BIGINT NOT NULL,
      sha256 TEXT NOT NULL,
      created_at TIMESTAMPTZ,
      imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      source_metadata JSONB NOT NULL,
      data BYTEA NOT NULL,
      UNIQUE (resource_type, delivery_type, public_id)
    );
  `);
};

const listSchoolAssets = async () => {
  const assets = [];

  for (const resourceType of ['image', 'video', 'raw']) {
    let nextCursor;
    do {
      const page = await cloudinary.api.resources({
        resource_type: resourceType,
        type: 'upload',
        max_results: PAGE_SIZE,
        ...(nextCursor ? { next_cursor: nextCursor } : {}),
      });

      for (const asset of page.resources || []) {
        const folder = String(asset.asset_folder || '');
        if (folder === SAMPLE_FOLDER || folder.startsWith(`${SAMPLE_FOLDER}/`)) continue;
        assets.push({ ...asset, resource_type: resourceType, delivery_type: 'upload' });
      }

      nextCursor = page.next_cursor;
    } while (nextCursor);
  }

  return assets;
};

const downloadAsset = async (asset) => {
  if (!asset.secure_url) {
    throw new Error(`Cloudinary did not provide a secure download URL for asset ${asset.asset_id}.`);
  }

  const response = await fetch(asset.secure_url);
  if (!response.ok) {
    throw new Error(`Cloudinary download failed with HTTP ${response.status} for asset ${asset.asset_id}.`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  if (buffer.length !== Number(asset.bytes)) {
    throw new Error(
      `Cloudinary byte-count mismatch for asset ${asset.asset_id}: expected ${asset.bytes}, received ${buffer.length}.`
    );
  }

  const mimeType = response.headers.get('content-type')?.split(';')[0]?.trim();
  if (!mimeType) {
    throw new Error(`Cloudinary did not provide a content type for asset ${asset.asset_id}.`);
  }

  return {
    buffer,
    mimeType,
    sha256: createHash('sha256').update(buffer).digest('hex'),
  };
};

const saveAsset = async (client, asset, file) => {
  const metadata = {
    asset_id: asset.asset_id,
    public_id: asset.public_id,
    asset_folder: asset.asset_folder || '',
    resource_type: asset.resource_type,
    delivery_type: asset.delivery_type,
    original_filename: asset.original_filename || null,
    format: asset.format || null,
    bytes: Number(asset.bytes),
    created_at: asset.created_at || null,
  };

  await client.query(
    `INSERT INTO public.cloudinary_assets (
       asset_id, public_id, asset_folder, resource_type, delivery_type,
       original_filename, format, mime_type, byte_size, sha256, created_at,
       imported_at, source_metadata, data
     ) VALUES (
       $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now(), $12::jsonb, $13
     )
     ON CONFLICT (asset_id) DO UPDATE SET
       public_id = EXCLUDED.public_id,
       asset_folder = EXCLUDED.asset_folder,
       resource_type = EXCLUDED.resource_type,
       delivery_type = EXCLUDED.delivery_type,
       original_filename = EXCLUDED.original_filename,
       format = EXCLUDED.format,
       mime_type = EXCLUDED.mime_type,
       byte_size = EXCLUDED.byte_size,
       sha256 = EXCLUDED.sha256,
       created_at = EXCLUDED.created_at,
       imported_at = now(),
       source_metadata = EXCLUDED.source_metadata,
       data = EXCLUDED.data`,
    [
      asset.asset_id,
      asset.public_id,
      asset.asset_folder || '',
      asset.resource_type,
      asset.delivery_type,
      asset.original_filename || null,
      asset.format || null,
      file.mimeType,
      file.buffer.length,
      file.sha256,
      asset.created_at || null,
      JSON.stringify(metadata),
      file.buffer,
    ]
  );
};

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
    await createTable(client);
    const assets = await listSchoolAssets();
    let migratedBytes = 0;
    let migratedCount = 0;

    for (const asset of assets) {
      const file = await downloadAsset(asset);
      await saveAsset(client, asset, file);
      migratedCount += 1;
      migratedBytes += file.buffer.length;
      console.log(`${asset.asset_id}: ${file.buffer.length} bytes verified and copied`);
    }

    const expectedAssetIds = assets.map(({ asset_id }) => asset_id);
    let verifiedCount = 0;
    for (const assetId of expectedAssetIds) {
      const result = await client.query(
        `SELECT byte_size, octet_length(data) AS stored_bytes, sha256, data
         FROM public.cloudinary_assets
         WHERE asset_id = $1`,
        [assetId]
      );
      if (result.rowCount !== 1) {
        throw new Error(`PostgreSQL is missing Cloudinary asset ${assetId}.`);
      }
      const row = result.rows[0];
      if (Number(row.byte_size) !== Number(row.stored_bytes)) {
        throw new Error(`PostgreSQL byte-count mismatch for Cloudinary asset ${assetId}.`);
      }
      const storedHash = createHash('sha256').update(row.data).digest('hex');
      if (storedHash !== row.sha256) {
        throw new Error(`PostgreSQL SHA-256 mismatch for Cloudinary asset ${assetId}.`);
      }
      verifiedCount += 1;
    }

    if (verifiedCount !== migratedCount) {
      throw new Error(`Verification failed: copied ${migratedCount}, verified ${verifiedCount}.`);
    }

    console.log(
      `Copied and verified ${verifiedCount} non-sample Cloudinary assets (${migratedBytes} bytes).`
    );
    console.log('Cloudinary originals were not deleted; the running ERP still uses its existing storage configuration.');
  } finally {
    await client.end();
  }
};

run().catch((error) => {
  console.error('Cloudinary-to-PostgreSQL migration failed:', error?.name || 'Unknown error');
  process.exitCode = 1;
});
