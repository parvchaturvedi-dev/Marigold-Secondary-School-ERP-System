import mongoose from 'mongoose';

const vaultItemSchema = new mongoose.Schema(
  {
    ownerUsername: {
      type: String,
      required: true,
      uppercase: true,
      trim: true,
      index: true,
    },
    kind: {
      type: String,
      enum: ['note', 'pdf', 'image'],
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    encryptedPayload: {
      type: String,
      required: true,
    },
    encryption: {
      algorithm: {
        type: String,
        default: 'AES-GCM',
      },
      kdf: {
        type: String,
        default: 'PBKDF2-SHA256',
      },
      iterations: {
        type: Number,
        default: 210000,
      },
      salt: {
        type: String,
        required: true,
      },
      iv: {
        type: String,
        required: true,
      },
    },
    originalName: {
      type: String,
      trim: true,
      default: '',
    },
    mimeType: {
      type: String,
      trim: true,
      default: '',
    },
    sizeBytes: {
      type: Number,
      min: 0,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

const VaultItem = mongoose.models.VaultItem || mongoose.model('VaultItem', vaultItemSchema);

export default VaultItem;
