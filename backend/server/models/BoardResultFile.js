import mongoose from 'mongoose';

// Binary storage for board result PDFs. The metadata (id, className, examTitle,
// publishedAt, uploader) lives inside ExaminationState.state.boardResults[]; this
// collection holds only the PDF buffer keyed by that metadata record's id.
const boardResultFileSchema = new mongoose.Schema(
  {
    resultId: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    size: {
      type: Number,
      required: true,
    },
    type: {
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
    fileData: {
      type: Buffer,
    },
    uploadedBy: {
      type: String,
      required: true,
      default: 'Admin',
    },
  },
  {
    timestamps: true,
  }
);

const BoardResultFile =
  mongoose.models.BoardResultFile ||
  mongoose.model('BoardResultFile', boardResultFileSchema);

export default BoardResultFile;
