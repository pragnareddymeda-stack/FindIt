import mongoose from 'mongoose';
import Claim from '../models/Claim.js';
import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination, toConversation, toMessage } from '../utils/serializers.js';
import { ensureConversation, loadConversation, markRead, populateConversation, postMessage } from '../services/messaging.js';

const sameId = (a, b) => String(a) === String(b);

export const getClaimConversation = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Claim not found');
  const claim = await Claim.findById(req.params.id);
  if (!claim || (!sameId(claim.finder, req.user._id) && !sameId(claim.claimant, req.user._id))) {
    throw new ApiError(404, 'Claim not found');
  }
  const conv = await ensureConversation(claim);
  const populated = await populateConversation(Conversation.findById(conv._id));
  res.json({ success: true, data: { conversation: toConversation(populated, req.user._id) } });
});

export const listConversations = asyncHandler(async (req, res) => {
  const { page, limit } = req.validatedQuery;
  const filter = { $or: [{ finder: req.user._id }, { claimant: req.user._id }] };
  const [rows, total, unreadRows] = await Promise.all([
    populateConversation(Conversation.find(filter).sort({ lastMessageAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)),
    Conversation.countDocuments(filter),
    Conversation.find(filter).select('finder unreadFinder unreadClaimant').limit(500),
  ]);
  const unreadTotal = unreadRows.reduce((sum, c) => sum + (sameId(c.finder, req.user._id) ? c.unreadFinder : c.unreadClaimant), 0);
  res.json({
    success: true,
    data: { conversations: rows.map((c) => toConversation(c, req.user._id)), unreadTotal },
    pagination: pagination(page, limit, total),
  });
});

export const getMessages = asyncHandler(async (req, res) => {
  const { conv, role } = await loadConversation(req.params.id, req.user);
  const { before, limit } = req.validatedQuery;

  const filter = { conversation: conv._id };
  if (before) filter._id = { $lt: before };
  const rows = await Message.find(filter).sort({ _id: -1 }).limit(limit + 1).populate('sender', 'name');
  const hasMore = rows.length > limit;
  const messages = rows.slice(0, limit).reverse().map((m) => toMessage(m));

  await markRead(conv, role); // opening the conversation marks it read for the caller only
  const populated = await populateConversation(Conversation.findById(conv._id));
  res.json({ success: true, data: { messages, hasMore, conversation: toConversation(populated, req.user._id) } });
});

export const sendMessage = asyncHandler(async (req, res) => {
  const message = await postMessage({ conversationId: req.params.id, user: req.user, text: req.body.text });
  res.status(201).json({ success: true, data: { message } });
});
