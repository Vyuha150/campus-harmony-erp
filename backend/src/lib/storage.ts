/**
 * Storage abstraction (A5 / T-209).
 *
 * Uploads currently live on ephemeral local disk (`process.cwd()/uploads`).
 * That has three consequences the audit recorded and this file exists to fix:
 *
 *   1. Files are LOST on container replacement or redeploy.
 *   2. A second instance cannot serve a file uploaded to the first — which is
 *      blocker F2 for horizontal scaling.
 *   3. `mongodump` covers the database only, so uploaded files are in NO backup.
 *
 * The interface below lets the same `FileMetadata` row resolve through local
 * disk in development and object storage in production, without any calling
 * code changing.
 *
 * NOTE ON THE S3 PROVIDER: it is written against the standard S3 API but is
 * NOT yet wired to a dependency — adding `@aws-sdk/client-s3` is a deliberate
 * choice for whoever provisions the bucket, and this project already carries
 * dependency debt. The provider throws a clear, actionable error until then,
 * rather than pretending to work. See `createStorageProvider`.
 */

import fs from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import type { Readable } from 'node:stream';
import { config } from '../config/env.js';
import { NotFoundError, IntegrationError } from './errors.js';
import { logger } from './logger.js';

export interface StoredObject {
  storageKey: string;
  sizeBytes: number;
  checksum: string;
}

export interface StorageProvider {
  readonly name: 'local' | 's3';
  /** Persist bytes and return the key needed to retrieve them. */
  put(key: string, data: Buffer, contentType: string): Promise<StoredObject>;
  /** Stream the object back. Throws NotFoundError if absent. */
  getStream(key: string): Promise<Readable>;
  exists(key: string): Promise<boolean>;
  delete(key: string): Promise<void>;
}

/** Build a collision-free, traversal-safe storage key. */
export function buildStorageKey(
  institutionId: string,
  moduleName: string,
  originalName: string
): string {
  const extension = path.extname(originalName || '').toLowerCase().slice(0, 10);
  const safeModule = moduleName.replace(/[^a-z0-9_-]/gi, '-').toLowerCase() || 'general';
  // institutionId first so object-storage listings are naturally tenant-partitioned.
  return `${institutionId}/${safeModule}/${randomUUID()}${extension}`;
}

function sha256(data: Buffer): string {
  return createHash('sha256').update(data).digest('hex');
}

// ─── Local filesystem ─────────────────────────────────────────────────────────

/**
 * Local disk provider. Correct for development and single-instance
 * deployments; NOT suitable for multi-instance (see F2).
 */
export class LocalStorageProvider implements StorageProvider {
  readonly name = 'local' as const;

  constructor(private readonly root: string) {}

  /**
   * Resolve a key to an absolute path, refusing anything that escapes the root.
   *
   * Keys are generated server-side, but this is defence in depth: a future
   * caller passing a user-influenced key must not be able to traverse out.
   */
  private resolve(key: string): string {
    const full = path.resolve(this.root, key);
    const rootResolved = path.resolve(this.root);
    if (full !== rootResolved && !full.startsWith(rootResolved + path.sep)) {
      throw new NotFoundError('File');
    }
    return full;
  }

  async put(key: string, data: Buffer): Promise<StoredObject> {
    const full = this.resolve(key);
    await fs.mkdir(path.dirname(full), { recursive: true });
    await fs.writeFile(full, data);
    return { storageKey: key, sizeBytes: data.length, checksum: sha256(data) };
  }

  async getStream(key: string): Promise<Readable> {
    const full = this.resolve(key);
    try {
      await fs.access(full);
    } catch {
      throw new NotFoundError('File');
    }
    return createReadStream(full);
  }

  async exists(key: string): Promise<boolean> {
    try {
      await fs.access(this.resolve(key));
      return true;
    } catch {
      return false;
    }
  }

  async delete(key: string): Promise<void> {
    try {
      await fs.unlink(this.resolve(key));
    } catch {
      // Deleting an absent object is not an error — the desired end state holds.
    }
  }
}

// ─── S3-compatible object storage ─────────────────────────────────────────────

/**
 * S3-compatible provider (AWS S3, MinIO, Cloudflare R2, Wasabi).
 *
 * Deliberately NOT active yet. Enabling it requires:
 *   1. `npm install @aws-sdk/client-s3`
 *   2. replacing the `notConfigured()` calls below with SDK calls
 *   3. setting STORAGE_PROVIDER=s3 plus the S3_* variables
 *
 * Written as a stub that FAILS LOUDLY rather than silently falling back to
 * local disk — a silent fallback in production would look like it worked while
 * writing files to a container that is about to be replaced.
 */
export class S3StorageProvider implements StorageProvider {
  readonly name = 's3' as const;

  constructor(
    private readonly bucket: string,
    private readonly region: string,
    private readonly endpoint?: string
  ) {}

  private notConfigured(): never {
    throw new IntegrationError(
      'Object storage is selected but the S3 client is not installed. ' +
        'Run `npm install @aws-sdk/client-s3` and complete S3StorageProvider, ' +
        'or set STORAGE_PROVIDER=local.',
      { bucket: this.bucket, region: this.region, endpoint: this.endpoint }
    );
  }

  async put(): Promise<StoredObject> {
    this.notConfigured();
  }
  async getStream(): Promise<Readable> {
    this.notConfigured();
  }
  async exists(): Promise<boolean> {
    this.notConfigured();
  }
  async delete(): Promise<void> {
    this.notConfigured();
  }
}

// ─── Factory ──────────────────────────────────────────────────────────────────

let provider: StorageProvider | null = null;

export function createStorageProvider(): StorageProvider {
  if (provider) return provider;

  if (config.storage.provider === 's3') {
    if (!config.storage.s3Bucket) {
      throw new IntegrationError('STORAGE_PROVIDER=s3 requires S3_BUCKET to be set.');
    }
    provider = new S3StorageProvider(
      config.storage.s3Bucket,
      config.storage.s3Region,
      config.storage.s3Endpoint || undefined
    );
    logger.info('Storage provider initialised', { module: 'storage', operation: 's3' });
    return provider;
  }

  const root = path.resolve(process.cwd(), config.uploads.directory);
  provider = new LocalStorageProvider(root);

  if (config.isProduction) {
    // Local disk in production is a data-loss path, not a preference.
    logger.warn(
      'Using LOCAL disk storage in production — uploaded files are NOT durable, ' +
        'NOT shared across instances, and NOT covered by database backups. ' +
        'Set STORAGE_PROVIDER=s3.',
      { module: 'storage' }
    );
  }

  return provider;
}

/** Test seam — resets the memoised provider. */
export function resetStorageProvider(): void {
  provider = null;
}
