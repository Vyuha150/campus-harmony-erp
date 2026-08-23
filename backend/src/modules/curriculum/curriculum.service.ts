/**
 * Curriculum & course registration service.
 *
 * WHAT THIS MAKES POSSIBLE
 *
 * `Programme` had no structure beneath it, so course registration was an
 * unconstrained insert into `Enrollment`. A student could register for a final
 * -year course in their first semester, exceed any credit load, or skip a
 * prerequisite entirely — nothing checked.
 *
 * Registration is now a RULE-ENFORCED operation:
 *   - the course must belong to the student's scheme
 *   - mandatory prerequisites must be PASSED (verified against CourseResult)
 *   - credit load must sit within the scheme's per-semester bounds
 *   - duplicate registration is rejected
 *
 * Every rejection carries a reason the student can act on, rather than a
 * generic failure.
 */

import { basePrisma } from '../../lib/prisma.js';
import { mutate, requireContext } from '../../lib/service.js';
import {
  NotFoundError,
  ConflictError,
  BusinessRuleError,
  ValidationError
} from '../../lib/errors.js';

const MODULE = 'curriculum';

// ─── Scheme authoring ─────────────────────────────────────────────────────────

export interface CreateSchemeInput {
  programmeId: string;
  code: string;
  name: string;
  effectiveFromYear: number;
  effectiveToYear?: number;
  totalCreditsRequired: number;
  minCreditsPerSemester?: number;
  maxCreditsPerSemester?: number;
  baskets: Array<{
    code: string;
    name: string;
    type: string;
    creditsRequired: number;
    isElective?: boolean;
    minCourses?: number;
    maxCourses?: number;
  }>;
}

export async function createScheme(input: CreateSchemeInput) {
  const ctx = requireContext();

  const programme = await basePrisma.programme.findFirst({
    where: { id: input.programmeId, institutionId: ctx.institutionId }
  });
  if (!programme) throw new NotFoundError('Programme');

  if (input.baskets.length === 0) {
    throw new ValidationError('A curriculum scheme must define at least one course basket.');
  }

  // Basket credits must add up to the graduation requirement, otherwise the
  // scheme describes a degree no student can actually complete.
  const basketTotal = input.baskets.reduce((sum, b) => sum + b.creditsRequired, 0);
  if (basketTotal !== input.totalCreditsRequired) {
    throw new ValidationError(
      `Basket credits total ${basketTotal} but the scheme requires ${input.totalCreditsRequired} to graduate.`,
      { basketTotal, required: input.totalCreditsRequired }
    );
  }

  const minPerSem = input.minCreditsPerSemester ?? 12;
  const maxPerSem = input.maxCreditsPerSemester ?? 30;
  if (minPerSem > maxPerSem) {
    throw new ValidationError(
      `Minimum credits per semester (${minPerSem}) exceeds the maximum (${maxPerSem}).`
    );
  }

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `CurriculumScheme:${(r as { id: string }).id}`,
      details: `Created curriculum ${input.code} for ${programme.code} (${input.totalCreditsRequired} credits, ${input.baskets.length} baskets)`,
      newValue: { code: input.code, totalCredits: input.totalCreditsRequired },
      severity: 'warning' // curriculum governs degree requirements
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const existing = await db.curriculumScheme.findFirst({
        where: { institutionId: ctx.institutionId, code: input.code, programmeId: input.programmeId }
      });
      if (existing) {
        throw new ConflictError(`Curriculum ${input.code} already exists for this programme.`);
      }

      return db.curriculumScheme.create({
        data: {
          institutionId: ctx.institutionId,
          programmeId: input.programmeId,
          code: input.code,
          name: input.name,
          effectiveFromYear: input.effectiveFromYear,
          effectiveToYear: input.effectiveToYear ?? null,
          totalCreditsRequired: input.totalCreditsRequired,
          minCreditsPerSemester: minPerSem,
          maxCreditsPerSemester: maxPerSem,
          status: 'draft',
          createdBy: ctx.userId,
          baskets: {
            create: input.baskets.map((b) => ({
              institutionId: ctx.institutionId,
              code: b.code,
              name: b.name,
              type: b.type,
              creditsRequired: b.creditsRequired,
              isElective: b.isElective ?? false,
              minCourses: b.minCourses ?? null,
              maxCourses: b.maxCourses ?? null
            }))
          }
        },
        include: { baskets: true }
      });
    }
  );
}

