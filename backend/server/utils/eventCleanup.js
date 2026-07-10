import Event from '../models/Event.js';
import { deleteAsset } from './cloudinary.js';
import { emitRealtimeEvent } from '../realtime.js';
import { isMongoConnected } from '../db.js';

// ---------------------------------------------------------------------------
// Automatic event retention.
//
// An event is transient: once it has happened, it stops being useful and just
// consumes database space (and a Cloudinary image). Five days after the event
// finishes we delete it — poster image included — so nothing is orphaned.
//
//   Event on 4 Jan  ->  removed on 9 Jan.
//
// Notices and assignments are deliberately NOT time-expired here: they carry
// value for the whole academic year and are cleared on session change instead
// (POST /api/assignments/reset and POST /api/notices/reset).
// ---------------------------------------------------------------------------

export const EVENT_RETENTION_DAYS = 5;

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Local-date key (never toISOString(), which shifts the day in IST).
const dateKey = (date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

// The day the event actually finishes. A multi-day event ends on toDate; a
// single-day event on date. Falls back across the fields so a partially filled
// record still resolves sensibly.
export const eventEndKey = (event) => {
  const end =
    event?.durationType === 'multiple'
      ? event.toDate || event.fromDate || event.date
      : event.date || event.toDate || event.fromDate;
  const value = String(end || '').trim();
  return DATE_KEY.test(value) ? value : '';
};

// Delete every event that finished more than EVENT_RETENTION_DAYS ago.
// An event with a missing/malformed date is NEVER deleted — we would rather
// keep a stray record than destroy one we could not date confidently.
export const cleanupExpiredEvents = async () => {
  if (!isMongoConnected()) return { deleted: 0, skipped: 0 };

  const cutoff = new Date();
  cutoff.setHours(0, 0, 0, 0);
  cutoff.setDate(cutoff.getDate() - EVENT_RETENTION_DAYS);
  const cutoffKey = dateKey(cutoff);

  const events = await Event.find({}).select('durationType date fromDate toDate storage publicId resourceType');

  let deleted = 0;
  let skipped = 0;

  for (const event of events) {
    const endKey = eventEndKey(event);
    if (!endKey) {
      skipped += 1;
      continue;
    }
    // 'YYYY-MM-DD' strings compare correctly with <=.
    if (endKey > cutoffKey) continue;

    if (event.storage === 'cloudinary' && event.publicId) {
      await deleteAsset(event.publicId, event.resourceType || 'raw');
    }
    await Event.deleteOne({ _id: event._id });
    deleted += 1;
  }

  if (deleted > 0) {
    emitRealtimeEvent('mgps-erp-events-updated');
    console.log(`[eventCleanup] removed ${deleted} expired event(s) (older than ${EVENT_RETENTION_DAYS} days).`);
  }

  return { deleted, skipped };
};

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Run once at boot, then daily. Failures are logged, never fatal.
export const scheduleEventCleanup = () => {
  const run = () => {
    cleanupExpiredEvents().catch((error) => {
      console.error('[eventCleanup] failed:', error?.message || error);
    });
  };

  run();
  const timer = setInterval(run, ONE_DAY_MS);
  timer.unref?.();
  return timer;
};
