import { v2 as cloudinary } from 'cloudinary';

// ---------------------------------------------------------------------------
// Cloudinary file offload.
//
// The ERP historically stored every uploaded file (student/teacher documents,
// board results, assignment & event attachments, calendar files) as a raw
// `Buffer` inside MongoDB. That works but eats the small Atlas free-tier quota
// fast. This helper offloads the bytes to Cloudinary (25 GB free, no card) and
// keeps only a lightweight reference (publicId + resourceType) in Mongo.
//
// SECURITY: everything is uploaded with `type: 'authenticated'`, so the raw
// Cloudinary URL is NOT publicly guessable/openable. The plain URL is never
// handed to the browser — our own download routes keep enforcing auth and then
// stream the bytes from Cloudinary via a short-lived signed URL. The public
// API contract (GET .../:id streams the file) is therefore unchanged, so the
// web + mobile frontends need no edits.
//
// GRACEFUL FALLBACK: if no Cloudinary credentials are configured, every helper
// reports "not configured" and the callers transparently fall back to the old
// Mongo Buffer storage. Nothing breaks before the keys are added to the env.
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

// We store EVERY uploaded file as a Cloudinary 'raw' asset — including image
// scans (JPG/PNG). Cloudinary's 'image' pipeline re-encodes/optimizes images on
// upload, which silently changes the bytes and can degrade a scanned document
// (e.g. an Aadhaar/birth-certificate photo). 'raw' preserves the original file
// byte-for-byte, which is what a document store must do. Our own download route
// sets the correct Content-Type from the stored mimeType, so files still open
// and display normally in the browser/app.
export const resourceTypeForMime = () => 'raw';

// Upload a Buffer to Cloudinary as an authenticated (non-public) asset.
// Returns { publicId, resourceType, bytes, format } or throws.
export const uploadBuffer = (buffer, { folder = 'mgps', publicId, mimeType } = {}) =>
  new Promise((resolve, reject) => {
    if (!configured) {
      reject(new Error('Cloudinary is not configured.'));
      return;
    }

    const resourceType = resourceTypeForMime(mimeType);

    const stream = cloudinary.uploader.upload_stream(
      {
        folder,
        public_id: publicId,
        resource_type: resourceType,
        type: 'authenticated',
        overwrite: true,
        invalidate: true,
        use_filename: false,
        unique_filename: false,
      },
      (error, result) => {
        if (error || !result) {
          reject(error || new Error('Cloudinary upload failed.'));
          return;
        }
        resolve({
          publicId: result.public_id,
          resourceType: result.resource_type,
          bytes: result.bytes,
          format: result.format,
        });
      }
    );

    stream.end(buffer);
  });

// Build a short-lived signed URL for an authenticated asset (server-side use
// only — used to fetch the bytes back so we can stream them to the client).
export const signedUrlFor = (publicId, resourceType = 'raw') => {
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
  if (!configured) throw new Error('Cloudinary is not configured.');

  const url = signedUrlFor(publicId, resourceType);
  const upstream = await fetch(url);
  if (!upstream.ok || !upstream.body) {
    throw new Error(`Cloudinary fetch failed (${upstream.status}).`);
  }

  response.setHeader('Content-Type', mimeType || 'application/octet-stream');
  response.setHeader('Content-Disposition', `${disposition}; filename="${fileName}"`);

  const arrayBuffer = await upstream.arrayBuffer();
  response.send(Buffer.from(arrayBuffer));
};

// Best-effort delete — never let a storage cleanup failure break the request.
export const deleteAsset = async (publicId, resourceType = 'raw') => {
  if (!configured || !publicId) return;
  try {
    await cloudinary.uploader.destroy(publicId, { resource_type: resourceType, type: 'authenticated', invalidate: true });
  } catch {
    // swallow — orphaned asset is harmless and can be cleaned later
  }
};

export default {
  isCloudinaryConfigured,
  resourceTypeForMime,
  uploadBuffer,
  signedUrlFor,
  streamAssetToResponse,
  deleteAsset,
};
