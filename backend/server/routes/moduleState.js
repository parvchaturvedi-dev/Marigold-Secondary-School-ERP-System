import express from 'express';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { IDENTITY_SOURCE_NAMESPACES, syncIdentityUsersFromState } from '../utils/identity.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();

// Namespaces that carry personal data (Aadhaar, addresses, contacts, ledgers).
// Students must never be able to pull the whole-school roster or staff lists.
const STUDENT_BLOCKED_NAMESPACES = new Set([
  'admin-student-management-students',
  'admin-teacher-management-list',
  'admin-clerk-management-list',
  'admin-finance-class-ledgers',
  'admin-finance-alumni-pending',
  'admin-communication-messages',
]);

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

const guardSensitiveRead = (request, response, next) => {
  if (request.auth?.role === 'student' && STUDENT_BLOCKED_NAMESPACES.has(request.params.namespace)) {
    response.status(403).json({ message: 'You do not have permission to read this data.' });
    return;
  }

  next();
};

router.get('/:namespace', ensureMongo, guardSensitiveRead, async (request, response) => {
  const record = await ModuleState.findOne({ namespace: request.params.namespace });
  response.json({ value: record?.value ?? null });
});

// Master data is back-office state. Only admin/clerk may write it — a write to an
// identity namespace also triggers user provisioning (syncIdentityUsersFromState),
// so gating this closes the privilege-escalation / roster-corruption vectors.
router.put('/:namespace', ensureMongo, requireRole('admin', 'clerk'), async (request, response) => {
  const record = await ModuleState.findOneAndUpdate(
    { namespace: request.params.namespace },
    { value: request.body.value ?? null },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  if (IDENTITY_SOURCE_NAMESPACES.has(request.params.namespace)) {
    await syncIdentityUsersFromState();
  }

  emitRealtimeEvent(`mgps-erp-module-state:${request.params.namespace}`, record.value);
  response.json({ value: record.value });
});

export default router;
