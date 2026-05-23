import express from 'express';
import ExaminationState from '../models/ExaminationState.js';
import { isMongoConnected } from '../db.js';

const router = express.Router();

const EMPTY_EXAMINATION_STATE = {
  exams: [],
  papers: [],
  schedules: [],
  marks: [],
  deliveries: [],
};

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'MongoDB is not connected. Set MONGODB_URI and restart the API server.',
    });
    return;
  }

  next();
};

const normalizeState = (state = {}) => ({
  exams: Array.isArray(state.exams) ? state.exams : [],
  papers: Array.isArray(state.papers) ? state.papers : [],
  schedules: Array.isArray(state.schedules) ? state.schedules : [],
  marks: Array.isArray(state.marks) ? state.marks : [],
  deliveries: Array.isArray(state.deliveries) ? state.deliveries : [],
});

router.get('/state', ensureMongo, async (_request, response) => {
  const record = await ExaminationState.findOne().sort({ updatedAt: -1 });
  response.json(record ? normalizeState(record.state) : EMPTY_EXAMINATION_STATE);
});

router.put('/state', ensureMongo, async (request, response) => {
  const nextState = normalizeState(request.body.state);
  const record = await ExaminationState.findOneAndUpdate(
    {},
    {
      state: nextState,
      updatedBy: request.body.updatedBy || '',
    },
    {
      upsert: true,
      new: true,
      setDefaultsOnInsert: true,
    }
  );

  response.json(normalizeState(record.state));
});

export default router;
