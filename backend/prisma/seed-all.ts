/**
 * `prisma db seed` entry point: the base seed, then the engineering-college demo.
 *
 * Prisma runs the configured seed command without a shell, so chaining the two
 * scripts with `&&` in package.json silently ran only the first. They are run
 * here as separate processes, in order, and a failure in either stops the run.
 */
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

for (const script of ['seed.ts', 'seed-demo.ts']) {
  execFileSync(process.execPath, ['--import', 'tsx', fileURLToPath(new URL(script, import.meta.url))], { stdio: 'inherit' });
}
