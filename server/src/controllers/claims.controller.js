import mongoose from 'mongoose';
import ItemReport from '../models/ItemReport.js';
import Claim from '../models/Claim.js';
import Handover from '../models/Handover.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { notifySafe } from '../services/notifications.js';
import { audit, auditSafe } from '../services/audit.js';
import { isItemOwner, pagination, toClaimantClaim, toFinderClaim, toClaimSummary } from '../utils/serializers.js';

const notFound = (what = 'Claim') => new ApiError(404, `${what} not found`);
const newestFirst = { createdAt: -1, _id: -1 };
const isAdmin = (user) => user.role === 'ADMIN';
const sameId = (a, b) => String(a) === String(b);

async function findItemOr404(id) {
  if (!mongoose.isValidObjectId(id)) throw notFound('Report');
  const item = await ItemReport.findById(id);
  if (!item) throw notFound('Report');
  return item;
}

const populated = (query) => query.populate('item').populate('claimant', 'name');

export const createClaim = asyncHandler(async (req, res) => {
  const item = await findItemOr404(req.params.id);
  if (['WITHDRAWN', 'HIDDEN'].includes(item.status)) throw notFound('Report');
  if (item.type !== 'FOUND') throw new ApiError(400, 'Claims can only be submitted for found items');
  if (isItemOwner(item, req.user._id)) throw new ApiError(403, 'You cannot claim your own report');
  if (item.status !== 'ACTIVE') throw new ApiError(409, 'This item is no longer accepting claims');
  if (await Claim.exists({ item: item._id, status: 'APPROVED' })) {
    throw new ApiError(409, 'A claim for this item has already been approved');
  }

  // The claimant must answer every current question exactly once.
  const questions = new Map(item.verificationQuestions.map((q) => [String(q._id), q.question]));
  const seen = new Set();
  for (const a of req.body.answers) {
    if (!questions.has(a.questionId) || seen.has(a.questionId)) {
      throw new ApiError(400, 'Validation failed', [{ field: 'answers', message: 'Answers do not match the current questions. Reload the page and try again.' }]);
    }
    seen.add(a.questionId);
  }
  if (seen.size !== questions.size) {
    throw new ApiError(400, 'Validation failed', [{ field: 'answers', message: 'Answer every verification question' }]);
  }

  let claim;
  try {
    claim = await Claim.create({
      item: item._id,
      claimant: req.user._id,
      finder: item.createdBy,
      explanation: req.body.explanation,
      evidence: req.body.evidence,
      answers: req.body.answers.map((a) => ({ questionId: a.questionId, question: questions.get(a.questionId), answer: a.answer })),
    });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'You already have an active claim for this item');
    throw err;
  }

  // Guard against the report being withdrawn between the check above and the insert.
  const fresh = await ItemReport.findById(item._id).select('status');
  if (!fresh || fresh.status !== 'ACTIVE') {
    await Claim.updateOne({ _id: claim._id }, { status: 'WITHDRAWN', isActive: false });
    throw new ApiError(409, 'This item is no longer accepting claims');
  }

  await notifySafe(item.createdBy, {
    type: 'NEW_CLAIM',
    title: 'New claim on your found item',
    body: `Someone claimed "${item.title}". Review their answers.`,
    link: `/claims/${claim._id}`,
  });

  res.status(201).json({ success: true, data: { claim: toClaimantClaim(claim) } });
});

export const listMyClaims = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.validatedQuery;
  const filter = { claimant: req.user._id };
  if (status) filter.status = status;
  const [claims, total] = await Promise.all([
    Claim.find(filter).sort(newestFirst).skip((page - 1) * limit).limit(limit).populate('item', 'type title category location status'),
    Claim.countDocuments(filter),
  ]);
  res.json({ success: true, data: { claims: claims.map(toClaimantClaim) }, pagination: pagination(page, limit, total) });
});

export const listIncomingClaims = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.validatedQuery;
  const filter = { finder: req.user._id };
  if (status) filter.status = status;
  const [claims, total] = await Promise.all([
    Claim.find(filter).sort(newestFirst).skip((page - 1) * limit).limit(limit)
      .populate('item', 'type title category location status').populate('claimant', 'name'),
    Claim.countDocuments(filter),
  ]);
  res.json({ success: true, data: { claims: claims.map(toClaimSummary) }, pagination: pagination(page, limit, total) });
});

export const listItemClaims = asyncHandler(async (req, res) => {
  const item = await findItemOr404(req.params.id);
  if (!isItemOwner(item, req.user._id) && !isAdmin(req.user)) {
    throw new ApiError(403, 'Only the finder can review claims on this report');
  }
  if (!isItemOwner(item, req.user._id)) {
    await auditSafe(req.user, 'CLAIM_VIEWED_BY_ADMIN', { targetType: 'ITEM', targetId: item._id, summary: `Viewed the claims on "${item.title}"`, ip: req.ip });
  }
  const { status, page, limit } = req.validatedQuery;
  const filter = { item: item._id };
  if (status) filter.status = status;
  const [claims, total] = await Promise.all([
    Claim.find(filter).sort(newestFirst).skip((page - 1) * limit).limit(limit).populate('claimant', 'name'),
    Claim.countDocuments(filter),
  ]);
  const summary = { _id: item._id, title: item.title, type: item.type, category: item.category, location: item.location, status: item.status };
  res.json({
    success: true,
    data: { claims: claims.map((c) => toFinderClaim({ ...c.toObject(), item: summary, claimant: c.claimant }, item)) },
    pagination: pagination(page, limit, total),
  });
});

