import mongoose from 'mongoose';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import Claim from '../models/Claim.js';
import Notification from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { emitToUser } from '../realtime.js';
import { notifyNewMessage } from './notifications.js';
import { toMessage } from '../utils/serializers.js';

const sameId = (a, b) => a != null && b != null && String(a) === String(b);

export const populateConversation = (query) =>
  query
    .populate('claim', 'status isActive')
    .populate('item', 'title')
    .populate('finder', 'name')
    .populate('claimant', 'name');

export function roleIn(conv, userId) {
  if (sameId(conv.finder?._id ?? conv.finder, userId)) return 'FINDER';
  if (sameId(conv.claimant?._id ?? conv.claimant, userId)) return 'CLAIMANT';
  return null;
}

/** Loads a conversation for a participant. Everyone else (admins included) gets the same 404. */
export async function loadConversation(id, user) {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, 'Conversation not found');
  const conv = await Conversation.findById(id);
  if (!conv) throw new ApiError(404, 'Conversation not found');
  const role = roleIn(conv, user._id);
  if (!role) throw new ApiError(404, 'Conversation not found');
  return { conv, role };
}

/** Creates the conversation for a claim on first use. Safe if two requests race. */
export async function ensureConversation(claim) {
  try {
    return await Conversation.findOneAndUpdate(
      { claim: claim._id },
      { $setOnInsert: { item: claim.item, finder: claim.finder, claimant: claim.claimant } },
      { upsert: true, new: true },
    );
  } catch (err) {
    if (err.code === 11000) return Conversation.findOne({ claim: claim._id });
    throw err;
  }
}

export async function markRead(conv, role) {
  await Conversation.updateOne({ _id: conv._id }, { $set: { [role === 'FINDER' ? 'unreadFinder' : 'unreadClaimant']: 0 } });
  await Notification.updateMany(
    { user: role === 'FINDER' ? conv.finder : conv.claimant, type: 'NEW_MESSAGE', link: `/conversations/${conv._id}`, readAt: null },
    { $set: { readAt: new Date() } },
  );
}

/** Used by both the REST endpoint and the socket event, so the rules are identical. */
export async function postMessage({ conversationId, user, text }) {
  const { conv, role } = await loadConversation(conversationId, user);

  const claim = await Claim.findById(conv.claim).select('isActive');
  if (!claim?.isActive) throw new ApiError(409, 'This conversation is closed because the claim is no longer active');

  const message = await Message.create({ conversation: conv._id, sender: user._id, text });
  const recipientId = role === 'FINDER' ? conv.claimant : conv.finder;

  await Conversation.updateOne(
    { _id: conv._id },
    {
      $set: { lastMessageAt: message.createdAt, lastMessageText: message.text.slice(0, 120), lastMessageSender: user._id },
      $inc: { [role === 'FINDER' ? 'unreadClaimant' : 'unreadFinder']: 1 },
    },
  );

  const payload = toMessage(message, { _id: user._id, name: user.name });
  emitToUser(recipientId, 'message:new', payload);
  emitToUser(user._id, 'message:new', payload); // the sender's other tabs
  await notifyNewMessage(recipientId, conv._id, user.name, message.text.slice(0, 80));
  return payload;
}
