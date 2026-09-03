/**
 * Generated write schemas for the legacy handlers that used `data: { ...req.body }`
 * (Phase 3c).
 *
 * Seventeen handlers across seven route files spread the request body into a
 * Prisma write. That is mass assignment: every column of the model was settable,
 * including ones the domain treats as decided elsewhere.
 *
 * These schemas are DERIVED FROM THE MODELS rather than hand-written, so the
 * field lists cannot drift from the schema, and so the omissions are applied by
 * one rule instead of seventeen judgement calls. Two deny-lists:
 *
 *   ALWAYS      id, institutionId, createdAt, updatedAt, deletedAt, deletedBy.
 *               Identity, tenancy and lifecycle are the system's, never a
 *               caller's.
 *
 *   ON CREATE   anything matching approvedBy/At, verifiedBy/At, issuedBy/At,
 *               decidedBy/At, publishedBy/At, reviewedBy/At, resolvedAt,
 *               closedAt — and `status`.
 *
 *               `status` is the important one. A create that accepts it lets a
 *               caller post a record that is already approved, which is exactly
 *               how a transfer request could arrive pre-approved before that
 *               endpoint was fixed. The handler sets the opening state.
 *
 * Every schema is `.strict()`, so an unknown key is refused rather than dropped:
 * a caller who sends a field that no longer exists gets told, instead of a 200
 * and a silent no-op.
 *
 * Where a handler needs richer rules than "this column, this type" — a balance
 * check, a derived total, a cross-field invariant — it has a hand-written schema
 * elsewhere. This file covers the plain cases only, and says so.
 */

import { z } from 'zod';


/** AccreditationData — update. */
// Not accepted from the caller: lastUpdated (server-set).
export const accreditationDataUpdateSchema = z
  .object({
    criterion: z.string().trim().max(4000).optional(),
    metric: z.string().trim().max(4000).optional(),
    value: z.string().trim().max(4000).optional(),
    year: z.string().trim().max(4000).optional(),
    status: z.string().trim().max(4000).optional(),
    updatedBy: z.string().trim().max(4000).optional(),
    departmentId: z.string().trim().max(4000).optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });


/** ComplianceReport — update. */
// Not accepted from the caller: lastUpdated (server-set).
export const complianceReportUpdateSchema = z
  .object({
    framework: z.string().trim().max(4000).optional(),
    title: z.string().trim().max(4000).optional(),
    status: z.string().trim().max(4000).optional(),
    score: z.coerce.number().nullable().optional(),
    maxScore: z.coerce.number().optional(),
    criteria: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });


