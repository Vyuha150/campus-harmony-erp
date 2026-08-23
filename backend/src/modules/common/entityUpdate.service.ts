/**
 * Tenant-safe entity update (Phase 3b).
 *
 * WHAT THIS REPLACES
 *
 * 17 handlers across 9 route files carried this line:
 *
 *     prisma.<model>.update({ where: { id }, data: req.body })
 *
 * Two defects in one expression:
 *
 *   1. UPDATE BY UNIQUE KEY. The tenant extension can constrain a `where`
 *      clause but cannot filter a unique-key update, so knowing an id was
 *      enough to write another institution's row. 16 of the 17 models had no
 *      `institutionId` at all (closed by migration 0028), so those tables were
 *      global: sports rosters, incident reports, journal entries, anti-ragging
 *      affidavits, transfer requests, broadcast messages and accreditation
 *      checklists were all readable and writable from any institution.
 *
 *   2. `data: req.body`. Unrestricted mass assignment — every column writable,
 *      including ones the domain treats as derived or decided elsewhere.
 *
 * WHY ONE HELPER RATHER THAN 16 SERVICES
 *
 * These are plain attribute edits: no cross-entity invariants, no state machine,
 * no money. Writing 16 near-identical services would spread the rule across 16
 * files that then drift — which is exactly how the same line ended up in both
 * `coe.ts` and `registrar.ts`. Anything with real domain logic gets its own
 * service instead; `modules/coe/exams.service.ts` is the example.
 *
 * The safety properties hold in one place:
 *
 *   - the caller supplies a zod `.strict()` schema, so unknown keys are refused
 *     rather than ignored;
 *   - the write is `updateMany` filtered on BOTH id and institutionId;
 *   - a count of 0 is reported as "not found" without saying whether the row
 *     exists elsewhere;
 *   - every change is audited with before/after values.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate } from '../../lib/service.js';
import { NotFoundError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';

/** Prisma delegates this helper may drive. Keyed by model name. */
export type TenantModel =
  | 'alumniEvent'
  | 'alumniJobPosting'
  | 'journalEntry'
  | 'antiRaggingAffidavit'
  | 'qualityMetric'
  | 'transferRequest'
  | 'vacancy'
  | 'accreditationChecklist'
  | 'incidentReport'
  | 'sportsAthlete'
  | 'sportsTeam'
  | 'sportsAttendance'
  | 'sportsFacility'
  | 'sportsInventoryItem'
  | 'meeting'
  | 'broadcastMessage'
  | 'course';

export interface UpdateSpec {
  /** Prisma delegate name, e.g. `sportsTeam`. */
  model: TenantModel;
  /** Model name for the audit resource, e.g. `SportsTeam`. */
  entity: string;
  /** Functional module for the audit entry, e.g. `sports`. */
  module: string;
  id: string;
  /** Already parsed by a `.strict()` schema at the route boundary. */
  data: Record<string, unknown>;
  /**
   * Fields worth recording in the audit `oldValue`. Kept small deliberately:
   * dumping a whole row into the audit trail copies data that may be sensitive
   * into a second, longer-lived place.
   */
  auditFields?: string[];
}

/**
 * Apply a validated patch to one tenant-owned row.
 *
 * `basePrisma`, not `prisma` — and therefore the `institutionId` filter is
 * written by hand. The extension wraps `prisma`, but `mutate()` opens its
 * transaction on `basePrisma`, so the transaction client is unscoped. This is
 * the hazard recorded in `docs/development-plan/20_PHASE_3_BASELINE.md`:
 * `serviceScoping.test.ts` fails the build if the filter is ever dropped.
 */
export async function updateTenantEntity<T = unknown>(
  context: TenantContext,
  spec: UpdateSpec
): Promise<T> {
  const delegate = (basePrisma as unknown as Record<string, any>)[spec.model];

  const existing = await delegate.findFirst({
    where: { id: spec.id, institutionId: context.institutionId }
  });

  // Absent, or another institution's. Both answer "not yours to edit", and
  // distinguishing them would confirm that an id exists somewhere else.
  if (!existing) throw new NotFoundError(`${spec.entity} ${spec.id}`);

  const changed = Object.keys(spec.data);

  const oldValue = spec.auditFields
    ? Object.fromEntries(spec.auditFields.map((f) => [f, existing[f]]))
    : Object.fromEntries(changed.map((f) => [f, existing[f]]));

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: spec.module,
      resource: `${spec.entity}:${spec.id}`,
      details: `Updated ${changed.join(', ')} on ${spec.entity} ${spec.id}`,
      oldValue: JSON.stringify(oldValue),
      newValue: JSON.stringify(spec.data)
    },
    async (tx) => {
      const txDelegate = (tx as unknown as Record<string, any>)[spec.model];

      const result = await txDelegate.updateMany({
        where: { id: spec.id, institutionId: context.institutionId },
        data: spec.data
      });

      if (result.count === 0) throw new NotFoundError(`${spec.entity} ${spec.id}`);

      return (await txDelegate.findFirst({
        where: { id: spec.id, institutionId: context.institutionId }
      })) as T;
    }
  );
}
