/**
 * Validation schemas for the 11 `placements.ts` write handlers still on an
 * unvalidated `req.body` (Phase 3c completion). Same rationale as
 * `modules/hod/hod.schemas.ts`.
 *
 * `POST /students` is the highest-stakes handler in this file: it creates a
 * real user account with a login. `email` is validated as an email address
 * here for the first time — previously any string was stored as a login
 * identifier.
 *
 * `package` on a placement drive is a free-text String column (`"12 LPA"`,
 * `"₹8,00,000"`), not a number — the handler already accepts either a plain
 * value or a `{ raw, ctc }` object and stringifies whichever is present, and
 * the schema preserves that rather than forcing a shape the column was never
 * given.
 *
 * `POST /messages` intentionally keeps BOTH names of each synonym pair
 * (`title`/`subject`, `content`/`message`, `type`/`channel`, `targetGroup`/
 * `targetAudience`) as separate optional fields, because the handler itself
 * reads either with `??` — narrowing to one name would reject a caller
 * currently accepted through the other.
 */

import { z } from 'zod';
import { entityId } from '../../schemas/common.js';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional();

/** A drive's `package` column: free text, accepted as a string, a number, or `{ raw|ctc }`. */
const packageValue = z.union([
  z.string().trim().max(60),
  z.coerce.number(),
  z.object({ raw: z.union([z.string(), z.number()]).optional(), ctc: z.union([z.string(), z.number()]).optional() }).passthrough()
]);

/** POST /students (placements onboarding) — creates a real login. */
export const placementStudentCreateSchema = z
  .object({
    name: trimmed(200),
    email: z.string().trim().toLowerCase().email().max(200),
    rollNumber: trimmed(60),
    password: z.string().min(8).max(200).optional(),
    // Without this the created User has no departmentId, and every
    // department-scoped view — GET /hod/students filters on it — is blind to
    // the student forever. `branch` is free text and cannot stand in for the
    // foreign key.
    departmentId: entityId.optional(),
    program: optionalTrimmed(120),
    branch: optionalTrimmed(120),
    semester: z.coerce.number().int().min(1).max(20).optional(),
    section: optionalTrimmed(20),
    batch: optionalTrimmed(20),
    admissionYear: z.coerce.number().int().min(2000).max(2100).optional(),
    cgpa: z.coerce.number().min(0).max(10).optional(),
    totalCredits: z.coerce.number().int().min(0).max(1000).optional(),
    earnedCredits: z.coerce.number().int().min(0).max(1000).optional()
  })
  .strict();

/** POST /companies. */
export const companyCreateSchema = z
  .object({
    name: trimmed(200),
    industry: optionalTrimmed(120),
    email: z.string().trim().toLowerCase().email().max(200).optional(),
    // The form sends null when the website is left blank; that was refused.
    website: optionalTrimmed(300).nullable(),
    totalHires: z.coerce.number().int().min(0).max(1000000).optional()
  })
  .strict();

/** PUT /companies/:id — every field optional, `undefined`-checked in the handler. */
export const companyUpdateSchema = z
  .object({
    name: optionalTrimmed(200),
    industry: optionalTrimmed(120),
    email: z.string().trim().toLowerCase().email().max(200).optional(),
    website: z.string().trim().max(300).nullable().optional(),
    totalHires: z.coerce.number().int().min(0).max(1000000).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /drives. */
export const driveCreateSchema = z
  .object({
    companyId: trimmed(200),
    role: optionalTrimmed(200),
    jobRole: optionalTrimmed(200),
    package: packageValue.optional(),
    driveDate: z.coerce.date().optional(),
    date: z.coerce.date().optional(),
    registrationDeadline: z.coerce.date().optional(),
    status: optionalTrimmed(40),
    location: optionalTrimmed(200),
    venue: optionalTrimmed(200),
    jobDescription: optionalTrimmed(10000)
  })
  .strict()
  .refine((v) => v.driveDate !== undefined || v.date !== undefined, {
    message: 'driveDate or date is required',
    path: ['driveDate']
  });

/** PUT /drives/:id — every field optional. */
export const driveUpdateSchema = z
  .object({
    companyId: optionalTrimmed(200),
    role: optionalTrimmed(200),
    jobRole: optionalTrimmed(200),
    package: packageValue.optional(),
    driveDate: z.coerce.date().optional(),
    date: z.coerce.date().optional(),
    registrationDeadline: z.coerce.date().optional(),
    status: optionalTrimmed(40),
    location: optionalTrimmed(200),
    venue: optionalTrimmed(200),
    jobDescription: optionalTrimmed(10000)
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** PUT /drives/:driveId/applications/:applicationId — already checked manually; formalised here. */
export const applicationStatusUpdateSchema = z
  .object({
    status: z.enum(['applied', 'shortlisted', 'selected', 'rejected'])
  })
  .strict();

/** POST /training. */
export const trainingCreateSchema = z
  .object({
    title: optionalTrimmed(300),
    type: optionalTrimmed(60),
    instructor: optionalTrimmed(200),
    date: z.coerce.date(),
    duration: z.coerce.number().int().min(1).max(10000).optional(),
    venue: optionalTrimmed(200),
    maxCapacity: z.coerce.number().int().min(0).max(1000000).optional(),
    registeredCount: z.coerce.number().int().min(0).max(1000000).optional(),
    status: optionalTrimmed(40),
    description: optionalTrimmed(10000),
    materials: z.array(z.unknown()).max(200).optional()
  })
  .strict();

/** PUT /training/:id — every field optional. */
export const trainingUpdateSchema = z
  .object({
    title: optionalTrimmed(300),
    type: optionalTrimmed(60),
    instructor: optionalTrimmed(200),
    date: z.coerce.date().optional(),
    duration: z.coerce.number().int().min(1).max(10000).optional(),
    venue: optionalTrimmed(200),
    maxCapacity: z.coerce.number().int().min(0).max(1000000).optional(),
    registeredCount: z.coerce.number().int().min(0).max(1000000).optional(),
    status: optionalTrimmed(40),
    description: z.string().trim().max(10000).nullable().optional(),
    materials: z.array(z.unknown()).max(200).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /reports/generate. */
/**
 * POST /reports/generate.
 *
 * `period` and `notes` are real inputs PlacementTraining.tsx collects (a
 * period selector and a notes textarea) and sent on two of its three report
 * buttons — both rejected by a schema that accepted only `type`. Accepted
 * here for the same reason financeReportGenerateSchema accepts
 * startDate/endDate: they are what the screen actually sends.
 */
export const placementReportGenerateSchema = z
  .object({
    type: optionalTrimmed(60),
    period: optionalTrimmed(60),
    notes: optionalTrimmed(4000)
  })
  .strict();

/** POST /messages (placements) — see file header on the synonym pairs. */
export const placementMessageCreateSchema = z
  .object({
    title: optionalTrimmed(300),
    subject: optionalTrimmed(300),
    content: optionalTrimmed(10000),
    message: optionalTrimmed(10000),
    type: optionalTrimmed(40),
    channel: optionalTrimmed(40),
    targetGroup: optionalTrimmed(120),
    targetAudience: optionalTrimmed(120)
  })
  .strict();

/** POST /communication/templates. */
export const communicationTemplateCreateSchema = z
  .object({
    name: optionalTrimmed(200),
    category: optionalTrimmed(60),
    desc: optionalTrimmed(2000)
  })
  .strict();
