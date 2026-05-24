import mongoose from 'mongoose';

const attendanceEntrySchema = new mongoose.Schema(
  {
    studentId: {
      type: String,
      required: true,
      trim: true,
    },
    studentName: {
      type: String,
      required: true,
      trim: true,
    },
    className: {
      type: String,
      required: true,
      trim: true,
    },
    section: {
      type: String,
      trim: true,
      default: '',
    },
    status: {
      type: String,
      enum: ['present', 'absent', 'rejected'],
      required: true,
      default: 'absent',
    },
    respondedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const meetingSchema = new mongoose.Schema(
  {
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
    scopeType: {
      type: String,
      enum: ['class', 'staff', 'school'],
      required: true,
      default: 'class',
    },
    targetClasses: {
      type: [String],
      default: [],
    },
    date: {
      type: String,
      required: true,
    },
    time: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['ongoing', 'ended'],
      required: true,
      default: 'ongoing',
    },
    hostRole: {
      type: String,
      enum: ['admin', 'clerk', 'teacher'],
      required: true,
    },
    hostUsername: {
      type: String,
      required: true,
      trim: true,
    },
    hostName: {
      type: String,
      required: true,
      trim: true,
    },
    roomName: {
      type: String,
      required: true,
      trim: true,
      unique: true,
    },
    attendance: {
      type: Map,
      of: attendanceEntrySchema,
      default: {},
    },
    endedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const Meeting = mongoose.models.Meeting || mongoose.model('Meeting', meetingSchema);

export default Meeting;
