# 18 — Implementation Roadmap & Dependency Graph

## Principle

The sequence below is derived from the actual repository, not a generic template. It follows one rule:

> **Never build on top of data you cannot trust.**

Campus Harmony's problem is not missing features — it has 478 endpoints and 133 components. Its problem is that the data those features produce is partly fabricated, entirely unaudited, and not durably deployable. Building the admissions module, the OBE engine or the NAAC evidence layer on the current foundation would multiply the integrity problem rather than solve it.

**Do not start feature work at Phase 4 until Phases 0–3 are complete.**

## Dependency graph (actual)

```
Phase 0  STOP THE BLEEDING           ← nothing depends on anything; do now
   │
   ▼
Phase 1  DATABASE FOUNDATION          ← gates every subsequent schema change
   │      (migrations, FKs, soft delete, audit tables)
   │
   ├──────────────┬──────────────┐
   ▼              ▼              ▼
Phase 2        Phase 2b       Phase 2c
IDENTITY &     VALIDATION     AUDIT & HISTORY
AUTHORIZATION  + TRANSACTIONS (depends on Phase 1 tables)
   │              │              │
   └──────────────┴──────────────┘
                  │
                  ▼
Phase 3  ACADEMIC CORE                ← the missing centre of the ERP
         Programme → Curriculum → Credits → Results → CGPA → Transcript
                  │
   ┌──────────────┼──────────────┐
   ▼              ▼              ▼
Phase 4        Phase 5        Phase 6
ADMISSIONS     EXAMINATION    OBE ENGINE
LIFECYCLE      LIFECYCLE      (CO/PO/PSO)
   │              │              │
   └──────────────┴──────────────┘
                  │
                  ▼
Phase 7  REPORTING LAYER (single source of truth)
                  │
                  ▼
Phase 8  COMPLIANCE ENGINE (NAAC / NIRF / UGC / AISHE)
                  │
                  ▼
Phase 9  SCALE & OPTIMISE  →  Phase 10  AI (only after data is trustworthy)
```

---

## Phase 0 — Stop the bleeding (days)

No dependencies. Every item is small and reduces active harm.

| # | Task | Gap ID | Effort |
|---|---|---|---|
| 1 | Delete `JWT_SECRET` fallback; **throw at boot** if unset | P0-04 | S |
| 2 | Add `.env.example` documenting all 5 variables | P1-17 | S |
| 3 | Put `/uploads` behind authentication (remove `express.static`) | P0-05, P0-09 | S |
| 4 | Add MIME/extension allowlist to upload | P1-08 | S |
| 5 | **Delete `getOrCreateStudentProfile`** — return empty state | P0-01 | S |
| 6 | **Delete `getOrCreateFacultyProfile`** | P0-02 | S |
| 7 | **Delete lesson-plan auto-generation** | P0-03 | S |
| 8 | Guard `seed.ts` against non-development environments | P0-11 | S |
| 9 | Remove default-password fallbacks | P1-10 | S |
| 10 | Add rate limiting + lockout on `/auth/login` | P1-07 | S |
| 11 | Add 401 response interceptor (auto-logout) | P1-09 | S |
| 12 | Triage the 1 critical + 35 high dependency vulns | P1-11 | M |
| 13 | Untrack `.env`; extend `.gitignore` | P1-17 | S |
| 14 | Rotate any secret ever committed or deployed | P0-04 | S |

**Note on 5–7:** deleting the fabrication will make parts of the UI show empty states. **That is the correct outcome** — it reveals the true state of the system rather than concealing it behind invented data. Do not restore the fabrication to "fix" the empty dashboards; fix them in Phase 4 with real admissions.

**Exit criteria:** no hardcoded secret; no unauthenticated file access; no fabricated records written; login is rate-limited.

## Phase 1 — Database foundation (2–4 weeks)

Gates all later schema work. Do not skip.

| # | Task | Gap ID |
|---|---|---|
| 1 | **Generate baseline migration** from current schema — before any edit | P0-07 |
| 2 | Switch deployment to `prisma migrate deploy` | P0-07 |
| 3 | Fold `FacultyLessonPlan` into `schema.prisma`; delete runtime DDL | P1-06 |
| 4 | Convert ~40 reference strings to real foreign keys (+ data cleanup) | P1-03 |
| 5 | Replace cascade deletes with soft delete + retention | P1-04 |
| 6 | Add `createdBy`/`updatedBy`/`createdAt`/`updatedAt` to all mutable models | P0-06 |
| 7 | Create history tables: grade, marks, attendance, fee, CGPA | P0-10 |
| 8 | Convert status strings to Prisma enums | P2-06 |
| 9 | Add indexes per `05_DATABASE_AUDIT.md` D8 | P2-07 |
| 10 | Implement automated backup + **tested restore** | P0-08 |

