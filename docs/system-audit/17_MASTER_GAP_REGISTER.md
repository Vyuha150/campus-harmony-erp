# 17 — Master Gap Register

Consolidated defect and gap list. Severity: **P0** critical · **P1** high · **P2** medium · **P3** low.
Effort: **S** ≤2d · **M** ≤2w · **L** ≤2m · **XL** >2m.
Status is `OPEN` for all items — this is an audit, no remediation was performed.

---

## P0 — Critical

| ID | Domain | Module | File:Line | Problem | Evidence | Impact | Root Cause | Dependency | Recommended Fix | Effort |
|---|---|---|---|---|---|---|---|---|---|---|
| **P0-01** | Data integrity | Students | `backend/src/routes/students.ts:122-143` | Backend fabricates student records on **read** | `cgpa: 8.5`, `admissionYear: 2024`, `program: 'B.Tech'` written in `getOrCreateStudentProfile` | Invented academic records indistinguishable from real ones; CGPA is fabricated | Dev convenience to make dashboards render | Requires admissions workflow (G-01) to replace | Delete function; return empty state; create profiles only via admissions | M |
| **P0-02** | Data integrity | Faculty | `backend/src/routes/faculty.ts:38-52` | Backend fabricates faculty HR records; called from **38 endpoints** | `qualification: 'Ph.D in CSE'`, `experience: 5` | Fabricated doctorates reported as NIRF TLR / NAAC evidence | Same as P0-01 | Requires HR onboarding workflow | Delete function; explicit faculty onboarding | M |
| **P0-03** | Data integrity | Faculty | `backend/src/routes/faculty.ts:560-578` | Auto-generates 8 weeks of lesson plans, marks weeks 1–4 `'completed'` | `week <= 4 ? 'completed' : 'pending'`; fabricates `CO1`–`CO5` | False academic delivery + OBE outcome records | Same as P0-01 | — | Delete auto-generation | S |
| **P0-04** | Security | Auth | `backend/src/middleware/auth.ts:4`, `routes/auth.ts:8` | Hardcoded JWT secret fallback in a **public** repo | `process.env.JWT_SECRET \|\| 'supersecretkey123'` | Anyone can forge a `super_admin` token → full auth bypass | No fail-fast on missing env; no `.env.example` | — | Remove fallback; throw at boot; add `.env.example`; rotate secrets | S |
| **P0-05** | Security | Uploads | `backend/src/server.ts:39` | `express.static('/uploads')` mounted **before** authentication | No auth middleware precedes it | Grievance evidence (incl. anonymous), vigilance files, confidential docs publicly downloadable | Static mount ordering | Needs file-metadata model | Authenticated file handler with per-file authorisation | M |
| **P0-06** | Compliance | Admin | `backend/src/routes/admin.ts:264,318,339` | `SystemAuditLog` **read in 3 places, written in 0** | No `.create` call in 12,108 lines | Audit-log screen shows an empty table; no accountability for any action | Never implemented | — | Emit audit records on every mutation; ideally in a service layer | M |
| **P0-07** | Database | Schema | `backend/prisma/` | **No migrations directory** for a 95-model schema | Only `schema.prisma` + `seed.ts` | No version history, no rollback, deployment requires destructive `db push` | Never initialised | Blocks all schema work | Generate baseline migration **before** any schema change | S |
| **P0-08** | DevOps | Backup | `BackupRecord` model | Backup is a **façade** — model + UI, no implementation | No backup code anywhere; seed inserts a fictional record | No recovery from data loss; unrecoverable given P0-07 | Never implemented | — | Automated backups + **tested** restore | M |
| **P0-09** | Compliance | Grievances | `server.ts:39` + `GrievanceCase.isAnonymous` | Anonymous complainants' evidence publicly downloadable | `evidenceFiles` served without auth | Complainant identity exposed; defeats the anonymity the model promises | Consequence of P0-05 | P0-05 | Fix with P0-05; treat as its own compliance incident | — |
| **P0-10** | Data integrity | Academic | `backend/src/routes/faculty.ts:1029` | Grades mutated with **no history, approver, or reason** | `data: { grade: m.grade }` | Published grades alterable without trace | No audit/history design | P0-06 | Grade-history table + approval workflow + audit write | M |
| **P0-11** | Security | Seed | `backend/prisma/seed.ts:7` | 17 privileged accounts share a repo-visible default password | `Password@123`; no `NODE_ENV` guard | Total compromise if seed runs in a live environment | No environment guard | — | Refuse to run outside development; force password change | S |

## P1 — High

