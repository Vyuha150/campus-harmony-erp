import type { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

export interface AuthenticatedRequest extends Request {
  user?: {
    id: string;
    role: string;
  };
}

export const authenticate = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ success: false, message: 'No token provided' });
      return;
    }

    const token = authHeader.split(' ')[1];
    if (!token) {
      res.status(401).json({ success: false, message: 'Malformed token' });
      return;
    }
    const secretKey: string = JWT_SECRET as string;
    const decoded = jwt.verify(token, secretKey) as unknown as { userId: string, role: string };
    
    // Attach user information to request
    (req as AuthenticatedRequest).user = {
      id: decoded.userId,
      role: decoded.role
    };

    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }
};

export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = (req as AuthenticatedRequest).user?.role;
    if (!userRole) {
      res.status(401).json({ success: false, message: 'Authentication required' });
      return;
    }

    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({ success: false, message: 'Access denied for this role' });
      return;
    }

    next();
  };
};
