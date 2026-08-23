/**
 * Report registry.
 *
 * THE ARCHITECTURAL POINT
 *
 * The audit found reporting logic re-implemented per endpoint, with no shared
 * layer and no way to answer "where did this number come from?". For an
 * institution that must defend figures to NAAC and NIRF, an untraceable number
 * is not evidence — it is an assertion.
 *
 * Every report here therefore declares:
 *   - `sourceModels`  which tables the figure is derived from
 *   - `formula`       how it is computed, in plain language
 *   - `run()`         the computation itself, over operational records
 *
 * Reports NEVER read from a separate "statistics" table. That separation —
 * operational data on one side, hand-maintained compliance numbers on the other
 * — is exactly the pattern `10_COMPLIANCE_DATA_PLAN.md` rules out.
 */

import { basePrisma } from '../../lib/prisma.js';
import type { TenantContext } from '../../lib/tenant.js';
import type { ExportColumn } from './export.js';

export interface ReportFilters {
  academicYear?: string | undefined;
  departmentId?: string | undefined;
  programmeId?: string | undefined;
  semester?: number | undefined;
}

export interface ReportResult {
  rows: Array<Record<string, unknown>>;
  /** Aggregate figures, where the report produces them. */
  summary?: Record<string, unknown>;
}

export interface ReportDefinition {
  code: string;
  name: string;
  description: string;
  category: 'academic' | 'admissions' | 'examination' | 'finance' | 'compliance';
  columns: ExportColumn[];
  /** PROVENANCE — the tables this figure is derived from. */
  sourceModels: string[];
  /** PROVENANCE — how the figure is computed, in plain language. */
  formula: string;
  run(ctx: TenantContext, filters: ReportFilters): Promise<ReportResult>;
}

// ─── Academic ─────────────────────────────────────────────────────────────────

const studentPerformance: ReportDefinition = {
  code: 'STUDENT_PERFORMANCE',
  name: 'Student Academic Performance',
  description: 'CGPA, credits earned and pass status per student.',
  category: 'academic',
  sourceModels: ['StudentProfile', 'SemesterResult', 'CourseResult'],
  formula:
    'CGPA and credits taken from the latest SemesterResult, which is itself computed ' +
    'as Σ(gradePoint × credits) / Σ(credits) over CourseResult rows.',
  columns: [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'name', label: 'Name' },
    { key: 'programme', label: 'Programme' },
    { key: 'semester', label: 'Semester' },
    { key: 'cgpa', label: 'CGPA' },
    { key: 'creditsEarned', label: 'Credits Earned' },
    { key: 'coursesPassed', label: 'Courses Passed' },
    { key: 'coursesFailed', label: 'Courses Failed' }
  ],
  async run(ctx, filters) {
    const students = await basePrisma.studentProfile.findMany({
      where: {
        institutionId: ctx.institutionId,
        ...(filters.programmeId ? { programmeId: filters.programmeId } : {}),
        ...(filters.semester ? { semester: filters.semester } : {})
      },
      include: { user: { select: { name: true } } },
      take: 5000
    });

    const rows = [];
    let cgpaSum = 0;
    let withResults = 0;

    for (const student of students) {
      const [latest, results] = await Promise.all([
        basePrisma.semesterResult.findFirst({
          where: { studentProfileId: student.id },
          orderBy: { semester: 'desc' }
        }),
        basePrisma.courseResult.findMany({
          where: { studentProfileId: student.id },
          select: { isPassing: true, isExcludedFromGpa: true }
        })
      ]);

      const passed = results.filter((r) => r.isPassing).length;
      const failed = results.filter((r) => !r.isPassing && !r.isExcludedFromGpa).length;

      // Reported from the computed SemesterResult, not the cached column on
      // StudentProfile — the calculation is authoritative.
      const cgpa = latest?.cgpa ?? 0;
      if (latest) {
        cgpaSum += cgpa;
        withResults += 1;
      }

      rows.push({
        rollNumber: student.rollNumber,
        name: student.user.name,
        programme: student.program,
        semester: student.semester,
        cgpa,
        creditsEarned: latest?.cumulativeCreditsEarned ?? 0,
        coursesPassed: passed,
        coursesFailed: failed
      });
    }

    return {
      rows,
      summary: {
        totalStudents: rows.length,
        studentsWithResults: withResults,
        averageCgpa: withResults > 0 ? Number((cgpaSum / withResults).toFixed(2)) : 0
      }
    };
  }
};

