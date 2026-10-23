import { z } from 'zod';
import { todayISO } from './format.js';

const email = z.string().trim().toLowerCase().email('Enter a valid email address');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z
  .object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name must be at most 60 characters'),
    email,
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .max(72, 'Password must be at most 72 characters')
      .regex(/[A-Za-z]/, 'Password must include a letter')
      .regex(/\d/, 'Password must include a number'),
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, { path: ['confirmPassword'], message: 'Passwords do not match' });

export const profileSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(60, 'Name must be at most 60 characters'),
  phone: z.string().trim().regex(/^\+?[\d\s-]{7,19}$/, 'Enter a valid phone number').or(z.literal('')),
});

export function buildReportSchema(type) {
  const base = {
    title: z.string().trim().min(3, 'Title must be at least 3 characters').max(100, 'Title must be at most 100 characters'),
    category: z.string().min(1, 'Choose a category'),
    description: z.string().trim().min(10, 'Describe the item in at least 10 characters').max(1000, 'Description must be at most 1000 characters'),
    dateOccurred: z
      .string()
      .min(1, 'Enter the date')
      .refine((v) => v <= todayISO(), 'Date cannot be in the future'),
    approxTime: z.string().optional(),
    location: z.string().trim().min(2, 'Enter a general location').max(100, 'Location must be at most 100 characters'),
    contactPreference: z.enum(['IN_APP', 'EMAIL', 'PHONE']),
  };
  if (type === 'FOUND') {
    return z.object({
      ...base,
      privateDetails: z.string().trim().max(500, 'Private details must be at most 500 characters').optional(),
      verificationQuestions: z
        .array(
          z.object({
            question: z.string().trim().min(5, 'Question must be at least 5 characters').max(200, 'Question must be at most 200 characters'),
            expectedAnswer: z.string().trim().max(200, 'Answer must be at most 200 characters').optional(),
          }),
        )
        .min(1, 'Add at least one verification question')
        .max(5, 'You can add at most 5 questions'),
    });
  }
  return z.object(base);
}

export const claimSchema = z.object({
  explanation: z.string().trim().min(10, 'Explain why this item is yours (at least 10 characters)').max(1000, 'Explanation must be at most 1000 characters'),
  answers: z.array(
    z.object({
      questionId: z.string(),
      answer: z.string().trim().min(1, 'Answer this question').max(300, 'Answer must be at most 300 characters'),
    }),
  ),
  evidence: z.string().trim().max(500, 'Evidence must be at most 500 characters').optional(),
});

export const scheduleSchema = z.object({
  meetingTime: z
    .string()
    .min(1, 'Choose a date and time')
    .refine((v) => new Date(v).getTime() > Date.now(), 'Meeting time must be in the future')
    .refine((v) => new Date(v).getTime() <= Date.now() + 60 * 24 * 60 * 60 * 1000, 'Meeting time must be within the next 60 days'),
  meetingPlace: z.string().trim().min(2, 'Enter a general meeting place').max(100, 'Place must be at most 100 characters'),
  note: z.string().trim().max(300, 'Note must be at most 300 characters').optional(),
});

export const disputeSchema = z.object({
  reason: z.string().trim().min(10, 'Describe what went wrong (at least 10 characters)').max(500, 'Reason must be at most 500 characters'),
});
