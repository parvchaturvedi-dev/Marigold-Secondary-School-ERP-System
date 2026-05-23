import mongoose from 'mongoose';

const voteSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    decision: {
      type: String,
      enum: ['in', 'out'],
      required: true,
    },
    votedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const applicationSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      required: true,
      trim: true,
    },
    kind: {
      type: String,
      enum: ['simple', 'request'],
      required: true,
      default: 'simple',
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    senderRole: {
      type: String,
      enum: ['clerk', 'student', 'teacher'],
      required: true,
    },
    senderName: {
      type: String,
      required: true,
      trim: true,
    },
    senderUsername: {
      type: String,
      required: true,
      trim: true,
    },
    senderIdentity: {
      type: String,
      trim: true,
      default: '',
    },
    className: {
      type: String,
      trim: true,
      default: '',
    },
    audienceMode: {
      type: String,
      enum: ['individual', 'all-class'],
      default: 'individual',
    },
    targetClassName: {
      type: String,
      trim: true,
      default: '',
    },
    totalClassMembers: {
      type: Number,
      default: 0,
    },
    votes: {
      type: [voteSchema],
      default: [],
    },
    status: {
      type: String,
      enum: ['collecting_consensus', 'pending', 'approved', 'rejected', 'replied'],
      required: true,
      default: 'pending',
    },
    adminReply: {
      type: String,
      trim: true,
      default: '',
    },
    adminActionBy: {
      type: String,
      trim: true,
      default: '',
    },
    adminActionAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Application =
  mongoose.models.Application || mongoose.model('Application', applicationSchema);

export default Application;
