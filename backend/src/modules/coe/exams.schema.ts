/**
 * Exam schedule validation (Phase 3a).
 *
 * `.strict()` everywhere, as the mass-assignment defence. The handlers this
 * replaces passed `req.body` straight into Prisma, so every column was writable
 * — including `marksEntered`, `resultsPublished` and `status`. An exam could be
 * marked published with no marks entered, by anyone who could reach the route.
 *
 * The update schema deliberately does NOT accept `marksEntered` or
 * `resultsPublished`. Those are consequences of work done elsewhere (marks
 * entry, result publication), not attributes a client may assert. Letting a
 * caller set them is how a progress figure stops meaning anything.
 */

import { z } from 'zod';

/**
 * `evaluation` is a legacy synonym for `mark_entry` — see migration 0027. It is
 * accepted on read and rejected on write, so nothing new enters the table with
 * it while existing rows stay valid.
 */
export const EXAM_STATUSES = [
  'scheduling',
  'ongoing',
  'mark_entry',
  'moderation',
  'completed',
  'published'
] as const;

const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date');

export const createExamSchema = z
  .object({
    examName: z.string().trim().min(3).max(120),
    semester: z.string().trim().min(1).max(20),
    program: z.string().trim().min(1).max(120),
    totalStudents: z.coerce.number().int().min(0).max(100000),
    startDate: isoDate,
    endDate: isoDate,
    coordinator: z.string().trim().min(2).max(120).optional()
  })
  .strict()
  .refine((v) => Date.parse(v.endDate) >= Date.parse(v.startDate), {
    message: 'endDate cannot fall before startDate',
    path: ['endDate']
  });

export const updateExamSchema = z
  .object({
    examName: z.string().trim().min(3).max(120).optional(),
    semester: z.string().trim().min(1).max(20).optional(),
    program: z.string().trim().min(1).max(120).optional(),
    totalStudents: z.coerce.number().int().min(0).max(100000).optional(),
    startDate: isoDate.optional(),
    endDate: isoDate.optional(),
    coordinator: z.string().trim().min(2).max(120).optional(),
    status: z.enum(EXAM_STATUSES).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

export type CreateExamInput = z.infer<typeof createExamSchema>;
export type UpdateExamInput = z.infer<typeof updateExamSchema>;