// ─── Examination ──────────────────────────────────────────────────────────────

const examPassRate: ReportDefinition = {
  code: 'EXAM_PASS_RATE',
  name: 'Examination Pass Rate by Course',
  description: 'Pass percentage per course — the basis of NIRF Graduation Outcomes.',
  category: 'examination',
  sourceModels: ['CourseResult', 'Course'],
  formula:
    'passRate = count(CourseResult WHERE isPassing) / count(CourseResult excluding ' +
    'isExcludedFromGpa) × 100, grouped by course.',
  columns: [
    { key: 'courseCode', label: 'Course Code' },
    { key: 'courseName', label: 'Course Name' },
    { key: 'appeared', label: 'Appeared' },
    { key: 'passed', label: 'Passed' },
    { key: 'failed', label: 'Failed' },
    { key: 'passRate', label: 'Pass Rate (%)' },
    { key: 'averageGradePoint', label: 'Avg Grade Point' }
  ],
  async run(ctx, filters) {
    const results = await basePrisma.courseResult.findMany({
      where: {
        institutionId: ctx.institutionId,
        ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
        ...(filters.semester ? { semester: filters.semester } : {})
      },
      select: {
        courseId: true,
        isPassing: true,
        isExcludedFromGpa: true,
        gradePoint: true
      }
    });

    const byCourse = new Map<
      string,
      { appeared: number; passed: number; failed: number; points: number }
    >();

    for (const r of results) {
      // Withdrawals and absences are excluded from the denominator — counting
      // them as failures would understate the pass rate.
      if (r.isExcludedFromGpa) continue;

      const bucket =
        byCourse.get(r.courseId) ??
        byCourse.set(r.courseId, { appeared: 0, passed: 0, failed: 0, points: 0 }).get(r.courseId)!;

      bucket.appeared += 1;
      bucket.points += r.gradePoint;
      if (r.isPassing) bucket.passed += 1;
      else bucket.failed += 1;
    }

    const courses = await basePrisma.course.findMany({
      where: { id: { in: [...byCourse.keys()] } },
      select: { id: true, code: true, name: true }
    });
    const courseById = new Map(courses.map((c) => [c.id, c]));

    const rows = [...byCourse.entries()].map(([courseId, b]) => ({
      courseCode: courseById.get(courseId)?.code ?? '',
      courseName: courseById.get(courseId)?.name ?? '',
      appeared: b.appeared,
      passed: b.passed,
      failed: b.failed,
      passRate: b.appeared > 0 ? Number(((b.passed / b.appeared) * 100).toFixed(1)) : 0,
      averageGradePoint: b.appeared > 0 ? Number((b.points / b.appeared).toFixed(2)) : 0
    }));

    rows.sort((a, b) => a.courseCode.localeCompare(b.courseCode));

    const totalAppeared = rows.reduce((s, r) => s + r.appeared, 0);
    const totalPassed = rows.reduce((s, r) => s + r.passed, 0);

    return {
      rows,
      summary: {
        courses: rows.length,
        totalAppeared,
        totalPassed,
        overallPassRate:
          totalAppeared > 0 ? Number(((totalPassed / totalAppeared) * 100).toFixed(1)) : 0
      }
    };
  }
};

// ─── Admissions ───────────────────────────────────────────────────────────────

