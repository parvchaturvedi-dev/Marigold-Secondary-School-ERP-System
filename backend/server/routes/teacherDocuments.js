import express from 'express';
import multer from 'multer';
import TeacherDocumentFile from '../models/TeacherDocumentFile.js';
import { isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { createNotification } from '../utils/notify.js';

const router = express.Router();

const TEACHER_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const REVIEW_STATUSES = ['approved', 'rejected', 'locked'];

// Buffer document uploads in memory (cap 10 MB; PDF/JPG/PNG enforced in-route).
const teacherDocumentUpload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024,
  },
});

const ensureMongo = (_request, response, next) => {
  if (!isMongoConnected()) {
    response.status(503).json({
      message: 'Data service is not connected. Please restart the API server or contact support.',
    });
    return;
  }

  next();
};

// A teacher's identity IS their username (e.g. TCH-123), so teacherId === the
// teacher's own username for a teacher caller.
const normalizeTeacherId = (value = '') => String(value || '').trim().toUpperCase();

const metaFor = (record) => ({
  teacherId: record.teacherId,
  docName: record.docName,
  fileName: record.fileName,
  mimeType: record.mimeType,
  size: record.size,
  uploadedAt: record.uploadedAt,
  status: record.status,
  reviewNote: record.reviewNote,
  reviewedByName: record.reviewedByName,
  reviewedAt: record.reviewedAt,
});

// Shared upsert used by both POST / (admin/clerk, or teacher for own id) and
// POST /me (teacher self-service). Enforces the locked/approved freeze for a
// teacher uploading their own doc; admin/clerk may always replace.
const performUpload = async ({ request, response, teacherId, docName, byTeacher }) => {
  const file = request.file;
  if (!file) {
    response.status(400).json({ message: 'A document file is required.' });
    return;
  }
  if (!TEACHER_DOC_TYPES.includes(file.mimetype)) {
    response.status(400).json({ message: 'Only PDF, JPG, or PNG files are allowed.' });
    return;
  }
  if (!teacherId) {
    response.status(400).json({ message: 'teacherId is required.' });
    return;
  }
  if (!docName) {
    response.status(400).json({ message: 'docName is required.' });
    return;
  }

  // A teacher may never overwrite a locked/approved doc (admin-only replace power).
  if (byTeacher) {
    const existing = await TeacherDocumentFile.findOne({ teacherId, docName }).select('status');
    if (existing && (existing.status === 'locked' || existing.status === 'approved')) {
      response
        .status(403)
        .json({ message: 'This document is locked/approved and can no longer be changed.' });
      return;
    }
  }

  const uploadedByName = request.auth?.displayName || request.auth?.username || 'Admin';

  const record = await TeacherDocumentFile.findOneAndUpdate(
    { teacherId, docName },
    {
      teacherId,
      docName,
      fileName: file.originalname || docName,
      mimeType: file.mimetype,
      size: file.size ?? file.buffer?.length ?? 0,
      data: file.buffer,
      uploadedByName,
      uploadedAt: new Date(),
      status: 'pending',
      reviewNote: '',
      reviewedByName: '',
      reviewedAt: null,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  );

  response.status(201).json(metaFor(record));
};

// Upload/replace one teacher's document. Admin/clerk may upload for any teacher;
// a teacher may upload only against their own teacherId (=== their username).
router.post(
  '/',
  ensureMongo,
  requireRole('admin', 'clerk', 'teacher'),
  teacherDocumentUpload.single('file'),
  async (request, response) => {
    const role = request.auth?.role;
    const teacherId = normalizeTeacherId(request.body?.teacherId);
    const docName = String(request.body?.docName || '').trim();

    if (role === 'teacher') {
      const ownId = normalizeTeacherId(request.auth?.username);
      if (!teacherId || teacherId !== ownId) {
        response
          .status(403)
          .json({ message: 'You may only upload your own documents.' });
        return;
      }
    }

    await performUpload({ request, response, teacherId, docName, byTeacher: role === 'teacher' });
  }
);

// Teacher self-service upload: teacherId is taken from the caller's own username.
router.post(
  '/me',
  ensureMongo,
  requireRole('teacher'),
  teacherDocumentUpload.single('file'),
  async (request, response) => {
    const teacherId = normalizeTeacherId(request.auth?.username);
    const docName = String(request.body?.docName || '').trim();
    await performUpload({ request, response, teacherId, docName, byTeacher: true });
  }
);

// Metadata array of a teacher's documents (no Buffer). Admin/clerk only.
router.get(
  '/',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    const teacherId = normalizeTeacherId(request.query?.teacherId);
    if (!teacherId) {
      response.status(400).json({ message: 'teacherId is required.' });
      return;
    }

    const records = await TeacherDocumentFile.find({ teacherId })
      .select('-data')
      .sort({ uploadedAt: -1 });

    response.json(records.map(metaFor));
  }
);