| ID | Domain | Module | File:Line | Problem | Impact | Recommended Fix | Effort |
|---|---|---|---|---|---|---|---|
| P1-01 | Backend | All | repo-wide | **No input validation** — no `zod`/`joi` in backend deps | Arbitrary data into institutional records; probable mass assignment | `zod` schema middleware per endpoint | L |
| P1-02 | Reliability | All | repo-wide | **4 `$transaction` uses / 478 endpoints** | Partial writes corrupt financial and academic records | Wrap all multi-step writes; start with fees, marks, enrolment | L |
| P1-03 | Database | Schema | `schema.prisma` | ~40 reference fields are bare `String` with no FK | Orphaned/fabricated references silently accepted | Convert to real relations + data-cleanup migration | L |
| P1-04 | Database | Schema | `schema.prisma` | Cascade deletes destroy full academic history | One `User` delete wipes grades, fees, attendance permanently | Soft delete + retention policy | M |
| P1-05 | Database | Academic | `students.ts:138` | **CGPA stored, never computed** | Cannot produce a defensible transcript | Grade-point + SGPA/CGPA computation engine | L |
| P1-06 | Database | Faculty | `faculty.ts:10-26` | Runtime `CREATE TABLE`; shadow table absent from schema | Permanent schema drift; DDL on hot path | Fold into `schema.prisma`; remove runtime DDL | S |
| P1-07 | Security | Auth | `routes/auth.ts:11-53` | No rate limiting, lockout, or failed-login logging | Unlimited undetected brute force | `express-rate-limit` + lockout + audit | S |
| P1-08 | Security | Uploads | `routes/uploads.ts:31-36` | No MIME/extension allowlist | Stored XSS on API origin → token theft | Allowlist + magic-byte check + `Content-Disposition` | S |
| P1-09 | Security | Frontend | `src/lib/api.ts` | JWT in `localStorage`; **no response interceptor** | XSS-exfiltratable; 401 never logs user out | `httpOnly` cookie; add 401 interceptor | M |
| P1-10 | Security | Admin | `admin.ts:70`, `placements.ts:157` | Predictable default passwords (`'password123'`) | Accounts silently created with known credentials | Require explicit password; enforce policy | S |
| P1-11 | Security | Deps | both packages | **53 vulnerabilities** (1 critical, 35 high) | Known exploitable paths | Triage critical/high; upgrade with compatibility testing | M |
| P1-12 | AuthZ | RBAC | `server.ts:47` | `librarian` granted all 32 student endpoints | Library staff reach full student academic/fee data | Narrow lookup endpoint; remove broad grant | S |
| P1-13 | AuthZ | RBAC | repo-wide | No object-level or hierarchical authorization | Users not bound to own dept/classes | Add hierarchy to schema; per-object checks | L |
| P1-14 | AuthZ | RBAC | repo-wide | **No read-only auditor role** | External assessors cannot be given safe access | Add `auditor` role | S |
| P1-15 | Reliability | All | `students.ts:122`, `faculty.ts:38` | `getOrCreate*` read-then-write race | Concurrent requests → unique violation → 500 | Resolved by P0-01/P0-02 | — |
| P1-16 | Performance | All | repo-wide | Pagination on ~9% of endpoints | Unbounded queries; memory exhaustion at scale | Mandatory pagination on list endpoints | M |
| P1-17 | DevOps | Config | repo-wide | No `.env.example`; `.env` committed | `JWT_SECRET` silently unset → P0-04 | Add template; untrack `.env` | S |
| P1-18 | DevOps | Deploy | `vercel.json`, `ecosystem.config.cjs` | No backend deployment target; conflicting ports; hardcoded CORS | Cannot deploy reproducibly | Define target; make CORS/ports configurable | M |
| P1-19 | DevOps | Uploads | `uploads.ts:10` | Files on ephemeral local disk | Data loss on redeploy; breaks horizontal scaling | Object storage | M |
| P1-20 | DevOps | CI | — | **No CI/CD** | 58 type errors + 53 vulns ship unchecked | Pipeline: typecheck → lint → test → audit → build | M |
| P1-21 | Observability | All | — | No structured logs, correlation IDs, metrics, error tracking | Cannot diagnose production failures | Structured logging + error tracking | M |
| P1-22 | Testing | All | `src/test/example.test.ts` | Entire suite is `expect(true).toBe(true)` | No regression protection on any workflow | RBAC/auth tests first, then atomic operations | XL |
| P1-23 | Reliability | All | repo-wide | No idempotency or optimistic concurrency | Duplicate submissions; lost updates | Idempotency keys; `version` columns | M |
| P1-24 | Notifications | All | `Notification` model | Records stored; **no delivery transport** | Users never notified; UI implies otherwise | Email/SMS/push integration + queue | L |

## P2 — Medium

