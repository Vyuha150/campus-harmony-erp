/**
 * Security validation — the last file in the 28-handler follow-up sweep
 * (Phase 3c closed a different 86-handler category across 9 other files;
 * `admin.ts`, `auth.ts`, `finance.ts`, `registrar.ts` and `uploads.ts` were
 * this sweep's other five).
 *
 * All seven models here (VisitorPass, IncidentReport, PatrolLog,
 * IDCardRequest, VehiclePass, VigilanceCase, SupportTicket) already carry a
 * tenant key and audited deletes (security.service.ts, migration 0035) — the
 * gap closed here is purely validation on the fourteen writes that took
 * `req.body` apart by hand with no schema.
 *
 * Every enum below comes from SecurityDashboard.tsx, the only frontend file
 * for this module — either a `<select>`'s real option list or the literal
 * status strings a button actually sends. Where that evidence doesn't exist
 * (support tickets have no update UI at all; vigilance case fields are
 * deliberately loose in the sibling create schema), the field stays a
 * bounded free string rather than a guessed enum.
 */

import { z } from 'zod';
import { entityId } from '../../schemas/common.js';

const text = (min: number, max: number) => z.string().trim().min(min).max(max);
const jsonValue = z.union([z.array(z.unknown()), z.record(z.string(), z.unknown())]);

/** Rejects `{}` — an update with nothing in it. */
const nonEmpty = <T extends z.ZodTypeAny>(s: T) =>
  s.refine((v) => Object.keys(v as object).length > 0, { message: 'No fields to update.' });

/**
 * POST /visitors.
 *
 * `phone`, `idProofType` and `idProofNumber` are accepted even though
 * `VisitorPass` (schema.prisma) has no columns for any of them and the
 * handler only ever reads `visitorName`/`purpose`/`hostName`/`checkInTime`/
 * `status` off the body. The "Add Visitor" dialog has sent all three since
 * it shipped; a `.strict()` schema that omitted them would turn that
 * long-standing (if silently lossy) form into a hard 400. That data loss is
 * real but is a separate, lower-severity issue — extending the model to
 * actually store them — from the validation gap this schema closes.
 */
export const visitorCreateSchema = z
  .object({
    visitorName: text(2, 160),
    hostName: text(2, 160),
    purpose: text(2, 300),
    checkInTime: z.coerce.date().optional(),
    status: z.string().trim().max(40).optional(),
    phone: z.string().trim().max(20).nullable().optional(),
    idProofType: z.string().trim().max(40).nullable().optional(),
    idProofNumber: z.string().trim().max(60).nullable().optional()
  })
  .strict();

/** PUT /visitors/:id. `checkoutVisitor()` is the only real caller, sending `status` + `checkOutTime`. */
export const visitorUpdateSchema = nonEmpty(
  z
    .object({
      visitorName: text(2, 160).optional(),
      hostName: text(2, 160).optional(),
      purpose: text(2, 300).optional(),
      status: z.string().trim().max(40).optional(),
      checkOutTime: z.coerce.date().nullable().optional()
    })
    .strict()
);

/**
 * POST /incidents.
 *
 * `severity` and `status` share the real vocabulary with `updateIncidentSchema`
 * (entityUpdate.schemas.ts) — see that schema for why `under_investigation`/
 * `open` replaced a guessed `investigating`. `types/security.ts` separately
 * declares a `minor|moderate|serious|critical` severity union that nothing in
 * this component actually assigns (the state is untyped `any`, and the real
 * `<select>` only ever offers low/medium/high/critical) — stale typing, not
 * live evidence, so it is not reflected here.
 */
export const incidentCreateSchema = z
  .object({
    title: text(3, 200),
    description: text(1, 8000),
    location: text(2, 200),
    severity: z.enum(['low', 'medium', 'high', 'critical']),
    status: z.enum(['pending', 'open', 'under_investigation', 'resolved', 'closed']).optional()
  })
  .strict();

/**
 * POST /patrols.
 *
 * No frontend caller today — PatrolLog rows are actually created through
 * `PUT /guards/:id/duty` — but the route is reachable by any authenticated
 * caller, so it gets the same treatment as every other write here. `status`
 * takes the full vocabulary the model actually uses across both write paths
 * (the duty dialog's four values plus `active`, which the duty handler's own
 * lookup query treats as a live-duty state).
 */
