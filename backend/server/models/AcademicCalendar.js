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
    // Where the bytes live: 'cloudinary' (offloaded) or 'mongo' (legacy Buffer).
    storage: {
      type: String,
      enum: ['mongo', 'cloudinary'],
      default: 'mongo',
    },
    // Cloudinary reference (set when storage === 'cloudinary').
    publicId: {
      type: String,
      trim: true,
      default: '',
    },
    resourceType: {
      type: String,
      trim: true,
      default: '',
    },
    // Legacy inline bytes (set when storage === 'mongo'). Optional now that files
    // can be offloaded to Cloudinary.
    fileData: {
      type: Buffer,
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
