/**
 * Grievance service.
 *
 * WHAT WAS WRONG IN `routes/grievances.ts`
 *
 *   1. NO TENANT KEY. `GrievanceCase` and `ComplianceItem` had no
 *      `institutionId` and were absent from TENANT_OWNED_MODELS, so both tables
 *      were global. Every grievance officer in the deployment could read and
 *      write every institution's cases — harassment and ragging complaints,
 *      complainant identities, evidence references, investigation timelines.
 *      Closed by migration 0031.
 *
 *   2. ANONYMITY WAS DEFEATED BY THE TIMELINE. The handler correctly omitted
 *      `complainantId` for an anonymous submission, and then wrote
 *
 *          timeline: [{ ..., by: req.user?.id }]
 *
 *      into the same row. The submitter's user id was recorded in the case
 *      regardless, so an anonymous complaint identified its author to anyone who
 *      could read it. The option offered the appearance of protection while
 *      storing the one field it promised not to.
 *
 *   3. IMPERSONATION. `complainantId` was read from the REQUEST BODY. A caller
 *      could file a grievance attributed to another person — in the module where
 *      the complainant's identity is the most consequential field in the row.
 *
 *   4. `complainantName` was required even for anonymous cases, so a real name
 *      was stored on a submission that had asked not to be identified.
 *
 * WHAT IS DELIBERATELY NOT SOLVED HERE
 *
 * The `evidenceFiles` a complainant uploads still carry their own upload
 * metadata, and the object store records who uploaded them. Anonymity in this
 * module protects the CASE RECORD; it is not an unlinkability guarantee against
 * someone with database and file-store access. Saying otherwise would be a
 * stronger promise than the system keeps. Recorded rather than implied.
 */

import { basePrisma } from '../../lib/prisma.js';
import {
  mutate,
  toSkipTake,
  paginated,
  type PageRequest,
  type Paginated
} from '../../lib/service.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import type { TenantContext } from '../../lib/tenant.js';
import type { CreateCaseInput, UpdateCaseInput, AddActivityInput } from './grievances.schema.js';

/** Placeholder stored in place of a name on an anonymous submission. */
const ANONYMOUS_NAME = 'Anonymous complainant';

interface TimelineEntry {
  date: string;
  action: string;
  by: string;
  notes?: string;
}

/**
 * Who to record as the actor on a timeline entry.
 *
 * For an anonymous case the answer is nobody. Returning the caller's id here is
 * precisely the defect this module had: the identity omitted from
 * `complainantId` was written straight back into the timeline.
 *
 * Officer actions on an anonymous case ARE attributed — the protection is for
 * the complainant, not for the people handling the complaint. `actorIsComplainant`
 * distinguishes the two.
 */
function timelineActor(
  context: TenantContext,
  isAnonymous: boolean,
  actorIsComplainant: boolean
): string {
  if (isAnonymous && actorIsComplainant) return 'anonymous';
  return context.userId;
}

export interface CaseView {
  id: string;
  grievanceNumber: string;
  complainantName: string;
  complainantType: string;
  complainantId: string | null;
  isAnonymous: boolean;
  category: string;
  subject: string;
  status: string;
  severity: string;
  submissionDate: Date;
}

/**
 * File a grievance.
 *
 * The complainant is the AUTHENTICATED CALLER or nobody. It is never read from
 * the request.
 */
export async function fileCase(
  context: TenantContext,
  input: CreateCaseInput
): Promise<CaseView> {
  const isAnonymous = input.isAnonymous ?? false;

  const caller = await basePrisma.user.findFirst({
    where: { id: context.userId },
    select: { name: true }
  });

  // Numbering is per-institution (0031). Sequence over count: counting live rows
  // would reuse a number after a deletion, and two cases sharing a number in a
  // complaints register is a records failure, not a cosmetic one.
  const year = new Date().getFullYear();
  const last = await basePrisma.grievanceCase.findFirst({
    where: {
      institutionId: context.institutionId,
      grievanceNumber: { startsWith: `GRV-${year}-` }
    },
    orderBy: { grievanceNumber: 'desc' },
    select: { grievanceNumber: true }
  });
  const nextSeq = last ? Number(last.grievanceNumber.split('-').pop() ?? 0) + 1 : 1;
  const grievanceNumber = `GRV-${year}-${String(nextSeq).padStart(4, '0')}`;

  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'grievances',
      resource: (r: unknown) => `GrievanceCase:${(r as CaseView).id}`,
      // The audit entry names the CASE, never the complainant. An audit trail
      // that records who filed an anonymous complaint re-identifies them in a
      // second, longer-lived place.
      details: (r: unknown) =>
        `Grievance ${(r as CaseView).grievanceNumber} filed (${(r as CaseView).category}, ` +
        `${isAnonymous ? 'anonymous' : 'attributed'})`,
      severity: 'warning'
    },
    async (tx) => {
      const created = await tx.grievanceCase.create({
        data: {
          institutionId: context.institutionId,
          grievanceNumber,
          // Identity comes from the token, or is withheld entirely.
          complainantId: isAnonymous ? null : context.userId,
          complainantName: isAnonymous ? ANONYMOUS_NAME : (caller?.name ?? 'Unknown'),
          complainantType: isAnonymous ? 'anonymous' : input.complainantType,
          isAnonymous,
          category: input.category,
          subcategory: input.subcategory ?? null,
          subject: input.subject,
          description: input.description,
          severity: input.severity ?? 'medium',
          department: input.department ?? null,
          status: 'received',
          evidenceFiles: input.evidenceFiles ?? [],
          timeline: [
            {
              date: new Date().toISOString(),
              action: 'Case filed',
              // `anonymous`, not the caller's id. This one substitution is the
              // difference between an anonymity option and a false promise.
              by: timelineActor(context, isAnonymous, true),
              notes: 'Grievance submitted'
            } satisfies TimelineEntry
          ]
        }
      });

      return created as unknown as CaseView;
    }
  );
}

