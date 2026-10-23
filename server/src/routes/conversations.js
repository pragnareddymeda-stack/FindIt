import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { authenticate } from '../middleware/auth.js';
import { validate, validateQuery } from '../middleware/validate.js';
import { sendMessageSchema, messagesQuerySchema, conversationListQuerySchema } from '../validators/messaging.js';
import { listConversations, getMessages, sendMessage } from '../controllers/conversations.controller.js';
import { ApiError } from '../utils/ApiError.js';

export function createConversationsRouter({ messageRateLimitMax }) {
  const router = Router();
  router.use(authenticate);

  // Per user (not per IP), so a shared campus network does not throttle everyone together.
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: messageRateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => String(req.user._id),
    handler: (_req, _res, next) => next(new ApiError(429, 'You are sending messages too quickly. Please slow down.')),
  });

  router.get('/', validateQuery(conversationListQuerySchema), listConversations);
  router.get('/:id/messages', validateQuery(messagesQuerySchema), getMessages);
  router.post('/:id/messages', limiter, validate(sendMessageSchema), sendMessage);
  return router;
}
