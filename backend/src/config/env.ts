/**
 * Centralised, validated environment configuration.
 *
 * Every environment variable the backend depends on is declared and validated
 * here exactly once, at process start. Modules import `config` — they never
 * read `process.env` directly.
 *
 * Design rule: SECURITY-CRITICAL VALUES HAVE NO DEFAULTS.
 *
 * The previous implementation used `process.env.JWT_SECRET || 'supersecretkey123'`
 * in two files. Because the repository is public and no `.env.example` existed to
 * signal the variable was required, any deployment that forgot to set it would
 * start successfully and silently accept tokens signed with a publicly known key —
 * a complete authentication bypass. Failing loudly at boot is the only safe
 * behaviour: a server that will not start is recoverable, a server that silently
 * trusts forged admin tokens is not.
 */

import dotenv from 'dotenv';

dotenv.config();

/** Thrown at startup when configuration is missing or invalid. */
export class ConfigError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConfigError';
  }
}

const errors: string[] = [];

function required(name: string, opts: { minLength?: number } = {}): string {
  const value = process.env[name];
  if (value === undefined || value.trim() === '') {
    errors.push(`${name} is required but was not set.`);
    return '';
  }
  if (opts.minLength !== undefined && value.length < opts.minLength) {
    errors.push(
      `${name} must be at least ${opts.minLength} characters (got ${value.length}).`
    );
    return value;
  }
  return value;
}

function optional(name: string, fallback: string): string {
  const value = process.env[name];
  return value === undefined || value.trim() === '' ? fallback : value;
}

function optionalInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim() === '') return fallback;
  const parsed = Number(raw);
  if (!Number.isInteger(parsed) || parsed < 0) {
    errors.push(`${name} must be a non-negative integer (got "${raw}").`);
    return fallback;
  }
  return parsed;
}

const nodeEnv = optional('NODE_ENV', 'development');
const isProduction = nodeEnv === 'production';
const isDevelopment = nodeEnv === 'development';
const isTest = nodeEnv === 'test';

/**
 * JWT signing secret. No fallback, ever.
 *
 * 32 characters is the practical floor for an HS256 secret; shorter secrets are
 * brute-forceable offline once an attacker holds a single valid token.
 */
const jwtSecret = required('JWT_SECRET', { minLength: 32 });

// Reject the historical hardcoded secret explicitly. It is published in the
// repository's git history, so it must never be usable even if someone copies
// it into a .env file to "make the error go away".
if (jwtSecret === 'supersecretkey123') {
  errors.push(
    'JWT_SECRET must not be the legacy hardcoded value "supersecretkey123" — ' +
      'it is public in this repository\'s git history. Generate a new secret: ' +
      'node -e "console.log(require(\'crypto\').randomBytes(48).toString(\'hex\'))"'
  );
}

const databaseUrl = required('MONGODB_URI');

// Prisma needs the database name in the URI path; Atlas hands out URIs without
// one, and connecting to the implicit `test` database is never what was meant.
if (databaseUrl) {
  if (!/^mongodb(\+srv)?:\/\//.test(databaseUrl)) {
    errors.push('MONGODB_URI must start with mongodb:// or mongodb+srv://.');
  } else if (!/^mongodb(\+srv)?:\/\/[^/]+\/[^/?]+/.test(databaseUrl)) {
    errors.push(
      'MONGODB_URI must include a database name, e.g. mongodb+srv://USER:PASSWORD@HOST/campus_harmony'
    );
  }
}

/** Allowed CORS origins, comma-separated. Previously hardcoded to localhost:8080. */
const corsOriginsRaw = optional('CORS_ORIGINS', 'http://localhost:8080');
const corsOrigins = corsOriginsRaw
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

if (corsOrigins.includes('*')) {
  errors.push('CORS_ORIGINS must not be "*" — credentialed requests require explicit origins.');
}

if (isProduction && corsOrigins.some((origin) => origin.startsWith('http://'))) {
  errors.push('CORS_ORIGINS must use https:// in production.');
}

