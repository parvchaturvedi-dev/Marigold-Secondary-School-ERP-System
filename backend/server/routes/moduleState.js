import express from 'express';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { IDENTITY_SOURCE_NAMESPACES, syncIdentityUsersFromState } from '../utils/identity.js';

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

router.get('/:namespace', ensureMongo, async (request, response) => {
  const record = await ModuleState.findOne({ namespace: request.params.namespace });
  response.json({ value: record?.value ?? null });
});

router.put('/:namespace', ensureMongo, async (request, response) => {
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
