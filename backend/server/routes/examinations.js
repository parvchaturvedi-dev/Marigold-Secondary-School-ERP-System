import express from 'express';
import multer from 'multer';
import ExaminationState from '../models/ExaminationState.js';
import BoardResultFile from '../models/BoardResultFile.js';
import { isMongoConnected } from '../db.js';
import { emitRealtimeEvent } from '../realtime.js';
import { requireRole } from '../middleware/auth.js';
import { createNotification } from '../utils/notify.js';

const router = express.Router();

// Buffer PDF uploads in memory (cap 10 MB; application/pdf enforced below).
const boardResultUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Emit both realtime event names so existing web listeners
// (mgps-erp-examination-updated) keep working alongside the
// new workflow event (mgps-erp-examinations-updated).
const broadcastExaminationsUpdated = () => {
  emitRealtimeEvent('mgps-erp-examinations-updated');
  emitRealtimeEvent('mgps-erp-examination-updated');
};

const nowIso = () => new Date().toISOString();

const EMPTY_EXAMINATION_STATE = {
  exams: [],
  papers: [],
  schedules: [],
  marks: [],
  deliveries: [],
  boardClasses: [],
  boardResults: [],
};

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
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
  boardClasses: Array.isArray(state.boardClasses) ? state.boardClasses : [],
  boardResults: Array.isArray(state.boardResults) ? state.boardResults : [],
});

router.get('/state', ensureMongo, async (_request, response) => {
  const record = await ExaminationState.findOne().sort({ updatedAt: -1 });
  response.json(record ? normalizeState(record.state) : EMPTY_EXAMINATION_STATE);
});

router.put('/state', ensureMongo, requireRole('admin', 'clerk', 'teacher'), async (request, response) => {
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

  emitRealtimeEvent('mgps-erp-examination-updated');
  response.json(normalizeState(record.state));
});

// -----------------------------------------------------------------------------
// Paper approval workflow
//
// State machine (in-place on state.papers[i].status):
//   draft ─── submit-for-approval ──▶ pending_admin
//   pending_admin ── admin-decision ─▶ approved | rejected
//
// Both routes read the singleton ExaminationState doc, mutate the matching
// paper by id, mark the mixed `state` field dirty, save, and broadcast
// mgps-erp-examinations-updated so web + mobile clients refetch.
// -----------------------------------------------------------------------------

// Locate the singleton state doc + the paper we're mutating. Returns
// { record, paper, index } — or sends 404/500 and returns null.
const loadPaper = async (paperId, response) => {
  const record = await ExaminationState.findOne().sort({ updatedAt: -1 });
  if (!record) {
    response.status(404).json({ message: 'Examination state is not initialised yet.' });
    return null;
  }

  const state = normalizeState(record.state);
  const index = state.papers.findIndex((paper) => paper && paper.id === paperId);
  if (index === -1) {
    response.status(404).json({ message: 'Paper not found.' });
    return null;
  }

  // Normalise onto the record so mutations write back to the actual doc.
  record.state = state;
  return { record, paper: state.papers[index], index };
};

router.patch(
  '/papers/:id/submit-for-approval',
  ensureMongo,
  requireRole('teacher', 'admin', 'clerk'),
  async (request, response) => {
    const paperId = request.params.id;
    const loaded = await loadPaper(paperId, response);
    if (!loaded) return;

    const { record, paper, index } = loaded;
    if (paper.status !== 'draft') {
      response
        .status(409)
        .json({ message: `Paper cannot be submitted from status "${paper.status}".` });
      return;
    }

    const actorName = request.auth?.displayName || request.auth?.username || 'Teacher';
    const timestamp = nowIso();
    const nextPaper = {
      ...paper,
      status: 'pending_admin',
      teacherApprovedAt: timestamp,
      updatedAt: timestamp,
      comments: [
        ...(Array.isArray(paper.comments) ? paper.comments : []),
        {
          id: `CMT-${Date.now()}`,
          role: request.auth?.role || 'teacher',
          actorName,
          action: 'Submitted for approval',
          comment: '',
          createdAt: timestamp,
        },
      ],
    };

    record.state.papers[index] = nextPaper;
    record.updatedBy = request.auth?.username || record.updatedBy || '';
    record.markModified('state');
    await record.save();

    broadcastExaminationsUpdated();

    // Notify all admins that a paper is awaiting review.
    try {
      await createNotification({
        title: 'Paper awaiting approval',
        description: `${actorName} submitted "${nextPaper.title}" for admin approval.`,
        type: 'examination',
        linkPage: 'Paper Analysis',
        recipientRole: 'admin',
      });
    } catch (error) {
      console.error('[examinations] admin notify failed:', error?.message || error);
    }

    response.json({ paper: nextPaper, state: normalizeState(record.state) });
  }
);

