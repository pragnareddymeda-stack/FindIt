import { z } from 'zod';
import { MAX_MESSAGE_LENGTH } from '../models/Message.js';

const objectId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const sendMessageSchema = z.object({
  text: z.string().trim().min(1, 'Message cannot be empty').max(MAX_MESSAGE_LENGTH, `Message must be at most ${MAX_MESSAGE_LENGTH} characters`),
});

export const messagesQuerySchema = z.object({
  before: objectId.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const conversationListQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

export const notificationListQuerySchema = z.object({
  unread: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});

// Socket event payloads
export const socketSendSchema = z.object({ conversationId: objectId, text: sendMessageSchema.shape.text });
export const socketReadSchema = z.object({ conversationId: objectId });
