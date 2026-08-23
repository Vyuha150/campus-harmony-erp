/**
 * Admissions service (EPIC-05).
 *
 * Implements the blueprint workflow:
 *
 *   Application → Document Verification → Eligibility → Merit → Offer
 *   → Acceptance → Student Record Creation → Enrollment
 *
 * DESIGN NOTES
 *
 * 1. Every state change is TRANSACTIONAL and AUDITED via `mutate()`. Admission
 *    decisions are institutional records — one that commits without its audit
 *    entry is exactly what this system must not allow.
 *
 * 2. Seat allocation locks the category row. Reservation quotas are statutory;
 *    two concurrent offers must not both take the last SC seat.
 *
 * 3. `confirmAdmission` is the critical operation. It atomically creates the
 *    User, StudentProfile, Enrollment-eligibility and initial FeeRecord. A
 *    partial failure would leave a student who exists but cannot be taught, or
 *    who is taught but never billed.
 *
 * 4. Nothing here fabricates data. If a value is unknown it stays null — the
 *    defect Phase 0 removed was precisely a system inventing plausible records.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate, requireContext, toSkipTake, paginated, type PageRequest, type TransactionClient } from '../../lib/service.js';
import { hashPassword, generateTemporaryPassword } from '../../lib/password.js';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError
} from '../../lib/errors.js';
import { logger } from '../../lib/logger.js';

const MODULE = 'admissions';

/** Statuses from which an application may still be acted upon. */
const TERMINAL_STATUSES = new Set(['admitted', 'withdrawn', 'expired', 'rejected', 'declined']);

// ─── Application numbering ────────────────────────────────────────────────────

/**
 * Generate the next application number for a cycle.
 *
 * Derived from a count inside the caller's transaction so concurrent
 * submissions cannot collide; the unique constraint on
 * `[institutionId, applicationNumber]` is the final guard.
 */
async function nextApplicationNumber(
  tx: TransactionClient,
  institutionId: string,
  cycleCode: string
): Promise<string> {
  const count = await (tx as never as typeof basePrisma).admissionApplication.count({
    where: { institutionId, cycle: { code: cycleCode } }
  });
  return `${cycleCode}-${String(count + 1).padStart(5, '0')}`;
}

// ─── Cycles ───────────────────────────────────────────────────────────────────

export interface CreateCycleInput {
  programmeId: string;
  academicYear: string;
  name: string;
  code: string;
  applicationStartsAt: Date;
  applicationEndsAt: Date;
  totalSeats: number;
  applicationFee?: number;
  minimumQualifyingPercentage?: number;
  entranceExamName?: string;
  campusId?: string;
  /** Seats per reservation category. Must sum to `totalSeats`. */
  seatMatrix: Array<{ category: string; totalSeats: number }>;
}

