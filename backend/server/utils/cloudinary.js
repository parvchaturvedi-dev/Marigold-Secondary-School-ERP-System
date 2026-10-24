import { v2 as cloudinary } from 'cloudinary';
import { createHash, randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { getPostgresPool, isDatabaseConnected } from '../db.js';
import { getCachedAsset, setCachedAsset, invalidateCachedAsset } from './assetCache.js';

// ---------------------------------------------------------------------------
// PostgreSQL-backed file storage with Cloudinary support for legacy assets.
//
// New uploads and imported legacy assets are stored in PostgreSQL. Existing
// Cloudinary references fall back to Cloudinary only if they are not imported.
// ---------------------------------------------------------------------------

let configured = false;
const moduleDirectory = dirname(fileURLToPath(import.meta.url));

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
  ['cloudinary', 'local', 'postgres'].includes(record?.storage);

const localStorageRoot = () =>
  resolve(process.env.FILE_STORAGE_DIR || resolve(moduleDirectory, '../../uploads'));

const localStoragePath = (publicId) => {
  const fileKey = createHash('sha256').update(String(publicId)).digest('hex');
  return resolve(localStorageRoot(), fileKey.slice(0, 2), fileKey);
};

// Preserve uploaded bytes regardless of MIME type; the download route sets
// the correct response content type from the stored metadata.
export const resourceTypeForMime = () => 'raw';

// Store new file bytes on the server's persistent local disk, not in PostgreSQL.
// Returns { publicId, resourceType, bytes, format, storage } or throws.
export const uploadBuffer = async (buffer, { folder = 'mgps', publicId, mimeType } = {}) => {
  const bytes = Buffer.from(buffer);
  const id = publicId || randomUUID();

  if (process.env.FILE_STORAGE_DRIVER !== 'local' && configured) {
    const result = await new Promise((resolveUpload, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        {
          folder,
          public_id: id,
          resource_type: 'raw',
          type: 'authenticated',
          overwrite: true,
          invalidate: true,
        },
        (error, uploaded) => {
          if (error) {
            reject(error);
            return;
          }
          if (!uploaded?.public_id) {
            reject(new Error('Cloudinary did not return an asset identifier.'));
            return;
          }
          resolveUpload(uploaded);
        }
      );
      Readable.from([bytes]).pipe(stream);
    });

    invalidateCachedAsset(`raw:${result.public_id}`);
    return {
      publicId: result.public_id,
      resourceType: 'raw',
      bytes: result.bytes ?? bytes.length,
      format: result.format || mimeType?.split('/')[1] || '',
      storage: 'cloudinary',
    };
  }

  const destination = localStoragePath(id);
  const temporary = `${destination}.${randomUUID()}.tmp`;
  await mkdir(dirname(destination), { recursive: true });
  try {
    await writeFile(temporary, bytes, { flag: 'wx', mode: 0o600 });
    await rename(temporary, destination);
  } catch (error) {
    await rm(temporary, { force: true });
    throw error;
  }

  invalidateCachedAsset(`local:${id}`);
  return {
    publicId: id,
    resourceType: 'local',
    bytes: bytes.length,
    format: mimeType?.split('/')[1] || '',
    storage: 'local',
  };
};

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

// Read local assets from disk and retain support for legacy PostgreSQL and
// Cloudinary references.
export const fetchAssetBuffer = async (publicId, resourceType = 'raw') => {
  const key = `${resourceType}:${publicId}`;
  if (resourceType === 'local') {
    const cached = getCachedAsset(key);
    if (cached) return cached;
    const buffer = await readFile(localStoragePath(publicId));
    setCachedAsset(key, buffer);
    return buffer;
  }

  if (resourceType === 'postgres') {
    const result = await getPostgresPool().query(
      `SELECT data FROM public.cloudinary_assets
       WHERE public_id = $1 AND resource_type = 'postgres'
       ORDER BY imported_at DESC LIMIT 1`,
      [publicId]
    );
    if (result.rowCount && result.rows[0].data?.length) {
      const buffer = result.rows[0].data;
      setCachedAsset(key, buffer);
      return buffer;
    }
    if (!configured) throw new Error('File was not found in PostgreSQL storage or Cloudinary.');

    const upstream = await fetch(signedUrlFor(publicId, 'raw'));
    if (!upstream.ok) throw new Error(`Cloudinary fetch failed (${upstream.status}).`);

    const buffer = Buffer.from(await upstream.arrayBuffer());
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
  if (resourceType === 'local') {
    await rm(localStoragePath(publicId), { force: true });
    return;
  }

  if (resourceType === 'postgres') {
    const result = await getPostgresPool().query(
      `DELETE FROM public.cloudinary_assets
       WHERE public_id = $1 AND resource_type = 'postgres'
       RETURNING asset_id, octet_length(data) AS stored_bytes`,
      [publicId]
    );
    if ((!result.rowCount || Number(result.rows[0].stored_bytes) === 0) && configured) {
      try {
        await cloudinary.uploader.destroy(publicId, {
          resource_type: 'raw',
          type: 'authenticated',
          invalidate: true,
        });
      } catch {
        // Cleanup is best-effort; an orphaned asset can be removed later.
      }
    }
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
