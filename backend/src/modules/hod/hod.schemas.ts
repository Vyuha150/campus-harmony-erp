/**
 * Validation schemas for the 27 `hod.ts` write handlers still on an unvalidated
 * `req.body` (Phase 3c completion).
 *
 * These are NOT mass assignment — every one of these handlers already reads
 * explicitly named fields, so a caller cannot reach a column the handler did
 * not choose. The ratchet in `serviceScoping.test.ts` already reads zero here.
 * What was missing:
 *
 *   - no `.strict()`, so an unrecognised key was silently ignored rather than
 *     refused — a client typo became a successful no-op instead of a 400
 *   - no length/range bounds, so an arbitrarily long string reached the column
 *   - a missing REQUIRED field (e.g. `itemName` on a purchase request) surfaced
 *     as a raw Prisma 500 rather than a clean 400 with a field error
 *
 * Each schema below mirrors what the handler ALREADY enforces at runtime — a
 * field the handler treats as optional (with a `|| default`) stays optional
 * here too. Schemas are made no stricter than current behaviour except where
 * the looseness IS the defect: `status` fields that were previously any string
 * are now the closed set the handler (or its manual `if (!ALLOWED.includes...)`
 * check) already restricts them to.
 *
 * One documented exception: `workloadAssignSchema` is NOT `.strict()`. The
 * substitution-request branch of `PUT /workload/assign` currently accepts an
 * arbitrary body shape and performs no write for it (`res.json({ data: {
 * accepted: true } })`), so a `.strict()` schema would 400 a payload the
 * endpoint currently returns 200 for — exactly the "breaks a working endpoint"
 * failure this sweep is required to avoid.
 */

import { z } from 'zod';

const trimmed = (max: number) => z.string().trim().min(1).max(max);
const optionalTrimmed = (max: number) => z.string().trim().max(max).optional();

/** PUT /approvals/:id and PUT /hodapprovals/:id/status — identical shape. */
export const hodApprovalDecisionSchema = z
  .object({
    status: z.enum(['approved', 'rejected', 'forwarded']),
    note: z.string().trim().max(500).optional()
  })
  .strict();

/**
 * PUT /workload/assign — deliberately NOT strict. See file header.
 */
export const workloadAssignSchema = z
  .object({
    classId: z.string().trim().max(200).optional(),
    courseId: z.string().trim().max(200).optional(),
    facultyId: z.string().trim().max(200).optional()
  })
  .passthrough();

/** POST /inventory/purchase-request and POST /purchaserequests — identical shape. */
export const purchaseRequestCreateSchema = z
  .object({
    itemName: trimmed(200),
    lab: trimmed(120),
    quantity: z.coerce.number().int().min(1).max(100000),
    estimatedCost: z.coerce.number().min(0).max(100000000),
    justification: trimmed(2000)
  })
  .strict();

/** POST /messages (department broadcast). */
export const hodBroadcastCreateSchema = z
  .object({
    subject: trimmed(200),
    content: trimmed(4000),
    type: optionalTrimmed(40),
    recipients: optionalTrimmed(120)
  })
  .strict();

/** PUT /faculty/:id/roles — any non-array currently becomes []. */
export const facultyRolesUpdateSchema = z
  .object({
    roles: z.array(z.string().trim().max(100)).max(50).optional()
  })
  .strict();

/** PUT /faculty/:id/leave. */
export const facultyLeaveDecisionSchema = z
  .object({
    action: z.enum(['approve', 'reject']).optional()
  })
  .strict();

/** POST /faculty/:id/promotion-recommendation. */
export const promotionRecommendationSchema = z
  .object({
    reason: optionalTrimmed(2000)
  })
  .strict();

/**
 * POST /courseresults/:courseCode/remedial.
 *
 * Missed on the first pass through this file — caught only because the
 * post-sweep re-scan (the same scanner that found the original 86) still
 * reported one handler in hod.ts. Left as the record of that, rather than
 * silently folded into the count above.
 */
export const remedialNoteSchema = z
  .object({
    note: optionalTrimmed(2000)
  })
  .strict();

/**
 * PUT /students/:id/advisor.
 *
 * `facultyProfileId`, not a name. The handler used to accept `{ advisor:
 * string }` and do nothing with it — no write, just an echo — so changing a
 * student's advisor appeared to succeed and silently reverted on the next
 * page load. A name cannot be persisted as a foreign key without a fragile
 * lookup that breaks the moment two faculty share a name; the frontend now
 * submits the id `MenteeAssignment.facultyId` actually references.
 */
export const advisorAssignSchema = z
  .object({
    facultyProfileId: trimmed(200)
  })
  .strict();

/** POST /students/:id/counseling-note. */
export const counselingNoteSchema = z
  .object({
    note: optionalTrimmed(4000)
  })
  .strict();

/** POST /workload/course. */
export const workloadCourseCreateSchema = z
  .object({
    courseId: trimmed(200),
    semester: z.coerce.number().int().min(1).max(20).optional(),
    facultyId: trimmed(200),
    section: trimmed(20),
    type: optionalTrimmed(40),
    studentEmails: optionalTrimmed(20000),
    roomId: trimmed(200),
    day: trimmed(20),
    startTime: trimmed(20),
    endTime: trimmed(20)
  })
  .strict();

