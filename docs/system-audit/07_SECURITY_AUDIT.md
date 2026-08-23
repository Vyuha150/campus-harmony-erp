# 07 — Security Audit

Static inspection of the audited commit. Runtime penetration testing was **not** performed — see "Not verified" at the end.

---

## S1 — Hardcoded JWT secret in a public repository (P0 — authentication bypass)

Two files, identical defect:

```ts
// backend/src/middleware/auth.ts:4
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';

// backend/src/routes/auth.ts:8
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretkey123';
```

The repository `github.com/Vyuha150/campus-harmony-erp` is **public**. The fallback secret is therefore public knowledge.

**Attack:** if `JWT_SECRET` is unset in any environment, an attacker signs `{ userId: <any>, role: 'super_admin' }` with `'supersecretkey123'` and obtains full administrative access. `authenticate` (`auth.ts:27`) will verify it as valid.

**Why this is likely to happen in practice:** there is **no `.env.example`** in the repository. An operator deploying this has no signal that `JWT_SECRET` must be set. The fallback silently succeeds — the application starts normally and appears healthy.

**Fix (immediate):**
```ts
const JWT_SECRET = process.env.JWT_SECRET;
if (!JWT_SECRET) throw new Error('JWT_SECRET must be set');
```
Fail fast at boot. Add `.env.example`. Rotate any secret ever used.

## S2 — Uploaded files served without authentication (P0 — confidential data exposure)

`backend/src/server.ts:33-39`:

```ts
app.use(cors({ origin: 'http://localhost:8080', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(uploadsRoot));   // ← no auth middleware
```

The static mount precedes all `authenticate` middleware (applied from line 47 onward). **Every uploaded file is publicly downloadable** by anyone who knows or guesses the URL.

Uploads include, by the schema's own description:
- `GrievanceCase.evidenceFiles` — complainant evidence, including cases flagged `isAnonymous`
- `VigilanceCase.documentsCollected` — seed data shows `cctv_clip.mp4`
- `AdminDocument` with `isConfidential: true` and `accessRoles` — the access-control fields are stored but **never enforced**
- `IDCardRequest.documents` — identity documents
- `QualityDocument.filePath` — accreditation evidence

Filenames are `randomUUID()` (`uploads.ts:27`), which is obscurity, not access control — and `uploads.ts:47` **returns the full URL to the client**, so any user who ever uploads or views a document holds a permanent unauthenticated link. Anonymous grievance evidence is exposed this way.

**Fix:** replace `express.static` with an authenticated handler that checks ownership/role per file, and store file metadata (owner, module, allowed roles) in the database.

## S3 — Unrestricted file upload type (P1 — stored XSS)

`backend/src/routes/uploads.ts:31-36` sets a 50 MB size limit and **no `fileFilter`**. The extension is taken from the user-supplied filename:

```ts
filename: (_req, file, cb) => {
  const extension = path.extname(file.originalname || '').toLowerCase();
  cb(null, `${randomUUID()}${extension}`);
}
```

Combined with S2, a user uploads `payload.html` (or `.svg`); `express.static` serves it with `Content-Type: text/html`; the script executes **on the API origin**. Because the frontend stores its JWT in `localStorage` (S5), this is a viable token-theft chain.

The destination folder is derived from user input but **is correctly sanitised** — `sanitizeModule()` (`uploads.ts:12-16`) strips everything outside `[a-z0-9_-]`. **No path traversal was found.** Credit where due.

**Fix:** MIME + extension allowlist, verify magic bytes, force `Content-Disposition: attachment`, serve from a non-executing origin.

## S4 — No brute-force protection (P1)

`backend/src/routes/auth.ts:11-53` — `POST /api/auth/login` has:
- no rate limiting (no `express-rate-limit` in `backend/package.json`)
- no account lockout or failed-attempt counter
- no CAPTCHA
- no logging of failed attempts (and `SystemAuditLog` is never written — see D4)

Unlimited credential-stuffing is possible against every account, silently. Seeded demo accounts share a known default password (`Password@123`, `seed.ts:7`) across 17 privileged roles including `super_admin` — if seed data reaches a live environment, this is immediate total compromise.

## S5 — JWT in `localStorage`, no 401 handling (P1)

`src/context/AuthContext.tsx:44` — `localStorage.setItem('token', data.token)`.
`src/lib/api.ts:12-23` — request interceptor attaches the token; there is **no response interceptor**.

Consequences:
1. Token is readable by any injected script (XSS → full account takeover). An `httpOnly` cookie would not be.
2. On token expiry (24 h, `auth.ts:37`) or revocation, the app receives 401s but **never logs the user out** — the UI presents a logged-in shell with silently failing requests until manual reload.
3. No refresh token — session simply dies at 24 h.
4. No CSRF concern currently (bearer header, not cookie), but this changes if cookies are adopted.

## S6 — Predictable default passwords (P1)

```ts
// backend/src/routes/admin.ts:70
const hashedPassword = await bcrypt.hash(password || 'password123', 10);

// backend/src/routes/placements.ts:157
const hashedPassword = await bcrypt.hash(String(payload.password || 'Student@123'), 10);
```

If an administrator creates a user without supplying a password — trivially easy given **no input validation** — the account silently receives a publicly-known password. `security.ts:288` generates a `tempPassword`; this needs review for entropy and whether a forced reset is required on first use (**NOT VERIFIED** in detail).