export async function createCycle(input: CreateCycleInput) {
  const ctx = requireContext();

  if (input.applicationEndsAt <= input.applicationStartsAt) {
    throw new ValidationError('The application window must end after it starts.');
  }

  const matrixTotal = input.seatMatrix.reduce((sum, row) => sum + row.totalSeats, 0);
  if (matrixTotal !== input.totalSeats) {
    // Catching this at creation prevents a cycle that can never allocate its
    // full intake, or that over-allocates against a statutory quota.
    throw new ValidationError(
      `Seat matrix totals ${matrixTotal} but the cycle declares ${input.totalSeats} seats.`,
      { seatMatrixTotal: matrixTotal, declaredTotal: input.totalSeats }
    );
  }

  const categories = new Set(input.seatMatrix.map((row) => row.category));
  if (categories.size !== input.seatMatrix.length) {
    throw new ValidationError('Seat matrix contains duplicate categories.');
  }

  // Programme must belong to the caller's institution. The tenant extension
  // scopes this lookup automatically.
  const programme = await basePrisma.programme.findFirst({
    where: { id: input.programmeId, institutionId: ctx.institutionId }
  });
  if (!programme) throw new NotFoundError('Programme');

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (result) => `AdmissionCycle:${(result as { id: string }).id}`,
      details: `Created admission cycle ${input.code} for ${input.academicYear} (${input.totalSeats} seats)`,
      newValue: { code: input.code, totalSeats: input.totalSeats, seatMatrix: input.seatMatrix },
      severity: 'info'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const existing = await db.admissionCycle.findFirst({
        where: { institutionId: ctx.institutionId, code: input.code }
      });
      if (existing) throw new ConflictError(`Admission cycle ${input.code} already exists.`);

      return db.admissionCycle.create({
        data: {
          institutionId: ctx.institutionId,
          campusId: input.campusId ?? ctx.campusId,
          programmeId: input.programmeId,
          academicYear: input.academicYear,
          name: input.name,
          code: input.code,
          applicationStartsAt: input.applicationStartsAt,
          applicationEndsAt: input.applicationEndsAt,
          totalSeats: input.totalSeats,
          applicationFee: input.applicationFee ?? 0,
          minimumQualifyingPercentage: input.minimumQualifyingPercentage ?? null,
          entranceExamName: input.entranceExamName ?? null,
          status: 'draft',
          createdBy: ctx.userId,
          seatMatrix: {
            create: input.seatMatrix.map((row) => ({
              category: row.category,
              totalSeats: row.totalSeats
            }))
          }
        },
        include: { seatMatrix: true }
      });
    }
  );
}

export async function openCycle(cycleId: string) {
  const ctx = requireContext();

  const cycle = await basePrisma.admissionCycle.findFirst({
    where: { id: cycleId, institutionId: ctx.institutionId }
  });
  if (!cycle) throw new NotFoundError('Admission cycle');
  if (cycle.status !== 'draft') {
    throw new BusinessRuleError(`Only a draft cycle can be opened (current status: ${cycle.status}).`);
  }

  return mutate(
    ctx,
    {
      action: 'UPDATE',
      module: MODULE,
      resource: `AdmissionCycle:${cycleId}`,
      details: `Opened admission cycle ${cycle.code} for applications`,
      oldValue: { status: cycle.status },
      newValue: { status: 'open' },
      severity: 'warning'
    },
    async (tx) =>
      (tx as never as typeof basePrisma).admissionCycle.update({
        where: { id: cycleId },
        data: { status: 'open' }
      })
  );
}

export async function listCycles(page: PageRequest, status?: string) {
  const ctx = requireContext();
  const where = { institutionId: ctx.institutionId, ...(status ? { status } : {}) };

  const [rows, total] = await Promise.all([
    basePrisma.admissionCycle.findMany({
      where,
      include: { seatMatrix: true, _count: { select: { applications: true } } },
      orderBy: { createdAt: 'desc' },
      ...toSkipTake(page)
    }),
    basePrisma.admissionCycle.count({ where })
  ]);

  return paginated(rows, total, page);
}

// ─── Applications ─────────────────────────────────────────────────────────────

export interface SubmitApplicationInput {
  cycleId: string;
  fullName: string;
  email: string;
  phone: string;
  dateOfBirth: Date;
  category: string;
  gender?: string;
  domicileState?: string;
  guardianName?: string;
  guardianPhone?: string;
  previousQualification?: string;
  previousBoard?: string;
  previousPercentage?: number;
  previousYearOfPassing?: number;
  entranceExamRollNumber?: string;
  entranceExamScore?: number;
  entranceExamRank?: number;
  isDifferentlyAbled?: boolean;
}

