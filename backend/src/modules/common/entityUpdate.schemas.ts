/**
 * Update schemas for the 17 handlers that took `data: req.body` (Phase 3b).
 *
 * Every schema is `.strict()`, so an unknown key is REFUSED rather than
 * silently dropped. That matters more than it sounds: silently dropping means a
 * caller who sends `resultsPublished: true` gets a 200 and believes it worked.
 *
 * WHAT IS DELIBERATELY NOT ACCEPTED
 *
 * Each schema omits fields that are derived, assigned by the system, or decided
 * by a different process. Those omissions are the substance of this file — a
 * schema that simply listed every column would be mass assignment with extra
 * steps. Each one is commented where the reason is not obvious.
 */

import { z } from 'zod';

/** A JSON column. Arrays and objects only — a bare scalar is almost always a bug. */
const jsonValue = z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]);

const isoDate = z
  .string()
  .trim()
  .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date');

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Rejects `{}`, which would otherwise produce an audit entry recording nothing. */
const nonEmpty = <T extends z.ZodTypeAny>(s: T) =>
  s.refine((v) => Object.keys(v as object).length > 0, { message: 'No fields to update.' });

// ─── admin.ts ────────────────────────────────────────────────────────────────

export const updateCourseSchema = nonEmpty(
  z
    .object({
      code: text(2, 20).optional(),
      name: text(2, 160).optional(),
      credits: z.coerce.number().int().min(0).max(30).optional(),
      semester: z.coerce.number().int().min(1).max(12).optional(),
      facultyId: z.string().trim().min(1).max(80).nullable().optional()
    })
    // `departmentId` is omitted: moving a course between departments changes who
    // owns its enrolments, timetable and results. That is a transfer, not a
    // field edit, and needs its own handler.
    .strict()
);

// ─── alumni.ts ───────────────────────────────────────────────────────────────

export const updateAlumniEventSchema = nonEmpty(
  z
    .object({
      title: text(3, 160).optional(),
      description: text(1, 4000).optional(),
      type: text(2, 40).optional(),
      date: isoDate.optional(),
      endDate: isoDate.nullable().optional(),
      venue: text(2, 200).optional(),
      isVirtual: z.boolean().optional(),
      virtualLink: z.string().trim().url().max(500).nullable().optional(),
      maxCapacity: z.coerce.number().int().min(0).max(100000).nullable().optional(),
      registrationDeadline: isoDate.optional(),
      organizer: text(2, 120).optional(),
      targetAudience: jsonValue.nullable().optional(),
      status: z.enum(['draft', 'published', 'cancelled', 'completed']).optional()
    })
    // `registrations` is omitted: it is the record of who signed up. Editing it
    // through the event form would let an organiser rewrite attendance.
    .strict()
);

export const updateAlumniJobSchema = nonEmpty(
  z
    .object({
      companyName: text(2, 160).optional(),
      jobTitle: text(2, 160).optional(),
      description: text(1, 8000).optional(),
      requirements: jsonValue.nullable().optional(),
      location: text(2, 160).optional(),
      salaryRange: z.string().trim().max(80).nullable().optional(),
      jobType: z.enum(['full_time', 'part_time', 'internship', 'contract']).optional(),
      applicationDeadline: isoDate.optional(),
      contactEmail: z.string().trim().email().max(200).optional(),
      status: z.enum(['active', 'closed', 'filled', 'draft']).optional()
    })
    // `views` and `applications` are counters the system maintains, and
    // `postedBy`/`postedDate` are provenance. None is a client's to assert.
    .strict()
);

// ─── finance.ts ──────────────────────────────────────────────────────────────

export const updateJournalEntrySchema = nonEmpty(
  z
    .object({
      description: text(1, 500).optional(),
      reference: z.string().trim().max(120).nullable().optional(),
      status: z.enum(['draft', 'posted', 'reversed']).optional()
    })
    // The narrowest schema here, deliberately. `totalDebit`, `totalCredit` and
    // `accounts` are the entry itself — a ledger line that can be edited in
    // place is not a ledger. `entryNumber` is its identity, and `createdBy` /
    // `approvedBy` record who did what. Correcting a posted entry means writing
    // a reversing entry, which is a different operation from editing this row.
    .strict()
);

// ─── grievances.ts ───────────────────────────────────────────────────────────

export const updateAffidavitSchema = nonEmpty(
  z
    .object({
      parentAffidavit: z.boolean().optional(),
      studentAffidavit: z.boolean().optional(),
      academicYear: text(4, 20).optional(),
      status: z.enum(['pending', 'submitted', 'verified', 'rejected']).optional()
    })
    // `studentId`, `studentName` and `program` identify whose affidavit this is.
    // Allowing them to change would let one student's submission be reassigned
    // to another — on an anti-ragging record.
    .strict()
);

// ─── iqac.ts ─────────────────────────────────────────────────────────────────

