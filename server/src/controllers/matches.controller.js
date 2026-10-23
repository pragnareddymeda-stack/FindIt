import mongoose from 'mongoose';
import ItemReport from '../models/ItemReport.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { isItemOwner, toPublicItem } from '../utils/serializers.js';
import { rankMatches, WEIGHTS } from '../services/matching.js';

const CANDIDATE_LIMIT = 200; // newest active reports of the opposite type; fine at student-project scale

export const getMatches = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw new ApiError(404, 'Report not found');
  const item = await ItemReport.findById(req.params.id);
  if (!item) throw new ApiError(404, 'Report not found');
  if (!isItemOwner(item, req.user._id)) throw new ApiError(403, 'Only the report owner can view suggestions');
  if (item.status !== 'ACTIVE') throw new ApiError(409, 'Only active reports have suggested matches');

  // Only ACTIVE reports (never returned, closed, withdrawn or hidden) from other people, public fields only.
  const candidates = await ItemReport.find({
    type: item.type === 'LOST' ? 'FOUND' : 'LOST',
    status: 'ACTIVE',
    createdBy: { $ne: item.createdBy },
  })
    .select('-privateDetails -verificationQuestions')
    .sort({ createdAt: -1, _id: -1 })
    .limit(CANDIDATE_LIMIT)
    .populate('createdBy', 'name');

  const matches = rankMatches(item, candidates).map((m) => ({
    item: toPublicItem(m.candidate, req.user._id),
    score: m.score,
    percent: m.percent,
    breakdown: m.breakdown,
  }));

  res.json({
    success: true,
    data: {
      source: { id: item._id, type: item.type, title: item.title },
      matches,
      weights: WEIGHTS,
      notice: 'A match score is a hint, not proof of ownership. Always verify before handing anything over.',
    },
  });
});
