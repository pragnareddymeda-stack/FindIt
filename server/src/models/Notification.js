import mongoose from 'mongoose';

export const NOTIFICATION_TYPES = [
  'NEW_CLAIM', 'CLAIM_APPROVED', 'CLAIM_REJECTED', 'NEW_MESSAGE', 'HANDOVER_UPDATE', 'DISPUTE_UPDATE', 'MODERATION_ACTION',
];

const notificationSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // the recipient
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 120 },
    body: { type: String, default: '', maxlength: 300 },
    link: { type: String, default: '', maxlength: 200 }, // an in-app path such as /claims/<id>
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

notificationSchema.index({ user: 1, readAt: 1, updatedAt: -1 });
notificationSchema.index({ user: 1, updatedAt: -1 });

export default mongoose.model('Notification', notificationSchema);