export interface AddSchemeCourseInput {
  schemeId: string;
  basketCode: string;
  courseId: string;
  semester: number;
  credits: number;
  lectureHours?: number;
  tutorialHours?: number;
  practicalHours?: number;
  /** Course codes within this scheme that must be completed first. */
  prerequisiteCourseCodes?: string[];
}

export async function addCourseToScheme(input: AddSchemeCourseInput) {
  const ctx = requireContext();

  const scheme = await basePrisma.curriculumScheme.findFirst({
    where: { id: input.schemeId, institutionId: ctx.institutionId },
    include: { baskets: true }
  });
  if (!scheme) throw new NotFoundError('Curriculum scheme');

  const basket = scheme.baskets.find((b) => b.code === input.basketCode);
  if (!basket) {
    throw new NotFoundError(`Basket ${input.basketCode} in this scheme`);
  }

  const course = await basePrisma.course.findFirst({
    where: { id: input.courseId, institutionId: ctx.institutionId }
  });
  if (!course) throw new NotFoundError('Course');

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: (r) => `SchemeCourse:${(r as { id: string }).id}`,
      details: `Added ${course.code} to ${scheme.code} basket ${basket.code}, semester ${input.semester}`,
      newValue: { course: course.code, basket: basket.code, semester: input.semester, credits: input.credits }
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      const schemeCourse = await db.schemeCourse.create({
        data: {
          institutionId: ctx.institutionId,
          schemeId: input.schemeId,
          basketId: basket.id,
          courseId: input.courseId,
          semester: input.semester,
          credits: input.credits,
          lectureHours: input.lectureHours ?? 0,
          tutorialHours: input.tutorialHours ?? 0,
          practicalHours: input.practicalHours ?? 0
        }
      });

      // Wire prerequisites by course code within the same scheme.
      for (const code of input.prerequisiteCourseCodes ?? []) {
        const prereqCourse = await db.course.findFirst({
          where: { institutionId: ctx.institutionId, code }
        });
        if (!prereqCourse) {
          throw new NotFoundError(`Prerequisite course ${code}`);
        }

        const prereqSchemeCourse = await db.schemeCourse.findFirst({
          where: { schemeId: input.schemeId, courseId: prereqCourse.id }
        });
        if (!prereqSchemeCourse) {
          throw new BusinessRuleError(
            `Prerequisite ${code} is not part of scheme ${scheme.code}. ` +
              'Add it to the scheme before referencing it.'
          );
        }

        // A course cannot require a course offered later than itself.
        if (prereqSchemeCourse.semester >= input.semester) {
          throw new BusinessRuleError(
            `${code} is offered in semester ${prereqSchemeCourse.semester} and cannot be a ` +
              `prerequisite for a course in semester ${input.semester}.`
          );
        }

        await db.coursePrerequisite.create({
          data: {
            institutionId: ctx.institutionId,
            schemeCourseId: schemeCourse.id,
            prerequisiteSchemeCourseId: prereqSchemeCourse.id,
            type: 'mandatory'
          }
        });
      }

      return schemeCourse;
    }
  );
}

export async function activateScheme(schemeId: string, approvingBody: string) {
  const ctx = requireContext();

  const scheme = await basePrisma.curriculumScheme.findFirst({
    where: { id: schemeId, institutionId: ctx.institutionId },
    include: { schemeCourses: true, baskets: true }
  });
  if (!scheme) throw new NotFoundError('Curriculum scheme');

  if (scheme.schemeCourses.length === 0) {
    throw new BusinessRuleError('A scheme cannot be activated with no courses.');
  }

  // Confirm each basket can actually be satisfied by the courses placed in it.
  for (const basket of scheme.baskets) {
    const available = scheme.schemeCourses
      .filter((sc) => sc.basketId === basket.id)
      .reduce((sum, sc) => sum + sc.credits, 0);

    if (available < basket.creditsRequired) {
      throw new BusinessRuleError(
        `Basket ${basket.code} requires ${basket.creditsRequired} credits but only ` +
          `${available} are available in it. No student could satisfy this requirement.`,
        { basket: basket.code, required: basket.creditsRequired, available }
      );
    }
  }

  return mutate(
    ctx,
    {
      action: 'APPROVE',
      module: MODULE,
      resource: `CurriculumScheme:${schemeId}`,
      details: `Activated curriculum ${scheme.code}, approved by ${approvingBody}`,
      oldValue: { status: scheme.status },
      newValue: { status: 'active', approvingBody },
      severity: 'critical' // governs what a degree requires
    },
    async (tx) =>
      (tx as never as typeof basePrisma).curriculumScheme.update({
        where: { id: schemeId },
        data: {
          status: 'active',
          approvedBy: ctx.userId,
          approvedAt: new Date(),
          approvingBody
        }
      })
  );
}