export const patrolCreateSchema = z
  .object({
    officerId: entityId,
    officerName: text(1, 160),
    shift: z.enum(['morning', 'afternoon', 'night']),
    patrolRoute: text(1, 200),
    startTime: z.coerce.date(),
    endTime: z.coerce.date().nullable().optional(),
    checkpoints: jsonValue.nullable().optional(),
    status: z.enum(['on_duty', 'active', 'in_progress', 'completed', 'off_duty']).optional(),
    location: z.string().trim().max(200).nullable().optional()
  })
  .strict();

/** PUT /patrols/:id. Same vocabulary as patrolCreateSchema; every field optional. */
export const patrolUpdateSchema = nonEmpty(
  z
    .object({
      officerId: entityId.optional(),
      officerName: text(1, 160).optional(),
      shift: z.enum(['morning', 'afternoon', 'night']).optional(),
      patrolRoute: text(1, 200).optional(),
      startTime: z.coerce.date().nullable().optional(),
      endTime: z.coerce.date().nullable().optional(),
      checkpoints: jsonValue.nullable().optional(),
      status: z.enum(['on_duty', 'active', 'in_progress', 'completed', 'off_duty']).optional(),
      location: z.string().trim().max(200).nullable().optional()
    })
    .strict()
);

/**
 * POST /guards.
 *
 * `password` stays optional here even though the handler now requires one:
 * the handler has its own branch for a missing password, with a specific
 * message ("Guard accounts are no longer created with a default"), and
 * `hashPassword()` — not this schema — is where strength is enforced.
 * Requiring it here would just replace that message with a generic one.
 */
export const guardCreateSchema = z
  .object({
    name: text(2, 160),
    email: z.string().trim().toLowerCase().email().max(254),
    password: z.string().min(1).max(200).optional(),
    designation: text(1, 120).optional(),
    campus: z.string().trim().max(120).nullable().optional()
  })
  .strict();

/** PUT /guards/:id. */
export const guardUpdateSchema = nonEmpty(
  z
    .object({
      name: text(2, 160).optional(),
      email: z.string().trim().toLowerCase().email().max(254).optional(),
      designation: z.string().trim().max(120).nullable().optional(),
      campus: z.string().trim().max(120).nullable().optional()
    })
    .strict()
);

/**
 * PUT /guards/:id/duty.
 *
 * `shift` and `status` are the exact options SecurityDashboard.tsx's "Assign
 * Guard Duty" dialog offers — the only real caller of this route.
 */
export const guardDutySchema = z
  .object({
    shift: z.enum(['morning', 'afternoon', 'night']),
    patrolRoute: text(1, 200),
    location: z.string().trim().max(200).nullable().optional(),
    status: z.enum(['on_duty', 'in_progress', 'completed', 'off_duty']).optional(),
    startTime: z.coerce.date().optional(),
    endTime: z.coerce.date().nullable().optional()
  })
  .strict();

/**
 * POST /id-cards.
 *
 * `applicantType` and `requestType` are the real option sets from
 * SecurityDashboard.tsx's "Create ID Card Request" dialog.
 */
export const idCardCreateSchema = z
  .object({
    applicantId: entityId,
    applicantName: text(2, 160),
    applicantType: z.enum(['student', 'faculty', 'staff', 'visitor']),
    requestType: z.enum(['new', 'renewal', 'replacement']).optional(),
    reason: z.string().trim().max(1000).nullable().optional(),
    feesPaid: z.boolean().optional(),
    documents: jsonValue.nullable().optional()
  })
  .strict();

/**
 * PUT /id-cards/:id.
 *
 * `status` is IDCardRequest's real pipeline: `pending` (the Prisma default,
 * never written back explicitly) -> `approved` -> `issued` — the only two
 * transitions `updateIdCardStatus()` ever sends.
 */
export const idCardUpdateSchema = nonEmpty(
  z
    .object({
      status: z.enum(['pending', 'approved', 'issued']).optional(),
      feesPaid: z.boolean().optional(),
      documents: jsonValue.nullable().optional(),
      reason: z.string().trim().max(1000).nullable().optional(),
      requestType: z.enum(['new', 'renewal', 'replacement']).optional(),
      applicantType: z.enum(['student', 'faculty', 'staff', 'visitor']).optional(),
      applicantName: text(2, 160).optional()
    })
    .strict()
);

/**
 * POST /vehicle-passes.
 *
 * `ownerType` and `vehicleType` are the real option sets from
 * SecurityDashboard.tsx's "Create Vehicle Pass" dialog.
 */
