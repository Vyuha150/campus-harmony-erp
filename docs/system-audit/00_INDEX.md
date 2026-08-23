# Campus Harmony ERP — Forensic Audit

**Audit date:** 2026-08-19 · **Repository:** `Vyuha150/campus-harmony-erp` (public, `main`)
**Scope:** Forensic audit only. **No files outside `docs/system-audit/` were modified. No code was rewritten or deleted.**

---

## Verdict

> ### **E — PROTOTYPE / NOT PRODUCTION READY**
> ### **Overall production readiness: 23 / 100**

A large, genuinely non-trivial prototype — 478 endpoints, 95 models, 133 components, 91% of the frontend wired to real APIs. But it **fabricates academic and HR records**, has **no database migrations**, **never writes the audit log it displays**, and ships a **hardcoded auth secret in a public repository**. Not deployable to a live institution.

---

## Documents

| # | Document | Covers |
|---|---|---|
| [01](01_EXECUTIVE_SUMMARY.md) | Executive Summary | Verdict, scorecard, top-10 lists, what's genuinely good |
| [02](02_ARCHITECTURE_MAP.md) | Architecture Map | Stack, request path, module inventory, target architecture |
| [03](03_FRONTEND_AUDIT.md) | Frontend Audit | 133 components classified; mock-data inventory; auth handling |
| [04](04_BACKEND_AUDIT.md) | Backend Audit | 478 endpoints, systemic measures, fabrication findings |
| [05](05_DATABASE_AUDIT.md) | Database Audit | 95 models, migrations, integrity, audit trail, CGPA |
| [06](06_API_TRACE_MATRIX.md) | API Trace Matrix | UI ↔ API ↔ backend ↔ DB; chain verification |
| [07](07_SECURITY_AUDIT.md) | Security Audit | P0 secret, upload exposure, authz, dependencies |
| [08](08_ROLE_PERMISSION_MATRIX.md) | Role & Permission Matrix | 17 roles × 18 modules; over-privilege |
| [09](09_ERP_FEATURE_MATRIX.md) | ERP Feature Matrix | Coverage vs a production HEI ERP |
| [10](10_NAAC_READINESS.md) | NAAC Readiness | Evidence architecture; **framework version unverified** |
| [11](11_NIRF_READINESS.md) | NIRF Readiness | TLR/RP/GO/OI/PR mapping |
| [12](12_UGC_READINESS.md) | UGC Readiness | ABC, NCrF, credits, grievance, equity |
| [13](13_PERFORMANCE_SCALABILITY.md) | Performance & Scalability | Pagination, N+1, indexing, multi-tenancy |
| [14](14_TESTING_RELIABILITY.md) | Testing & Reliability | Test suite, transactions, idempotency, races |
| [15](15_DEVOPS_PRODUCTION_READINESS.md) | DevOps Readiness | CI/CD, migrations, backups, observability |
| [16](16_TECHNICAL_DEBT.md) | Technical Debt | Tiered by correctness → maintainability |
| [17](17_MASTER_GAP_REGISTER.md) | **Master Gap Register** | **57 findings: 11 P0, 24 P1, 14 P2, 8 P3** |
| [18](18_IMPLEMENTATION_ROADMAP.md) | **Implementation Roadmap** | Dependency graph, phases, top-20 tasks |
| [19](19_COMPLIANCE_TRACEABILITY_MATRIX.md) | Compliance Traceability | NAAC/NIRF/UGC/AISHE matrix |

**Start with [01](01_EXECUTIVE_SUMMARY.md), then [17](17_MASTER_GAP_REGISTER.md), then [18](18_IMPLEMENTATION_ROADMAP.md).**

---

## The five findings that decide the verdict

