import mongoose from 'mongoose';
import { AUDIT_ACTIONS } from '../config/constants.js';

const auditLogSchema = new mongoose.Schema(
  {
    adminId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Admin',
      default: null,
      index: true,
    },
    action: {
      type: String,
      required: [true, "L'action d'audit est obligatoire."],
      enum: Object.values(AUDIT_ACTIONS),
      index: true,
    },
    targetType: {
      type: String,
      trim: true,
      default: '',
    },
    targetId: {
      type: String,
      trim: true,
      default: '',
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: {},
    },
    ipAddress: {
      type: String,
      trim: true,
      default: '',
    },
    userAgent: {
      type: String,
      trim: true,
      default: '',
    },
  },
  {
    timestamps: { createdAt: true, updatedAt: false },
    versionKey: false,
  }
);

auditLogSchema.index({ action: 1, createdAt: -1 });

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
