# 08 — Role & Permission Matrix

**Roles defined:** 17, extracted from `backend/src/server.ts:46-64` and confirmed against `backend/prisma/seed.ts:116-134`.

---

## Enforcement model

Authorization is applied **once per module**, at mount time (`server.ts`):

```ts
app.use('/api/students', authenticate, authorizeRoles('student','librarian','super_admin'), studentRoutes);
```

`middleware/auth.ts:41-56`:

```ts
export const authorizeRoles = (...allowedRoles: string[]) => {
  return (req, res, next) => {
    const userRole = req.user?.role;
    if (!userRole) { res.status(401)…; return; }
    if (!allowedRoles.includes(userRole)) { res.status(403)…; return; }
    next();
  };
};
```

**This is enforced server-side and applied consistently** — `.includes()` everywhere, no `===` comparisons, no role logic that exists only in the UI. This is the strongest security property in the codebase and should be preserved through any refactor.

**Granularity is module-level only.** There is no per-endpoint, per-object, or per-department authorization.

## Module access matrix

| Module | Endpoints | Authorised roles |
|---|---:|---|
| `/api/auth` | 2 | public (`/login`), any authenticated (`/me`) |
| `/api/students` | 32 | `student`, `librarian`, `super_admin` |
| `/api/faculty` | 44 | `faculty`, `super_admin` |
| `/api/finance` | 34 | `finance_officer`, `super_admin` |
| `/api/admin` | 24 | `super_admin` |
| `/api/hod` | 70 | `hod`, `super_admin` |
| `/api/dean` | 40 | `dean`, `super_admin` |
| `/api/vc` | 33 | `vice_chancellor`, `pro_vc`, `super_admin` |
| `/api/registrar` | 34 | `registrar`, `super_admin` |
| `/api/coe` | 8 | `coe`, `super_admin` |
| `/api/alumni` | 20 | `alumni_officer`, `super_admin` |
| `/api/iqac` | 17 | `iqac_coordinator`, `super_admin` |
| `/api/placements` | 33 | `placement_officer`, `super_admin` |
| `/api/sports` | 30 | `sports_director`, `super_admin` |
| `/api/grievances` | 14 | `grievance_officer`, `super_admin` |
| `/api/security` | 35 | `security_officer`, `super_admin` |
| `/api/library` | 7 | `librarian`, `super_admin` |
| `/api/uploads` | 1 | **any authenticated user** |

## Effective capability matrix

Because access is module-level, a role that reaches a module can invoke **every** endpoint in it. VIEW/CREATE/EDIT/DELETE/APPROVE/EXPORT cannot be distinguished.

| Role | Modules reachable | Effective capability |
|---|---|---|
| `super_admin` | **17 of 18** | Unrestricted across the entire system |
| `student` | students | Full CRUD on all 32 student endpoints |
| `faculty` | faculty | Full CRUD on all 44 faculty endpoints, incl. grade mutation |
| `hod` | hod | Full CRUD on all 70 endpoints |
| `dean` | dean | Full CRUD on all 40 endpoints |
| `vice_chancellor` | vc | Full CRUD on all 33 endpoints |
| `pro_vc` | vc | **Identical to `vice_chancellor`** — no differentiation |
| `registrar` | registrar | Full CRUD on all 34 endpoints |
| `coe` | coe | Full CRUD on all 8 endpoints |
| `finance_officer` | finance | Full CRUD incl. payroll, journal entries, POs |
| `librarian` | library **+ students** | Library CRUD **and all 32 student endpoints** |
| `placement_officer` | placements | Full CRUD, incl. user creation (`placements.ts:157`) |
| `alumni_officer` | alumni | Full CRUD on all 20 endpoints |
| `iqac_coordinator` | iqac | Full CRUD on all 17 endpoints |
| `sports_director` | sports | Full CRUD on all 30 endpoints |
| `grievance_officer` | grievances | Full CRUD on all 14 endpoints |
| `security_officer` | security | Full CRUD, incl. password reset (`security.ts:288`) |

## Findings

### R1 — `super_admin` on 17 of 18 modules; no separation of duties (P1)

A single role holds unrestricted access to student records, grades, payroll, journal entries, disciplinary cases, vigilance cases and grievance evidence. There is:

- no break-glass or just-in-time elevation,
- no dual-control on sensitive operations (result publication, payroll release, degree issuance),
- **no logging of any admin action** — `SystemAuditLog` is never written (`05_DATABASE_AUDIT.md` D4).

An administrator can alter a grade, a payroll figure, or a disciplinary record with no trace whatsoever.

### R2 — `librarian` holds full student-module access (P1)

