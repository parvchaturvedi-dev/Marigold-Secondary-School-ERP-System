import mongoose from 'mongoose';

// Binary storage for a single student document (e.g. birth certificate, Aadhaar
// scan). Each (admissionNumber, docName) pair gets its own file so the shared
// admin-student-management-students ModuleState blob stays small (base64 dataUrls
// used to live inside it and blew past Mongo's 16MB per-document limit). A
// re-upload for the same (admissionNumber, docName) replaces the previous file.
const studentDocumentFileSchema = new mongoose.Schema(
  {
    admissionNumber: {
      type: String,
      required: true,
      uppercase: true,
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
  },
  {
    timestamps: true,
  }
);

// One document per (admissionNumber, docName) — re-upload replaces via upsert.
studentDocumentFileSchema.index({ admissionNumber: 1, docName: 1 }, { unique: true });

const StudentDocumentFile =
  mongoose.models.StudentDocumentFile ||
  mongoose.model('StudentDocumentFile', studentDocumentFileSchema);

export default StudentDocumentFile;
