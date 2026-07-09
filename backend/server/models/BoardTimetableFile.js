import mongoose from 'mongoose';

// Binary storage for the board-issued exam timetable PDF, scoped to a board
// class + exam. One timetable per (className, examId) — a re-upload replaces
// the previous one.
const boardTimetableFileSchema = new mongoose.Schema(
  {
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
      default: 'application/pdf',
    },
    storage: {
      type: String,
      enum: ['mongo', 'cloudinary'],
      default: 'mongo',
    },
    publicId: {
      type: String,
      trim: true,
      default: '',
    },
    resourceType: {
      type: String,
      trim: true,
      default: '',
    },
    data: {
      type: Buffer,
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

const BoardTimetableFile =
  mongoose.models.BoardTimetableFile ||
  mongoose.model('BoardTimetableFile', boardTimetableFileSchema);

export default BoardTimetableFile;
