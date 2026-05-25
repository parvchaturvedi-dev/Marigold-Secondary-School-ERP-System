import mongoose from 'mongoose';

const attendanceLogSchema = new mongoose.Schema(
  {
    entityType: {
      type: String,
      enum: ['student', 'teacher', 'clerk', 'admin'],
      required: true,
    },
    entityId: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
    },
    displayName: {
      type: String,
      trim: true,
      default: '',
    },
    className: {
      type: String,
      trim: true,
      default: '',
    },
    section: {
      type: String,
      trim: true,
      default: '',
    },
    admissionNumber: {
      type: String,
      uppercase: true,
      trim: true,
      default: '',
    },
    fatherName: {
      type: String,
      trim: true,
      default: '',
    },
    motherName: {
      type: String,
      trim: true,
      default: '',
    },
    mobileNumber: {
      type: String,
      trim: true,
      default: '',
    },
    attendanceDate: {
      type: String,
      required: true,
    },
    scannedAt: {
      type: Date,
      required: true,
      default: Date.now,
    },
    status: {
      type: String,
      enum: ['present', 'half-day', 'closed', 'manual', 'absent'],
      required: true,
    },
    source: {
      type: String,
      enum: ['qr', 'biometric', 'manual'],
      required: true,
    },
    deviceId: {
      type: String,
      trim: true,
      default: '',
    },
    note: {
      type: String,
      trim: true,
      default: '',
    },
    recordedBy: {
      type: String,
      default: '',
    },
    audit: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

attendanceLogSchema.index({ entityType: 1, entityId: 1, attendanceDate: 1 }, { unique: true });
attendanceLogSchema.index({ attendanceDate: 1, className: 1, status: 1 });
attendanceLogSchema.index({ scannedAt: -1 });

const AttendanceLog =
  mongoose.models.AttendanceLog || mongoose.model('AttendanceLog', attendanceLogSchema);

export default AttendanceLog;
