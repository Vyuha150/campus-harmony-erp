/**
 * Central error handling and request context.
 *
 * Gives every request a correlation ID, logs one structured line per request,
 * and converts thrown errors into a single consistent client contract:
 *
 *     { success: false, error: { code, message, details?, requestId } }
 *
 * Internal detail (stack traces, Prisma constraint names, driver messages) goes
 * to the log, never to the client.
 */

import type { Request, Response, NextFunction } from 'express';
import { randomUUID } from 'node:crypto';
import { config } from '../config/env.js';
import { logger } from '../lib/logger.js';
import { AppError, ValidationError, isAppError, translatePrismaError } from '../lib/errors.js';

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      requestId?: string;
      startedAt?: number;
    }
  }
}

/** Assigns a correlation ID and echoes it so clients can quote it in bug reports. */
export function requestContext(req: Request, res: Response, next: NextFunction): void {
  const incoming = req.headers['x-request-id'];
  req.requestId = typeof incoming === 'string' && incoming.length <= 64 ? incoming : randomUUID();
  req.startedAt = Date.now();
  res.setHeader('X-Request-Id', req.requestId);
  next();
}

/** One structured log line per completed request. */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  res.on('finish', () => {
    const durationMs = req.startedAt ? Date.now() - req.startedAt : undefined;
    const user = (req as { user?: { id: string; role: string } }).user;

    const context = {
      requestId: req.requestId,
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs,
      userId: user?.id,
      role: user?.role
    };

    if (res.statusCode >= 500) logger.error('Request failed', context);
    else if (res.statusCode >= 400) logger.warn('Request rejected', context);
    else logger.info('Request completed', context);
  });

  next();
}

/** 404 for unmatched routes — must be registered after all route mounts. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    success: false,
    error: {
      code: 'NOT_FOUND',
      message: `No route matches ${req.method} ${req.path}`,
      requestId: req.requestId
    }
  });
}

/** Terminal error handler. Must be registered last. */
export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  // If headers are already sent, delegate to Express' default handler, which
  // will destroy the connection rather than corrupt a partial response.
  if (res.headersSent) {
    logger.error('Error after headers sent', {
      requestId: req.requestId,
      error: error instanceof Error ? error.message : String(error)
    });
    return;
  }

  let appError: AppError | null = isAppError(error) ? error : translatePrismaError(error);

  // A malformed request body is a CLIENT error, not a server fault.
  //
  // body-parser throws a SyntaxError with `type: 'entity.parse.failed'` when
  // JSON.parse fails. Without this it fell through to the generic 500 handler,
  // which both told the caller the wrong thing and polluted the error log with
  // "unhandled" entries for what is really a bad request.
  if (
    !appError &&
    error instanceof SyntaxError &&
    (error as SyntaxError & { type?: string; status?: number }).type === 'entity.parse.failed'
  ) {
    appError = new ValidationError('The request body is not valid JSON.');
  }

  // Payload too large — also the caller's problem, not ours.
  if (!appError && (error as { type?: string }).type === 'entity.too.large') {
    appError = new ValidationError('The request body exceeds the permitted size.');
  }

  const user = (req as { user?: { id: string; role: string } }).user;

  if (appError) {
    const logContext = {
      requestId: req.requestId,
      userId: user?.id,
      role: user?.role,
      method: req.method,
      path: req.path,
      errorCode: appError.code,
      status: appError.statusCode,
      details: appError.details
    };

    // 5xx are our fault; 4xx are the caller's. Log accordingly.
    if (appError.statusCode >= 500) {
      logger.error(appError.message, { ...logContext, stack: appError.stack });
    } else {
      logger.warn(appError.message, logContext);
    }

    res.status(appError.statusCode).json({
      success: false,
      error: {
        code: appError.code,
        message: appError.publicMessage,
        ...(appError.details !== undefined ? { details: appError.details } : {}),
        ...(appError.retryable ? { retryable: true } : {}),
        requestId: req.requestId
      }
    });
    return;
  }

  // Unexpected error: log everything, tell the client nothing specific.
  logger.error('Unhandled error', {
    requestId: req.requestId,
    userId: user?.id,
    method: req.method,
    path: req.path,
    error: error instanceof Error ? { message: error.message, stack: error.stack } : String(error)
  });

  res.status(500).json({
    success: false,
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again or contact support.',
      // Stack is exposed in development only, to aid local debugging.
      ...(config.isDevelopment && error instanceof Error ? { stack: error.stack } : {}),
      requestId: req.requestId
    }
  });
}

/**
 * Wraps an async handler so rejected promises reach `errorHandler`.
 *
 * Express 5 forwards rejections automatically, but this keeps the intent
 * explicit at each call site and remains correct if the version changes.
 */
export function asyncHandler<T extends Request = Request>(
  handler: (req: T, res: Response, next: NextFunction) => Promise<unknown>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(handler(req as T, res, next)).catch(next);
  };
}
