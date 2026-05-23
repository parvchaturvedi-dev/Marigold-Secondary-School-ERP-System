import mongoose from 'mongoose';

const attachmentSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      trim: true,
      default: '',
    },
    mimeType: {
      type: String,
      trim: true,
      default: '',
    },
    size: {
      type: Number,
      default: 0,
    },
    data: {
      type: Buffer,
      default: null,
    },
  },
  { _id: false }
);

const extensionLogSchema = new mongoose.Schema(
  {
    fromDate: {
      type: String,
      required: true,
    },
    toDate: {
      type: String,
      required: true,
    },
    extendedByName: {
      type: String,
      required: true,
    },
    extendedByRole: {
      type: String,
      required: true,
    },
    extendedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const assignmentSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    subject: {
      type: String,
      trim: true,
      default: 'General',
    },
    targetClasses: {
      type: [String],
      required: true,
      default: [],
    },
    checkingDate: {
      type: String,
      required: true,
    },
    attachment: {
      type: attachmentSchema,
      default: null,
    },
    createdByRole: {
      type: String,
      enum: ['admin', 'clerk', 'teacher'],
      required: true,
    },
    createdByUsername: {
      type: String,
      required: true,
      trim: true,
    },
    createdByName: {
      type: String,
      required: true,
      trim: true,
    },
    updatedByName: {
      type: String,
      trim: true,
      default: '',
    },
    extensionLogs: {
      type: [extensionLogSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

const Assignment =
  mongoose.models.Assignment || mongoose.model('Assignment', assignmentSchema);

export default Assignment;
