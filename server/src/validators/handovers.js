import { z } from 'zod';
import { HANDOVER_STATUSES } from '../models/Handover.js';

const DAY_MS = 24 * 60 * 60 * 1000;

const meetingTime = z.coerce
  .date({ errorMap: () => ({ message: 'Enter a valid date and time' }) })
  .refine((d) => d.getTime() > Date.now(), 'Meeting time must be in the future')
  .refine((d) => d.getTime() <= Date.now() + 60 * DAY_MS, 'Meeting time must be within the next 60 days');

export const handoverStatusSchema = z.discriminatedUnion('status', [
  z.object({
    status: z.literal('SCHEDULED'),
    meetingTime,
    meetingPlace: z.string().trim().min(2, 'Enter a general meeting place').max(100),
    note: z.string().trim().max(300).optional().default(''),
  }),
  z.object({ status: z.literal('HANDED_OVER') }),
  z.object({ status: z.literal('COMPLETED') }),
  z.object({ status: z.literal('DISPUTED'), reason: z.string().trim().min(10, 'Describe what went wrong (at least 10 characters)').max(500) }),
  z.object({ status: z.literal('CANCELLED'), reason: z.string().trim().max(300).optional().default('') }),
]);

export const handoverListQuerySchema = z.object({
  status: z.enum(HANDOVER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
