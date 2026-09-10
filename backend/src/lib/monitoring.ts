/**
 * Error monitoring (Sentry).
 *
 * THE DEFECT THIS ADDRESSES: no error-tracking or APM of any kind existed —
 * confirmed absent from both `package.json` and `.env.example`. A crash in
 * production was invisible until a user complained; nobody was paged.
 *
 * DESIGN RULE — same as every other external integration in this codebase
 * (`storage.ts`, `providers.ts`): activate automatically when configured,
 * and say so plainly, once, at startup when not. There is no third state
 * where monitoring silently pretends to run.
 *
 * `init()` MUST be called before any other module that should be
 * instrumented is imported — see the single `import './lib/monitoring.js'`
 * as the very first line of `server.ts`.
 */

import * as Sentry from '@sentry/node';
import { logger } from './logger.js';

const dsn = process.env.SENTRY_DSN ?? '';

export const monitoringEnabled = Boolean(dsn);

if (monitoringEnabled) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV ?? 'development',
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0.1)
  });
} else {
  logger.warn(
    'Error monitoring is NOT configured — crashes and unhandled errors will only ' +
      'reach the local log. Set SENTRY_DSN to activate Sentry.',
    { module: 'monitoring' }
  );
}

/** Wired into Express in `server.ts`, after all routes and before the app's own error handler. */
export function attachExpressErrorHandler(app: import('express').Application): void {
  if (monitoringEnabled) {
    Sentry.setupExpressErrorHandler(app);
  }
}

/**
 * Process-level safety net.
 *
 * Neither handler existed before this — an uncaught exception or unhandled
 * rejection had no path to the structured logger or to Sentry, only to raw
 * stderr (or, for a rejection, nothing at all in older Node versions' default
 * behaviour). An uncaught exception leaves the process in a state Node's own
 * documentation calls unsafe to continue from, so that one exits; a rejection
 * is logged and reported but does not exit, matching this app's existing
 * tolerance for a single failed async operation elsewhere.
 */
export function installProcessSafetyNet(): void {
  process.on('uncaughtException', (error: Error) => {
    logger.error('UNCAUGHT EXCEPTION — process will exit', {
      module: 'monitoring',
      error: error.message,
      stack: error.stack
    });
    if (monitoringEnabled) Sentry.captureException(error);
    process.exit(1);
  });

  process.on('unhandledRejection', (reason: unknown) => {
    const error = reason instanceof Error ? reason : new Error(String(reason));
    logger.error('UNHANDLED PROMISE REJECTION', {
      module: 'monitoring',
      error: error.message,
      stack: error.stack
    });
    if (monitoringEnabled) Sentry.captureException(error);
  });
}
