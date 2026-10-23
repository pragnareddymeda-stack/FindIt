import mongoose from 'mongoose';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { verifyToken } from '../utils/tokens.js';
import { AUTH_COOKIE } from '../utils/cookies.js';

/** Loads the current user from the HTTP-only cookie. Re-checks the account status on every request. */
export async function authenticate(req, _res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (!token) throw new ApiError(401, 'Authentication required');

    let payload;
    try {
      payload = verifyToken(token);
    } catch {
      throw new ApiError(401, 'Your session has expired. Please log in again.');
    }
    if (!mongoose.isValidObjectId(payload.sub)) throw new ApiError(401, 'Invalid session');

    const user = await User.findById(payload.sub);
    if (!user) throw new ApiError(401, 'Invalid session');
    if (user.status !== 'ACTIVE') throw new ApiError(403, 'This account has been suspended');

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
}

/** Server-side role check. Use after authenticate. */
export const requireRole = (...roles) => (req, _res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return next(new ApiError(403, 'You do not have permission to perform this action'));
  }
  next();
};

/** Attaches req.user when a valid session exists, but never rejects the request. */
export async function optionalAuth(req, _res, next) {
  try {
    const token = req.cookies?.[AUTH_COOKIE];
    if (token) {
      const payload = verifyToken(token);
      if (mongoose.isValidObjectId(payload.sub)) {
        const user = await User.findById(payload.sub);
        if (user && user.status === 'ACTIVE') req.user = user;
      }
    }
  } catch {
    // Invalid or expired token: treat as signed out.
  }
  next();
}
