import mongoose from 'mongoose';

// Tracks a clerk's access request/grant status for the Board Examination desk.
// A clerk must be 'approved' by an admin before the desk opens. One doc per
// clerk, keyed by their username.
const boardExamAccessSchema = new mongoose.Schema(
  {
    clerkUsername: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      index: true,
    },
    status: {
      type: String,
      enum: ['none', 'requested', 'approved'],
      default: 'none',
    },
    requestedAt: {
      type: Date,
      default: null,
    },
    grantedByName: {
      type: String,
      trim: true,
      default: '',
    },
    grantedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const BoardExamAccess =
  mongoose.models.BoardExamAccess ||
  mongoose.model('BoardExamAccess', boardExamAccessSchema);

export default BoardExamAccess;
