import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toRoleGrievanceStatus } from '../lib/grievanceStatus.js';
import { authenticate } from '../middleware/auth.js';
import { NotFoundError , sendError} from '../lib/errors.js';
import { getTenantContext } from '../lib/tenant.js';
import { z } from 'zod';
import { validate } from '../middleware/validate.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import * as libraryService from '../modules/library/library.service.js';
import * as marks from '../modules/examination/marks.service.js';
import {
  submitAssignmentSchema,
  revaluationSchema,
  certificateRequestSchema,
  placementApplySchema,
  feedbackSubmitSchema,
  studentGrievanceSchema,
  enrollSchema,
  payFeeSchema
} from '../modules/students/students.schemas.js';

const router = Router();

/**
 * Personal details a student may edit about themselves.
 *
 * Deliberately excludes every academic and administrative column: cgpa,
 * semester, rollNumber, program, branch, section, batch, admissionYear,
 * totalCredits, earnedCredits, programmeId, batchId, sectionId, campusId and
 * institutionId. Those belong to the offices that maintain them.
 */
const updateOwnStudentProfileSchema = z
  .object({
    gender: z.string().trim().max(30).nullable().optional(),
    dateOfBirth: z
      .string()
      .trim()
      .refine((v) => !Number.isNaN(Date.parse(v)), 'must be a valid date')
      .nullable()
      .optional(),
    category: z.string().trim().max(40).nullable().optional(),
    domicileState: z.string().trim().max(80).nullable().optional(),
    nationality: z.string().trim().max(60).nullable().optional(),
    isDifferentlyAbled: z.boolean().optional(),
    isHosteller: z.boolean().optional()
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, { message: 'No fields to update.' });

const db: any = prisma;
// Get Faculty Class Messages for the Student
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getStudentProfile(userId);

    const enrollmentWhere: any = {
      studentProfileId: profile.id
    };
    if (Number.isFinite(semesterQuery)) {
      enrollmentWhere.course = { semester: Number(semesterQuery) };
    }

    const enrollments = await prisma.enrollment.findMany({
      where: enrollmentWhere,
      include: {
        course: {
          include: {
            faculty: {
              include: {
                user: true
              }
            }
          }
        }
      }
    });

    if (enrollments.length === 0) {
      res.json({ success: true, data: [] });
      return;
    }

    const courseById = new Map(enrollments.map((enrollment: any) => [enrollment.courseId, enrollment.course]));

    const messages = await db.classMessage.findMany({
      where: {
        courseId: { in: enrollments.map((enrollment: any) => enrollment.courseId) }
      },
      orderBy: { sentAt: 'desc' }
    });

    const classEnrollments = await getStudentClassEnrollments(profile.id);
    const classIds = classEnrollments.map((item: any) => item.classId);

    const normalizeAudience = (raw: string) => {
      const value = String(raw || '').trim().toLowerCase();
      if (value === 'all' || value === 'students' || value === 'faculties') return value;
      if (value.startsWith('class:')) return value;
      if (value === 'everyone') return 'all';
      if (value === 'all_students' || value === 'department') return 'students';
      if (value === 'all_faculty') return 'faculties';
      return 'all';
    };

    const broadcasts = await db.broadcastMessage.findMany({
      where: {
        OR: [
          { recipients: { in: ['all', 'students', 'everyone', 'all_students', 'department'] } },
          { recipients: { startsWith: 'class:' } }
        ]
      },
      orderBy: { sentAt: 'desc' },
      take: 100
    });

    const visibleBroadcasts = broadcasts
      .filter((item: any) => {
        const audience = normalizeAudience(item.recipients);
        if (audience === 'all' || audience === 'students') return true;
        if (!audience.startsWith('class:')) return false;
        const classId = audience.slice('class:'.length);
        return classIds.includes(classId);
      })
      .map((item: any) => ({
        id: item.id,
        courseId: null,
        courseCode: 'ANNOUNCEMENT',
        subject: item.subject,
        message: item.content,
        sentAt: item.sentAt,
        recipients: item.recipients,
        to: normalizeAudience(item.recipients),
        courseName: 'Department Communication',
        semester: null,
        facultyName: item.sender || 'HOD',
        source: 'broadcast'
      }));

    res.json({
      success: true,
      data: [
        ...messages.map((message: any) => {
          const course = courseById.get(message.courseId);
          return {
            ...message,
            to: `class:${message.courseId}`,
            courseName: course?.name || '',
            semester: course?.semester ?? null,
            facultyName: course?.faculty?.user?.name || 'Faculty',
            source: 'class'
          };
        }),
        ...visibleBroadcasts
      ].sort((a: any, b: any) => +new Date(b.sentAt) - +new Date(a.sentAt))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Helper to ensure a student profile exists for a user
/**
 * Resolve the authenticated user's student profile.
 *
 * HISTORY — this function previously CREATED a profile when none existed,
 * populating it with fabricated data (`cgpa: 8.5`, `admissionYear: 2024`,
 * `program: 'B.Tech'`, a roll number derived from a UUID slice). Because it was
 * called from GET handlers, a read request wrote invented academic records into
 * the institutional record system, indistinguishable from real ones.
 *
 * It now reads only. A user without a student profile is a real condition — the
 * correct response is 404, not a manufactured student. Profiles are created
 * exclusively by the admissions workflow (EPIC-05).
 *
 * @throws {NotFoundError} when the user has no student profile.
 */
async function getStudentProfile(userId: string) {
  const profile = await prisma.studentProfile.findUnique({
    where: { userId }
  });

  if (!profile) {
    throw new NotFoundError(
      'Student profile',
      { userId, hint: 'This account has no student record. It must be created through the admissions process.' }
    );
  }

  return profile;
}

/**
 * Read the student's class enrolments.
 *
 * HISTORY — this previously SYNTHESISED `CourseClass` and `ClassEnrollment`
 * rows on read when none existed, inventing class structures the institution
 * had never defined. It now reads only; class structures are created by the
 * academic management workflow (EPIC-04).
 */
async function getStudentClassEnrollments(profileId: string) {
  return db.classEnrollment.findMany({ where: { studentProfileId: profileId } });
}

function parseSemesterNumber(input: any): number | null {
  if (typeof input === 'number' && Number.isFinite(input)) return input;
  if (typeof input === 'string') {
    const match = input.match(/(\d+)/);
    if (match) {
      const value = Number(match[1]);
      return Number.isFinite(value) ? value : null;
    }
  }
  if (input && typeof input === 'object') {
    return (
      parseSemesterNumber((input as any).semester) ??
      parseSemesterNumber((input as any).name) ??
      parseSemesterNumber((input as any).label)
    );
  }
  return null;
}

function resolveCurrentSemesterFromAcademicYear(academicYear: any): number | null {
  if (!academicYear) return null;
  const now = new Date();
  const semesters = Array.isArray(academicYear.semesters) ? academicYear.semesters : [];

  for (const semester of semesters) {
    const status = String((semester as any)?.status || '').toLowerCase();
    if (status === 'active' || status === 'current' || status === 'ongoing') {
      const parsed = parseSemesterNumber(semester);
      if (parsed != null) return parsed;
    }
  }

  for (const semester of semesters) {
    const start = (semester as any)?.startDate ? new Date((semester as any).startDate) : null;
    const end = (semester as any)?.endDate ? new Date((semester as any).endDate) : null;
    if (start && end && now >= start && now <= end) {
      const parsed = parseSemesterNumber(semester);
      if (parsed != null) return parsed;
    }
  }

  return null;
}

/**
 * Student dashboard.
 *
 * WHAT THIS REPLACES - four fabrications on the screen students actually see:
 *
 *   1. `change: '+0.2', changeType: 'increase'` was a LITERAL. The CGPA tile
 *      claimed a rise of 0.2 every time it rendered, including for a student
 *      whose CGPA was 0 and who had never been graded.
 *
 *   2. `value: profile.cgpa` read a stored column that defaults to 0 and, by its
 *      own schema comment, is never written directly. Real results live in
 *      SemesterResult, so every student was shown a CGPA of 0 while their actual
 *      published result sat one table away.
 *
 *   3. Attendance fell back to 100% when a student had no attendance records at
 *      all. Absence of data was rendered as perfect attendance - the same shape
 *      as the exam progress bar removed in Phase 3a, which forced marksEntered
 *      to equal totalStudents once published.
 *
 *   4. `upcomingEvents` was a single invented entry, "Mid Semester Exams Check",
 *      dated `new Date()` - an event that was always happening now.
 *
 * The rule applied throughout: when there is no data, say so. A dashboard that
 * fills gaps with plausible numbers is worse than an empty one, because nobody
 * can tell the difference.
 */
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const ctx = getTenantContext(req);

    const enrollments = await prisma.enrollment.count({
      where: { studentProfileId: profile.id }
    });

    const profileUser = await prisma.user.findFirst({
      where: { id: profile.userId },
      select: { name: true }
    });

    // -- CGPA, from published results --------------------------------------
    // Only `published` results are shown. A draft result is a working figure,
    // and showing it turns an internal step into a communication.
    const results = await prisma.semesterResult.findMany({
      where: { studentProfileId: profile.id, status: 'published' },
      orderBy: { semester: 'desc' },
      take: 2,
      select: {
        semester: true,
        cgpa: true,
        sgpa: true,
        cumulativeCreditsEarned: true,
        cumulativeCreditsRegistered: true
      }
    });

    const latest = results[0];
    const previous = results[1];

    // A real delta between the last two published semesters, or absent. Never
    // asserted from nothing.
    const cgpaChange =
      latest && previous ? Number((latest.cgpa - previous.cgpa).toFixed(2)) : null;

    const cgpaStat = latest
      ? {
          label: 'Current CGPA',
          value: latest.cgpa.toFixed(2),
          ...(cgpaChange !== null
            ? {
                change: `${cgpaChange >= 0 ? '+' : ''}${cgpaChange}`,
                changeType:
                  cgpaChange > 0 ? 'increase' : cgpaChange < 0 ? 'decrease' : 'stable'
              }
            : {}),
          detail: `After semester ${latest.semester}`,
          icon: 'TrendingUp',
          color: 'text-primary'
        }
      : {
          label: 'Current CGPA',
          value: 'Not published',
          detail: 'No published semester result yet',
          icon: 'TrendingUp',
          color: 'text-muted-foreground'
        };

    // -- Attendance ---------------------------------------------------------
    const attendances = await prisma.attendance.findMany({
      where: { studentProfileId: profile.id },
      select: { status: true }
    });
    const presentCount = attendances.filter((a: any) => a.status === 'present').length;

    const attendanceStat =
      attendances.length > 0
        ? {
            label: 'Attendance',
            value: `${Math.round((presentCount / attendances.length) * 100)}%`,
            detail: `${presentCount} of ${attendances.length} sessions`,
            icon: 'Calendar',
            color: 'text-secondary'
          }
        : {
            label: 'Attendance',
            value: 'No records',
            detail: 'No attendance has been marked yet',
            icon: 'Calendar',
            color: 'text-muted-foreground'
          };

    // -- Fees ---------------------------------------------------------------
    // `pending` AND `partial` AND `overdue`: filtering on `pending` alone
    // understated what a student owed the moment they made a part payment.
    const feeTotals = await prisma.feeRecord.aggregate({
      where: {
        studentProfileId: profile.id,
        status: { in: ['pending', 'partial', 'overdue'] }
      },
      _sum: { amount: true, paidAmount: true }
    });
    const billed = feeTotals._sum.amount ?? 0;
    const paid = feeTotals._sum.paidAmount ?? 0;
    const outstanding = Math.max(0, billed - paid);

    // -- Upcoming events, from the real examination schedule ----------------
    const upcoming = await prisma.examSchedule.findMany({
      where: { institutionId: ctx.institutionId, examDate: { gte: new Date() } },
      orderBy: { examDate: 'asc' },
      take: 5,
      select: {
        id: true,
        examDate: true,
        startTime: true,
        venue: true,
        course: { select: { code: true, name: true } }
      }
    });

    res.json({
      success: true,
      data: {
        // THE "SEMESTER 0" BUG. This block was absent entirely: the response
        // carried only `stats` and `upcomingEvents`, while StudentDashboard.tsx
        // reads `dashboard.profile.semester`, `.cgpa`, `.rollNumber` and the
        // credit totals. Every one of them resolved to undefined and was
        // normalised to 0, so the header read "Semester 0" for a student in
        // semester 5, and the Academic Performance panel showed 0.00 CGPA and
        // 0 credits earned.
        //
        // Nothing failed. The frontend's own defaults turned missing data into
        // confident zeroes, which is the same defect as the fabrications above,
        // arriving from the other direction.
        profile: {
          name: profileUser?.name ?? null,
          rollNumber: profile.rollNumber,
          program: profile.program,
          branch: profile.branch,
          semester: profile.semester,
          // From published results, not the stale `StudentProfile.cgpa` column.
          // `null` where nothing is published, so the panel can say so.
          cgpa: latest ? latest.cgpa : null,
          earnedCredits: latest ? latest.cumulativeCreditsEarned : 0,
          totalCredits: latest ? latest.cumulativeCreditsRegistered : 0
        },
        stats: [
          cgpaStat,
          attendanceStat,
          {
            label: 'Active Courses',
            value: enrollments.toString(),
            icon: 'BookOpen',
            color: 'text-warning'
          },
          {
            label: 'Fee Due',
            value: `\u20b9${outstanding}`,
            detail:
              outstanding > 0 ? `\u20b9${paid} paid of \u20b9${billed}` : 'Nothing outstanding',
            icon: 'IndianRupee',
            color: outstanding > 0 ? 'text-destructive' : 'text-muted-foreground'
          }
        ],
        // Empty when nothing is scheduled. It used to be one invented row.
        upcomingEvents: upcoming.map((e: any) => ({
          id: e.id,
          title: e.course ? `${e.course.code} - ${e.course.name}` : 'Examination',
          date: e.examDate.toISOString(),
          startTime: e.startTime,
          venue: e.venue ?? null
        }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Enrolled Courses
router.get('/courses', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);

    const courses = await prisma.enrollment.findMany({
      where: { studentProfileId: profile.id },
      include: {
        course: {
          include: {
            faculty: { include: { user: true } },
            department: true
          }
        }
      }
    });

    const coursePayload = [];
    for (const enrollment of courses) {
      const records = await prisma.attendance.findMany({
        where: { studentProfileId: profile.id },
        include: { session: true }
      });

      const courseRecords = records.filter((record: any) => record.session?.courseId === enrollment.courseId);
      const totalClasses = courseRecords.length;
      const presentClasses = courseRecords.filter((record: any) => record.status === 'present').length;
      const absentClasses = totalClasses - presentClasses;
      // `null`, not 100. A course with no sessions recorded has no attendance
      // percentage; reporting 100% told a student they had attended classes that
      // were never held.
      const attendance = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : null;

      // `null`, not 0. "Not yet graded" and "scored zero" are different facts,
      // and collapsing them shows a failing mark to every unassessed student.
      const numericGrade = enrollment.grade != null ? Number(enrollment.grade) : NaN;
      const internalMarks = Number.isFinite(numericGrade) ? numericGrade : null;

      coursePayload.push({
        ...enrollment.course,
        attendance,
        totalClasses,
        presentClasses,
        absentClasses,
        internalMarks,
        maxInternalMarks: 100,
        grade: enrollment.grade
      });
    }

    res.json({ success: true, data: coursePayload });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Attendance
router.get('/attendance', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);

    const enrollments = await prisma.enrollment.findMany({
      where: { studentProfileId: profile.id },
      include: { course: true }
    });

    const attendanceData = [];
    for (const enrollment of enrollments) {
      const records = await prisma.attendance.findMany({
        where: { studentProfileId: profile.id },
        include: { session: true }
      });

      const courseRecords = records.filter((r: any) => r.session?.courseId === enrollment.courseId);
      const total = courseRecords.length;
      const present = courseRecords.filter((r: any) => r.status === 'present').length;
      const absent = total - present;

      attendanceData.push({
        courseId: enrollment.courseId,
        courseCode: enrollment.course.code,
        courseName: enrollment.course.name,
        totalClasses: total,
        present,
        absent,
        // `null`, not 100. This is the attendance SCREEN, where a student checks
        // whether they are short of the exam eligibility threshold. Reporting
        // 100% for a course with no sessions recorded tells them they are safe
        // on a course that has never been marked.
        percentage: total > 0 ? Math.round((present / total) * 100) : null,
        records: courseRecords.map((r: any) => ({
          date: r.session?.date,
          status: r.status,
          type: r.session?.type
        }))
      });
    }

    res.json({ success: true, data: attendanceData });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Profile
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const assignment = await prisma.menteeAssignment.findFirst({ where: { studentId: profile.id } });
    let mentorName: string | null = null;
    let mentorEmail: string | null = null;

    if (assignment?.facultyId) {
      const facultyProfile = await prisma.facultyProfile.findUnique({
        where: { id: assignment.facultyId },
        include: { user: true }
      });
      mentorName = facultyProfile?.user?.name || null;
      mentorEmail = facultyProfile?.user?.email || null;
    }

    res.json({
      success: true,
      data: {
        ...profile,
        email: user?.email,
        name: user?.name,
        avatar: user?.avatar,
        mentorName,
        mentorEmail
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/mentoring', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);

    const assignment = await prisma.menteeAssignment.findFirst({ where: { studentId: profile.id } });
    if (!assignment) {
      res.json({ success: true, data: { mentor: null, counselingNotes: [] } });
      return;
    }

    const [facultyProfile, notes] = await Promise.all([
      prisma.facultyProfile.findUnique({
        where: { id: assignment.facultyId },
        include: { user: true }
      }),
      prisma.counselingNote.findMany({
        where: { menteeAssignId: assignment.id },
        orderBy: { date: 'desc' }
      })
    ]);

    res.json({
      success: true,
      data: {
        mentor: facultyProfile
          ? {
              id: facultyProfile.id,
              name: facultyProfile.user?.name || 'Faculty Mentor',
              email: facultyProfile.user?.email || '',
              employeeId: facultyProfile.employeeId,
              qualification: facultyProfile.qualification,
              specialization: facultyProfile.specialization,
              experience: facultyProfile.experience,
              lastMeetingDate: assignment.lastMeeting
            }
          : null,
        counselingNotes: notes.map((note: any) => ({
          id: note.id,
          date: note.date,
          topic: note.topic,
          notes: note.notes,
          followUpDate: note.followUpDate,
          status: note.status
        }))
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/current-semester', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const currentAcademicYear = await db.academicYear.findFirst({ where: { isCurrent: true } });
    const resolvedFromAcademicYear = resolveCurrentSemesterFromAcademicYear(currentAcademicYear);
    const currentSemester = resolvedFromAcademicYear ?? profile.semester ?? null;

    res.json({
      success: true,
      data: {
        currentSemester
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Update Profile
/**
 * A student updating their own profile.
 *
 * WHAT THIS REPLACES: `prisma.studentProfile.update({ where: { id: profile.id }, data: req.body })`.
 *
 * The row was correctly the caller's own — `profile.id` comes from their token,
 * not the request. The defect was WHICH COLUMNS they could write. `req.body`
 * reached Prisma unfiltered, so a student could set their own `cgpa`,
 * `semester`, `rollNumber`, `earnedCredits`, `admissionYear`, `programmeId` or
 * `institutionId` with a single request — rewriting their own academic record
 * and standing from the profile screen.
 *
 * `tsc` could not see this: `req.body` is `any`.
 *
 * The schema below is an allow-list of genuinely personal details. Everything
 * academic or administrative is set by the office that owns it: results by the
 * examination flow, semester by progression, roll number and programme by
 * admissions.
 */
router.put(
  '/profile',
  authenticate,
  validate({ body: updateOwnStudentProfileSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const body = req.body as z.infer<typeof updateOwnStudentProfileSchema>;

    // updateMany with the tenant filter, not update-by-id: the same rule applied
    // everywhere else, so this path cannot drift away from it.
    await prisma.studentProfile.updateMany({
      where: { id: profile.id, institutionId: getTenantContext(req).institutionId },
      data: {
        ...(body.gender !== undefined ? { gender: body.gender } : {}),
        ...(body.dateOfBirth !== undefined
          ? { dateOfBirth: body.dateOfBirth === null ? null : new Date(body.dateOfBirth) }
          : {}),
        ...(body.category !== undefined ? { category: body.category } : {}),
        ...(body.domicileState !== undefined ? { domicileState: body.domicileState } : {}),
        ...(body.nationality !== undefined ? { nationality: body.nationality } : {}),
        ...(body.isDifferentlyAbled !== undefined
          ? { isDifferentlyAbled: body.isDifferentlyAbled }
          : {}),
        ...(body.isHosteller !== undefined ? { isHosteller: body.isHosteller } : {})
      }
    });

    const updated = await prisma.studentProfile.findFirst({ where: { id: profile.id } });
    res.json({ success: true, data: updated });
  })
);

// Get Assignments
router.get('/assignments', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getStudentProfile(userId);
    const classEnrollments = await getStudentClassEnrollments(profile.id);
    const classIds = classEnrollments.map((enrollment: any) => enrollment.classId);
    
    const assignments = await db.assignment.findMany({
      take: 200,
      where: {
        classId: { in: classIds },
        ...(Number.isFinite(semesterQuery) ? { class: { course: { semester: semesterQuery } } } : {})
      },
      include: {
        class: {
          include: {
            course: true
          }
        },
        submissions: {
          where: { studentProfileId: profile.id }
        }
      },
      orderBy: { dueDate: 'asc' }
    });

    const now = new Date();
    res.json({
      success: true,
      data: assignments.map((assignment: any) => {
        const mySubmission = assignment.submissions?.[0];
        const status = mySubmission
          ? (mySubmission.status === 'evaluated' ? 'graded' : 'submitted')
          : (new Date(assignment.dueDate) < now ? 'overdue' : 'pending');

        return {
          id: assignment.id,
          classId: assignment.classId,
          className: assignment.class?.name || `${assignment.class?.course?.code || ''} - ${assignment.class?.section || ''}`,
          semester: assignment.class?.course?.semester || null,
          courseId: assignment.class?.courseId || '',
          courseCode: assignment.class?.course?.code || '',
          courseName: assignment.class?.course?.name || '',
          title: assignment.title,
          description: assignment.description,
          dueDate: assignment.dueDate,
          maxMarks: assignment.maxMarks,
          status,
          submittedAt: mySubmission?.submittedAt || null,
          obtainedMarks: mySubmission?.obtainedMarks ?? null,
          feedback: mySubmission?.feedback || null,
          submissionUrl: mySubmission?.fileUrl || null
        };
      })
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Submit Assignment
router.post('/assignments/:id/submit', authenticate, validate({ body: submitAssignmentSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const assignmentId = String(req.params.id);
    const { fileUrl } = req.body;

    if (!fileUrl || typeof fileUrl !== 'string') {
      res.status(400).json({ success: false, message: 'A valid file URL is required for submission.' });
      return;
    }

    const assignment = await db.assignment.findUnique({ where: { id: assignmentId } });
    if (!assignment) {
      res.status(404).json({ success: false, message: 'Assignment not found.' });
      return;
    }

    const allowed = await db.classEnrollment.findFirst({
      where: {
        classId: assignment.classId,
        studentProfileId: profile.id
      }
    });

    if (!allowed) {
      res.status(403).json({ success: false, message: 'You are not part of this class.' });
      return;
    }

    const submission = await prisma.submission.upsert({
      where: {
        assignmentId_studentProfileId: {
          assignmentId,
          studentProfileId: profile.id
        }
      },
      update: {
        fileUrl,
        status: 'submitted',
        submittedAt: new Date()
      },
      create: {
        assignmentId,
        studentProfileId: profile.id,
        fileUrl,
        status: 'submitted'
      }
    });
    res.json({ success: true, data: submission });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Examinations
/**
 * A student's examinations.
 *
 * Served from the examination ENGINE (`ExamSchedule` reached through the
 * student's own `ExamRegistration` rows) whenever they are registered for
 * anything, and from the legacy `Examination` table otherwise.
 *
 * Two parallel exam schedules existed. The engine's is the one that carries
 * eligibility, hall tickets, moderation and revaluation; the legacy table is
 * a flat list with none of that. Serving the engine's when it has something
 * to say, and the old one when it does not, moves students onto it as their
 * institution adopts sessions — without the screen going blank on the day
 * the change ships, which is what repointing it outright would have done.
 */
router.get('/examinations', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);

    const registrations = await prisma.examRegistration.findMany({
      where: { studentProfileId: profile.id, status: { not: 'cancelled' } },
      include: {
        schedule: { include: { course: true, session: true } }
      }
    });

    if (registrations.length > 0) {
      const scheduleIds = registrations.map((r) => r.scheduleId);

      const [seats, results] = await Promise.all([
        prisma.hallTicketEntry.findMany({
          where: { scheduleId: { in: scheduleIds }, hallTicket: { studentProfileId: profile.id } },
          select: { scheduleId: true, seatNumber: true, roomNumber: true }
        }),
        prisma.courseResult.findMany({
          where: {
            studentProfileId: profile.id,
            status: { in: ['published', 'revalued'] }
          },
          orderBy: { attempt: 'asc' }
        })
      ]);

      const seatBySchedule = new Map(seats.map((s) => [s.scheduleId, s]));
      const resultByCourse = new Map(results.map((r) => [r.courseId, r]));

      const data = registrations
        .map((registration) => {
          const schedule = registration.schedule;
          const seat = seatBySchedule.get(schedule.id);
          const result = resultByCourse.get(schedule.courseId);

          return {
            id: schedule.id,
            courseId: schedule.courseId,
            courseName: schedule.course.name,
            courseCode: schedule.course.code,
            type: schedule.session.type,
            date: schedule.examDate,
            startTime: schedule.startTime,
            endTime: schedule.endTime,
            venue: schedule.venue ?? seat?.roomNumber ?? '',
            seatNumber: seat?.seatNumber ?? undefined,
            maxMarks: schedule.maxMarks,
            // Only a PUBLISHED result is shown. A moderated-but-unpublished
            // mark is not the student's to see yet.
            obtainedMarks: result?.totalMarks ?? undefined,
            grade: result?.letterGrade ?? undefined,
            // Ineligibility is the student's own business — they need to know
            // before the exam, not discover it at the hall door.
            isEligible: registration.isEligible,
            ineligibilityReasons: registration.isEligible ? undefined : registration.ineligibilityReasons
          };
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime());

      res.json({ success: true, data });
      return;
    }

    const enrollments = await prisma.enrollment.findMany({ where: { studentProfileId: profile.id } });
    const courseIds = enrollments.map(e => e.courseId);

    const exams = await prisma.examination.findMany({
      where: { courseId: { in: courseIds } },
      include: { course: true },
      orderBy: { date: 'asc' }
    });
    res.json({ success: true, data: exams });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Generate Hall Ticket Data
/**
 * A student's hall ticket.
 *
 * Returns the ISSUED hall ticket when one exists — with its ticket number,
 * verification code and per-paper seat allocation, which is what makes a hall
 * ticket a hall ticket rather than a printout of the timetable.
 *
 * The legacy path below produced the latter: it listed upcoming exams under a
 * "hall ticket" heading, with no ticket number, no verification code, no seat,
 * and no check that the student was ever ruled eligible to sit them. It is
 * kept only for institutions that have not issued tickets through the engine
 * yet, and says plainly that it is not an issued ticket.
 */
router.get('/examinations/hall-ticket', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const student = {
      name: user?.name ?? 'Student',
      rollNumber: profile.rollNumber,
      program: profile.program,
      branch: profile.branch,
      semester: profile.semester
    };

    const issued = await prisma.hallTicket.findFirst({
      where: { studentProfileId: profile.id, status: 'valid' },
      orderBy: { issuedAt: 'desc' },
      include: {
        entries: { include: { schedule: { include: { course: true, session: true } } } }
      }
    });

    if (issued) {
      res.json({
        success: true,
        data: {
          student,
          issued: true,
          ticketNumber: issued.ticketNumber,
          verificationCode: issued.verificationCode,
          issuedAt: issued.issuedAt,
          generatedAt: new Date(),
          exams: issued.entries
            .map((entry) => ({
              id: entry.schedule.id,
              courseId: entry.schedule.courseId,
              courseCode: entry.schedule.course.code,
              courseName: entry.schedule.course.name,
              type: entry.schedule.session.type,
              date: entry.schedule.examDate,
              startTime: entry.schedule.startTime,
              endTime: entry.schedule.endTime,
              venue: entry.roomNumber ?? entry.schedule.venue ?? '',
              seatNumber: entry.seatNumber ?? undefined,
              maxMarks: entry.schedule.maxMarks
            }))
            .sort((a, b) => a.date.getTime() - b.date.getTime())
        }
      });
      return;
    }

    const enrollments = await prisma.enrollment.findMany({ where: { studentProfileId: profile.id } });
    const courseIds = enrollments.map((e) => e.courseId);

    const exams = await prisma.examination.findMany({
      where: { courseId: { in: courseIds } },
      include: { course: true },
      orderBy: { date: 'asc' }
    });

    const now = new Date();
    const upcomingExams = exams.filter((exam) => exam.date >= now);

    res.json({
      success: true,
      data: {
        student,
        // Stated, not implied: no ticket has been issued, so this is a
        // schedule. A student must not turn up at the hall believing a
        // timetable is an admission document.
        issued: false,
        notice: 'No hall ticket has been issued yet. This is your exam schedule, not an admission document.',
        generatedAt: new Date(),
        exams: upcomingExams
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Results
/**
 * A student's results.
 *
 * Each enrolment now carries the PUBLISHED result from `CourseResult` when one
 * exists, under `result`, plus the institution's real SGPA for that semester
 * from `SemesterResult`.
 *
 * WHY: this endpoint returned only `Enrollment.grade`, and the student screen
 * made up everything else from it. It carried its own hardcoded grade scale
 * (A+ = 10, A = 9 …) which disagrees with the institution's configured scale
 * (O = 10, A+ = 9 …), so a student saw a different letter grade than the one
 * in the official record. It also derived "internal marks" and "external
 * marks" by multiplying the total by 0.4 and 0.6 — numbers that exist nowhere
 * in the system and that no one had ever awarded.
 *
 * `result` is null where the exam-cell workflow has not produced a published
 * result yet, and the caller must show the working grade plainly rather than
 * inventing a breakdown for it.
 */
router.get('/results', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);

    const [enrollments, courseResults, semesterResults] = await Promise.all([
      prisma.enrollment.findMany({
        where: { studentProfileId: profile.id },
        include: { course: true }
      }),
      prisma.courseResult.findMany({
        where: { studentProfileId: profile.id, status: { in: ['published', 'revalued'] } },
        orderBy: { attempt: 'asc' }
      }),
      prisma.semesterResult.findMany({
        where: { studentProfileId: profile.id },
        orderBy: { semester: 'asc' }
      })
    ]);

    // Latest attempt wins — a revaluation or supplementary supersedes the
    // original, exactly as the GPA computation treats it.
    const resultByCourse = new Map<string, (typeof courseResults)[number]>();
    for (const result of courseResults) {
      const existing = resultByCourse.get(result.courseId);
      if (!existing || result.attempt > existing.attempt) {
        resultByCourse.set(result.courseId, result);
      }
    }

    const sgpaBySemester = new Map(semesterResults.map((s) => [s.semester, s]));

    const data = enrollments.map((enrollment) => {
      const result = resultByCourse.get(enrollment.courseId);
      return {
        ...enrollment,
        result: result
          ? {
              letterGrade: result.letterGrade,
              gradePoint: result.gradePoint,
              internalMarks: result.internalMarks,
              externalMarks: result.externalMarks,
              totalMarks: result.totalMarks,
              maxMarks: result.maxMarks,
              credits: result.credits,
              isPassing: result.isPassing,
              isExcludedFromGpa: result.isExcludedFromGpa,
              attempt: result.attempt,
              status: result.status,
              publishedAt: result.publishedAt
            }
          : null,
        semesterSgpa: sgpaBySemester.get(enrollment.semester)?.sgpa ?? null,
        semesterCgpa: sgpaBySemester.get(enrollment.semester)?.cgpa ?? null
      };
    });

    res.json({ success: true, data });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Generate Transcript Data
router.get('/results/transcript', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });

    const enrollments = await prisma.enrollment.findMany({
      where: { studentProfileId: profile.id },
      include: { course: true },
      orderBy: { semester: 'asc' }
    });

    res.json({
      success: true,
      data: {
        student: {
          name: user?.name ?? 'Student',
          rollNumber: profile.rollNumber,
          program: profile.program,
          branch: profile.branch,
          admissionYear: profile.admissionYear,
          cgpa: profile.cgpa,
          earnedCredits: profile.earnedCredits,
          totalCredits: profile.totalCredits
        },
        generatedAt: new Date(),
        records: enrollments
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Request Exam Revaluation
router.post('/examinations/:id/revaluation', authenticate, validate({ body: revaluationSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const examId = String(req.params.id);
    const { reason } = req.body as { reason?: string };

    const profile = await getStudentProfile(userId);

    // The engine path, when there is a published result to dispute.
    //
    // `/students/examinations` now returns ExamSchedule ids for a registered
    // student, so resolve the id as a schedule first. A real
    // RevaluationRequest carries a request number, a fee, an evaluation
    // workflow, and on completion creates a NEW ATTEMPT and recomputes the
    // CGPA — none of which the ApprovalItem below can do.
    const schedule = await prisma.examSchedule.findFirst({
      where: { id: examId },
      select: { courseId: true }
    });

    if (schedule) {
      const result = await prisma.courseResult.findFirst({
        where: {
          studentProfileId: profile.id,
          courseId: schedule.courseId,
          status: 'published'
        },
        orderBy: { attempt: 'desc' }
      });

      if (result) {
        const trimmedReason = reason?.trim();
        const created = await marks.requestRevaluation({
          courseResultId: result.id,
          ...(trimmedReason ? { reason: trimmedReason } : {})
        });
        res.json({ success: true, data: created });
        return;
      }

      // Registered, sat the paper, but nothing published yet. Saying so is
      // better than filing a request against a result that does not exist.
      res.status(400).json({
        success: false,
        message: 'No published result for this paper yet. Revaluation opens once results are published.'
      });
      return;
    }

    const exam = await prisma.examination.findUnique({
      where: { id: examId },
      include: { course: true }
    });

    if (!exam) {
      return res.status(404).json({ success: false, message: 'Examination not found' });
    }

    const existingRequest = await prisma.approvalItem.findFirst({
      where: {
        requestedBy: userId,
        type: 'exam_revaluation',
        title: {
          contains: examId
        },
        status: {
          in: ['pending', 'forwarded']
        }
      }
    });

    if (existingRequest) {
      return res.status(400).json({ success: false, message: 'Revaluation request already submitted for this exam' });
    }

    const request = await prisma.approvalItem.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        type: 'exam_revaluation',
        title: `Revaluation Request - ${exam.course.code} (${examId})`,
        details: reason && reason.trim().length > 0
          ? reason
          : `Revaluation requested for ${exam.course.name}`,
        requestedBy: userId,
        priority: 'medium',
        status: 'pending'
      }
    });

    res.json({ success: true, data: request });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Fees
router.get('/fees', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const fees = await prisma.feeRecord.findMany({
      where: { studentProfileId: profile.id },
      orderBy: { dueDate: 'asc' }
    });
    res.json({ success: true, data: fees });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Pay Fees
/**
 * Student-initiated fee payment.
 *
 * THIS ENDPOINT NO LONGER MARKS A FEE PAID, AND THAT IS THE FIX.
 *
 * What it did:
 *
 *     const { feeRecordId, transactionId } = req.body;
 *     await prisma.feeRecord.updateMany({
 *       where: { id: feeRecordId, studentProfileId: profile.id },
 *       data: { status: 'paid', paidDate: new Date(), transactionId }
 *     });
 *
 * The student supplied the transaction id. `StudentFees.tsx` generated it in the
 * browser — `TXN-${Date.now()}-${Math.random()}` — and the server believed it.
 * No amount was checked, no gateway was called, nothing was reconciled, and the
 * screen then said "Payment successful".
 *
 * So any student could clear any of their own dues, in one request, and the fee
 * ledger would agree with them. Of everything found in this codebase, this is the
 * one that most directly turns a record into a fiction: an institution's
 * receivables reporting money it never received.
 *
 * WHY IT REFUSES RATHER THAN ROUTES TO THE REAL FLOW
 *
 * `modules/finance` has a proper payment path — transactional, idempotent, with
 * a receipt. But it exists to RECORD MONEY ALREADY RECEIVED, and is reached by a
 * finance officer. Letting a student call it would produce genuine receipts for
 * money nobody paid: the same defect behind a better API.
 *
 * There is no payment gateway in this system. `gateway` on a Payment is a string
 * column, not an integration. Until one exists, the honest answer to "let me pay
 * online" is that we cannot take the money, not a success message.
 */
router.post('/fees/pay', authenticate, validate({ body: payFeeSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const { feeRecordId } = req.body ?? {};

    // Confirm the due is real and theirs, so the message can name it.
    const due = feeRecordId
      ? await prisma.feeRecord.findFirst({
          where: { id: String(feeRecordId), studentProfileId: profile.id },
          select: { id: true, amount: true, paidAmount: true, status: true }
        })
      : null;

    res.status(501).json({
      success: false,
      error: {
        code: 'NOT_IMPLEMENTED',
        message:
          'Online payment is not available: no payment gateway is configured. ' +
          'Your dues are shown here, but payment must be made through the finance ' +
          'office, which records it against your account and issues a receipt.',
        details: due
          ? {
              feeRecordId: due.id,
              outstanding: Math.max(0, due.amount - (due.paidAmount ?? 0)),
              status: due.status
            }
          : undefined
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Library Books
//
// Delegates to the library service (T-203b). Previously this queried
// `libraryBook.findMany({ where: { studentProfileId } })` directly — which, once
// a book was returned, showed nothing at all, because returning cleared the
// borrower from the copy. Borrowing history now survives return, and the
// accrued fine on an open loan is computed rather than read from a stale column.
router.get('/library', authenticate, async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const profile = await getStudentProfile((req as any).user.id);

    const result = await libraryService.studentHistory(ctx, profile.id, {
      page: Number(req.query.page) > 0 ? Number(req.query.page) : 1,
      pageSize: Math.min(Number(req.query.pageSize) > 0 ? Number(req.query.pageSize) : 25, 100)
    });

    res.json({ success: true, ...result });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Hostel Info
router.get('/hostel', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const allocation = await prisma.hostelAllocation.findUnique({
      where: { studentProfileId: profile.id },
      include: { hostel: true }
    });
    res.json({ success: true, data: allocation });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Placements
router.get('/placements', authenticate, async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    // PlacementDrive has no institutionId of its own — the `applications`
    // filter below only narrows which applications are nested per drive, not
    // which drives are returned, so without this every institution's drives
    // were visible to every student.
    const drives = await prisma.placementDrive.findMany({
      take: 200,
      where: { company: { institutionId: context.institutionId } },
      include: {
        company: true,
        applications: {
          where: { studentProfileId: profile.id }
        }
      }
    });

    const normalizedDrives = drives.map((drive: any) => ({
      ...drive,
      companyName: drive.company?.name,
      applicationStatus: drive.applications?.[0]?.status ?? 'not_applied'
    }));

    res.json({ success: true, data: normalizedDrives });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Apply for Placement
router.post('/placements/:id/apply', authenticate, validate({ body: placementApplySchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const placementDriveId = req.params.id;
    if (typeof placementDriveId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid placement drive id' });
    }

    // PlacementDrive has no institutionId of its own, and the id is a raw
    // URL param — without this, a student could apply to another
    // institution's drive.
    const drive = await prisma.placementDrive.findFirst({
      where: { id: placementDriveId, company: { institutionId: context.institutionId } },
      select: { id: true }
    });
    if (!drive) {
      res.status(404).json({ success: false, message: 'Placement drive not found' });
      return;
    }

    const application = await prisma.studentApplication.upsert({
      where: {
        placementDriveId_studentProfileId: {
          placementDriveId,
          studentProfileId: profile.id
        }
      },
      update: {
        status: 'applied'
      },
      create: {
        placementDriveId,
        studentProfileId: profile.id,
        status: 'applied'
      }
    });
    res.json({ success: true, data: application });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Renew Library Book
//
// Delegates to the library service. The inline version duplicated the renewal
// logic and carried the same defects: no transaction, no lock, no audit, a
// hardcoded 14-day extension ignoring institutional policy, and it permitted
// renewing an OVERDUE book — which let a borrower extend indefinitely and never
// incur the fine.
//
// Ownership is enforced inside the service transaction via
// `restrictToStudentProfileId`, after the row lock, rather than by a
// pre-check here that could be raced.
router.post('/library/:id/renew', authenticate, async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    const profile = await getStudentProfile((req as any).user.id);

    const result = await libraryService.renewLoan(ctx, String(req.params.id), {
      restrictToStudentProfileId: profile.id
    });

    res.json({
      success: true,
      message: `Renewed to ${result.dueAt.toISOString().slice(0, 10)} (renewal ${result.renewalCount} of ${result.maxRenewals}).`,
      data: result
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Grievances
router.get('/grievances', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const grievances = await prisma.grievanceCase.findMany({
      take: 200,
      where: {
        complainantId: userId,
        complainantType: 'student'
      },
      orderBy: { submissionDate: 'desc' }
    });

    res.json({
      success: true,
      data: grievances.map((grievance: any) => ({
        id: grievance.id,
        category: grievance.category,
        subject: grievance.subject,
        description: grievance.description,
        submittedAt: grievance.submissionDate,
        status: toRoleGrievanceStatus(grievance.status, 'student'),
        priority: grievance.severity,
        assignedTo: grievance.assignedTo,
        resolution: grievance.resolution,
        resolvedAt: grievance.actualResolutionDate,
        attachments: Array.isArray(grievance.evidenceFiles) ? grievance.evidenceFiles : []
      }))
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/grievances/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const id = String(req.params.id || '');

    if (!id) {
      res.status(400).json({ success: false, message: 'Grievance id is required' });
      return;
    }

    const grievance = await prisma.grievanceCase.findFirst({
      where: {
        id,
        complainantId: userId,
        complainantType: 'student'
      }
    });

    if (!grievance) {
      res.status(404).json({ success: false, message: 'Grievance not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        ...grievance,
        status: toRoleGrievanceStatus(grievance.status, 'student')
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Post Grievance
router.post('/grievances', authenticate, validate({ body: studentGrievanceSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { category, subject, description, priority, attachments } = req.body;

    if (!category || !subject || !description) {
      res.status(400).json({ success: false, message: 'Category, subject, and description are required' });
      return;
    }

    const user = await prisma.user.findUnique({ where: { id: userId } });
    const grievanceNumber = `GR-${Date.now()}`;

    const grievance = await prisma.grievanceCase.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        grievanceNumber,
        complainantId: userId,
        complainantName: user?.name || 'Student',
        complainantType: 'student',
        category,
        subject,
        description,
        severity: String(priority || 'medium').toLowerCase(),
        status: 'received',
        evidenceFiles: Array.isArray(attachments) ? attachments : [],
        timeline: [
          {
            date: new Date().toISOString(),
            action: 'Case Created',
            by: userId,
            notes: 'Submitted by student'
          }
        ]
      }
    });

    res.json({
      success: true,
      data: {
        id: grievance.id,
        category: grievance.category,
        subject: grievance.subject,
        description: grievance.description,
        submittedAt: grievance.submissionDate,
        status: toRoleGrievanceStatus(grievance.status, 'student'),
        priority: grievance.severity,
        assignedTo: grievance.assignedTo,
        resolution: grievance.resolution,
        resolvedAt: grievance.actualResolutionDate,
        attachments: Array.isArray(grievance.evidenceFiles) ? grievance.evidenceFiles : []
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Feedback Forms
router.get('/feedback', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);

    const enrollments = await prisma.enrollment.findMany({
      where: { studentProfileId: profile.id },
      include: {
        course: {
          include: {
            faculty: { include: { user: true } },
            feedbacks: true
          }
        }
      }
    });

    const forms = [] as any[];
    for (const enrollment of enrollments) {
      for (const form of enrollment.course.feedbacks) {
        const existingResponse = await prisma.feedbackResponse.findFirst({
          where: {
            feedbackFormId: form.id,
            studentId: profile.id
          }
        });

        forms.push({
          id: form.id,
          courseId: enrollment.course.id,
          courseName: enrollment.course.name,
          facultyName: enrollment.course.faculty?.user?.name ?? 'TBA',
          semester: String(enrollment.semester),
          status: existingResponse ? 'completed' : 'pending',
          deadline: form.deadline,
          questions: [
            {
              id: 'q1',
              question: 'Rate the overall course delivery',
              type: 'rating',
              options: ['1', '2', '3', '4', '5'],
              required: true
            },
            {
              id: 'q2',
              question: 'How clear were the faculty explanations?',
              type: 'rating',
              options: ['1', '2', '3', '4', '5'],
              required: true
            },
            {
              id: 'q3',
              question: 'Additional feedback',
              type: 'text',
              options: [],
              required: false
            }
          ]
        });
      }
    }

    res.json({ success: true, data: forms });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Submit Feedback Form
router.post('/feedback/:id/submit', authenticate, validate({ body: feedbackSubmitSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const feedbackFormId = String(req.params.id);
    const { responses } = req.body as { responses?: Record<string, unknown> };

    // FeedbackForm has no institutionId of its own, and the id is a raw URL
    // param — without this, a response could be filed against another
    // institution's form.
    const form = await prisma.feedbackForm.findFirst({
      where: { id: feedbackFormId, course: { institutionId: context.institutionId } },
      select: { id: true }
    });
    if (!form) {
      res.status(404).json({ success: false, message: 'Feedback form not found' });
      return;
    }

    const existing = await prisma.feedbackResponse.findFirst({
      where: {
        feedbackFormId,
        studentId: profile.id
      }
    });

    const submission = existing
      ? await prisma.feedbackResponse.update({
          where: { id: existing.id },
          data: {
            responses: (responses ?? {}) as any,
            submittedAt: new Date()
          }
        })
      : await prisma.feedbackResponse.create({
          data: {
            feedbackFormId,
            studentId: profile.id,
            responses: (responses ?? {}) as any
          }
        });

    res.json({ success: true, data: submission });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Get Certificates
router.get('/certificates', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const certificates = await prisma.certificateRequest.findMany({
      take: 200,
      where: { studentProfileId: profile.id },
      orderBy: { requestedAt: 'desc' }
    });
    res.json({ success: true, data: certificates });
  } catch (error: any) {
    sendError(res, error);
  }
});

// Request Certificate
router.post('/certificates/request', authenticate, validate({ body: certificateRequestSchema }), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const { type, purpose, copies } = req.body;
    const certificate = await prisma.certificateRequest.create({
      data: {
        institutionId: getTenantContext(req).institutionId,
        studentProfileId: profile.id,
        type,
        purpose,
        copies: copies || 1,
        // Was 'processing', a value that appears nowhere else in this model's
        // vocabulary: the registrar dashboard counts
        // `certificateRequest where status: 'pending'`, and the registrar's own
        // decision enum starts from 'pending' too. A request created as
        // 'processing' was therefore never counted as pending work and sat
        // outside the recognised lifecycle — the student saw it submitted, the
        // registrar's queue never showed it arriving.
        status: 'pending'
      }
    });
    res.json({ success: true, data: certificate });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Enrollment ───
router.post('/enroll', authenticate, validate({ body: enrollSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const { courseId, semester } = req.body;
    // Enrollment has no institutionId of its own, and courseId is
    // client-supplied — without this, a student could enroll in another
    // institution's course.
    const course = await prisma.course.findFirst({
      where: { id: courseId, institutionId: context.institutionId },
      select: { id: true }
    });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found' });
      return;
    }
    const enrollment = await prisma.enrollment.create({
      data: {
        courseId,
        studentProfileId: profile.id,
        semester: Number.isInteger(semester) ? semester : profile.semester
      }
    });
    res.json({ success: true, data: enrollment });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.delete('/enroll/:courseId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const courseId = String(req.params.courseId);
    await prisma.enrollment.deleteMany({ where: { courseId, studentProfileId: profile.id } });
    res.json({ success: true, message: 'Course dropped' });
  } catch (error: any) {
    sendError(res, error);
  }
});

// ─── Timetable ───
router.get('/timetable', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getStudentProfile(userId);
    const enrollments = await prisma.enrollment.findMany({
      where: { studentProfileId: profile.id },
      include: { course: { include: { schedules: true, faculty: { include: { user: true } } } } }
    });

    const timetable = enrollments.flatMap((e: any) =>
      (e.course.schedules || []).map((s: any) => ({
        id: s.id, courseId: e.course.id, courseCode: e.course.code, courseName: e.course.name,
        day: s.day, startTime: s.startTime, endTime: s.endTime, room: s.room, type: s.type,
        faculty: e.course.faculty?.user?.name || 'TBA'
      }))
    );

    res.json({ success: true, data: timetable });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
