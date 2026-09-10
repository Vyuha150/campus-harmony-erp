import type { Request, Response } from 'express';import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { randomBytes, createHash } from 'node:crypto';
// Authentication runs BEFORE tenant context exists — it is the step that
// determines which tenant the caller belongs to. It therefore uses the
// unscoped client deliberately. `email` is globally unique (ADR-0001), so a
// login lookup resolves to exactly one account across all institutions.
import { basePrisma as prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendError } from '../lib/errors.js';
import { config } from '../config/env.js';
import { config as notificationConfig } from '../lib/config-notifications.js';
import { loginRateLimiter, passwordResetRateLimiter } from '../middleware/rateLimit.js';
import { validate } from '../middleware/validate.js';
import { loginSchema, forgotPasswordSchema, resetPasswordSchema } from '../modules/auth/auth.schemas.js';
import { hashPassword } from '../lib/password.js';
import { providerFor } from '../modules/notifications/providers.js';
import { record } from '../lib/audit.js';
import { logger } from '../lib/logger.js';

const router = Router();
const JWT_SECRET = config.auth.jwtSecret;

/** One hour — long enough to find the email, short enough to bound a leaked link's window. */
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000;

function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

// Basic Login Route
router.post('/login', loginRateLimiter, validate({ body: loginSchema }), async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      res.status(401).json({ success: false, message: 'Invalid credentials' });
      return;
    }

    if (role && user.role !== role) {
      res.status(403).json({ success: false, message: 'Selected role does not match account role' });
      return;
    }

    const token = jwt.sign(
      { userId: user.id, role: user.role },
      JWT_SECRET,
      { expiresIn: config.auth.jwtExpiresIn } as jwt.SignOptions
    );
    
    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

router.get('/me', authenticate, async (req: Request, res: Response): Promise<void> => {
  try {
    const userId = (req as any).user.id;
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }

    res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        avatar: user.avatar,
        department: user.departmentId,
        designation: user.designation,
        campus: user.campus
      }
    });
  } catch (error: any) {
    sendError(res, error);
  }
});

/**
 * POST /auth/forgot-password.
 *
 * Always returns the same generic response whether or not the email matches
 * an account — a different response would let an attacker enumerate every
 * registered email address on the system, one guess at a time.
 */
router.post(
  '/forgot-password',
  passwordResetRateLimiter,
  validate({ body: forgotPasswordSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { email } = req.body;
      const user = await prisma.user.findUnique({ where: { email } });

      if (user && !user.deletedAt) {
        const rawToken = randomBytes(32).toString('hex');

        // Any earlier outstanding token for this account is superseded —
        // at most one live reset link should ever exist at a time.
        await prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() }
        });

        await prisma.passwordResetToken.create({
          data: {
            userId: user.id,
            tokenHash: hashToken(rawToken),
            expiresAt: new Date(Date.now() + RESET_TOKEN_TTL_MS),
            requestIp: req.ip ?? null
          }
        });

        const resetLink = `${notificationConfig.notifications.appUrl}/reset-password?token=${rawToken}`;

        try {
          await providerFor('email').send({
            to: user.email,
            recipientName: user.name,
            subject: 'Reset your Campus Harmony ERP password',
            body:
              `Hello ${user.name},\n\n` +
              `A password reset was requested for your account. This link expires in 1 hour ` +
              `and can only be used once:\n\n${resetLink}\n\n` +
              `If you did not request this, no action is needed — your password has not changed.`
          });
        } catch (error) {
          // The token exists either way; only DELIVERY failed. Logged loudly
          // because the account holder has no way to know their link never
          // arrived, but the response stays generic regardless (see above).
          logger.error('Password reset email failed to send', {
            module: 'auth',
            operation: 'forgot-password',
            error: (error as Error).message
          });
        }

        await record({
          userId: user.id,
          userName: user.name,
          role: user.role,
          action: 'PASSWORD_RESET',
          module: 'auth',
          resource: `User:${user.id}`,
          details: 'Password reset requested',
          ipAddress: req.ip ?? '0.0.0.0'
        });
      }

      res.json({
        success: true,
        message: 'If an account exists for that email, a password reset link has been sent.'
      });
    } catch (error: any) {
      sendError(res, error);
    }
  }
);

/** POST /auth/reset-password. */
router.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const { token, newPassword } = req.body;
      const tokenHash = hashToken(token);

      const resetToken = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });

      if (
        !resetToken ||
        resetToken.usedAt !== null ||
        resetToken.expiresAt.getTime() < Date.now()
      ) {
        res.status(400).json({
          success: false,
          message: 'This reset link is invalid or has expired. Request a new one.'
        });
        return;
      }

      const user = await prisma.user.findUnique({ where: { id: resetToken.userId } });
      if (!user || user.deletedAt) {
        res.status(400).json({
          success: false,
          message: 'This reset link is invalid or has expired. Request a new one.'
        });
        return;
      }

      const hashedPassword = await hashPassword(newPassword);

      // Consuming the token and changing the password happen together: a
      // token must never be left valid after its one use, even if the
      // process were to fail between the two writes.
      //
      // EVERY outstanding token for the account is invalidated, not just the
      // one presented. Once the password has changed, any other live link —
      // however it came to exist — is a second, unnecessary way into the
      // account that its owner does not know about.
      await prisma.$transaction([
        prisma.user.update({ where: { id: user.id }, data: { password: hashedPassword } }),
        prisma.passwordResetToken.updateMany({
          where: { userId: user.id, usedAt: null },
          data: { usedAt: new Date() }
        })
      ]);

      await record({
        userId: user.id,
        userName: user.name,
        role: user.role,
        action: 'PASSWORD_RESET',
        module: 'auth',
        resource: `User:${user.id}`,
        details: 'Password reset completed via emailed link',
        ipAddress: req.ip ?? '0.0.0.0'
      });

      res.json({ success: true, message: 'Password has been reset. You can now log in.' });
    } catch (error: any) {
      sendError(res, error);
    }
  }
);

export default router;