No password policy is enforced anywhere: no minimum length, complexity, history, rotation, or breach check. There is no password-reset flow at all — `auth.ts` exposes only `/login` and `/me`.

## S7 — Internal error disclosure (P2)

The pattern below appears in essentially every handler across all 18 route files:

```ts
} catch (error: any) {
  res.status(500).json({ success: false, message: error.message });
}
```

Raw exception messages reach the client. Prisma errors leak model names, field names, and constraint details; connection errors may leak host/database names. `server.ts:67-70` does the same at the global handler and additionally `console.error(err.stack)`.

## S8 — Dependency vulnerabilities (P1)

Measured via `npm audit` on the audited commit:

| Package | Critical | High | Moderate | Low | Total |
|---|---:|---:|---:|---:|---:|
| Frontend (root) | **1** | 22 | 7 | 2 | **32** |
| Backend | 0 | 13 | 6 | 2 | **21** |
| | | | | | **53** |

Not auto-upgraded during this audit, per the brief (compatibility must be assessed first). The critical frontend finding requires immediate triage.

Also present: `lovable-tagger` and `@testsprite/testsprite-mcp` as dev dependencies — third-party tooling in the build path warranting a supply-chain review.

## S9 — Authorization gaps (P1)

RBAC is **enforced server-side** at every module mount (`server.ts:47-64`) — the common "frontend hides it but backend allows it" failure is largely **absent**, and `authorizeRoles` uses `allowedRoles.includes(userRole)` consistently. This is genuinely well done.

What is missing:

1. **No object-level authorization.** Role grants module-wide access. A `faculty` user reaching faculty endpoints is not consistently constrained to *their own* classes/courses beyond the `getOrCreateFacultyProfile` derivation. Cross-user data access within a role requires per-endpoint verification (**NOT VERIFIED** exhaustively across 478 endpoints).
2. **No hierarchical scoping.** The brief's `Institution → Campus → School → Department → Programme → Batch → Section` hierarchy does not exist in the schema. An `hod` is not scoped to their own department by any structural mechanism.
3. **`super_admin` is present on every single module mount** — 17 of 18 modules. There is no separation of duties, no break-glass procedure, and no admin-action logging (audit log unwritten).
4. **`uploads` accepts any authenticated user** (`server.ts:64`) with no role or quota restriction.

## S10 — Configuration and secrets hygiene (P2)

- `.env` is **committed and tracked** in the public repository. Currently it holds only `VITE_API_BASE_URL` (no secret leaked), but `.gitignore` covers only `.env*.local`, so the pattern invites a future leak.
- CORS origin is hardcoded to `http://localhost:8080` (`server.ts:35`) — breaks in every non-local environment and cannot be configured.
- `ecosystem.config.cjs` sets `NODE_ENV: 'development'` for what is presented as the deployment config.
- No security headers: no `helmet`, no HSTS, no CSP, no `X-Content-Type-Options` (which would partially mitigate S3).
- No HTTPS enforcement or redirect.

## Injection review — result: clean

| Vector | Finding |
|---|---|
| SQL injection | **None found.** All raw SQL (`faculty.ts:552, 563, 580, 642`; `seed.ts:76`) uses `$1, $2` parameter placeholders correctly. |
| Path traversal | **None found.** `sanitizeModule()` (`uploads.ts:12-16`) strips traversal characters. |
| Command injection | **None found.** No `child_process` usage in application code. |
| SSRF | **None found.** No server-side outbound fetch on user-supplied URLs. |
| NoSQL injection | Not applicable — PostgreSQL only. |
| Mass assignment | **Likely present but NOT VERIFIED** — with zero validation, handlers spreading `req.body` into Prisma `data` would allow arbitrary field setting. Requires per-endpoint review. |

## Severity summary

| ID | Finding | Severity |
|---|---|---|
| S1 | Hardcoded JWT secret, public repo, no `.env.example` | **P0** |
| S2 | Uploads served with no authentication | **P0** |
| S3 | No upload type allowlist → stored XSS | P1 |
| S4 | No brute-force protection or lockout | P1 |
| S5 | JWT in localStorage; no 401 handling; no refresh | P1 |
| S6 | Predictable default passwords; no password policy | P1 |
| S8 | 53 dependency vulnerabilities (1 critical) | P1 |
| S9 | No object-level or hierarchical authorization | P1 |
| S7 | Internal error message disclosure | P2 |
| S10 | Secrets/config hygiene; no security headers | P2 |

## BLOCKED / NOT VERIFIED

- **No runtime penetration testing performed.** All findings are static. Exploitability of S1/S2 was reasoned from code, not demonstrated against a running instance.
- **Mass assignment** — needs per-endpoint review of `req.body` handling across 478 endpoints.
- **Object-level authorization** — verified for `students.ts` (correctly derives identity from JWT) but not exhaustively across all modules.
- **`security.ts:288` temporary password** entropy and forced-reset behaviour not traced.
- **No SAST/dependency-provenance tooling** was run beyond `npm audit`.
- **Legal/regulatory data-protection obligations** (e.g. India's DPDP Act) are **not** assessed here. Everything above is a `TECHNICAL RECOMMENDATION`; none is a `LEGALLY VERIFIED REQUIREMENT`. Retention, consent, breach notification and cross-border transfer obligations require qualified legal review.
