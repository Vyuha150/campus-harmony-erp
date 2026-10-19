/**
 * Typed error taxonomy.
 *
 * Previously every one of the 478 handlers ended with:
 *
 *     catch (error: any) {
 *       res.status(500).json({ success: false, message: error.message });
 *     }
 *
 * Two problems. First, correctness: a missing record returned 500 instead of
 * 404, a unique-constraint violation returned 500 instead of 409, so clients
 * could not distinguish retryable from permanent failures. Second, disclosure:
 * raw Prisma messages leak model names, field names and constraint details to
 * the client.
 *
 * These classes let services throw domain-meaningful errors that the central
 * handler maps to correct status codes and safe client messages, while the full
 * detail goes to the structured log.
 */

export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'AUTHENTICATION_ERROR'
  | 'AUTHORIZATION_ERROR'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'BUSINESS_RULE_VIOLATION'
  | 'RATE_LIMIT_EXCEEDED'
  | 'INTEGRATION_ERROR'
  | 'DATABASE_ERROR'
  | 'INTERNAL_ERROR';

export abstract class AppError extends Error {
  abstract readonly statusCode: number;
  abstract readonly code: ErrorCode;

  /** Safe to show a user. Never contains internal identifiers or stack detail. */
  readonly publicMessage: string;
  /** Structured detail for logs and, where safe, field-level client feedback. */
  readonly details?: unknown;
  /** True when the caller could reasonably retry the same request. */
  readonly retryable: boolean = false;

