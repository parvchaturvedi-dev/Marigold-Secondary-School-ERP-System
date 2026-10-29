import express from 'express';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent, realtimeRoleRoom } from '../realtime.js';
import { IDENTITY_SOURCE_NAMESPACES, syncIdentityUsersFromState } from '../utils/identity.js';
import {
  filterModuleStateValue,
  getModuleStateReadableRoles,
} from '../utils/moduleStateAccess.js';
import { requireRole } from '../middleware/auth.js';

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

const guardSensitiveRead = (request, response, next) => {
  if (!getModuleStateReadableRoles(request.params.namespace).includes(request.auth?.role)) {
    response.status(403).json({ message: 'You do not have permission to read this data.' });
    return;
  }

  next();
};

router.get('/:namespace', ensureMongo, guardSensitiveRead, async (request, response) => {
  const record = await ModuleState.findOne({ namespace: request.params.namespace });
  response.json({
    value: filterModuleStateValue(
      request.auth?.role,
      request.params.namespace,
      record?.value ?? null,
      request.auth
    ),
  });
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

  const roles = getModuleStateReadableRoles(request.params.namespace);
  emitRealtimeEvent(
    `mgps-erp-module-state:${request.params.namespace}`,
    { __moduleStateInvalidation: true },
    roles.map(realtimeRoleRoom)
  );
  response.json({ value: record.value });
});

export default router;
