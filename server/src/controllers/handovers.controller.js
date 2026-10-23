import mongoose from 'mongoose';
import Handover, { HANDOVER_TRANSITIONS } from '../models/Handover.js';
import Claim from '../models/Claim.js';
import ItemReport from '../models/ItemReport.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { pagination, toHandover } from '../utils/serializers.js';
import { notifySafe } from '../services/notifications.js';

const sameId = (a, b) => a != null && b != null && String(a) === String(b);
const notFound = (what = 'Handover') => new ApiError(404, `${what} not found`);

const withRefs = (query) =>
  query
    .populate('item', 'type title category location status')
    .populate('finder', 'name')
    .populate('claimant', 'name');

const finderId = (h) => h.finder?._id ?? h.finder;
const claimantId = (h) => h.claimant?._id ?? h.claimant;

function roleOf(handover, user) {
  if (sameId(finderId(handover), user._id)) return 'FINDER';
  if (sameId(claimantId(handover), user._id)) return 'CLAIMANT';
  if (user.role === 'ADMIN') return 'ADMIN'; // read-only
  return null;
}

const nextActionsFor = (status, role) =>
  Object.entries(HANDOVER_TRANSITIONS)
    .filter(([, rule]) => rule.from.includes(status) && rule.actors.includes(role))
    .map(([to]) => to);

const otherParty = (handover, role) => (role === 'FINDER' ? claimantId(handover) : finderId(handover));

const STATUS_NOTICE = {
  SCHEDULED: ['HANDOVER_UPDATE', 'Meeting details updated', 'The meeting details for "%s" were set or changed.'],
  HANDED_OVER: ['HANDOVER_UPDATE', 'Handover recorded', 'The finder recorded handing over "%s". Please confirm when you have it.'],
  COMPLETED: ['HANDOVER_UPDATE', 'Receipt confirmed', 'Receipt of "%s" was confirmed. The item is marked as returned.'],
  DISPUTED: ['DISPUTE_UPDATE', 'A problem was reported', 'A problem was reported with the handover of "%s".'],
  CANCELLED: ['HANDOVER_UPDATE', 'Handover cancelled', 'The handover of "%s" was cancelled.'],
};

const present = (handover, role) => toHandover(handover, role, nextActionsFor(handover.status, role));

/** Strangers get a 404 so the existence of a handover is not revealed. */
async function loadForParticipant(req) {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound();
  const handover = await withRefs(Handover.findById(req.params.id));
  if (!handover) throw notFound();
  const role = roleOf(handover, req.user);
  if (!role) throw notFound();
  return { handover, role };
}

export const createHandover = asyncHandler(async (req, res) => {
  if (!mongoose.isValidObjectId(req.params.id)) throw notFound('Claim');
  const claim = await Claim.findById(req.params.id);
  if (!claim) throw notFound('Claim');
  const isFinder = sameId(claim.finder, req.user._id);
  const isClaimant = sameId(claim.claimant, req.user._id);
  if (!isFinder && !isClaimant) throw notFound('Claim');
  if (claim.status !== 'APPROVED') throw new ApiError(409, 'A handover can only be started for an approved claim');
  const item = await ItemReport.findById(claim.item).select('status');
  if (!item || item.status !== 'ACTIVE') throw new ApiError(409, 'The item is no longer active');

  const role = isFinder ? 'FINDER' : 'CLAIMANT';
  let handover;
  try {
    handover = await Handover.create({
      claim: claim._id,
      item: claim.item,
      finder: claim.finder,
      claimant: claim.claimant,
      history: [{ status: 'ARRANGING', actor: req.user._id, role, at: new Date() }],
    });
  } catch (err) {
    if (err.code === 11000) throw new ApiError(409, 'A handover already exists for this claim');
    throw err;
  }
  const fresh = await withRefs(Handover.findById(handover._id));
  await notifySafe(otherParty(fresh, role), {
    type: 'HANDOVER_UPDATE',
    title: 'Handover started',
    body: `A handover was started for "${fresh.item?.title}". Agree a safe place and time.`,
    link: `/handovers/${fresh._id}`,
  });
  res.status(201).json({ success: true, data: { handover: present(fresh, role) } });
});

