/**
 * Validation schemas for the 5 `iqac.ts` write handlers still on an
 * unvalidated `req.body` (Phase 3c completion). Same rationale as
 * `modules/hod/hod.schemas.ts`.
 *
 * Two of these already had a manual date-parse guard
 * (`toDateOrUndefined(...) || 400`) — that check is now redundant once the
 * schema requires a valid date, but is left in place rather than removed,
 * since it is harmless and this sweep's job is validation coverage, not a
 * rewrite of working handlers.
 */

import { z } from 'zod';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional();
const jsonValue = z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]);

/** POST /feedback/create-form. */
export const feedbackFormCreateSchema = z
  .object({
    title: optionalTrimmed(300),
    status: optionalTrimmed(40),
    deadline: z.coerce.date(),
    courseId: optionalTrimmed(200)
  })
  .strict();

/** POST /reports/generate — `academicYear` is @unique, so a duplicate 400s cleanly instead of a raw 500. */
export const aqarGenerateSchema = z
  .object({
    academicYear: trimmed(20)
  })
  .strict();

/** PUT /reports/:id — every field optional. */
export const aqarUpdateSchema = z
  .object({
    academicYear: optionalTrimmed(20),
    institutionDetails: jsonValue.nullable().optional(),
    criteria: jsonValue.nullable().optional(),
    keyIndicators: jsonValue.nullable().optional(),
    bestPractices: jsonValue.nullable().optional(),
    distinctiveFeatures: jsonValue.nullable().optional(),
    status: optionalTrimmed(40),
    submissionDate: z.coerce.date().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /meetings (IQAC). */
export const iqacMeetingCreateSchema = z
  .object({
    title: optionalTrimmed(300),
    date: z.coerce.date(),
    venue: optionalTrimmed(200),
    agenda: z.array(z.unknown()).max(200).optional(),
    attendees: z.array(z.unknown()).max(500).optional(),
    chairperson: optionalTrimmed(200),
    decisions: z.array(z.unknown()).max(200).optional(),
    actionItems: z.array(z.unknown()).max(200).optional(),
    nextMeetingDate: z.coerce.date().optional(),
    status: optionalTrimmed(40),
    documentsShared: z.array(z.unknown()).max(200).optional()
  })
  .strict();

/** PUT /meetings/:id (IQAC) — every field optional. */
export const iqacMeetingUpdateSchema = z
  .object({
    title: optionalTrimmed(300),
    date: z.coerce.date().optional(),
    venue: optionalTrimmed(200),
    agenda: z.array(z.unknown()).max(200).optional(),
    attendees: z.array(z.unknown()).max(500).optional(),
    chairperson: optionalTrimmed(200),
    minutes: z.string().trim().max(20000).nullable().optional(),
    decisions: z.array(z.unknown()).max(200).optional(),
    actionItems: z.array(z.unknown()).max(200).optional(),
    nextMeetingDate: z.coerce.date().optional(),
    status: optionalTrimmed(40),
    documentsShared: z.array(z.unknown()).max(200).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });
