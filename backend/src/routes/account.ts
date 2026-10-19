/**
 * The signed-in user's own account: profile, password and support tickets.
 *
 * WHY THIS EXISTS
 *
 * Every role's header menu offered "Profile Settings" and "Help & Support", and
 * neither did anything. There was also nothing behind them to call: no way for
 * a signed-in user to change their own password (only the emailed reset link),
 * and support tickets could be created only through the Security Officer's
 * routes — so a student or faculty member had no way to report a problem.
 *
 * Everything here acts on the caller's own record only. No id is taken from the
 * client for the account itself; it comes from the authenticated token.
 */

import * as payroll from '../modules/finance/payrollService.js';
import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { prisma } from '../lib/prisma.js';
import { sendError, ValidationError, NotFoundError } from '../lib/errors.js';
import { validate } from '../middleware/validate.js';
import { getTenantContext } from '../lib/tenant.js';
import { hashPassword, validatePassword, verifyPassword } from '../lib/password.js';
import { logger } from '../lib/logger.js';

const router = Router();

/** The caller's profile, with the role-specific record that goes with it. */
router.get('/profile', async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const user = await prisma.user.findFirst({
      where: { id: context.userId },
      select: {
        id: true, name: true, email: true, role: true, designation: true, campus: true, createdAt: true,
        department: { select: { name: true, code: true } },
        institution: { select: { name: true } },
        studentProfile: { select: { rollNumber: true, program: true, branch: true, semester: true, section: true, batch: true } },
        facultyProfile: { select: { employeeId: true, qualification: true, specialization: true, experience: true } }
      }
    });
    if (!user) throw new NotFoundError('Your account');
    res.json({ success: true, data: user });
  } catch (error) {
    sendError(res, error);
  }
});

const profileUpdateSchema = z
  .object({
    // Only the display name. Email, role and department are institutional
    // records, changed by an administrator — not by the account holder.
    name: z.string().trim().min(2, 'Name must be at least 2 characters.').max(120)
  })
  .strict();

router.put('/profile', validate({ body: profileUpdateSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const { name } = req.body as z.infer<typeof profileUpdateSchema>;
    const updated = await prisma.user.update({
      where: { id: context.userId },
      data: { name },
      select: { id: true, name: true }
    });
    res.json({ success: true, message: 'Profile updated.', data: updated });
  } catch (error) {
    sendError(res, error);
  }
});

const passwordChangeSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password.').max(200),
    newPassword: z.string().min(1).max(200)
  })
  .strict();

router.post('/password', validate({ body: passwordChangeSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const { currentPassword, newPassword } = req.body as z.infer<typeof passwordChangeSchema>;

    const user = await prisma.user.findFirst({ where: { id: context.userId }, select: { id: true, password: true } });
    if (!user) throw new NotFoundError('Your account');

    // The current password is required even with a valid session: a session
    // left open on a shared computer must not be enough to take the account.
    if (!(await verifyPassword(currentPassword, user.password))) {
      throw new ValidationError('Your current password is incorrect.', { field: 'currentPassword' });
    }
    if (currentPassword === newPassword) {
      throw new ValidationError('The new password must be different from the current one.', { field: 'newPassword' });
    }
    const policy = validatePassword(newPassword);
    if (!policy.valid) {
      throw new ValidationError(policy.errors.join(' '), { field: 'newPassword' });
    }

    await prisma.user.update({ where: { id: user.id }, data: { password: await hashPassword(newPassword) } });
    logger.info('Password changed by account holder', { module: 'account', userId: user.id });
    res.json({ success: true, message: 'Password changed.' });
  } catch (error) {
    sendError(res, error);
  }
});

/** Tickets the caller raised, newest first. */
router.get('/support-tickets', async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const tickets = await prisma.supportTicket.findMany({
      where: { reportedBy: context.userId },
      orderBy: { createdDate: 'desc' },
      take: 100
    });
    res.json({ success: true, data: tickets });
  } catch (error) {
    sendError(res, error);
  }
});

const TICKET_CATEGORIES = ['login_access', 'technical', 'data_correction', 'academic', 'fees', 'other'] as const;

const ticketCreateSchema = z
  .object({
    category: z.enum(TICKET_CATEGORIES),
    priority: z.enum(['low', 'medium', 'high']).optional(),
    subject: z.string().trim().min(5, 'Give a short subject (at least 5 characters).').max(160),
    description: z.string().trim().min(10, 'Describe the problem (at least 10 characters).').max(4000)
  })
  .strict();

router.post('/support-tickets', validate({ body: ticketCreateSchema }), async (req: Request, res: Response) => {
  try {
    const context = getTenantContext(req);
    const body = req.body as z.infer<typeof ticketCreateSchema>;
    const me = await prisma.user.findFirst({ where: { id: context.userId }, select: { email: true } });

    // Ticket numbers are global and unique; retry on the rare collision.
    for (let attempt = 0; attempt < 5; attempt++) {
      const count = await prisma.supportTicket.count();
      const ticketNumber = `TKT-${String(count + 1 + attempt).padStart(5, '0')}`;
      try {
        const ticket = await prisma.supportTicket.create({
          data: {
            institutionId: context.institutionId,
            ticketNumber,
            reportedBy: context.userId,
            reporterType: context.role,
            contactInfo: me?.email ?? '',
            category: body.category,
            priority: body.priority ?? 'medium',
            subject: body.subject,
            description: body.description,
            status: 'open'
          }
        });
        res.status(201).json({ success: true, message: `Ticket ${ticket.ticketNumber} raised.`, data: ticket });
        return;
      } catch (error) {
        if ((error as { code?: string }).code !== 'P2002') throw error;
      }
    }
    throw new Error('Could not allocate a ticket number. Please try again.');
  } catch (error) {
    sendError(res, error);
  }
});


// ─── My payslips (any staff member) ───
router.get('/payslips', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    res.json({ success: true, data: await payroll.myPayslips(ctx, ctx.userId) });
  } catch (error: any) {
    sendError(res, error);
  }
});
router.get('/payslips/:id', async (req: Request, res: Response) => {
  try {
    const ctx = getTenantContext(req);
    res.json({ success: true, data: await payroll.payslip(ctx, String(req.params.id), ctx.userId) });
  } catch (error: any) {
    sendError(res, error);
  }
});

export default router;