router.patch(
  '/papers/:id/admin-decision',
  ensureMongo,
  requireRole('admin'),
  async (request, response) => {
    const paperId = request.params.id;
    const decisionRaw = String(request.body?.decision || '').toLowerCase();
    const comment = String(request.body?.comment || '').trim();

    if (!['approved', 'rejected'].includes(decisionRaw)) {
      response.status(400).json({ message: 'decision must be "approved" or "rejected".' });
      return;
    }
    if (decisionRaw === 'rejected' && !comment) {
      response.status(400).json({ message: 'A comment is required when rejecting a paper.' });
      return;
    }

    const loaded = await loadPaper(paperId, response);
    if (!loaded) return;

    const { record, paper, index } = loaded;
    if (paper.status !== 'pending_admin') {
      response.status(409).json({
        message: `Only papers in "pending_admin" can be decided (current: "${paper.status}").`,
      });
      return;
    }

    const actorName = request.auth?.displayName || request.auth?.username || 'Admin';
    const timestamp = nowIso();
    const nextPaper = {
      ...paper,
      status: decisionRaw,
      adminApprovedAt: timestamp,
      updatedAt: timestamp,
      comments: [
        ...(Array.isArray(paper.comments) ? paper.comments : []),
        {
          id: `CMT-${Date.now()}`,
          role: request.auth?.role || 'admin',
          actorName,
          action: decisionRaw === 'approved' ? 'Admin Approved' : 'Admin Rejected',
          comment,
          createdAt: timestamp,
        },
      ],
    };

    record.state.papers[index] = nextPaper;
    record.updatedBy = request.auth?.username || record.updatedBy || '';
    record.markModified('state');
    await record.save();

    broadcastExaminationsUpdated();

    // Notify the teacher who owns the paper about the decision.
    const teacherUsername = paper.teacherUsername || paper.createdByUsername || '';
    if (teacherUsername) {
      try {
        const verb = decisionRaw === 'approved' ? 'approved' : 'rejected';
        const suffix = comment ? `: ${comment}` : '.';
        await createNotification({
          title: `Paper ${verb}`,
          description: `Your paper "${nextPaper.title}" was ${verb}${suffix}`,
          type: 'examination',
          linkPage: 'Paper Analysis',
          recipientUsername: teacherUsername,
        });
      } catch (error) {
        console.error('[examinations] teacher notify failed:', error?.message || error);
      }
    }

    response.json({ paper: nextPaper, state: normalizeState(record.state) });
  }
);

// -----------------------------------------------------------------------------
// Board Result PDFs
// -----------------------------------------------------------------------------
// Metadata (id, className, examTitle, publishedAt, uploader, pdf name/type/size)
// lives inside ExaminationState.state.boardResults[]; the PDF binary lives in
// its own BoardResultFile document keyed by that metadata id. Same two-doc
// pattern the academic calendar uses.

// Load the singleton state doc, creating an empty one on first write so the
// upload flow never 404s. Both POST and DELETE go through this so they stay
// in sync with GET /state.
const loadExaminationRecord = async () => {
  const existing = await ExaminationState.findOne().sort({ updatedAt: -1 });
  if (existing) return existing;
  return ExaminationState.create({ state: EMPTY_EXAMINATION_STATE });
};