/** PUT /workload/course/:id — every field optional; `studentEmails` may be an empty string. */
export const workloadCourseUpdateSchema = z
  .object({
    courseCode: optionalTrimmed(40),
    courseName: optionalTrimmed(200),
    credits: z.coerce.number().int().min(0).max(20).optional(),
    semester: z.coerce.number().int().min(1).max(20).optional(),
    facultyId: optionalTrimmed(200),
    section: optionalTrimmed(20),
    type: optionalTrimmed(40),
    // Not `.optional()` alone: the handler distinguishes `undefined` (leave
    // enrolment untouched) from `''` (clear it), so `null` must not collapse
    // into the same branch as "field omitted".
    studentEmails: z.string().max(20000).optional(),
    roomId: optionalTrimmed(200),
    day: optionalTrimmed(20),
    startTime: optionalTrimmed(20),
    endTime: optionalTrimmed(20)
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /accreditationdata. */
export const accreditationDataCreateSchema = z
  .object({
    criterion: trimmed(4000),
    metric: trimmed(4000),
    value: trimmed(4000),
    year: trimmed(20)
  })
  .strict();

/** POST /labinventory. */
export const labInventoryCreateSchema = z
  .object({
    name: trimmed(200),
    lab: trimmed(120),
    category: trimmed(80),
    quantity: z.coerce.number().int().min(0).max(1000000),
    workingCondition: z.coerce.number().int().min(0).optional(),
    purchaseDate: z.coerce.date().optional(),
    warrantyExpiry: z.coerce.date().optional(),
    status: optionalTrimmed(40)
  })
  .strict();

/** PUT /labinventory/:id — every field optional. */
export const labInventoryUpdateSchema = z
  .object({
    name: optionalTrimmed(200),
    lab: optionalTrimmed(120),
    category: optionalTrimmed(80),
    quantity: z.coerce.number().int().min(0).max(1000000).optional(),
    workingCondition: z.coerce.number().int().min(0).optional(),
    purchaseDate: z.coerce.date().nullable().optional(),
    warrantyExpiry: z.coerce.date().nullable().optional(),
    status: optionalTrimmed(40)
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /course-management. */
export const hodCourseCreateSchema = z
  .object({
    code: trimmed(20),
    name: trimmed(200),
    credits: z.coerce.number().int().min(0).max(20),
    semester: z.coerce.number().int().min(1).max(20)
  })
  .strict();

/** PUT /course-management/:id — every field optional. */
export const hodCourseUpdateSchema = z
  .object({
    code: optionalTrimmed(20),
    name: optionalTrimmed(200),
    credits: z.coerce.number().int().min(0).max(20).optional(),
    semester: z.coerce.number().int().min(1).max(20).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /curriculum-proposals. */
export const curriculumProposalCreateSchema = z
  .object({
    type: z.enum(['new_course', 'syllabus_update', 'program_change', 'elective_addition']),
    title: trimmed(200),
    description: trimmed(4000)
  })
  .strict();

/** POST /facility-management. */
export const facilityCreateSchema = z
  .object({
    name: trimmed(200),
    type: trimmed(80),
    capacity: z.coerce.number().int().min(0).max(1000000),
    status: optionalTrimmed(40)
  })
  .strict();

/** PUT /facility-management/:id — every field optional. */
export const facilityUpdateSchema = z
  .object({
    name: optionalTrimmed(200),
    type: optionalTrimmed(80),
    capacity: z.coerce.number().int().min(0).max(1000000).optional(),
    status: optionalTrimmed(40)
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

/** POST /communication/messages (hod). */
export const hodCommunicationCreateSchema = z
  .object({
    subject: trimmed(200),
    message: trimmed(4000),
    recipients: optionalTrimmed(120),
    to: optionalTrimmed(120),
    viaEmail: z.coerce.boolean().optional(),
    viaWhatsApp: z.coerce.boolean().optional()
  })
  .strict();

/**
 * PUT /grievances/:id (hod decision).
 *
 * The value set is the department's own screen vocabulary
 * (`src/components/hod/*Grievance*`), not an invented list: `new`,
 * `under_review`, `resolved`, `closed`. `fromRoleGrievanceStatus` maps `new`
 * back to the stored `received` for this role.
 */
export const hodGrievanceDecisionSchema = z
  .object({
    status: z.enum(['new', 'under_review', 'resolved', 'closed']).optional(),
    response: optionalTrimmed(4000)
  })
  .strict();

/** POST /students/export. */
export const studentsExportSchema = z
  .object({
    format: z.enum(['csv', 'pdf', 'xlsx']).optional()
  })
  .strict();

/** POST /students/merit-list. */
export const meritListSchema = z
  .object({
    limit: z.coerce.number().int().min(1).max(500).optional()
  })
  .strict();

/** POST /students/:id/email. */
export const studentEmailSchema = z
  .object({
    subject: optionalTrimmed(200),
    message: optionalTrimmed(4000)
  })
  .strict();

/** POST /accreditation/upload-document — the handler does not persist a file today. */
export const accreditationDocumentUploadSchema = z
  .object({
    name: optionalTrimmed(300)
  })
  .strict();
