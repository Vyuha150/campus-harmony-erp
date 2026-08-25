/**
 * Validation schemas for the 15 `faculty.ts` write handlers still on an
 * unvalidated `req.body` (Phase 3c completion). Same rationale as
 * `modules/hod/hod.schemas.ts`.
 *
 * `category`/`priority` on the faculty grievance form are the real options in
 * `src/components/faculty/*Grievance*.tsx` (`administrative | infrastructure |
 * hr | academic | other`, `low | medium | high | urgent`), not invented.
 * `status` on a lesson plan is the existing `LESSON_PLAN_STATUSES` constant in
 * `routes/faculty.ts`.
 *
 * Two deliberate TIGHTENINGS beyond "match current behaviour", both closing a
 * real defect rather than adding friction:
 *
 *   - `POST /grievances/:id/respond` now REQUIRES `resolution`. The handler
 *     already sets `status: 'resolved'` unconditionally; without this a case
 *     could be marked resolved with an empty resolution text.
 *   - `PUT /courses/:id/details` credits/semester are coerced numbers, not
 *     silently-skipped ones. The old code was `Number.isFinite(Number(credits))
 *     ? {...} : {}` — for `credits: ''`, `Number('')` is `0`, which IS finite,
 *     so an empty string was silently written as `0`. A schema catches that
 *     with a 400 instead of zeroing a course's credit value.
 */

import { z } from 'zod';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional();

/** PUT /profile — every field falsy-guarded, so all three stay optional. */
export const facultyProfileUpdateSchema = z
  .object({
    qualification: optionalTrimmed(200),
    specialization: optionalTrimmed(200),
    experience: z.coerce.number().int().min(0).max(80).optional()
  })
  .strict();

/** POST /profile/leave-request. */
export const leaveRequestCreateSchema = z
  .object({
    type: z.enum(['casual', 'earned', 'medical', 'duty', 'academic']).optional(),
    fromDate: z.coerce.date(),
    toDate: z.coerce.date(),
    reason: optionalTrimmed(2000)
  })
  .strict()
  .refine((v) => v.toDate >= v.fromDate, {
    message: 'toDate cannot fall before fromDate',
    path: ['toDate']
  });

/**
 * PUT /courses/:id/details.
 *
 * Every field stays optional and `undefined` vs "not sent" is preserved —
 * `attemptsTimetableOrClassroomUpdate` inside the handler branches on which
 * keys are PRESENT, not just truthy, so the schema must not collapse an
 * explicit `null` into an absent key.
 */
export const courseDetailsUpdateSchema = z
  .object({
    code: optionalTrimmed(20),
    name: optionalTrimmed(200),
    credits: z.coerce.number().int().min(0).max(20).optional(),
    semester: z.coerce.number().int().min(1).max(20).optional(),
    className: z.string().trim().max(200).nullable().optional(),
    section: z.string().trim().max(20).nullable().optional(),
    batch: z.string().trim().max(40).nullable().optional(),
    schedule: z
      .array(
        z
          .object({
            day: z.string().trim().max(20),
            startTime: z.string().trim().max(20),
            endTime: z.string().trim().max(20),
            room: z.string().trim().max(80).optional(),
            type: z.string().trim().max(40).optional()
          })
          .passthrough()
      )
      .max(50)
      .optional()
  })
  .strict();

/** PUT /courses/:courseId/lesson-plans/:weekNumber — mirrors LESSON_PLAN_STATUSES in routes/faculty.ts. */
export const lessonPlanUpsertSchema = z
  .object({
    topic: trimmed(300),
    subtopics: z.array(z.string().trim().max(200)).max(50).optional(),
    courseOutcome: trimmed(100),
    plannedDate: z.coerce.date(),
    status: z.enum(['pending', 'in_progress', 'completed', 'deferred'])
  })
  .strict();

/** POST /attendance/mark. */
export const attendanceMarkSchema = z
  .object({
    courseId: trimmed(200),
    date: z.coerce.date(),
    startTime: trimmed(20),
    endTime: trimmed(20),
    type: optionalTrimmed(40),
    students: z
      .array(
        z
          .object({
            studentId: trimmed(200),
            status: z.enum(['present', 'absent', 'late'])
          })
          .strict()
      )
      .max(2000)
      .optional()
  })
  .strict();

/** POST /assignments. */
export const assignmentCreateSchema = z
  .object({
    classId: trimmed(200),
    title: trimmed(300),
    description: trimmed(10000),
    dueDate: z.coerce.date(),
    maxMarks: z.coerce.number().int().min(0).max(1000),
    status: optionalTrimmed(40)
  })
  .strict();

/** PUT /assignments/:id — every field optional, `undefined`-checked in the handler. */
export const assignmentUpdateSchema = z
  .object({
    title: optionalTrimmed(300),
    description: optionalTrimmed(10000),
    dueDate: z.coerce.date().optional(),
    maxMarks: z.coerce.number().int().min(0).max(1000).optional(),
    status: optionalTrimmed(40)
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** PUT /assignments/:id/submissions/:subId/grade — `Prisma` treats `undefined` as "leave unchanged". */
export const submissionGradeSchema = z
  .object({
    marks: z.coerce.number().int().min(0).max(1000).optional(),
    feedback: optionalTrimmed(10000)
  })
  .strict();

/** PUT /marks/:courseId — `Enrollment.grade` is a nullable String, not numeric. */
export const marksUpdateSchema = z
  .object({
    marks: z
      .array(
        z
          .object({
            studentId: trimmed(200),
            grade: z.string().trim().max(20).nullable()
          })
          .strict()
      )
      .max(2000)
      .optional()
  })
  .strict();

/** POST /mentees/:id/notes. */
export const counselingNoteCreateSchema = z
  .object({
    topic: trimmed(200),
    notes: trimmed(4000),
    followUpDate: z.coerce.date().optional()
  })
  .strict();

/** POST /research/publications. */
export const publicationCreateSchema = z
  .object({
    title: trimmed(500),
    journal: trimmed(300),
    year: z.coerce.number().int().min(1900).max(2100),
    status: optionalTrimmed(40)
  })
  .strict();

/** POST /research/projects — appears twice in routes/faculty.ts with identical bodies. */
export const researchProjectCreateSchema = z
  .object({
    title: trimmed(500),
    fundingAgency: trimmed(300),
    amount: z.coerce.number().min(0).max(1000000000),
    status: optionalTrimmed(40)
  })
  .strict();

/**
 * POST /grievances (faculty self-service).
 *
 * `category`/`priority` are the real options in
 * `src/components/faculty/*Grievance*.tsx`.
 */
export const facultyGrievanceCreateSchema = z
  .object({
    category: z.enum(['administrative', 'infrastructure', 'hr', 'academic', 'other']),
    subject: trimmed(200),
    description: trimmed(4000),
    priority: z.enum(['low', 'medium', 'high', 'urgent']).optional()
  })
  .strict();

/**
 * POST /grievances/:id/respond.
 *
 * `resolution` is now REQUIRED — see file header. The handler sets
 * `status: 'resolved'` unconditionally, so an absent resolution previously
 * closed a case with nothing recorded.
 */
export const grievanceRespondSchema = z
  .object({
    resolution: trimmed(4000)
  })
  .strict();

/** POST /messages (faculty class message). */
export const facultyClassMessageCreateSchema = z
  .object({
    courseId: trimmed(200),
    courseCode: trimmed(40),
    subject: trimmed(200),
    message: trimmed(4000)
  })
  .strict();
