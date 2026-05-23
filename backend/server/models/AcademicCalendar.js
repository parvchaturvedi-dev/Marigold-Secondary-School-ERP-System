import mongoose from 'mongoose';

const academicCalendarSchema = new mongoose.Schema(
  {
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
    fileData: {
      type: Buffer,
      required: true,
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

const AcademicCalendar =
  mongoose.models.AcademicCalendar ||
  mongoose.model('AcademicCalendar', academicCalendarSchema);

export default AcademicCalendar;
