import express from 'express';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { emitRealtimeEvent } from '../realtime.js';

// Notices are stored as a single ModuleState array. Unlike events (which expire
// five days after they happen) a notice stays relevant for the whole academic
// year, so it is only cleared when the session rolls over — the same moment the
// assignment board is reset.
const NOTICE_NAMESPACE = 'admin-notices-list';

const router = express.Router();

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

// Session promotion clears the notice board: the new session starts fresh.
router.post('/reset', ensureMongo, requireRole('admin', 'clerk'), async (_request, response) => {
  const existing = await ModuleState.findOne({ namespace: NOTICE_NAMESPACE }).select('value');
  const cleared = Array.isArray(existing?.value) ? existing.value.length : 0;

  await ModuleState.findOneAndUpdate(
    { namespace: NOTICE_NAMESPACE },
    { namespace: NOTICE_NAMESPACE, value: [] },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  emitRealtimeEvent(`mgps-erp-module-state:${NOTICE_NAMESPACE}`, []);
  response.json({ cleared });
});

export default router;
