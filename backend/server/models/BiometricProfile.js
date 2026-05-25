import mongoose from 'mongoose';

const biometricProfileSchema = new mongoose.Schema(
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
    biometricToken: {
      type: String,
      required: true,
      trim: true,
    },
    enrolledBy: {
      type: String,
      default: '',
    },
    updatedBy: {
      type: String,
      default: '',
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  {
    timestamps: true,
  }
);

biometricProfileSchema.index({ entityType: 1, entityId: 1 }, { unique: true });
biometricProfileSchema.index({ biometricToken: 1 }, { unique: true });
biometricProfileSchema.index({ className: 1, section: 1 });

const BiometricProfile =
  mongoose.models.BiometricProfile ||
  mongoose.model('BiometricProfile', biometricProfileSchema);

export default BiometricProfile;