`server.ts:47` grants `librarian` all 32 `/api/students` endpoints — not a library-scoped subset. A library staff account can reach student academic, fee, hostel and certificate data. This is the clearest over-privilege in the matrix and appears to be a convenience grant for book-issue lookups.

**Fix:** expose a narrow `/api/students/lookup` for library purposes; remove `librarian` from the broad mount.

### R3 — Non-`super_admin` roles can create users and reset passwords (P1)

- `placements.ts:157` — the placement module creates users with a default password `'Student@123'`.
- `security.ts:288` — the security module generates a temporary password and (presumably) resets an account.

Both are identity operations sitting outside `/api/admin`. Account provisioning and credential reset should be a single audited privileged path, not a capability distributed across functional modules.

### R4 — No object-level authorization (P1)

Role grants module-wide access; nothing structurally binds a user to *their own* records. Verified positive case — `students.ts:12-14` derives identity from the JWT rather than client input:

```ts
const userId = (req as any).user.id;
const profile = await getOrCreateStudentProfile(userId);
```

This correctly prevents the classic IDOR. However, **this was verified only for `students.ts`.** Whether all 44 faculty endpoints constrain a lecturer to their own classes, or all 70 HOD endpoints to their own department, was **NOT VERIFIED** across 478 endpoints.

### R5 — No hierarchical scoping (P1)

The brief's required hierarchy — `Institution → Campus → School → Department → Programme → Batch → Section` — **does not exist in the schema**. Only `Department` is modelled. `User.campus` is a free-text `String?`.

Consequently an `hod` is not structurally scoped to their own department, and a `dean` not to their own school. Any such scoping must be re-implemented per endpoint, and cannot be enforced systematically.

### R6 — `pro_vc` and `vice_chancellor` are indistinguishable (P2)

Both mount `/api/vc` with identical rights. If the institution requires different authority (e.g. Pro-VC cannot approve certain policy items), that distinction is unrepresentable today.

### R7 — `/api/uploads` open to any authenticated user (P2)

`server.ts:64` — `app.use('/api/uploads', authenticate, uploadRoutes)`. No role restriction, no quota, no per-module permission. Combined with no MIME allowlist and unauthenticated file serving (`07_SECURITY_AUDIT.md` S2/S3), any logged-in user can publish arbitrary content on the API origin.

### R8 — Permissions are hardcoded, not configurable (P2)

Role→module mapping is compiled into `server.ts`. There is no permission table, no role-management UI backed by data, and no institution-specific customisation. `ModuleConfig` has a `roles Json?` field that *looks* intended for this — but it is not consulted by `authorizeRoles`. Changing any permission requires a code change and redeploy.

## Comparison against the brief's required role classes

| Required class | Present? | Notes |
|---|---|---|
| Ordinary operational users | ✅ | faculty, librarian, etc. |
| Institutional administrators | ✅ | `registrar`, `super_admin` |
| Academic leadership | ✅ | `hod`, `dean`, `vice_chancellor`, `pro_vc` |
| Examination authorities | ✅ | `coe` |
| Finance personnel | ✅ | `finance_officer` |
| Students | ✅ | `student` |
| Faculty | ✅ | `faculty` |
| Compliance / IQAC | ✅ | `iqac_coordinator` |
| **Auditors (read-only)** | ❌ | **No read-only role exists anywhere** |
| Super administrators | ✅ | `super_admin` — but over-broad |

**The absence of a read-only auditor role is significant for accreditation**, where external assessors need inspection access without mutation rights. No role in the system is read-only; every role with module access has full write access to that module.

## Priority fixes

1. Remove `librarian` from the broad `/api/students` mount (**P1**).
2. Introduce a read-only `auditor` role (**P1**).
3. Centralise user creation and password reset into audited admin-only paths (**P1**).
4. Add object-level checks — bind faculty to their classes, HOD to their department (**P1**).
5. Add the institutional hierarchy to the schema so scoping can be structural (**P1**).
6. Write `SystemAuditLog` for every privileged action (**P0**, tracked in `05_DATABASE_AUDIT.md`).
7. Move role→permission mapping into data (`ModuleConfig.roles`) and consult it in middleware (**P2**).
8. Differentiate `pro_vc` from `vice_chancellor` (**P2**).

## BLOCKED / NOT VERIFIED

- **Per-endpoint object-level authorization across all 478 endpoints.** Only `students.ts` confirmed.
- **No runtime authorization testing** — no attempt was made to call an endpoint with a mismatched role token against a running server.
- Whether `security.ts:288` password reset requires the target user's consent or a forced change on next login.
