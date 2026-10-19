/**
 * Show people's names, not their account ids.
 *
 * WHY THIS EXISTS
 *
 * Many records store WHO did something as a user id in a plain string column —
 * `ApprovalItem.requestedBy`, `InterDeptEvent.coordinator`,
 * `GrievanceCase.assignedTo`, `QualityDocument.uploadedBy` and a dozen more.
 * The list endpoints returned those columns as stored, so about twenty screens
 * told a head of department that a request came from "seed-user-student", or
 * from a 36-character uuid.
 *
 * Storing the id is right: a name can change and an id cannot. Displaying it is
 * the defect. Rather than teach every endpoint to join the user table, this
 * resolves the ids once, on the way out.
 *
 * WHAT IT CHANGES, AND WHAT IT LEAVES ALONE
 *
 * Only a string that EXACTLY equals the id of a user in the caller's own
 * institution is replaced. Keys that are identifiers by name — `id`, `userId`,
 * anything ending in `Id` or `Ids` — are never touched, because the client
 * sends those back to address a record. A value that is not a user id is
 * returned exactly as it was.
 */

import type { NextFunction, Request, Response } from 'express';
import { basePrisma } from '../lib/prisma.js';
import { logger } from '../lib/logger.js';

const IDENTIFIER_KEY = /^(id|_id)$|Ids?$/;
/** Shapes a user id can take here: a uuid, or a slug such as `seed-user-hod`. */
const LOOKS_LIKE_ID = /^[A-Za-z0-9][A-Za-z0-9-]{7,63}$/;
const MAX_CANDIDATES = 400;

function collect(value: unknown, key: string | null, into: Set<string>, depth = 0): void {
  if (depth > 8 || into.size > MAX_CANDIDATES) return;
  if (typeof value === 'string') {
    if (key && !IDENTIFIER_KEY.test(key) && value.includes('-') && LOOKS_LIKE_ID.test(value)) into.add(value);
  } else if (Array.isArray(value)) {
    for (const item of value) collect(item, key, into, depth + 1);
  } else if (value && typeof value === 'object' && !(value instanceof Date)) {
    for (const [k, v] of Object.entries(value)) collect(v, k, into, depth + 1);
  }
}

function substitute(value: unknown, key: string | null, names: Map<string, string>, depth = 0): unknown {
  if (depth > 8) return value;
  if (typeof value === 'string') {
    return key && !IDENTIFIER_KEY.test(key) ? names.get(value) ?? value : value;
  }
  if (Array.isArray(value)) return value.map((item) => substitute(item, key, names, depth + 1));
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) out[k] = substitute(v, k, names, depth + 1);
    return out;
  }
  return value;
}

export function resolveDisplayNames(req: Request, res: Response, next: NextFunction): void {
  const send = res.json.bind(res);

  res.json = ((body: unknown) => {
    const institutionId = (req as { tenant?: { institutionId?: string } }).tenant?.institutionId
      ?? (req as { user?: { institutionId?: string } }).user?.institutionId;

    // Serialise first: Prisma rows carry Dates, and the walk must see plain JSON.
    let plain: unknown;
    try {
      plain = JSON.parse(JSON.stringify(body ?? null));
    } catch {
      return send(body);
    }

    const candidates = new Set<string>();
    collect(plain, null, candidates);
    if (!institutionId || candidates.size === 0) return send(plain);

    basePrisma.user
      .findMany({ where: { institutionId, id: { in: [...candidates] } }, select: { id: true, name: true } })
      .then((users) => {
        if (users.length === 0) return send(plain);
        send(substitute(plain, null, new Map(users.map((u) => [u.id, u.name]))));
      })
      .catch((error) => {
        // Never fail a request over a display nicety — send what we have.
        logger.warn('Display-name resolution failed; ids returned unresolved', {
          module: 'displayNames', error: (error as Error).message
        });
        send(plain);
      });
    return res;
  }) as Response['json'];

  next();
}
