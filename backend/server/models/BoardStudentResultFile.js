import mongoose from 'mongoose';

// Binary storage for a single board-class student's final result. Each student
// gets their own file (PDF, JPG, or PNG). One result per (admissionNumber,
// examId) — a re-upload replaces the previous one.
const boardStudentResultFileSchema = new mongoose.Schema(
  {
    admissionNumber: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    studentName: {
      type: String,
      trim: true,
      default: '',
    },
    className: {
      type: String,
      required: true,
      trim: true,
      index: true,
    },
    examId: {
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

const BoardStudentResultFile =
  mongoose.models.BoardStudentResultFile ||
  mongoose.model('BoardStudentResultFile', boardStudentResultFileSchema);

export default BoardStudentResultFile;
