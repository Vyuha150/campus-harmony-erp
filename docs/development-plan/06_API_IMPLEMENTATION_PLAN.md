# 06 — API Implementation Plan

## Current state

478 endpoints across 18 route files, 12,108 lines. All business logic lives in route handlers; `hod.ts` alone is 1,882 lines.

**Done in Phase 0:** every handler now returns a consistent error contract. The pattern

```ts
catch (error: any) { res.status(500).json({ success: false, message: error.message }); }
```

was replaced across all 478 handlers with `sendError(res, error)`, which maps typed errors to correct status codes and never echoes internal detail. Verified: a missing student profile now returns **404**, not 500.

## API standard (target)

Every endpoint must have:

```
Authentication → Authorization → Validation → Service → Transaction
  → Audit → Consistent response → Structured error
```

### Response contract

```jsonc
// Success
{ "success": true, "data": { ... }, "meta": { "page": 1, "pageSize": 50, "total": 1284 } }

// Error  ← implemented in Phase 0
{ "success": false,
  "error": { "code": "NOT_FOUND", "message": "Student profile was not found.",
             "details": { }, "requestId": "b82a6a4a-..." } }
```

`requestId` correlates to the server log line — quotable in a bug report.

### Status codes

| Code | Meaning | Error class |
|---|---|---|
| 200/201 | Success | — |
| 400 | Malformed / failed validation | `ValidationError` |
| 401 | Not authenticated | `AuthenticationError` |
| 403 | Authenticated, not permitted | `AuthorizationError` |
| 404 | Does not exist | `NotFoundError` |
| 409 | Conflicts with current state | `ConflictError` |
| 422 | Valid but violates an institutional rule | `BusinessRuleError` |
| 429 | Rate limited | — |
| 500/502 | Server / integration fault | `DatabaseError`, `IntegrationError` |

## T-203 — Service layer extraction ← the critical next task

**The highest-leverage change in the whole plan.**

```
routes/<module>.ts     thin HTTP: parse params → call service → format response
services/<module>.ts   business logic, transactions, audit emission
repositories/<module>  typed Prisma access — no `any`
schemas/<module>.ts    zod request/response contracts
```

Why it comes before validation, transactions and object-level authz:

| Concern | Per-endpoint | Via services |
|---|---:|---:|
| Validation | 478 | ~18 |
| Transactions | 478 | per operation |
| **Audit** | **478** | **1** |
| Object-level authz | 478 | per service |

**Migration order** — smallest and most self-contained first, to establish the pattern at low risk:

1. `library.ts` (7 endpoints) — pattern proving ground
2. `coe.ts` (8) — exam-critical, small
3. `grievances.ts` (14) — statutory, best-modelled workflow
4. `iqac.ts` (17), `alumni.ts` (20), `admin.ts` (24)
5. `sports.ts` (30), `students.ts` (32), `placements.ts` (33), `vc.ts` (33)
6. `finance.ts` (34), `registrar.ts` (34), `security.ts` (35)
7. `dean.ts` (40), `faculty.ts` (44), `hod.ts` (70)

Each module: extract → add zod schema → wrap writes in transactions → emit audit → add tests → verify no regression.

## T-202 — Validation

`zod` is already a **frontend** dependency; the backend has none, so client validation currently provides zero security value.

```ts
// schemas/student.ts
export const createStudentSchema = z.object({
  name: z.string().min(2).max(120),
  email: z.string().email(),
  rollNumber: z.string().regex(/^[A-Z0-9-]{4,20}$/),
  programmeId: z.string().uuid(),
  semester: z.number().int().min(1).max(12)
});

// routes/students.ts
router.post('/', validate(createStudentSchema), asyncHandler(handler));
```

Validation must reject unknown keys (`.strict()`) — the mass-assignment fix in `PUT /admin/users` was needed precisely because `req.body` was spread into Prisma `data`.

## T-204 — Transactions

**4 uses across 478 endpoints.** These must become atomic:

| Operation | Must be atomic with |
|---|---|
| Fee payment | receipt + ledger entry + audit |
| Marks approval | result publication + audit |
| Course registration | seat decrement |
| Student promotion | academic record creation |
| Payroll run | journal entry |
| Result publication | SGPA + CGPA + publication state |

Pattern — audit inside the transaction for sensitive records:

```ts
await prisma.$transaction(async (tx) => {
  const updated = await tx.enrollment.update({ where: { id }, data: { grade } });
  await tx.gradeHistory.create({ data: { enrollmentId: id, oldGrade, newGrade: grade, reason, changedBy } });
  await recordInTransaction(tx, { action: 'UPDATE', module: 'examination', /* … */ });
  return updated;
});
```

A grade change that cannot be audited must not commit.

## T-206 — Pagination

42 of 478 endpoints paginate (~9%). Standard: `?page=1&pageSize=50&sort=field:asc`, `pageSize` capped at 200, `meta.total` always returned. Mandatory on every list endpoint — enforced in the repository layer so it cannot be forgotten.

## T-205 — Idempotency

Required on: fee payment, payment callbacks, enrollment, result publication, bulk import, notification dispatch. `Idempotency-Key` header → stored key + response hash; a repeat returns the original response instead of re-executing.

## Missing endpoints (Phases 4–11)

| Domain | Endpoints needed | Blocked by |
|---|---|---|
| Admissions | ~40 | Phase 4 academic core |
| Examination lifecycle | ~50 | Phase 4 |
| OBE | ~25 | Phase 6 |
| Programme/curriculum | ~30 | Phase 3 |
| Credits/ABC | ~15 | Phase 4 |
| Bulk import/export | ~12 | Phase 2 |
| Notification delivery | ~10 | Phase 9 |
| Reporting | ~25 | Phase 10 |

## OpenAPI

Once services and zod schemas exist, generate the spec from the schemas — a hand-written spec drifts. Zod → OpenAPI keeps documentation and validation from diverging, and gives the frontend generated types, eliminating the `unknown`-typed responses causing 18 of the 22 frontend type errors.

## Sequence

| Order | Task | Priority |
|---:|---|---|
| ✅ | Error contract across all handlers | P2 |
| 1 | **T-203 service layer** (start with `library.ts`) | P2 → unblocks everything |
| 2 | T-202 validation | P1 |
| 3 | T-204 transactions | P1 |
| 4 | T-206 pagination | P1 |
| 5 | T-305 object-level authz | P1 |
| 6 | T-205 idempotency | P1 |
| 7 | OpenAPI generation | P2 |
