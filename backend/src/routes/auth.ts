import type { Request, Response } from 'express';import { Router } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
// Authentication runs BEFORE tenant context exists — it is the step that
// determines which tenant the caller belongs to. It therefore uses the
// unscoped client deliberately. `email` is globally unique (ADR-0001), so a
// login lookup resolves to exactly one account across all institutions.
import { basePrisma as prisma } from '../lib/prisma.js';
import { authenticate } from '../middleware/auth.js';
import { sendError } from '../lib/errors.js';
import { config } from '../config/env.js';
import { loginRateLimiter } from '../middleware/rateLimit.js';

const router = Router();
const JWT_SECRET = config.auth.jwtSecret;

// Basic Login Route
router.post('/login', loginRateLimiter, async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password, role } = req.body;

    if (!email || !password) {
      res.status(400).json({ success: false, message: 'Email and password are required' });
      return;
    }

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

export default router;