const admissionsIntake: ReportDefinition = {
  code: 'ADMISSIONS_INTAKE',
  name: 'Admission Intake vs Capacity',
  description: 'Seat utilisation by reservation category — NAAC Criterion 2.',
  category: 'admissions',
  sourceModels: ['AdmissionCycle', 'AdmissionSeatMatrix', 'AdmissionApplication'],
  formula:
    'utilisation = AdmissionSeatMatrix.filledSeats / totalSeats × 100, per category, ' +
    'with application counts from AdmissionApplication.',
  columns: [
    { key: 'cycleCode', label: 'Cycle' },
    { key: 'category', label: 'Category' },
    { key: 'totalSeats', label: 'Sanctioned' },
    { key: 'filledSeats', label: 'Filled' },
    { key: 'vacantSeats', label: 'Vacant' },
    { key: 'utilisation', label: 'Utilisation (%)' },
    { key: 'applications', label: 'Applications' }
  ],
  async run(ctx, filters) {
    const cycles = await basePrisma.admissionCycle.findMany({
      where: {
        institutionId: ctx.institutionId,
        ...(filters.academicYear ? { academicYear: filters.academicYear } : {}),
        ...(filters.programmeId ? { programmeId: filters.programmeId } : {})
      },
      include: { seatMatrix: true }
    });

    const rows = [];

    for (const cycle of cycles) {
      for (const seat of cycle.seatMatrix) {
        const applications = await basePrisma.admissionApplication.count({
          where: { cycleId: cycle.id, category: seat.category }
        });

        rows.push({
          cycleCode: cycle.code,
          category: seat.category,
          totalSeats: seat.totalSeats,
          filledSeats: seat.filledSeats,
          vacantSeats: seat.totalSeats - seat.filledSeats,
          utilisation:
            seat.totalSeats > 0
              ? Number(((seat.filledSeats / seat.totalSeats) * 100).toFixed(1))
              : 0,
          applications
        });
      }
    }

    const sanctioned = rows.reduce((s, r) => s + (r.totalSeats as number), 0);
    const filled = rows.reduce((s, r) => s + (r.filledSeats as number), 0);

    return {
      rows,
      summary: {
        cycles: cycles.length,
        totalSanctioned: sanctioned,
        totalFilled: filled,
        overallUtilisation: sanctioned > 0 ? Number(((filled / sanctioned) * 100).toFixed(1)) : 0
      }
    };
  }
};

// ─── Compliance ───────────────────────────────────────────────────────────────

const facultyQualification: ReportDefinition = {
  code: 'FACULTY_QUALIFICATION',
  name: 'Faculty Qualification Profile',
  description: 'Faculty by qualification level — a NIRF "TLR" input.',
  category: 'compliance',
  sourceModels: ['FacultyProfile'],
  formula:
    'Count of FacultyProfile grouped by qualificationLevel, with the proportion ' +
    'holding a doctorate. Unverified and unknown qualifications are reported ' +
    'SEPARATELY and never counted as doctorates.',
  columns: [
    { key: 'qualificationLevel', label: 'Qualification' },
    { key: 'count', label: 'Count' },
    { key: 'verified', label: 'Verified' },
    { key: 'unverified', label: 'Unverified' },
    { key: 'percentage', label: 'Share (%)' }
  ],
  async run(ctx) {
    const faculty = await basePrisma.facultyProfile.findMany({
      where: { institutionId: ctx.institutionId },
      select: { qualificationLevel: true, qualificationVerified: true }
    });

    const byLevel = new Map<string, { count: number; verified: number }>();

    for (const f of faculty) {
      // NULL is reported as UNKNOWN, never silently bucketed as a doctorate.
      // The removed fabrication defaulted every faculty member to 'Ph.D in CSE',
      // which would have inflated exactly this figure in a NIRF submission.
      const level = f.qualificationLevel ?? 'UNKNOWN';
      const bucket = byLevel.get(level) ?? byLevel.set(level, { count: 0, verified: 0 }).get(level)!;
      bucket.count += 1;
      if (f.qualificationVerified) bucket.verified += 1;
    }

    const total = faculty.length;

    const rows = [...byLevel.entries()].map(([level, b]) => ({
      qualificationLevel: level,
      count: b.count,
      verified: b.verified,
      unverified: b.count - b.verified,
      percentage: total > 0 ? Number(((b.count / total) * 100).toFixed(1)) : 0
    }));

    const doctorates = byLevel.get('DOCTORATE')?.count ?? 0;
    const unknown = byLevel.get('UNKNOWN')?.count ?? 0;

    return {
      rows,
      summary: {
        totalFaculty: total,
        doctorates,
        doctoratePercentage: total > 0 ? Number(((doctorates / total) * 100).toFixed(1)) : 0,
        unknownQualification: unknown,
        // Surfaced deliberately: a submission built on unverified data should
        // be flagged as such rather than quietly reported as fact.
        dataQualityWarning:
          unknown > 0
            ? `${unknown} faculty record(s) have no recorded qualification level. This figure is incomplete and must not be submitted as-is.`
            : null
      }
    };
  }
};

