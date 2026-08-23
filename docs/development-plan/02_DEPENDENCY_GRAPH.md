# 02 — Dependency Graph

Derived from the actual repository, not a template.

## Hard dependency chain

```
┌─────────────────────────────────────────────────────────┐
│ PHASE 0 — STABILIZATION        no dependencies; do now  │
│  config · remove fabrication · secure uploads · TS fix  │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ PHASE 1 — DATABASE FOUNDATION                            │
│  BASELINE MIGRATION ◄── gates every later schema change  │
│  audit tables · history tables · FKs · soft delete       │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ PHASE 2 — ARCHITECTURAL FOUNDATION                       │
│  SERVICE LAYER ◄── gates validation/txn/audit at scale   │
│  errors · validation · transactions · file engine        │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ PHASE 3 — INSTITUTION STRUCTURE + IDENTITY               │
│  Institution→Campus→School→Dept→Programme→Batch→Section  │
│  configurable roles/permissions · object-level authz     │
└──────────────────────────┬──────────────────────────────┘
                           ▼
┌─────────────────────────────────────────────────────────┐
│ PHASE 4 — ACADEMIC CORE  ◄── the missing centre          │
│  Programme → Curriculum → Credits → Grades → SGPA/CGPA   │
└───────┬─────────────────┬─────────────────┬─────────────┘
        ▼                 ▼                 ▼
   PHASE 5           PHASE 6           PHASE 8
   Admissions        Examination       Finance
        │                 │                 │
        │                 ▼                 │
        │            PHASE 7 OBE            │
        └─────────────────┼─────────────────┘
                          ▼
              PHASE 9 — Cross-cutting engines
              (workflow · notification · search)
                          ▼
              PHASE 10 — Reporting layer
                          ▼
              PHASE 11 — Compliance engine
                          ▼
              PHASE 12 — Performance (measured)
```

## Why this order — evidence from the repo

| Edge | Reason |
|---|---|
| Phase 0 → everything | `JWT_SECRET` fallback is a live auth bypass; fabrication actively writes false records on every request |
| **Baseline migration → all schema work** | No `migrations/` exists. Any schema edit without a baseline is unversioned and irreversible |
| **Service layer → validation/txn/audit** | 478 route handlers. Doing these per-endpoint costs 478×; via services ~18× |
| Institution hierarchy → object-level authz | Cannot scope an HOD to "their department" when no School/Programme structure exists |
| Programme model → curriculum/credits/OBE | `StudentProfile.program` is free text. No `Programme` model exists — everything academic is blocked on it |
| Grade-point + SGPA → transcripts, GO, ABC | `cgpa` is a stored `Float` fabricated as `8.5`. Nothing computes it |
| Results engine → OBE attainment | Attainment needs real assessment data |
| Operational data + audit → compliance | Metrics must be *derived and traceable*, not typed in |
| Correctness → performance | Optimizing fabricated data is wasted work |

## Cross-cutting services — when each is needed

| Service | Must exist before | Why |
|---|---|---|
| **Config** | Any deployment | `JWT_SECRET` silently defaults today |
| **Audit** | Any mutation being trusted | Currently written 0 times |
| **Errors** | Service layer | Services must throw typed errors |
| **Validation** | Any write endpoint | Zero backend validation today |
| **Files** | Admissions, IQAC, grievances | Uploads currently public + unvalidated |
| **Workflow** | Admissions, results, finance, IQAC | Otherwise approval logic is rebuilt 5× |
| **Notification** | Admissions onward | Rows stored, nothing sent |
| **Reporting** | Dashboards, compliance | Prevents duplicate aggregation logic |
| **Search** | Any large list | Server-side pagination required |

## Parallelisable work

Can run concurrently once their gate clears:

- **After Phase 1:** audit infra ∥ history tables ∥ backup implementation
- **After Phase 2:** service extraction per module (independent by module)
- **After Phase 4:** Admissions ∥ Examination ∥ Finance
- **Anytime:** test suite, CI pipeline, documentation, `.env.example`

## Blocking prerequisites outside the codebase

| Prerequisite | Blocks | Status |
|---|---|---|
| Official NAAC manual (institution category) | Phase 11 | ❌ **NOT OBTAINED** — PDFs unparseable |
| Official NIRF methodology + DCS | Phase 11 | ❌ Parameter names only |
| UGC regulation clause texts | Phase 11 | ❌ Titles/dates only |
| Legal review — demographic data (DPDP) | Phase 3 demographics | ❌ Required before collection |
| **Decision: single- vs multi-institution** | Phase 3 schema | ⚠️ **DECIDE BEFORE PHASE 3** |

The tenancy decision is the single most expensive one to defer: adding `institutionId` after Phase 4 means touching all 95 models, every query, and every index a second time.

## Critical path

```
Phase 0 (1w) → Phase 1 (3w) → Phase 2 (4w) → Phase 3 (3w) → Phase 4 (8w)
  → Phase 6 (7w) → Phase 10 (5w) → Phase 11 (10w)   ≈ 41 weeks
```

Phases 5, 7, 8, 9 run parallel to the critical path and do not extend it if staffed.
