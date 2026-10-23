import { z } from 'zod';
import { ITEM_TYPES, CATEGORIES, CONTACT_PREFERENCES, ITEM_STATUSES, PUBLIC_STATUSES } from '../models/ItemReport.js';

const dateField = z.coerce
  .date({ errorMap: () => ({ message: 'Enter a valid date' }) })
  .refine((d) => d.getTime() <= Date.now() + 24 * 60 * 60 * 1000, 'Date cannot be in the future');

const approxTime = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Time must be in HH:MM format')
  .or(z.literal(''));

const questions = z
  .array(
    z.object({
      question: z.string().trim().min(5, 'Question must be at least 5 characters').max(200),
      expectedAnswer: z.string().trim().max(200).optional().default(''),
    }),
  )
  .max(5, 'You can add at most 5 verification questions');

const fields = {
  title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100),
  category: z.enum(CATEGORIES, { errorMap: () => ({ message: 'Choose a valid category' }) }),
  description: z.string().trim().min(10, 'Description must be at least 10 characters').max(1000),
  dateOccurred: dateField,
  approxTime,
  location: z.string().trim().min(2, 'Enter a general location').max(100),
  contactPreference: z.enum(CONTACT_PREFERENCES),
  privateDetails: z.string().trim().max(500),
  verificationQuestions: questions,
};

export const createItemSchema = z
  .object({
    type: z.enum(ITEM_TYPES),
    title: fields.title,
    category: fields.category,
    description: fields.description,
    dateOccurred: fields.dateOccurred,
    approxTime: fields.approxTime.optional(),
    location: fields.location,
    contactPreference: fields.contactPreference.default('IN_APP'),
    privateDetails: fields.privateDetails.optional(),
    verificationQuestions: fields.verificationQuestions.optional(),
  })
  .superRefine((v, ctx) => {
    if (v.type === 'FOUND' && !v.verificationQuestions?.length) {
      ctx.addIssue({ code: 'custom', path: ['verificationQuestions'], message: 'Add at least one verification question' });
    }
  })
  // Private finder-only fields make no sense on a LOST report: drop them.
  .transform((v) => (v.type === 'LOST' ? { ...v, privateDetails: undefined, verificationQuestions: undefined } : v));

// `type`, `status` and `createdBy` are deliberately absent: they can never be edited.
export const updateItemSchema = z
  .object({
    title: fields.title.optional(),
    category: fields.category.optional(),
    description: fields.description.optional(),
    dateOccurred: fields.dateOccurred.optional(),
    approxTime: fields.approxTime.optional(),
    location: fields.location.optional(),
    contactPreference: fields.contactPreference.optional(),
    privateDetails: fields.privateDetails.optional(),
    verificationQuestions: fields.verificationQuestions.optional(),
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Provide at least one field to update' });

const paging = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
};

export const listQuerySchema = z.object({
  type: z.enum(ITEM_TYPES).optional(),
  category: z.enum(CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
  location: z.string().trim().max(100).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  status: z.enum(PUBLIC_STATUSES).default('ACTIVE'),
  ...paging,
});

export const mineQuerySchema = z.object({
  status: z.enum(ITEM_STATUSES).optional(),
  ...paging,
});
