/**
 * Validation for the student self-service router (Phase 3b).
 *
 * Every one of these endpoints acts on the CALLER'S OWN record — the student
 * profile is resolved from their token, never from the request. So the risk here
 * is not cross-tenant access; it is a student asserting facts about themselves
 * that the institution is supposed to establish.
 *
 * The omissions are therefore about who decides what:
 *
 *   - a submission cannot carry its own marks or grade
 *   - a revaluation request cannot arrive already approved
 *   - a certificate request cannot arrive already issued
 *   - a placement application cannot arrive already shortlisted
 *   - feedback cannot name a different respondent
 */

import { z } from 'zod';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const studentPage = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25)
});

export const semesterQuery = studentPage.extend({
  semester: z.coerce.number().int().min(1).max(12).optional()
});

/** Submitting an assignment. */
/**
 * POST /assignments/:id/submit.
 *
 * Was `{ content, attachments }` — neither of which the handler reads nor the
 * `Submission` model has a column for — while omitting `fileUrl`, the one
 * field the handler REQUIRES (`if (!fileUrl) return 400`) and the only
 * content column on the model. The schema and the handler were describing two
 * different endpoints, so every submission was rejected before reaching the
 * check that would have accepted it.
 *
 * `marks`, `grade`, `feedback` and `status` stay out: they are the assessor's,
 * not the submitter's. A student who can post `marks` grades their own work.
 */
export const submitAssignmentSchema = z
  .object({
    fileUrl: z.string().trim().min(1).max(2000)
  })
  .strict();

/** Requesting a revaluation. */
export const revaluationSchema = z
  .object({
    reason: text(10, 2000),
    courseId: z.string().trim().max(80).optional()
  })
  // No `status`: a revaluation request is created pending. A caller that can
  // post `status: 'approved'` has approved their own re-mark.
  .strict();

/** Requesting a certificate. */
export const certificateRequestSchema = z
  .object({
    type: text(2, 60),
    purpose: text(3, 500),
    copies: z.coerce.number().int().min(1).max(10).optional()
  })
  // No `status`, `issuedAt` or `documentUrl` — those describe an issued
  // document, which is the registrar's act.
  .strict();

/** Applying to a placement drive. */
export const placementApplySchema = z
  .object({
    resumeUrl: z.string().trim().max(500).optional(),
    coverNote: z.string().trim().max(4000).optional()
  })
  // No `status`: shortlisting is the recruiter's decision.
  .strict();

/** Submitting course feedback. */
export const feedbackSubmitSchema = z
  .object({
    responses: z.record(z.string().trim().max(60), z.union([z.number(), z.string().trim().max(2000)]))
  })
  // No `studentId`: the respondent is the caller. Accepting it would let one
  // student file feedback in another's name — and on an anonymous instrument,
  // would also break the anonymity it implies.
  .strict();

/** Raising a grievance from the student portal. */
export const studentGrievanceSchema = z
  .object({
    category: text(2, 80),
    subject: text(3, 200),
    description: text(10, 20_000),
    priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
    isAnonymous: z.boolean().optional(),
    attachments: z.array(z.string().trim().max(500)).max(20).optional()
  })
  .strict();

/** Course enrolment. */
export const enrollSchema = z.object({ courseId: text(1, 80) }).strict();

/** Paying a fee — retained so the refusal path still validates its input. */
export const payFeeSchema = z
  .object({ feeRecordId: text(1, 80) })
  // `transactionId` is NOT accepted. It used to be generated in the browser and
  // believed by the server. See the handler.
  .strict();
