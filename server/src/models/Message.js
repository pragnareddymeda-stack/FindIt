import mongoose from 'mongoose';

export const MAX_MESSAGE_LENGTH = 1000;

const messageSchema = new mongoose.Schema(
  {
    conversation: { type: mongoose.Schema.Types.ObjectId, ref: 'Conversation', required: true },
    sender: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    // Stored exactly as typed. Output escaping happens when it is rendered (React escapes text by default).
    text: { type: String, required: true, trim: true, minlength: 1, maxlength: MAX_MESSAGE_LENGTH },
  },
  { timestamps: true },
);

messageSchema.index({ conversation: 1, _id: -1 });

export default mongoose.model('Message', messageSchema);
