/**
 * Examination schedule service (Phase 3a).
 *
 * WHAT WAS WRONG IN `routes/coe.ts`
 *
 *   1. NO TENANT KEY. `ExamProgress` had no `institutionId` and was absent from
 *      TENANT_OWNED_MODELS, so the schedule was shared across every institution.
 *      Closed by migration 0027.
 *
 *   2. UPDATE BY UNIQUE KEY WITH THE RAW BODY:
 *
 *          prisma.examProgress.update({ where: { id }, data: req.body })
 *
 *      Two defects in one line. The tenant extension can constrain a `where`
 *      clause but cannot filter a unique-key update, so an id was enough to
 *      write another institution's exam; and `data: req.body` made every column
 *      writable, so `resultsPublished: true` could be set with no marks
 *      entered. The identical line was in `routes/registrar.ts`.
 *
 *   3. HARD DELETE, NO AUDIT. `prisma.examProgress.delete({ where: { id } })`
 *      removed an examination outright, unscoped, with nothing recorded.
 *
 *   4. FABRICATED FIGURES ON READ. `GET /exams` ignored the stored
 *      `totalStudents` and inferred it from StudentProfile counts, falling back
 *      through three guesses to "every profile in the system". It also forced
 *      `marksEntered = totalStudents` whenever status was `published`. The
 *      screen therefore showed a completion figure computed to look finished
 *      rather than read from the record.
 */

// `basePrisma`, NOT `prisma`. The tenant extension wraps `prisma`, but
// `mutate()` opens its transaction on `basePrisma`, so the transaction client is
// unscoped — and mixing a scoped read with an unscoped write in one service is
// worse than being consistently explicit. Every `where` below therefore carries
// `institutionId` by hand, matching finance, library and admissions.
//
// This is a real hazard, not a style choice: the first version of this file used
// basePrisma WITHOUT the explicit filter, and live verification showed another
// institution's exam being listed and then successfully renamed through
// `PUT /coe/exams/:id`. `examScoping.test.ts` now fails the build if any query
// here loses its filter.
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
import type { CreateExamInput, UpdateExamInput } from './exams.schema.js';

export interface ExamView {
  id: string;
  examName: string;
  semester: string;
  program: string;
  totalStudents: number;
  marksEntered: number;
  resultsPublished: boolean;
  status: string;
  startDate: Date;
  endDate: Date;
  coordinator: string;
}

/**
 * List the schedule.
 *
 * Returns what is stored. The previous handler replaced `totalStudents` with a
 * count derived from StudentProfile, and when no programme matched it fell back
 * to the total number of student profiles in the system — so an exam for one
 * programme could report the whole university as its cohort. It then set
 * `marksEntered = totalStudents` for anything published, which makes a progress
 * bar that always reads complete at the end regardless of what was entered.
 *
 * Both were inventions. If a stored figure is wrong, the fix belongs where the
 * figure is written, not in a display path that quietly overwrites it.
 */
export async function listExams(
  context: TenantContext,
  page: PageRequest
): Promise<Paginated<ExamView>> {
  const [rows, total] = await Promise.all([
    basePrisma.examProgress.findMany({
      where: { institutionId: context.institutionId },
      orderBy: { startDate: 'desc' },
      ...toSkipTake(page)
    }),
    basePrisma.examProgress.count({ where: { institutionId: context.institutionId } })
  ]);

  return paginated(rows as ExamView[], total, page);
}

export async function createExam(
  context: TenantContext,
  input: CreateExamInput
): Promise<ExamView> {
  const coordinator =
    input.coordinator ??
    (await basePrisma.user.findFirst({ where: { id: context.userId }, select: { name: true } }))
      ?.name ??
    context.userId;

  return mutate(
    context,
    {
      action: 'CREATE',
      module: 'examination',
      resource: (result: unknown) => `ExamProgress:${(result as ExamView).id}`,
      details: (result: unknown) => {
        const exam = result as ExamView;
        return `Scheduled "${exam.examName}" for ${exam.program} semester ${exam.semester}`;
      }
    },
    async (tx) =>
      (await tx.examProgress.create({
        data: {
          institutionId: context.institutionId,
          examName: input.examName,
          semester: input.semester,
          program: input.program,
          totalStudents: input.totalStudents,
          // Not accepted from the client. Both are consequences of work done
          // elsewhere; a caller asserting them is how a progress figure stops
          // meaning anything.
          marksEntered: 0,
          resultsPublished: false,
          status: 'scheduling',
          startDate: new Date(input.startDate),
          endDate: new Date(input.endDate),
          coordinator
        }
      })) as ExamView
  );
}

