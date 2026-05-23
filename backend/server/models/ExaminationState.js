import mongoose from 'mongoose';

const examinationStateSchema = new mongoose.Schema(
  {
    state: {
      type: mongoose.Schema.Types.Mixed,
      required: true,
      default: {
        exams: [],
        papers: [],
        schedules: [],
        marks: [],
        deliveries: [],
      },
    },
    updatedBy: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: true,
  }
);

const ExaminationState =
  mongoose.models.ExaminationState ||
  mongoose.model('ExaminationState', examinationStateSchema);

export default ExaminationState;
