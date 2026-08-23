import express, { type Request, type Response } from 'express';
import cors from 'cors';
import fs from 'node:fs';
import path from 'node:path';
// Config is imported FIRST so that invalid configuration aborts startup before
// any route, database connection or listener is created.
import { config } from './config/env.js';
import { logger } from './lib/logger.js';
import {
  requestContext,
  requestLogger,
  errorHandler,
  notFoundHandler
} from './middleware/errorHandler.js';
import { apiRateLimiter } from './middleware/rateLimit.js';
import { securityHeaders } from './middleware/securityHeaders.js';
import { authenticate, authorizeRoles } from './middleware/auth.js';
import {
  resolveTenantContext,
  rejectClientTenantOverride
} from './middleware/tenantContext.js';
import { enforceReadOnly } from './middleware/readOnly.js';
import { basePrisma } from './lib/prisma.js';
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
import libraryRoutes from './modules/library/library.routes.js';
import admissionsRoutes from './modules/admissions/admissions.routes.js';
import resultsRoutes from './modules/results/results.routes.js';
import curriculumRoutes from './modules/curriculum/curriculum.routes.js';
import examinationRoutes from './modules/examination/examination.routes.js';
import notificationRoutes from './modules/notifications/notifications.routes.js';
import reportingRoutes from './modules/reporting/reporting.routes.js';
import financeModuleRoutes from './modules/finance/finance.routes.js';
import importRoutes from './modules/import/import.routes.js';
import obeRoutes from './modules/obe/obe.routes.js';
import workflowRoutes from './modules/workflow/workflow.routes.js';

const app = express();
const uploadsRoot = path.resolve(process.cwd(), config.uploads.directory);
fs.mkdirSync(uploadsRoot, { recursive: true });

// Trust the reverse proxy so req.ip reflects the real client address — without
// this, rate limiting would key every request behind a proxy to the same bucket.
app.set('trust proxy', 1);