/**
 * Amend a scheduled exam.
 *
 * `updateMany` with a tenant-constrained `where`, never `update({ where: { id } })`.
 * A count of 0 is reported as "not found" without distinguishing absent from
 * another institution's — telling them apart would confirm that an id exists
 * elsewhere.
 */
export async function updateExam(
  context: TenantContext,
  id: string,
  input: UpdateExamInput
): Promise<ExamView> {
  const existing = await basePrisma.examProgress.findFirst({ where: { id, institutionId: context.institutionId } });
  if (!existing) throw new NotFoundError(`Exam ${id}`);

  if (input.startDate || input.endDate) {
    const start = Date.parse(input.startDate ?? existing.startDate.toISOString());
    const end = Date.parse(input.endDate ?? existing.endDate.toISOString());
    if (end < start) {
      throw new ValidationError('endDate cannot fall before startDate.', { field: 'endDate' });
    }
  }

  return mutate(
    context,
    {
      action: 'UPDATE',
      module: 'examination',
      resource: `ExamProgress:${id}`,
      details: `Amended ${Object.keys(input).join(', ')} on "${existing.examName}"`,
      oldValue: JSON.stringify({
        examName: existing.examName,
        semester: existing.semester,
        program: existing.program,
        totalStudents: existing.totalStudents,
        status: existing.status
      }),
      newValue: JSON.stringify(input)
    },
    async (tx) => {
      const result = await tx.examProgress.updateMany({
        where: { id, institutionId: context.institutionId },
        data: {
          ...(input.examName !== undefined ? { examName: input.examName } : {}),
          ...(input.semester !== undefined ? { semester: input.semester } : {}),
          ...(input.program !== undefined ? { program: input.program } : {}),
          ...(input.totalStudents !== undefined ? { totalStudents: input.totalStudents } : {}),
          ...(input.coordinator !== undefined ? { coordinator: input.coordinator } : {}),
          ...(input.status !== undefined ? { status: input.status } : {}),
          // `resultsPublished` follows FROM the status reaching 'published';
          // it is not a separate claim a caller may assert (which is why the
          // schema refuses it). Without this, publishing through
          // RegistrarExamOversight.tsx moved the status but left the flag
          // false, so the exam was published and simultaneously not.
          //
          // `marksEntered` is deliberately NOT touched here. Forcing it to
          // totalStudents on publish is precisely the fabrication Phase 3a
          // removed: it made a progress figure that always read complete at
          // the end regardless of what was actually entered.
          ...(input.status === 'published' ? { resultsPublished: true } : {}),
          ...(input.startDate !== undefined ? { startDate: new Date(input.startDate) } : {}),
          ...(input.endDate !== undefined ? { endDate: new Date(input.endDate) } : {})
        }
      });

      if (result.count === 0) throw new NotFoundError(`Exam ${id}`);

      return (await tx.examProgress.findFirst({ where: { id, institutionId: context.institutionId } })) as ExamView;
    }
  );
}

/**
 * Remove a scheduled exam.
 *
 * ExamProgress has no `deletedAt`, so this is still a hard delete — but it is
 * now tenant-scoped, audited at `warning`, and refuses once an exam is under
 * way. Deleting a row that students have sat is not a correction; the marks and
 * registrations that reference it do not disappear with it.
 */
export async function deleteExam(
  context: TenantContext,
  id: string,
  reason: string
): Promise<{ id: string }> {
  if (!reason || reason.trim().length < 10) {
    throw new ValidationError(
      'A reason of at least 10 characters is required to delete a scheduled exam.',
      { field: 'reason' }
    );
  }

  const existing = await basePrisma.examProgress.findFirst({ where: { id, institutionId: context.institutionId } });
  if (!existing) throw new NotFoundError(`Exam ${id}`);

  if (existing.status !== 'scheduling') {
    throw new ValidationError(
      `"${existing.examName}" is at status "${existing.status}" and can no longer be deleted. Only an exam still being scheduled may be removed.`,
      { field: 'status' }
    );
  }

  return mutate(
    context,
    {
      action: 'DELETE',
      module: 'examination',
      resource: `ExamProgress:${id}`,
      details: `Deleted scheduled exam "${existing.examName}" (${existing.program} sem ${existing.semester})`,
      oldValue: JSON.stringify(existing),
      reason: reason.trim(),
      severity: 'warning'
    },
    async (tx) => {
      const result = await tx.examProgress.deleteMany({ where: { id, institutionId: context.institutionId } });
      if (result.count === 0) throw new NotFoundError(`Exam ${id}`);
      return { id };
    }
  );
}