/** Loads a claim and works out the caller's relationship to it. Strangers get a 404. */
async function loadClaimForParticipant(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const claim = await populated(Claim.findById(req.params.id));
  if (!claim) throw notFound();
  const isClaimant = sameId(claim.claimant._id, req.user._id);
  const isFinder = sameId(claim.finder, req.user._id) || isAdmin(req.user);
  if (!isClaimant && !isFinder) throw notFound();
  return { claim, isClaimant, isFinder };
}

export const getClaim = asyncHandler(async (req, res) => {
  const { claim, isFinder } = await loadClaimForParticipant(req);
  if (isFinder && !sameId(claim.finder, req.user._id)) {
    // An administrator is reading someone else's private claim data: leave a trace.
    await auditSafe(req.user, 'CLAIM_VIEWED_BY_ADMIN', { targetType: 'CLAIM', targetId: claim._id, summary: `Viewed the claim on "${claim.item.title}"`, ip: req.ip });
  }
  const handover = await Handover.findOne({ claim: claim._id }).select('status');
  res.json({
    success: true,
    data: {
      claim: isFinder ? toFinderClaim(claim) : toClaimantClaim(claim),
      viewAs: isFinder ? 'FINDER' : 'CLAIMANT',
      // Only the two parties of the claim may start or open the handover (administrators are read-only).
      canHandover: sameId(claim.finder, req.user._id) || sameId(claim.claimant._id, req.user._id),
      handover: handover ? { id: handover._id, status: handover.status } : null,
    },
  });
});

export const decideClaim = asyncHandler(async (req, res) => {
  const { claim, isFinder } = await loadClaimForParticipant(req);
  if (!isFinder) throw new ApiError(403, 'Only the finder can decide on this claim');
  if (claim.status !== 'PENDING') throw new ApiError(409, `This claim is already ${claim.status.toLowerCase()}`);
  if (claim.item.status !== 'ACTIVE') throw new ApiError(409, 'The item is no longer active');

  const { decision, reviewNote } = req.body;
  let updated;
  try {
    // Conditional on PENDING so two simultaneous decisions cannot both succeed. Approving also hits the
    // unique "one approved claim per item" index, so two different claims cannot both be approved.
    updated = await Claim.findOneAndUpdate(
      { _id: claim._id, status: 'PENDING' },
      { $set: { status: decision, reviewNote, decidedAt: new Date(), decidedBy: req.user._id, isActive: decision === 'APPROVED' } },
      { new: true },
    );
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'Another claim for this item has already been approved');
    throw err;
  }
  if (!updated) throw new ApiError(409, 'This claim has already been decided');

  if (!sameId(claim.finder, req.user._id)) {
    await audit(req.user, 'CLAIM_DECIDED_BY_ADMIN', {
      targetType: 'CLAIM', targetId: updated._id, summary: `${decision === 'APPROVED' ? 'Approved' : 'Rejected'} the claim on "${claim.item.title}"`, ip: req.ip,
    });
  }
  const approved = decision === 'APPROVED';
  await notifySafe(updated.claimant, {
    type: approved ? 'CLAIM_APPROVED' : 'CLAIM_REJECTED',
    title: approved ? 'Your claim was approved' : 'Your claim was rejected',
    body: `Your claim on "${claim.item.title}" was ${approved ? 'approved' : 'rejected'}.${reviewNote ? ` Note: ${reviewNote}` : ''}`,
    link: `/claims/${updated._id}`,
  });

  const fresh = await populated(Claim.findById(updated._id));
  res.json({
    success: true,
    data: { claim: toFinderClaim(fresh), viewAs: 'FINDER', canHandover: sameId(fresh.finder, req.user._id), handover: null },
  });
});

export const withdrawClaim = asyncHandler(async (req, res) => {
  const { claim, isClaimant } = await loadClaimForParticipant(req);
  if (!isClaimant) throw new ApiError(403, 'Only the claimant can withdraw a claim');
  const updated = await Claim.findOneAndUpdate(
    { _id: claim._id, status: 'PENDING' },
    { $set: { status: 'WITHDRAWN', isActive: false } },
    { new: true },
  ).populate('item', 'type title category location status');
  if (!updated) throw new ApiError(409, 'Only pending claims can be withdrawn');
  res.json({ success: true, data: { claim: toClaimantClaim(updated), viewAs: 'CLAIMANT' } });
});
