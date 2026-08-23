/**
 * Bulk import routes.
 *
 * The file arrives as a JSON string field rather than multipart. That is
 * deliberate: the existing upload pipeline stores files for later retrieval,
 * which is the wrong model here — an import file is consumed once, and keeping
 * a copy of a student roll on disk creates a second place personal data lives
 * with no lifecycle attached to it.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { authorizeRoles } from '../../middleware/auth.js';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId } from '../../schemas/common.js';
import { getTenantContext } from '../../lib/tenant.js';
import * as service from './import.service.js';
import { IMPORTERS } from './importers.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

/**
 * Who may import.
 *
 * Narrow by design: an import creates user accounts in bulk, which is the
 * highest-privilege operation in the system short of role assignment.
 */
const IMPORT_STAFF = authorizeRoles('super_admin', 'registrar');

/** Roles permitted to READ past jobs, including the compliance auditor. */
const IMPORT_READ = authorizeRoles('super_admin', 'registrar', 'principal', 'auditor');

/**
 * ~8MB of CSV text. Above this the request body limit applies anyway; stated
 * explicitly so the failure is a clear message rather than a truncated body.
 */
const MAX_CONTENT_CHARS = 8_000_000;

const entityTypes = Object.keys(IMPORTERS) as [string, ...string[]];

/** Available importers, with their columns and constraints. */
router.get(
  '/types',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: Object.values(IMPORTERS).map((importer) => ({
        entityType: importer.entityType,
        label: importer.label,
        guidance: importer.guidance,
        columns: importer.columns,
        limits: {
          maxRows: service.MAX_ROWS,
          maxErrorsReported: service.MAX_RECORDED_ERRORS
        }
      }))
    });
  })
);

/** A CSV template for one entity type. */
router.get(
  '/templates/:entityType',
  validate({ params: z.object({ entityType: z.enum(entityTypes) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const template = service.buildTemplate(pathParam(req, 'entityType'));

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${template.fileName}"`);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    // BOM so Excel opens it as UTF-8 — without it, names with diacritics are
    // mangled on a default Windows install.
    res.send('﻿' + template.content);
  })
);

/** Guidance for a type, as JSON (the template endpoint returns a file). */
router.get(
  '/templates/:entityType/guidance',
  validate({ params: z.object({ entityType: z.enum(entityTypes) }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const template = service.buildTemplate(pathParam(req, 'entityType'));
    res.json({ success: true, data: { fileName: template.fileName, guidance: template.guidance } });
  })
);

const importSchema = z
  .object({
    entityType: z.enum(entityTypes),
    fileName: z.string().trim().min(1).max(255),
    content: z.string().min(1).max(MAX_CONTENT_CHARS),
    /**
     * Defaults to TRUE.
     *
     * An operator who omits the flag gets a preview, not a write. The safe
     * outcome is the one that happens by accident.
     */
    dryRun: z.boolean().optional().default(true)
  })
  .strict();

router.post(
  '/',
  IMPORT_STAFF,
  validate({ body: importSchema }),
  asyncHandler(async (req: Request, res: Response) => {
    const body = req.body as z.infer<typeof importSchema>;
    const ctx = getTenantContext(req);

    const outcome = await service.runImport(ctx, {
      entityType: body.entityType,
      fileName: body.fileName,
      content: body.content,
      dryRun: body.dryRun
    });

    // 422 when rows were rejected: the request was well-formed but its content
    // could not be processed. 200 for a clean dry run, 201 when rows were
    // actually created.
    const status = outcome.status === 'failed' ? 422 : outcome.dryRun ? 200 : 201;

    res.status(status).json({
      success: outcome.status !== 'failed',
      message: buildMessage(outcome),
      data: outcome
    });
  })
);

function buildMessage(outcome: service.ImportOutcome): string {
  if (outcome.status === 'failed') {
    return (
      outcome.failureReason ??
      `${outcome.errorRows} of ${outcome.totalRows} row(s) failed validation. Nothing was imported.`
    );
  }
  if (outcome.dryRun) {
    return `Dry run: all ${outcome.totalRows} row(s) are valid. Nothing was written.`;
  }
  return `Imported ${outcome.importedRows} ${outcome.entityType} record(s).`;
}

/** Past jobs. */
router.get(
  '/jobs',
  IMPORT_READ,
  validate({
    query: z.object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(100).default(25)
    })
  }),
  asyncHandler(async (req: Request, res: Response) => {
    const q = req.query as unknown as { page: number; pageSize: number };
    const result = await service.listJobs(getTenantContext(req), q);
    res.json({ success: true, ...result });
  })
);

/** One job with its full error report. */
router.get(
  '/jobs/:jobId',
  IMPORT_READ,
  validate({ params: z.object({ jobId: entityId }) }),
  asyncHandler(async (req: Request, res: Response) => {
    const job = await service.getJob(getTenantContext(req), pathParam(req, 'jobId'));
    res.json({ success: true, data: job });
  })
);

export default router;
