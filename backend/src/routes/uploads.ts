/**
 * File upload and authenticated download (A5 / T-209).
 *
 * HISTORY OF THIS FILE
 *
 * Originally: `express.static('/uploads')` mounted BEFORE authentication, so
 * every uploaded file was publicly downloadable — grievance evidence including
 * anonymous submissions, vigilance case files, identity documents, and
 * `AdminDocument` rows explicitly flagged `isConfidential`. No MIME allowlist
 * either, so an uploaded `.html` was served as HTML from the API origin.
 *
 * Phase 0 fixed the public access and added a type allowlist, but stopped at
 * "must be logged in": with no file metadata, any authenticated user could
 * download any file whose id they knew. That was recorded as an accepted
 * interim state.
 *
 * This version closes it. Files now carry ownership, visibility and a tenant,
 * enforced by `assertCanReadFile`, and bytes go through a storage abstraction
 * so the same record works on local disk or object storage.
 */

import type { Request, Response, NextFunction } from 'express';
import { Router } from 'express';
import path from 'node:path';
import multer from 'multer';
import { config } from '../config/env.js';
import { basePrisma } from '../lib/prisma.js';
import { ValidationError, NotFoundError, sendError } from '../lib/errors.js';
import { recordFromRequest } from '../lib/audit.js';
import { getTenantContext } from '../lib/tenant.js';
import { assertCanReadFile, assertCanDeleteFile } from '../lib/fileAccess.js';
import { createStorageProvider, buildStorageKey } from '../lib/storage.js';

const router = Router();

/**
 * Permitted upload types: extension → expected MIME.
 *
 * Excludes .html, .htm, .svg, .xhtml, .js and .xml — all can carry executable
 * script, which combined with the original public serving was a stored-XSS
 * path against the API origin.
 */
const ALLOWED_TYPES: Record<string, string[]> = {
  '.pdf': ['application/pdf'],
  '.png': ['image/png'],
  '.jpg': ['image/jpeg'],
  '.jpeg': ['image/jpeg'],
  '.webp': ['image/webp'],
  '.gif': ['image/gif'],
  '.doc': ['application/msword'],
  '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document'],
  '.xls': ['application/vnd.ms-excel'],
  '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
  '.ppt': ['application/vnd.ms-powerpoint'],
  '.pptx': ['application/vnd.openxmlformats-officedocument.presentationml.presentation'],
  '.csv': ['text/csv', 'application/csv', 'application/vnd.ms-excel'],
  '.txt': ['text/plain'],
  '.zip': ['application/zip', 'application/x-zip-compressed']
};

const VISIBILITIES = new Set(['private', 'role_restricted', 'institution']);

/** Memory storage: bytes go to the storage provider, never straight to disk. */
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: config.uploads.maxFileSizeBytes, files: 1 },
  fileFilter: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    const allowedMimes = ALLOWED_TYPES[extension];

    if (!allowedMimes) {
      cb(new ValidationError(`File type "${extension || 'unknown'}" is not permitted.`, {
        allowedExtensions: Object.keys(ALLOWED_TYPES)
      }));
      return;
    }

    // Extension and declared MIME must agree, so a script cannot be smuggled in
    // by renaming it to an allowed extension.
    if (!allowedMimes.includes(file.mimetype)) {
      cb(new ValidationError(
        `File content type "${file.mimetype}" does not match extension "${extension}".`
      ));
      return;
    }

    cb(null, true);
  }
});

// ─── Upload ───────────────────────────────────────────────────────────────────

