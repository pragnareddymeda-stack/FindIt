import mongoose from 'mongoose';

export const ITEM_TYPES = ['LOST', 'FOUND'];
export const CATEGORIES = [
  'ELECTRONICS', 'WALLETS_PURSES', 'ID_DOCUMENTS', 'KEYS', 'BAGS',
  'BOOKS_STATIONERY', 'CLOTHING', 'ACCESSORIES', 'OTHER',
];
// HIDDEN is set by admin moderation (Phase 7). RETURNED/CLOSED are set by the claim/handover flow (Phases 4-5).
export const ITEM_STATUSES = ['ACTIVE', 'RETURNED', 'CLOSED', 'WITHDRAWN', 'HIDDEN'];
export const PUBLIC_STATUSES = ['ACTIVE', 'RETURNED', 'CLOSED'];
export const CONTACT_PREFERENCES = ['IN_APP', 'EMAIL', 'PHONE'];

const questionSchema = new mongoose.Schema({
  question: { type: String, required: true, trim: true, minlength: 5, maxlength: 200 },
  // Private to the finder. Never sent to claimants or the public.
  expectedAnswer: { type: String, trim: true, maxlength: 200, default: '' },
});

const itemReportSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ITEM_TYPES, required: true },
    title: { type: String, required: true, trim: true, minlength: 3, maxlength: 100 },
    category: { type: String, enum: CATEGORIES, required: true },
    description: { type: String, required: true, trim: true, minlength: 10, maxlength: 1000 },
    dateOccurred: { type: Date, required: true },
    approxTime: { type: String, default: '', match: /^$|^([01]\d|2[0-3]):[0-5]\d$/ },
    location: { type: String, required: true, trim: true, minlength: 2, maxlength: 100 },
    contactPreference: { type: String, enum: CONTACT_PREFERENCES, default: 'IN_APP' },
    status: { type: String, enum: ITEM_STATUSES, default: 'ACTIVE' },
    // Optional photo, stored in Cloudinary. Only ever set by the upload endpoint, never from a request body.
    imageUrl: { type: String, default: '', maxlength: 500, match: /^$|^https:\/\/res\.cloudinary\.com\// },
    imagePublicId: { type: String, default: '', maxlength: 200 },
    // FOUND reports only. Never returned by public endpoints.
    privateDetails: { type: String, trim: true, maxlength: 500, default: '' },
    verificationQuestions: { type: [questionSchema], default: [] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

itemReportSchema.index({ status: 1, type: 1, createdAt: -1 });
itemReportSchema.index({ status: 1, category: 1, createdAt: -1 });
itemReportSchema.index({ createdBy: 1, createdAt: -1 });
itemReportSchema.index({ dateOccurred: 1 });
itemReportSchema.index(
  { title: 'text', description: 'text', location: 'text' },
  { weights: { title: 5, location: 2, description: 1 }, name: 'item_text_search' },
);

export default mongoose.model('ItemReport', itemReportSchema);