/** SportsEvent — create. */
// Not accepted from the caller: status.
export const sportsEventCreateSchema = z
  .object({
    name: z.string().trim().max(4000),
    type: z.string().trim().max(4000),
    sports: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    venue: z.string().trim().max(4000),
    organizer: z.string().trim().max(4000),
    participants: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    results: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict();


/** FitnessRecord — create. */
// Not accepted from the caller: conductedBy (server-set).
export const fitnessRecordCreateSchema = z
  .object({
    studentId: z.string().trim().max(4000),
    testDate: z.coerce.date().optional(),
    testType: z.string().trim().max(4000),
    results: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    overallGrade: z.string().trim().max(4000).nullable().optional(),
    recommendations: z.string().trim().max(4000).nullable().optional(),
    restrictions: z.string().trim().max(4000).nullable().optional(),
    nextTestDate: z.coerce.date().nullable().optional()
  })
  .strict();


/** AlumniEvent — create. */
// Not accepted from the caller: status.
export const alumniEventLegacyCreateSchema = z
  .object({
    title: z.string().trim().max(4000),
    description: z.string().trim().max(4000),
    type: z.string().trim().max(4000),
    date: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    venue: z.string().trim().max(4000),
    isVirtual: z.boolean().optional(),
    virtualLink: z.string().trim().max(4000).nullable().optional(),
    maxCapacity: z.coerce.number().int().nullable().optional(),
    registrationDeadline: z.coerce.date(),
    organizer: z.string().trim().max(4000),
    targetAudience: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    registrations: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    images: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    documents: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict();


/** MentorshipProgram — create. */
// Not accepted from the caller: status.
export const mentorshipProgramCreateSchema = z
  .object({
    title: z.string().trim().max(4000),
    description: z.string().trim().max(4000),
    type: z.string().trim().max(4000),
    duration: z.string().trim().max(4000),
    maxMentees: z.coerce.number().int(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    mentors: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    mentees: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    matches: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict();


/** ProgressionSurvey — create. */
// Not accepted from the caller: status.
export const progressionSurveyCreateSchema = z
  .object({
    title: z.string().trim().max(4000),
    graduationYear: z.coerce.number().int(),
    program: z.string().trim().max(4000).nullable().optional(),
    surveyPeriod: z.string().trim().max(4000),
    questions: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    responses: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    startDate: z.coerce.date(),
    endDate: z.coerce.date()
  })
  .strict();


/** AlumniJobPosting — create. */
// Not accepted from the caller: postedBy (server-set), status.
export const alumniJobLegacyCreateSchema = z
  .object({
    companyName: z.string().trim().max(4000),
    jobTitle: z.string().trim().max(4000),
    description: z.string().trim().max(4000),
    requirements: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    location: z.string().trim().max(4000),
    salaryRange: z.string().trim().max(4000).nullable().optional(),
    jobType: z.string().trim().max(4000).optional(),
    applicationDeadline: z.coerce.date(),
    contactEmail: z.string().trim().max(4000),
    postedDate: z.coerce.date().optional(),
    views: z.coerce.number().int().optional(),
    applications: z.coerce.number().int().optional()
  })
  .strict();


/** IQACActionItem — create. */
// Not accepted from the caller: status, implementationStatus.
export const iqacActionCreateSchema = z
  .object({
    title: z.string().trim().max(4000),
    description: z.string().trim().max(4000),
    category: z.string().trim().max(4000),
    priority: z.string().trim().max(4000).optional(),
    assignedTo: z.string().trim().max(4000),
    department: z.string().trim().max(4000).nullable().optional(),
    dueDate: z.coerce.date(),
    evidence: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    createdDate: z.coerce.date().optional(),
    completedDate: z.coerce.date().nullable().optional(),
    impact: z.string().trim().max(4000).nullable().optional()
  })
  .strict();


/** IQACActionItem — update. */
// Not accepted from the caller: completedDate (server-set).
export const iqacActionUpdateSchema = z
  .object({
    title: z.string().trim().max(4000).optional(),
    description: z.string().trim().max(4000).optional(),
    category: z.string().trim().max(4000).optional(),
    priority: z.string().trim().max(4000).optional(),
    assignedTo: z.string().trim().max(4000).optional(),
    department: z.string().trim().max(4000).nullable().optional(),
    dueDate: z.coerce.date().optional(),
    status: z.string().trim().max(4000).optional(),
    implementationStatus: z.string().trim().max(4000).nullable().optional(),
    evidence: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    createdDate: z.coerce.date().optional(),
    impact: z.string().trim().max(4000).nullable().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });


/** QualityDocument — create. */
// Not accepted from the caller: uploadedBy (server-set), status, reviewedBy.
export const qualityDocumentCreateSchema = z
  .object({
    title: z.string().trim().max(4000),
    criteriaNumber: z.coerce.number().int(),
    documentType: z.string().trim().max(4000),
    uploadDate: z.coerce.date().optional(),
    filePath: z.string().trim().max(4000).nullable().optional(),
    version: z.string().trim().max(4000).optional(),
    reviewComments: z.string().trim().max(4000).nullable().optional(),
    reviewDate: z.coerce.date().nullable().optional(),
    tags: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict();


/** QualityDocument — update. */
// Not accepted from the caller: reviewedBy (server-set), reviewDate (server-set).
export const qualityDocumentUpdateSchema = z
  .object({
    title: z.string().trim().max(4000).optional(),
    criteriaNumber: z.coerce.number().int().optional(),
    documentType: z.string().trim().max(4000).optional(),
    uploadedBy: z.string().trim().max(4000).optional(),
    uploadDate: z.coerce.date().optional(),
    filePath: z.string().trim().max(4000).nullable().optional(),
    version: z.string().trim().max(4000).optional(),
    status: z.string().trim().max(4000).optional(),
    reviewComments: z.string().trim().max(4000).nullable().optional(),
    tags: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });


/**
 * AcademicYear — create.
 *
 * `status` WAS excluded here ("not accepted from the caller"), on the
 * assumption a new academic year always starts in one server-decided state.
 * It doesn't: AdminSystemConfig.tsx uses one form for both create and edit,
 * with a real Status select (upcoming/active/completed) whose value is
 * always in the payload either way. The `.strict()` schema was rejecting
 * every academic year this screen tried to create. Same three values as
 * `academicYearUpdateSchema` (admin.schemas.ts) — one dropdown, one model.
 */
export const academicYearCreateSchema = z
  .object({
    year: z.string().trim().max(4000),
    startDate: z.coerce.date(),
    endDate: z.coerce.date(),
    status: z.enum(['upcoming', 'active', 'completed']).optional(),
    isCurrent: z.boolean().optional(),
    semesters: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional()
  })
  .strict();


/** SystemNotificationRecord — create. */
// Not accepted from the caller: sentBy (server-set), readCount (server-set), totalRecipients (server-set), status.
export const systemNotificationCreateSchema = z
  .object({
    title: z.string().trim().max(4000),
    message: z.string().trim().max(4000),
    type: z.string().trim().max(4000).optional(),
    targetRoles: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    targetDepartments: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    sentDate: z.coerce.date().optional(),
    scheduledDate: z.coerce.date().nullable().optional()
  })
  .strict();


/** VigilanceCase — create. */
// Not accepted from the caller: caseNumber (server-set), status.
export const vigilanceCaseCreateSchema = z
  .object({
    type: z.string().trim().max(4000),
    subject: z.string().trim().max(4000),
    description: z.string().trim().max(4000),
    complainantType: z.string().trim().max(4000),
    dateReported: z.coerce.date().optional(),
    investigatingOfficer: z.string().trim().max(4000),
    documentsCollected: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    peopleInterviewed: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    findings: z.string().trim().max(4000).nullable().optional(),
    actionTaken: z.string().trim().max(4000).nullable().optional(),
    closeDate: z.coerce.date().nullable().optional(),
    confidentialityLevel: z.string().trim().max(4000).optional()
  })
  .strict();


/** SupportTicket — create. */
// Not accepted from the caller: ticketNumber (server-set), status.
export const supportTicketCreateSchema = z
  .object({
    reportedBy: z.string().trim().max(4000),
    reporterType: z.string().trim().max(4000),
    contactInfo: z.string().trim().max(4000),
    category: z.string().trim().max(4000),
    priority: z.string().trim().max(4000).optional(),
    subject: z.string().trim().max(4000),
    description: z.string().trim().max(4000),
    attachments: z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]).nullable().optional(),
    assignedTo: z.string().trim().max(4000).nullable().optional(),
    createdDate: z.coerce.date().optional(),
    lastUpdate: z.coerce.date().optional(),
    resolutionDate: z.coerce.date().nullable().optional(),
    resolutionNotes: z.string().trim().max(4000).nullable().optional(),
    satisfactionRating: z.coerce.number().int().nullable().optional()
  })
  .strict();