export async function submitApplication(input: SubmitApplicationInput) {
  const ctx = requireContext();

  const cycle = await basePrisma.admissionCycle.findFirst({
    where: { id: input.cycleId, institutionId: ctx.institutionId },
    include: { seatMatrix: true }
  });
  if (!cycle) throw new NotFoundError('Admission cycle');

  if (cycle.status !== 'open') {
    throw new BusinessRuleError(
      `This admission cycle is not accepting applications (status: ${cycle.status}).`
    );
  }

  const now = new Date();
  if (now < cycle.applicationStartsAt) {
    throw new BusinessRuleError('The application window has not opened yet.');
  }
  if (now > cycle.applicationEndsAt) {
    throw new BusinessRuleError('The application window has closed.');
  }

  // The declared category must exist in this cycle's seat matrix, otherwise the
  // applicant could never be allocated a seat.
  if (!cycle.seatMatrix.some((row) => row.category === input.category)) {
    throw new ValidationError(
      `Category ${input.category} is not available in this admission cycle.`,
      { availableCategories: cycle.seatMatrix.map((row) => row.category) }
    );
  }

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (result) => `AdmissionApplication:${(result as { id: string }).id}`,
      details: (result) =>
        `Application ${(result as { applicationNumber: string }).applicationNumber} submitted by ${input.fullName}`,
      newValue: { email: input.email, category: input.category, cycle: cycle.code }
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      // One application per email per cycle.
      const duplicate = await db.admissionApplication.findFirst({
        where: { cycleId: input.cycleId, email: input.email }
      });
      if (duplicate) {
        throw new ConflictError(
          'An application already exists for this email in this admission cycle.',
          { applicationNumber: duplicate.applicationNumber }
        );
      }

      const applicationNumber = await nextApplicationNumber(tx, ctx.institutionId, cycle.code);

      return db.admissionApplication.create({
        data: {
          institutionId: ctx.institutionId,
          cycleId: input.cycleId,
          applicationNumber,
          fullName: input.fullName,
          email: input.email,
          phone: input.phone,
          dateOfBirth: input.dateOfBirth,
          category: input.category,
          gender: input.gender ?? null,
          domicileState: input.domicileState ?? null,
          isDifferentlyAbled: input.isDifferentlyAbled ?? false,
          guardianName: input.guardianName ?? null,
          guardianPhone: input.guardianPhone ?? null,
          previousQualification: input.previousQualification ?? null,
          previousBoard: input.previousBoard ?? null,
          previousPercentage: input.previousPercentage ?? null,
          previousYearOfPassing: input.previousYearOfPassing ?? null,
          entranceExamRollNumber: input.entranceExamRollNumber ?? null,
          entranceExamScore: input.entranceExamScore ?? null,
          entranceExamRank: input.entranceExamRank ?? null,
          status: 'submitted'
        }
      });
    }
  );
}

async function loadApplication(applicationId: string) {
  const ctx = requireContext();
  const application = await basePrisma.admissionApplication.findFirst({
    where: { id: applicationId, institutionId: ctx.institutionId },
    include: { cycle: { include: { seatMatrix: true, programme: true } }, documents: true }
  });
  if (!application) throw new NotFoundError('Application');
  return application;
}

/** Verify documents and record the eligibility decision. */
export async function verifyApplication(
  applicationId: string,
  decision: { eligible: boolean; remark?: string }
) {
  const ctx = requireContext();
  const application = await loadApplication(applicationId);

  if (TERMINAL_STATUSES.has(application.status)) {
    throw new BusinessRuleError(
      `Application ${application.applicationNumber} is ${application.status} and cannot be verified.`
    );
  }

  const cycle = application.cycle;

  // Enforce the cycle's qualifying mark, so eligibility is a rule rather than
  // an opinion — and the reason is recorded either way.
  let eligible = decision.eligible;
  let remark = decision.remark ?? null;

  if (eligible && cycle.minimumQualifyingPercentage !== null) {
    if (application.previousPercentage === null) {
      eligible = false;
      remark = 'Previous qualifying percentage not provided.';
    } else if (application.previousPercentage < cycle.minimumQualifyingPercentage) {
      eligible = false;
      remark = `Qualifying percentage ${application.previousPercentage}% is below the required ${cycle.minimumQualifyingPercentage}%.`;
    }
  }

  return mutate(
    ctx,
    {
      action: eligible ? 'APPROVE' : 'REJECT',
      module: MODULE,
      resource: `AdmissionApplication:${applicationId}`,
      details: `Application ${application.applicationNumber} marked ${eligible ? 'eligible' : 'ineligible'}`,
      oldValue: { status: application.status, isEligible: application.isEligible },
      newValue: { status: eligible ? 'eligible' : 'rejected', isEligible: eligible },
      reason: remark ?? undefined,
      severity: 'warning'
    },
    async (tx) =>
      (tx as never as typeof basePrisma).admissionApplication.update({
        where: { id: applicationId },
        data: {
          isEligible: eligible,
          eligibilityRemark: remark,
          status: eligible ? 'eligible' : 'rejected',
          rejectionReason: eligible ? null : remark,
          verifiedBy: ctx.userId,
          verifiedAt: new Date()
        }
      })
  );
}

