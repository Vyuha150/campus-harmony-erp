# 13 — Performance & Scalability

**Method:** static analysis and query-pattern inspection. **No load testing, profiling, or benchmarking was performed** — see BLOCKED at the end. All findings are structural, not measured.

---

## P1 — Pagination missing on ~91% of endpoints (P1)

| Measure | Count |
|---|---:|
| Endpoints | 478 |
| Endpoints using `take:`/`skip:`/`cursor:` | 42 (8.8%) |

Unbounded `findMany()` on list endpoints returns the entire table. At institutional scale this is a linear-degradation path ending in memory exhaustion:

| Endpoint class | Rows after 5 years (~5,000 students) |
|---|---|
| Attendance records | ~3,000,000 (5k students × 30 courses × 20 sessions) |
| Audit logs (once implemented) | Millions |
| Fee records | ~50,000 |
| Notifications | Hundreds of thousands |
| Enrollments | ~750,000 |

The audit-log viewer (`admin.ts:264`) is unbounded — ironically the table designed to grow fastest.

## P2 — N+1 query patterns (P2)

`faculty.ts:551-586` — two raw queries **per course**, plus up to 8 inserts on first call:

```ts
for (const course of courses) {
  const existingRows = await prisma.$queryRawUnsafe(...);   // 1 query
  if (existingRows.length === 0) { /* 8 sequential inserts */ }
  const rows = await prisma.$queryRawUnsafe(...);           // 1 query
}
```

For a faculty member with 6 courses on first access: 12 queries + 48 inserts in a single request.

`getOrCreateFacultyClasses` (`faculty.ts:117-155`) issues a `create` per section inside nested loops, plus `createMany` per group.

Dashboard endpoints across role modules aggregate with sequential `count()`/`findMany()` calls rather than batched queries — a pattern repeated per role rather than shared.

## P3 — Sparse indexing (P2)

Only 14 of 95 models carry `@@index`. Unindexed high-traffic lookups:

| Query pattern | Index? | Frequency |
|---|---|---|
| `Attendance` by `studentProfileId` | ❌ | Every student dashboard |
| `FeeRecord` by `studentProfileId`, `status`, `dueDate` | ❌ | Every fee screen |
| `Notification` by `userId` + `read` | ❌ | **Every page load** |
| `SystemAuditLog` by `timestamp`, `userId` | ❌ | Audit viewer |
| `GrievanceCase` by `status`, `assignedTo` | ❌ | Grievance dashboard |
| `Enrollment` by `courseId` | ❌ | Class rosters |

Unindexed + unpaginated is the compounding case: a sequential scan returning every row.

## P4 — Untyped JSON blocks efficient querying (P2)

~30 models store structured data in `Json` columns (`agendaItems`, `criteria`, `keyIndicators`, `accounts`, `allowances`, `feeComponents`, `results`, `timeline`, `members`, `evidence`). These are unindexed and unqueryable in a typed way — filtering requires loading rows and filtering in application memory.

This directly obstructs the compliance reporting the product intends: computing a NAAC metric from `AQARRecord.criteria` means deserialising JSON per row in Node rather than aggregating in PostgreSQL.

## P5 — Synchronous heavy processing (P2)

No queue, worker, or scheduler exists. Everything runs in-request:

| Operation | Current | Consequence |
|---|---|---|
| Report generation | Synchronous | Blocks request; holds a DB connection; will hit timeouts |
| Dashboard aggregation | Synchronous, per request | Recomputed for every user, every load |
| Notification "delivery" | Row insert only | No transport exists at all |
| Bulk operations | Sequential loops | No batching |
| Result processing | Not implemented | — |

No caching layer of any kind — no Redis, no in-memory cache, no HTTP cache headers. Identical dashboard queries re-execute on every page load for every user.

## P6 — Runtime DDL under concurrency (P1)

`ensureFacultyLessonPlanTable()` (`faculty.ts:10`) issues `CREATE TABLE IF NOT EXISTS` on the request path, called at `:548` and `:640`. Concurrent execution contends on PostgreSQL schema locks, which can block unrelated queries. DDL does not belong in request handling.

