import mongoose from 'mongoose';
import ItemReport from '../models/ItemReport.js';
import Claim from '../models/Claim.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { toPublicItem, toOwnerItem, isItemOwner, pagination } from '../utils/serializers.js';

const notFound = () => new ApiError(404, 'Report not found');

async function findItem(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound();
  const item = await ItemReport.findById(id).populate('createdBy', 'name');
  if (!item) throw notFound();
  return item;
}

async function findOwnedItem(req) {
  const item = await findItem(req.params.id);
  if (!isItemOwner(item, req.user._id)) throw new ApiError(403, 'You can only modify your own reports');
  return item;
}

const newestFirst = { createdAt: -1, _id: -1 };

export const listItems = asyncHandler(async (req, res) => {
  const { type, category, q, location, from, to, status, page, limit } = req.validatedQuery;

  const filter = { status };
  if (type) filter.type = type;
  if (category) filter.category = category;
  if (q) filter.$text = { $search: q };
  if (location) filter.location = new RegExp(escapeRegex(location), 'i');
  if (from || to) {
    filter.dateOccurred = {};
    if (from) filter.dateOccurred.$gte = from;
    if (to) {
      const end = new Date(to);
      end.setUTCHours(23, 59, 59, 999);
      filter.dateOccurred.$lte = end;
    }
  }

  const [items, total] = await Promise.all([
    ItemReport.find(filter).sort(newestFirst).skip((page - 1) * limit).limit(limit).populate('createdBy', 'name'),
    ItemReport.countDocuments(filter),
  ]);

  res.json({
    success: true,
    data: { items: items.map((i) => toPublicItem(i, req.user?._id)) },
    pagination: pagination(page, limit, total),
  });
});

export const listMyItems = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.validatedQuery;
  const filter = { createdBy: req.user._id };
  if (status) filter.status = status;

  const [items, total] = await Promise.all([
    ItemReport.find(filter).sort(newestFirst).skip((page - 1) * limit).limit(limit),
    ItemReport.countDocuments(filter),
  ]);

  res.json({ success: true, data: { items: items.map(toOwnerItem) }, pagination: pagination(page, limit, total) });
});

export const getItem = asyncHandler(async (req, res) => {
  const item = await findItem(req.params.id);
  const owner = isItemOwner(item, req.user?._id);
  // Withdrawn or moderated reports are invisible to everyone except their creator.
  if (['WITHDRAWN', 'HIDDEN'].includes(item.status) && !owner) throw notFound();
  const payload = owner ? toOwnerItem(item) : toPublicItem(item, req.user?._id);

  if (owner && item.type === 'FOUND') {
    payload.pendingClaimCount = await Claim.countDocuments({ item: item._id, status: 'PENDING' });
  }
  // Signed-in non-owners may see the question texts (never the answers) so they can submit a claim.
  if (!owner && req.user && item.type === 'FOUND' && item.status === 'ACTIVE') {
    payload.claimQuestions = item.verificationQuestions.map((q) => ({ id: q._id, question: q.question }));
    const mine = await Claim.findOne({ item: item._id, claimant: req.user._id, isActive: true }).select('status');
    payload.myActiveClaim = mine ? { id: mine._id, status: mine.status } : null;
  }
  res.json({ success: true, data: { item: payload } });
});

export const createItem = asyncHandler(async (req, res) => {
  // req.body is the zod-parsed, whitelisted payload; status and createdBy are set here, never by the client.
  const item = await ItemReport.create({ ...req.body, createdBy: req.user._id });
  res.status(201).json({ success: true, data: { item: toOwnerItem(item) } });
});

export const updateItem = asyncHandler(async (req, res) => {
  const item = await findOwnedItem(req);
  if (item.status !== 'ACTIVE') throw new ApiError(409, 'Only active reports can be edited');

  const changes = { ...req.body };
  if (item.type === 'LOST') {
    delete changes.privateDetails;
    delete changes.verificationQuestions;
  } else if (changes.verificationQuestions && changes.verificationQuestions.length === 0) {
    throw new ApiError(400, 'Validation failed', [{ field: 'verificationQuestions', message: 'Add at least one verification question' }]);
  }

  // Conditional on status so an edit cannot race with a withdrawal.
  const updated = await ItemReport.findOneAndUpdate(
    { _id: item._id, status: 'ACTIVE' },
    { $set: changes },
    { new: true, runValidators: true },
  );
  if (!updated) throw new ApiError(409, 'This report can no longer be edited');
  res.json({ success: true, data: { item: toOwnerItem(updated) } });
});

export const withdrawItem = asyncHandler(async (req, res) => {
  const item = await findOwnedItem(req);
  if (await Claim.exists({ item: item._id, isActive: true })) {
    throw new ApiError(409, 'Decide on or reject the open claims before withdrawing this report');
  }
  const updated = await ItemReport.findOneAndUpdate(
    { _id: item._id, status: 'ACTIVE' },
    { $set: { status: 'WITHDRAWN' } },
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'Only active reports can be withdrawn');
  res.json({ success: true, data: { item: toOwnerItem(updated) } });
});
