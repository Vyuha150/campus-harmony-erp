/**
 * Request validation middleware.
 *
 * The backend previously had NO validation library at all. `zod` was a
 * *frontend* dependency, so client-side forms validated while the API accepted
 * anything — meaning validation existed exactly where it provides no security
 * value. Combined with ~40 unenforced reference columns, any client could POST
 * an arbitrary string as `approvedBy` or `studentId` and nothing would reject it.
 *
 * Schemas are `.strict()` by convention so unknown keys are REJECTED rather than
 * ignored. That is the mass-assignment defence: the `PUT /admin/users` fix
 * needed a hand-written field whitelist precisely because `req.body` was spread
 * into Prisma `data`.
 */

import type { Request, Response, NextFunction } from 'express';
import { ZodError, type ZodType } from 'zod';
import { ValidationError } from '../lib/errors.js';

export interface RequestSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

/** Flatten a ZodError into field-level messages safe to return to a client. */
function toFieldErrors(error: ZodError): Record<string, string[]> {
  const fields: Record<string, string[]> = {};

  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join('.') : '_';
    (fields[key] ??= []).push(issue.message);
  }

  return fields;
}

/**
 * Validate and REPLACE `req.body` / `req.query` / `req.params` with the parsed
 * result.
 *
 * Replacing rather than merely checking matters: downstream handlers then work
 * with coerced, stripped, known-shape data instead of raw client input.
 */
export function validate(schemas: RequestSchemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    try {
      if (schemas.params) {
        req.params = schemas.params.parse(req.params) as typeof req.params;
      }
      if (schemas.query) {
        // Express 5 exposes `req.query` via a getter, so assign the parsed
        // result to a own-property rather than mutating in place.
        Object.defineProperty(req, 'query', {
          value: schemas.query.parse(req.query),
          writable: true,
          configurable: true
        });
      }
      if (schemas.body) {
        req.body = schemas.body.parse(req.body ?? {});
      }
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        next(
          new ValidationError('The request contains invalid data.', {
            fields: toFieldErrors(error)
          })
        );
        return;
      }
      next(error);
    }
  };
}
