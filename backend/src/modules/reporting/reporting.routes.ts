/**
 * Reporting routes.
 *
 * Every response carries PROVENANCE — the source tables and the formula — so a
 * figure can be defended rather than merely quoted. That is the property the
 * compliance engine will depend on.
 */

import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { validate } from '../../middleware/validate.js';
import { asyncHandler } from '../../middleware/errorHandler.js';
import { entityId, academicYear } from '../../schemas/common.js';
import { getTenantContext } from '../../lib/tenant.js';
import { NotFoundError, ValidationError } from '../../lib/errors.js';
import { recordFromRequest } from '../../lib/audit.js';
import { REPORTS, findReport } from './reports.js';
import { toCsv, exportMeta, UNSUPPORTED_FORMATS, type ExportFormat } from './export.js';

const router = Router();

function pathParam(req: Request, name: string): string {
  const value = req.params[name];
  return Array.isArray(value) ? value[0]! : (value as string);
}

const filterQuery = z.object({
  academicYear: academicYear.optional(),
  departmentId: entityId.optional(),
  programmeId: entityId.optional(),
  semester: z.coerce.number().int().min(1).max(12).optional(),
  format: z.enum(['json', 'csv', 'xlsx', 'pdf']).optional()
});

/** Catalogue of available reports, with their provenance. */
router.get(
  '/',
  asyncHandler(async (_req: Request, res: Response) => {
    res.json({
      success: true,
      data: REPORTS.map((r) => ({
        code: r.code,
        name: r.name,
        description: r.description,
        category: r.category,
        columns: r.columns,
        // Exposed so a consumer can see what a figure is derived from before
        // relying on it.
        provenance: { sourceModels: r.sourceModels, formula: r.formula }
      }))
    });
  })
);

/**
 * Run a report.
 *
 * `?format=csv` exports. Formats that are not implemented are REFUSED with an
 * explanation rather than silently downgraded — emitting a CSV with an `.xlsx`
 * extension, as some systems do, is worse than declining.
 */
router.get(
  '/:code',
  validate({ params: z.object({ code: z.string().trim().max(60) }), query: filterQuery }),
  asyncHandler(async (req: Request, res: Response) => {
    const ctx = getTenantContext(req);
    const code = pathParam(req, 'code').toUpperCase();

    const report = findReport(code);
    if (!report) {
      throw new NotFoundError(`Report "${code}"`);
    }

    const query = req.query as unknown as {
      academicYear?: string;
      departmentId?: string;
      programmeId?: string;
      semester?: number;
      format?: string;
    };

    const format = (query.format ?? 'json') as ExportFormat | 'xlsx' | 'pdf';

    if (format in UNSUPPORTED_FORMATS) {
      throw new ValidationError(UNSUPPORTED_FORMATS[format]!, {
        supportedFormats: ['json', 'csv']
      });
    }

    const startedAt = Date.now();
    const result = await report.run(ctx, {
      academicYear: query.academicYear,
      departmentId: query.departmentId,
      programmeId: query.programmeId,
      semester: query.semester
    });
    const durationMs = Date.now() - startedAt;

    // Exports leave the system, so they are audited. A report of student
    // records being downloaded is exactly the event an auditor would ask about.
    if (format !== 'json') {
      await recordFromRequest(req, {
        action: 'EXPORT',
        module: 'reporting',
        resource: `Report:${code}`,
        details: `Exported ${result.rows.length} row(s) as ${format}`,
        severity: 'warning'
      });
    }

    if (format === 'csv') {
      const meta = exportMeta('csv');
      const filename = `${code.toLowerCase()}_${new Date().toISOString().slice(0, 10)}.${meta.extension}`;

      res.setHeader('Content-Type', meta.contentType);
      res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
      res.setHeader('X-Content-Type-Options', 'nosniff');
      // BOM so Excel reads UTF-8 correctly — without it, Indian names with
      // diacritics render as mojibake on a default Windows install.
      res.send('﻿' + toCsv(result.rows, report.columns));
      return;
    }

    res.json({
      success: true,
      data: {
        report: { code: report.code, name: report.name, category: report.category },
        // PROVENANCE travels with the figures.
        provenance: {
          sourceModels: report.sourceModels,
          formula: report.formula,
          generatedAt: new Date().toISOString(),
          generatedBy: ctx.userId,
          institutionId: ctx.institutionId,
          filters: {
            academicYear: query.academicYear ?? null,
            programmeId: query.programmeId ?? null,
            semester: query.semester ?? null
          },
          durationMs
        },
        summary: result.summary ?? null,
        rowCount: result.rows.length,
        rows: result.rows
      }
    });
  })
);

export default router;
