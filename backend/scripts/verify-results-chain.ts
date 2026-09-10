/**
 * Proves that publishing results actually updates a student's CGPA.
 *
 * THE BUG THIS EXISTS TO PREVENT COMING BACK:
 *
 * A complete, well-built examination/results engine existed — grade scales,
 * moderation gates, revaluation with attempt history, a correct
 * credit-weighted CGPA calculation — and `StudentProfile.cgpa` sat at 0 for a
 * student showing 92 earned credits. Every piece worked in isolation. Nothing
 * connected them: `recomputeStudentResults` was the only writer of that
 * column, it was reachable only through one endpoint, and nothing in the
 * backend or the frontend ever called it. Publication did not trigger it.
 *
 * Unit tests did not catch this, and could not have: `gpa.test.ts` tests the
 * arithmetic in isolation and passes regardless of whether anything ever calls
 * it. The defect was in the wiring between correct parts, so the check has to
 * run the wiring — against a real database, through the real services.
 *
 * Run by the `migrations` CI job, which already provisions PostgreSQL and
 * seeds it. Exits non-zero on failure.
 */

import { basePrisma } from '../src/lib/prisma.js';
import { runWithTenant } from '../src/lib/tenantStore.js';
import * as results from '../src/modules/results/results.service.js';

/**
 * Throws rather than calling process.exit().
 *
 * process.exit() terminates immediately and SKIPS the finally block, so a
 * failing run left its own rows behind — and the next run then collided with
 * them and failed for a different reason than the real one. A check that
 * dirties the database when it fails is a check people stop trusting.
 */
class CheckFailed extends Error {}

const FAIL = (message: string): never => {
  throw new CheckFailed(message);
};

const institution = await basePrisma.institution.findFirst({ select: { id: true } });
if (!institution) FAIL('No institution — run `prisma db seed` first.');

const admin = await basePrisma.user.findFirst({
  where: { role: 'super_admin' },
  select: { id: true, role: true }
});
if (!admin) FAIL('No super_admin user — run `prisma db seed` first.');

const student = await basePrisma.studentProfile.findFirst({
  select: { id: true, rollNumber: true, cgpa: true }
});
if (!student) FAIL('No student profile — run `prisma db seed` first.');

const course = await basePrisma.course.findFirst({ select: { id: true, credits: true } });
if (!course) FAIL('No course — run `prisma db seed` first.');

const scale = await basePrisma.gradeScale.findFirst({
  where: { institutionId: institution!.id, isActive: true },
  include: { bands: true }
});
if (!scale) {
  FAIL(
    'No active GradeScale. Every marks entry point throws without one, so the ' +
      'entire results engine is unusable. The seed must create one.'
  );
}

console.log(`Grading scale in force: ${scale!.code} (${scale!.bands.length} bands)`);

// A mark that lands in a known band, so the expected grade point is not a guess.
const MARKS = 85;
const band = scale!.bands
  .filter((b) => !b.isExcludedFromGpa)
  .find((b) => MARKS >= b.minMarks && MARKS <= b.maxMarks);

if (!band) FAIL(`No band covers ${MARKS} marks — the scale has a gap.`);

console.log(`${MARKS} marks maps to ${band!.letter} = ${band!.point} points`);

const ACADEMIC_YEAR = '2099-00'; // far-future, so this never collides with real data
const SEMESTER = 12;
/**
 * A deliberately high attempt number.
 *
 * `recordCourseResult` identifies an existing result by
 * studentProfileId + courseId + ATTEMPT — it does not include semester or
 * academic year — so a check using attempt 1 collides with any real result
 * for the same course and is refused as an unexplained amendment of a
 * published grade. 9 is outside the range real attempts reach.
 */
const ATTEMPT = 9;

const ctx = {
  institutionId: institution!.id,
  campusId: null,
  userId: admin!.id,
  role: admin!.role
};

// Clean any residue from a previous run, so the check is repeatable.
async function cleanup() {
  await basePrisma.gradeHistory.deleteMany({
    where: { courseResult: { academicYear: ACADEMIC_YEAR, attempt: ATTEMPT } }
  });
  await basePrisma.courseResult.deleteMany({
    where: { academicYear: ACADEMIC_YEAR, attempt: ATTEMPT }
  });
  await basePrisma.semesterResult.deleteMany({ where: { academicYear: ACADEMIC_YEAR } });
}

