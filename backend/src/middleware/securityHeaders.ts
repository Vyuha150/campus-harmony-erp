/**
 * Security response headers.
 *
 * The application previously sent none: no HSTS, no CSP, no clickjacking
 * protection, and no `X-Content-Type-Options` — the last of which would have
 * partially mitigated the stored-XSS vector created by unauthenticated,
 * unvalidated file uploads.
 *
 * Implemented directly rather than by adding `helmet`, because this is a small,
 * explicit, auditable set of headers appropriate to a JSON API, and it avoids
 * adding a dependency to a project already carrying 53 known vulnerabilities.
 */

import type { Request, Response, NextFunction } from 'express';
import { config } from '../config/env.js';

export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  // Never let a browser guess a response's type — the primary defence against
  // an uploaded file being interpreted as executable script.
  res.setHeader('X-Content-Type-Options', 'nosniff');

  // This is a JSON API; it should never be framed.
  res.setHeader('X-Frame-Options', 'DENY');

  // Do not leak internal URLs to third parties via the Referer header.
  res.setHeader('Referrer-Policy', 'no-referrer');

  // The API serves no HTML, so the most restrictive policy is also the correct
  // one: nothing may be loaded or executed from an API response.
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
  );

  // Deny access to device APIs by default.
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');

  // HSTS only in production — sending it over plain HTTP in development would
  // pin localhost to HTTPS in the developer's browser and break the dev server.
  if (config.isProduction) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }

  // Do not advertise the server technology.
  res.removeHeader('X-Powered-By');

  next();
}
