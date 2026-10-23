import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { register, login, logout, me } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { issueCsrfToken } from '../middleware/csrf.js';
import { registerSchema, loginSchema } from '../validators/auth.js';
import { ApiError } from '../utils/ApiError.js';

export function createAuthRouter({ rateLimitMax }) {
  const router = Router();
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: rateLimitMax,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (_req, _res, next) => next(new ApiError(429, 'Too many attempts. Please try again later.')),
  });

  router.get('/csrf', issueCsrfToken);
  router.post('/register', limiter, validate(registerSchema), register);
  router.post('/login', limiter, validate(loginSchema), login);
  router.post('/logout', logout);
  router.get('/me', authenticate, me);
  return router;
}
