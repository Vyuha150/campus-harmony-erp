/**
 * Controller of Examinations — oversight reads.
 *
 * The remaining three handlers in `routes/coe.ts`. The examination schedule
 * (Phase 3a) and result publication (Phase 2.4) were migrated earlier; these are
 * the read paths that report on both.
 *
 * WHAT WAS WRONG
 *
 *   1. `avgGPA: 7.2` — a literal, identical for every department, semester and
 *      cohort, on the screen the CoE uses to decide whether results are fit to
 *      publish. Removed to `null` when the fabrications were swept; now COMPUTED,
 *      because the path to a real figure exists:
 *
 *          Department -> Programme -> StudentProfile -> SemesterResult
 *
 *      Only PUBLISHED results count. A draft result is a working figure, and
 *      averaging it into an oversight statistic reports a number the institution
 *      has not stood behind.
 *
 *   2. `GET /submissions` returned every row, unpaginated.
 *
 *   3. Both endpoints resolved department and requester names with a second and
 *      third query and a Map. That is retained — it is a batched lookup, not an
 *      N+1 — but it now runs through the service so the shape is testable.
 *
 * Tenancy is structural here: routes use the extended client and `basePrisma`
 * queries below carry an explicit `institutionId`, so both mechanisms hold.
 */

import { basePrisma } from '../../lib/prisma.js';
import { toSkipTake, paginated, type PageRequest, type Paginated } from '../../lib/service.js';
import type { TenantContext } from '../../lib/tenant.js';

const RESULT_PUBLICATION = 'result_publication';

/** Statuses that mean an exam cycle is under way rather than merely planned. */
const IN_FLIGHT = ['ongoing', 'mark_entry', 'evaluation', 'moderation'];
const PLANNED_OR_IN_FLIGHT = ['scheduling', ...IN_FLIGHT];

export interface SubmissionView {
  id: string;
  departmentId: string;
  department: string;
  status: string;
  requestedAt: Date;
  requestedBy: string;
  requestedByName: string;
  title: string;
  priority: string;
}

/** Resolve department and requester names for a page of approval rows. */
async function decorate(
  context: TenantContext,
  rows: { id: string; details: string; status: string; requestedAt: Date; requestedBy: string; title: string; priority: string }[]
): Promise<SubmissionView[]> {
  const departmentIds = [...new Set(rows.map((r) => String(r.details || '')).filter(Boolean))];
  const userIds = [...new Set(rows.map((r) => String(r.requestedBy || '')).filter(Boolean))];

  const [departments, users] = await Promise.all([
    departmentIds.length
      ? basePrisma.department.findMany({
          where: { id: { in: departmentIds }, institutionId: context.institutionId },
          select: { id: true, name: true }
        })
      : Promise.resolve([]),
    userIds.length
      ? basePrisma.user.findMany({
          where: { id: { in: userIds }, institutionId: context.institutionId },
          select: { id: true, name: true }
        })
      : Promise.resolve([])
  ]);

  const deptName = new Map(departments.map((d) => [d.id, d.name]));
  const userName = new Map(users.map((u) => [u.id, u.name]));

  return rows.map((r) => ({
    id: r.id,
    departmentId: String(r.details ?? ''),
    department: deptName.get(String(r.details ?? '')) ?? 'Unknown Department',
    status: r.status,
    requestedAt: r.requestedAt,
    requestedBy: r.requestedBy,
    requestedByName: userName.get(String(r.requestedBy ?? '')) ?? r.requestedBy,
    title: r.title,
    priority: r.priority
  }));
}