router.post('/', upload.single('file'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = getTenantContext(req);

    if (!req.file) throw new ValidationError('No file uploaded.');

    const moduleName = String(req.body?.module ?? 'general').trim().toLowerCase();

    const visibility = String(req.body?.visibility ?? 'private');
    if (!VISIBILITIES.has(visibility)) {
      throw new ValidationError(`visibility must be one of: ${[...VISIBILITIES].join(', ')}`);
    }

    const isConfidential = req.body?.isConfidential === 'true' || req.body?.isConfidential === true;

    // Confidential material must never be institution-wide readable.
    if (isConfidential && visibility === 'institution') {
      throw new ValidationError(
        'A confidential file cannot have institution-wide visibility.'
      );
    }

    const storage = createStorageProvider();
    const storageKey = buildStorageKey(ctx.institutionId, moduleName, req.file.originalname);

    const stored = await storage.put(storageKey, req.file.buffer, req.file.mimetype);

    const record = await basePrisma.fileMetadata.create({
      data: {
        institutionId: ctx.institutionId,
        campusId: ctx.campusId,
        storageKey: stored.storageKey,
        storageProvider: storage.name,
        module: moduleName,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        sizeBytes: stored.sizeBytes,
        checksum: stored.checksum,
        uploadedBy: ctx.userId,
        ownerUserId: req.body?.ownerUserId ? String(req.body.ownerUserId) : null,
        visibility,
        allowedRoles: req.body?.allowedRoles ? JSON.parse(String(req.body.allowedRoles)) : null,
        isConfidential,
        relatedEntityType: req.body?.relatedEntityType ? String(req.body.relatedEntityType) : null,
        relatedEntityId: req.body?.relatedEntityId ? String(req.body.relatedEntityId) : null
      }
    });

    await recordFromRequest(req, {
      action: 'FILE_UPLOAD',
      module: moduleName,
      resource: `FileMetadata:${record.id}`,
      details: `Uploaded "${req.file.originalname}" (${stored.sizeBytes} bytes, ${req.file.mimetype})`,
      severity: isConfidential ? 'warning' : 'info'
    });

    res.status(201).json({
      success: true,
      data: {
        id: record.id,
        module: moduleName,
        originalName: record.originalName,
        mimeType: record.mimeType,
        size: record.sizeBytes,
        checksum: record.checksum,
        visibility: record.visibility,
        isConfidential: record.isConfidential,
        // Download is by ID through the authorised route below — never a
        // guessable path, and never a static file URL.
        url: `/api/uploads/${record.id}`
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── Download ─────────────────────────────────────────────────────────────────

/**
 * Authorised download by file id.
 *
 * Authorization is per-file, not merely "is authenticated" — see
 * `assertCanReadFile`.
 */
router.get('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = getTenantContext(req);
    const id = String(req.params.id);

    const file = await basePrisma.fileMetadata.findUnique({ where: { id } });

    // Throws NotFoundError for another institution's file, so the response
    // cannot be used to probe which ids exist elsewhere.
    assertCanReadFile(ctx, file);

    const storage = createStorageProvider();
    const stream = await storage.getStream(file!.storageKey);

    // Fire-and-forget: a download counter must never fail the download.
    basePrisma.fileMetadata
      .update({
        where: { id },
        data: { downloadCount: { increment: 1 }, lastDownloadedAt: new Date() }
      })
      .catch(() => undefined);

    // Confidential access is audited. Routine downloads are not, to avoid
    // drowning the audit log in noise.
    if (file!.isConfidential) {
      await recordFromRequest(req, {
        action: 'FILE_DOWNLOAD',
        module: file!.module,
        resource: `FileMetadata:${id}`,
        details: `Confidential file "${file!.originalName}" downloaded`,
        severity: 'warning'
      });
    }

    // Force download and disable sniffing, so a stored HTML/SVG payload can
    // never execute in this origin's context.
    res.setHeader('Content-Type', file!.mimeType);
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${encodeURIComponent(file!.originalName)}"`
    );
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Length', String(file!.sizeBytes));

    stream.on('error', next);
    stream.pipe(res);
  } catch (error) {
    next(error);
  }
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

router.get('/:id/metadata', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = getTenantContext(req);
    const file = await basePrisma.fileMetadata.findUnique({ where: { id: String(req.params.id) } });
    assertCanReadFile(ctx, file);

    res.json({
      success: true,
      data: {
        id: file!.id,
        originalName: file!.originalName,
        mimeType: file!.mimeType,
        size: file!.sizeBytes,
        checksum: file!.checksum,
        module: file!.module,
        visibility: file!.visibility,
        isConfidential: file!.isConfidential,
        uploadedBy: file!.uploadedBy,
        downloadCount: file!.downloadCount,
        createdAt: file!.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
});

// ─── Soft delete ──────────────────────────────────────────────────────────────

/**
 * Soft-delete a file.
 *
 * Bytes are retained. Institutional records must not vanish on a mistaken
 * click, and a hard delete would also break the audit trail's references.
 * Physical removal belongs to a retention job, not an API call.
 */
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ctx = getTenantContext(req);
    const id = String(req.params.id);

    const file = await basePrisma.fileMetadata.findUnique({ where: { id } });
    assertCanDeleteFile(ctx, file);

    await basePrisma.fileMetadata.update({
      where: { id },
      data: { deletedAt: new Date(), deletedBy: ctx.userId }
    });

    await recordFromRequest(req, {
      action: 'DELETE',
      module: file!.module,
      resource: `FileMetadata:${id}`,
      details: `Soft-deleted "${file!.originalName}"`,
      severity: 'warning'
    });

    res.json({ success: true, message: 'File deleted.' });
  } catch (error) {
    next(error);
  }
});

export default router;
export { ALLOWED_TYPES };
