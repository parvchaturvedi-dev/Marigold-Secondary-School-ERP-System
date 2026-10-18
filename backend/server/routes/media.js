import express from 'express';
import { createHash } from 'crypto';
import Event from '../models/Event.js';
import Assignment from '../models/Assignment.js';
import AcademicCalendar from '../models/AcademicCalendar.js';
import { isMongoConnected } from '../db.js';
import { verifyMediaToken } from '../utils/mediaToken.js';
import {
  fetchAssetBuffer,
  isFileStoredExternally,
  resourceTypeForMime,
} from '../utils/cloudinary.js';

// ---------------------------------------------------------------------------
// Media delivery.
//
// Event posters, assignment attachments and the academic-calendar file used to
// be inlined as base64 data URLs in their list responses, so every list load
// shipped every file — to every user, every time. These routes serve the bytes
// lazily instead: the list hands out a URL, the browser fetches it only when it
// renders the file, and then caches it.
//
// AUTH: mounted BEFORE the global Bearer-token guard, because an <img src> and
// a React Native <Image uri> cannot send an Authorization header. Instead each
// URL carries a short-lived token scoped to exactly one asset (see
// utils/mediaToken.js). It grants nothing beyond reading that one file.
// ---------------------------------------------------------------------------

const router = express.Router();

// A day in the browser cache; the token itself expires on the same horizon.
const CACHE_SECONDS = 24 * 60 * 60;

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({ message: 'Data service is not connected.' });
    return;
  }
  next();
};

// Send bytes with caching + conditional-request support so a repeat view costs
// nothing at all (304 Not Modified, empty body).
const sendFile = (request, response, { buffer, mimeType, fileName, disposition = 'inline' }) => {
  const etag = `"${createHash('sha1').update(buffer).digest('base64url')}"`;

  response.setHeader('ETag', etag);
  response.setHeader('Cache-Control', `private, max-age=${CACHE_SECONDS}, immutable`);
  response.setHeader('Content-Type', mimeType || 'application/octet-stream');
  response.setHeader('Content-Disposition', `${disposition}; filename="${fileName || 'file'}"`);

  if (request.headers['if-none-match'] === etag) {
    response.status(304).end();
    return;
  }

  response.send(buffer);
};

// Resolve the bytes of a record whose file is either offloaded to Cloudinary
// (fetched once, then memoised) or still inline in Mongo (legacy).
const resolveBytes = async (record, { bufferField }) => {
  if (isFileStoredExternally(record) && record.publicId) {
    return fetchAssetBuffer(record.publicId, record.resourceType || resourceTypeForMime(record.mimeType));
  }
  const inline = record[bufferField];
  return inline && inline.length ? inline : null;
};

const guard = (kind) => (request, response, next) => {
  if (!verifyMediaToken(kind, request.params.id, request.query.t)) {
    response.status(403).json({ message: 'This media link is invalid or has expired.' });
    return;
  }
  next();
};

// --- Event poster -----------------------------------------------------------
router.get('/event/:id', ensureMongo, guard('event'), async (request, response) => {
  const event = await Event.findById(request.params.id).select(
    'imageData imageName imageType storage publicId resourceType'
  );
  if (!event) {
    response.status(404).json({ message: 'Event image not found.' });
    return;
  }

  try {
    const buffer = await resolveBytes({ ...event.toObject(), mimeType: event.imageType }, { bufferField: 'imageData' });
    if (!buffer) {
      response.status(404).json({ message: 'Event image not found.' });
      return;
    }
    sendFile(request, response, {
      buffer,
      mimeType: event.imageType,
      fileName: event.imageName || 'event-image',
    });
  } catch {
    response.status(502).json({ message: 'Failed to load image from storage.' });
  }
});

// --- Assignment attachment --------------------------------------------------
router.get('/assignment/:id', ensureMongo, guard('assignment'), async (request, response) => {
  const assignment = await Assignment.findById(request.params.id).select('attachment');
  const attachment = assignment?.attachment;
  if (!attachment) {
    response.status(404).json({ message: 'Attachment not found.' });
    return;
  }

  try {
    const buffer = await resolveBytes(attachment, { bufferField: 'data' });
    if (!buffer) {
      response.status(404).json({ message: 'Attachment not found.' });
      return;
    }
    sendFile(request, response, {
      buffer,
      mimeType: attachment.mimeType,
      fileName: attachment.name || 'attachment',
    });
  } catch {
    response.status(502).json({ message: 'Failed to load attachment from storage.' });
  }
});

// --- Academic calendar file -------------------------------------------------
router.get('/calendar/:id', ensureMongo, guard('calendar'), async (request, response) => {
  const calendar = await AcademicCalendar.findById(request.params.id);
  if (!calendar) {
    response.status(404).json({ message: 'Calendar file not found.' });
    return;
  }

  try {
    const buffer = await resolveBytes(
      { ...calendar.toObject(), mimeType: calendar.type },
      { bufferField: 'fileData' }
    );
    if (!buffer) {
      response.status(404).json({ message: 'Calendar file not found.' });
      return;
    }
    sendFile(request, response, {
      buffer,
      mimeType: calendar.type,
      fileName: calendar.name || 'academic-calendar.pdf',
    });
  } catch {
    response.status(502).json({ message: 'Failed to load calendar from storage.' });
  }
});

export default router;