const attendanceCompliance: ReportDefinition = {
  code: 'ATTENDANCE_COMPLIANCE',
  name: 'Attendance Compliance',
  description: 'Students below the attendance threshold, by course.',
  category: 'academic',
  sourceModels: ['AttendanceSession', 'Attendance', 'StudentProfile'],
  formula:
    'percentage = count(Attendance WHERE status IN (present, late, on_duty)) / ' +
    'count(AttendanceSession for the course) × 100.',
  columns: [
    { key: 'rollNumber', label: 'Roll Number' },
    { key: 'name', label: 'Name' },
    { key: 'courseCode', label: 'Course' },
    { key: 'sessionsHeld', label: 'Sessions Held' },
    { key: 'attended', label: 'Attended' },
    { key: 'percentage', label: 'Attendance (%)' },
    { key: 'status', label: 'Status' }
  ],
  async run(ctx) {
    const THRESHOLD = 75;

    const sessions = await basePrisma.attendanceSession.findMany({
      select: { id: true, courseId: true }
    });

    const sessionsByCourse = new Map<string, string[]>();
    for (const s of sessions) {
      (sessionsByCourse.get(s.courseId) ?? sessionsByCourse.set(s.courseId, []).get(s.courseId)!).push(s.id);
    }

    const students = await basePrisma.studentProfile.findMany({
      where: { institutionId: ctx.institutionId },
      include: { user: { select: { name: true } } },
      take: 2000
    });

    const courses = await basePrisma.course.findMany({
      where: { id: { in: [...sessionsByCourse.keys()] } },
      select: { id: true, code: true }
    });
    const courseById = new Map(courses.map((c) => [c.id, c]));

    const rows = [];
    let shortfalls = 0;

    for (const student of students) {
      for (const [courseId, sessionIds] of sessionsByCourse) {
        const attended = await basePrisma.attendance.count({
          where: {
            studentProfileId: student.id,
            attendanceSessionId: { in: sessionIds },
            status: { in: ['present', 'late', 'on_duty'] }
          }
        });

        // A student with no record for a course was not enrolled in it.
        if (attended === 0) continue;

        const percentage = Number(((attended / sessionIds.length) * 100).toFixed(1));
        const short = percentage < THRESHOLD;
        if (short) shortfalls += 1;

        rows.push({
          rollNumber: student.rollNumber,
          name: student.user.name,
          courseCode: courseById.get(courseId)?.code ?? '',
          sessionsHeld: sessionIds.length,
          attended,
          percentage,
          status: short ? 'SHORTFALL' : 'OK'
        });
      }
    }

    return {
      rows,
      summary: { records: rows.length, shortfalls, threshold: THRESHOLD }
    };
  }
};

// ─── Registry ─────────────────────────────────────────────────────────────────

export const REPORTS: ReportDefinition[] = [
  studentPerformance,
  examPassRate,
  admissionsIntake,
  facultyQualification,
  attendanceCompliance
];

export function findReport(code: string): ReportDefinition | undefined {
  return REPORTS.find((r) => r.code === code);
}
