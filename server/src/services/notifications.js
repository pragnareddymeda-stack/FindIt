import Notification from '../models/Notification.js';
import { emitToUser } from '../realtime.js';
import { toNotification } from '../utils/serializers.js';
import { config } from '../config/env.js';

/** Stores the notification in MongoDB, then pushes it over Socket.IO if (and only if) that is running. */
export async function notify(userId, { type, title, body = '', link = '' }) {
  const doc = await Notification.create({ user: userId, type, title, body: body.slice(0, 300), link });
  emitToUser(userId, 'notification:new', toNotification(doc));
  return doc;
}

/** A notification failure must never break the action that caused it. */
export async function notifySafe(userId, payload) {
  try {
    return await notify(userId, payload);
  } catch (err) {
    if (config.nodeEnv !== 'test') console.error('Could not create notification:', err.message);
    return null;
  }
}

/** One unread "new message" notification per conversation: later messages update it instead of piling up. */
export async function notifyNewMessage(userId, conversationId, senderName, text) {
  try {
    const doc = await Notification.findOneAndUpdate(
      { user: userId, type: 'NEW_MESSAGE', link: `/conversations/${conversationId}`, readAt: null },
      { $set: { body: `${senderName}: ${text}`.slice(0, 300) }, $setOnInsert: { title: 'New message' } },
      { upsert: true, new: true },
    );
    emitToUser(userId, 'notification:new', toNotification(doc));
    return doc;
  } catch (err) {
    if (config.nodeEnv !== 'test') console.error('Could not create notification:', err.message);
    return null;
  }
}
