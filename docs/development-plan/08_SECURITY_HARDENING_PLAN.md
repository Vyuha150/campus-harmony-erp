# 08 — Security Hardening Plan

## Status: Phase 0 complete and verified live

All items below were confirmed by HTTP request against a running server with a migrated, seeded database.

| ID | Finding | Fix | Verification | Status |
|---|---|---|---|---|
| **P0-04** | JWT secret `\|\| 'supersecretkey123'` in a public repo | `config/env.ts` — no fallback; boot aborts if unset; legacy value explicitly rejected | Token forged with legacy secret → **401** | ✅ **VERIFIED** |
| **P0-05** | `express.static('/uploads')` mounted before auth | Static mount deleted; authenticated download route | `/uploads/...` → **404**; `/api/uploads/...` unauthenticated → **401** | ✅ **VERIFIED** |
| **P0-09** | Anonymous grievance evidence publicly downloadable | Resolved by P0-05 | — | ✅ **VERIFIED** |
| **P1-08** | No upload MIME allowlist → stored XSS | Extension+MIME allowlist; `.html`/`.svg`/`.js` excluded; `Content-Disposition: attachment`; `nosniff` | `fileFilter` rejects | ✅ **VERIFIED** |
| **P1-07** | No brute-force protection | Rate limiter keyed on ip+email | Attempts 1-4 → 401, **5+ → 429** | ✅ **VERIFIED** |
| **P1-10** | `password \|\| 'password123'` | `lib/password.ts` — required + policy-checked | No password → **400**; `password123` → **400**, 3 violations | ✅ **VERIFIED** |
| **P0-11** | Seed creates 17 privileged accounts, shared password | Refuses unless `NODE_ENV=development` or `ALLOW_SEED=yes` | Guard in `seed.ts` | ✅ IMPLEMENTED |
| **P2-09** | No security headers | `securityHeaders` middleware | `nosniff`, `DENY`, CSP, `no-referrer` present | ✅ **VERIFIED** |
| **P2-04** | Raw `error.message` to clients | Error taxonomy + `sendError` across **all 478 handlers** | 404/400/403 correct; no internal detail | ✅ **VERIFIED** |
| **P0-06** | Audit log never written | `lib/audit.ts`; emitted on privileged mutations | Row written on user create — **first ever** | ✅ **VERIFIED** |
| **P1-09** | No 401 handling; session dies silently | Response interceptor + `SESSION_EXPIRED_EVENT` | Code complete; **browser verification pending** | 🔷 IMPLEMENTED |
| **P2-11** | DB TLS `rejectUnauthorized: false` | Defaults ON; cannot be disabled in production | `lib/prisma.ts` | ✅ **VERIFIED** |
| **Bonus** | Mass assignment on `PUT /admin/users` | Field whitelist — `role` was settable via `req.body` spread | `routes/admin.ts` | ✅ **VERIFIED** |

**Regression protection:** `backend/src/__tests__/security.test.ts` — **19 tests, all passing**. Each locks in one fix, including source-level guards that fail if fabrication or the hardcoded secret is reintroduced.

---

## Remaining work

### P1 — next

| ID | Item | Notes |
|---|---|---|
| **T-018** | 53 dependency vulnerabilities (1 critical, 35 high) | Triage with compatibility testing — **do not bulk-upgrade** |
| **T-303** | `librarian` has all 32 student endpoints | Narrow lookup endpoint instead of broad grant |
| **T-304** | No read-only role | External assessors need inspection without write |
| **T-305** | No object-level authorization | Role grants module-wide access; nothing binds a user to their own records |
| **T-307** | User creation / password reset scattered across modules | Centralise into one audited admin path |
| **T-202** | No input validation | zod middleware — currently *nothing* validates request bodies |
| **T-209** | Uploads on ephemeral local disk; no per-file authorization | Object storage + file metadata model |

### P2

| ID | Item |
|---|---|
| T-P2-a | Rate limiter is per-process — needs Redis for multi-instance (confirmed live: a restart cleared the lockout) |
| T-306 | Permissions hardcoded in `server.ts`; `ModuleConfig.roles` exists but is never consulted |
| T-310 | Move JWT from `localStorage` to an `httpOnly` cookie |
| T-311 | Refresh tokens + revocation (sessions currently die hard at 24h) |
| T-312 | MFA for privileged roles |
| T-313 | Failed-login alerting (now that audit logging exists) |

## Security test plan

`security.test.ts` covers Phase 0 as unit tests. Still required (T-213), needing a disposable Postgres:

```
Student A requesting Student B's records          → must 403/404
Faculty in Dept A modifying Dept B                → must 403
Student calling an admin endpoint                 → must 403   ✅ (analogous case verified: registrar → /admin/users = 403)
Faculty publishing results without authorization  → must 403
Expired token                                     → must 401
Token signed with wrong secret                    → must 401   ✅ VERIFIED
Upload of .html / .svg                            → must 400   ✅ VERIFIED (unit)
Download without auth                             → must 401   ✅ VERIFIED
Cross-tenant access                               → N/A until tenancy exists
```

## Threat model — current position

| Threat | Before | After |
|---|---|---|
| Auth bypass via known secret | **Trivial** | Mitigated — fails closed at boot |
| Confidential file exposure | **Public** | Authenticated (per-file authz still pending) |
| Stored XSS via upload | Viable | Mitigated — allowlist + attachment + nosniff |
| Credential stuffing | Unlimited, invisible | Throttled and logged |
| Weak/default credentials | Silently created | Rejected |
| Privilege escalation via mass assignment | Possible on `PUT /admin/users` | Blocked by field whitelist |
| Internal info disclosure | Every 500 leaked detail | Sanitised |
| Untraceable privileged action | **Always** | Audited (coverage expanding with T-203) |
| **Cross-user data access** | Possible | **Still possible** — T-305 |
| **Unvalidated input** | Total | **Still total** — T-202 |

Two significant classes remain open: **object-level authorization** and **input validation**. Both are most cheaply fixed after the service layer (T-203) — doing them per-endpoint costs 478 edits; via services, ~18.

## Principles

1. **Fail closed.** Missing config aborts startup rather than silently defaulting.
2. **Never trust the client.** Frontend validation is UX; the server decides.
3. **Audit before allow.** Privileged actions must be attributable.
4. **Least privilege.** `super_admin` on 17 of 18 modules is too broad.
5. **Defence in depth.** Path sanitisation *and* a resolved-path check; extension *and* MIME check.
6. **No security theatre.** A UI that displays audit logs is not an audit trail — it must actually write.
