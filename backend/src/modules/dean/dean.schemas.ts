/**
 * Validation schemas for the 17 `dean.ts` write handlers still on an
 * unvalidated `req.body` (Phase 3c completion). Same rationale as
 * `modules/hod/hod.schemas.ts` — these are not mass assignment, they lack
 * `.strict()`, bounds, and clean 400s on a missing required field.
 *
 * `status`/`type`/`meetingType` fields are left as bounded free text where the
 * model column is a bare `String` with no CHECK constraint and no closed set
 * in the frontend's own TypeScript types (`InterDeptEvent`, `Meeting`) —
 * inventing an enum not backed by the schema or the UI would be a guess, which
 * this project's own methodology treats as worse than no constraint. Where a
 * real closed vocabulary exists (`DisciplinaryCase.status/severity`, taken from
 * `src/types/dean.ts`), it is enforced.
 */

import { z } from 'zod';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional();

/**
 * PUT /curriculum-proposals/:id and PUT /inventory/purchase-requests/:id/status
 * — identical shape: an engine decision plus an optional note.
 */
export const deanWorkflowDecisionSchema = z
  .object({
    status: z.enum(['approved', 'rejected']),
    note: z.string().trim().max(500).optional()
  })
  .strict();

/** PUT /results/:id/approve — only an optional note; the decision itself has no other input. */
export const resultApprovalSchema = z
  .object({
    note: z.string().trim().max(500).optional()
  })
  .strict();

/**
 * PUT /disciplinary/:id.
 *
 * Vocabulary taken from `src/types/dean.ts` `DisciplinaryCase`, the frontend's
 * own type — not invented.
 */
export const disciplinaryDecisionSchema = z
  .object({
    status: z.enum(['escalated', 'under_review', 'action_taken', 'closed']).optional(),
    severity: z.enum(['minor', 'major', 'critical']).optional()
  })
  .strict();

/** POST /class-management. */
export const classManagementCreateSchema = z
  .object({
    courseId: trimmed(200),
    semester: z.coerce.number().int().min(1).max(20).optional(),
    facultyId: trimmed(200),
    section: trimmed(20),
    studentEmails: optionalTrimmed(20000),
    type: optionalTrimmed(40),
    roomId: trimmed(200),
    day: trimmed(20),
    startTime: trimmed(20),
    endTime: trimmed(20)
  })
  .strict();

/** PUT /class-management/:id — every field optional; `studentEmails` distinguishes omitted from empty. */
export const classManagementUpdateSchema = z
  .object({
    courseCode: optionalTrimmed(40),
    courseName: optionalTrimmed(200),
    credits: z.coerce.number().int().min(0).max(20).optional(),
    semester: z.coerce.number().int().min(1).max(20).optional(),
    facultyId: optionalTrimmed(200),
    section: optionalTrimmed(20),
    studentEmails: z.string().max(20000).optional(),
    type: optionalTrimmed(40),
    roomId: optionalTrimmed(200),
    day: optionalTrimmed(20),
    startTime: optionalTrimmed(20),
    endTime: optionalTrimmed(20)
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /events. */
export const eventCreateSchema = z
  .object({
    title: trimmed(200),
    type: trimmed(40),
    date: z.coerce.date(),
    departments: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]),
    coordinator: trimmed(200),
    budget: z.coerce.number().min(0).max(1000000000).optional()
  })
  .strict();

/** PUT /events/:id — every field optional. */
export const eventUpdateSchema = z
  .object({
    title: optionalTrimmed(200),
    type: optionalTrimmed(40),
    date: z.coerce.date().optional(),
    departments: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).optional(),
    coordinator: optionalTrimmed(200),
    budget: z.coerce.number().min(0).max(1000000000).optional(),
    participants: z.coerce.number().int().min(0).max(1000000).optional(),
    status: optionalTrimmed(40)
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /meetings (dean). */
export const meetingCreateSchema = z
  .object({
    title: trimmed(200),
    meetingType: trimmed(60),
    date: z.coerce.date(),
    time: trimmed(20),
    venue: trimmed(200),
    status: optionalTrimmed(40),
    agendaItems: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    attendees: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    minutes: optionalTrimmed(20000)
  })
  .strict();

/** PUT /meetings/:id — every field optional. */
export const meetingUpdateSchema = z
  .object({
    title: optionalTrimmed(200),
    meetingType: optionalTrimmed(60),
    date: z.coerce.date().optional(),
    time: optionalTrimmed(20),
    venue: optionalTrimmed(200),
    status: optionalTrimmed(40),
    agendaItems: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    attendees: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    minutes: z.string().max(20000).nullable().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /mentoring/assignments. */
export const mentoringAssignmentCreateSchema = z
  .object({
    studentId: trimmed(200),
    facultyId: trimmed(200)
  })
  .strict();

/** POST /course-management (dean). */
export const deanCourseCreateSchema = z
  .object({
    code: trimmed(20),
    name: trimmed(200),
    credits: z.coerce.number().int().min(0).max(20),
    semester: z.coerce.number().int().min(1).max(20)
  })
  .strict();

/** PUT /course-management/:id (dean) — every field optional. */
export const deanCourseUpdateSchema = z
  .object({
    code: optionalTrimmed(20),
    name: optionalTrimmed(200),
    credits: z.coerce.number().int().min(0).max(20).optional(),
    semester: z.coerce.number().int().min(1).max(20).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /facility-management (dean). */
export const deanFacilityCreateSchema = z
  .object({
    name: trimmed(200),
    type: trimmed(80),
    capacity: z.coerce.number().int().min(0).max(1000000),
    status: optionalTrimmed(40)
  })
  .strict();

/** PUT /facility-management/:id (dean) — every field optional. */
export const deanFacilityUpdateSchema = z
  .object({
    name: optionalTrimmed(200),
    type: optionalTrimmed(80),
    capacity: z.coerce.number().int().min(0).max(1000000).optional(),
    status: optionalTrimmed(40)
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /semester-management/academic-years. */
export const academicYearCreateSchema = z
  .object({
    year: trimmed(20),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    isCurrent: z.coerce.boolean().optional(),
    status: optionalTrimmed(40),
    semesters: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict()
  .refine((v) => v.endDate >= v.startDate, {
    message: 'endDate cannot fall before startDate',
    path: ['endDate']
  });

/** PUT /semester-management/academic-years/:id — every field optional. */
export const academicYearUpdateSchema = z
  .object({
    year: optionalTrimmed(20),
    startDate: z.coerce.date().optional(),
    endDate: z.coerce.date().optional(),
    isCurrent: z.coerce.boolean().optional(),
    status: optionalTrimmed(40),
    semesters: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' })
  .refine((v) => !(v.startDate && v.endDate) || v.endDate >= v.startDate, {
    message: 'endDate cannot fall before startDate',
    path: ['endDate']
  });