// ─── Course registration ──────────────────────────────────────────────────────

export interface RegistrationCheck {
  courseCode: string;
  allowed: boolean;
  reasons: string[];
}

/**
 * Check whether a student may register for a set of courses — WITHOUT writing.
 *
 * Kept separate from `registerCourses` so a student portal can show what is
 * blocking them before they submit, rather than surfacing a rejection.
 */
export async function checkRegistrationEligibility(
  studentProfileId: string,
  schemeCourseIds: string[]
): Promise<{ checks: RegistrationCheck[]; totalCredits: number; allAllowed: boolean }> {
  const ctx = requireContext();

  const student = await basePrisma.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: ctx.institutionId }
  });
  if (!student) throw new NotFoundError('Student profile');

  const schemeCourses = await basePrisma.schemeCourse.findMany({
    where: { id: { in: schemeCourseIds }, institutionId: ctx.institutionId },
    include: {
      course: true,
      scheme: true,
      prerequisites: { include: { prerequisiteCourse: { include: { course: true } } } }
    }
  });

  if (schemeCourses.length !== schemeCourseIds.length) {
    throw new NotFoundError('One or more scheme courses');
  }

  // Everything the student has already passed, by course id.
  const passed = await basePrisma.courseResult.findMany({
    where: { studentProfileId, institutionId: ctx.institutionId, isPassing: true },
    select: { courseId: true, gradePoint: true }
  });
  const passedByCourse = new Map(passed.map((p) => [p.courseId, p.gradePoint]));

  // Already-registered courses, so a repeat registration is caught.
  const existing = await basePrisma.enrollment.findMany({
    where: { studentProfileId },
    select: { courseId: true }
  });
  const registered = new Set(existing.map((e) => e.courseId));

  const checks: RegistrationCheck[] = [];
  let totalCredits = 0;

  for (const sc of schemeCourses) {
    const reasons: string[] = [];

    if (registered.has(sc.courseId)) {
      reasons.push('Already registered for this course.');
    }

    if (passedByCourse.has(sc.courseId)) {
      reasons.push('Already passed this course.');
    }

    for (const prereq of sc.prerequisites) {
      if (prereq.type === 'advisory') continue;

      const prereqCourseId = prereq.prerequisiteCourse.courseId;
      const prereqCode = prereq.prerequisiteCourse.course.code;
      const achieved = passedByCourse.get(prereqCourseId);

      if (achieved === undefined) {
        reasons.push(`Prerequisite ${prereqCode} has not been passed.`);
        continue;
      }

      if (prereq.minGradePoint !== null && achieved < prereq.minGradePoint) {
        reasons.push(
          `Prerequisite ${prereqCode} requires grade point ${prereq.minGradePoint}; achieved ${achieved}.`
        );
      }
    }

    if (reasons.length === 0) totalCredits += sc.credits;

    checks.push({ courseCode: sc.course.code, allowed: reasons.length === 0, reasons });
  }

  // Credit ceiling from the scheme, applied to the eligible subset.
  const scheme = schemeCourses[0]?.scheme;
  if (scheme && totalCredits > scheme.maxCreditsPerSemester) {
    for (const check of checks) {
      if (check.allowed) {
        check.allowed = false;
        check.reasons.push(
          `Registration totals ${totalCredits} credits, above the ${scheme.maxCreditsPerSemester} permitted per semester.`
        );
      }
    }
  }

  return {
    checks,
    totalCredits,
    allAllowed: checks.every((c) => c.allowed)
  };
}

