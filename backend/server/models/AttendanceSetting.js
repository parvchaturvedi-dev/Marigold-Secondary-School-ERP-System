import mongoose from 'mongoose';

const attendanceSettingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'default',
    },
    presentUntil: {
      type: String,
      default: '08:30',
    },
    halfDayUntil: {
      type: String,
      default: '10:30',
    },
    closeAfter: {
      type: String,
      default: '11:00',
    },
    timezone: {
      type: String,
      default: 'Asia/Kolkata',
    },
    allowTeacherQrScan: {
      type: Boolean,
      default: true,
    },
    updatedBy: {
      type: String,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const AttendanceSetting =
  mongoose.models.AttendanceSetting ||
  mongoose.model('AttendanceSetting', attendanceSettingSchema);

export default AttendanceSetting;
