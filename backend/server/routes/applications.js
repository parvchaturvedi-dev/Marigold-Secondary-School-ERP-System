import express from 'express';
import Application from '../models/Application.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent, isUserActiveOnErp } from '../realtime.js';
import { resolveDisplayName } from '../utils/nameLookup.js';
import { createNotification } from '../utils/notify.js';
import { requireRole } from '../middleware/auth.js';

const router = express.Router();
const CLASS_APPROVAL_THRESHOLD = 80;
const REPLY_EDIT_WINDOW_MS = 5 * 60 * 1000;

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
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

const normalizeApplication = async (application) => {
  // Resolve the sender to a human name server-side; prefer a stored real name,
  // otherwise look the username up so the UI never shows a raw role-id.
  const storedName = (application.senderName || '').trim();
  const authorName =
    storedName && storedName !== application.senderUsername
      ? storedName
      : await resolveDisplayName(application.senderUsername);

  return {
  id: application._id.toString(),
  title: application.title,
  category: application.category,
  kind: application.kind,
  message: application.message,
  senderRole: application.senderRole,
  senderName: application.senderName,
  authorName,
  senderUsername: application.senderUsername,
  senderIdentity: application.senderIdentity,
  senderIdentityId: application.senderIdentityId || '',
  className: application.className,
  audienceMode: application.audienceMode,
  targetClassName: application.targetClassName,
  totalClassMembers: application.totalClassMembers,
  votes: application.votes,
  status: application.status,
  adminReply: application.adminReply,
  adminActionBy: application.adminActionBy,
  adminActionAt: application.adminActionAt?.toISOString() || null,
  adminReplyEditedAt: application.adminReplyEditedAt?.toISOString() || null,
  adminReplyVersion: application.adminReplyVersion || 0,
  replyDeliveredAt: application.replyDeliveredAt?.toISOString() || null,
  replyRecipientActiveAt: application.replyRecipientActiveAt?.toISOString() || null,
  replyReadAt: application.replyReadAt?.toISOString() || null,
  replyReadVersion: application.replyReadVersion || 0,
  replyEditedAfterRead: Boolean(application.replyEditedAfterRead),
  createdAt: application.createdAt?.toISOString(),
  updatedAt: application.updatedAt?.toISOString(),
  consensusPercent: getConsensusPercent(application),
  };
};

const updateConsensusStatus = (application) => {
  if (application.audienceMode !== 'all-class' || application.status !== 'collecting_consensus') {
    return;
  }

  if (getConsensusPercent(application) >= CLASS_APPROVAL_THRESHOLD) {
    application.status = 'pending';
  }
};

router.get('/', ensureMongo, async (request, response) => {
  const { role, username, className, identityId } = request.query;
  const query = {};

  if (role === 'admin') {
    query.status = { $ne: 'collecting_consensus' };
  } else if (role === 'student') {
    const ownApplicationQuery = identityId
      ? {
          senderUsername: username,
          $or: [
            { senderIdentityId: identityId },
            { senderIdentityId: '' },
            { senderIdentityId: { $exists: false } },
          ],
        }
      : { senderUsername: username };

    query.$or = [
      ownApplicationQuery,
      {
        audienceMode: 'all-class',
        status: 'collecting_consensus',
        targetClassName: className || '',
      },
    ];
  } else {
    query.senderUsername = username;
  }

  let applications = await Application.find(query).sort({ updatedAt: -1 });

  if (role !== 'admin' && username) {
    const now = new Date();
    const replyApplications = applications.filter((application) => application.adminReply);

    await Promise.all(
      replyApplications.map(async (application) => {
        let changed = false;

        if (!application.replyDeliveredAt) {
          application.replyDeliveredAt = now;
          changed = true;
        }

        if (isUserActiveOnErp(username)) {
          application.replyRecipientActiveAt = now;
          changed = true;
        }

        if (changed) await application.save();
      })
    );

    applications = await Application.find(query).sort({ updatedAt: -1 });
  }

  response.json(await Promise.all(applications.map(normalizeApplication)));
});

