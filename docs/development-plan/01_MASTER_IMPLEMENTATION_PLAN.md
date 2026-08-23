# 01 — Master Implementation Plan

**Source of truth:** `/docs/system-audit/` (57 findings: 11 P0, 24 P1, 14 P2, 8 P3) **plus** direct re-inspection of the repository. Where audit and code disagree, code wins and the discrepancy is documented in `DISCREPANCIES.md`.

---

## Governing strategy

Campus Harmony is **not** a failed project needing a rewrite. It is a broad, conventional, repairable prototype:

- 478 endpoints, 95 models, 133 components, 91% of frontend API-wired
- Server-side RBAC is correct; no SQL injection; no path traversal; dependencies current
- Stack (React/Vite → Express → Prisma → PostgreSQL) is appropriate and needs no replacement

**The defect is trustworthiness of data, not architecture choice.** Therefore: **repair, do not rewrite** (audit rule 48).

### The one rule that orders everything

> **Never build on top of data you cannot trust.**

The system currently fabricates academic and HR records, never writes its audit log, and has no migration history. Any feature built now inherits those defects. Phases 0–2 exist solely to make the data trustworthy; feature work starts at Phase 3.

### Non-negotiable sequencing

```
P0 security + integrity  →  migration baseline  →  service layer
   →  audit + validation + transactions  →  academic core  →  features  →  compliance
```

**The service layer (Phase 2) is the highest-leverage item in the entire plan.** Without it, every cross-cutting fix costs 478 edits:

| Concern | Cost without service layer | With |
|---|---:|---:|
| Validation | 478 endpoints | ~18 modules |
| Transactions | 478 | per operation |
| **Audit logging** | **478** | **1** |
| Error handling | 478 | 1 |
| Object-level authz | 478 | per service |

## Phase map

| Phase | Name | Gate | Est. |
|---|---|---|---|
| **0** | Repository stabilization | Boots clean; no P0 security; no fabrication | 1w |
| **1** | Database foundation | Migrations exist; audit writes; backups tested | 3w |
| **2** | Architectural foundation | Service layer; validation; transactions; errors | 4w |
| **3** | Institution + identity | Hierarchy, configurable roles/permissions | 3w |
| **4** | Academic core | Programme→Curriculum→Credits→Results→CGPA | 8w |
| **5** | Admissions lifecycle | Enquiry→…→Student record | 5w |
| **6** | Examination & results | Config→…→Transcript | 7w |
| **7** | OBE engine | CO/PO/PSO, configurable attainment | 5w |
| **8** | Finance | Transactional, idempotent, auditable money | 5w |
| **9** | Cross-cutting engines | Workflow, notification, file, search | 6w |
| **10** | Reporting layer | Single source of truth + export | 5w |
| **11** | Compliance engine | NAAC/NIRF/UGC/AISHE from operational data | 10w |
| **12** | Performance & scale | Measured, then optimized | ongoing |

**~12 months** to defensible production with a small focused team.

## Architecture target

Modular monolith (audit rule 61) — no microservices, no Kubernetes, no Kafka. Nothing in the observed workload justifies them.

```
src/
  config/          ← validated env, fail-fast          [Phase 0]
  middleware/      ← auth, validate, audit, error      [Phase 0-2]
  modules/<domain>/
    routes.ts      ← thin HTTP: parse → service → respond
    service.ts     ← business logic, transactions, audit emission
    repository.ts  ← typed Prisma access, no `any`
    schema.ts      ← zod request/response contracts
    types.ts       ← shared DTOs (exported to frontend)
  shared/
    errors/        ← typed error taxonomy
    audit/         ← audit service
    files/         ← storage abstraction
    workflow/      ← reusable approval engine
    events/        ← domain events
```

Module boundaries: `Academic · Examination · Finance · Admissions · HR · Research · Placement · Compliance · Communication`

## Cross-cutting services (build once, use everywhere)

| Service | Phase | Replaces |
|---|---|---|
| Config | 0 | Scattered `process.env` with unsafe fallbacks |
| Audit | 1 | Nothing — `SystemAuditLog` is currently never written |
| Error taxonomy | 2 | Uniform 500 + raw `error.message` leak |
| Validation | 2 | No backend validation at all |
| File/storage | 2 | Ad-hoc paths across unrelated tables |
| Workflow/approval | 9 | Per-module bespoke approval logic |
| Notification | 9 | Rows written, nothing ever sent |
| Reporting | 10 | Per-endpoint ad-hoc aggregation |

## Definition of Done (audit rule 45)

A task is `VERIFIED` only when **all** hold:

```
UI ✓  Validation ✓  Authentication ✓  Authorization ✓  API ✓
Business logic ✓  DB persistence ✓  Transaction (if multi-step) ✓
Error handling ✓  Audit entry (if mutation) ✓  Tests ✓  Docs ✓
```

**Code written ≠ feature complete.** Status `IMPLEMENTED` means code exists; `TESTED` means tests pass; `VERIFIED` means the full chain above was demonstrated.

## Explicit non-goals

- ❌ Microservices / Kubernetes / Kafka / event sourcing / CQRS
- ❌ Rewriting the frontend (91% already API-wired — repair, don't replace)
- ❌ Multi-tenancy **before Phase 3** (decide then; retrofitting after Phase 4 is far costlier)
- ❌ AI features before data is trustworthy
- ❌ Dashboards before the data behind them is real
- ❌ Any "NAAC/UGC compliant" claim without a cited clause and verification

## Risk register

| Risk | Mitigation |
|---|---|
| **Removing fabrication empties UIs** → pressure to restore it | Documented as *expected and correct*. Fill with real workflows (Phase 5), never by restoring fabrication |
| Migration baseline on a drifted DB | Baseline generated from schema **before** any edit; `FacultyLessonPlan` folded in first |
| 478-endpoint refactor breaks working features | Service layer introduced incrementally, module by module; RBAC tests written **first** as a regression net |
| Compliance built on unverified frameworks | Official documents are a **blocking prerequisite** for Phase 11 |
| Scope pressure to jump to features | Phases 0–2 are gates, not suggestions |
