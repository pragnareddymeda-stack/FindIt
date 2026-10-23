import crypto from 'node:crypto';
import { ApiError } from '../utils/ApiError.js';
import { CSRF_COOKIE, cookieOptions } from '../utils/cookies.js';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * Double-submit CSRF protection.
 * The token is stored in an HTTP-only cookie and returned in the response body of GET /auth/csrf.
 * Because cross-origin pages cannot read that response (CORS allows only CLIENT_URL), an attacker
 * cannot copy the token into the X-CSRF-Token header. Every unsafe request must send both.
 */
export function issueCsrfToken(_req, res) {
  const token = crypto.randomBytes(32).toString('hex');
  res.cookie(CSRF_COOKIE, token, cookieOptions({ maxAge: 24 * 60 * 60 * 1000 }));
  res.json({ success: true, data: { csrfToken: token } });
}

export function csrfProtection(req, _res, next) {
  if (SAFE_METHODS.has(req.method)) return next();
  const cookieToken = req.cookies?.[CSRF_COOKIE];
  const headerToken = req.get('x-csrf-token');
  const valid =
    typeof cookieToken === 'string' &&
    typeof headerToken === 'string' &&
    cookieToken.length === headerToken.length &&
    cookieToken.length > 0 &&
    crypto.timingSafeEqual(Buffer.from(cookieToken), Buffer.from(headerToken));
  if (!valid) return next(new ApiError(403, 'Invalid or missing CSRF token', undefined, 'CSRF_INVALID'));
  next();
}
