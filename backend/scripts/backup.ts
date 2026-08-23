/**
 * Backup CLI.
 *
 *   npm run backup            create a verified backup
 *   npm run backup:list       list backups on disk
 *   npm run backup:prune      delete backups past the retention window
 *   npm run backup:verify     RESTORE DRILL — restore the latest backup into a
 *                             scratch database and confirm it is usable
 *
 * The verify command is the point of this file. A backup that has never been
 * restored is not a backup, so the drill is a first-class command an operator
 * can run on a schedule rather than a procedure written in a runbook and never
 * exercised.
 */

import 'dotenv/config';
import { createBackup, listBackups, pruneOldBackups, restoreBackup } from '../src/lib/backup.js';
import { config } from '../src/config/env.js';
import { basePrisma } from '../src/lib/prisma.js';

const command = process.argv[2] ?? 'create';

function line(char = '─') {
  console.log(char.repeat(66));
}

async function main() {
  switch (command) {
    case 'create': {
      line();
      console.log(' Creating database backup');
      line();
      const result = await createBackup('manual', process.env.USER ?? 'cli');
      console.log(`  file      ${result.fileName}`);
      console.log(`  size      ${(result.sizeBytes / 1024 / 1024).toFixed(2)} MB`);
      console.log(`  checksum  ${result.checksum.slice(0, 32)}...`);
      console.log(`  duration  ${(result.durationMs / 1000).toFixed(1)}s`);
      console.log(`  verified  ${result.verified ? 'yes — dump contents listed successfully' : 'NO'}`);
      console.log(
        `  replica   ${result.replicatedTo ?? 'NONE — set BACKUP_REPLICA_DIR, or this backup exists on one host only'}`
      );
      line();
      break;
    }

    case 'list': {
      const backups = await listBackups();
      line();
      console.log(` Backups in ${config.backup.directory} (retention ${config.backup.retentionDays} days)`);
      line();
      if (backups.length === 0) {
        console.log('  none');
      } else {
        for (const backup of backups) {
          console.log(`  ${backup.createdAt.toISOString()}  ${backup.size.padStart(10)}  ${backup.fileName}`);
        }
      }
      line();
      break;
    }

    case 'prune': {
      const result = await pruneOldBackups();
      console.log(`Deleted ${result.deleted.length}, kept ${result.keptCount}.`);
      for (const name of result.deleted) console.log(`  removed ${name}`);
      break;
    }

    case 'verify': {
      // ── RESTORE DRILL ──────────────────────────────────────────────────────
      const backups = await listBackups();
      if (backups.length === 0) {
        console.error('No backups found. Run `npm run backup` first.');
        process.exit(1);
      }

      const latest = backups[0]!;
      line('═');
      console.log(' RESTORE DRILL');
      line('═');
      console.log(`  source   ${latest.fileName} (${latest.size})`);
      console.log(`  target   ${config.backup.verifyDatabase}  [scratch database]`);
      console.log('');

      const result = await restoreBackup({
        filePath: latest.filePath,
        targetDatabase: config.backup.verifyDatabase
      });

      console.log(`  tables restored   ${result.tablesRestored}`);
      console.log(`  duration          ${(result.durationMs / 1000).toFixed(1)}s`);
      console.log('');
      console.log('  RESULT: PASS — this backup is restorable.');
      line('═');
      break;
    }

    default:
      console.error(`Unknown command "${command}". Use: create | list | prune | verify`);
      process.exit(1);
  }
}

main()
  .catch((error) => {
    console.error('\n  FAILED:', error instanceof Error ? error.message : error, '\n');
    process.exit(1);
  })
  .finally(() => basePrisma.$disconnect());
