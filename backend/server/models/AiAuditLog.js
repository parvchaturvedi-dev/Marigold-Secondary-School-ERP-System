import mongoose from 'mongoose';

const aiAuditLogSchema = new mongoose.Schema(
  {
    actionType: {
      type: String,
      required: true,
      trim: true,
    },
    status: {
      type: String,
      enum: ['requested', 'confirmed', 'completed', 'failed', 'blocked'],
      default: 'requested',
    },
    requestedBy: {
      username: { type: String, trim: true, default: '' },
      role: { type: String, trim: true, default: '' },
      displayName: { type: String, trim: true, default: '' },
    },
    target: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    payload: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    result: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    error: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const AiAuditLog =
  mongoose.models.AiAuditLog || mongoose.model('AiAuditLog', aiAuditLogSchema);

export default AiAuditLog;