// ─── Middleware (order matters) ───────────────────────────────────────────────
app.use(requestContext); // correlation ID first, so every later log carries it
app.use(securityHeaders);
app.use(
  cors({
    origin: config.cors.origins, // configurable; was hardcoded to localhost:8080
    credentials: true
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(requestLogger);
app.use('/api', apiRateLimiter);

// REMOVED: app.use('/uploads', express.static(uploadsRoot))
//
// This served EVERY uploaded file publicly, with no authentication, because it
// was mounted before the auth middleware below. Grievance evidence (including
// anonymous submissions), vigilance files and documents flagged isConfidential
// were downloadable by anyone with the URL.
//
// Downloads are now served by the authenticated route at /api/uploads.

// ─── Health & readiness ───────────────────────────────────────────────────────

/** Liveness: process is up. Does not touch the database. */
app.get('/api/health', (_req: Request, res: Response) => {
  res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

/**
 * Readiness: can this instance actually serve traffic?
 *
 * The previous single `/api/health` returned a static 'healthy' without
 * checking anything, so a process with a dead database reported healthy and an
 * orchestrator would keep routing traffic to it.
 */
app.get('/api/ready', async (_req: Request, res: Response) => {
  try {
    await basePrisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ready', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    logger.error('Readiness check failed', {
      error: error instanceof Error ? error.message : String(error)
    });
    res.status(503).json({ status: 'not_ready', database: 'disconnected' });
  }
});

app.use('/api/auth', authRoutes);

// ─── Tenant-scoped routes (ADR-0001) ──────────────────────────────────────────
//
// Middleware order is security-critical:
//
//   authenticate            → who is this?
//   rejectClientTenantOverride → refuse any client-supplied tenant id
//   resolveTenantContext    → derive institution + campus from the DATABASE
//   authorizeRoles          → is this role permitted on this module?
//
// `resolveTenantContext` must precede the route handlers so `getTenantContext`
// always succeeds; it throws rather than silently returning an unscoped query
// if a route is ever mounted without it.
const tenantScoped = [
  authenticate,
  rejectClientTenantOverride,
  resolveTenantContext,
  enforceReadOnly
];

/**
 * Roles permitted on modules that expose institution-wide oversight.
 * `auditor` is read-only (enforced by `enforceReadOnly`), so granting it broad
 * visibility does not grant it any write capability.
 */
const OVERSIGHT = ['auditor'] as const;

app.use('/api/students', ...tenantScoped, authorizeRoles('student', 'super_admin'), studentRoutes);
app.use('/api/faculty', ...tenantScoped, authorizeRoles('faculty', 'super_admin'), facultyRoutes);
// Finance module (EPIC-08) — payments and receipts written in one transaction,
// idempotent. Mounted BEFORE the legacy finance router: paths it does not
// handle fall through to the legacy one below.
//
// The order matters. The legacy mount carries a blanket `finance_officer` gate,
// which would reject an accountant before the request ever reached this router.
// This module does its own role checks because they depend on the path — a
// student may read their OWN ledger, which a blanket gate cannot express.
app.use('/api/finance', ...tenantScoped, financeModuleRoutes);

app.use('/api/finance', ...tenantScoped, authorizeRoles('finance_officer', 'principal', 'super_admin', ...OVERSIGHT), financeRoutes);
app.use('/api/admin', ...tenantScoped, authorizeRoles('super_admin'), adminRoutes);

app.use('/api/hod', ...tenantScoped, authorizeRoles('hod', 'principal', 'super_admin', ...OVERSIGHT), hodRoutes);
app.use('/api/dean', ...tenantScoped, authorizeRoles('dean', 'principal', 'super_admin', ...OVERSIGHT), deanRoutes);
app.use('/api/vc', ...tenantScoped, authorizeRoles('vice_chancellor', 'pro_vc', 'super_admin', ...OVERSIGHT), vcRoutes);
app.use('/api/registrar', ...tenantScoped, authorizeRoles('registrar', 'principal', 'super_admin', ...OVERSIGHT), registrarRoutes);
app.use('/api/coe', ...tenantScoped, authorizeRoles('coe', 'super_admin', ...OVERSIGHT), coeRoutes);
app.use('/api/alumni', ...tenantScoped, authorizeRoles('alumni_officer', 'super_admin'), alumniRoutes);
app.use('/api/iqac', ...tenantScoped, authorizeRoles('iqac_coordinator', 'super_admin', ...OVERSIGHT), iqacRoutes);
app.use('/api/placements', ...tenantScoped, authorizeRoles('placement_officer', 'super_admin'), placementsRoutes);
app.use('/api/sports', ...tenantScoped, authorizeRoles('sports_director', 'super_admin'), sportsRoutes);
app.use('/api/grievances', ...tenantScoped, authorizeRoles('grievance_officer', 'super_admin'), grievanceRoutes);
app.use('/api/security', ...tenantScoped, authorizeRoles('security_officer', 'super_admin'), securityRoutes);
// Library (T-203b) — the reference migration to the service-layer pattern.
// Replaces the 298-line `routes/library.ts`, which had no tenant scoping, no
// transactions, no audit, no pagination and accepted fines from the client.
// Role checks live in the module: a student may read their own borrowing
// history, which a blanket `librarian` gate could not express.
app.use('/api/library', ...tenantScoped, libraryRoutes);
// Admissions (EPIC-05) — reference implementation of the service-layer
// architecture. Role checks live inside the module because admissions spans
// several offices (registrar, principal, dean).
app.use('/api/admissions', ...tenantScoped, admissionsRoutes);

// Academic results (T-403) — SGPA/CGPA computed from real grades.
app.use('/api/results', ...tenantScoped, resultsRoutes);

// Curriculum & course registration — prerequisites and credit limits enforced.
app.use('/api/curriculum', ...tenantScoped, curriculumRoutes);

// Examination lifecycle — eligibility (attendance + fees) enforced.
app.use('/api/examinations', ...tenantScoped, examinationRoutes);

// Notification engine — messages are now actually delivered and tracked.
app.use('/api/notifications', ...tenantScoped, notificationRoutes);

// Reporting — figures derived from operational records, with provenance.
app.use('/api/reports', ...tenantScoped, reportingRoutes);

// Bulk import — validate the whole file, then write it in one transaction.
// Without this an institution cannot onboard its existing records at all.
app.use('/api/import', ...tenantScoped, importRoutes);

// OBE attainment — CO/PO computed from outcome-wise marks, never inferred from
// course totals. Role checks are inside the module: faculty enter marks, but
// only the HOD/CoE/IQAC may publish, since publishing moves an
// accreditation-facing figure.
app.use('/api/obe', ...tenantScoped, obeRoutes);

// Workflow engine (Phase 2). Role checks live INSIDE the module: who may act
// depends on the step an instance is currently at, which middleware cannot see.
app.use('/api/workflow', ...tenantScoped, workflowRoutes);

app.use('/api/uploads', ...tenantScoped, uploadRoutes);

// ─── Error handling (must be registered last) ─────────────────────────────────
//
// Replaces the previous handler, which logged a raw stack to the console and
// returned `err.message` to the client — leaking Prisma model names, field
// names and constraint details, and collapsing every failure into a 500 so
// clients could not distinguish 404 from 409 from a genuine server fault.
app.use(notFoundHandler);
app.use(errorHandler);

const PORT = config.port;

let server: ReturnType<typeof app.listen> | null = null;

async function startServer() {
  try {
    await basePrisma.$connect();
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

  await basePrisma.$disconnect();
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