export const listMyHandovers = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.validatedQuery;
  const filter = { $or: [{ finder: req.user._id }, { claimant: req.user._id }] };
  if (status) filter.status = status;
  const [rows, total] = await Promise.all([
    withRefs(Handover.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)),
    Handover.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: { handovers: rows.map((h) => present(h, roleOf(h, req.user))) },
    pagination: pagination(page, limit, total),
  });
});

export const getHandover = asyncHandler(async (req, res) => {
  const { handover, role } = await loadForParticipant(req);
  res.json({ success: true, data: { handover: present(handover, role) } });
});

export const updateHandoverStatus = asyncHandler(async (req, res) => {
  const { handover, role } = await loadForParticipant(req);
  const body = req.body;
  const rule = HANDOVER_TRANSITIONS[body.status];

  if (!rule.actors.includes(role)) {
    throw new ApiError(403, role === 'ADMIN' ? 'Administrators cannot change a handover' : 'You are not allowed to make this change');
  }
  if (!rule.from.includes(handover.status)) {
    throw new ApiError(409, `A handover that is ${handover.status.toLowerCase().replace('_', ' ')} cannot be changed to ${body.status.toLowerCase().replace('_', ' ')}`);
  }

  const now = new Date();
  const set = { status: body.status };
  if (body.status === 'SCHEDULED') Object.assign(set, { meetingTime: body.meetingTime, meetingPlace: body.meetingPlace, note: body.note });
  if (body.status === 'HANDED_OVER') set.handedOverAt = now;
  if (body.status === 'COMPLETED') set.confirmedAt = now;
  if (body.status === 'DISPUTED') Object.assign(set, { disputeReason: body.reason, disputedBy: req.user._id, disputedAt: now });
  if (body.status === 'CANCELLED') Object.assign(set, { cancelledBy: req.user._id, cancelledAt: now });

  // Conditional on the current status: two simultaneous changes cannot both apply.
  const updated = await Handover.findOneAndUpdate(
    { _id: handover._id, status: { $in: rule.from } },
    { $set: set, $push: { history: { status: body.status, actor: req.user._id, role, at: now, note: body.reason || '' } } },
    { new: true },
  );
  if (!updated) throw new ApiError(409, 'This handover was just changed by someone else. Reload and try again.');

  // Side effects. MongoDB transactions are not assumed (they need a replica set), so each step is a
  // conditional update ordered so that a failure leaves a state that can be retried or reconciled.
  if (body.status === 'COMPLETED') {
    // Both confirmations now exist (finder recorded it, claimant confirmed): only now is the report RETURNED.
    await ItemReport.updateOne({ _id: handover.item._id ?? handover.item, status: 'ACTIVE' }, { $set: { status: 'RETURNED' } });
  }
  if (body.status === 'CANCELLED') {
    // Release the claim so the item can be claimed again.
    const release = role === 'CLAIMANT'
      ? { status: 'WITHDRAWN', isActive: false }
      : { status: 'REJECTED', isActive: false, reviewNote: 'The finder cancelled the handover.', decidedAt: now, decidedBy: req.user._id };
    await Claim.updateOne({ _id: handover.claim, status: 'APPROVED' }, { $set: release });
  }

  const fresh = await withRefs(Handover.findById(updated._id));
  const [type, title, template] = STATUS_NOTICE[body.status];
  await notifySafe(otherParty(fresh, role), {
    type,
    title,
    body: template.replace('%s', fresh.item?.title ?? 'the item'),
    link: `/handovers/${fresh._id}`,
  });
  res.json({ success: true, data: { handover: present(fresh, role) } });
});
