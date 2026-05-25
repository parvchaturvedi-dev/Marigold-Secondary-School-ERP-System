import express from 'express';
import VaultItem from '../models/VaultItem.js';

const router = express.Router();

const MAX_PDFS = 5;
const MAX_IMAGES = 5;
const MAX_NOTES = 20;
const STORAGE_LIMIT_BYTES = 8 * 1024 * 1024;
const MAX_SINGLE_ITEM_BYTES = 2 * 1024 * 1024;
const allowedKinds = new Set(['note', 'pdf', 'image']);

const getOwner = (request) => String(request.auth?.username || '').trim().toUpperCase();

const buildUsage = async (ownerUsername) => {
  const items = await VaultItem.find({ ownerUsername }).select('kind sizeBytes').lean();
  const usage = items.reduce(
    (summary, item) => {
      summary.totalItems += 1;
      summary.totalBytes += Number(item.sizeBytes || 0);
      summary.counts[item.kind] = (summary.counts[item.kind] || 0) + 1;
      return summary;
    },
    {
      totalItems: 0,
      totalBytes: 0,
      storageLimitBytes: STORAGE_LIMIT_BYTES,
      maxPdfs: MAX_PDFS,
      maxImages: MAX_IMAGES,
      maxNotes: MAX_NOTES,
      counts: {
        note: 0,
        pdf: 0,
        image: 0,
      },
    }
  );

  return usage;
};

const toVaultItem = (item) => ({
  id: item._id.toString(),
  kind: item.kind,
  title: item.title,
  encryptedPayload: item.encryptedPayload,
  encryption: item.encryption,
  originalName: item.originalName,
  mimeType: item.mimeType,
  sizeBytes: item.sizeBytes,
  createdAt: item.createdAt,
  updatedAt: item.updatedAt,
});

const validatePayload = (body = {}) => {
  const kind = String(body.kind || '').trim();
  const title = String(body.title || '').trim();
  const encryptedPayload = String(body.encryptedPayload || '').trim();
  const encryption = body.encryption || {};
  const sizeBytes = Number(body.sizeBytes || 0);

  if (!allowedKinds.has(kind)) return 'Invalid vault item type.';
  if (!title) return 'Title is required.';
  if (!encryptedPayload) return 'Encrypted payload is required.';
  if (!encryption.salt || !encryption.iv) return 'Encryption salt and IV are required.';
  if (!Number.isFinite(sizeBytes) || sizeBytes < 0) return 'Invalid item size.';
  if (sizeBytes > MAX_SINGLE_ITEM_BYTES) return 'A single vault item cannot exceed 2 MB.';
  if (kind === 'pdf' && body.mimeType !== 'application/pdf') return 'Only PDF files are allowed in PDF slots.';
  if (kind === 'image' && !String(body.mimeType || '').startsWith('image/')) {
    return 'Only image files are allowed in image slots.';
  }

  return '';
};

router.get('/', async (request, response) => {
  const ownerUsername = getOwner(request);
  const items = await VaultItem.find({ ownerUsername }).sort({ updatedAt: -1 }).lean();
  response.json({
    items: items.map(toVaultItem),
    usage: await buildUsage(ownerUsername),
  });
});

router.post('/', async (request, response) => {
  const validationError = validatePayload(request.body);
  if (validationError) {
    response.status(400).json({ message: validationError });
    return;
  }

  const ownerUsername = getOwner(request);
  const usage = await buildUsage(ownerUsername);
  const nextBytes = usage.totalBytes + Number(request.body.sizeBytes || 0);

  if (request.body.kind === 'pdf' && usage.counts.pdf >= MAX_PDFS) {
    response.status(400).json({ message: 'PDF vault limit reached. Maximum 5 PDFs are allowed.' });
    return;
  }

  if (request.body.kind === 'image' && usage.counts.image >= MAX_IMAGES) {
    response.status(400).json({ message: 'Image vault limit reached. Maximum 5 images are allowed.' });
    return;
  }

  if (request.body.kind === 'note' && usage.counts.note >= MAX_NOTES) {
    response.status(400).json({ message: 'Notes vault limit reached. Maximum 20 notes are allowed.' });
    return;
  }

  if (nextBytes > STORAGE_LIMIT_BYTES) {
    response.status(400).json({ message: 'Vault storage limit reached.' });
    return;
  }

  const item = await VaultItem.create({
    ownerUsername,
    kind: request.body.kind,
    title: request.body.title,
    encryptedPayload: request.body.encryptedPayload,
    encryption: {
      algorithm: request.body.encryption.algorithm || 'AES-GCM',
      kdf: request.body.encryption.kdf || 'PBKDF2-SHA256',
      iterations: Number(request.body.encryption.iterations || 210000),
      salt: request.body.encryption.salt,
      iv: request.body.encryption.iv,
    },
    originalName: String(request.body.originalName || '').trim(),
    mimeType: String(request.body.mimeType || '').trim(),
    sizeBytes: Number(request.body.sizeBytes || 0),
  });

  response.status(201).json({
    item: toVaultItem(item),
    usage: await buildUsage(ownerUsername),
  });
});

router.delete('/:id', async (request, response) => {
  const ownerUsername = getOwner(request);
  const deleted = await VaultItem.findOneAndDelete({
    _id: request.params.id,
    ownerUsername,
  }).lean();

  if (!deleted) {
    response.status(404).json({ message: 'Vault item not found.' });
    return;
  }

  response.json({
    message: 'Vault item deleted.',
    usage: await buildUsage(ownerUsername),
  });
});

export default router;
