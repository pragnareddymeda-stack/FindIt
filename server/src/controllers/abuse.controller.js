import mongoose from 'mongoose';
import ItemReport from '../models/ItemReport.js';
import AbuseReport from '../models/AbuseReport.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isItemOwner } from '../utils/serializers.js';

/** Any signed-in user can complain about a listing they can see. Moderators handle it in the admin area. */
export const createAbuseReport = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Report not found');
  const item = await ItemReport.findById(req.params.id).select('createdBy status');
  if (!item || ['WITHDRAWN', 'HIDDEN'].includes(item.status)) throw new ApiError(404, 'Report not found');
  if (isItemOwner(item, req.user._id)) throw new ApiError(403, 'You cannot report your own listing');

  try {
    const report = await AbuseReport.create({ item: item._id, reporter: req.user._id, reason: req.body.reason, details: req.body.details });
    res.status(201).json({ success: true, data: { abuseReport: { id: report._id, status: report.status } } });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'You have already reported this listing. A moderator will review it.');
    throw err;
  }
});
