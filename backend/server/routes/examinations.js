import express from 'express';
import multer from 'multer';
import ExaminationState from '../models/ExaminationState.js';
import BoardResultFile from '../models/BoardResultFile.js';
import BoardExamAccess from '../models/BoardExamAccess.js';
import BoardTimetableFile from '../models/BoardTimetableFile.js';
import BoardStudentResultFile from '../models/BoardStudentResultFile.js';
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

// Board timetable is always a PDF (cap 10 MB; application/pdf enforced in-route).
const boardTimetableUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

// Per-student board result may be PDF, JPG, or PNG (cap 10 MB; type enforced in-route).
const boardStudentResultUpload = multer({
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

// Diff the previous vs next examination state and fire student-facing
// notifications for the two events that a bulk state save otherwise swallows:
//   • marks entered/updated for a class  → "Results Updated"
//   • exam schedule published/changed     → "Exam Schedule"
// Deduped per (exam, class) so a student is paged once, not once per subject.
// Best-effort: never let a notify failure break the state save.
const notifyExamStateChanges = async (prevState, nextState) => {
  const examName = (examId) =>
    (nextState.exams || []).find((exam) => exam && exam.id === examId)?.name || 'Examination';

  // --- Marks: notify classes whose marks records are new or changed ---
  const prevMarksById = new Map((prevState.marks || []).map((record) => [record.id, record]));
  const marksSeen = new Set();
  for (const record of nextState.marks || []) {
    if (!record || !record.className || !record.examId) continue;
    const prev = prevMarksById.get(record.id);
    if (prev && prev.updatedAt === record.updatedAt) continue; // unchanged
    const key = `${record.examId}|${record.className}`;
    if (marksSeen.has(key)) continue;
    marksSeen.add(key);
    createNotification({
      title: 'Results Updated',
      description: `Your ${examName(record.examId)} marks have been updated. Tap to view your results.`,
      type: 'result',
      linkPage: 'Examinations',
      recipientRole: 'student',
      recipientClassName: record.className,
    }).catch(() => {});
  }

  // --- Schedule: notify classes whose schedule content changed ---
  const scheduleSignature = (rows = []) =>
    rows
      .map((row) => `${row.subject}@${row.date}#${row.startTime}-${row.endTime}`)
      .sort()
      .join('|');
  const groupSchedules = (rows = []) => {
    const groups = new Map();
    for (const row of rows) {
      if (!row || !row.className || !row.examId) continue;
      const key = `${row.examId}|${row.className}`;
      if (!groups.has(key)) groups.set(key, { examId: row.examId, className: row.className, rows: [] });
      groups.get(key).rows.push(row);
    }
    return groups;
  };
  const prevGroups = groupSchedules(prevState.schedules);
  for (const [key, group] of groupSchedules(nextState.schedules)) {
    const prevGroup = prevGroups.get(key);
    if (prevGroup && scheduleSignature(prevGroup.rows) === scheduleSignature(group.rows)) continue;
    createNotification({
      title: 'Exam Schedule',
      description: `The ${examName(group.examId)} schedule for ${group.className} has been published.`,
      type: 'general',
      linkPage: 'Examinations',
      recipientRole: 'student',
      recipientClassName: group.className,
    }).catch(() => {});
  }

  // --- Papers: notify the assigned teacher when a paper is routed to them ---
  const prevPapersById = new Map((prevState.papers || []).map((paper) => [paper.id, paper]));
  for (const paper of nextState.papers || []) {
    if (!paper || paper.status !== 'teacher_review' || !paper.teacherUsername) continue;
    const prev = prevPapersById.get(paper.id);
    if (prev && prev.status === 'teacher_review') continue; // already awaiting review — not a new routing
    createNotification({
      title: 'Paper Ready for Review',
      description: `A paper "${paper.title || paper.subject || 'Paper'}" needs your review and approval.`,
      type: 'general',
      linkPage: 'Examinations',
      recipientUsername: paper.teacherUsername,
    }).catch(() => {});
  }
};

router.put('/state', ensureMongo, requireRole('admin', 'clerk', 'teacher'), async (request, response) => {
  const nextState = normalizeState(request.body.state);

  // Snapshot the previous state so we can detect newly-entered marks / schedules.
  const existing = await ExaminationState.findOne().sort({ updatedAt: -1 });
  const prevState = existing ? normalizeState(existing.state) : { ...EMPTY_EXAMINATION_STATE };

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

  // Fire event notifications after the save (best-effort, non-blocking).
  try {
    await notifyExamStateChanges(prevState, nextState);
  } catch (error) {
    console.error('[examinations] state-change notify failed:', error?.message || error);
  }

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

// -----------------------------------------------------------------------------
// Board Examination desk — access approval
// -----------------------------------------------------------------------------
// A clerk cannot open the Board Examination desk until an admin approves them.
// Each clerk has one BoardExamAccess doc tracking status ('none' | 'requested'
// | 'approved'). Admins can see all records to action pending requests.

// Clerk requests access → upsert their record to 'requested' and page admins.
router.post(
  '/board-access/request',
  ensureMongo,
  requireRole('clerk'),
  async (request, response) => {
    const clerkUsername = request.auth?.username || '';
    if (!clerkUsername) {
      response.status(400).json({ message: 'Clerk username could not be resolved.' });
      return;
    }

    const record = await BoardExamAccess.findOneAndUpdate(
      { clerkUsername },
      {
        clerkUsername,
        status: 'requested',
        requestedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    broadcastExaminationsUpdated();

    createNotification({
      title: 'Board Exam Access Request',
      description: `${clerkUsername} has requested access to the Board Examination desk.`,
      type: 'general',
      linkPage: 'Examinations',
      recipientRole: 'admin',
    }).catch(() => {});

    response.status(201).json(record);
  }
);

// Admin grants access → set the clerk's record to 'approved' and notify them.
router.post(
  '/board-access/grant',
  ensureMongo,
  requireRole('admin'),
  async (request, response) => {
    const clerkUsername = String(request.body?.clerkUsername || '').trim();
    if (!clerkUsername) {
      response.status(400).json({ message: 'clerkUsername is required.' });
      return;
    }

    const grantedByName = request.auth?.displayName || request.auth?.username || 'Admin';
    const record = await BoardExamAccess.findOneAndUpdate(
      { clerkUsername },
      {
        clerkUsername,
        status: 'approved',
        grantedByName,
        grantedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    broadcastExaminationsUpdated();

    createNotification({
      title: 'Board Access Approved',
      description: 'Your Board Examination access has been approved.',
      type: 'general',
      linkPage: 'Examinations',
      recipientUsername: clerkUsername,
    }).catch(() => {});

    response.json(record);
  }
);

// Admin revokes access → reset the clerk's record to 'none'.
router.post(
  '/board-access/revoke',
  ensureMongo,
  requireRole('admin'),
  async (request, response) => {
    const clerkUsername = String(request.body?.clerkUsername || '').trim();
    if (!clerkUsername) {
      response.status(400).json({ message: 'clerkUsername is required.' });
      return;
    }

    const record = await BoardExamAccess.findOneAndUpdate(
      { clerkUsername },
      {
        clerkUsername,
        status: 'none',
        grantedByName: '',
        grantedAt: null,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    broadcastExaminationsUpdated();
    response.json(record);
  }
);

// Status check: a clerk gets their own record (synthesised 'none' if absent);
// an admin gets the full list so they can see/grant pending requests.
router.get(
  '/board-access/status',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    if (request.auth?.role === 'admin') {
      const records = await BoardExamAccess.find().sort({ updatedAt: -1 });
      response.json(records);
      return;
    }

    const clerkUsername = request.auth?.username || '';
    const record = await BoardExamAccess.findOne({ clerkUsername });
    if (record) {
      response.json(record);
      return;
    }

    response.json({ clerkUsername, status: 'none', requestedAt: null, grantedByName: '', grantedAt: null });
  }
);

// -----------------------------------------------------------------------------
// Board Examination desk — board timetable PDF (class-scoped)
// -----------------------------------------------------------------------------

// Upload/replace the board timetable for a (className, examId) and notify the
// class's students. The binary lives in BoardTimetableFile; one per pair.
router.post(
  '/board-timetable',
  ensureMongo,
  requireRole('admin', 'clerk'),
  boardTimetableUpload.single('file'),
  async (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: 'PDF file is required.' });
      return;
    }

    const isPdf =
      file.mimetype === 'application/pdf' ||
      (file.originalname || '').toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      response.status(400).json({ message: 'Only PDF files are allowed.' });
      return;
    }

    const className = String(request.body?.className || '').trim();
    const examId = String(request.body?.examId || '').trim();
    if (!className) {
      response.status(400).json({ message: 'className is required.' });
      return;
    }
    if (!examId) {
      response.status(400).json({ message: 'examId is required.' });
      return;
    }

    const uploadedByName = request.auth?.displayName || request.auth?.username || 'Admin';

    const record = await BoardTimetableFile.findOneAndUpdate(
      { className, examId },
      {
        className,
        examId,
        fileName: file.originalname || 'board-timetable.pdf',
        mimeType: file.mimetype || 'application/pdf',
        data: file.buffer,
        uploadedByName,
        uploadedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    broadcastExaminationsUpdated();

    createNotification({
      title: 'Board Timetable',
      description: `The board exam timetable for ${className} has been uploaded.`,
      type: 'general',
      linkPage: 'Examinations',
      recipientRole: 'student',
      recipientClassName: className,
    }).catch(() => {});

    response.status(201).json({
      id: record._id,
      className: record.className,
      examId: record.examId,
      fileName: record.fileName,
      mimeType: record.mimeType,
      uploadedByName: record.uploadedByName,
      uploadedAt: record.uploadedAt,
    });
  }
);

// Metadata listing (no Buffer) for a class/exam so the UI can show what exists.
router.get('/board-timetable', ensureMongo, async (request, response) => {
  const filter = {};
  const className = String(request.query?.className || '').trim();
  const examId = String(request.query?.examId || '').trim();
  if (className) filter.className = className;
  if (examId) filter.examId = examId;

  const records = await BoardTimetableFile.find(filter)
    .select('-data')
    .sort({ uploadedAt: -1 });
  response.json(records);
});

// Fetch the timetable PDF bytes for a class/exam, or 404.
router.get('/board-timetable/:className/:examId', ensureMongo, async (request, response) => {
  const file = await BoardTimetableFile.findOne({
    className: request.params.className,
    examId: request.params.examId,
  });
  if (!file || !file.data) {
    response.status(404).json({ message: 'Board timetable not found.' });
    return;
  }

  response.setHeader('Content-Type', file.mimeType || 'application/pdf');
  response.setHeader(
    'Content-Disposition',
    `inline; filename="${file.fileName || 'board-timetable.pdf'}"`
  );
  response.send(file.data);
});

router.delete(
  '/board-timetable/:id',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    const result = await BoardTimetableFile.deleteOne({ _id: request.params.id });
    if (result.deletedCount === 0) {
      response.status(404).json({ message: 'Board timetable not found.' });
      return;
    }

    broadcastExaminationsUpdated();
    response.json({ message: 'Board timetable removed.' });
  }
);

// -----------------------------------------------------------------------------
// Board Examination desk — per-student final result (PDF / JPG / PNG)
// -----------------------------------------------------------------------------

const BOARD_STUDENT_RESULT_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];

// Upload/replace one student's final board result and notify that student.
router.post(
  '/board-student-result',
  ensureMongo,
  requireRole('admin', 'clerk'),
  boardStudentResultUpload.single('file'),
  async (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: 'A result file is required.' });
      return;
    }

    if (!BOARD_STUDENT_RESULT_TYPES.includes(file.mimetype)) {
      response.status(400).json({ message: 'Only PDF, JPG, or PNG files are allowed.' });
      return;
    }

    const admissionNumber = String(request.body?.admissionNumber || '').trim();
    const studentName = String(request.body?.studentName || '').trim();
    const className = String(request.body?.className || '').trim();
    const examId = String(request.body?.examId || '').trim();
    if (!admissionNumber) {
      response.status(400).json({ message: 'admissionNumber is required.' });
      return;
    }
    if (!className) {
      response.status(400).json({ message: 'className is required.' });
      return;
    }
    if (!examId) {
      response.status(400).json({ message: 'examId is required.' });
      return;
    }

    const uploadedByName = request.auth?.displayName || request.auth?.username || 'Admin';

    const record = await BoardStudentResultFile.findOneAndUpdate(
      { admissionNumber, examId },
      {
        admissionNumber,
        studentName,
        className,
        examId,
        fileName: file.originalname || 'board-result',
        mimeType: file.mimetype,
        data: file.buffer,
        uploadedByName,
        uploadedAt: new Date(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    broadcastExaminationsUpdated();

    createNotification({
      title: 'Board Result Available',
      description: 'Your board examination result has been published. Tap to view.',
      type: 'result',
      linkPage: 'Examinations',
      recipientStudentId: admissionNumber,
    }).catch(() => {});

    response.status(201).json({
      id: record._id,
      admissionNumber: record.admissionNumber,
      studentName: record.studentName,
      className: record.className,
      examId: record.examId,
      fileName: record.fileName,
      mimeType: record.mimeType,
      uploadedByName: record.uploadedByName,
      uploadedAt: record.uploadedAt,
    });
  }
);

// Metadata array of uploaded student results for a class/exam so the admin UI
// can show which students already have a result.
router.get(
  '/board-student-result',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    const filter = {};
    const className = String(request.query?.className || '').trim();
    const examId = String(request.query?.examId || '').trim();
    if (className) filter.className = className;
    if (examId) filter.examId = examId;

    const records = await BoardStudentResultFile.find(filter)
      .select('admissionNumber studentName fileName mimeType uploadedAt')
      .sort({ uploadedAt: -1 });
    response.json(records);
  }
);

// A student fetches their OWN result. Resolve their admission number(s) from
// request.auth (same source student routes use) and only serve a file that
// belongs to them. Admin/clerk may pass admissionNumber to fetch any student's.
router.get('/board-student-result/me/:examId', ensureMongo, async (request, response) => {
  const role = request.auth?.role;
  const examId = request.params.examId;

  let admissionNumbers = [];
  if (role === 'admin' || role === 'clerk') {
    const requested = String(request.query?.admissionNumber || '').trim();
    if (!requested) {
      response.status(400).json({ message: 'admissionNumber is required.' });
      return;
    }
    admissionNumbers = [requested];
  } else if (role === 'student') {
    // Collect every admission number this account may own (solo or sibling).
    const profiles = Array.isArray(request.auth?.studentProfiles)
      ? request.auth.studentProfiles
      : [];
    admissionNumbers = profiles
      .map((student) => student?.admissionNumber)
      .filter(Boolean);
    if (request.auth?.activeStudent?.admissionNumber) {
      admissionNumbers.push(request.auth.activeStudent.admissionNumber);
    }
    admissionNumbers = [...new Set(admissionNumbers.filter(Boolean))];
    if (!admissionNumbers.length) {
      response.status(404).json({ message: 'No student profile is linked to this account.' });
      return;
    }
  } else {
    response.status(403).json({ message: 'You do not have permission to perform this action.' });
    return;
  }

  const file = await BoardStudentResultFile.findOne({
    admissionNumber: { $in: admissionNumbers },
    examId,
  });
  if (!file || !file.data) {
    response.status(404).json({ message: 'Board result not found.' });
    return;
  }

  response.setHeader('Content-Type', file.mimeType || 'application/pdf');
  response.setHeader(
    'Content-Disposition',
    `inline; filename="${file.fileName || 'board-result'}"`
  );
  response.send(file.data);
});

// Fetch a specific student's result bytes by admission number + exam, or 404.
router.get(
  '/board-student-result/:admissionNumber/:examId',
  ensureMongo,
  async (request, response) => {
    const file = await BoardStudentResultFile.findOne({
      admissionNumber: request.params.admissionNumber,
      examId: request.params.examId,
    });
    if (!file || !file.data) {
      response.status(404).json({ message: 'Board result not found.' });
      return;
    }

    response.setHeader('Content-Type', file.mimeType || 'application/pdf');
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${file.fileName || 'board-result'}"`
    );
    response.send(file.data);
  }
);

router.delete(
  '/board-student-result/:id',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    const result = await BoardStudentResultFile.deleteOne({ _id: request.params.id });
    if (result.deletedCount === 0) {
      response.status(404).json({ message: 'Board result not found.' });
      return;
    }

    broadcastExaminationsUpdated();
    response.json({ message: 'Board result removed.' });
  }
);

export default router;
