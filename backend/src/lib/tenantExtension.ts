/**
 * Prisma extension enforcing tenant isolation automatically (ADR-0001).
 *
 * Injects `institutionId` into the `where` clause of every read/update/delete
 * and into `data` on every create, for models that carry a tenant key.
 *
 * THE DESIGN GOAL: make forgetting to scope IMPOSSIBLE rather than merely
 * discouraged. Previously a developer had to remember to spread
 * `campusScope(ctx)` into each of 478 handlers; one omission leaks another
 * university's student records. Now scoping happens whether or not the handler
 * asks for it, and bypassing requires an explicit, greppable `runUnscoped()`.
 *
 * FAIL-CLOSED BEHAVIOUR
 *
 * If a tenant-owned model is queried while a request is in flight but no tenant
 * context is active, the query throws rather than returning unscoped rows. A
 * loud failure in development is vastly preferable to a silent cross-tenant
 * read in production.
 *
 * WHAT THIS IS NOT
 *
 * This is one layer, not the whole defence. It does not cover raw SQL
 * (`$queryRaw`), and it cannot know which campus a row belongs to for
 * campus-level scoping — handlers still apply `campusScope()` where campus
 * granularity matters. PostgreSQL Row-Level Security remains the intended
 * second layer (ADR-0001, deferred).
 */

import { Prisma } from '@prisma/client';
import { currentTenant, isUnscoped, isIncludingDeleted } from './tenantStore.js';
import { AuthorizationError } from './errors.js';
import { logger } from './logger.js';

/**
 * Models carrying an `institutionId` column.
 *
 * Kept explicit rather than inferred at runtime so that adding a tenant-owned
 * model is a deliberate act. A model missing from this list is NOT scoped —
 * `scripts/check-tenant-coverage.ts` fails the build if a model has an
 * institutionId column but is absent here.
 */
export const TENANT_OWNED_MODELS = new Set<string>([
  'User',
  'Department',
  'Course',
  'StudentProfile',
  'FacultyProfile',
  'AcademicYear',
  'Campus',
  'School',
  'Programme',
  'Batch',
  'Section',
  // Notification engine
  'NotificationTemplate',
  'NotificationPolicy',
  'NotificationDelivery',
  // Examination lifecycle
  'ExamSession',
  'ExamSchedule',
  'ExamRegistration',
  'HallTicket',
  'RevaluationRequest',
  // Curriculum & OBE
  'CurriculumScheme',
  'CourseBasket',
  'SchemeCourse',
  'CoursePrerequisite',
  'ProgrammeOutcome',
  'CourseOutcome',
  'CoPoMapping',
  // Academic results (T-403)
  'GradeScale',
  'CourseResult',
  'SemesterResult',
  'GradeHistory',
  // File management (A5)
  'FileMetadata',
  // Admissions (EPIC-05)
  'AdmissionCycle',
  'AdmissionApplication',
  'AdmissionOffer',
  // Governance / NAAC Criterion 6 evidence
  'GovernanceCommittee',
  'CommitteeMeeting',
  'InstitutionalPolicy',
  // Finance (EPIC-08). FeeRecord and FeeStructure were unscoped until 0010 —
  // fee queries returned every institution's dues.
  'FeeRecord',
  'FeeStructure',
  'Payment',
  'Receipt',
  'IdempotencyKey',
  // Library (T-203b). Unscoped until 0012 — the dashboard counted every
  // institution's books.
  'LibraryBook',
  'LibraryLoan',
  'LibraryPolicy',
  // Bulk import. ImportError is NOT listed: it carries no institutionId and is
  // scoped through its parent job.
  'ImportJob',
  // OBE attainment (0015). AssessmentOutcome is NOT listed — it carries no
  // institutionId and is scoped through its parent assessment.
  'Assessment',
  'AssessmentCoMark',
  'IndirectAttainment',
  'ObeAttainmentPolicy',
  // Approvals (0022). Was entirely unscoped — a cross-tenant AUTHORITY breach,
  // not merely a read leak: one institution's HOD could approve another's items.
  'ApprovalItem',
  // 0027 — the examination schedule was shared across every institution.
  'ExamProgress',
  // 0028 — the 16 models behind the mass-assignment handlers. Every one of
  // these tables was global: any authenticated holder of the relevant role
  // could read and write every institution's rows.
  'AlumniEvent',
  'AlumniJobPosting',
  'JournalEntry',
  'AntiRaggingAffidavit',
  'QualityMetric',
  'TransferRequest',
  'Vacancy',
  'AccreditationChecklist',
  'IncidentReport',
  'SportsAthlete',
  'SportsTeam',
  'SportsAttendance',
  'SportsFacility',
  'SportsInventoryItem',
  'Meeting',
  'BroadcastMessage',
  // 0031 - the grievance module. Anonymous and confidential complaints were
  // in a globally shared table.
  'GrievanceCase',
  'ComplianceItem',
  // Workflow engine (0024). WorkflowStep and WorkflowTransition are NOT listed:
  // they carry no institutionId and are scoped through their parent.
  'WorkflowDefinition',
  'WorkflowInstance'
]);


