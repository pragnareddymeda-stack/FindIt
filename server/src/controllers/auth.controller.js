import bcrypt from 'bcryptjs';
import User from '../models/User.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { config } from '../config/env.js';
import { signToken } from '../utils/tokens.js';
import { setAuthCookie, clearAuthCookie } from '../utils/cookies.js';

let dummyHash;
// Compared against when the email is unknown so response time does not reveal which emails exist.
const getDummyHash = async () => (dummyHash ??= await bcrypt.hash('not-a-real-password-1', config.bcryptRounds));

export const register = asyncHandler(async (req, res) => {
  const { name, email, password } = req.body;
  const passwordHash = await bcrypt.hash(password, config.bcryptRounds);
  let user;
  try {
    // Role and status are never taken from the request: public registration always creates a USER.
    user = await User.create({ name, email, passwordHash });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'An account with this email already exists');
    throw err;
  }
  setAuthCookie(res, signToken(user._id));
  res.status(201).json({ success: true, data: { user } });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email }).select('+passwordHash');
  const matches = await bcrypt.compare(password, user ? user.passwordHash : await getDummyHash());
  if (!user || !matches) throw new ApiError(401, 'Invalid email or password');
  if (user.status !== 'ACTIVE') throw new ApiError(403, 'This account has been suspended');
  setAuthCookie(res, signToken(user._id));
  res.json({ success: true, data: { user } });
});

export const logout = (_req, res) => {
  clearAuthCookie(res);
  res.json({ success: true, message: 'Logged out' });
};

export const me = (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};
