import mongoose from 'mongoose';

export const HANDOVER_STATUSES = ['ARRANGING', 'SCHEDULED', 'HANDED_OVER', 'COMPLETED', 'DISPUTED', 'CANCELLED'];

/**
 * Who may move a handover into each status, and from which statuses.
 * FINDER / CLAIMANT are the two parties of the approved claim. Administrators can read handovers but not change them.
 *
 *   ARRANGING --> SCHEDULED (either; can be repeated to reschedule)
 *   ARRANGING | SCHEDULED --> HANDED_OVER   (finder records the handover)
 *   HANDED_OVER --> COMPLETED               (claimant confirms receipt; the report becomes RETURNED)
 *   ARRANGING | SCHEDULED | HANDED_OVER --> DISPUTED (either)
 *   ARRANGING | SCHEDULED --> CANCELLED     (either; the claim is released so the item can be claimed again)
 * COMPLETED and CANCELLED are final. DISPUTED can only be resolved by an administrator (see admin.controller.js):
 *   DISPUTED --> COMPLETED (item returned) | CANCELLED (claim released)
 */
export const HANDOVER_TRANSITIONS = {
  SCHEDULED: { from: ['ARRANGING', 'SCHEDULED'], actors: ['FINDER', 'CLAIMANT'] },
  HANDED_OVER: { from: ['ARRANGING', 'SCHEDULED'], actors: ['FINDER'] },
  COMPLETED: { from: ['HANDED_OVER'], actors: ['CLAIMANT'] },
  DISPUTED: { from: ['ARRANGING', 'SCHEDULED', 'HANDED_OVER'], actors: ['FINDER', 'CLAIMANT'] },
  CANCELLED: { from: ['ARRANGING', 'SCHEDULED'], actors: ['FINDER', 'CLAIMANT'] },
};

const eventSchema = new mongoose.Schema(
  {
    status: { type: String, enum: HANDOVER_STATUSES, required: true },
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['FINDER', 'CLAIMANT', 'ADMIN'], required: true },
    at: { type: Date, required: true },
    note: { type: String, default: '' },
  },
  { _id: false },
);

const handoverSchema = new mongoose.Schema(
  {
    claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemReport', required: true },
    finder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    status: { type: String, enum: HANDOVER_STATUSES, default: 'ARRANGING' },
    // General meeting details only. Personal contact details are never stored here.
    meetingTime: Date,
    meetingPlace: { type: String, trim: true, maxlength: 100, default: '' },
    note: { type: String, trim: true, maxlength: 300, default: '' },
    handedOverAt: Date,
    confirmedAt: Date,
    disputeReason: { type: String, trim: true, maxlength: 500, default: '' },
    disputedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    disputedAt: Date,
    cancelledBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    cancelledAt: Date,
    // Set when an administrator resolves a dispute (Phase 7)
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    resolutionNote: { type: String, trim: true, maxlength: 500, default: '' },
    history: { type: [eventSchema], default: [] },
  },
  { timestamps: true },
);

handoverSchema.index({ claim: 1 }, { unique: true }); // one handover per claim
handoverSchema.index({ finder: 1, createdAt: -1 });
handoverSchema.index({ claimant: 1, createdAt: -1 });
handoverSchema.index({ status: 1, updatedAt: -1 }); // admin dispute queue

export default mongoose.model('Handover', handoverSchema);
