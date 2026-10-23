import mongoose from 'mongoose';

export const CLAIM_STATUSES = ['PENDING', 'APPROVED', 'REJECTED', 'WITHDRAWN'];

/**
 * Allowed transitions (enforced with conditional updates in the controller):
 *   PENDING -> APPROVED | REJECTED   (finder or admin)
 *   PENDING -> WITHDRAWN             (claimant)
 * APPROVED, REJECTED and WITHDRAWN are final in this phase.
 */

const answerSchema = new mongoose.Schema(
  {
    questionId: { type: mongoose.Schema.Types.ObjectId, required: true },
    question: { type: String, required: true }, // snapshot, so later edits to the report do not rewrite history
    answer: { type: String, required: true, trim: true, maxlength: 300 },
  },
  { _id: false },
);

const claimSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemReport', required: true },
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    finder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // owner of the item at claim time
    explanation: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    answers: { type: [answerSchema], default: [] },
    evidence: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: CLAIM_STATUSES, default: 'PENDING' },
    // true while PENDING or APPROVED. Used by the partial unique index below.
    isActive: { type: Boolean, default: true },
    reviewNote: { type: String, trim: true, maxlength: 500, default: '' },
    decidedAt: Date,
    decidedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

// One active claim per claimant per item.
claimSchema.index({ item: 1, claimant: 1 }, { unique: true, partialFilterExpression: { isActive: true }, name: 'one_active_claim_per_user' });
// At most one APPROVED claim per item: makes simultaneous approvals safe without transactions.
claimSchema.index({ item: 1 }, { unique: true, partialFilterExpression: { status: 'APPROVED' }, name: 'one_approved_claim_per_item' });
claimSchema.index({ claimant: 1, createdAt: -1 });
claimSchema.index({ finder: 1, status: 1, createdAt: -1 });
claimSchema.index({ item: 1, createdAt: -1 });

export default mongoose.model('Claim', claimSchema);