export async function dashboard(context: TenantContext) {
  const scope = { institutionId: context.institutionId };

  const [pending, published, planned, inFlight, latest] = await Promise.all([
    basePrisma.approvalItem.count({ where: { ...scope, type: RESULT_PUBLICATION, status: 'pending' } }),
    basePrisma.approvalItem.count({ where: { ...scope, type: RESULT_PUBLICATION, status: 'published' } }),
    basePrisma.examProgress.count({ where: { ...scope, status: { in: PLANNED_OR_IN_FLIGHT } } }),
    basePrisma.examProgress.count({ where: { ...scope, status: { in: IN_FLIGHT } } }),
    basePrisma.approvalItem.findMany({
      where: { ...scope, type: RESULT_PUBLICATION },
      orderBy: { requestedAt: 'desc' },
      take: 5
    })
  ]);

  return {
    stats: [
      { label: 'Pending Dean Approval', value: String(pending), icon: 'Clock' },
      { label: 'Published Results', value: String(published), icon: 'CheckCircle' },
      { label: 'Active Exam Cycles', value: String(inFlight), icon: 'ClipboardList' },
      { label: 'Exam Pipelines', value: String(planned), icon: 'BarChart3' }
    ],
    latestSubmissions: await decorate(context, latest as never)
  };
}

export async function listSubmissions(
  context: TenantContext,
  page: PageRequest
): Promise<Paginated<SubmissionView>> {
  const where = { institutionId: context.institutionId, type: RESULT_PUBLICATION };

  const [rows, total] = await Promise.all([
    basePrisma.approvalItem.findMany({
      where,
      orderBy: { requestedAt: 'desc' },
      ...toSkipTake(page)
    }),
    basePrisma.approvalItem.count({ where })
  ]);

  return paginated(await decorate(context, rows as never), total, page);
}

export interface DepartmentResultView {
  departmentId: string;
  department: string;
  totalStudents: number;
  passed: number;
  failed: number;
  passPercentage: number | null;
  /** Mean CGPA over PUBLISHED semester results. `null` when none are published. */
  avgGPA: number | null;
  publishedResultCount: number;
  status: string;
}

export async function departmentResults(
  context: TenantContext
): Promise<DepartmentResultView[]> {
  const scope = { institutionId: context.institutionId };

  const [departments, approvals] = await Promise.all([
    basePrisma.department.findMany({
      where: scope,
      include: {
        courses: { include: { enrollments: { select: { grade: true } } } },
        // Department -> Programme -> StudentProfile -> SemesterResult is the
        // path to a real average. It replaces the literal 7.2.
        programmes: {
          select: {
            studentProfiles: {
              select: {
                semesterResults: {
                  where: { status: 'published' },
                  orderBy: { semester: 'desc' },
                  take: 1,
                  select: { cgpa: true }
                }
              }
            }
          }
        }
      }
    }),
    basePrisma.approvalItem.findMany({ where: { ...scope, type: RESULT_PUBLICATION } })
  ]);

  const approvalByDept = new Map<string, { status: string }>();
  for (const a of approvals) {
    if (a.details) approvalByDept.set(String(a.details), { status: a.status });
  }

  return departments.map((d) => {
    const enrolments = d.courses.flatMap((c) => c.enrollments);
    const total = enrolments.length;
    // A grade of F or I is a fail; an ungraded enrolment is neither, and counting
    // it as a pass would inflate the figure the CoE publishes on.
    const graded = enrolments.filter((e) => e.grade != null && e.grade !== '');
    const passed = graded.filter((e) => !['F', 'I'].includes(String(e.grade))).length;

    const cgpas = d.programmes
      .flatMap((p) => p.studentProfiles)
      .flatMap((s) => s.semesterResults)
      .map((r) => r.cgpa);

    const approval = approvalByDept.get(d.id);
    let status = 'draft';
    if (approval?.status === 'pending') status = 'pending_approval';
    if (approval?.status === 'published' || approval?.status === 'approved') status = 'published';

    return {
      departmentId: d.id,
      department: d.name,
      totalStudents: total,
      passed,
      failed: graded.length - passed,
      // `null`, not 0: no graded enrolments means there is no pass rate, which
      // is different from a pass rate of zero.
      passPercentage: graded.length > 0 ? Math.round((passed / graded.length) * 100) : null,
      avgGPA:
        cgpas.length > 0
          ? Number((cgpas.reduce((a, b) => a + b, 0) / cgpas.length).toFixed(2))
          : null,
      publishedResultCount: cgpas.length,
      status
    };
  });
}
