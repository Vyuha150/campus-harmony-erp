/**
 * Load test harness.
 *
 * Development plan section F carried this line for the life of the project:
 * "No performance measurement has ever been taken on this system. Every
 * scalability statement in this repository remains structural inference."
 * This script is what removes it.
 *
 * HOW TO READ THE OUTPUT — this matters more than the numbers.
 *
 * Absolute throughput on a developer laptop is close to meaningless: repeated
 * runs of an IDENTICAL configuration varied by up to 3x here purely with
 * ambient CPU load, and the machine sat at ~42% baseline utilisation from
 * unrelated processes. Do not quote a req/sec figure from this script as a
 * capacity number.
 *
 * What IS stable across runs is the RATIO between endpoints. Measured twice,
 * hours apart, on a differently-loaded machine:
 *
 *              health    authed read   login
 *   run 1      2321/s      194/s       44.3/s     ratios 1 : 0.084 : 0.019
 *   run 2       830/s       74/s       15.0/s     ratios 1 : 0.089 : 0.018
 *
 * The absolute numbers moved by ~3x. The ratios did not move at all. So the
 * durable findings are relative: an authenticated tenant-scoped read costs
 * about 11x a bare health check, and a login costs about 55x one.
 *
 * Project a real deployment from the cost model, not from these numbers:
 * bcrypt at work factor 10 measures 90ms of pure CPU per login on this
 * hardware, and it is CPU-bound, so the login ceiling is roughly
 *
 *     (vCPUs * 1000ms) / 90ms  logins/sec
 *
 * which on Render's 0.5-vCPU starter instance is about 5-6 logins/sec.
 *
 * Usage:
 *   node scripts/loadtest.mjs                  # against localhost:5000
 *   BASE_URL=https://... node scripts/loadtest.mjs
 *
 * Requires the API to be running, and the rate limiter to be raised — a
 * default-configured server returns 429 for most of the run and you end up
 * measuring the rate limiter rather than the application.
 */

import { execFileSync } from 'node:child_process';

const BASE_URL = process.env.BASE_URL ?? 'http://localhost:5000';
const EMAIL = process.env.LOADTEST_EMAIL ?? 'hod@campusharmony.edu';
const PASSWORD = process.env.LOADTEST_PASSWORD;

if (!PASSWORD) {
  console.error('LOADTEST_PASSWORD must be set. It is never defaulted — a default here');
  console.error('would be a working credential committed to the repository.');
  process.exit(1);
}

function autocannon(args) {
  const out = execFileSync('npx', ['--yes', 'autocannon', '-j', ...args], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'ignore'],
    shell: process.platform === 'win32'
  });
  return JSON.parse(out);
}

function report(label, result) {
  const { requests, latency, non2xx, errors, timeouts } = result;
  console.log(`\n${label}`);
  console.log(`  req/sec      mean ${requests.mean}  total ${requests.total}`);
  console.log(`  latency ms   mean ${latency.mean}  p97.5 ${latency.p97_5}  max ${latency.max}`);
  console.log(`  non-2xx ${non2xx}   errors ${errors}   timeouts ${timeouts}`);
  if (non2xx > result.requests.total * 0.05) {
    console.log('  WARNING: >5% non-2xx. If these are 429s you measured the rate limiter,');
    console.log('           not the application. Raise API_RATE_LIMIT_MAX and re-run.');
  }
  return requests.mean;
}

console.log(`Load testing ${BASE_URL}`);

const health = report(
  'A. GET /api/health — no database, no auth (upper bound)',
  autocannon(['-c', '50', '-d', '10', `${BASE_URL}/api/health`])
);

const ready = report(
  'B. GET /api/ready — one database round trip',
  autocannon(['-c', '50', '-d', '10', `${BASE_URL}/api/ready`])
);

const loginBody = JSON.stringify({ email: EMAIL, password: PASSWORD });
const login = report(
  'C. POST /api/auth/login — bcrypt, CPU-bound, the real bottleneck',
  autocannon([
    '-c', '20', '-d', '10', '-m', 'POST',
    '-H', 'Content-Type=application/json',
    '-b', loginBody,
    `${BASE_URL}/api/auth/login`
  ])
);

const token = JSON.parse(
  execFileSync('curl', [
    '-s', '-X', 'POST', `${BASE_URL}/api/auth/login`,
    '-H', 'Content-Type: application/json',
    '-d', loginBody
  ], { encoding: 'utf8' })
).token;

const read = report(
  'D. GET /api/hod/students — authenticated, tenant-scoped read (typical workload)',
  autocannon([
    '-c', '50', '-d', '10',
    '-H', `Authorization=Bearer ${token}`,
    `${BASE_URL}/api/hod/students`
  ])
);

console.log('\n─── ratios (the part that holds across machines) ───');
console.log(`  authenticated read costs ${(health / read).toFixed(1)}x a health check`);
console.log(`  login costs              ${(health / login).toFixed(1)}x a health check`);
console.log(`  a database round trip costs ${(health / ready).toFixed(1)}x a health check`);
console.log('\nProject capacity from the cost model in this file\'s header, not from');
console.log('the absolute figures above.');
