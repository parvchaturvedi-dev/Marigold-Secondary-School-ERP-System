import mongoose from 'mongoose';

const participantSchema = new mongoose.Schema(
  {
    admissionNumber: {
      type: String,
      required: true,
      trim: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    fatherName: {
      type: String,
      required: true,
      trim: true,
    },
    className: {
      type: String,
      required: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      trim: true,
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const eventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    durationType: {
      type: String,
      enum: ['single', 'multiple'],
      required: true,
      default: 'single',
    },
    date: {
      type: String,
      trim: true,
      default: '',
    },
    fromDate: {
      type: String,
      trim: true,
      default: '',
    },
    toDate: {
      type: String,
      trim: true,
      default: '',
    },
    participationEnabled: {
      type: Boolean,
      default: false,
    },
    imageName: {
      type: String,
      trim: true,
      default: '',
    },
    imageType: {
      type: String,
      trim: true,
      default: '',
    },
    imageSize: {
      type: Number,
      default: 0,
    },
    imageData: {
      type: Buffer,
      default: null,
    },
    participants: {
      type: [participantSchema],
      default: [],
    },
    createdByRole: {
      type: String,
      enum: ['admin', 'clerk'],
      required: true,
    },
    createdByUsername: {
      type: String,
      required: true,
      trim: true,
    },
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.models.Event || mongoose.model('Event', eventSchema);

export default Event;