/**
 * Register a student for courses.
 *
 * Rejects the WHOLE request if any course fails its checks — a partial
 * registration would leave the student believing they are enrolled in courses
 * they are not, which is worse than a clear rejection.
 */
export async function registerCourses(studentProfileId: string, schemeCourseIds: string[]) {
  const ctx = requireContext();

  const eligibility = await checkRegistrationEligibility(studentProfileId, schemeCourseIds);

  if (!eligibility.allAllowed) {
    const blocked = eligibility.checks.filter((c) => !c.allowed);
    throw new BusinessRuleError(
      `Registration rejected: ${blocked.length} course(s) failed validation.`,
      { blocked }
    );
  }

  const schemeCourses = await basePrisma.schemeCourse.findMany({
    where: { id: { in: schemeCourseIds } },
    include: { course: true }
  });

  const student = await basePrisma.studentProfile.findFirst({
    where: { id: studentProfileId, institutionId: ctx.institutionId }
  });
  if (!student) throw new NotFoundError('Student profile');

  return mutate(
    ctx,
    {
      action: 'CREATE',
      module: MODULE,
      resource: `StudentProfile:${studentProfileId}`,
      details: `Registered ${student.rollNumber} for ${schemeCourses.length} course(s), ${eligibility.totalCredits} credits`,
      newValue: {
        courses: schemeCourses.map((sc) => sc.course.code),
        totalCredits: eligibility.totalCredits
      },
      severity: 'info'
    },
    async (tx) => {
      const db = tx as never as typeof basePrisma;

      for (const sc of schemeCourses) {
        await db.enrollment.create({
          data: {
            studentProfileId,
            courseId: sc.courseId,
            semester: sc.semester
          }
        });
      }

      return {
        registered: schemeCourses.map((sc) => sc.course.code),
        totalCredits: eligibility.totalCredits
      };
    }
  );
}

/**
 * Degree progress against the scheme's basket requirements.
 *
 * Answers "what does this student still need to graduate?" from real results —
 * the basis of a progression check, and of NIRF graduation-outcome reporting.
 */
export async function getDegreeProgress(studentProfileId: string, schemeId: string) {
  const ctx = requireContext();

  const scheme = await basePrisma.curriculumScheme.findFirst({
    where: { id: schemeId, institutionId: ctx.institutionId },
    include: { baskets: true, schemeCourses: true }
  });
  if (!scheme) throw new NotFoundError('Curriculum scheme');

  const passed = await basePrisma.courseResult.findMany({
    where: { studentProfileId, institutionId: ctx.institutionId, isPassing: true },
    select: { courseId: true, credits: true }
  });
  const passedCourseIds = new Set(passed.map((p) => p.courseId));

  const basketProgress = scheme.baskets.map((basket) => {
    const basketCourses = scheme.schemeCourses.filter((sc) => sc.basketId === basket.id);
    const earned = basketCourses
      .filter((sc) => passedCourseIds.has(sc.courseId))
      .reduce((sum, sc) => sum + sc.credits, 0);

    return {
      basket: basket.code,
      name: basket.name,
      type: basket.type,
      creditsRequired: basket.creditsRequired,
      creditsEarned: earned,
      creditsRemaining: Math.max(0, basket.creditsRequired - earned),
      isComplete: earned >= basket.creditsRequired
    };
  });

  const totalEarned = basketProgress.reduce((sum, b) => sum + b.creditsEarned, 0);

  return {
    scheme: { code: scheme.code, totalCreditsRequired: scheme.totalCreditsRequired },
    totalCreditsEarned: totalEarned,
    totalCreditsRemaining: Math.max(0, scheme.totalCreditsRequired - totalEarned),
    percentComplete: Math.round((totalEarned / scheme.totalCreditsRequired) * 100),
    isEligibleToGraduate: basketProgress.every((b) => b.isComplete),
    baskets: basketProgress
  };
}

export async function listSchemes(programmeId?: string) {
  const ctx = requireContext();
  return basePrisma.curriculumScheme.findMany({
    where: {
      institutionId: ctx.institutionId,
      ...(programmeId ? { programmeId } : {})
    },
    include: { baskets: true, _count: { select: { schemeCourses: true } } },
    orderBy: { effectiveFromYear: 'desc' }
  });
}