export async function listCases(
  context: TenantContext,
  page: PageRequest,
  filters: { status?: string | undefined; severity?: string | undefined; category?: string | undefined }
): Promise<Paginated<CaseView>> {
  const where = {
    institutionId: context.institutionId,
    ...(filters.status ? { status: filters.status } : {}),
    ...(filters.severity ? { severity: filters.severity } : {}),
    ...(filters.category ? { category: filters.category } : {})
  };

  const [rows, total] = await Promise.all([
    basePrisma.grievanceCase.findMany({
      where,
      orderBy: { submissionDate: 'desc' },
      ...toSkipTake(page)
    }),
    basePrisma.grievanceCase.count({ where })
  ]);

  return paginated(rows as unknown as CaseView[], total, page);
}

export async function getCase(context: TenantContext, id: string): Promise<CaseView> {
  const found = await basePrisma.grievanceCase.findFirst({
    where: { id, institutionId: context.institutionId }
  });
  if (!found) throw new NotFoundError(`Grievance ${id}`);
  return found as unknown as CaseView;
}

/**
 * Update a case.
 *
 * Terminal states require a resolution. A grievance closed with no account of
 * what was decided is indistinguishable from one that was ignored, and the
 * register cannot tell the difference later.
 */
export async function updateCase(
  context: TenantContext,
  id: string,
  input: UpdateCaseInput
): Promise<CaseView> {
  const existing = await basePrisma.grievanceCase.findFirst({
    where: { id, institutionId: context.institutionId }
  });
  if (!existing) throw new NotFoundError(`Grievance ${id}`);

  const terminal = input.status === 'resolved' || input.status === 'closed';
  const resolution = input.resolution ?? existing.resolution;
  if (terminal && (!resolution || resolution.trim().length < 10)) {
    throw new ValidationError(
      'A resolution of at least 10 characters is required to resolve or close a grievance.',
      { field: 'resolution' }
    );
  }

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'grievances',
      resource: `GrievanceCase:${id}`,
      details:
        `Updated ${Object.keys(input).join(', ')} on grievance ${existing.grievanceNumber}`,
      oldValue: JSON.stringify({
        status: existing.status,
        severity: existing.severity,
        assignedTo: existing.assignedTo
      }),
      newValue: JSON.stringify(input),
      severity: terminal ? 'warning' : 'info'
    },
    async (tx) => {
      const result = await tx.grievanceCase.updateMany({
        where: { id, institutionId: context.institutionId },
        data: {
          ...(input.status !== undefined ? { status: input.status } : {}),
          ...(input.severity !== undefined ? { severity: input.severity } : {}),
          ...(input.category !== undefined ? { category: input.category } : {}),
          ...(input.subcategory !== undefined ? { subcategory: input.subcategory } : {}),
          ...(input.assignedTo !== undefined ? { assignedTo: input.assignedTo } : {}),
          ...(input.department !== undefined ? { department: input.department } : {}),
          ...(input.expectedResolutionDate !== undefined
            ? {
                expectedResolutionDate: input.expectedResolutionDate
                  ? new Date(input.expectedResolutionDate)
                  : null
              }
            : {}),
          ...(input.resolution !== undefined ? { resolution: input.resolution } : {}),
          ...(input.satisfactionRating !== undefined
            ? { satisfactionRating: input.satisfactionRating }
            : {}),
          ...(terminal ? { actualResolutionDate: new Date() } : {}),
          lastUpdated: new Date()
        }
      });

      if (result.count === 0) throw new NotFoundError(`Grievance ${id}`);

      return (await tx.grievanceCase.findFirst({
        where: { id, institutionId: context.institutionId }
      })) as unknown as CaseView;
    }
  );
}

/**
 * Append one entry to the timeline.
 *
 * Append-only in the application: the existing entries are read and the new one
 * added, never rewritten. The column is JSON, so this is a convention rather
 * than a database guarantee — unlike `WorkflowTransition`, which is enforced by
 * a trigger. Stated plainly because the difference matters if this register is
 * ever relied on as evidence.
 */
export async function addActivity(
  context: TenantContext,
  id: string,
  input: AddActivityInput
): Promise<CaseView> {
  const existing = await basePrisma.grievanceCase.findFirst({
    where: { id, institutionId: context.institutionId }
  });
  if (!existing) throw new NotFoundError(`Grievance ${id}`);

  const timeline = Array.isArray(existing.timeline)
    ? (existing.timeline as unknown as TimelineEntry[])
    : [];

  const entry: TimelineEntry = {
    date: new Date().toISOString(),
    action: input.action,
    // An officer acting on a case IS attributed, including on anonymous cases:
    // the protection covers the complainant, not the handler.
    by: timelineActor(context, existing.isAnonymous, false),
    ...(input.notes ? { notes: input.notes } : {})
  };

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'grievances',
      resource: `GrievanceCase:${id}`,
      details: `Timeline entry "${input.action}" added to ${existing.grievanceNumber}`
    },
    async (tx) => {
      const result = await tx.grievanceCase.updateMany({
        where: { id, institutionId: context.institutionId },
        data: {
          timeline: [...timeline, entry] as never,
          lastUpdated: new Date()
        }
      });

      if (result.count === 0) throw new NotFoundError(`Grievance ${id}`);

      return (await tx.grievanceCase.findFirst({
        where: { id, institutionId: context.institutionId }
      })) as unknown as CaseView;
    }
  );
}
