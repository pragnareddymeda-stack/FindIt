import mongoose from 'mongoose';

// One private conversation per claim, between the finder and the claimant only.
const conversationSchema = new mongoose.Schema(
  {
    claim: { type: mongoose.Schema.Types.ObjectId, ref: 'Claim', required: true },
    item: { type: mongoose.Schema.Types.ObjectId, ref: 'ItemReport', required: true },
    finder: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    claimant: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    unreadFinder: { type: Number, default: 0, min: 0 },
    unreadClaimant: { type: Number, default: 0, min: 0 },
    lastMessageAt: { type: Date, default: Date.now },
    lastMessageText: { type: String, default: '' },
    lastMessageSender: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true },
);

conversationSchema.index({ claim: 1 }, { unique: true });
conversationSchema.index({ finder: 1, lastMessageAt: -1 });
conversationSchema.index({ claimant: 1, lastMessageAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
