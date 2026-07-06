import mongoose from 'mongoose';

// Binary storage for a single teacher (faculty) document (e.g. degree
// certificate, ID proof). Mirrors StudentDocumentFile but keyed by teacherId
// (the teacher's username, e.g. TCH-123) instead of an admission number. Each
// (teacherId, docName) pair gets its own file so nothing base64-heavy lands in a
// shared ModuleState blob. A re-upload for the same (teacherId, docName) replaces
// the previous file.
const teacherDocumentFileSchema = new mongoose.Schema(
  {
    teacherId: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    docName: {
      type: String,
      required: true,
      trim: true,
    },
    fileName: {
      type: String,
      required: true,
      trim: true,
    },
    mimeType: {
      type: String,
      required: true,
      enum: ['application/pdf', 'image/jpeg', 'image/png'],
    },
    size: {
      type: Number,
      default: 0,
    },
    data: {
      type: Buffer,
      required: true,
    },
    uploadedByName: {
      type: String,
      trim: true,
      default: 'Admin',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    // Verification workflow. A fresh upload lands as 'pending'; admin/clerk then
    // approve/reject/lock it. 'locked' and 'approved' are frozen against teacher
    // self-service re-uploads (admin/clerk may still replace).
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected', 'locked'],
      default: 'pending',
    },
    reviewNote: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedByName: {
      type: String,
      trim: true,
      default: '',
    },
    reviewedAt: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// One document per (teacherId, docName) — re-upload replaces via upsert.
teacherDocumentFileSchema.index({ teacherId: 1, docName: 1 }, { unique: true });

const TeacherDocumentFile =
  mongoose.models.TeacherDocumentFile ||
  mongoose.model('TeacherDocumentFile', teacherDocumentFileSchema);

export default TeacherDocumentFile;
