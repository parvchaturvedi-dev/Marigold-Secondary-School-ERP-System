import mongoose from 'mongoose';

const fraudAlertSchema = new mongoose.Schema(
  {
    username: {
      type: String,
      uppercase: true,
      trim: true,
      default: '',
    },
    role: {
      type: String,
      trim: true,
      default: '',
    },
    reason: {
      type: String,
      required: true,
      trim: true,
    },
    severity: {
      type: String,
      enum: ['low', 'medium', 'high', 'critical'],
      default: 'high',
    },
    sessionId: {
      type: String,
      trim: true,
      default: '',
    },
    deviceId: {
      type: String,
      trim: true,
      default: '',
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
  },
  {
    timestamps: true,
  }
);

fraudAlertSchema.index({ username: 1, createdAt: -1 });
fraudAlertSchema.index({ reason: 1, createdAt: -1 });

const FraudAlert = mongoose.models.FraudAlert || mongoose.model('FraudAlert', fraudAlertSchema);

export default FraudAlert;
