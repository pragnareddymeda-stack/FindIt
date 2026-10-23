import { z } from 'zod';
import { ITEM_TYPES, ITEM_STATUSES } from '../models/ItemReport.js';
import { ABUSE_REASONS } from '../models/AbuseReport.js';
import { AUDIT_ACTIONS } from '../models/AuditLog.js';

const paging = (defaultLimit = 20) => ({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(defaultLimit),
});
const reason = (min, label = 'Give a reason') => z.string().trim().min(min, `${label} (at least ${min} characters)`).max(300);

export const adminUsersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['USER', 'ADMIN']).optional(),
  status: z.enum(['ACTIVE', 'SUSPENDED']).optional(),
  ...paging(),
});

export const userStatusSchema = z.discriminatedUnion('status', [
  z.object({ status: z.literal('SUSPENDED'), reason: reason(5, 'Explain why the account is being suspended') }),
  z.object({ status: z.literal('ACTIVE'), reason: z.string().trim().max(300).optional().default('') }),
]);

export const adminReportsQuery = z.object({
  status: z.enum(ITEM_STATUSES).optional(),
  type: z.enum(ITEM_TYPES).optional(),
  flagged: z.enum(['true', 'false']).optional(),
  q: z.string().trim().max(100).optional(),
  ...paging(),
});

export const moderationSchema = z.discriminatedUnion('action', [
  z.object({ action: z.literal('HIDE'), reason: reason(5, 'Explain why the report is being hidden') }),
  z.object({ action: z.literal('UNHIDE'), reason: z.string().trim().max(300).optional().default('') }),
]);

export const abuseListQuery = z.object({
  status: z.enum(['OPEN', 'RESOLVED', 'DISMISSED']).default('OPEN'),
  ...paging(),
});

export const abuseDecisionSchema = z.object({
  status: z.enum(['RESOLVED', 'DISMISSED']),
  note: z.string().trim().max(300).optional().default(''),
});

export const disputesQuery = z.object({
  state: z.enum(['open', 'resolved', 'all']).default('open'),
  ...paging(),
});

export const disputeResolutionSchema = z.object({
  resolution: z.enum(['COMPLETE', 'CANCEL']),
  note: reason(5, 'Explain your decision'),
});

export const auditQuery = z.object({
  action: z.enum(AUDIT_ACTIONS).optional(),
  ...paging(25),
});

export const createAbuseReportSchema = z.object({
  reason: z.enum(ABUSE_REASONS, { errorMap: () => ({ message: 'Choose a reason' }) }),
  details: z.string().trim().max(500).optional().default(''),
});