## P7 — Connection pooling not configured (P2)

`backend/src/lib/prisma.ts:13-20` constructs a `pg` `Pool` with host/port/user/password/database and `ssl` — but **no `max`, `idleTimeoutMillis`, or `connectionTimeoutMillis`**, so `pg` defaults apply (max 10). Under concurrent load with long synchronous reports holding connections, pool exhaustion is likely. Pool sizing is not tunable via environment.

Note `ssl: { rejectUnauthorized: false }` (`prisma.ts:19`) — this disables certificate verification, permitting MITM on the database connection. A security finding as much as a configuration one.

## Multi-institution / multi-tenancy — **not supported**

The brief asks whether the product can support multiple institutions. **It cannot, and this is structural, not a configuration gap.**

| Requirement | Status | Evidence |
|---|---|---|
| Tenant/institution ID on models | ❌ | **No model in 95 carries `institutionId` or `tenantId`** |
| Campus isolation | ❌ | `User.campus` is a free-text `String?` |
| Cross-tenant query prevention | ❌ | No mechanism |
| Storage segregation | ❌ | Single `uploads/` directory, module-partitioned only |
| Authorization boundaries | ❌ | Role-based only, no tenant dimension |
| Tenant configuration / branding | ❌ | None |
| Custom academic structures | ❌ | No `Programme` model at all |
| Custom grading schemes | ❌ | Grade is a free-text `String` |
| Configurable workflows | ❌ | Hardcoded |
| Institution-specific permissions | ❌ | Compiled into `server.ts` |
| Institution-specific compliance frameworks | ❌ | `framework` is a free-text string |

**Cross-tenant leakage is not currently possible — because tenancy does not exist.** There is exactly one institution. The P0 risk the brief describes is therefore not present today, but would be introduced immediately by any naive multi-tenancy retrofit.

**Retrofitting cost is XL:** adding `institutionId` to all 95 models, every query, every index, plus row-level security and a tenant-resolution layer. **This decision should be made before Phase 3 of the roadmap**, because retrofitting after the academic core is built is substantially more expensive than including it.

## Scalability ceiling (estimated, unmeasured)

| Scale | Assessment |
|---|---|
| ~500 students, single institution, light concurrency | Probably functional |
| ~5,000 students | Unpaginated queries and missing indexes degrade dashboards |
| ~20,000 students | Unbounded queries likely exhaust memory; pool exhaustion under report load |
| Multi-institution | **Architecturally impossible** without schema-wide change |

These are structural inferences, **not measurements**.

## Scores

- **Performance: 25 / 100**
- **Scalability: 20 / 100**

## Recommendations — in order, measurement-driven

1. **Add pagination to all list endpoints** (P1) — highest impact, mechanical.
2. **Add indexes** per P3 (P2) — cheap, immediate.
3. **Remove runtime DDL** (P1) — resolved by folding `FacultyLessonPlan` into the schema.
4. **Configure the connection pool**; fix `rejectUnauthorized: false` (P2).
5. **Batch the N+1 patterns** in `faculty.ts` (P2).
6. **Introduce a job queue** for reports and notifications (P2).
7. **Decide on multi-tenancy before Phase 3** (architectural).
8. **Then measure.** Add APM, run load tests, and let data drive caching and read-replica decisions.

**Do not** add Redis, read replicas, partitioning, or CDN speculatively. The brief is right to rule out complexity for its own sake — pagination and indexes will deliver more than any infrastructure addition at current scale.

## BLOCKED / NOT VERIFIED

- **No load testing, profiling, benchmarking, or query-plan analysis was performed.** Every figure is structural inference.
- **No `EXPLAIN ANALYZE`** was run — the database was not populated with realistic volumes.
- The scalability ceiling table is an estimate, not a measurement.
- Frontend bundle size and render performance were not measured (`npm run build` was not executed).
- No production instance was inspected.