// ─── Merit ────────────────────────────────────────────────────────────────────

/**
 * Compute merit for every eligible application in a cycle.
 *
 * Merit uses the entrance score where present, otherwise the qualifying
 * percentage. The rule is explicit rather than implied, and the resulting score
 * is stored so a published merit list can be reproduced and defended later.
 *
 * Ranking is per-category: reservation means candidates compete within their
 * category pool, not against the open pool.
 */
export async function generateMeritList(cycleId: string) {
  const ctx = requireContext();

  const cycle = await basePrisma.admissionCycle.findFirst({
    where: { id: cycleId, institutionId: ctx.institutionId }
  });
  if (!cycle) throw new NotFoundError('Admission cycle');

  const eligible = await basePrisma.admissionApplication.findMany({
    where: { cycleId, isEligible: true, status: 'eligible' }
  });

  if (eligible.length === 0) {
    throw new BusinessRuleError('No eligible applications to rank in this cycle.');
  }

  const scored = eligible.map((application) => ({
    id: application.id,
    category: application.category,
    // Entrance score takes precedence; qualifying percentage is the fallback.
    score: application.entranceExamScore ?? application.previousPercentage ?? 0
  }));

  // Rank within each category pool.
  const byCategory = new Map<string, typeof scored>();
  for (const row of scored) {
    (byCategory.get(row.category) ?? byCategory.set(row.category, []).get(row.category)!).push(row);
  }

  const updates: Array<{ id: string; score: number; rank: number }> = [];
  for (const rows of byCategory.values()) {
    rows.sort((a, b) => b.score - a.score);
    rows.forEach((row, index) => {
      updates.push({ id: row.id, score: row.score, rank: index + 1 });
    });
  }

  return mutate(
    ctx,
    {
      action: 'PUBLISH',
      module: MODULE,
      resource: `AdmissionCycle:${cycleId}`,
      details: `Merit list generated for ${cycle.code}: ${updates.length} candidates ranked across ${byCategory.size} categories`,
      newValue: { rankedCount: updates.length, categories: [...byCategory.keys()] },
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      for (const update of updates) {
        await db.admissionApplication.update({
          where: { id: update.id },
          data: { meritScore: update.score, meritRank: update.rank, status: 'shortlisted' }
        });
      }

      await db.admissionCycle.update({
        where: { id: cycleId },
        data: { status: 'merit_published' }
      });

      return { rankedCount: updates.length, categories: [...byCategory.keys()] };
    }
  );
}

// ─── Offers ───────────────────────────────────────────────────────────────────

