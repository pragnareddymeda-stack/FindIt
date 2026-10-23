import { z } from 'zod';
import { CLAIM_STATUSES } from '../models/Claim.js';

export const createClaimSchema = z.object({
  explanation: z.string().trim().min(10, 'Explain why this item is yours (at least 10 characters)').max(1000),
  answers: z
    .array(
      z.object({
        questionId: z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid question'),
        answer: z.string().trim().min(1, 'Answer every question').max(300),
      }),
    )
    .min(1, 'Answer the verification questions')
    .max(5),
  evidence: z.string().trim().max(500).optional().default(''),
});

export const decisionSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED'], { errorMap: () => ({ message: 'Decision must be APPROVED or REJECTED' }) }),
  reviewNote: z.string().trim().max(500).optional().default(''),
});

export const claimListQuerySchema = z.object({
  status: z.enum(CLAIM_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
