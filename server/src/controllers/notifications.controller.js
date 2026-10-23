import mongoose from 'mongoose';
import Notification from '../models/Notification.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination, toNotification } from '../utils/serializers.js';

export const listNotifications = asyncHandler(async (req, res) => {
  const { unread, page, limit } = req.validatedQuery;
  const filter = { user: req.user._id };
  if (unread === 'true') filter.readAt = null;
  const [rows, total, unreadCount] = await Promise.all([
    Notification.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit),
    Notification.countDocuments(filter),
    Notification.countDocuments({ user: req.user._id, readAt: null }),
  ]);
  res.json({
    success: true,
    data: { notifications: rows.map(toNotification), unreadCount },
    pagination: pagination(page, limit, total),
  });
});

export const markRead = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Notification not found');
  // Scoped to the caller: someone else's notification is indistinguishable from a missing one.
  let doc = await Notification.findOneAndUpdate(
    { _id: req.params.id, user: req.user._id, readAt: null },
    { $set: { readAt: new Date() } },
    { new: true },
  );
  if (!doc) doc = await Notification.findOne({ _id: req.params.id, user: req.user._id });
  if (!doc) throw new ApiError(404, 'Notification not found');
  res.json({ success: true, data: { notification: toNotification(doc) } });
});

export const markAllRead = asyncHandler(async (req, res) => {
  const result = await Notification.updateMany({ user: req.user._id, readAt: null }, { $set: { readAt: new Date() } });
  res.json({ success: true, data: { updated: result.modifiedCount } });
});
