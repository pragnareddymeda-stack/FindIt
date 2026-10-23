import mongoose from 'mongoose';
import User from '../models/User.js';
import ItemReport, { CATEGORIES } from '../models/ItemReport.js';
import Claim from '../models/Claim.js';
import Handover from '../models/Handover.js';
import AbuseReport from '../models/AbuseReport.js';
import AuditLog from '../models/AuditLog.js';
import { ApiError } from '../utils/ApiError.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { escapeRegex } from '../utils/escapeRegex.js';
import { audit } from '../services/audit.js';
import { notifySafe } from '../services/notifications.js';
import { pagination, toAdminUser, toAdminItem, toAbuseReport, toAuditLog, toHandover } from '../utils/serializers.js';

const sameId = (a, b) => String(a) === String(b);
const newestFirst = { createdAt: -1, _id: -1 };
const validId = (id, what) => {
  if (!mongoose.isValidObjectId(id)) throw new ApiError(404, `${what} not found`);
};

// ---------- dashboard (every number comes from the database) ----------
export const dashboard = asyncHandler(async (_req, res) => {
  const [totalUsers, suspendedUsers, activeLost, activeFound, pendingClaims, returned, openDisputes, openAbuse, flaggedItemIds, grouped] =
    await Promise.all([
      User.countDocuments(),
      User.countDocuments({ status: 'SUSPENDED' }),
      ItemReport.countDocuments({ type: 'LOST', status: 'ACTIVE' }),
      ItemReport.countDocuments({ type: 'FOUND', status: 'ACTIVE' }),
      Claim.countDocuments({ status: 'PENDING' }),
      ItemReport.countDocuments({ status: 'RETURNED' }),
      Handover.countDocuments({ status: 'DISPUTED' }),
      AbuseReport.countDocuments({ status: 'OPEN' }),
      AbuseReport.distinct('item', { status: 'OPEN' }),
      ItemReport.aggregate([
        { $match: { status: { $nin: ['WITHDRAWN', 'HIDDEN'] } } },
        { $group: { _id: { category: '$category', type: '$type' }, count: { $sum: 1 } } },
      ]),
    ]);

  const byCategory = new Map(CATEGORIES.map((c) => [c, { category: c, lost: 0, found: 0, total: 0 }]));
  for (const g of grouped) {
    const row = byCategory.get(g._id.category);
    if (!row) continue;
    row[g._id.type === 'LOST' ? 'lost' : 'found'] += g.count;
    row.total += g.count;
  }

  res.json({
    success: true,
    data: {
      totals: {
        users: totalUsers,
        suspendedUsers,
        activeLost,
        activeFound,
        pendingClaims,
        successfulReturns: returned,
        awaitingModeration: flaggedItemIds.length,
        openDisputes,
        openAbuseReports: openAbuse,
      },
      categories: [...byCategory.values()].sort((a, b) => b.total - a.total),
      generatedAt: new Date().toISOString(),
    },
  });
});

// ---------- users ----------
export const listUsers = asyncHandler(async (req, res) => {
  const { q, role, status, page, limit } = req.validatedQuery;
  const filter = {};
  if (role) filter.role = role;
  if (status) filter.status = status;
  if (q) {
    const rx = new RegExp(escapeRegex(q), 'i');
    filter.$or = [{ name: rx }, { email: rx }];
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort(newestFirst).skip((page - 1) * limit).limit(limit),
    User.countDocuments(filter),
  ]);
  res.json({ success: true, data: { users: users.map(toAdminUser) }, pagination: pagination(page, limit, total) });
});

export const setUserStatus = asyncHandler(async (req, res) => {
  validId(req.params.id, 'User');
  const target = await User.findById(req.params.id);
  if (!target) throw new ApiError(404, 'User not found');
  if (sameId(target._id, req.user._id)) throw new ApiError(403, 'You cannot change your own account status');
  if (target.role === 'ADMIN') throw new ApiError(403, 'Administrator accounts cannot be suspended from here');

  const { status, reason } = req.body;
  if (target.status === status) throw new ApiError(409, `This account is already ${status.toLowerCase()}`);

  const updated = await User.findOneAndUpdate({ _id: target._id, role: 'USER', status: { $ne: status } }, { $set: { status } }, { new: true });
  if (!updated) throw new ApiError(409, 'This account was just changed. Reload and try again.');

  await audit(req.user, status === 'SUSPENDED' ? 'USER_SUSPENDED' : 'USER_REACTIVATED', {
    targetType: 'USER',
    targetId: updated._id,
    summary: `${status === 'SUSPENDED' ? 'Suspended' : 'Reactivated'} ${updated.name}${reason ? `: ${reason}` : ''}`,
    ip: req.ip,
  });
  res.json({ success: true, data: { user: toAdminUser(updated) } });
});

