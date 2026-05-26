import mongoose from 'mongoose';

const timetableSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      default: 'Default Timetable',
    },
    mode: {
      type: String,
      enum: ['default', 'override'],
      required: true,
      default: 'default',
      index: true,
    },
    fromDate: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    toDate: {
      type: String,
      trim: true,
      default: '',
      index: true,
    },
    classes: {
      type: [String],
      default: [],
    },
    periods: {
      type: [
        {
          id: { type: String, required: true },
          label: { type: String, required: true },
          time: { type: String, default: '' },
        },
      ],
      default: [],
    },
    cells: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    createdBy: {
      type: String,
      trim: true,
      default: '',
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

timetableSchema.index({ mode: 1, fromDate: 1, toDate: 1, updatedAt: -1 });

const Timetable =
  mongoose.models.Timetable || mongoose.model('Timetable', timetableSchema);

export default Timetable;
