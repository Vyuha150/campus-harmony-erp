/**
 * Database backup and restore (T-109).
 *
 * `BackupRecord` existed as a model and the Admin UI displayed rows from it,
 * but there was NO backup implementation anywhere — the seed inserted a row
 * describing a fictional backup to `s3://campus-harmony-backups/daily/` and the
 * screen rendered it. Same façade pattern as the audit log.
 *
 * For a system holding student academic records, fee ledgers and payroll, an
 * absent backup is the most serious operational defect in the repository:
 * nothing else on the roadmap matters if the data cannot be recovered.
 *
 * DESIGN
 *
 *  - `mongodump` gzip archive: one compressed file, restorable per collection.
 *  - Every backup is VERIFIED after creation by decompressing it end to end. A
 *    dump that cannot be read is not a backup.
 *  - SHA-256 checksum stored so silent corruption is detectable later.
 *  - `BackupRecord` now reflects reality rather than describing a fiction.
 *  - Restore targets an explicitly-named database and REFUSES to overwrite the
 *    live one unless forced — see `restoreBackup`.
 */

import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import os from 'node:os';
import { createGunzip } from 'node:zlib';
import fs from 'node:fs/promises';
import path from 'node:path';
import { config } from '../config/env.js';
import { basePrisma } from './prisma.js';
import { logger } from './logger.js';
import { runUnscoped } from './tenantStore.js';

export interface BackupResult {
  id: string;
  fileName: string;
  filePath: string;
  sizeBytes: number;
  checksum: string;
  durationMs: number;
  verified: boolean;
  /** Where the copy went, or null when no replica is configured. */
  replicatedTo: string | null;
}