| ID | Domain | File:Line | Problem | Fix | Effort |
|---|---|---|---|---|---|
| P2-01 | Types | backend | 36 TS errors; real crash paths at `dean.ts:786-790`, `finance.ts:613-616`, `students.ts:107-109` | Fix errors; enable `strict` | M |
| P2-02 | Types | frontend | 22 TS errors; **`DashboardLayout.tsx:72,84,87,106` duplicate object keys = real bug** | Fix duplicates; type API responses | M |
| P2-03 | Backend | repo-wide | `const db: any = prisma` defeats type checking | Remove; use typed client | M |
| P2-04 | Backend | repo-wide | All errors become 500; raw `error.message` leaked | Error taxonomy; sanitised responses | M |
| P2-05 | Architecture | repo-wide | No service layer; logic in route files (`hod.ts` 1,882 lines) | Extract services | L |
| P2-06 | Database | `schema.prisma` | No enums; state as free-text strings | Prisma enums + transition validation | M |
| P2-07 | Database | `schema.prisma` | Sparse indexing on high-traffic lookups | Add indexes per `05_DATABASE_AUDIT.md` D8 | S |
| P2-08 | Performance | `faculty.ts:551-586` | N+1: 2 raw queries per course in a loop | Batch queries | S |
| P2-09 | Security | `server.ts` | No `helmet`, CSP, HSTS, HTTPS enforcement | Add security headers | S |
| P2-10 | AuthZ | `server.ts:64` | `/api/uploads` open to any authenticated user | Role restriction + quota | S |
| P2-11 | AuthZ | `server.ts:54` | `pro_vc` identical to `vice_chancellor` | Differentiate | S |
| P2-12 | AuthZ | `ModuleConfig.roles` | Permissions hardcoded; `roles` field unused | Data-driven permissions | M |
| P2-13 | Frontend | `App.tsx` | Route guards **NOT VERIFIED** | Verify; add guards | S |
| P2-14 | DevOps | `server.ts:42` | `/api/health` doesn't check DB | Real health + readiness | S |

## P3 — Low

| ID | Problem | File | Fix |
|---|---|---|---|
| P3-01 | Dead code: `studentMockData.ts`, `dataStore.ts` — **0 importers** | `src/data/`, `src/lib/` | Delete after confirming no dynamic import |
| P3-02 | Three lockfiles (`package-lock.json`, `bun.lock`, `bun.lockb`) | root | Standardise on one |
| P3-03 | Duplicate PM2 configs (`.cjs` + `.js`) | root | Remove one |
| P3-04 | README claims MIT + links `LICENSE`; **file does not exist** | `README.md` | Add LICENSE or correct README |
| P3-05 | README instructs `ts-node` and port 3000; actual `tsx`/8080 | `README.md` | Correct |
| P3-06 | `testsprite_exec_log.txt` committed | root | Remove; gitignore |
| P3-07 | Possibly superseded models: `Facility`, `Team`, `QualityMetric`, `IncidentReport` | `schema.prisma` | **Trace usage before removing** |
| P3-08 | Commented-out seed blocks "uncomment after running migrations" | `seed.ts:1493-1511` | Resolve with P0-07 |

## Removal candidates — **do not delete during audit**

| File/Model | Reason | References | Risk | Safe to remove? | Verification needed |
|---|---|---|---|---|---|
| `src/data/studentMockData.ts` | 0 static importers | none found | Low | **Probably** | Check dynamic imports |
| `src/lib/dataStore.ts` | 0 static importers | none found | Low | **Probably** | Check dynamic imports |
| `Facility` model | Comment: superseded by `SportsFacility` | unknown | Medium | **NO** | Trace `sports.ts` usage + data |
| `Team` model | Comment: superseded by `SportsTeam` | unknown | Medium | **NO** | Trace usage + data |
| `QualityMetric` | Overlaps `AccreditationData` | `iqac.ts` | Medium | **NO** | Trace usage |
| `IncidentReport` | Overlaps `VigilanceCase`/`SupportTicket` | `security.ts` | Medium | **NO** | Trace usage |
| `ecosystem.config.js` | Duplicate of `.cjs` | unknown | Low | **NO** | Confirm which PM2 loads |

## Counts

| Severity | Count |
|---|---:|
| **P0** | **11** |
| P1 | 24 |
| P2 | 14 |
| P3 | 8 |
| **Total** | **57** |

Plus 7 removal candidates requiring verification.

## Items NOT verified — carried as unknown risk

| Area | Why |
|---|---|
| Per-endpoint classification of all 478 endpoints | Delegated agents stalled; systemic analysis used instead |
| Object-level authorization beyond `students.ts` | Requires per-endpoint review |
| Mass assignment exposure | Requires `req.body` handling review per endpoint |
| COMPLETE vs PARTIAL split across 121 API-backed components | Requires running application |
| Frontend route guards | `App.tsx` structure not traced |
| Runtime exploitability of P0-04 / P0-05 | No penetration testing performed |
| `npm test`, `npm run build`, `npm run lint` | Not executed |
| Accessibility, responsive behaviour | Not tested |
| Existing deployed instance (`vyuha1.vercel.app`) | Not investigated |
