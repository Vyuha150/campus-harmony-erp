import express, { type Request, type Response } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fs from 'node:fs';
import path from 'node:path';
import { authenticate, authorizeRoles } from './middleware/auth.js';
import { prisma } from './lib/prisma.js';
import authRoutes from './routes/auth.js';
import studentRoutes from './routes/students.js';
import facultyRoutes from './routes/faculty.js';
import financeRoutes from './routes/finance.js';
import adminRoutes from './routes/admin.js';
import hodRoutes from './routes/hod.js';
import deanRoutes from './routes/dean.js';
import vcRoutes from './routes/vc.js';
import registrarRoutes from './routes/registrar.js';
import alumniRoutes from './routes/alumni.js';
import iqacRoutes from './routes/iqac.js';
import placementsRoutes from './routes/placements.js';
import sportsRoutes from './routes/sports.js';
import grievanceRoutes from './routes/grievances.js';
import securityRoutes from './routes/security.js';
import uploadRoutes from './routes/uploads.js';
import coeRoutes from './routes/coe.js';
import libraryRoutes from './routes/library.js';

dotenv.config();

const app = express();
const uploadsRoot = path.resolve(process.cwd(), 'uploads');
fs.mkdirSync(uploadsRoot, { recursive: true });

// Middlewares
app.use(cors({
  origin: 'http://localhost:8080',
  credentials: true
}));
app.use(express.json());
app.use('/uploads', express.static(uploadsRoot));

// Routes
app.get('/api/health', (req: express.Request, res: express.Response) => {
  res.json({ status: 'healthy', timestamp: new Date() });
});

app.use('/api/auth', authRoutes);
app.use('/api/students', authenticate, authorizeRoles('student', 'librarian', 'super_admin'), studentRoutes);
app.use('/api/faculty', authenticate, authorizeRoles('faculty', 'super_admin'), facultyRoutes);
app.use('/api/finance', authenticate, authorizeRoles('finance_officer', 'super_admin'), financeRoutes);
app.use('/api/admin', authenticate, authorizeRoles('super_admin'), adminRoutes);

app.use('/api/hod', authenticate, authorizeRoles('hod', 'super_admin'), hodRoutes);
app.use('/api/dean', authenticate, authorizeRoles('dean', 'super_admin'), deanRoutes);
app.use('/api/vc', authenticate, authorizeRoles('vice_chancellor', 'pro_vc', 'super_admin'), vcRoutes);
app.use('/api/registrar', authenticate, authorizeRoles('registrar', 'super_admin'), registrarRoutes);
app.use('/api/coe', authenticate, authorizeRoles('coe', 'super_admin'), coeRoutes);
app.use('/api/alumni', authenticate, authorizeRoles('alumni_officer', 'super_admin'), alumniRoutes);
app.use('/api/iqac', authenticate, authorizeRoles('iqac_coordinator', 'super_admin'), iqacRoutes);
app.use('/api/placements', authenticate, authorizeRoles('placement_officer', 'super_admin'), placementsRoutes);
app.use('/api/sports', authenticate, authorizeRoles('sports_director', 'super_admin'), sportsRoutes);
app.use('/api/grievances', authenticate, authorizeRoles('grievance_officer', 'super_admin'), grievanceRoutes);
app.use('/api/security', authenticate, authorizeRoles('security_officer', 'super_admin'), securityRoutes);
app.use('/api/library', authenticate, authorizeRoles('librarian', 'super_admin'), libraryRoutes);
app.use('/api/uploads', authenticate, uploadRoutes);

// Basic generic error handler
app.use((err: any, req: Request, res: Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ error: 'Something went wrong', message: err.message });
});

const PORT = process.env.PORT || 5000;

let server: ReturnType<typeof app.listen> | null = null;

async function startServer() {
  try {
    await prisma.$connect();
    console.log('Prisma connected successfully');

    server = app.listen(PORT, () => {
      console.log(`Campus Harmony ERP Backend is running on port ${PORT}`);
    });
  } catch (error: any) {
    console.error('Failed to connect Prisma:', error?.message || error);
    process.exit(1);
  }
}

async function shutdown(signal: string) {
  console.log(`Received ${signal}. Shutting down gracefully...`);

  if (server) {
    await new Promise<void>((resolve) => {
      server?.close(() => resolve());
    });
  }

  await prisma.$disconnect();
  process.exit(0);
}

process.on('SIGINT', () => {
  shutdown('SIGINT').catch((error) => {
    console.error('Shutdown error:', error);
    process.exit(1);
  });
});

process.on('SIGTERM', () => {
  shutdown('SIGTERM').catch((error) => {
    console.error('Shutdown error:', error);
    process.exit(1);
  });
});

startServer();
