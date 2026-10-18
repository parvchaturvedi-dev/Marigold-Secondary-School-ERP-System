import { v2 as cloudinary } from 'cloudinary';
import { createHash, randomUUID } from 'node:crypto';
import { getPostgresPool, isDatabaseConnected } from '../db.js';
import { getCachedAsset, setCachedAsset, invalidateCachedAsset } from './assetCache.js';

// ---------------------------------------------------------------------------
// PostgreSQL-backed file storage with Cloudinary support for legacy assets.
//
// New uploads and imported legacy assets are stored in PostgreSQL. Existing
// Cloudinary references fall back to Cloudinary only if they are not imported.
// ---------------------------------------------------------------------------

let configured = false;

const configure = () => {
  // Preferred: a single CLOUDINARY_URL connection string
  //   cloudinary://<api_key>:<api_secret>@<cloud_name>
  // (the SDK reads it automatically). Individual vars are also supported.
  const url = process.env.CLOUDINARY_URL;
  const cloudName = process.env.CLOUDINARY_CLOUD_NAME;
  const apiKey = process.env.CLOUDINARY_API_KEY;
  const apiSecret = process.env.CLOUDINARY_API_SECRET;

  if (url && url.startsWith('cloudinary://')) {
    // The SDK auto-parses CLOUDINARY_URL; still call config() so secure=true is set.
    cloudinary.config({ secure: true });
    configured = true;
    return;
  }

  if (cloudName && apiKey && apiSecret) {
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true,
    });
    configured = true;
    return;
  }

  configured = false;
};

configure();

export const isCloudinaryConfigured = () => configured;
export const isFileStorageConfigured = () => isDatabaseConnected();
export const isFileStoredExternally = (record) =>
  ['cloudinary', 'postgres'].includes(record?.storage);

// Preserve uploaded bytes regardless of MIME type; the download route sets
// the correct response content type from the stored metadata.
export const resourceTypeForMime = () => 'raw';

// Store a Buffer in PostgreSQL.
// Returns { publicId, resourceType, bytes, format } or throws.
export const uploadBuffer = (buffer, { folder = 'mgps', publicId, mimeType } = {}) =>
  new Promise((resolve, reject) => {
    if (!isDatabaseConnected()) {
      reject(new Error('PostgreSQL file storage is not connected.'));
      return;
    }

    const bytes = Buffer.from(buffer);
    const assetId = randomUUID();
    const id = publicId || assetId;
    const resourceType = 'postgres';
    getPostgresPool()
      .query(
        `INSERT INTO public.cloudinary_assets (
           asset_id, public_id, asset_folder, resource_type, delivery_type,
           original_filename, format, mime_type, byte_size, sha256, created_at,
           source_metadata, data
         ) VALUES ($1, $2, $3, $4, 'postgres', $5, $6, $7, $8, $9, now(), $10::jsonb, $11)
         ON CONFLICT (resource_type, delivery_type, public_id) DO UPDATE SET
           asset_folder = EXCLUDED.asset_folder,
           original_filename = EXCLUDED.original_filename,
           format = EXCLUDED.format,
           mime_type = EXCLUDED.mime_type,
           byte_size = EXCLUDED.byte_size,
           sha256 = EXCLUDED.sha256,
           imported_at = now(),
           source_metadata = EXCLUDED.source_metadata,
           data = EXCLUDED.data`,
        [
          assetId,
          id,
          folder,
          resourceType,
          id,
          mimeType?.split('/')[1] || null,
          mimeType || 'application/octet-stream',
          bytes.length,
          createHash('sha256').update(bytes).digest('hex'),
          JSON.stringify({ source: 'erp-upload' }),
          bytes,
        ]
      )
      .then(() => {
        invalidateCachedAsset(`${resourceType}:${id}`);
        resolve({ publicId: id, resourceType, bytes: bytes.length, format: mimeType?.split('/')[1] || '' });
      })
      .catch(reject);
  });

// Return a PostgreSQL key or a signed URL for a legacy Cloudinary asset.
export const signedUrlFor = (publicId, resourceType = 'raw') => {
  if (resourceType === 'postgres') return publicId;
  if (!configured) throw new Error('Cloudinary is not configured.');
  return cloudinary.url(publicId, {
    resource_type: resourceType,
    type: 'authenticated',
    sign_url: true,
    secure: true,
  });
};

// Fetch an authenticated asset's bytes from Cloudinary and pipe them to the
// Express response, preserving the same inline-view behaviour the old
// Buffer-send path had. `mimeType`/`fileName` control the response headers.
export const streamAssetToResponse = async (
  response,
  { publicId, resourceType = 'raw', mimeType = 'application/octet-stream', fileName = 'file', disposition = 'inline' }
) => {
  const buffer = await fetchAssetBuffer(publicId, resourceType);
  response.setHeader('Content-Type', mimeType || 'application/octet-stream');
  response.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);
  response.send(buffer);
};

// Read file bytes from PostgreSQL first, then fall back to Cloudinary for
// legacy references that have not been imported.
export const fetchAssetBuffer = async (publicId, resourceType = 'raw') => {
  const key = `${resourceType}:${publicId}`;
  if (resourceType === 'postgres') {
    const result = await getPostgresPool().query(
      `SELECT data FROM public.cloudinary_assets
       WHERE public_id = $1 AND resource_type = 'postgres'
       ORDER BY imported_at DESC LIMIT 1`,
      [publicId]
    );
    if (!result.rowCount) throw new Error('File was not found in PostgreSQL storage.');
    const buffer = result.rows[0].data;
    setCachedAsset(key, buffer);
    return buffer;
  }

  const imported = await getPostgresPool().query(
    `SELECT data FROM public.cloudinary_assets
     WHERE public_id = $1 AND resource_type = $2
     ORDER BY imported_at DESC LIMIT 1`,
    [publicId, resourceType]
  );
  if (imported.rowCount) {
    const buffer = imported.rows[0].data;
    setCachedAsset(key, buffer);
    return buffer;
  }

  const cached = getCachedAsset(key);
  if (cached) return cached;
  if (!configured) throw new Error('Asset is not available in PostgreSQL storage.');

  const upstream = await fetch(signedUrlFor(publicId, resourceType));
  if (!upstream.ok) throw new Error(`Cloudinary fetch failed (${upstream.status}).`);

  const buffer = Buffer.from(await upstream.arrayBuffer());
  setCachedAsset(key, buffer);
  return buffer;
};

// Best-effort delete — never let a storage cleanup failure break the request.
export const deleteAsset = async (publicId, resourceType = 'raw') => {
  invalidateCachedAsset(`${resourceType}:${publicId}`);
  if (!publicId) return;
  if (resourceType === 'postgres') {
    await getPostgresPool().query(
      `DELETE FROM public.cloudinary_assets
       WHERE public_id = $1 AND resource_type = 'postgres'`,
      [publicId]
    );
    return;
  }
  if (!configured) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: 'authenticated', invalidate: true });
  } catch {
    // swallow — orphaned asset is harmless and can be cleaned later
  }
};

export default {
  isCloudinaryConfigured,
  isFileStorageConfigured,
  isFileStoredExternally,
  resourceTypeForMime,
  uploadBuffer,
  signedUrlFor,
  streamAssetToResponse,
  fetchAssetBuffer,
  deleteAsset,
};