await cleanup();

// What the profile held before this check touched anything — restored at the
// end so the check leaves no trace, including on a database whose seeded
// figures are not derived from any results.
const original = await basePrisma.studentProfile.findUniqueOrThrow({
  where: { id: student!.id },
  select: { cgpa: true, earnedCredits: true }
});

/**
 * Establish a TRUE baseline before measuring anything.
 *
 * The seed ships `earnedCredits = 92` on a student with no published results
 * — a figure nothing computed. Measuring a delta against it produced -84 on
 * the first run, because the first recompute simply corrects the fabrication.
 * Recomputing first means the baseline is the real derived state, so the
 * delta afterwards measures only what publishing the test result did.
 */
await runWithTenant(ctx as never, async () => {
  await results.recomputeStudentResults(student!.id);
});

const before = await basePrisma.studentProfile.findUniqueOrThrow({
  where: { id: student!.id },
  select: { cgpa: true, earnedCredits: true }
});

let failure: unknown = null;

try {
  await runWithTenant(ctx as never, async () => {
    await results.recordCourseResult({
      studentProfileId: student!.id,
      courseId: course!.id,
      semester: SEMESTER,
      academicYear: ACADEMIC_YEAR,
      totalMarks: MARKS,
      maxMarks: 100,
      attempt: ATTEMPT
    });

    // The step that was missing. Publication must recompute — not a separate
    // call a caller is trusted to remember.
    await results.publishSemesterResults(SEMESTER, ACADEMIC_YEAR);
  });

  const after = await basePrisma.studentProfile.findUniqueOrThrow({
    where: { id: student!.id },
    select: { cgpa: true, earnedCredits: true }
  });

  const semesterResult = await basePrisma.semesterResult.findFirst({
    where: { studentProfileId: student!.id, academicYear: ACADEMIC_YEAR }
  });

  console.log(`\n  CGPA before publication: ${before.cgpa}`);
  console.log(`  CGPA after publication:  ${after.cgpa}`);

  if (!semesterResult) {
    FAIL('Publication created no SemesterResult row.');
  }

  if (semesterResult!.sgpa !== band!.point) {
    FAIL(
      `SGPA is ${semesterResult!.sgpa}, expected ${band!.point} — a single course ` +
        'graded at that band should produce exactly its grade point.'
    );
  }

  // THE assertion, expressed as a DELTA rather than an absolute.
  //
  // An absolute check (`earnedCredits === course.credits`) silently assumed
  // the student had no other published results, which is true of a freshly
  // seeded database and false of any real one — including this project's own
  // demo data once a result exists. The check then failed for a reason that
  // had nothing to do with what it is guarding.
  //
  // A delta holds either way: if publication stops recomputing, nothing moves
  // and the delta is zero.
  const creditsGained = after.earnedCredits - before.earnedCredits;
  if (creditsGained !== course!.credits) {
    FAIL(
      `earnedCredits moved by ${creditsGained}, expected +${course!.credits} from the ` +
        'newly published course. Publication is not recomputing — this is the ' +
        'original defect, where a complete results engine left ' +
        'StudentProfile.cgpa and earnedCredits untouched.'
    );
  }

  if (typeof after.cgpa !== 'number' || after.cgpa <= 0) {
    FAIL(`CGPA is ${after.cgpa} after publishing a passing result; it should be positive.`);
  }

  console.log(`  SGPA recorded:           ${semesterResult!.sgpa}`);
  console.log(`  Credits gained:          +${creditsGained}`);
  console.log('\n  PASS: publishing results recomputes SGPA/CGPA.\n');
} catch (error) {
  failure = error;
} finally {
  await cleanup();

  // Restore whatever the CGPA was before this ran, so the check leaves no trace.
  await basePrisma.studentProfile.update({
    where: { id: student!.id },
    data: { cgpa: original.cgpa, earnedCredits: original.earnedCredits }
  });

  await basePrisma.$disconnect();
}

if (failure) {
  console.error(`
  FAIL: ${failure instanceof Error ? failure.message : String(failure)}
`);
  process.exit(1);
}