// Fail fast, reporting every problem at once rather than one per restart.
if (errors.length > 0) {
  const message = [
    '',
    '════════════════════════════════════════════════════════════════',
    ' Campus Harmony ERP — invalid environment configuration',
    '════════════════════════════════════════════════════════════════',
    ...errors.map((error) => `  ✗ ${error}`),
    '',
    '  See backend/.env.example for the full list of variables.',
    '════════════════════════════════════════════════════════════════',
    ''
  ].join('\n');
  throw new ConfigError(message);
}

export const config = {
  nodeEnv,
  isProduction,
  isDevelopment,
  isTest,

  port: optionalInt('PORT', 5000),

  database: {
    url: databaseUrl,
    poolMax: optionalInt('DATABASE_POOL_MAX', 10),
    poolIdleTimeoutMs: optionalInt('DATABASE_POOL_IDLE_TIMEOUT_MS', 30_000),
    connectionTimeoutMs: optionalInt('DATABASE_CONNECTION_TIMEOUT_MS', 10_000)
  },

  auth: {
    jwtSecret,
    jwtExpiresIn: optional('JWT_EXPIRES_IN', '24h'),
    bcryptRounds: optionalInt('BCRYPT_ROUNDS', 10),
    /** Minimum password length enforced server-side on every credential set. */
    passwordMinLength: optionalInt('PASSWORD_MIN_LENGTH', 12)
  },

  rateLimit: {
    loginWindowMs: optionalInt('LOGIN_RATE_LIMIT_WINDOW_MS', 15 * 60 * 1000),
    loginMaxAttempts: optionalInt('LOGIN_RATE_LIMIT_MAX', 5),
    apiWindowMs: optionalInt('API_RATE_LIMIT_WINDOW_MS', 60 * 1000),
    apiMaxRequests: optionalInt('API_RATE_LIMIT_MAX', 300)
  },

  cors: {
    origins: corsOrigins
  },

  uploads: {
    maxFileSizeBytes: optionalInt('UPLOAD_MAX_FILE_SIZE_BYTES', 25 * 1024 * 1024),
    directory: optional('UPLOAD_DIR', 'uploads')
  },

  logging: {
    level: optional('LOG_LEVEL', isProduction ? 'info' : 'debug')
  },

  storage: {
    /**
     * `local` or `s3`.
     *
     * Local disk is correct for development and single-instance deployments.
     * It is a DATA-LOSS PATH in production: files are lost on container
     * replacement, unreachable from a second instance, and absent from
     * database backups.
     */
    provider: optional('STORAGE_PROVIDER', 'local'),
    s3Bucket: optional('S3_BUCKET', ''),
    s3Region: optional('S3_REGION', 'ap-south-1'),
    /** Set for S3-compatible services (MinIO, R2, Wasabi). */
    s3Endpoint: optional('S3_ENDPOINT', '')
  },

  backup: {
    /** Where dumps are written. Must be on durable, off-host storage in production. */
    directory: optional('BACKUP_DIR', 'backups'),
    /**
     * Directory containing mongodump / mongorestore (MongoDB Database Tools).
     * Empty means "on PATH", which is the normal case in a container.
     */
    mongoBinDir: optional('MONGO_BIN_DIR', ''),
    /**
     * Days to retain backups. Institutional records often carry long statutory
     * retention obligations — confirm this against policy before reducing it.
     */
    retentionDays: optionalInt('BACKUP_RETENTION_DAYS', 30),
    /** Database name used by the restore drill. Never the live database. */
    verifyDatabase: optional('BACKUP_VERIFY_DB', 'campus_harmony_restore_check'),
    /**
     * SECOND destination for every verified backup — a mounted network share,
     * an attached volume on another host, or a sync target.
     *
     * Empty means backups exist in ONE place. Losing that host loses them, and
     * the restore drill proves only that the file is readable while the host is
     * alive. Startup warns when this is unset in production.
     */
    replicaDirectory: optional('BACKUP_REPLICA_DIR', '')
  }
} as const;

export type AppConfig = typeof config;
