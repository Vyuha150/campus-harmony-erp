import type { Request, Response } from 'express';
import { Router } from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import multer from 'multer';

const router = Router();

const uploadsRoot = path.resolve(process.cwd(), 'uploads');

function sanitizeModule(input: unknown): string {
  const raw = String(input ?? 'general').trim().toLowerCase();
  const normalized = raw.replace(/[^a-z0-9_-]/g, '-').replace(/-+/g, '-');
  return normalized || 'general';
}

const storage = multer.diskStorage({
  destination: (req, _file, cb) => {
    const moduleName = sanitizeModule(req.body?.module ?? req.query?.module);
    const folder = path.join(uploadsRoot, moduleName);
    fs.mkdirSync(folder, { recursive: true });
    cb(null, folder);
  },
  filename: (_req, file, cb) => {
    const extension = path.extname(file.originalname || '').toLowerCase();
    cb(null, `${randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

router.post('/', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      res.status(400).json({ success: false, message: 'No file uploaded.' });
      return;
    }

    const moduleName = sanitizeModule(req.body?.module ?? req.query?.module);
    const storagePath = `/uploads/${moduleName}/${req.file.filename}`;
    const fileUrl = `${req.protocol}://${req.get('host')}${storagePath}`;

    res.json({
      success: true,
      data: {
        id: path.parse(req.file.filename).name,
        module: moduleName,
        originalName: req.file.originalname,
        fileName: req.file.filename,
        mimeType: req.file.mimetype,
        size: req.file.size,
        storagePath,
        url: fileUrl
      }
    });
  } catch (error: any) {
    res.status(500).json({ success: false, message: error.message });
  }
});

export default router;