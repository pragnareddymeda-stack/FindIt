import mongoose from 'mongoose';

export const ABUSE_REASONS = ['SPAM', 'INAPPROPRIATE', 'SCAM', 'PRIVATE_INFO', 'OTHER'];
export const ABUSE_STATUSES = ['OPEN', 'RESOLVED', 'DISMISSED'];

const abuseReportSchema = new mongoose.Schema(
  {
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemReport', required: true },
    reporter: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    reason: { type: String, enum: ABUSE_REASONS, required: true },
    details: { type: String, trim: true, maxlength: 500, default: '' },
    status: { type: String, enum: ABUSE_STATUSES, default: 'OPEN' },
    resolvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    resolvedAt: Date,
    resolutionNote: { type: String, trim: true, maxlength: 300, default: '' },
  },
  { timestamps: true },
);

// A user can have only one open complaint per listing.
abuseReportSchema.index({ item: 1, reporter: 1 }, { unique: true, partialFilterExpression: { status: 'OPEN' }, name: 'one_open_report_per_user_per_item' });
abuseReportSchema.index({ status: 1, createdAt: -1 });
abuseReportSchema.index({ item: 1, status: 1 });

export default mongoose.model('AbuseReport', abuseReportSchema);