  constructor(publicMessage: string, details?: unknown) {
    super(publicMessage);
    this.name = new.target.name;
    this.publicMessage = publicMessage;
    this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** Request failed schema or field validation. */
export class ValidationError extends AppError {
  readonly statusCode = 400;
  readonly code = 'VALIDATION_ERROR' as const;
}

/** Caller is not authenticated, or credentials/token are invalid. */
export class AuthenticationError extends AppError {
  readonly statusCode = 401;
  readonly code = 'AUTHENTICATION_ERROR' as const;

  constructor(publicMessage = 'Authentication required.', details?: unknown) {
    super(publicMessage, details);
  }
}

/** Caller is authenticated but lacks permission for this resource or action. */
export class AuthorizationError extends AppError {
  readonly statusCode = 403;
  readonly code = 'AUTHORIZATION_ERROR' as const;

  constructor(publicMessage = 'You do not have permission to perform this action.', details?: unknown) {
    super(publicMessage, details);
  }
}

/**
 * Requested resource does not exist.
 *
 * This replaces the old fabrication pattern: where the system previously
 * invented a student or faculty profile to avoid an empty response, it now
 * correctly reports that the record does not exist.
 */
export class NotFoundError extends AppError {
  readonly statusCode = 404;
  readonly code = 'NOT_FOUND' as const;

  constructor(resource: string, details?: unknown) {
    super(`${resource} was not found.`, details);
  }
}

/** Request conflicts with current state (duplicate key, concurrent edit). */
export class ConflictError extends AppError {
  readonly statusCode = 409;
  readonly code = 'CONFLICT' as const;
}

/**
 * Request is well-formed and authorised but violates an institutional rule.
 * Examples: "Marks cannot be edited after final publication.",
 * "Student does not meet attendance eligibility for this examination."
 */
export class BusinessRuleError extends AppError {
  readonly statusCode = 422;
  readonly code = 'BUSINESS_RULE_VIOLATION' as const;
}

/** An external system (payment gateway, SMS provider, ABC) failed. */
export class IntegrationError extends AppError {
  readonly statusCode = 502;
  readonly code = 'INTEGRATION_ERROR' as const;
  readonly retryable = true;
}

/** Database operation failed for reasons not attributable to the caller. */
export class DatabaseError extends AppError {
  readonly statusCode = 500;
  readonly code = 'DATABASE_ERROR' as const;
  readonly retryable = true;

  constructor(publicMessage = 'A database error occurred. Please try again.', details?: unknown) {
    super(publicMessage, details);
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Send an error response from inside a legacy `catch` block.
 *
 * The 478 existing handlers all end with:
 *
 *     catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
 *
 * which swallows typed errors — a `NotFoundError` surfaced as 500, and raw
 * internal messages reached the client. Migrating every handler to `next(error)`
 * is Phase 2 work (T-203, the service-layer extraction); this helper lets the
 * existing shape produce correct status codes and safe messages in the meantime,
 * with a one-line change per handler and no restructuring.
 *
 * New code should prefer `next(error)` and let the central handler run.
 */
export function sendError(
  res: {
    headersSent: boolean;
    status: (code: number) => { json: (body: unknown) => unknown };
  },
  error: unknown
): void {
  if (res.headersSent) return;

  const appError = isAppError(error) ? error : translatePrismaError(error);

  if (appError) {
    res.status(appError.statusCode).json({
      success: false,
      // `message` is retained alongside `error` for backward compatibility with
      // frontend components that read `response.data.message`.
      message: appError.publicMessage,
      error: {
        code: appError.code,
        message: appError.publicMessage,
        ...(appError.details !== undefined ? { details: appError.details } : {}),
        ...(appError.retryable ? { retryable: true } : {})
      }
    });
    return;
  }

  // Unknown error: never echo the raw message — it leaks Prisma model names,
  // field names and constraint details.
  res.status(500).json({
    success: false,
    message: 'An unexpected error occurred. Please try again or contact support.',
    error: {
      code: 'INTERNAL_ERROR',
      message: 'An unexpected error occurred. Please try again or contact support.'
    }
  });
}

/**
 * Translate Prisma's error codes into domain errors so callers get accurate
 * status codes without leaking schema details.
 *
 * @see https://www.prisma.io/docs/reference/api-reference/error-reference
 */
export function translatePrismaError(error: unknown): AppError | null {
  if (typeof error !== 'object' || error === null) return null;

  // The MongoDB connector reports a lost connection as a raw-query failure with
  // code `unknown` (or P2010), not P1001 — so a DNS or network dropout fell
  // through to a 500 "unexpected error". The client then treated the session
  // check as failed and signed the user out. It is the database that is
  // unavailable, and the caller should be told to retry.
  const message = String((error as { message?: unknown }).message ?? '');
  if (/Server selection timeout|No such host is known|Connection pool .* cleared|forcibly closed by the remote host|ReplicaSetNoPrimary|I\/O error/i.test(message)) {
    return new DatabaseError();
  }
  const code = (error as { code?: unknown }).code;
  if (typeof code !== 'string') return null;

  switch (code) {
    case 'P2002': {
      // Unique constraint violation.
      //
      // Only the FIELD NAMES are surfaced — enough for a client to highlight
      // the offending input. Passing Prisma's `meta` through wholesale leaked
      // the model name, the database constraint name and the driver-adapter
      // error object to the client, which is the disclosure this taxonomy
      // exists to prevent. Full detail goes to the log instead.
      const meta = (error as { meta?: { target?: unknown } }).meta;
      const target = meta?.target;

      const fields = Array.isArray(target)
        ? target.filter((t): t is string => typeof t === 'string')
        : typeof target === 'string'
          ? [target]
          : [];

      return new ConflictError(
        'A record with these details already exists.',
        fields.length > 0 ? { fields } : undefined
      );
    }
    case 'P2003': // foreign key constraint violation
      return new ValidationError('A referenced record does not exist.');
    case 'P2025': // record required but not found
      return new NotFoundError('The requested record');
    case 'P2034': // transaction write conflict / deadlock
      return new ConflictError('The record was modified concurrently. Please retry.');
    case 'P1001': // cannot reach database
    case 'P1002': // database timeout
      return new DatabaseError();
    default:
      return null;
  }
}