// A teacher fetches one of their OWN documents' bytes (teacherId === username).
router.get('/me/:docName', ensureMongo, requireRole('teacher'), async (request, response) => {
  const teacherId = normalizeTeacherId(request.auth?.username);
  const docName = String(request.params.docName || '').trim();

  const file = await TeacherDocumentFile.findOne({ teacherId, docName });
  if (!file || !file.data) {
    response.status(404).json({ message: 'Document not found.' });
    return;
  }

  response.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  response.setHeader('Content-Disposition', `inline; filename="${file.fileName || docName}"`);
  response.send(file.data);
});

// Stream one document's bytes inline. Admin/clerk may fetch any; a teacher may
// fetch only a document belonging to their own teacherId.
router.get('/:teacherId/:docName', ensureMongo, async (request, response) => {
  const role = request.auth?.role;
  const teacherId = normalizeTeacherId(request.params.teacherId);
  const docName = String(request.params.docName || '').trim();

  if (role !== 'admin' && role !== 'clerk') {
    if (role === 'teacher' && normalizeTeacherId(request.auth?.username) === teacherId) {
      // allowed — teacher's own document
    } else {
      response.status(403).json({ message: 'You do not have permission to view this document.' });
      return;
    }
  }

  const file = await TeacherDocumentFile.findOne({ teacherId, docName });
  if (!file || !file.data) {
    response.status(404).json({ message: 'Document not found.' });
    return;
  }

  response.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  response.setHeader('Content-Disposition', `inline; filename="${file.fileName || docName}"`);
  response.send(file.data);
});

// Verification decision: approve / reject / lock a teacher's document, record who
// reviewed it and any note, then notify that teacher. Admin/clerk only.
router.patch(
  '/:teacherId/:docName/status',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    const teacherId = normalizeTeacherId(request.params.teacherId);
    const docName = String(request.params.docName || '').trim();
    const status = String(request.body?.status || '').trim().toLowerCase();
    const note = String(request.body?.note || '').trim();

    if (!REVIEW_STATUSES.includes(status)) {
      response.status(400).json({ message: `status must be one of: ${REVIEW_STATUSES.join(', ')}.` });
      return;
    }

    const reviewedByName = request.auth?.displayName || request.auth?.username || 'Admin';

    const record = await TeacherDocumentFile.findOneAndUpdate(
      { teacherId, docName },
      {
        status,
        reviewNote: note,
        reviewedByName,
        reviewedAt: new Date(),
      },
      { new: true }
    ).select('-data');

    if (!record) {
      response.status(404).json({ message: 'Document not found.' });
      return;
    }

    // Best-effort notify the owning teacher (teacherId === their username).
    createNotification({
      title: `Document ${status}`,
      description: `Your "${docName}" was ${status}${note ? ': ' + note : ''}.`,
      type: 'general',
      linkPage: 'Profile',
      recipientUsername: teacherId,
    }).catch(() => {});

    response.json(metaFor(record));
  }
);

router.delete(
  '/:teacherId/:docName',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    const teacherId = normalizeTeacherId(request.params.teacherId);
    const docName = String(request.params.docName || '').trim();

    const result = await TeacherDocumentFile.deleteOne({ teacherId, docName });
    if (result.deletedCount === 0) {
      response.status(404).json({ message: 'Document not found.' });
      return;
    }

    response.json({ message: 'Document removed.' });
  }
);

export default router;