router.post(
  '/board-results',
  ensureMongo,
  requireRole('admin', 'clerk'),
  boardResultUpload.single('resultPdf'),
  async (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: 'PDF file is required.' });
      return;
    }

    const isPdf =
      file.mimetype === 'application/pdf' ||
      file.originalname.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      response.status(400).json({ message: 'Only PDF files are allowed.' });
      return;
    }

    const className = String(request.body.className || '').trim();
    const examTitle = String(request.body.examTitle || '').trim();
    if (!className) {
      response.status(400).json({ message: 'className is required.' });
      return;
    }
    if (!examTitle) {
      response.status(400).json({ message: 'examTitle is required.' });
      return;
    }

    const publishedAt =
      String(request.body.publishedAt || '').trim() || nowIso();
    const uploaderUsername =
      request.auth?.username || request.body.uploadedByUsername || 'admin';

    const record = await loadExaminationRecord();
    const state = normalizeState(record.state);

    const resultId = `BR-${Date.now()}`;
    const metadata = {
      id: resultId,
      className,
      examTitle,
      publishedAt,
      uploadedByUsername: uploaderUsername,
      pdfName: file.originalname || 'board-result.pdf',
      pdfType: file.mimetype || 'application/pdf',
      pdfSize: file.size,
    };

    await BoardResultFile.create({
      resultId,
      name: metadata.pdfName,
      size: metadata.pdfSize,
      type: metadata.pdfType,
      fileData: file.buffer,
      uploadedBy: uploaderUsername,
    });

    state.boardResults = [metadata, ...state.boardResults];
    record.state = state;
    record.updatedBy = uploaderUsername;
    record.markModified('state');
    await record.save();

    broadcastExaminationsUpdated();

    // Notify all students in the target class. Failures are swallowed so a
    // notification hiccup never blocks the upload response.
    try {
      await createNotification({
        title: `Board result for ${className} is published`,
        description: `Board result for ${className} is published — ${examTitle}`,
        type: 'examination',
        linkPage: 'Examinations',
        recipientRole: 'student',
        recipientClassName: className,
      });
    } catch (error) {
      console.error(
        '[examinations:board-results] notification failed:',
        error?.message || error
      );
    }

    response.status(201).json(metadata);
  }
);

// Any authenticated user can pull a published PDF. Returned as a data URL so
// the same shape works for web (open in new tab) and mobile (base64 → file).
router.get('/board-results/:id/pdf', ensureMongo, async (request, response) => {
  const file = await BoardResultFile.findOne({ resultId: request.params.id });
  if (!file) {
    response.status(404).json({ message: 'Board result PDF not found.' });
    return;
  }

  response.json({
    id: file.resultId,
    name: file.name,
    type: file.type,
    size: file.size,
    dataUrl: `data:${file.type};base64,${file.fileData.toString('base64')}`,
  });
});

router.delete(
  '/board-results/:id',
  ensureMongo,
  requireRole('admin'),
  async (request, response) => {
    const record = await ExaminationState.findOne().sort({ updatedAt: -1 });
    if (!record) {
      response.status(404).json({ message: 'Board result not found.' });
      return;
    }

    const state = normalizeState(record.state);
    const before = state.boardResults.length;
    state.boardResults = state.boardResults.filter(
      (item) => item.id !== request.params.id
    );

    if (state.boardResults.length === before) {
      // Metadata already gone. Drop any orphaned file doc so the store
      // stays consistent, then 404.
      await BoardResultFile.deleteOne({ resultId: request.params.id });
      response.status(404).json({ message: 'Board result not found.' });
      return;
    }

    record.state = state;
    record.updatedBy = request.auth?.username || 'admin';
    record.markModified('state');
    await record.save();

    await BoardResultFile.deleteOne({ resultId: request.params.id });

    broadcastExaminationsUpdated();
    response.json({ message: 'Board result removed.' });
  }
);

export default router;
