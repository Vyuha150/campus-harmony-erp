/**
 * Role-name guard.
 *
 * A route can reference a role that does not exist, and nothing fails — the gate
 * simply never matches, so the endpoint is silently unreachable for the people
 * who need it. That is not a loud error; it looks like a permissions decision.
 *
 * It happened: the finance module gated on `accountant`, which is not a role in
 * this system. The real role is `finance_officer`, so the one person who records
 * payments could not use any of the finance module. Every verification run had
 * used super_admin and registrar tokens, so nothing caught it until a latency
 * measurement happened to call the ledger as the finance officer and got a 403.
 */

import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

/**
 * The roles this system actually issues.
 *
 * Kept here rather than read from the database so the test runs without one, and
 * so adding a role is a deliberate edit in two places rather than a silent drift.
 */
const KNOWN_ROLES = new Set([
  'super_admin',
  'student',
  'faculty',
  'hod',
  'dean',
  'principal',
  'vice_chancellor',
  'pro_vc',
  'registrar',
  'coe',
  'finance_officer',
  'librarian',
  'placement_officer',
  'sports_director',
  'alumni_officer',
  'iqac_coordinator',
  'grievance_officer',
  'security_officer',
  'auditor'
]);

function moduleRouteFiles(): string[] {
  const root = fileURLToPath(new URL('../modules', import.meta.url));
  if (!existsSync(root)) return [];
  const files: string[] = [];
  for (const dir of readdirSync(root, { withFileTypes: true })) {
    if (!dir.isDirectory()) continue;
    const moduleDir = join(root, dir.name);
    for (const entry of readdirSync(moduleDir)) {
      if (entry.endsWith('.routes.ts')) files.push(join(moduleDir, entry));
    }
  }
  return files;
}

describe('role names used in route gates', () => {
  const files = moduleRouteFiles();

  it('finds the module route files', () => {
    expect(files.length).toBeGreaterThan(5);
  });

  it('every role passed to authorizeRoles is a real role', () => {
    const offenders: string[] = [];

    for (const file of files) {
      const source = readFileSync(file, 'utf8')
        .replace(/\/\*[\s\S]*?\*\//g, '')
        .replace(/^\s*\/\/.*$/gm, '');

      for (const call of source.match(/authorizeRoles\(([^)]*)\)/g) ?? []) {
        for (const quoted of call.match(/'([a-z_]+)'/g) ?? []) {
          const role = quoted.replace(/'/g, '');
          if (!KNOWN_ROLES.has(role)) {
            offenders.push(`${file.split(/[\\/]/).slice(-2).join('/')}: "${role}"`);
          }
        }
      }
    }

    expect(offenders, 'these roles do not exist, so the gate can never match').toEqual([]);
  });

  it('the finance module is reachable by the finance officer', () => {
    // The specific regression. The finance officer records payments and reads
    // ledgers; if this role is missing from the gates, the module is unusable by
    // the only person whose job it is.
    const finance = readFileSync(
      fileURLToPath(new URL('../modules/finance/finance.routes.ts', import.meta.url)),
      'utf8'
    );
    expect(finance).toMatch(/'finance_officer'/);
    expect(finance.replace(/\/\*[\s\S]*?\*\//g, '')).not.toMatch(/'accountant'/);
  });

  it('that check would catch an invented role', () => {
    // Negative control: the matcher must actually reject something.
    const sample = "authorizeRoles('super_admin', 'accountant')";
    const found = (sample.match(/'([a-z_]+)'/g) ?? [])
      .map((q) => q.replace(/'/g, ''))
      .filter((r) => !KNOWN_ROLES.has(r));
    expect(found).toEqual(['accountant']);
  });
});