**Exit criteria:** migrations exist and run cleanly on an empty database; no orphaned references; a restore has been performed successfully from a backup.

## Phase 2 — Integrity layer (3–5 weeks, parallelisable)

**2a — Identity & authorization**

| Task | Gap ID |
|---|---|
| Add institutional hierarchy: Institution → Campus → School → Department → Programme → Batch → Section | P1-13 |
| Object-level authorization (faculty→own classes, HOD→own department) | P1-13 |
| Remove `librarian` from broad student mount | P1-12 |
| Add read-only `auditor` role | P1-14 |
| Centralise user creation + password reset into audited admin paths | R3 |
| Move permissions into data (`ModuleConfig.roles`) | P2-12 |

**2b — Validation & transactions**

| Task | Gap ID |
|---|---|
| Extract a **service layer** (prerequisite for the rest) | P2-05 |
| `zod` schema middleware on every endpoint | P1-01 |
| Wrap multi-step writes in `$transaction` — fees, marks, enrolment, payroll first | P1-02 |
| Idempotency keys on financial and enrolment endpoints | P1-23 |
| Mandatory pagination on list endpoints | P1-16 |
| Error taxonomy; stop leaking `error.message` | P2-04 |

**2c — Audit & history**

| Task | Gap ID |
|---|---|
| **Emit `SystemAuditLog` on every mutation** (in the service layer) | P0-06 |
| Write history rows on grade/marks/fee/attendance changes | P0-10 |
| Approval workflow for grade changes | P0-10 |
| Structured logging + correlation IDs | P1-21 |

**Also in Phase 2:** CI pipeline (P1-20) and RBAC/auth test suite (P1-22) — the highest-value tests available, protecting the property the system already gets right.

**Exit criteria:** every mutation is validated, transactional, and audited. RBAC has test coverage. CI blocks merges on typecheck/test/audit failures.

## Phase 3 — Academic core (6–10 weeks)

**The missing centre of the ERP.** Everything downstream depends on it.

| # | Task | Gap ID |
|---|---|---|
| 1 | `Programme` model — the structural gap blocking everything | 09-Institution |
| 2 | Curriculum: scheme → course-basket → electives → prerequisites | 09-Academic |
| 3 | Grade-point mapping + SGPA model + semester results | P1-05 |
| 4 | **Compute CGPA** from `Enrollment.grade` + `Course.credits` | P1-05 |
| 5 | Credit accumulation from real enrolment data | 12-ABC |
| 6 | Transcript generation | 12-Digital records |
| 7 | Student demographics — **after legal review** (unlocks NIRF OI, UGC equity, AISHE) | 11-OI |
| 8 | Academic-year snapshots (NIRF requires 3 preceding years) | 11-History |

**Exit criteria:** the system can compute a CGPA from real grades and produce a defensible transcript.

## Phase 4 — Admissions lifecycle (4–6 weeks)

Enquiry → application → eligibility → merit → counselling → document verification → offer → fee → **enrolment**.

This is what replaces the deleted `getOrCreateStudentProfile`. Until it exists, students must be created by an explicit administrative action.

Also: bulk import (Excel/CSV with validation, preview, dedup, rollback, import history) — **without this, no real institution can onboard its legacy data.**

## Phase 5 — Examination lifecycle (6–8 weeks)

Exam registration → hall tickets → question-paper workflow → internal/external marks → moderation → evaluation → result processing → revaluation → supplementary → certificates.

Currently 8 endpoints for one of the most complex HEI domains. Depends on Phase 3 results engine.

## Phase 6 — OBE engine (4–6 weeks)

CO/PO/PSO definition → CO-PO mapping → direct/indirect assessment → attainment calculation → gap analysis → action-taken reports.

Required for NBA; central to NAAC teaching-learning evidence. Depends on Phase 5 assessment data.

## Phase 7 — Reporting layer (4–6 weeks)

Single source of truth. Replaces per-endpoint ad-hoc aggregation with a shared reporting layer over authoritative transactional data. Add export (Excel/CSV/PDF) — currently absent entirely. Move report generation to background jobs (P2-06/T6).

## Phase 8 — Compliance engine (8–12 weeks)

