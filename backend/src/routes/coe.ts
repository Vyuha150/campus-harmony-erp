import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

function normalizeText(value: unknown) {
  return String(value || '').trim().toLowerCase();
}

function normalizeSemester(value: unknown) {
  const parsed = Number.parseInt(String(value || ''), 10);
  return Number.isFinite(parsed) ? parsed : null;
}

router.get('/exams', authenticate, async (_req: Request, res: Response) => {
  try {
    const [exams, profiles] = await Promise.all([
      prisma.examProgress.findMany({ orderBy: { startDate: 'desc' } }),
      prisma.studentProfile.findMany({ select: { program: true, semester: true } })
    ]);

    const totalProfiles = profiles.length;
    const programCounts = new Map<string, number>();
    const programSemesterCounts = new Map<string, number>();

    for (const profile of profiles) {
      const programKey = normalizeText(profile.program);
      const semester = normalizeSemester(profile.semester);
      if (!programKey) continue;

      programCounts.set(programKey, (programCounts.get(programKey) || 0) + 1);
      if (semester !== null) {
        const key = `${programKey}::${semester}`;
        programSemesterCounts.set(key, (programSemesterCounts.get(key) || 0) + 1);
      }
    }

    const normalized = exams.map((exam: any) => {
      const storedTotal = Math.max(0, Number(exam.totalStudents) || 0);
      const programKey = normalizeText(exam.program);
      const semester = normalizeSemester(exam.semester);

      let inferredTotal: number | undefined;
      if (programKey && semester !== null) {
        inferredTotal = programSemesterCounts.get(`${programKey}::${semester}`);
      }
      if ((inferredTotal === undefined || inferredTotal === 0) && programKey) {
        inferredTotal = programCounts.get(programKey);
      }
      if (inferredTotal === undefined || inferredTotal === 0) {
        inferredTotal = totalProfiles > 0 ? totalProfiles : storedTotal;
      }

      const totalStudents = Math.max(0, inferredTotal || 0);
      let marksEntered = Math.max(0, Number(exam.marksEntered) || 0);
      marksEntered = Math.min(marksEntered, totalStudents);
      if (exam.status === 'published' || exam.resultsPublished) {
        marksEntered = totalStudents;
      }

      return { ...exam, totalStudents, marksEntered };
    });

    res.json({ success: true, data: normalized });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/exams', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = String((req as any).user.id);
    const { examName, semester, program, totalStudents, startDate, endDate, coordinator } = req.body;

    if (!examName || !semester || !program || !totalStudents || !startDate || !endDate) {
      res.status(400).json({
        success: false,
        message: 'examName, semester, program, totalStudents, startDate and endDate are required'
      });
      return;
    }

    const creator = await prisma.user.findUnique({ where: { id: userId } });
    const created = await prisma.examProgress.create({
      data: {
        examName: String(examName),
        semester: String(semester),
        program: String(program),
        totalStudents: Math.max(0, Number(totalStudents) || 0),
        marksEntered: 0,
        resultsPublished: false,
        status: 'scheduling',
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        coordinator: String(coordinator || creator?.name || userId)
      }
    });

    res.json({ success: true, data: created });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/exams/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.examProgress.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/exams/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    await prisma.examProgress.delete({ where: { id } });
    res.json({ success: true, data: { id } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/dashboard', authenticate, async (_req: Request, res: Response) => {
  try {
    const [pending, published, draftExamCount, activeExamCount] = await Promise.all([
      prisma.approvalItem.count({ where: { type: 'result_publication', status: 'pending' } }),
      prisma.approvalItem.count({ where: { type: 'result_publication', status: 'published' } }),
      prisma.examProgress.count({ where: { status: { in: ['scheduling', 'ongoing', 'mark_entry', 'moderation'] } } }),
      prisma.examProgress.count({ where: { status: { in: ['ongoing', 'mark_entry', 'moderation'] } } }),
    ]);

    const latestSubmissions = await prisma.approvalItem.findMany({
      where: { type: 'result_publication' },
      orderBy: { requestedAt: 'desc' },
      take: 5
    });

    const departmentIds = latestSubmissions
      .map((item: any) => String(item.details || ''))
      .filter(Boolean);
    const departments = departmentIds.length > 0
      ? await prisma.department.findMany({ where: { id: { in: departmentIds } } })
      : [];
    const requestUserIds = latestSubmissions
      .map((item: any) => String(item.requestedBy || ''))
      .filter(Boolean);
    const requestUsers = requestUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: requestUserIds } } })
      : [];
    const departmentById = new Map(departments.map((dept: any) => [dept.id, dept.name]));
    const userById = new Map(requestUsers.map((user: any) => [user.id, user.name]));

    res.json({
      success: true,
      data: {
        stats: [
          { label: 'Pending Dean Approval', value: String(pending), icon: 'Clock' },
          { label: 'Published Results', value: String(published), icon: 'CheckCircle' },
          { label: 'Active Exam Cycles', value: String(activeExamCount), icon: 'ClipboardList' },
          { label: 'Exam Pipelines', value: String(draftExamCount), icon: 'BarChart3' },
        ]
        ,
        latestSubmissions: latestSubmissions.map((item: any) => ({
          id: item.id,
          departmentId: item.details,
          department: departmentById.get(String(item.details || '')) || 'Unknown Department',
          status: item.status,
          requestedAt: item.requestedAt,
          requestedBy: item.requestedBy,
          requestedByName: userById.get(String(item.requestedBy || '')) || item.requestedBy
        }))
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/submissions', authenticate, async (_req: Request, res: Response) => {
  try {
    const submissions = await prisma.approvalItem.findMany({
      where: { type: 'result_publication' },
      orderBy: { requestedAt: 'desc' },
    });

    const departmentIds = submissions
      .map((item: any) => String(item.details || ''))
      .filter(Boolean);
    const departments = departmentIds.length > 0
      ? await prisma.department.findMany({ where: { id: { in: departmentIds } } })
      : [];
    const requestUserIds = submissions
      .map((item: any) => String(item.requestedBy || ''))
      .filter(Boolean);
    const requestUsers = requestUserIds.length > 0
      ? await prisma.user.findMany({ where: { id: { in: requestUserIds } } })
      : [];
    const departmentById = new Map(departments.map((dept: any) => [dept.id, dept.name]));
    const userById = new Map(requestUsers.map((user: any) => [user.id, user.name]));

    res.json({
      success: true,
      data: submissions.map((item: any) => ({
        id: item.id,
        departmentId: item.details,
        department: departmentById.get(String(item.details || '')) || 'Unknown Department',
        status: item.status,
        requestedAt: item.requestedAt,
        requestedBy: item.requestedBy,
        requestedByName: userById.get(String(item.requestedBy || '')) || item.requestedBy,
        title: item.title,
        priority: item.priority
      }))
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/results', authenticate, async (_req: Request, res: Response) => {
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

router.post('/results/:id/submit', authenticate, async (req: Request, res: Response) => {
  try {
    const identifier = decodeURIComponent(String(req.params.id));
    const userId = String((req as any).user.id);

    const department = await prisma.department.findFirst({
      where: { OR: [{ id: identifier }, { name: identifier }] }
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
          data: {
            status: 'pending',
            title: `Result publication request - ${department.name}`,
            requestedBy: userId,
            requestedAt: new Date(),
            priority: existing.priority || 'medium'
          }
        })
      : await prisma.approvalItem.create({
          data: {
            type: 'result_publication',
            title: `Result publication request - ${department.name}`,
            details: String(department.id),
            requestedBy: userId,
            priority: 'medium',
            status: 'pending'
          }
        });

    res.json({
      success: true,
      data: {
        approvalId: saved.id,
        departmentId: department.id,
        department: department.name,
        status: 'pending_approval'
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