export const updateQualityMetricSchema = nonEmpty(
  z
    .object({
      category: z.enum(['naac', 'nirf', 'internal']).optional(),
      metric: text(2, 160).optional(),
      currentValue: text(1, 60).optional(),
      target: text(1, 60).optional(),
      trend: z.enum(['increase', 'decrease', 'upward', 'downward', 'stable']).optional(),
      status: z.enum(['on_track', 'at_risk', 'off_track', 'achieved']).optional()
    })
    .strict()
);

// ─── registrar.ts ────────────────────────────────────────────────────────────

export const updateTransferRequestSchema = nonEmpty(
  z
    .object({
      type: text(2, 40).optional(),
      fromInstitution: text(2, 200).optional(),
      toInstitution: text(2, 200).optional(),
      program: text(2, 160).optional(),
      reason: text(1, 2000).optional(),
      documents: jsonValue.nullable().optional(),
      status: z.enum(['pending', 'approved', 'rejected', 'withdrawn']).optional()
    })
    // `studentId` / `studentName` identify the applicant; `requestedAt` is when
    // they applied.
    .strict()
);

export const updateVacancySchema = nonEmpty(
  z
    .object({
      position: text(2, 160).optional(),
      department: text(2, 160).optional(),
      type: text(2, 40).optional(),
      sanctioned: z.coerce.number().int().min(0).max(10000).optional(),
      filled: z.coerce.number().int().min(0).max(10000).optional(),
      // Was ['advertised','screening','interviewing','closed','filled'] — a
      // guessed vocabulary that didn't match RegistrarHR.tsx's real seven-step
      // hiring pipeline. Verified live: the "advance stage" button sent
      // 'applications_received' and got a 400 for it, on every vacancy, since
      // this schema was wired in.
      status: z.enum([
        'advertised',
        'applications_received',
        'shortlisted',
        'interview_scheduled',
        'selected',
        'joined',
        'closed'
      ]).optional(),
      lastDate: isoDate.nullable().optional(),
      applicants: z.coerce.number().int().min(0).max(1000000).optional()
    })
    .strict()
    .refine((v) => v.filled === undefined || v.sanctioned === undefined || v.filled <= v.sanctioned, {
      message: 'filled cannot exceed sanctioned',
      path: ['filled']
    })
);

export const updateAccreditationSchema = nonEmpty(
  z
    .object({
      framework: text(2, 60).optional(),
      criterion: text(1, 160).optional(),
      description: text(1, 4000).optional(),
      responsibleOffice: text(2, 160).optional(),
      status: z.enum(['not_started', 'in_progress', 'submitted', 'complete']).optional(),
      documents: jsonValue.nullable().optional(),
      deadline: isoDate.optional(),
      remarks: z.string().trim().max(2000).nullable().optional()
    })
    .strict()
);

// ─── security.ts ─────────────────────────────────────────────────────────────

export const updateIncidentSchema = nonEmpty(
  z
    .object({
      title: text(3, 200).optional(),
      description: text(1, 8000).optional(),
      location: text(2, 200).optional(),
      severity: z.enum(['low', 'medium', 'high', 'critical']).optional(),
      status: z.enum(['pending', 'investigating', 'resolved', 'closed']).optional()
    })
    // `reportedAt` is when it happened. An incident whose timestamp can be moved
    // is not evidence of anything.
    .strict()
);

// ─── sports.ts ───────────────────────────────────────────────────────────────

export const updateAthleteSchema = nonEmpty(
  z
    .object({
      year: z.coerce.number().int().min(1).max(10).optional(),
      email: z.string().trim().email().max(200).optional(),
      phone: z.string().trim().max(20).optional(),
      sports: jsonValue.nullable().optional(),
      achievements: jsonValue.nullable().optional(),
      medicalClearance: z.boolean().optional(),
      emergencyContact: jsonValue.nullable().optional(),
      status: z.enum(['active', 'injured', 'inactive', 'graduated']).optional()
    })
    // `studentId` is unique and links to the student record; `studentName`,
    // `rollNumber` and `program` come from it. Editing them here would let the
    // roster disagree with the register.
    .strict()
);

export const updateTeamSchema = nonEmpty(
  z
    .object({
      sport: text(2, 60).optional(),
      category: text(2, 60).optional(),
      level: text(2, 60).optional(),
      coach: text(2, 120).optional(),
      captain: z.string().trim().max(120).nullable().optional(),
      members: jsonValue.nullable().optional(),
      practiceSchedule: jsonValue.nullable().optional(),
      upcomingMatches: jsonValue.nullable().optional(),
      season: text(2, 40).optional(),
      status: z.enum(['active', 'inactive', 'disbanded']).optional()
    })
    .strict()
);

export const updateAttendanceSchema = nonEmpty(
  z
    .object({
      date: isoDate.optional(),
      attendees: jsonValue.nullable().optional(),
      notes: z.string().trim().max(2000).nullable().optional(),
      sessionType: z.enum(['training', 'match', 'fitness', 'meeting']).optional()
    })
    // `teamId` is omitted: moving an attendance record to a different team
    // rewrites two teams' histories at once.
    .strict()
);