// ---------- report moderation ----------
async function openAbuseCounts(ids) {
  const rows = await AbuseReport.aggregate([
    { $match: { item: { $in: ids }, status: 'OPEN' } },
    { $group: { _id: '$item', count: { $sum: 1 } } },
  ]);
  return new Map(rows.map((r) => [String(r._id), r.count]));
}

export const listReports = asyncHandler(async (req, res) => {
  const { status, type, flagged, q, page, limit } = req.validatedQuery;
  const filter = {};
  if (status) filter.status = status;
  if (type) filter.type = type;
  if (q) filter.$text = { $search: q };
  if (flagged === 'true') filter._id = { $in: await AbuseReport.distinct('item', { status: 'OPEN' }) };

  const [items, total] = await Promise.all([
    ItemReport.find(filter).select('-privateDetails -verificationQuestions').sort(newestFirst).skip((page - 1) * limit).limit(limit).populate('createdBy', 'name'),
    ItemReport.countDocuments(filter),
  ]);
  const counts = await openAbuseCounts(items.map((i) => i._id));
  res.json({
    success: true,
    data: { reports: items.map((i) => toAdminItem(i, counts.get(String(i._id)) || 0)) },
    pagination: pagination(page, limit, total),
  });
});

export const moderateReport = asyncHandler(async (req, res) => {
  validId(req.params.id, 'Report');
  const item = await ItemReport.findById(req.params.id).select('-privateDetails -verificationQuestions');
  if (!item) throw new ApiError(404, 'Report not found');

  const { action, reason } = req.body;
  const hide = action === 'HIDE';
  const updated = await ItemReport.findOneAndUpdate(
    { _id: item._id, status: hide ? 'ACTIVE' : 'HIDDEN' },
    { $set: { status: hide ? 'HIDDEN' : 'ACTIVE' } },
    { new: true },
  ).select('-privateDetails -verificationQuestions').populate('createdBy', 'name');
  if (!updated) throw new ApiError(409, hide ? 'Only active reports can be hidden' : 'Only hidden reports can be restored');

  if (hide) {
    // Complaints about a listing that is now hidden are dealt with.
    await AbuseReport.updateMany(
      { item: item._id, status: 'OPEN' },
      { $set: { status: 'RESOLVED', resolvedBy: req.user._id, resolvedAt: new Date(), resolutionNote: 'The listing was hidden by a moderator.' } },
    );
  }

  await audit(req.user, hide ? 'REPORT_HIDDEN' : 'REPORT_UNHIDDEN', {
    targetType: 'ITEM',
    targetId: updated._id,
    summary: `${hide ? 'Hid' : 'Restored'} report "${updated.title}"${reason ? `: ${reason}` : ''}`,
    ip: req.ip,
  });
  await notifySafe(updated.createdBy._id, {
    type: 'MODERATION_ACTION',
    title: hide ? 'Your report was hidden by a moderator' : 'Your report was restored',
    body: hide ? `"${updated.title}" is no longer public. Reason: ${reason}` : `"${updated.title}" is visible again.`,
    link: `/items/${updated._id}`,
  });

  res.json({ success: true, data: { report: toAdminItem(updated, 0) } });
});

// ---------- abuse reports ----------
export const listAbuseReports = asyncHandler(async (req, res) => {
  const { status, page, limit } = req.validatedQuery;
  const filter = { status };
  const [rows, total] = await Promise.all([
    AbuseReport.find(filter).sort(newestFirst).skip((page - 1) * limit).limit(limit)
      .populate('reporter', 'name').populate('item', 'title type status'),
    AbuseReport.countDocuments(filter),
  ]);
  res.json({ success: true, data: { abuseReports: rows.map(toAbuseReport) }, pagination: pagination(page, limit, total) });
});