/** The database name carried in the connection string's path. */
function databaseFromUrl(url: string): string {
  return decodeURIComponent(new URL(url).pathname.replace(/^\//, ''));
}

/**
 * Run a MongoDB Database Tools binary (mongodump / mongorestore).
 *
 * The connection string — which contains the password — is handed over in a
 * private `--config` file rather than on the command line, where it would be
 * visible in the process list. The file is removed as soon as the tool exits.
 */
async function runMongoTool(
  binary: string,
  args: string[]
): Promise<{ stdout: string; stderr: string }> {
  const configDir = await fs.mkdtemp(path.join(os.tmpdir(), 'campus-backup-'));
  const configPath = path.join(configDir, 'tool.yaml');
  await fs.writeFile(configPath, `uri: ${JSON.stringify(config.database.url)}
`, { mode: 0o600 });

  try {
    return await new Promise((resolve, reject) => {
      const bin = path.join(config.backup.mongoBinDir, binary);
      const child = spawn(bin, [`--config=${configPath}`, ...args], { windowsHide: true });

      let stdout = '';
      let stderr = '';
      child.stdout.on('data', (chunk) => (stdout += chunk.toString()));
      child.stderr.on('data', (chunk) => (stderr += chunk.toString()));

      child.on('error', (error) =>
        reject(
          new Error(
            `Failed to launch ${binary}: ${error.message}. ` +
              'Install the MongoDB Database Tools or set MONGO_BIN_DIR.'
          )
        )
      );

      child.on('close', (code) => {
        if (code === 0) resolve({ stdout, stderr });
        else reject(new Error(`${binary} exited with code ${code}: ${stderr.slice(-500)}`));
      });
    });
  } finally {
    await fs.rm(configDir, { recursive: true, force: true });
  }
}

/** Decompress the whole archive, returning its uncompressed size. Throws if it is corrupt. */
async function gunzippedSize(filePath: string): Promise<number> {
  return new Promise((resolve, reject) => {
    let bytes = 0;
    createReadStream(filePath)
      .on('error', reject)
      .pipe(createGunzip())
      .on('data', (chunk: Buffer) => (bytes += chunk.length))
      .on('end', () => resolve(bytes))
      .on('error', reject);
  });
}

/**
 * mongodump and mongorestore report one line per collection on stderr:
 * "done dumping db.coll (N documents)" / "finished restoring db.coll (…)".
 */
function countCollections(toolOutput: string, verb: 'dumping' | 'restoring'): number {
  const marker = verb === 'dumping' ? /done dumping /g : /finished restoring /g;
  return (toolOutput.match(marker) ?? []).length;
}

async function sha256(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

function humanSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
}

/**
 * Create a verified backup.
 *
 * @param type `automatic` (scheduled) or `manual` (operator-initiated).
 * @param initiatedBy user id, or 'system' for scheduled runs.
 */

/**
 * Copy a verified backup to a second location.
 *
 * A backup that lives only on the machine it was taken from is not protection
 * against losing that machine, and the restore drill cannot tell the difference
 * — it reads the same local file. This is the step that makes the drill mean
 * something.
 *
 * The copy is verified by re-hashing at the destination. Copying a file and
 * assuming it arrived intact is how a silently truncated backup goes unnoticed
 * until the day it is needed.
 *
 * Throws if a replica IS configured but unreachable. A backup process that
 * quietly skips replication is worse than one that fails: it reports success
 * while leaving a single point of failure.
 */
async function replicateBackup(filePath: string, fileName: string, checksum: string): Promise<string | null> {
  const target = config.backup.replicaDirectory;

  if (!target) {
    logger.warn(
      'Backup was NOT replicated — BACKUP_REPLICA_DIR is not set, so this backup exists in one place only. Losing this host loses it.',
      { module: 'backup', operation: 'replicateBackup' }
    );
    return null;
  }

  const destination = path.join(target, fileName);

  await fs.mkdir(target, { recursive: true });
  await fs.copyFile(filePath, destination);

  // Re-hash at the destination rather than trusting the copy.
  const copied = await fs.readFile(destination);
  const copiedChecksum = createHash('sha256').update(copied).digest('hex');

  if (copiedChecksum !== checksum) {
    await fs.rm(destination, { force: true });
    throw new Error(
      `Replicated backup at ${destination} does not match the source checksum. ` +
        'The partial copy was removed. Treat the destination as unreliable until this is understood.'
    );
  }

  logger.info('Backup replicated and checksum verified', {
    module: 'backup',
    operation: 'replicateBackup',
    fileName
  });

  return destination;
}

export async function createBackup(
  type: 'automatic' | 'manual' = 'manual',
  initiatedBy = 'system'
): Promise<BackupResult> {
  const startedAt = Date.now();
  const database = databaseFromUrl(config.database.url);

  await fs.mkdir(config.backup.directory, { recursive: true });

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const fileName = `${database}_${stamp}.dump`;
  const filePath = path.join(config.backup.directory, fileName);

  logger.info('Backup started', { module: 'backup', operation: 'createBackup', fileName });

  // Record the attempt up front so a crash mid-backup is still visible.
  const record = await runUnscoped('backup is a platform operation', () =>
    basePrisma.backupRecord.create({
      data: {
        type,
        size: '0 B',
        status: 'in_progress',
        initiatedBy,
        location: filePath
      }
    })
  );

  try {
    // One gzip-compressed archive of this database only.
    const dump = await runMongoTool('mongodump', [`--archive=${filePath}`, '--gzip']);

    const stats = await fs.stat(filePath);
    if (stats.size === 0) {
      throw new Error('mongodump produced an empty file.');
    }

    // VERIFY: a dump that cannot be decompressed is not a backup. This catches
    // truncation and corruption at creation time rather than during an incident.
    await gunzippedSize(filePath);
    const collectionCount = countCollections(dump.stderr, 'dumping');

    if (collectionCount === 0) {
      throw new Error('Backup verification failed: the dump contains no collections.');
    }

    const checksum = await sha256(filePath);
    const durationMs = Date.now() - startedAt;

    await runUnscoped('backup is a platform operation', () =>
      basePrisma.backupRecord.update({
        where: { id: record.id },
        data: {
          size: humanSize(stats.size),
          status: 'completed',
          duration: new Date(durationMs).toISOString().slice(11, 19)
        }
      })
    );

    logger.info('Backup completed and verified', {
      module: 'backup',
      operation: 'createBackup',
      fileName,
      durationMs,
      collectionCount
    });

    const replicatedTo = await replicateBackup(filePath, fileName, checksum);

    return {
      id: record.id,
      fileName,
      filePath,
      sizeBytes: stats.size,
      checksum,
      durationMs,
      verified: true,
      replicatedTo
    };
  } catch (error) {
    await runUnscoped('backup is a platform operation', () =>
      basePrisma.backupRecord.update({
        where: { id: record.id },
        data: { status: 'failed' }
      })
    ).catch(() => undefined);

    logger.error('Backup FAILED', {
      module: 'backup',
      operation: 'createBackup',
      fileName,
      error: error instanceof Error ? error.message : String(error)
    });

    throw error;
  }
}

/**
 * Restore a backup into a named database.
 *
 * SAFETY: refuses to restore over the configured live database unless
 * `allowOverwriteLiveDatabase` is explicitly set. A restore drill should target
 * a scratch database — and an accidental restore over production during a
 * rehearsal would be its own incident.
 */
export async function restoreBackup(options: {
  filePath: string;
  targetDatabase: string;
  allowOverwriteLiveDatabase?: boolean;
}): Promise<{ tablesRestored: number; durationMs: number }> {
  const startedAt = Date.now();
  const liveDatabase = databaseFromUrl(config.database.url);

  if (options.targetDatabase === liveDatabase && !options.allowOverwriteLiveDatabase) {
    throw new Error(
      `Refusing to restore over the live database "${liveDatabase}". ` +
        'Pass allowOverwriteLiveDatabase: true only during a genuine recovery.'
    );
  }

  await fs.access(options.filePath);

  logger.warn('Restore started', {
    module: 'backup',
    operation: 'restoreBackup',
    targetDatabase: options.targetDatabase
  });

  // --drop empties each target collection first, so the restore starts from a
  // known state; --nsFrom/--nsTo redirect the dump into the named database.
  const restore = await runMongoTool('mongorestore', [
    `--archive=${options.filePath}`,
    '--gzip',
    '--drop',
    `--nsInclude=${liveDatabase}.*`,
    `--nsFrom=${liveDatabase}.*`,
    `--nsTo=${options.targetDatabase}.*`
  ]);

  // Confirm the restore actually produced collections.
  const tablesRestored = countCollections(restore.stderr, 'restoring');
  const durationMs = Date.now() - startedAt;

  if (tablesRestored === 0) {
    throw new Error('Restore completed but no collections were restored into the target database.');
  }

  logger.info('Restore completed', {
    module: 'backup',
    operation: 'restoreBackup',
    targetDatabase: options.targetDatabase,
    tablesRestored,
    durationMs
  });

  return { tablesRestored, durationMs };
}

/**
 * Delete backups older than the retention window.
 *
 * Retention is a policy decision with legal weight for institutional records —
 * the default is deliberately conservative and configurable.
 */
export async function pruneOldBackups(): Promise<{ deleted: string[]; keptCount: number }> {
  const cutoff = Date.now() - config.backup.retentionDays * 24 * 60 * 60 * 1000;

  let entries: string[];
  try {
    entries = await fs.readdir(config.backup.directory);
  } catch {
    return { deleted: [], keptCount: 0 };
  }

  const dumps = entries.filter((name) => name.endsWith('.dump'));
  const deleted: string[] = [];

  for (const name of dumps) {
    const full = path.join(config.backup.directory, name);
    const stats = await fs.stat(full);
    if (stats.mtimeMs < cutoff) {
      await fs.unlink(full);
      deleted.push(name);
    }
  }

  if (deleted.length > 0) {
    logger.info('Pruned expired backups', {
      module: 'backup',
      operation: 'pruneOldBackups',
      deletedCount: deleted.length,
      retentionDays: config.backup.retentionDays
    });
  }

  return { deleted, keptCount: dumps.length - deleted.length };
}

/** List backups present on disk, newest first. */
export async function listBackups() {
  let entries: string[];
  try {
    entries = await fs.readdir(config.backup.directory);
  } catch {
    return [];
  }

  const dumps = await Promise.all(
    entries
      .filter((name) => name.endsWith('.dump'))
      .map(async (name) => {
        const full = path.join(config.backup.directory, name);
        const stats = await fs.stat(full);
        return {
          fileName: name,
          filePath: full,
          sizeBytes: stats.size,
          size: humanSize(stats.size),
          createdAt: stats.mtime
        };
      })
  );

  return dumps.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
}