export const updateFacilitySchema = nonEmpty(
  z
    .object({
      name: text(2, 160).optional(),
      type: text(2, 60).optional(),
      sports: jsonValue.nullable().optional(),
      capacity: z.coerce.number().int().min(0).max(1000000).optional(),
      amenities: jsonValue.nullable().optional(),
      maintenanceSchedule: jsonValue.nullable().optional(),
      status: z.enum(['available', 'booked', 'maintenance', 'closed']).optional()
    })
    .strict()
);

export const updateInventorySchema = nonEmpty(
  z
    .object({
      itemName: text(2, 160).optional(),
      category: text(2, 60).optional(),
      sport: text(2, 60).optional(),
      brand: z.string().trim().max(80).nullable().optional(),
      quantity: z.coerce.number().int().min(0).max(1000000).optional(),
      availableQuantity: z.coerce.number().int().min(0).max(1000000).optional(),
      unitPrice: z.coerce.number().min(0).max(100000000).optional(),
      condition: z.enum(['new', 'good', 'fair', 'poor', 'unusable']).optional(),
      purchaseDate: isoDate.nullable().optional(),
      lastMaintenance: isoDate.nullable().optional(),
      location: text(2, 160).optional()
    })
    // `totalValue` is omitted because it is DERIVED (quantity × unitPrice). The
    // route recomputes it; accepting it would allow a stated total that
    // contradicts its own operands.
    .strict()
    .refine(
      (v) =>
        v.availableQuantity === undefined ||
        v.quantity === undefined ||
        v.availableQuantity <= v.quantity,
      { message: 'availableQuantity cannot exceed quantity', path: ['availableQuantity'] }
    )
);

// ─── vc.ts ───────────────────────────────────────────────────────────────────

export const updateMeetingSchema = nonEmpty(
  z
    .object({
      meetingType: text(2, 60).optional(),
      title: text(3, 200).optional(),
      date: isoDate.optional(),
      time: text(1, 20).optional(),
      venue: text(2, 200).optional(),
      status: z.enum(['upcoming', 'in_progress', 'completed', 'cancelled']).optional(),
      agendaItems: jsonValue.nullable().optional(),
      attendees: jsonValue.nullable().optional(),
      documents: jsonValue.nullable().optional(),
      minutes: z.string().trim().max(20000).nullable().optional()
    })
    // `createdBy` is provenance.
    .strict()
);

export const updateBroadcastSchema = nonEmpty(
  z
    .object({
      subject: text(3, 200).optional(),
      content: text(1, 20000).optional(),
      type: z.enum(['announcement', 'alert', 'circular', 'notice']).optional(),
      recipients: text(1, 200).optional(),
      pinned: z.boolean().optional()
    })
    // `sender` and `sentAt` are provenance. A broadcast whose author can be
    // changed after the fact is a forgery waiting to happen.
    .strict()
);

// ─── sports.ts (Phase 3c completion) ──────────────────────────────────────────
//
// PUT /events/:id and PUT /health/:id were `const data = { ...req.body, ... };
// prisma.X.update({ where: { id }, data })` — mass assignment through a local
// variable rather than an inline spread. The ratchet in `serviceScoping.test.ts`
// matches `data:` followed directly by `req.body` or `{ ...req.body }`; a spread
// assigned to a variable one line earlier is syntactically invisible to it. That
// makes this the FOURTH shape of the same defect this project has found (see the
// comments on `KNOWN_MASS_ASSIGNMENT` and the widened pattern above it) —
// discovered here, in grievances.ts's `/compliance/:id`, and nowhere else only
// because nobody had read every remaining handler until this sweep.

export const sportsEventUpdateSchema = nonEmpty(
  z
    .object({
      name: text(1, 4000).optional(),
      type: text(1, 4000).optional(),
      sports: jsonValue.nullable().optional(),
      startDate: isoDate.optional(),
      endDate: isoDate.optional(),
      venue: text(1, 4000).optional(),
      organizer: text(1, 4000).optional(),
      participants: jsonValue.nullable().optional(),
      results: jsonValue.nullable().optional(),
      status: text(1, 40).optional()
    })
    .strict()
);

export const fitnessRecordUpdateSchema = nonEmpty(
  z
    .object({
      testDate: isoDate.optional(),
      testType: text(1, 4000).optional(),
      results: jsonValue.nullable().optional(),
      overallGrade: z.string().trim().max(4000).nullable().optional(),
      recommendations: z.string().trim().max(4000).nullable().optional(),
      restrictions: z.string().trim().max(4000).nullable().optional(),
      nextTestDate: isoDate.nullable().optional()
    })
    // `studentId` and `conductedBy` are identity and provenance — who was
    // tested and who tested them are not editable after the fact.
    .strict()
);
