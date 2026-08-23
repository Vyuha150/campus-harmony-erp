# ADR-0001 — Multi-Tenancy Strategy

**Status:** Accepted · **Date:** 2026-08-19
**Decision made by:** Product owner (multi-institution confirmed) + *Comprehensive ERP Blueprint for Indian Universities (NAAC/UGC/NIRF Aligned)*

---

## Context

The audit found **no tenant dimension anywhere** in the 95-model schema. No model carried `institutionId` or `tenantId`; `User.campus` was a free-text `String?`. The system was single-institution by construction.

This was flagged as the single most expensive decision to defer: adding tenancy after the academic core is built means touching all 95 models, every query and every index a second time.

The blueprint is explicit about the required model:

> "Data is segmented by campus/college **while remaining in one database**. Every student and staff profile is tagged with their respective campus, every course is linked to the campus/college that offers it… **It's like multi-tenancy but with controlled sharing at the top level.**"

And on access scoping:

> "Roles like VC, Registrar, or Group Finance Officer have access to all campuses' information. Roles like Principal, campus admin, or campus finance officer are limited to their campus."

> "Ensure that users only access their relevant campus data unless they have multi-campus roles."

## Decision

**Shared database, shared schema, row-level tenant scoping via a discriminator column,** with a two-level scope: **Institution** (hard boundary) and **Campus** (soft boundary within an institution).

```
Institution (tenant root — the university)     ← hard isolation boundary
  └── Campus / Constituent College             ← soft boundary, role-scoped
        └── School / Faculty
              └── Department
                    └── Programme
                          └── Batch
                                └── Section
```

### Rules

1. **Every tenant-owned row carries `institutionId`.** Non-negotiable, including on join tables.
2. **Tenant context is derived server-side from the authenticated principal — never from a request parameter, header or body field.** A client-supplied tenant id is ignored entirely.
3. **Cross-institution access is impossible.** Not "restricted" — there is no code path that permits it. A cross-tenant read is a P0 security incident.
4. **Cross-campus access is a role capability.** `scopeLevel: INSTITUTION` roles (VC, Pro-VC, Registrar, CoE, Group Finance) see all campuses. `scopeLevel: CAMPUS` roles (Principal, campus admin, campus finance officer) see only their own.
5. **Every tenant-scoped query goes through the repository layer**, which injects the scope. Raw `prisma.*` calls in route handlers are prohibited once the service layer lands (T-203).
6. **Composite indexes lead with `institutionId`**, because every query filters on it.

## Alternatives considered

| Option | Isolation | Cost | Verdict |
|---|---|---|---|
| **Database per tenant** | Strongest | 95 models × N migrations; connection-pool explosion; cross-campus reporting requires cross-DB queries — which the blueprint explicitly requires ("VC's dashboard can aggregate enrollment and results from all campuses") | ❌ Rejected — contradicts the blueprint's "one database" requirement and makes group-level rollup expensive |
| **Schema per tenant (PostgreSQL schemas)** | Strong | Prisma has weak multi-schema support; migrations must fan out; still awkward for consolidated reporting | ❌ Rejected — operational burden without the benefit the blueprint asks for |
| **Row-level scoping (chosen)** | Good, if enforced consistently | One migration set; consolidated reporting is a normal query; matches the blueprint verbatim | ✅ **Accepted** |
| **PostgreSQL Row-Level Security (RLS)** | Defence in depth | Prisma's driver-adapter pooling makes per-request `SET LOCAL` session variables unreliable | 🔶 **Deferred** — revisit as a second layer once the service layer exists |

## Consequences

### Positive
- Matches the blueprint's stated architecture exactly.
- Consolidated cross-campus reporting (a NAAC/NIRF requirement) is an ordinary query.
- One migration set; one connection pool; simple operations.
- Onboarding a new campus is a data insert, not a deployment.

### Negative — and how each is mitigated
| Risk | Mitigation |
|---|---|
| **A single forgotten `WHERE institutionId` leaks data across universities** | Scoping enforced in the repository layer, never per-query; cross-tenant tests in CI; RLS deferred as a second layer |
| Noisy-neighbour performance | `institutionId`-leading composite indexes; per-tenant rate limiting later |
| Accidental global unique constraints | Tenant-scoped uniqueness: `@@unique([institutionId, code])`, not `@unique(code)` |
| Bulk export must not span tenants | Export path goes through the same scoped repository |

### The constraint this imposes

**Global uniqueness must become tenant-scoped.** Today `Department.code`, `Course.code` and `User.email` are globally `@unique`. Two universities both having a "CSE" department is normal and must be permitted.

`User.email` is the exception: it stays **globally unique**, because email is the login identifier and a person must resolve to exactly one account. A user belonging to multiple institutions is handled by a membership table if that requirement ever appears — not by duplicating accounts.

## Migration path

1. Create the hierarchy models — `Institution`, `Campus`, `School`, `Programme`, `Batch`, `Section`.
2. Create a default institution and campus; backfill all existing rows to it. **Existing single-institution data is preserved**, not discarded.
3. Add `institutionId` to tenant-owned models, initially nullable.
4. Backfill, then make non-nullable and add foreign keys.
5. Convert global unique constraints to tenant-scoped composites.
6. Add tenant context middleware and repository scoping.
7. Add cross-tenant isolation tests.

Steps 1–2 are non-destructive and reversible.

## Compliance implications

- **NAAC:** the blueprint notes NAAC may accredit campuses separately — campus-scoped reporting is required, and this model provides it.
- **NIRF:** submissions are per-institution; the tenant boundary *is* the submission boundary.
- **Data protection:** cross-tenant leakage of student records would be a serious breach. This is the primary reason isolation is a P0-tested property rather than a convention.

## Review triggers

Revisit if: a tenant requires physical data residency in a different jurisdiction; one tenant's volume degrades others; or a customer contractually requires a dedicated database.
