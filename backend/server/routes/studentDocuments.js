import express from 'express';
import multer from 'multer';
import StudentDocumentFile from '../models/StudentDocumentFile.js';
import ModuleState from '../models/ModuleState.js';
import { isMongoConnected } from '../db.js';
import { requireRole } from '../middleware/auth.js';
import { createNotification } from '../utils/notify.js';

const REVIEW_STATUSES = ['approved', 'rejected', 'locked'];

const router = express.Router();

const STUDENT_DOC_TYPES = ['application/pdf', 'image/jpeg', 'image/png'];
const STUDENTS_NAMESPACE = 'admin-student-management-students';

// Buffer document uploads in memory (cap 10 MB; PDF/JPG/PNG enforced in-route).
const studentDocumentUpload = multer({
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

// Map a data-url mime prefix to one of the allowed enum values, or null.
const inferMimeFromDataUrl = (dataUrl = '') => {
  const match = /^data:([^;,]+)[;,]/.exec(String(dataUrl));
  const mime = (match?.[1] || '').toLowerCase();
  if (mime === 'application/pdf') return 'application/pdf';
  if (mime === 'image/jpeg' || mime === 'image/jpg') return 'image/jpeg';
  if (mime === 'image/png') return 'image/png';
  return null;
};

const extForMime = (mimeType) => {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType === 'image/jpeg') return 'jpg';
  if (mimeType === 'image/png') return 'png';
  return 'bin';
};

// Every admission number this account may own (solo or sibling/parent). Mirrors
// the examinations board-student-result /me resolution.
const resolveOwnedAdmissionNumbers = (auth = {}) => {
  const profiles = Array.isArray(auth.studentProfiles) ? auth.studentProfiles : [];
  const numbers = profiles.map((student) => student?.admissionNumber).filter(Boolean);
  if (auth.activeStudent?.admissionNumber) {
    numbers.push(auth.activeStudent.admissionNumber);
  }
  return [...new Set(numbers.map((value) => String(value).trim().toUpperCase()).filter(Boolean))];
};

// Upload/replace one student's document. Stored as its own binary file so the
// shared student roster blob never carries base64 payloads.
router.post(
  '/',
  ensureMongo,
  requireRole('admin', 'clerk', 'student'),
  studentDocumentUpload.single('file'),
  async (request, response) => {
    const file = request.file;
    if (!file) {
      response.status(400).json({ message: 'A document file is required.' });
      return;
    }

    if (!STUDENT_DOC_TYPES.includes(file.mimetype)) {
      response.status(400).json({ message: 'Only PDF, JPG, or PNG files are allowed.' });
      return;
    }

    const admissionNumber = String(request.body?.admissionNumber || '').trim().toUpperCase();
    const docName = String(request.body?.docName || '').trim();
    if (!admissionNumber) {
      response.status(400).json({ message: 'admissionNumber is required.' });
      return;
    }
    if (!docName) {
      response.status(400).json({ message: 'docName is required.' });
      return;
    }

    const role = request.auth?.role;

    // A student may only upload against an admission number they own, and never
    // over a locked/approved doc (that's an admin-only "replace" power).
    if (role === 'student') {
      const owned = resolveOwnedAdmissionNumbers(request.auth || {});
      if (!owned.includes(admissionNumber)) {
        response.status(403).json({ message: 'You do not have permission to upload this document.' });
        return;
      }

      const existing = await StudentDocumentFile.findOne({ admissionNumber, docName }).select('status');
      if (existing && (existing.status === 'locked' || existing.status === 'approved')) {
        response
          .status(403)
          .json({ message: 'This document is locked/approved and can no longer be changed.' });
        return;
      }
    }

    const uploadedByName = request.auth?.displayName || request.auth?.username || 'Admin';

    // Any fresh upload (student self-service OR admin/clerk replace) resets the
    // review workflow back to 'pending' and clears prior review metadata.
    const record = await StudentDocumentFile.findOneAndUpdate(
      { admissionNumber, docName },
      {
        admissionNumber,
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

    response.status(201).json({
      admissionNumber: record.admissionNumber,
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
  }
);

// Metadata array of a student's documents (no Buffer). Admin/clerk only.
router.get(
  '/',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    const admissionNumber = String(request.query?.admissionNumber || '').trim().toUpperCase();
    if (!admissionNumber) {
      response.status(400).json({ message: 'admissionNumber is required.' });
      return;
    }

    const records = await StudentDocumentFile.find({ admissionNumber })
      .select('-data')
      .sort({ uploadedAt: -1 });

    response.json(
      records.map((record) => ({
        docName: record.docName,
        fileName: record.fileName,
        mimeType: record.mimeType,
        size: record.size,
        uploadedAt: record.uploadedAt,
        status: record.status,
        reviewNote: record.reviewNote,
        reviewedByName: record.reviewedByName,
        reviewedAt: record.reviewedAt,
      }))
    );
  }
);

// MIGRATION: pull every base64 dataUrl out of the student roster blob into its
// own StudentDocumentFile, then trim the dataUrls from the blob and save it back.
// Admin only. Idempotent: entries already stored (no dataUrl) are skipped.
router.post('/migrate', ensureMongo, requireRole('admin'), async (_request, response) => {
  const record = await ModuleState.findOne({ namespace: STUDENTS_NAMESPACE });
  const students = Array.isArray(record?.value) ? record.value : [];
  if (!record || !students.length) {
    response.json({ migratedFiles: 0, studentsTouched: 0, errors: [] });
    return;
  }

  let migratedFiles = 0;
  let studentsTouched = 0;
  const errors = [];

  const migrateDocList = async (docs, admissionNumber) => {
    if (!Array.isArray(docs)) return 0;
    let count = 0;
    for (const doc of docs) {
      if (!doc || typeof doc !== 'object') continue;
      const dataUrl = doc.dataUrl;
      if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) continue;

      const mimeType = inferMimeFromDataUrl(dataUrl);
      const docName = String(doc.name || '').trim();
      if (!mimeType || !docName) {
        errors.push({
          admissionNumber,
          docName: docName || '(unnamed)',
          message: !mimeType ? 'Unsupported or unreadable data URL mime type.' : 'Missing document name.',
        });
        continue;
      }

      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const buffer = Buffer.from(base64, 'base64');

      await StudentDocumentFile.findOneAndUpdate(
        { admissionNumber, docName },
        {
          admissionNumber,
          docName,
          fileName: String(doc.fileName || `${docName}.${extForMime(mimeType)}`).trim(),
          mimeType,
          size: doc.size ?? buffer.length,
          data: buffer,
          uploadedByName: String(doc.uploadedByName || 'Migration').trim() || 'Migration',
          uploadedAt: doc.uploadedAt ? new Date(doc.uploadedAt) : new Date(),
        },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );

      // Trim the heavy base64 from the blob; keep lightweight metadata.
      delete doc.dataUrl;
      doc.stored = true;
      count += 1;
    }
    return count;
  };

  for (const student of students) {
    if (!student || typeof student !== 'object') continue;
    const admissionNumber = String(student.admissionNumber || '').trim().toUpperCase();
    if (!admissionNumber) continue;

    try {
      let studentCount = 0;
      studentCount += await migrateDocList(student.documents, admissionNumber);
      if (student.rawProfile && typeof student.rawProfile === 'object') {
        studentCount += await migrateDocList(student.rawProfile.documents, admissionNumber);
      }

      if (studentCount > 0) {
        migratedFiles += studentCount;
        studentsTouched += 1;
      }
    } catch (error) {
      errors.push({
        admissionNumber,
        message: error?.message || 'Failed to migrate student documents.',
      });
    }
  }

  if (studentsTouched > 0) {
    // The trimmed blob is small (dataUrls removed) so this save fits well under 16MB.
    record.markModified('value');
    await record.save();
  }

  response.json({ migratedFiles, studentsTouched, errors });
});

// Stream one document's bytes inline. Admin/clerk may fetch any; a student may
// fetch only a document belonging to an admission number they own.
router.get('/:admissionNumber/:docName', ensureMongo, async (request, response) => {
  const role = request.auth?.role;
  const admissionNumber = String(request.params.admissionNumber || '').trim().toUpperCase();
  const docName = String(request.params.docName || '').trim();

  if (role !== 'admin' && role !== 'clerk') {
    if (role === 'student') {
      const owned = resolveOwnedAdmissionNumbers(request.auth || {});
      if (!owned.includes(admissionNumber)) {
        response.status(403).json({ message: 'You do not have permission to view this document.' });
        return;
      }
    } else {
      response.status(403).json({ message: 'You do not have permission to perform this action.' });
      return;
    }
  }

  const file = await StudentDocumentFile.findOne({ admissionNumber, docName });
  if (!file || !file.data) {
    response.status(404).json({ message: 'Document not found.' });
    return;
  }

  response.setHeader('Content-Type', file.mimeType || 'application/octet-stream');
  response.setHeader('Content-Disposition', `inline; filename="${file.fileName || docName}"`);
  response.send(file.data);
});

// Verification decision: approve / reject / lock a student's document, record who
// reviewed it and any note, then notify that student. Admin/clerk only.
router.patch(
  '/:admissionNumber/:docName/status',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    const admissionNumber = String(request.params.admissionNumber || '').trim().toUpperCase();
    const docName = String(request.params.docName || '').trim();
    const status = String(request.body?.status || '').trim().toLowerCase();
    const note = String(request.body?.note || '').trim();

    if (!REVIEW_STATUSES.includes(status)) {
      response.status(400).json({ message: `status must be one of: ${REVIEW_STATUSES.join(', ')}.` });
      return;
    }

    const reviewedByName = request.auth?.displayName || request.auth?.username || 'Admin';

    const record = await StudentDocumentFile.findOneAndUpdate(
      { admissionNumber, docName },
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

    // Best-effort notify the owning student — never let a push failure fail the review.
    createNotification({
      title: `Document ${status}`,
      description: `Your "${docName}" was ${status}${note ? ': ' + note : ''}.`,
      type: 'general',
      linkPage: 'Profile',
      recipientStudentId: admissionNumber,
    }).catch(() => {});

    response.json({
      admissionNumber: record.admissionNumber,
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
  }
);

router.delete(
  '/:admissionNumber/:docName',
  ensureMongo,
  requireRole('admin', 'clerk'),
  async (request, response) => {
    const admissionNumber = String(request.params.admissionNumber || '').trim().toUpperCase();
    const docName = String(request.params.docName || '').trim();

    const result = await StudentDocumentFile.deleteOne({ admissionNumber, docName });
    if (result.deletedCount === 0) {
      response.status(404).json({ message: 'Document not found.' });
      return;
    }

    response.json({ message: 'Document removed.' });
  }
);

export default router;