export async function makeOffer(
  applicationId: string,
  options: { validForDays?: number; admissionFeeAmount?: number } = {}
) {
  const ctx = requireContext();
  const application = await loadApplication(applicationId);

  if (application.status !== 'shortlisted') {
    throw new BusinessRuleError(
      `Only shortlisted applications can receive an offer (current status: ${application.status}).`
    );
  }

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + (options.validForDays ?? 7));

  return mutate(
    ctx,
    {
      action: 'APPROVE',
      module: MODULE,
      resource: (result) => `AdmissionOffer:${(result as { id: string }).id}`,
      details: `Seat offered to ${application.applicationNumber} in the ${application.category} category`,
      newValue: { category: application.category, expiresAt },
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      // Lock the category row so two concurrent offers cannot both take the
      // last seat in a statutory quota.
      const seatRows = await db.$queryRaw<Array<{ id: string; totalSeats: number; filledSeats: number }>>`
        SELECT id, "totalSeats", "filledSeats"
        FROM "AdmissionSeatMatrix"
        WHERE "cycleId" = ${application.cycleId} AND category = ${application.category}
        FOR UPDATE
      `;

      const seat = seatRows[0];
      if (!seat) {
        throw new NotFoundError(`Seat allocation for category ${application.category}`);
      }
      if (seat.filledSeats >= seat.totalSeats) {
        throw new BusinessRuleError(
          `No seats remain in the ${application.category} category.`,
          { totalSeats: seat.totalSeats, filledSeats: seat.filledSeats }
        );
      }

      await db.admissionSeatMatrix.update({
        where: { id: seat.id },
        data: { filledSeats: { increment: 1 } }
      });

      const offer = await db.admissionOffer.create({
        data: {
          institutionId: ctx.institutionId,
          applicationId,
          seatCategory: application.category,
          expiresAt,
          offeredBy: ctx.userId,
          admissionFeeAmount: options.admissionFeeAmount ?? null,
          status: 'pending'
        }
      });

      await db.admissionApplication.update({
        where: { id: applicationId },
        data: { status: 'offered', decidedBy: ctx.userId, decidedAt: new Date() }
      });

      return offer;
    }
  );
}

/** Candidate declines — the seat returns to its category pool. */
export async function declineOffer(offerId: string, reason?: string) {
  const ctx = requireContext();

  const offer = await basePrisma.admissionOffer.findFirst({
    where: { id: offerId, institutionId: ctx.institutionId },
    include: { application: true }
  });
  if (!offer) throw new NotFoundError('Offer');
  if (offer.status !== 'pending') {
    throw new BusinessRuleError(`This offer is already ${offer.status}.`);
  }

  return mutate(
    ctx,
    {
      action: 'REJECT',
      module: MODULE,
      resource: `AdmissionOffer:${offerId}`,
      details: `Offer declined for ${offer.application.applicationNumber}; seat returned to the ${offer.seatCategory} pool`,
      oldValue: { status: 'pending' },
      newValue: { status: 'declined' },
      reason,
      severity: 'warning'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      await db.admissionOffer.update({
        where: { id: offerId },
        data: { status: 'declined', respondedAt: new Date() }
      });

      // Release the seat so the next candidate in merit order can be offered it.
      await db.admissionSeatMatrix.updateMany({
        where: { cycleId: offer.application.cycleId, category: offer.seatCategory },
        data: { filledSeats: { decrement: 1 } }
      });

      await db.admissionApplication.update({
        where: { id: offer.applicationId },
        data: { status: 'declined' }
      });

      return { released: true, category: offer.seatCategory };
    }
  );
}

// ─── Admission confirmation — the critical operation ──────────────────────────

export interface ConfirmAdmissionResult {
  applicationNumber: string;
  rollNumber: string;
  userId: string;
  studentProfileId: string;
  temporaryPassword: string;
}

/**
 * Convert an accepted offer into a real student.
 *
 * Atomically creates: User → StudentProfile → initial FeeRecord, and marks the
 * application admitted.
 *
 * WHY ATOMICITY MATTERS HERE
 *
 * A partial failure would produce a student who exists but has no profile (so
 * cannot be enrolled or taught), or a profile with no fee record (so is never
 * billed). Both are institutional-record corruption that someone would have to
 * reconcile by hand later.
 *
 * NOTE: cgpa/credits are left at zero. They are DERIVED values computed from
 * results once the results engine exists (T-403) — the previous code wrote a
 * literal `cgpa: 8.5` here, which is exactly the fabrication Phase 0 removed.
 */
