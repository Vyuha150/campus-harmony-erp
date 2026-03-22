import type { Request, Response } from 'express';
import { Router } from 'express';
import { prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';

const router = Router();

// ─── Dashboard ───
router.get('/dashboard', authenticate, async (req: Request, res: Response) => {
  try {
    const teamsCount = await prisma.sportsTeam.count();
    const facilitiesCount = await prisma.sportsFacility.count({ where: { status: 'available' } });
    const athleteCount = await prisma.sportsAthlete.count({ where: { status: 'active' } });
    const upcomingEvents = await prisma.sportsEvent.count({ where: { status: { in: ['planning', 'upcoming'] } } });

    res.json({
      success: true,
      data: {
        stats: [
          { label: "Active Teams", value: teamsCount.toString(), icon: "Users" },
          { label: "Available Facilities", value: facilitiesCount.toString(), icon: "Map", color: "text-blue-500" },
          { label: "Registered Athletes", value: athleteCount.toString(), icon: "Trophy", color: "text-success" },
          { label: "Upcoming Events", value: upcomingEvents.toString(), icon: "Calendar", color: "text-warning" }
        ]
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Athletes ───
router.get('/athletes', authenticate, async (req: Request, res: Response) => {
  try {
    const athletes = await prisma.sportsAthlete.findMany();
    res.json({ success: true, data: athletes });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/athletes', authenticate, async (req: Request, res: Response) => {
  try {
    const athlete = await prisma.sportsAthlete.create({ data: req.body });
    res.json({ success: true, data: athlete });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/athletes/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.sportsAthlete.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/athletes/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const deleted = await prisma.sportsAthlete.delete({ where: { id } });
    res.json({ success: true, data: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Teams ───
router.get('/teams', authenticate, async (req: Request, res: Response) => {
  try {
    const teams = await prisma.sportsTeam.findMany();
    res.json({ success: true, data: teams });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/teams', authenticate, async (req: Request, res: Response) => {
  try {
    const team = await prisma.sportsTeam.create({ data: req.body });
    res.json({ success: true, data: team });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/teams/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.sportsTeam.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/teams/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const deleted = await prisma.sportsTeam.delete({ where: { id } });
    res.json({ success: true, data: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Attendance ───
router.get('/attendance', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { teamId } = query;
    const where: any = {};
    if (teamId) where.teamId = teamId;
    const records = await prisma.sportsAttendance.findMany({ where, orderBy: { date: 'desc' }, take: 50 });
    res.json({ success: true, data: records });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/attendance', authenticate, async (req: Request, res: Response) => {
  try {
    const record = await prisma.sportsAttendance.create({ data: req.body });
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/attendance/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.sportsAttendance.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/attendance/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const deleted = await prisma.sportsAttendance.delete({ where: { id } });
    res.json({ success: true, data: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Facilities ───
router.get('/facilities', authenticate, async (req: Request, res: Response) => {
  try {
    const facilities = await prisma.sportsFacility.findMany();
    res.json({ success: true, data: facilities });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/facilities/:id/book', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.sportsFacility.update({ where: { id }, data: { status: 'booked' } });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/facilities/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.sportsFacility.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/facilities/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const deleted = await prisma.sportsFacility.delete({ where: { id } });
    res.json({ success: true, data: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Inventory ───
router.get('/inventory', authenticate, async (req: Request, res: Response) => {
  try {
    const items = await prisma.sportsInventoryItem.findMany();
    res.json({ success: true, data: items });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/inventory', authenticate, async (req: Request, res: Response) => {
  try {
    const item = await prisma.sportsInventoryItem.create({ data: req.body });
    res.json({ success: true, data: item });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/inventory/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const updated = await prisma.sportsInventoryItem.update({ where: { id }, data: req.body });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/inventory/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const deleted = await prisma.sportsInventoryItem.delete({ where: { id } });
    res.json({ success: true, data: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Events ───
router.get('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const events = await prisma.sportsEvent.findMany({ orderBy: { startDate: 'desc' } });
    res.json({ success: true, data: events });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/events', authenticate, async (req: Request, res: Response) => {
  try {
    const event = await prisma.sportsEvent.create({
      data: { ...req.body, startDate: new Date(req.body.startDate), endDate: new Date(req.body.endDate) }
    });
    res.json({ success: true, data: event });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/events/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const data = {
      ...req.body,
      ...(req.body.startDate ? { startDate: new Date(req.body.startDate) } : {}),
      ...(req.body.endDate ? { endDate: new Date(req.body.endDate) } : {})
    };
    const updated = await prisma.sportsEvent.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/events/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const deleted = await prisma.sportsEvent.delete({ where: { id } });
    res.json({ success: true, data: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.get('/events/:id/results', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const event = await prisma.sportsEvent.findUnique({ where: { id } });
    res.json({ success: true, data: { event, results: event?.results } });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// ─── Health & Fitness ───
router.get('/health', authenticate, async (req: Request, res: Response) => {
  try {
    const query = req.query as Record<string, string | undefined>;
    const { studentId } = query;
    const where: any = {};
    if (studentId) where.studentId = studentId;
    const records = await prisma.fitnessRecord.findMany({ where, orderBy: { testDate: 'desc' } });
    res.json({ success: true, data: records });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.post('/health/fitness-test', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user.id;
    const record = await prisma.fitnessRecord.create({
      data: { ...req.body, conductedBy: userId, testDate: new Date(req.body.testDate || Date.now()) }
    });
    res.json({ success: true, data: record });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.put('/health/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const data = {
      ...req.body,
      ...(req.body.testDate ? { testDate: new Date(req.body.testDate) } : {}),
      ...(req.body.nextTestDate ? { nextTestDate: new Date(req.body.nextTestDate) } : {})
    };
    const updated = await prisma.fitnessRecord.update({ where: { id }, data });
    res.json({ success: true, data: updated });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

router.delete('/health/:id', authenticate, async (req: Request, res: Response) => {
  try {
    const id = String(req.params.id);
    const deleted = await prisma.fitnessRecord.delete({ where: { id } });
    res.json({ success: true, data: deleted });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;