/**
 * Models carrying `deletedAt` (migration 0021).
 *
 * Filtering soft-deleted rows is injected here for the same reason tenant
 * scoping is: a rule enforced at 500 call sites is not a rule, it is a
 * probability. One forgotten `deletedAt: null` makes a deleted student reappear
 * in a roll, a report, or an export.
 *
 * Deliberately NOT every table. Log and queue tables are append-only history and
 * carry no `deletedAt`; their parents are already protected by ON DELETE
 * RESTRICT from migrations 0018/0019.
 */
export const SOFT_DELETABLE_MODELS = new Set<string>([
  'User',
  'StudentProfile',
  'FacultyProfile',
  'Campus',
  'School',
  'Department',
  'Programme',
  'Batch',
  'Section',
  'Course',
  'CourseResult',
  'SemesterResult',
  'LibraryBook',
  'FeeRecord'
]);

/** Operations whose `where` clause must be constrained. */
const WHERE_OPERATIONS = new Set([
  'findFirst',
  'findFirstOrThrow',
  'findMany',
  'updateMany',
  'deleteMany',
  'count',
  'aggregate',
  'groupBy'
]);

/**
 * Operations targeting a single row by unique key.
 *
 * These cannot take an arbitrary `where`, so the tenant filter is applied by
 * verifying the RESULT instead — see `verifyResultTenancy`. This is the IDOR
 * defence: knowing a UUID from another institution must not be enough to read it.
 */
/**
 * Unique-key READS. Safe to run and then inspect: nothing has changed.
 */
const UNIQUE_OPERATIONS = new Set(['findUnique', 'findUniqueOrThrow']);

/**
 * Unique-key WRITES. These must be constrained BEFORE they execute.
 *
 * `update` and `delete` were in the set above, which meant the query ran and the
 * RESULT was checked — by which point the row had already been written or
 * deleted. See the comment at the call site.
 */
const UNIQUE_WRITE_OPERATIONS = new Set(['update', 'delete']);

const CREATE_OPERATIONS = new Set(['create', 'createMany']);

function requireTenantId(model: string, operation: string): string | null {
  // Outside a request (seeds, migrations, scripts) or explicitly unscoped.
  if (isUnscoped()) return null;

  const context = currentTenant();

  if (!context?.institutionId) {
    // A request is in flight but no tenant is set — a route was mounted without
    // resolveTenantContext. Fail loudly rather than return every tenant's rows.
    logger.error('Tenant-owned model accessed with no tenant context', {
      module: model,
      operation
    });
    throw new AuthorizationError(
      'This request cannot be completed without an institution context.'
    );
  }

  return context.institutionId;
}

/** Confirm a single-row result belongs to the caller's institution. */
function verifyResultTenancy(result: unknown, institutionId: string, model: string): unknown {
  if (result === null || result === undefined) return result;

  const row = result as { institutionId?: string | null };

  // Not every returned shape includes institutionId (e.g. a narrow `select`).
  // Where it is absent we cannot verify, so we do not block — the `where`-based
  // path covers the general case and RLS is the intended backstop.
  if (row.institutionId === undefined) return result;

  if (row.institutionId !== institutionId) {
    logger.warn('Blocked cross-institution record access', {
      module: model,
      operation: 'findUnique'
    });
    // Reported as not-found: confirming the id exists elsewhere is itself a leak.
    throw new AuthorizationError('Record was not found.');
  }

  return result;
}