| # | Finding | Evidence |
|---|---|---|
| 1 | **Backend fabricates academic & HR records on read** — invented CGPA 8.5, invented `'Ph.D in CSE'`, auto-"completed" lesson plans | `students.ts:122-143`, `faculty.ts:38-52` (38 call sites), `faculty.ts:560-578` |
| 2 | **Zero database migrations** for a 95-model institutional schema; plus runtime `CREATE TABLE` | `backend/prisma/` has no `migrations/`; `faculty.ts:10-26` |
| 3 | **Audit log is a façade** — read in 3 places, written in **0** | `admin.ts:264/318/339`; no `.create` in 12,108 lines |
| 4 | **Hardcoded JWT secret in a public repo**, no `.env.example` to signal the variable is required | `middleware/auth.ts:4`, `routes/auth.ts:8` |
| 5 | **No validation, effectively no transactions** — 0 validation schemas and 4 `$transaction` uses across 478 endpoints | repository-wide |

## What is genuinely good

Stated so remediation doesn't churn code that is already correct:

- **Server-side RBAC**, consistent across all 18 modules — the frontend-hides-but-backend-allows failure is largely absent
- **No SQL injection** — all raw SQL correctly parameterised
- **No path traversal** — upload sanitisation is correct
- **The frontend is not a mock-up** — 121/133 components API-wired; `studentMockData.ts` is dead code with zero importers
- **Student identity derived from JWT**, not client input — avoids the classic IDOR
- **Idempotent seed script** with a schema preflight
- **Graceful shutdown**; consistent bcrypt cost 10; current dependency versions; **no fake "AI" features**

The stack is conventional and comprehensible — no over-engineering to unwind. **The foundation is repairable; a rewrite is not indicated.**

## Verified diagnostics

| Command | Result |
|---|---|
| `npx tsc --noEmit` (backend) | **36 errors** |
| `npx tsc --noEmit -p tsconfig.app.json` (frontend) | **22 errors** |
| `npm audit` (frontend) | 32 vulns — **1 critical**, 22 high |
| `npm audit` (backend) | 21 vulns — 13 high |
| Endpoints / validation schemas / transactions | **478 / 0 / 4** |
| Test suite | **1 assertion:** `expect(true).toBe(true)` |

## Audit limitations — stated plainly

Per the brief's rule that unverifiable items be labelled rather than assumed:

- **The application was never run.** The local environment build-out (PostgreSQL install, dependency install, `.env`) was in progress when the audit was commissioned; migrations were never applied and no browser session occurred. **All findings are static-analysis-based.**
- **`npm test`, `npm run build`, `npm run lint` were not executed.**
- **No penetration testing** — P0-04 and P0-05 exploitability is reasoned from code, not demonstrated.
- **Per-endpoint classification of all 478 endpoints is incomplete.** Two delegated background agents assigned the exhaustive backend and frontend passes **failed (stalled)**; rather than fabricate rows, systemic repository-wide measurements were used and the remaining work is declared outstanding in [06](06_API_TRACE_MATRIX.md).
- **Official NAAC PDFs could not be parsed** in this environment. Framework version, attribute counts and AQAR status are **NOT VERIFIED**. NIRF parameter *names* and UGC regulation *titles/dates* were verified from official sources; **weightages, sub-metrics and clause texts were not.**
- **No vendor blog or consultancy page was used as an authoritative compliance source.**
- **No legal assessment.** All security and privacy items are `TECHNICAL RECOMMENDATION`, never `LEGALLY VERIFIED REQUIREMENT`.

## Immediate next steps

1. Read [17_MASTER_GAP_REGISTER.md](17_MASTER_GAP_REGISTER.md) — 11 P0 findings.
2. Execute [18_IMPLEMENTATION_ROADMAP.md](18_IMPLEMENTATION_ROADMAP.md) **Phase 0** — 14 small tasks, ~1 week, that stop active harm.
3. Obtain the official NAAC/NIRF/UGC documents before any compliance work.
4. **Do not begin feature development until Phases 0–3 are complete.**

> Deleting the data fabrication will make parts of the UI show empty states. **That is the correct outcome** — it reveals the true state of the system. Do not restore the fabrication to fix the empty dashboards; fill them with real admissions and HR workflows instead.
