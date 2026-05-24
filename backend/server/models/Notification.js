import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema(
  {
    recipientRole: {
      type: String,
      enum: ['admin', 'clerk', 'student', 'teacher'],
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
  },
  {
    timestamps: true,
  }
);

const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);

export default Notification;
