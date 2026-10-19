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
        boardClasses: [],
        boardResults: [],
        gradeScale: [
          { grade: 'A', minPercentage: 90 },
          { grade: 'B', minPercentage: 80 },
          { grade: 'C', minPercentage: 70 },
          { grade: 'D', minPercentage: 60 },
          { grade: 'E', minPercentage: 50 },
          { grade: 'F', minPercentage: 0 },
        ],
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