export async function confirmAdmission(
  offerId: string,
  options: { admissionFeeAmount?: number; feeDueInDays?: number } = {}
): Promise<ConfirmAdmissionResult> {
  const ctx = requireContext();

  const offer = await basePrisma.admissionOffer.findFirst({
    where: { id: offerId, institutionId: ctx.institutionId },
    include: {
      application: { include: { cycle: { include: { programme: true } } } }
    }
  });
  if (!offer) throw new NotFoundError('Offer');

  if (offer.status !== 'pending') {
    throw new BusinessRuleError(`This offer is ${offer.status} and cannot be confirmed.`);
  }
  if (offer.expiresAt < new Date()) {
    throw new BusinessRuleError('This offer has expired.');
  }

  const application = offer.application;
  if (application.studentProfileId) {
    throw new ConflictError('This application has already been converted into a student record.');
  }

  const temporaryPassword = generateTemporaryPassword();
  const hashedPassword = await hashPassword(temporaryPassword);

  const cycle = application.cycle;
  const programme = cycle.programme;

  const result = await mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `StudentProfile:${(r as { studentProfileId: string }).studentProfileId}`,
      details: (r) =>
        `Admission confirmed for ${application.applicationNumber}; student record ${(r as { rollNumber: string }).rollNumber} created`,
      newValue: {
        applicationNumber: application.applicationNumber,
        programme: programme.code,
        category: application.category
      },
      severity: 'critical' // creating an institutional record
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      // Email must be globally unique — it is the login identifier (ADR-0001).
      const existingUser = await db.user.findUnique({ where: { email: application.email } });
      if (existingUser) {
        throw new ConflictError(
          'An account already exists for this email address.',
          { email: application.email }
        );
      }

      // Roll number: <programme>-<admission year>-<sequence>, tenant-scoped.
      const admittedCount = await db.studentProfile.count({
        where: { institutionId: ctx.institutionId, admissionYear: new Date().getFullYear() }
      });
      const rollNumber = `${programme.code}${new Date().getFullYear()}${String(admittedCount + 1).padStart(4, '0')}`;

      const user = await db.user.create({
        data: {
          institutionId: ctx.institutionId,
          campusId: cycle.campusId ?? ctx.campusId,
          email: application.email,
          password: hashedPassword,
          name: application.fullName,
          role: 'student',
          designation: 'Student'
        }
      });

      const profile = await db.studentProfile.create({
        data: {
          userId: user.id,
          institutionId: ctx.institutionId,
          campusId: cycle.campusId ?? ctx.campusId,
          programmeId: programme.id,
          rollNumber,
          // Legacy free-text fields retained until the backfill completes.
          program: programme.name,
          branch: programme.name,
          section: 'A',
          batch: cycle.academicYear,
          semester: 1,
          admissionYear: new Date().getFullYear(),
          // DERIVED — computed from results, never assumed. See T-403.
          cgpa: 0,
          totalCredits: programme.totalCredits,
          earnedCredits: 0,
          // Demographics carried over from the application.
          gender: application.gender,
          dateOfBirth: application.dateOfBirth,
          category: application.category,
          domicileState: application.domicileState,
          nationality: application.nationality,
          isDifferentlyAbled: application.isDifferentlyAbled
        }
      });

      // Initial fee record so the student is billed from day one.
      const feeAmount = options.admissionFeeAmount ?? offer.admissionFeeAmount ?? 0;
      if (feeAmount > 0) {
        const dueDate = new Date();
        dueDate.setDate(dueDate.getDate() + (options.feeDueInDays ?? 30));

        await db.feeRecord.create({
          data: {
            // Explicit since migration 0010 made FeeRecord tenant-owned. This
            // write goes through `basePrisma` inside the transaction, so the
            // tenant extension does not inject it automatically.
            institutionId: ctx.institutionId,
            studentProfileId: profile.id,
            type: 'admission',
            description: `Admission fee — ${programme.name} (${cycle.academicYear})`,
            amount: feeAmount,
            dueDate,
            status: 'pending',
            academicYear: cycle.academicYear
          }
        });
      }

      await db.admissionOffer.update({
        where: { id: offerId },
        data: { status: 'accepted', respondedAt: new Date() }
      });

      await db.admissionApplication.update({
        where: { id: application.id },
        data: { status: 'admitted', studentProfileId: profile.id }
      });

      return {
        applicationNumber: application.applicationNumber,
        rollNumber,
        userId: user.id,
        studentProfileId: profile.id
      };
    }
  );

  logger.info('Admission confirmed', {
    module: MODULE,
    operation: 'confirmAdmission',
    userId: ctx.userId,
    resource: result.rollNumber
  });

  // Returned ONCE for out-of-band delivery; never stored in plaintext.
  return { ...result, temporaryPassword };
}