export const tenantExtension = Prisma.defineExtension({
  name: 'tenant-isolation',
  query: {
    $allModels: {
      async $allOperations({ model, operation, args, query }) {
        // ── Soft delete ─────────────────────────────────────────────────────
        //
        // Applied FIRST and independently of tenancy: a model can be
        // soft-deletable without being tenant-owned, and a deleted row must not
        // surface either way. `includeDeleted()` is the explicit, greppable
        // escape hatch — the same shape as `runUnscoped()`.
        if (
          SOFT_DELETABLE_MODELS.has(model) &&
          !isIncludingDeleted() &&
          WHERE_OPERATIONS.has(operation)
        ) {
          const withDeleted = args as { where?: Record<string, unknown> };
          // Only when the caller has not spoken about deletedAt themselves —
          // otherwise a deliberate `deletedAt: { not: null }` would be overwritten.
          if (withDeleted.where?.deletedAt === undefined) {
            withDeleted.where = { ...(withDeleted.where ?? {}), deletedAt: null };
          }
        }

        if (!TENANT_OWNED_MODELS.has(model)) {
          return query(args);
        }

        const institutionId = requireTenantId(model, operation);
        if (institutionId === null) {
          return query(args);
        }

        // ── Reads and bulk writes: constrain the where clause ────────────────
        if (WHERE_OPERATIONS.has(operation)) {
          const typedArgs = args as { where?: Record<string, unknown> };
          typedArgs.where = { ...(typedArgs.where ?? {}), institutionId };
          return query(args);
        }

        // ── Creates: stamp the tenant, overriding anything supplied ─────────
        if (CREATE_OPERATIONS.has(operation)) {
          const typedArgs = args as { data?: Record<string, unknown> | Record<string, unknown>[] };

          if (Array.isArray(typedArgs.data)) {
            typedArgs.data = typedArgs.data.map((row) => ({ ...row, institutionId }));
          } else if (typedArgs.data) {
            // Overwrite, never merge: a client must not be able to create a row
            // inside another institution by supplying institutionId.
            typedArgs.data = { ...typedArgs.data, institutionId };
          }
          return query(args);
        }

        // ── upsert: both halves need the tenant ─────────────────────────────
        if (operation === 'upsert') {
          const typedArgs = args as {
            create?: Record<string, unknown>;
            update?: Record<string, unknown>;
          };
          if (typedArgs.create) typedArgs.create = { ...typedArgs.create, institutionId };
          return query(args);
        }

        // ── Unique-key WRITES: constrain BEFORE the query ───────────────────
        //
        // `update` and `delete` used to fall through to the result check below.
        // That is sound for a read and CATASTROPHIC for a write: the row is
        // already changed or gone by the time the result is inspected, so the
        // extension threw AuthorizationError while the write stood.
        //
        // Demonstrated live before this fix, against a planted rival row:
        //
        //   DELETE /api/security/incidents/rival-incident-probe
        //     API  -> {"success":false,"message":"Record was not found."}
        //     rows -> BEFORE: 1   AFTER: 0
        //
        // A destructive cross-tenant write that REPORTS FAILURE is worse than
        // one that reports success: nothing looks wrong, so nobody investigates.
        //
        // Prisma permits a non-unique filter alongside the unique field in the
        // `where` of update/delete, and raises P2025 when nothing matches —
        // measured, not assumed. Injecting the tenant here makes the database
        // refuse the write instead of performing it and apologising.
        if (UNIQUE_WRITE_OPERATIONS.has(operation)) {
          const typedArgs = args as { where?: Record<string, unknown> };
          typedArgs.where = { ...(typedArgs.where ?? {}), institutionId };
          return query(args);
        }

        // ── Unique-key READS: verify the result ─────────────────────────────
        if (UNIQUE_OPERATIONS.has(operation)) {
          const result = await query(args);
          return verifyResultTenancy(result, institutionId, model);
        }

        return query(args);
      }
    }
  }
});