**Only now.** An evidence engine over fabricated, unaudited data would be worse than none — it lends false credibility to bad figures.

```
Operational Module → Validated Data → Reporting Layer → Metric Engine
   → Evidence Registry → Approval Workflow → Versioned Report
```

Each metric must carry: framework, **version**, criterion ID, metric ID, definition, institution type, academic year, reporting period, **source module, source fields**, formula, numerator, denominator, calculated result, override + justification, evidence URL, owner, verifier, approver, status, timestamps, version history.

**Framework definitions must be configurable data, never hardcoded** — NAAC is mid-transition and NIRF changes yearly.

**Prerequisite:** obtain current official NAAC manual, NIRF methodology + DCS, and the UGC regulation texts. See the `NOT VERIFIED` sections of documents 10, 11 and 12 — **do not build to vendor-blog descriptions.**

## Phase 9 — Scale & optimise (ongoing)

Driven by measurement, not fashion. Object storage for uploads (P1-19); job queue for reports/notifications; caching **only where profiling justifies it**; multi-tenancy **only if SaaS is actually the goal** (currently single-institution by construction — retrofitting is XL effort across all 95 models).

**Do not introduce** microservices, Kubernetes, Kafka, event sourcing or CQRS. Nothing in the observed workload justifies them, and the brief correctly rules them out.

## Phase 10 — AI (last)

No AI features currently exist in the repository (no LLM SDK in either `package.json`; `@testsprite/testsprite-mcp` is a dev testing tool, not a product feature). **Nothing is falsely labelled AI — a point in the project's favour.**

Legitimate future opportunities once data is trustworthy: early-warning on academic risk, compliance-evidence extraction, timetable optimisation, anomaly detection in finance/attendance, natural-language institutional reporting.

**Constraints:** AI must never bypass authorization or silently modify authoritative academic records. Every AI-suggested change to institutional data must be a human-approved, audited action.

---

## Top 20 next implementation tasks

Ordered — first 14 are Phase 0 and can begin immediately.

| # | Task | Phase | Severity |
|---:|---|---|---|
| 1 | Remove `JWT_SECRET` fallback; fail fast at boot | 0 | P0 |
| 2 | Put `/uploads` behind authentication | 0 | P0 |
| 3 | Delete `getOrCreateStudentProfile` (fabricated CGPA) | 0 | P0 |
| 4 | Delete `getOrCreateFacultyProfile` (fabricated PhD) | 0 | P0 |
| 5 | Delete lesson-plan auto-generation | 0 | P0 |
| 6 | Add `.env.example`; untrack `.env`; rotate secrets | 0 | P0 |
| 7 | Guard `seed.ts` against non-dev environments | 0 | P0 |
| 8 | Add upload MIME allowlist | 0 | P1 |
| 9 | Rate limiting + lockout on login | 0 | P1 |
| 10 | 401 response interceptor (auto-logout) | 0 | P1 |
| 11 | Remove default-password fallbacks | 0 | P1 |
| 12 | Triage 1 critical + 35 high dependency vulns | 0 | P1 |
| 13 | **Generate baseline migration** | 1 | P0 |
| 14 | Implement backup + tested restore | 1 | P0 |
| 15 | Extract service layer | 2b | P2 |
| 16 | Emit `SystemAuditLog` on every mutation | 2c | P0 |
| 17 | Add `zod` validation middleware | 2b | P1 |
| 18 | Wrap financial/academic writes in transactions | 2b | P1 |
| 19 | Add RBAC/auth test suite + CI pipeline | 2 | P1 |
| 20 | Convert reference strings to foreign keys | 1 | P1 |

## Indicative timeline

| Phase | Duration | Cumulative |
|---|---|---|
| 0 — Stop the bleeding | 1 week | 1w |
| 1 — Database foundation | 3 weeks | 1m |
| 2 — Integrity layer | 4 weeks | 2m |
| 3 — Academic core | 8 weeks | 4m |
| 4 — Admissions | 5 weeks | 5m |
| 5 — Examination | 7 weeks | 7m |
| 6 — OBE | 5 weeks | 8m |
| 7 — Reporting | 5 weeks | 9m |
| 8 — Compliance engine | 10 weeks | **12m** |

Roughly **12 months** to a defensible, compliance-capable production system with a small focused team — assuming Phase 0 starts immediately and no feature work jumps the queue.

**The most important scheduling decision is refusing to start Phase 4+ before Phases 0–3 are done.** The pressure to build visible features on the existing broad UI will be significant; yielding to it is how the fabricated-data problem becomes permanent.
