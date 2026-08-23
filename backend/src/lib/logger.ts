/**
 * Structured logging.
 *
 * Previously the only observability was `console.error(err.stack)`. An operator
 * could not answer "what failed, for whom, where, and why" — there was no user
 * context, no correlation ID, and no machine-parseable output.
 *
 * This emits JSON in production (aggregator-friendly) and readable lines in
 * development. No external dependency is added: the value here is structure and
 * redaction, not transport, and a logging library can be swapped in later
 * behind this same interface.
 */

import { config } from '../config/env.js';

type LogLevel = 'error' | 'warn' | 'info' | 'debug';

const LEVEL_PRIORITY: Record<LogLevel, number> = {
  error: 0,
  warn: 1,
  info: 2,
  debug: 3
};

const activeLevel = (['error', 'warn', 'info', 'debug'] as const).includes(
  config.logging.level as LogLevel
)
  ? (config.logging.level as LogLevel)
  : 'info';

/**
 * Keys whose values must never reach logs. Institutional systems handle
 * credentials, tokens and personal data; a log aggregator is a far weaker
 * security boundary than the database.
 */
const REDACTED_KEYS = new Set([
  'password',
  'newpassword',
  'oldpassword',
  'confirmpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'authorization',
  'jwt',
  'secret',
  'apikey',
  'api_key',
  'cookie',
  'sessionid',
  'aadhaar',
  'pan',
  'panNumber',
  'accountnumber',
  'cvv'
]);

function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[max-depth]';
  if (value === null || value === undefined) return value;
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  if (Array.isArray(value)) return value.map((item) => redact(item, depth + 1));
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      out[key] = REDACTED_KEYS.has(key.toLowerCase()) ? '[REDACTED]' : redact(item, depth + 1);
    }
    return out;
  }
  return value;
}

export interface LogContext {
  // `| undefined` is explicit because the project enables
  // `exactOptionalPropertyTypes`, under which `foo?: string` rejects an
  // explicitly-passed `undefined`. Callers routinely pass optional context
  // (e.g. an unauthenticated request has no userId), so undefined must be
  // assignable.
  requestId?: string | undefined;
  userId?: string | undefined;
  role?: string | undefined;
  module?: string | undefined;
  operation?: string | undefined;
  durationMs?: number | undefined;
  status?: number | undefined;
  errorCode?: string | undefined;
  [key: string]: unknown;
}

function emit(level: LogLevel, message: string, context: LogContext = {}): void {
  if (LEVEL_PRIORITY[level] > LEVEL_PRIORITY[activeLevel]) return;

  const entry = {
    timestamp: new Date().toISOString(),
    level,
    message,
    ...(redact(context) as Record<string, unknown>)
  };

  const stream = level === 'error' ? process.stderr : process.stdout;

  if (config.isProduction) {
    stream.write(`${JSON.stringify(entry)}\n`);
    return;
  }

  const { timestamp, ...rest } = entry;
  const detail = Object.keys(rest).length > 2 ? ` ${JSON.stringify(redact(context))}` : '';
  stream.write(`${timestamp} [${level.toUpperCase()}] ${message}${detail}\n`);
}

export const logger = {
  error: (message: string, context?: LogContext) => emit('error', message, context),
  warn: (message: string, context?: LogContext) => emit('warn', message, context),
  info: (message: string, context?: LogContext) => emit('info', message, context),
  debug: (message: string, context?: LogContext) => emit('debug', message, context)
};
