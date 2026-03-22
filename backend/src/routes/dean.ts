import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate, authorizeRoles } from '../middleware/auth.js';

const router = Router();

async function getDeanDepartment(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId }, include: { department: true } });
  if (!user?.departmentId) {
    let dept = await prisma.department.findUnique({ where: { code: 'CSE' } });
    if (!dept) {
      dept = await prisma.department.create({ data: { name: 'Computer Science & Engg', code: 'CSE' } });
    }
    await prisma.user.update({ where: { id: userId }, data: { departmentId: dept.id } });
    return dept;
  }
  return user.department;
}

async function resolveStudentProfileIdsByEmails(departmentId: string, emails: string[]) {
  if (emails.length === 0) return [] as string[];

  const users = await prisma.user.findMany({
    where: {
      departmentId,
      role: 'student',
      email: { in: emails }
    },
    include: { studentProfile: true }
  });

  return users
    .map((user: any) => user.studentProfile?.id)
    .filter((id: string | undefined): id is string => Boolean(id));
}

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const totalStudents = await prisma.user.count({ where: { role: 'student' } });
    const totalFaculty = await prisma.user.count({ where: { role: 'faculty' } });
    const pendingApprovals = await prisma.approvalItem.count({ where: { status: 'pending' } });
    const departments = await prisma.department.findMany({ include: { users: true, courses: true } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Total Students", value: totalStudents.toString(), icon: "Users" },
          { label: "Total Faculty", value: totalFaculty.toString(), icon: "GraduationCap" },
          { label: "Pending Approvals", value: pendingApprovals.toString(), icon: "FileText", color: "text-warning" },
          { label: "Departments", value: departments.length.toString(), icon: "Building2", color: "text-success" }
        ],
        departments: departments.map((d: any) => ({
          id: d.id, name: d.name,
          totalFaculty: d.users.filter((u: any) => u.role === 'faculty').length,
          totalStudents: d.users.filter((u: any) => u.role === 'student').length,
          totalCourses: d.courses.length
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Academics ───
router.get('/academics', authenticate, async (req: Request, res: Response) => {
  try {
    const departments = await prisma.department.findMany({
      include: { courses: { include: { enrollments: true } }, users: true }
    });
    res.json({
      success: true,
      data: departments.map((d: any) => ({
        id: d.id, name: d.name,
        totalFaculty: d.users.filter((u: any) => u.role === 'faculty').length,
        totalStudents: d.users.filter((u: any) => u.role === 'student').length,
        courses: d.courses.length
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Curriculum Proposals ───
router.get('/curriculum-proposals', authenticate, async (req: Request, res: Response) => {
  try {
    const proposals = await prisma.curriculumProposal.findMany({ orderBy: { submittedAt: 'desc' } });
    res.json({ success: true, data: proposals });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/curriculum-proposals/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status } = req.body;
    const updated = await prisma.curriculumProposal.update({ where: { id }, data: { status } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Faculty & HR ───
router.get('/faculty', authenticate, async (req: Request, res: Response) => {
  try {
    const faculty = await prisma.user.findMany({
      where: { role: 'faculty' },
      include: { department: true, facultyProfile: true }
    });
    res.json({
      success: true,
      data: faculty.map((f: any) => ({
        id: f.id, name: f.name, email: f.email, department: f.department?.name,
        designation: f.designation, qualification: f.facultyProfile?.qualification,
        specialization: f.facultyProfile?.specialization, experience: f.facultyProfile?.experience
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/recruitment', authenticate, async (req: Request, res: Response) => {
  try {
    const rec = await prisma.facultyRecruitment.findMany({ include: { department: true } });
    res.json({ success: true, data: rec });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Student Affairs ───
router.get('/student-affairs', authenticate, async (req: Request, res: Response) => {
  try {
    const cases = await prisma.disciplinaryCase.findMany({ orderBy: { reportedAt: 'desc' } });
    const scholarships = await prisma.feeRecord.count({ where: { type: 'other' as any, status: 'paid' } });
    res.json({ success: true, data: { disciplinaryCases: cases, scholarshipCount: scholarships } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/disciplinary/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { status, severity } = req.body;
    const updated = await prisma.disciplinaryCase.update({ where: { id }, data: { status, ...(severity && { severity }) } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Results ───
router.get('/results', authenticate, async (req: Request, res: Response) => {
  try {
    const [departments, approvals] = await Promise.all([
      prisma.department.findMany({ include: { courses: { include: { enrollments: true } } } }),
      prisma.approvalItem.findMany({ where: { type: 'result_publication' } })
    ]);

    const approvalByDepartmentId = new Map<string, any>();
    for (const approval of approvals) {
      if (approval.details) {
        approvalByDepartmentId.set(String(approval.details), approval);
      }
    }

    res.json({
      success: true,
      data: departments.map((d: any) => {
        const totalEnrollments = d.courses.reduce((sum: number, c: any) => sum + c.enrollments.length, 0);
        const passed = d.courses.reduce((sum: number, c: any) =>
          sum + c.enrollments.filter((e: any) => e.grade && !['F', 'I'].includes(e.grade)).length, 0);

        const approval = approvalByDepartmentId.get(String(d.id));
        let status = 'draft';
        if (approval?.status === 'pending') status = 'pending_approval';
        if (approval?.status === 'published' || approval?.status === 'approved') status = 'published';

        return {
          departmentId: d.id,
          department: d.name,
          totalStudents: totalEnrollments,
          passed,
          failed: totalEnrollments - passed,
          passPercentage: totalEnrollments > 0 ? Math.round((passed / totalEnrollments) * 100) : 0,
          avgGPA: 7.2,
          status
        };
      })
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/results/:id/approve', authenticate, async (req: Request, res: Response) => {
  try {
    const identifier = decodeURIComponent(String(req.params.id));
    const userId = String((req as any).user.id);

    const department = await prisma.department.findFirst({
      where: {
        OR: [{ id: identifier }, { name: identifier }]
      }
    });

    if (!department) {
      res.status(404).json({ success: false, message: 'Department not found' });
      return;
    }

    const existing = await prisma.approvalItem.findFirst({
      where: { type: 'result_publication', details: String(department.id) },
      orderBy: { requestedAt: 'desc' }
    });

    const saved = existing
      ? await prisma.approvalItem.update({
          where: { id: existing.id },
          data: { status: 'published', title: `Result publication - ${department.name}` }
        })
      : await prisma.approvalItem.create({
          data: {
            type: 'result_publication',
            title: `Result publication - ${department.name}`,
            details: String(department.id),
            requestedBy: userId,
            priority: 'medium',
            status: 'published'
          }
        });

    res.json({
      success: true,
      data: {
        approvalId: saved.id,
        departmentId: department.id,
        department: department.name,
        status: 'published'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Finance ───
router.get('/finance', authenticate, async (req: Request, res: Response) => {
  try {
    const budgets = await prisma.departmentBudget.findMany({ include: { department: true } });
    res.json({
      success: true,
      data: budgets.map((b: any) => ({
        department: b.department.name, allocated: b.allocated, spent: b.spent,
        remaining: b.allocated - b.spent, categories: []
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Accreditation ───
router.get('/accreditation', authenticate, async (req: Request, res: Response) => {
  try {
    const metrics = await prisma.qualityMetric.findMany();
    res.json({ success: true, data: metrics });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Coordination ───
router.get('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const events = await prisma.interDeptEvent.findMany({ orderBy: { date: 'desc' } });
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Dean Class Management ───
router.get('/class-management/options', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const [courses, faculty, rooms] = await Promise.all([
      prisma.course.findMany({ where: { departmentId: department.id }, orderBy: [{ semester: 'asc' }, { code: 'asc' }] }),
      prisma.facultyProfile.findMany({ where: { user: { departmentId: department.id } }, include: { user: true } }),
      prisma.facility.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] })
    ]);

    res.json({
      success: true,
      data: {
        courses: courses.map((course: any) => ({ id: course.id, code: course.code, name: course.name, semester: course.semester, credits: course.credits })),
        faculty: faculty.map((item: any) => ({ id: item.id, name: item.user?.name || 'Faculty', email: item.user?.email || '' })),
        rooms: rooms.map((room: any) => ({ id: room.id, name: room.name, type: room.type, capacity: room.capacity, status: room.status }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/class-management', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const classes = await prisma.courseClass.findMany({
      where: { course: { departmentId: department.id } },
      include: {
        course: true,
        faculty: { include: { user: true } },
        students: { include: { student: { include: { user: true } } } }
      },
      orderBy: { course: { semester: 'asc' } }
    });

    const slots = await prisma.timetableSlot.findMany({ where: { departmentId: department.id } });
    const slotByClassKey = new Map<string, any>();
    for (const slot of slots) {
      const key = `${slot.courseCode}::${String(slot.section).toUpperCase()}`;
      if (!slotByClassKey.has(key)) slotByClassKey.set(key, slot);
    }

    res.json({
      success: true,
      data: classes.map((item: any) => ({
        ...(() => {
          const slot = slotByClassKey.get(`${item.course.code}::${String(item.section).toUpperCase()}`);
          return {
            day: slot?.day || null,
            startTime: slot?.startTime || null,
            endTime: slot?.endTime || null,
            room: slot?.room || null,
            schedule: slot ? `${slot.day} ${slot.startTime}-${slot.endTime} (${slot.room})` : 'TBD',
            type: slot?.type || 'theory'
          };
        })(),
        id: item.id,
        courseId: item.courseId,
        courseCode: item.course.code,
        courseName: item.course.name,
        credits: item.course.credits,
        semester: item.course.semester,
        section: item.section,
        facultyId: item.facultyId,
        assignedFaculty: item.faculty?.user?.name || 'Unassigned',
        students: item.students.length,
        studentEmails: item.students
          .map((enrollment: any) => enrollment.student?.user?.email)
          .filter((email: string | undefined): email is string => Boolean(email))
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/class-management', authenticate, authorizeRoles('dean', 'hod'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const { courseId, semester, facultyId, section, studentEmails, type, roomId, day, startTime, endTime } = req.body;
    if (!courseId || !facultyId || !section || !roomId || !day || !startTime || !endTime) {
      res.status(400).json({ success: false, message: 'courseId, facultyId, section, roomId, day, startTime and endTime are required' });
      return;
    }

    const course = await prisma.course.findFirst({ where: { id: String(courseId), departmentId: department.id } });
    if (!course) {
      res.status(404).json({ success: false, message: 'Course not found in selected department' });
      return;
    }

    const semesterNum = Number(semester);
    if (Number.isFinite(semesterNum) && semesterNum !== course.semester) {
      res.status(400).json({ success: false, message: 'Selected semester does not match the course semester' });
      return;
    }

    const faculty = await prisma.facultyProfile.findUnique({ where: { id: String(facultyId) }, include: { user: true } });
    if (!faculty || faculty.user?.departmentId !== department.id) {
      res.status(400).json({ success: false, message: 'Selected faculty does not belong to the same department' });
      return;
    }

    const room = await prisma.facility.findUnique({ where: { id: String(roomId) } });
    if (!room) {
      res.status(404).json({ success: false, message: 'Selected room not found' });
      return;
    }

    const conflict = await prisma.timetableSlot.findFirst({
      where: {
        departmentId: department.id,
        day: String(day),
        startTime: String(startTime),
        OR: [
          { room: room.name },
          { faculty: faculty.user?.name || '' }
        ]
      }
    });
    if (conflict) {
      res.status(400).json({ success: false, message: 'Timetable conflict detected for room/faculty at selected slot' });
      return;
    }

    const createdClass = await prisma.courseClass.create({
      data: {
        courseId: course.id,
        facultyId: String(facultyId),
        section: String(section).toUpperCase(),
        name: `${course.code}-${String(section).toUpperCase()}`
      }
    });

    const emails = String(studentEmails || '')
      .split(/[\n,;]/)
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean);
    const studentProfileIds = await resolveStudentProfileIdsByEmails(department.id, emails);

    if (studentProfileIds.length > 0) {
      await prisma.classEnrollment.createMany({
        data: studentProfileIds.map((studentProfileId: string) => ({ classId: createdClass.id, studentProfileId })),
        skipDuplicates: true
      });
    }

    await prisma.timetableSlot.create({
      data: {
        day: String(day),
        startTime: String(startTime),
        endTime: String(endTime),
        courseCode: course.code,
        courseName: course.name,
        faculty: faculty.user?.name || 'Unassigned',
        room: room.name,
        section: String(section).toUpperCase(),
        type: String(type || 'theory'),
        departmentId: department.id
      }
    });

    const enrollments = await prisma.classEnrollment.findMany({
      where: { classId: createdClass.id },
      include: { student: { include: { user: true } } }
    });
    res.json({
      success: true,
      data: {
        id: createdClass.id,
        courseId: course.id,
        courseCode: course.code,
        courseName: course.name,
        credits: course.credits,
        semester: course.semester,
        section: createdClass.section,
        facultyId: createdClass.facultyId,
        assignedFaculty: faculty.user?.name || 'Assigned',
        day: String(day),
        startTime: String(startTime),
        endTime: String(endTime),
        room: room.name,
        schedule: `${String(day)} ${String(startTime)}-${String(endTime)} (${room.name})`,
        students: enrollments.length,
        studentEmails: enrollments
          .map((enrollment: any) => enrollment.student?.user?.email)
          .filter((email: string | undefined): email is string => Boolean(email)),
        type: type || 'theory'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/class-management/:id', authenticate, authorizeRoles('dean', 'hod'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const classId = String(req.params.id);
    const existing = await prisma.courseClass.findFirst({
      where: { id: classId, course: { departmentId: department.id } },
      include: { course: true }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Class not found' });
      return;
    }

    const { courseCode, courseName, credits, semester, facultyId, section, studentEmails, type, roomId, day, startTime, endTime } = req.body;

    const updatedCourse = await prisma.course.update({
      where: { id: existing.courseId },
      data: {
        ...(courseCode ? { code: String(courseCode) } : {}),
        ...(courseName ? { name: String(courseName) } : {}),
        ...(credits != null ? { credits: Number(credits) } : {}),
        ...(semester != null ? { semester: Number(semester) } : {})
      }
    });

    const updatedClass = await prisma.courseClass.update({
      where: { id: classId },
      data: {
        ...(facultyId ? { facultyId: String(facultyId) } : {}),
        ...(section ? { section: String(section).toUpperCase() } : {}),
        ...(type ? { name: `${updatedCourse.code}-${String(section || existing.section).toUpperCase()}-${String(type)}` } : {})
      },
      include: { faculty: { include: { user: true } } }
    });

    const room = roomId ? await prisma.facility.findUnique({ where: { id: String(roomId) } }) : null;
    const slotKeyCourseCode = updatedCourse.code;
    const slotKeySection = String(updatedClass.section).toUpperCase();
    const existingSlot = await prisma.timetableSlot.findFirst({
      where: {
        departmentId: department.id,
        courseCode: slotKeyCourseCode,
        section: slotKeySection
      },
      orderBy: { startTime: 'asc' }
    });

    const chosenDay = String(day || existingSlot?.day || 'Monday');
    const chosenStart = String(startTime || existingSlot?.startTime || '09:00');
    const chosenEnd = String(endTime || existingSlot?.endTime || '10:00');
    const chosenRoom = String(room?.name || existingSlot?.room || 'TBD');
    const chosenFacultyName = updatedClass.faculty?.user?.name || existingSlot?.faculty || 'Unassigned';

    await prisma.timetableSlot.deleteMany({
      where: {
        departmentId: department.id,
        courseCode: slotKeyCourseCode,
        section: slotKeySection
      }
    });
    await prisma.timetableSlot.create({
      data: {
        day: chosenDay,
        startTime: chosenStart,
        endTime: chosenEnd,
        courseCode: slotKeyCourseCode,
        courseName: updatedCourse.name,
        faculty: chosenFacultyName,
        room: chosenRoom,
        section: slotKeySection,
        type: String(type || existingSlot?.type || 'theory'),
        departmentId: department.id
      }
    });

    if (studentEmails !== undefined) {
      const emails = String(studentEmails || '')
        .split(/[\n,;]/)
        .map((entry) => entry.trim().toLowerCase())
        .filter(Boolean);

      const studentProfileIds = await resolveStudentProfileIdsByEmails(department.id, emails);
      await prisma.classEnrollment.deleteMany({ where: { classId } });
      if (studentProfileIds.length > 0) {
        await prisma.classEnrollment.createMany({
          data: studentProfileIds.map((studentProfileId: string) => ({ classId, studentProfileId })),
          skipDuplicates: true
        });
      }
    }

    const enrollments = await prisma.classEnrollment.findMany({
      where: { classId },
      include: { student: { include: { user: true } } }
    });
    res.json({
      success: true,
      data: {
        id: classId,
        courseId: updatedCourse.id,
        courseCode: updatedCourse.code,
        courseName: updatedCourse.name,
        credits: updatedCourse.credits,
        semester: updatedCourse.semester,
        section: updatedClass.section,
        facultyId: updatedClass.facultyId,
        assignedFaculty: updatedClass.faculty?.user?.name || 'Assigned',
        day: chosenDay,
        startTime: chosenStart,
        endTime: chosenEnd,
        room: chosenRoom,
        schedule: `${chosenDay} ${chosenStart}-${chosenEnd} (${chosenRoom})`,
        students: enrollments.length,
        studentEmails: enrollments
          .map((enrollment: any) => enrollment.student?.user?.email)
          .filter((email: string | undefined): email is string => Boolean(email)),
        type: type || 'theory'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/class-management/:id', authenticate, authorizeRoles('dean', 'hod'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const classId = String(req.params.id);
    const existing = await prisma.courseClass.findFirst({
      where: { id: classId, course: { departmentId: department.id } }
    });

    if (!existing) {
      res.status(404).json({ success: false, message: 'Class not found' });
      return;
    }

    await prisma.courseClass.delete({ where: { id: classId } });
    res.json({ success: true, data: { id: classId } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const { title, type, date, departments, coordinator, budget } = req.body;
    const event = await prisma.interDeptEvent.create({
      data: { title, type, date: new Date(date), departments, coordinator, budget: budget || 0 }
    });
    res.json({ success: true, data: event });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/events/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updateData: any = {};
    const { title, type, date, departments, coordinator, budget, participants, status } = req.body;

    if (title !== undefined) updateData.title = String(title);
    if (type !== undefined) updateData.type = String(type);
    if (date !== undefined) updateData.date = new Date(date);
    if (departments !== undefined) updateData.departments = departments;
    if (coordinator !== undefined) updateData.coordinator = String(coordinator);
    if (budget !== undefined) updateData.budget = Number(budget) || 0;
    if (participants !== undefined) updateData.participants = Number(participants) || 0;
    if (status !== undefined) updateData.status = String(status);

    const event = await prisma.interDeptEvent.update({ where: { id }, data: updateData });
    res.json({ success: true, data: event });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/meetings', authenticate, async (req: Request, res: Response) => {
  try {
    const meetings = await prisma.meeting.findMany({ orderBy: { date: 'desc' }, take: 20 });
    res.json({ success: true, data: meetings });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/meetings', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const { title, meetingType, date, time, venue, status, agendaItems, attendees, minutes } = req.body;

    if (!title || !meetingType || !date || !time || !venue) {
      res.status(400).json({ success: false, message: 'title, meetingType, date, time and venue are required' });
      return;
    }

    const meeting = await prisma.meeting.create({
      data: {
        title: String(title),
        meetingType: String(meetingType),
        date: new Date(date),
        time: String(time),
        venue: String(venue),
        status: String(status || 'upcoming'),
        agendaItems: agendaItems || null,
        attendees: attendees || null,
        minutes: minutes ? String(minutes) : null,
        createdBy: String(userId)
      }
    });

    res.json({ success: true, data: meeting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/meetings/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const { title, meetingType, date, time, venue, status, agendaItems, attendees, minutes } = req.body;

    const updateData: any = {};
    if (title !== undefined) updateData.title = String(title);
    if (meetingType !== undefined) updateData.meetingType = String(meetingType);
    if (date !== undefined) updateData.date = new Date(date);
    if (time !== undefined) updateData.time = String(time);
    if (venue !== undefined) updateData.venue = String(venue);
    if (status !== undefined) updateData.status = String(status);
    if (agendaItems !== undefined) updateData.agendaItems = agendaItems;
    if (attendees !== undefined) updateData.attendees = attendees;
    if (minutes !== undefined) updateData.minutes = minutes ? String(minutes) : null;

    const meeting = await prisma.meeting.update({ where: { id }, data: updateData });
    res.json({ success: true, data: meeting });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Mentoring Assignment Management ───
router.get('/mentoring/options', authenticate, async (_req: Request, res: Response) => {
  try {
    const [faculty, students, assignments] = await Promise.all([
      prisma.facultyProfile.findMany({ include: { user: { include: { department: true } } } }),
      prisma.studentProfile.findMany({ include: { user: { include: { department: true } } } }),
      prisma.menteeAssignment.findMany()
    ]);

    const facultyById = new Map(faculty.map((item: any) => [item.id, item]));
    const studentsById = new Map(students.map((item: any) => [item.id, item]));

    res.json({
      success: true,
      data: {
        faculty: faculty.map((item: any) => ({
          id: item.id,
          userId: item.userId,
          name: item.user?.name || 'Faculty',
          email: item.user?.email || '',
          employeeId: item.employeeId,
          department: item.user?.department?.name || null
        })),
        students: students.map((item: any) => ({
          id: item.id,
          userId: item.userId,
          name: item.user?.name || 'Student',
          email: item.user?.email || '',
          rollNumber: item.rollNumber,
          program: item.program,
          semester: item.semester,
          section: item.section,
          department: item.user?.department?.name || null
        })),
        assignments: assignments.map((item: any) => {
          const facultyProfile = facultyById.get(item.facultyId);
          const studentProfile = studentsById.get(item.studentId);
          return {
            id: item.id,
            facultyId: item.facultyId,
            studentId: item.studentId,
            lastMeeting: item.lastMeeting,
            facultyName: facultyProfile?.user?.name || 'Faculty',
            facultyEmail: facultyProfile?.user?.email || '',
            studentName: studentProfile?.user?.name || 'Student',
            studentEmail: studentProfile?.user?.email || '',
            rollNumber: studentProfile?.rollNumber || ''
          };
        })
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/mentoring/assignments', authenticate, async (req: Request, res: Response) => {
  try {
    const { studentId, facultyId } = req.body;

    if (!studentId || !facultyId) {
      res.status(400).json({ success: false, message: 'studentId and facultyId are required' });
      return;
    }

    const [student, faculty] = await Promise.all([
      prisma.studentProfile.findUnique({ where: { id: String(studentId) } }),
      prisma.facultyProfile.findUnique({ where: { id: String(facultyId) } })
    ]);

    if (!student) {
      res.status(404).json({ success: false, message: 'Student not found' });
      return;
    }

    if (!faculty) {
      res.status(404).json({ success: false, message: 'Faculty not found' });
      return;
    }

    const existingForStudent = await prisma.menteeAssignment.findFirst({
      where: { studentId: String(studentId) }
    });

    const assignment = existingForStudent
      ? await prisma.menteeAssignment.update({
          where: { id: existingForStudent.id },
          data: { facultyId: String(facultyId) }
        })
      : await prisma.menteeAssignment.create({
          data: {
            studentId: String(studentId),
            facultyId: String(facultyId)
          }
        });

    const [studentUser, facultyUser] = await Promise.all([
      prisma.user.findUnique({ where: { id: student.userId } }),
      prisma.user.findUnique({ where: { id: faculty.userId } })
    ]);

    res.json({
      success: true,
      data: {
        id: assignment.id,
        studentId: assignment.studentId,
        facultyId: assignment.facultyId,
        lastMeeting: assignment.lastMeeting,
        studentName: studentUser?.name || 'Student',
        rollNumber: student.rollNumber,
        facultyName: facultyUser?.name || 'Faculty',
        facultyEmail: facultyUser?.email || ''
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/mentoring/assignments/:studentId', authenticate, async (req: Request, res: Response) => {
  try {
    const studentId = String(req.params.studentId);
    const assignment = await prisma.menteeAssignment.findFirst({ where: { studentId } });

    if (!assignment) {
      res.status(404).json({ success: false, message: 'No assignment found for this student' });
      return;
    }

    await prisma.menteeAssignment.delete({ where: { id: assignment.id } });
    res.json({ success: true, message: 'Assignment removed' });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Dean Course Management ───
router.get('/course-management/options', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const faculty = await prisma.facultyProfile.findMany({
      where: { user: { departmentId: department.id } },
      include: { user: true },
      orderBy: { user: { name: 'asc' } }
    });

    res.json({
      success: true,
      data: {
        department: { id: department.id, name: department.name, code: department.code },
        faculty: faculty.map((item: any) => ({ id: item.id, name: item.user?.name || 'Faculty', email: item.user?.email || '' }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/course-management', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const courses = await prisma.course.findMany({
      where: { departmentId: department.id },
      include: { enrollments: true },
      orderBy: [{ semester: 'asc' }, { code: 'asc' }]
    });

    res.json({
      success: true,
      data: courses.map((course: any) => ({
        id: course.id,
        code: course.code,
        name: course.name,
        credits: course.credits,
        semester: course.semester,
        students: course.enrollments.length,
        department: department.name,
        departmentId: department.id
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/course-management', authenticate, authorizeRoles('dean', 'hod'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const { code, name, credits, semester } = req.body;
    if (!code || !name || !credits || !semester) {
      res.status(400).json({ success: false, message: 'code, name, credits and semester are required' });
      return;
    }

    const created = await prisma.course.create({
      data: {
        code: String(code).toUpperCase(),
        name: String(name),
        credits: Number(credits),
        semester: Number(semester),
        departmentId: department.id,
        facultyId: null
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/course-management/:id', authenticate, authorizeRoles('dean', 'hod'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const id = String(req.params.id);
    const existing = await prisma.course.findFirst({ where: { id, departmentId: department.id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Course not found' });
      return;
    }

    const payload = req.body ?? {};
    const updated = await prisma.course.update({
      where: { id },
      data: {
        ...(payload.code ? { code: String(payload.code).toUpperCase() } : {}),
        ...(payload.name ? { name: String(payload.name) } : {}),
        ...(payload.credits != null ? { credits: Number(payload.credits) } : {}),
        ...(payload.semester != null ? { semester: Number(payload.semester) } : {}),
        facultyId: null
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/course-management/:id', authenticate, authorizeRoles('dean', 'hod'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const id = String(req.params.id);
    const existing = await prisma.course.findFirst({ where: { id, departmentId: department.id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Course not found' });
      return;
    }

    await prisma.course.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Dean Facility Management ───
router.get('/facility-management', authenticate, async (_req: Request, res: Response) => {
  try {
    const facilities = await prisma.facility.findMany({ orderBy: [{ type: 'asc' }, { name: 'asc' }] });
    res.json({ success: true, data: facilities });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/facility-management', authenticate, authorizeRoles('dean', 'hod'), async (req: Request, res: Response) => {
  try {
    const { name, type, capacity, status } = req.body;
    if (!name || !type || !capacity) {
      res.status(400).json({ success: false, message: 'name, type and capacity are required' });
      return;
    }

    const created = await prisma.facility.create({
      data: {
        name: String(name),
        type: String(type),
        capacity: Number(capacity),
        status: status ? String(status) : 'available'
      }
    });
    res.json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/facility-management/:id', authenticate, authorizeRoles('dean', 'hod'), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};

    const updated = await prisma.facility.update({
      where: { id },
      data: {
        ...(payload.name ? { name: String(payload.name) } : {}),
        ...(payload.type ? { type: String(payload.type) } : {}),
        ...(payload.capacity != null ? { capacity: Number(payload.capacity) } : {}),
        ...(payload.status ? { status: String(payload.status) } : {})
      }
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/facility-management/:id', authenticate, authorizeRoles('dean', 'hod'), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const facility = await prisma.facility.findUnique({ where: { id } });
    if (!facility) {
      res.status(404).json({ success: false, message: 'Facility not found' });
      return;
    }

    const usageCount = await prisma.timetableSlot.count({ where: { room: facility.name } });
    if (usageCount > 0) {
      res.status(400).json({ success: false, message: 'Cannot delete facility used in timetable slots' });
      return;
    }

    await prisma.facility.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Dean Semester Management ───
router.get('/semester-management/academic-years', authenticate, async (_req: Request, res: Response) => {
  try {
    const years = await prisma.academicYear.findMany({ orderBy: { year: 'desc' } });
    res.json({ success: true, data: years });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/semester-management/academic-years', authenticate, authorizeRoles('dean'), async (req: Request, res: Response) => {
  try {
    const yearValue = String(req.body?.year || '').trim();
    if (!yearValue || !req.body?.startDate || !req.body?.endDate) {
      res.status(400).json({ success: false, message: 'year, startDate and endDate are required' });
      return;
    }

    const existing = await prisma.academicYear.findUnique({ where: { year: yearValue } });
    if (existing) {
      res.status(400).json({ success: false, message: `Academic year ${yearValue} already exists` });
      return;
    }

    const created = await prisma.academicYear.create({
      data: {
        year: yearValue,
        startDate: new Date(req.body.startDate),
        endDate: new Date(req.body.endDate),
        isCurrent: Boolean(req.body?.isCurrent),
        status: req.body?.status ? String(req.body.status) : 'upcoming',
        ...(req.body?.semesters !== undefined ? { semesters: req.body.semesters } : {})
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/semester-management/academic-years/:id', authenticate, authorizeRoles('dean'), async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const payload = req.body ?? {};

    const data: any = {
      ...(payload.year ? { year: String(payload.year).trim() } : {}),
      ...(payload.status ? { status: String(payload.status) } : {}),
      ...(payload.semesters !== undefined ? { semesters: payload.semesters } : {}),
      ...(payload.isCurrent !== undefined ? { isCurrent: Boolean(payload.isCurrent) } : {})
    };

    if (payload.startDate) data.startDate = new Date(payload.startDate);
    if (payload.endDate) data.endDate = new Date(payload.endDate);

    const updated = await prisma.$transaction(async (tx) => {
      if (payload.isCurrent === true) {
        await tx.academicYear.updateMany({ where: { isCurrent: true }, data: { isCurrent: false } });
      }
      return tx.academicYear.update({ where: { id }, data });
    });

    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Dean Lab Purchase Approvals ───
router.get('/inventory/purchase-requests', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const requests = await prisma.purchaseRequest.findMany({
      where: { departmentId: department.id },
      orderBy: { requestDate: 'desc' }
    });

    res.json({
      success: true,
      data: requests.map((item: any) => ({
        ...item,
        requestDate: new Date(item.requestDate).toLocaleDateString('en-IN')
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/inventory/purchase-requests/:id/status', authenticate, authorizeRoles('dean'), async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const department = await getDeanDepartment(userId);
    if (!department) throw new Error('Department unassigned');

    const id = String(req.params.id);
    const status = String(req.body?.status || 'pending').toLowerCase();
    if (!['pending', 'approved', 'rejected'].includes(status)) {
      res.status(400).json({ success: false, message: 'Invalid status value' });
      return;
    }

    const existing = await prisma.purchaseRequest.findFirst({ where: { id, departmentId: department.id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Purchase request not found' });
      return;
    }

    const updated = await prisma.purchaseRequest.update({ where: { id }, data: { status } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
