import mongoose from 'mongoose';

const aiReceiptSchema = new mongoose.Schema(
  {
    receiptNo: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    admissionNumber: {
      type: String,
      trim: true,
      default: '',
    },
    studentName: {
      type: String,
      trim: true,
      default: '',
    },
    className: {
      type: String,
      trim: true,
      default: '',
    },
    amountPaid: {
      type: Number,
      required: true,
      min: 0,
    },
    mode: {
      type: String,
      trim: true,
      default: 'AI Assistant',
    },
    familyDetails: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    breakdown: {
      type: [mongoose.Schema.Types.Mixed],
      default: [],
    },
    generatedBy: {
      username: { type: String, trim: true, default: '' },
      role: { type: String, trim: true, default: '' },
      displayName: { type: String, trim: true, default: '' },
    },
    sent: {
      gmail: { type: Boolean, default: false },
      whatsapp: { type: Boolean, default: false },
      gmailMessageId: { type: String, trim: true, default: '' },
      whatsappMessage: { type: String, trim: true, default: '' },
    },
  },
  {
    timestamps: true,
  }
);

const AiReceipt =
  mongoose.models.AiReceipt || mongoose.model('AiReceipt', aiReceiptSchema);

export default AiReceipt;
