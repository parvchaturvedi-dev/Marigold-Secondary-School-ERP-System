import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientRole: {
      type: String,
      enum: ['admin', 'clerk', 'student', 'teacher', 'employee'],
      required: true,
    },
    recipientUsername: {
      type: String,
      trim: true,
      default: '',
    },
    recipientStudentId: {
      type: String,
      trim: true,
      default: '',
    },
    recipientClassName: {
      type: String,
      trim: true,
      default: '',
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: '',
    },
    type: {
      type: String,
      trim: true,
      default: 'general',
    },
    linkPage: {
      type: String,
      trim: true,
      default: '',
    },
    meetingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Meeting',
      default: null,
    },
    createdByRole: {
      type: String,
      trim: true,
      default: '',
    },
    createdByUsername: {
      type: String,
      trim: true,
      default: '',
    },
    readBy: {
      type: [String],
      default: [],
    },
    readReceipts: {
      type: [
        {
          username: { type: String, required: true, trim: true },
          readAt: { type: Date, required: true },
        },
      ],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

notificationSchema.index({ recipientRole: 1, recipientUsername: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, recipientStudentId: 1, createdAt: -1 });
notificationSchema.index({ recipientRole: 1, recipientClassName: 1, createdAt: -1 });

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
