import express from 'express';
import Application from '../models/Application.js';
import { isMongoConnected } from '../db.js';

const router = express.Router();
const CLASS_APPROVAL_THRESHOLD = 80;

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'MongoDB is not connected. Set MONGODB_URI and restart the API server.',
    });
    return;
  }

  next();
};

const getConsensusPercent = (application) => {
  if (application.audienceMode !== 'all-class' || !application.totalClassMembers) return 0;
  const accepted = application.votes.filter((vote) => vote.decision === 'in').length;
  return Math.round((accepted / application.totalClassMembers) * 100);
};

const normalizeApplication = (application) => ({
  id: application._id.toString(),
  title: application.title,
  category: application.category,
  kind: application.kind,
  message: application.message,
  senderRole: application.senderRole,
  senderName: application.senderName,
  senderUsername: application.senderUsername,
  senderIdentity: application.senderIdentity,
  className: application.className,
  audienceMode: application.audienceMode,
  targetClassName: application.targetClassName,
  totalClassMembers: application.totalClassMembers,
  votes: application.votes,
  status: application.status,
  adminReply: application.adminReply,
  adminActionBy: application.adminActionBy,
  adminActionAt: application.adminActionAt?.toISOString() || null,
  createdAt: application.createdAt?.toISOString(),
  updatedAt: application.updatedAt?.toISOString(),
  consensusPercent: getConsensusPercent(application),
});

const updateConsensusStatus = (application) => {
  if (application.audienceMode !== 'all-class' || application.status !== 'collecting_consensus') {
    return;
  }

  if (getConsensusPercent(application) >= CLASS_APPROVAL_THRESHOLD) {
    application.status = 'pending';
  }
};

router.get('/', ensureMongo, async (request, response) => {
  const { role, username, className } = request.query;
  const query = {};

  if (role === 'admin') {
    query.status = { $ne: 'collecting_consensus' };
  } else if (role === 'student') {
    query.$or = [
      { senderUsername: username },
      {
        audienceMode: 'all-class',
        status: 'collecting_consensus',
        targetClassName: className || '',
      },
    ];
  } else {
    query.senderUsername = username;
  }

  const applications = await Application.find(query).sort({ updatedAt: -1 });
  response.json(applications.map(normalizeApplication));
});

router.post('/', ensureMongo, async (request, response) => {
  const payload = request.body;
  const isClassRequest =
    payload.senderRole === 'student' &&
    payload.kind === 'request' &&
    payload.audienceMode === 'all-class';

  const initialVotes = isClassRequest
    ? [
        {
          username: payload.senderUsername,
          name: payload.senderName,
          decision: 'in',
        },
      ]
    : [];

  const application = await Application.create({
    title: payload.title,
    category: payload.category,
    kind: payload.kind,
    message: payload.message,
    senderRole: payload.senderRole,
    senderName: payload.senderName,
    senderUsername: payload.senderUsername,
    senderIdentity: payload.senderIdentity,
    className: payload.className,
    audienceMode: payload.audienceMode || 'individual',
    targetClassName: isClassRequest ? payload.targetClassName || payload.className : '',
    totalClassMembers: isClassRequest ? Number(payload.totalClassMembers) || 40 : 0,
    votes: initialVotes,
    status: isClassRequest ? 'collecting_consensus' : 'pending',
  });

  response.status(201).json(normalizeApplication(application));
});

router.patch('/:id/vote', ensureMongo, async (request, response) => {
  const { username, name, decision } = request.body;
  const application = await Application.findById(request.params.id);

  if (!application) {
    response.status(404).json({ message: 'Application not found.' });
    return;
  }

  if (application.status !== 'collecting_consensus') {
    response.status(409).json({ message: 'Class consensus has already closed.' });
    return;
  }

  application.votes = application.votes.filter((vote) => vote.username !== username);
  application.votes.push({ username, name, decision });
  updateConsensusStatus(application);
  await application.save();

  response.json(normalizeApplication(application));
});

router.patch('/:id/admin-action', ensureMongo, async (request, response) => {
  const { action, reply, adminUsername } = request.body;
  const application = await Application.findById(request.params.id);

  if (!application) {
    response.status(404).json({ message: 'Application not found.' });
    return;
  }

  if (!['approved', 'rejected', 'replied'].includes(action)) {
    response.status(400).json({ message: 'Invalid admin action.' });
    return;
  }

  application.status = action;
  application.adminReply = reply || '';
  application.adminActionBy = adminUsername || 'Admin';
  application.adminActionAt = new Date();
  await application.save();

  response.json(normalizeApplication(application));
});

export default router;
