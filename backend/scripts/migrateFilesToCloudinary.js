// One-time migration: move every file that is still stored as a raw Buffer in
// MongoDB over to Cloudinary, then drop the inline bytes. Safe to re-run — a
// record already on Cloudinary (storage === 'cloudinary') is skipped, and the
// generated public_id is deterministic per record so a re-run overwrites the
// same asset instead of duplicating it.
//
// USAGE (after Cloudinary keys are set in backend/.env):
//   node scripts/migrateFilesToCloudinary.js
//
// It connects with MONGODB_URI from the env, so run it from the backend folder.

import '../server/utils/loadEnv.js';
import mongoose from 'mongoose';
import {
  isCloudinaryConfigured,
  uploadBuffer,
  resourceTypeForMime,
} from '../server/utils/cloudinary.js';

import StudentDocumentFile from '../server/models/StudentDocumentFile.js';
import TeacherDocumentFile from '../server/models/TeacherDocumentFile.js';
import BoardResultFile from '../server/models/BoardResultFile.js';
import BoardStudentResultFile from '../server/models/BoardStudentResultFile.js';
import BoardTimetableFile from '../server/models/BoardTimetableFile.js';
import Event from '../server/models/Event.js';
import AcademicCalendar from '../server/models/AcademicCalendar.js';
import Assignment from '../server/models/Assignment.js';

const slug = (value) =>
  String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

// Each top-level file collection: which Buffer field holds the bytes, the
// Cloudinary folder, and how to derive a deterministic public_id per record.
const COLLECTIONS = [
  {
    model: StudentDocumentFile,
    field: 'data',
    folder: 'mgps/student-documents',
    publicId: (d) => `${d.admissionNumber}__${slug(d.docName)}`,
  },
  {
    model: TeacherDocumentFile,
    field: 'data',
    folder: 'mgps/teacher-documents',
    publicId: (d) => `${d.teacherId}__${slug(d.docName)}`,
  },
  {
    model: BoardResultFile,
    field: 'fileData',
    folder: 'mgps/board-results',
    publicId: (d) => slug(d.resultId || d._id),
  },
  {
    model: BoardStudentResultFile,
    field: 'data',
    folder: 'mgps/board-student-results',
    publicId: (d) => `${slug(d.admissionNumber)}__${slug(d.examId)}`,
  },
  {
    model: BoardTimetableFile,
    field: 'data',
    folder: 'mgps/board-timetables',
    publicId: (d) => `${slug(d.className)}__${slug(d.examId)}`,
  },
  {
    model: Event,
    field: 'imageData',
    folder: 'mgps/events',
    publicId: (d) => slug(d._id),
  },
  {
    model: AcademicCalendar,
    field: 'fileData',
    folder: 'mgps/academic-calendar',
    publicId: (d) => `academic-calendar__${slug(d.fileName || d.name || d._id)}`,
  },
];

const migrateCollection = async ({ model, field, folder, publicId }) => {
  const name = model.modelName;
  const query = { storage: { $ne: 'cloudinary' }, [field]: { $ne: null } };
  const docs = await model.find(query);
  let migrated = 0;
  let skipped = 0;
  const errors = [];

  for (const doc of docs) {
    const buffer = doc[field];
    if (!buffer || !buffer.length) {
      skipped += 1;
      continue;
    }
    try {
      const uploaded = await uploadBuffer(buffer, {
        folder,
        publicId: publicId(doc),
        mimeType: doc.mimeType || '',
      });
      doc.storage = 'cloudinary';
      doc.publicId = uploaded.publicId;
      doc.resourceType = uploaded.resourceType;
      doc[field] = undefined;
      await doc.save();
      migrated += 1;
    } catch (error) {
      errors.push({ id: String(doc._id), message: error?.message || 'upload failed' });
    }
  }

  return { name, total: docs.length, migrated, skipped, errors };
};

// Assignment stores its file inside an embedded `attachment` sub-document.
const migrateAssignments = async () => {
  const name = 'Assignment';
  const docs = await Assignment.find({
    'attachment.storage': { $ne: 'cloudinary' },
    'attachment.data': { $ne: null },
  });
  let migrated = 0;
  const errors = [];

  for (const doc of docs) {
    const att = doc.attachment;
    if (!att || !att.data || !att.data.length) continue;
    try {
      const uploaded = await uploadBuffer(att.data, {
        folder: 'mgps/assignments',
        publicId: `${doc._id}__${slug(att.fileName || 'file')}`,
        mimeType: att.mimeType || '',
      });
      att.storage = 'cloudinary';
      att.publicId = uploaded.publicId;
      att.resourceType = uploaded.resourceType;
      att.data = undefined;
      await doc.save();
      migrated += 1;
    } catch (error) {
      errors.push({ id: String(doc._id), message: error?.message || 'upload failed' });
    }
  }

  return { name, total: docs.length, migrated, skipped: 0, errors };
};

const main = async () => {
  if (!isCloudinaryConfigured()) {
    console.error('❌ Cloudinary is not configured. Set CLOUDINARY_URL (or CLOUDINARY_CLOUD_NAME/API_KEY/API_SECRET) in backend/.env first.');
    process.exit(1);
  }
  if (!process.env.MONGODB_URI) {
    console.error('❌ MONGODB_URI is not set.');
    process.exit(1);
  }

  await mongoose.connect(process.env.MONGODB_URI, {
    dbName: process.env.MONGODB_DB_NAME || undefined,
  });
  console.log('✅ Connected to MongoDB. Starting file migration to Cloudinary...\n');

  const results = [];
  for (const config of COLLECTIONS) {
    process.stdout.write(`• ${config.model.modelName} ... `);
    const result = await migrateCollection(config);
    results.push(result);
    console.log(`${result.migrated} migrated, ${result.errors.length} errors (of ${result.total})`);
  }
  process.stdout.write('• Assignment ... ');
  const assignmentResult = await migrateAssignments();
  results.push(assignmentResult);
  console.log(`${assignmentResult.migrated} migrated, ${assignmentResult.errors.length} errors (of ${assignmentResult.total})`);

  const totalMigrated = results.reduce((sum, r) => sum + r.migrated, 0);
  const totalErrors = results.flatMap((r) => r.errors.map((e) => ({ collection: r.name, ...e })));

  console.log(`\n🎉 Done. ${totalMigrated} files moved to Cloudinary.`);
  if (totalErrors.length) {
    console.log(`\n⚠️  ${totalErrors.length} errors:`);
    totalErrors.slice(0, 50).forEach((e) => console.log(`   [${e.collection}] ${e.id}: ${e.message}`));
  }

  await mongoose.disconnect();
  process.exit(0);
};

main().catch(async (error) => {
  console.error('Migration failed:', error);
  try {
    await mongoose.disconnect();
  } catch {
    // ignore
  }
  process.exit(1);
});
