import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { toRoleGrievanceStatus } from '../lib/grievanceStatus.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();
const db: any = prisma;
// Get Faculty Class Messages for the Student
router.get('/messages', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateStudentProfile(userId);

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

    const classEnrollments = await getOrCreateStudentClassEnrollments(profile.id);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Helper to ensure a student profile exists for a user
async function getOrCreateStudentProfile(userId: string) {
  let profile = await prisma.studentProfile.findUnique({
    where: { userId }
  });
  
  if (!profile) {
    profile = await prisma.studentProfile.create({
      data: {
        userId,
        rollNumber: `STU${userId.substring(0, 6).toUpperCase()}`,
        program: 'B.Tech',
        branch: 'Computer Science',
        semester: 5,
        section: 'A',
        batch: '2024',
        admissionYear: 2024,
        cgpa: 8.5
      }
    });
  }
  return profile;
}

async function getOrCreateStudentClassEnrollments(profileId: string) {
  let classEnrollments = await db.classEnrollment.findMany({ where: { studentProfileId: profileId } });
  if (classEnrollments.length > 0) {
    return classEnrollments;
  }

  const profile = await prisma.studentProfile.findUnique({ where: { id: profileId } });
  if (!profile) {
    return [];
  }

  const enrollments = await prisma.enrollment.findMany({
    where: { studentProfileId: profileId },
    include: { course: true }
  });

  for (const enrollment of enrollments) {
    if (!enrollment.course.facultyId) {
      continue;
    }

    let classRecord = await db.courseClass.findFirst({
      where: {
        courseId: enrollment.courseId,
        facultyId: enrollment.course.facultyId,
        section: profile.section,
        batch: profile.batch
      }
    });

    if (!classRecord) {
      classRecord = await db.courseClass.create({
        data: {
          courseId: enrollment.courseId,
          facultyId: enrollment.course.facultyId,
          section: profile.section,
          batch: profile.batch,
          name: `${enrollment.course.code} Section ${profile.section}${profile.batch ? ` (${profile.batch})` : ''}`
        }
      });
    }

    await db.classEnrollment.upsert({
      where: {
        classId_studentProfileId: {
          classId: classRecord.id,
          studentProfileId: profileId
        }
      },
      update: {},
      create: {
        classId: classRecord.id,
        studentProfileId: profileId
      }
    });
  }

  classEnrollments = await db.classEnrollment.findMany({ where: { studentProfileId: profileId } });
  return classEnrollments;
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

// Get Student Dashboard Data
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);

    // Fetch actual db stats
    const enrollments = await prisma.enrollment.count({ where: { studentProfileId: profile.id } });
    
    // Calculate attendance percentage (mocked via DB query structures if real data was populated)
    const attendances = await prisma.attendance.findMany({ where: { studentProfileId: profile.id } });
    const presentCount = attendances.filter((a: any) => a.status === 'present').length;
    const attendancePercent = attendances.length > 0 ? Math.round((presentCount / attendances.length) * 100) : 100;

    const pendingFees = await prisma.feeRecord.aggregate({
      where: { studentProfileId: profile.id, status: 'pending' },
      _sum: { amount: true }
    });

    res.json({
      success: true,
      data: {
        stats: [
          { label: 'Current CGPA', value: profile.cgpa.toString(), change: '+0.2', changeType: 'increase', icon: 'TrendingUp', color: 'text-primary' },
          { label: 'Attendance', value: `${attendancePercent}%`, change: 0, changeType: 'stable', icon: 'Calendar', color: 'text-secondary' },
          { label: 'Active Courses', value: enrollments.toString(), icon: 'BookOpen', color: 'text-warning' },
          { label: 'Fee Due', value: `₹${pendingFees._sum.amount || 0}`, icon: 'IndianRupee', color: 'text-destructive' }
        ],
        upcomingEvents: [
          { id: '1', title: 'Mid Semester Exams Check', date: new Date().toISOString() }
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Enrolled Courses
router.get('/courses', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);

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
      const attendance = totalClasses > 0 ? Math.round((presentClasses / totalClasses) * 100) : 100;

      const numericGrade = enrollment.grade != null ? Number(enrollment.grade) : NaN;
      const internalMarks = Number.isFinite(numericGrade) ? numericGrade : 0;

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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Attendance
router.get('/attendance', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);

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
        percentage: total > 0 ? Math.round((present / total) * 100) : 100,
        records: courseRecords.map((r: any) => ({
          date: r.session?.date,
          status: r.status,
          type: r.session?.type
        }))
      });
    }

    res.json({ success: true, data: attendanceData });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Profile
router.get('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/mentoring', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);

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
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/current-semester', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Update Profile
router.put('/profile', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const updated = await prisma.studentProfile.update({
      where: { id: profile.id },
      data: req.body
    });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Assignments
router.get('/assignments', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const semesterQuery = req.query.semester ? Number(req.query.semester) : undefined;
    const profile = await getOrCreateStudentProfile(userId);
    const classEnrollments = await getOrCreateStudentClassEnrollments(profile.id);
    const classIds = classEnrollments.map((enrollment: any) => enrollment.classId);
    
    const assignments = await db.assignment.findMany({
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit Assignment
router.post('/assignments/:id/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Examinations
router.get('/examinations', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const enrollments = await prisma.enrollment.findMany({ where: { studentProfileId: profile.id } });
    const courseIds = enrollments.map(e => e.courseId);

    const exams = await prisma.examination.findMany({
      where: { courseId: { in: courseIds } },
      include: { course: true },
      orderBy: { date: 'asc' }
    });
    res.json({ success: true, data: exams });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate Hall Ticket Data
router.get('/examinations/hall-ticket', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const user = await prisma.user.findUnique({ where: { id: userId } });

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
        student: {
          name: user?.name ?? 'Student',
          rollNumber: profile.rollNumber,
          program: profile.program,
          branch: profile.branch,
          semester: profile.semester
        },
        generatedAt: new Date(),
        exams: upcomingExams
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Results
router.get('/results', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const enrollments = await prisma.enrollment.findMany({
      where: { studentProfileId: profile.id },
      include: { course: true }
    });
    res.json({ success: true, data: enrollments });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Generate Transcript Data
router.get('/results/transcript', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Request Exam Revaluation
router.post('/examinations/:id/revaluation', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const examId = String(req.params.id);
    const { reason } = req.body as { reason?: string };

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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Fees
router.get('/fees', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const fees = await prisma.feeRecord.findMany({
      where: { studentProfileId: profile.id },
      orderBy: { dueDate: 'asc' }
    });
    res.json({ success: true, data: fees });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Pay Fees
router.post('/fees/pay', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const { feeRecordId, transactionId } = req.body;

    const fee = await prisma.feeRecord.updateMany({
      where: { id: feeRecordId, studentProfileId: profile.id },
      data: {
        status: 'paid',
        paidDate: new Date(),
        transactionId
      }
    });
    res.json({ success: true, data: fee });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Library Books
router.get('/library', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const books = await prisma.libraryBook.findMany({
      where: { studentProfileId: profile.id }
    });
    res.json({ success: true, data: books });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Hostel Info
router.get('/hostel', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const allocation = await prisma.hostelAllocation.findUnique({
      where: { studentProfileId: profile.id },
      include: { hostel: true }
    });
    res.json({ success: true, data: allocation });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Placements
router.get('/placements', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const drives = await prisma.placementDrive.findMany({
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Apply for Placement
router.post('/placements/:id/apply', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const placementDriveId = req.params.id;
    if (typeof placementDriveId !== 'string') {
      return res.status(400).json({ success: false, message: 'Invalid placement drive id' });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Renew Library Book
router.post('/library/:id/renew', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const bookId = String(req.params.id);

    const book = await prisma.libraryBook.findFirst({
      where: {
        id: bookId,
        studentProfileId: profile.id
      }
    });

    if (!book) {
      return res.status(404).json({ success: false, message: 'Book not found for this student' });
    }

    if (book.status !== 'issued' && book.status !== 'overdue') {
      return res.status(400).json({ success: false, message: 'Only issued books can be renewed' });
    }

    if ((book.renewalCount ?? 0) >= (book.maxRenewals ?? 0)) {
      return res.status(400).json({ success: false, message: 'Renewal limit reached' });
    }

    const baseDueDate = book.dueDate ?? new Date();
    const nextDueDate = new Date(baseDueDate);
    nextDueDate.setDate(nextDueDate.getDate() + 14);

    const updated = await prisma.libraryBook.update({
      where: { id: book.id },
      data: {
        renewalCount: (book.renewalCount ?? 0) + 1,
        dueDate: nextDueDate,
        status: 'issued'
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Grievances
router.get('/grievances', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const grievances = await prisma.grievanceCase.findMany({
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
    res.status(500).json({ success: false, message: error.message });
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Post Grievance
router.post('/grievances', authenticate, async (req: Request, res: Response) => {
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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Feedback Forms
router.get('/feedback', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);

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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Submit Feedback Form
router.post('/feedback/:id/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const feedbackFormId = String(req.params.id);
    const { responses } = req.body as { responses?: Record<string, unknown> };

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
    res.status(500).json({ success: false, message: error.message });
  }
});

// Get Certificates
router.get('/certificates', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const certificates = await prisma.certificateRequest.findMany({
      where: { studentProfileId: profile.id },
      orderBy: { requestedAt: 'desc' }
    });
    res.json({ success: true, data: certificates });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Request Certificate
router.post('/certificates/request', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const { type, purpose, copies } = req.body;
    const certificate = await prisma.certificateRequest.create({
      data: {
        studentProfileId: profile.id,
        type,
        purpose,
        copies: copies || 1,
        status: 'processing'
      }
    });
    res.json({ success: true, data: certificate });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Enrollment ───
router.post('/enroll', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const { courseId, semester } = req.body;
    const enrollment = await prisma.enrollment.create({
      data: {
        courseId,
        studentProfileId: profile.id,
        semester: Number.isInteger(semester) ? semester : profile.semester
      }
    });
    res.json({ success: true, data: enrollment });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/enroll/:courseId', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
    const courseId = String(req.params.courseId);
    await prisma.enrollment.deleteMany({ where: { courseId, studentProfileId: profile.id } });
    res.json({ success: true, message: 'Course dropped' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Timetable ───
router.get('/timetable', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const profile = await getOrCreateStudentProfile(userId);
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
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
