import mongoose from 'mongoose';

export const AUDIT_ACTIONS = [
  'USER_SUSPENDED', 'USER_REACTIVATED', 'REPORT_HIDDEN', 'REPORT_UNHIDDEN',
  'ABUSE_REPORT_RESOLVED', 'ABUSE_REPORT_DISMISSED', 'DISPUTE_RESOLVED',
  'CLAIM_VIEWED_BY_ADMIN', 'CLAIM_DECIDED_BY_ADMIN',
];
export const AUDIT_TARGETS = ['USER', 'ITEM', 'ABUSE_REPORT', 'HANDOVER', 'CLAIM'];

// Append-only: the application exposes no update or delete operation for audit logs.
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, enum: AUDIT_ACTIONS, required: true },
    targetType: { type: String, enum: AUDIT_TARGETS, required: true },
    targetId: { type: mongoose.Schema.Types.ObjectId, required: true },
    summary: { type: String, required: true, maxlength: 300 },
    ip: { type: String, default: '' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ targetType: 1, targetId: 1 });

export default mongoose.model('AuditLog', auditLogSchema);