// ─── Reporting ────────────────────────────────────────────────────────────────

/**
 * Seat utilisation per category.
 *
 * Blueprint: admissions analytics showing "intake capacity vs filled seats,
 * which NAAC looks at under Criterion 2". Computed from operational records,
 * not typed in — the compliance principle in `10_COMPLIANCE_DATA_PLAN.md`.
 */
export async function getCycleStatistics(cycleId: string) {
  const ctx = requireContext();

  const cycle = await basePrisma.admissionCycle.findFirst({
    where: { id: cycleId, institutionId: ctx.institutionId },
    include: { seatMatrix: true, programme: true }
  });
  if (!cycle) throw new NotFoundError('Admission cycle');

  const byStatus = await basePrisma.admissionApplication.groupBy({
    by: ['status'],
    where: { cycleId },
    _count: { _all: true }
  });

  const byCategory = await basePrisma.admissionApplication.groupBy({
    by: ['category'],
    where: { cycleId },
    _count: { _all: true }
  });

  const totalFilled = cycle.seatMatrix.reduce((sum, row) => sum + row.filledSeats, 0);

  return {
    cycle: {
      id: cycle.id,
      code: cycle.code,
      name: cycle.name,
      academicYear: cycle.academicYear,
      programme: cycle.programme.name,
      status: cycle.status
    },
    seats: {
      total: cycle.totalSeats,
      filled: totalFilled,
      vacant: cycle.totalSeats - totalFilled,
      utilisationPercentage:
        cycle.totalSeats > 0 ? Number(((totalFilled / cycle.totalSeats) * 100).toFixed(2)) : 0,
      byCategory: cycle.seatMatrix.map((row) => ({
        category: row.category,
        total: row.totalSeats,
        filled: row.filledSeats,
        vacant: row.totalSeats - row.filledSeats
      }))
    },
    applications: {
      total: byStatus.reduce((sum, row) => sum + row._count._all, 0),
      byStatus: Object.fromEntries(byStatus.map((row) => [row.status, row._count._all])),
      byCategory: Object.fromEntries(byCategory.map((row) => [row.category, row._count._all]))
    }
  };
}

export async function listApplications(
  cycleId: string,
  page: PageRequest,
  filters: { status?: string | undefined; category?: string | undefined } = {}
) {
  const ctx = requireContext();

  const where = {
    institutionId: ctx.institutionId,
    cycleId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.category ? { category: filters.category } : {})
  };

  const [rows, total] = await Promise.all([
    basePrisma.admissionApplication.findMany({
      where,
      orderBy: [{ meritRank: 'asc' }, { submittedAt: 'asc' }],
      ...toSkipTake(page)
    }),
    basePrisma.admissionApplication.count({ where })
  ]);

  return paginated(rows, total, page);
}