export const vehiclePassCreateSchema = z
  .object({
    ownerName: text(2, 160),
    ownerType: z.enum(['student', 'faculty', 'staff', 'visitor']),
    ownerIdNumber: text(1, 100),
    vehicleType: z.enum(['car', 'bike', 'scooter', 'bus']),
    vehicleNumber: text(1, 40),
    vehicleModel: z.string().trim().max(100).nullable().optional(),
    validFrom: z.coerce.date(),
    validUntil: z.coerce.date(),
    parkingZone: text(1, 40),
    status: z.enum(['active', 'revoked']).optional(),
    feesPaid: z.boolean().optional(),
    documents: jsonValue.nullable().optional()
  })
  .strict();

/** PUT /vehicle-passes/:id. Same vocabulary as vehiclePassCreateSchema. */
export const vehiclePassUpdateSchema = nonEmpty(
  z
    .object({
      ownerName: text(2, 160).optional(),
      ownerType: z.enum(['student', 'faculty', 'staff', 'visitor']).optional(),
      ownerIdNumber: text(1, 100).optional(),
      vehicleType: z.enum(['car', 'bike', 'scooter', 'bus']).optional(),
      vehicleNumber: text(1, 40).optional(),
      vehicleModel: z.string().trim().max(100).nullable().optional(),
      validFrom: z.coerce.date().nullable().optional(),
      validUntil: z.coerce.date().nullable().optional(),
      parkingZone: text(1, 40).optional(),
      status: z.enum(['active', 'revoked']).optional(),
      feesPaid: z.boolean().optional(),
      documents: jsonValue.nullable().optional()
    })
    .strict()
);

/**
 * PUT /vigilance-cases/:id.
 *
 * `type`, `complainantType`, `status` and `confidentialityLevel` stay loose
 * free text, matching `vigilanceCaseCreateSchema` (legacyWrite.schemas.ts) —
 * that schema already made the deliberate choice not to enum these fields on
 * this model, and it turns out to matter: the model's own Prisma default for
 * `status` is `under_investigation`, but the "Investigating" button in
 * SecurityDashboard.tsx actually sends `investigating`. An enum guessed from
 * either source alone would have rejected the other.
 */
export const vigilanceCaseUpdateSchema = nonEmpty(
  z
    .object({
      type: z.string().trim().max(4000).optional(),
      subject: text(1, 4000).optional(),
      description: text(1, 4000).optional(),
      complainantType: z.string().trim().max(4000).optional(),
      dateReported: z.coerce.date().optional(),
      status: z.string().trim().max(4000).optional(),
      investigatingOfficer: text(1, 4000).optional(),
      documentsCollected: jsonValue.nullable().optional(),
      peopleInterviewed: jsonValue.nullable().optional(),
      findings: z.string().trim().max(4000).nullable().optional(),
      actionTaken: z.string().trim().max(4000).nullable().optional(),
      closeDate: z.coerce.date().nullable().optional(),
      confidentialityLevel: z.string().trim().max(4000).optional()
    })
    .strict()
);

/**
 * PUT /support-tickets/:id.
 *
 * No frontend caller exists for this route — the dashboard only ever POSTs a
 * ticket (the emergency-alert flow) and never updates one — so there is no
 * real UI to derive a `status` enum from. Left loose like
 * `supportTicketCreateSchema`'s own `category`/`priority`, for the same
 * reason that schema left those two loose: an unobservable real value set
 * means a guessed enum risks rejecting a value that already exists.
 */
export const supportTicketUpdateSchema = nonEmpty(
  z
    .object({
      reportedBy: z.string().trim().max(4000).optional(),
      reporterType: z.string().trim().max(4000).optional(),
      contactInfo: z.string().trim().max(4000).optional(),
      category: z.string().trim().max(4000).optional(),
      priority: z.string().trim().max(4000).optional(),
      subject: text(1, 4000).optional(),
      description: text(1, 4000).optional(),
      attachments: jsonValue.nullable().optional(),
      assignedTo: z.string().trim().max(4000).nullable().optional(),
      status: z.string().trim().max(4000).optional(),
      resolutionDate: z.coerce.date().nullable().optional(),
      resolutionNotes: z.string().trim().max(4000).nullable().optional(),
      satisfactionRating: z.coerce.number().int().nullable().optional()
    })
    .strict()
);