router.post('/', ensureMongo, async (request, response) => {
  // Force sender identity from auth session; ignore client-supplied fields.
  request.body.senderUsername = request.auth.username;
  request.body.senderRole = request.auth.role;
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
    senderIdentityId: payload.senderIdentityId || '',
    className: payload.className,
    audienceMode: payload.audienceMode || 'individual',
    targetClassName: isClassRequest ? payload.targetClassName || payload.className : '',
    totalClassMembers: isClassRequest ? Number(payload.totalClassMembers) || 40 : 0,
    votes: initialVotes,
    status: isClassRequest ? 'collecting_consensus' : 'pending',
  });

  emitRealtimeEvent('mgps-erp-applications-updated');
  response.status(201).json(await normalizeApplication(application));
});

router.patch('/:id/vote', ensureMongo, async (request, response) => {
  // Vote must be under the authenticated user's identity — no ballot stuffing.
  request.body.username = request.auth.username;
  request.body.name = request.auth.displayName || request.auth.username;
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

  emitRealtimeEvent('mgps-erp-applications-updated');
  response.json(await normalizeApplication(application));
});

router.patch('/:id/admin-action', ensureMongo, requireRole('admin', 'clerk'), async (request, response) => {
  request.body.adminUsername = request.auth.username;
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

  const hadReply = Boolean(application.adminReply);
  const wasRead = Boolean(application.replyReadAt);
  const lastReplyActionAt = application.adminReplyEditedAt || application.adminActionAt;

  if (hadReply && lastReplyActionAt) {
    const editWindowClosed = Date.now() - new Date(lastReplyActionAt).getTime() > REPLY_EDIT_WINDOW_MS;
    if (editWindowClosed) {
      response.status(409).json({ message: 'Reply can only be edited for five minutes after sending.' });
      return;
    }
  }

  application.status = action;
  application.adminReply = reply || '';
  application.adminActionBy = adminUsername || 'Admin';
  application.adminReplyVersion = (application.adminReplyVersion || 0) + 1;

  if (hadReply) {
    application.adminReplyEditedAt = new Date();
    application.replyEditedAfterRead = wasRead;
  } else {
    application.adminActionAt = new Date();
    application.adminReplyEditedAt = null;
    application.replyEditedAfterRead = false;
  }

  application.replyDeliveredAt = null;
  application.replyRecipientActiveAt = null;
  application.replyReadAt = null;
  application.replyReadVersion = 0;
  await application.save();

  emitRealtimeEvent('mgps-erp-applications-updated');

  // Notify the applicant (only them) about the admin decision.
  if (application.senderUsername) {
    const verbMap = { approved: 'approved', rejected: 'rejected', replied: 'replied to' };
    createNotification({
      title: `Application ${action}`,
      description: `Your application "${application.title || 'Application'}" was ${verbMap[action]}${reply ? `: ${reply}` : ''}.`,
      type: 'application',
      linkPage: 'Application',
      recipientUsername: application.senderUsername,
    }).catch(() => {});
  }

  response.json(await normalizeApplication(application));
});

router.patch('/:id/reply-read', ensureMongo, async (request, response) => {
  const application = await Application.findById(request.params.id);

  if (!application) {
    response.status(404).json({ message: 'Application not found.' });
    return;
  }

  if (!application.adminReply) {
    response.status(409).json({ message: 'No admin reply to mark as read.' });
    return;
  }

  const username = request.session?.auth?.username || request.body?.username;
  if (username && username !== application.senderUsername) {
    response.status(403).json({ message: 'Only the application recipient can mark this reply as read.' });
    return;
  }

  const now = new Date();
  application.replyDeliveredAt = application.replyDeliveredAt || now;
  application.replyRecipientActiveAt = application.replyRecipientActiveAt || now;
  application.replyReadAt = now;
  application.replyReadVersion = application.adminReplyVersion || 1;
  application.replyEditedAfterRead = false;
  await application.save();

  emitRealtimeEvent('mgps-erp-applications-updated', {
    applicationId: application._id.toString(),
    eventType: 'reply-read',
  });
  response.json(await normalizeApplication(application));
});

export default router;
