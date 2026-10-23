import { asyncHandler } from '../utils/asyncHandler.js';

export const getMe = (req, res) => {
  res.json({ success: true, data: { user: req.user } });
};

// req.body only contains fields allowed by updateProfileSchema (name, phone).
export const updateMe = asyncHandler(async (req, res) => {
  req.user.set(req.body);
  await req.user.save();
  res.json({ success: true, data: { user: req.user } });
});
