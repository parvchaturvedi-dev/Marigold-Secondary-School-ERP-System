import mongoose from 'mongoose';

const leaveRequestSchema = new mongoose.Schema(
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
    applicantRole: {
      type: String,
      enum: ['admin', 'clerk', 'student', 'teacher'],
      required: true,
    },
    applicantName: {
      type: String,
      required: true,
      trim: true,
    },
    applicantUsername: {
      type: String,
      required: true,
      trim: true,
    },
    applicantIdentityId: {
      type: String,
      trim: true,
      default: '',
    },
    applicantIdentity: {
      type: String,
      trim: true,
      default: '',
    },
    className: {
      type: String,
      trim: true,
      default: '',
    },
    metaInfo: {
      type: String,
      trim: true,
      default: '',
    },
    leaveMode: {
      type: String,
      enum: ['single', 'multiple'],
      required: true,
      default: 'single',
    },
    startDate: {
      type: String,
      required: true,
    },
    endDate: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      required: true,
      default: 'pending_admin',
    },
    classTeacherUsername: {
      type: String,
      trim: true,
      default: '',
    },
    classTeacherName: {
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
    teacherActionBy: {
      type: String,
      trim: true,
      default: '',
    },
    teacherActionAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const LeaveRequest =
  mongoose.models.LeaveRequest || mongoose.model('LeaveRequest', leaveRequestSchema);

export default LeaveRequest;
