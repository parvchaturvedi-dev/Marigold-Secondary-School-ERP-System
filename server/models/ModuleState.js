import mongoose from 'mongoose';

const moduleStateSchema = new mongoose.Schema(
  {
    namespace: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    value: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

const ModuleState =
  mongoose.models.ModuleState || mongoose.model('ModuleState', moduleStateSchema);

export default ModuleState;