export const decideAbuseReport = asyncHandler(async (req, res) => {
  validId(req.params.id, 'Abuse report');
  const { status, note } = req.body;
  const updated = await AbuseReport.findOneAndUpdate(
    { _id: req.params.id, status: 'OPEN' },
    { $set: { status, resolutionNote: note, resolvedBy: req.user._id, resolvedAt: new Date() } },
    { new: true },
  ).populate('reporter', 'name').populate('item', 'title type status');
  if (!updated) {
    if (!(await AbuseReport.exists({ _id: req.params.id }))) throw new ApiError(404, 'Abuse report not found');
    throw new ApiError(409, 'This abuse report has already been handled');
  }
  await audit(req.user, status === 'RESOLVED' ? 'ABUSE_REPORT_RESOLVED' : 'ABUSE_REPORT_DISMISSED', {
    targetType: 'ABUSE_REPORT',
    targetId: updated._id,
    summary: `${status === 'RESOLVED' ? 'Resolved' : 'Dismissed'} a ${updated.reason.toLowerCase().replace('_', ' ')} complaint about "${updated.item?.title ?? 'a listing'}"${note ? `: ${note}` : ''}`,
    ip: req.ip,
  });
  res.json({ success: true, data: { abuseReport: toAbuseReport(updated) } });
});

// ---------- disputes ----------
const withRefs = (query) =>
  query.populate('item', 'type title category location status').populate('finder', 'name').populate('claimant', 'name');

export const listDisputes = asyncHandler(async (req, res) => {
  const { state, page, limit } = req.validatedQuery;
  const open = { status: 'DISPUTED' };
  const resolved = { resolvedBy: { $exists: true } };
  const filter = state === 'open' ? open : state === 'resolved' ? resolved : { $or: [open, resolved] };
  const [rows, total] = await Promise.all([
    withRefs(Handover.find(filter).sort({ updatedAt: -1, _id: -1 }).skip((page - 1) * limit).limit(limit)),
    Handover.countDocuments(filter),
  ]);
  res.json({
    success: true,
    data: { disputes: rows.map((h) => toHandover(h, 'ADMIN', [])) },
    pagination: pagination(page, limit, total),
  });
});

export const resolveDispute = asyncHandler(async (req, res) => {
  validId(req.params.id, 'Dispute');
  const { resolution, note } = req.body;
  const complete = resolution === 'COMPLETE';
  const now = new Date();
  const status = complete ? 'COMPLETED' : 'CANCELLED';

  const updated = await Handover.findOneAndUpdate(
    { _id: req.params.id, status: 'DISPUTED' }, // conditional: two admins cannot both resolve it
    {
      $set: { status, resolvedBy: req.user._id, resolvedAt: now, resolutionNote: note, ...(complete ? { confirmedAt: now } : { cancelledAt: now, cancelledBy: req.user._id }) },
      $push: { history: { status, actor: req.user._id, role: 'ADMIN', at: now, note } },
    },
    { new: true },
  );
  if (!updated) {
    if (!(await Handover.exists({ _id: req.params.id }))) throw new ApiError(404, 'Dispute not found');
    throw new ApiError(409, 'This handover is not in dispute');
  }

  if (complete) {
    await ItemReport.updateOne({ _id: updated.item, status: { $in: ['ACTIVE', 'HIDDEN'] } }, { $set: { status: 'RETURNED' } });
  } else {
    await Claim.updateOne(
      { _id: updated.claim, status: 'APPROVED' },
      { $set: { status: 'REJECTED', isActive: false, reviewNote: 'An administrator cancelled the handover after a dispute.', decidedAt: now, decidedBy: req.user._id } },
    );
  }

  const fresh = await withRefs(Handover.findById(updated._id));
  await audit(req.user, 'DISPUTE_RESOLVED', {
    targetType: 'HANDOVER',
    targetId: updated._id,
    summary: `${complete ? 'Marked as returned' : 'Cancelled'} the disputed handover of "${fresh.item?.title ?? 'an item'}": ${note}`,
    ip: req.ip,
  });
  for (const party of [updated.finder, updated.claimant]) {
    await notifySafe(party, {
      type: 'DISPUTE_UPDATE',
      title: 'Your dispute was resolved',
      body: `An administrator ${complete ? 'marked the item as returned' : 'cancelled the handover'}. Note: ${note}`,
      link: `/handovers/${updated._id}`,
    });
  }
  res.json({ success: true, data: { dispute: toHandover(fresh, 'ADMIN', []) } });
});

// ---------- audit logs (read-only) ----------
export const listAuditLogs = asyncHandler(async (req, res) => {
  const { action, page, limit } = req.validatedQuery;
  const filter = action ? { action } : {};
  const [rows, total] = await Promise.all([
    AuditLog.find(filter).sort(newestFirst).skip((page - 1) * limit).limit(limit).populate('actor', 'name'),
    AuditLog.countDocuments(filter),
  ]);
  res.json({ success: true, data: { logs: rows.map(toAuditLog) }, pagination: pagination(page, limit, total) });
});
