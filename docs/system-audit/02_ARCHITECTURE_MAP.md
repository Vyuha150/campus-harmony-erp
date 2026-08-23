# 02 — Architecture Map (Reconstructed From Code)

Architecture below is derived by reading the repository, not from documentation or assumption.

## Stack (verified)

| Layer | Technology | Evidence |
|---|---|---|
| Frontend framework | React 18.3 + TypeScript 5.8 | `package.json` |
| Build tool | Vite 5.4 + `@vitejs/plugin-react-swc` | `vite.config.ts` |
| Routing | `react-router-dom` 6.30 | `src/App.tsx` |
| Server state | `@tanstack/react-query` 5.83 | `package.json` |
| Client state | React Context + `zustand` 5.0 | `src/context/AuthContext.tsx` |
| Forms / validation | `react-hook-form` + `zod` 3.25 | frontend only — **not used in backend** |
| Design system | Tailwind 3.4 + shadcn/ui over Radix primitives | `components.json`, `src/components/ui/` |
| Charts | `recharts` 2.15 | `src/components/dashboard/Charts.tsx` |
| HTTP client | `axios` 1.13 (single shared instance) | `src/lib/api.ts` |
| Backend runtime | Node.js + Express **5.2** | `backend/package.json` |
| Backend execution | `tsx` (TypeScript run directly, no build step) | `backend/package.json` scripts |
| ORM | Prisma **7.5** with `@prisma/adapter-pg` driver adapter | `backend/src/lib/prisma.ts` |
| Database | PostgreSQL | `schema.prisma` datasource |
| Auth | `jsonwebtoken` (HS256 default) + `bcrypt` cost 10 | `middleware/auth.ts` |
| File upload | `multer` 2.1, disk storage | `routes/uploads.ts` |
| Process manager | PM2 (`ecosystem.config.cjs`) | port 8725, `NODE_ENV=development` |
| Frontend hosting | Vercel static build + SPA rewrite | `vercel.json` |

**Absent by verification:** no Docker, no CI/CD (`.github/` does not exist), no queue, no cache/Redis, no worker process, no cron/scheduler, no object storage, no OpenAPI/Swagger spec, no `.env.example`.

## Actual request path

The system has **four layers, not seven**. There is no service layer, no domain layer, and no repository layer — route handlers call Prisma directly.

```
Browser (React SPA, port 8080)
   │
   ├─ AuthContext ──► localStorage['token']
   │
   ├─ src/lib/api.ts (axios instance)
   │     └─ request interceptor: attach `Bearer <token>`
   │        ✗ NO response interceptor → 401 never triggers logout
   │
   ▼  HTTP  (VITE_API_BASE_URL, default http://localhost:5000/api)
┌──────────────────────────────────────────────────────────┐
│ Express app (backend/src/server.ts)                       │
│   cors({ origin: 'http://localhost:8080' })  ← hardcoded  │
│   express.json()                                          │
│   express.static('/uploads')  ← ✗ MOUNTED BEFORE AUTH     │
├──────────────────────────────────────────────────────────┤
│   authenticate         → verify JWT, attach {id, role}    │
│   authorizeRoles(...)  → allowedRoles.includes(user.role) │
├──────────────────────────────────────────────────────────┤
│   Route handler (business logic lives HERE)               │
│     ✗ no validation layer                                 │
│     ✗ no service layer                                    │
│     ✗ no repository layer                                 │
│     ✗ no transaction boundary (4 uses / 478 endpoints)    │
├──────────────────────────────────────────────────────────┤
│   prisma / `const db: any = prisma`  ← type checking off  │
└──────────────────────────────────────────────────────────┘
   ▼
PostgreSQL — 95 models + 1 runtime-created shadow table
```

### Module mounting (`server.ts:46-64`)

Every module is mounted with route-level RBAC. This is the strongest part of the architecture.

```ts
app.use('/api/auth', authRoutes);                         // public (login) + /me
app.use('/api/students',  authenticate, authorizeRoles('student','librarian','super_admin'), studentRoutes);
app.use('/api/faculty',   authenticate, authorizeRoles('faculty','super_admin'), facultyRoutes);
app.use('/api/finance',   authenticate, authorizeRoles('finance_officer','super_admin'), financeRoutes);
app.use('/api/admin',     authenticate, authorizeRoles('super_admin'), adminRoutes);
// … hod, dean, vc, registrar, coe, alumni, iqac, placements,
//    sports, grievances, security, library, uploads
```

## Module inventory — 478 endpoints across 18 files

| Module | Endpoints | LOC | Authorised roles |
|---|---:|---:|---|
| `hod.ts` | 70 | 1,882 | `hod`, `super_admin` |
| `faculty.ts` | 44 | 1,532 | `faculty`, `super_admin` |
| `dean.ts` | 40 | 1,209 | `dean`, `super_admin` |
| `security.ts` | 35 | 778 | `security_officer`, `super_admin` |
| `registrar.ts` | 34 | 627 | `registrar`, `super_admin` |
| `finance.ts` | 34 | 652 | `finance_officer`, `super_admin` |
| `vc.ts` | 33 | 652 | `vice_chancellor`, `pro_vc`, `super_admin` |
| `placements.ts` | 33 | 869 | `placement_officer`, `super_admin` |
| `students.ts` | 32 | 1,274 | `student`, `librarian`, `super_admin` |
| `sports.ts` | 30 | 339 | `sports_director`, `super_admin` |
| `admin.ts` | 24 | 434 | `super_admin` |
| `alumni.ts` | 20 | 335 | `alumni_officer`, `super_admin` |
| `iqac.ts` | 17 | 352 | `iqac_coordinator`, `super_admin` |
| `grievances.ts` | 14 | 406 | `grievance_officer`, `super_admin` |
| `coe.ts` | 8 | 322 | `coe`, `super_admin` |
| `library.ts` | 7 | 297 | `librarian`, `super_admin` |
| `auth.ts` | 2 | 82 | public / authenticated |
| `uploads.ts` | 1 | 66 | any authenticated user |
| **Total** | **478** | **12,108** | 17 distinct roles |

## Architectural findings

### A1 — No service or domain layer (P1)
Business logic is inline in route handlers. `hod.ts` is 1,882 lines of mixed HTTP concerns, business rules, and data access. Consequences: logic cannot be unit-tested without HTTP, cannot be reused across modules, and is duplicated across role files (dashboard aggregation logic is re-implemented per role).

### A2 — Type safety deliberately disabled (P1)
`const db: any = prisma` appears at the top of the large route files (`faculty.ts:8`, `students.ts:8`). Every call through `db.` is unchecked. This is why only 36 backend type errors surface across 12,108 lines — most of the code is invisible to the compiler.

### A3 — Runtime schema mutation (P1)
`faculty.ts:10-26` issues `CREATE TABLE IF NOT EXISTS "FacultyLessonPlan"` inside request handling. The table is not in `schema.prisma`. This creates permanent drift between the declared schema and the real database, and executes DDL on a hot path.

### A4 — No tenant dimension (P1 if SaaS intended)
No model carries an `institutionId`, `tenantId`, or `campusId`. `User.campus` is a free-text `String?`. The system is **single-institution by construction**. Multi-institution SaaS operation would require a schema-wide change to all 95 models plus every query. See `13_PERFORMANCE_SCALABILITY.md`.

### A5 — Deployment topology is inconsistent (P2)
Three different port assumptions coexist: `server.ts:72` defaults to `5000`; `ecosystem.config.cjs` sets `PORT: 8725`; `server.ts:35` hardcodes CORS origin `http://localhost:8080`. `vercel.json` deploys the frontend as a static SPA with **no backend deployment configuration at all** — the API has no defined production host.

### A6 — Frontend data layer is reasonably centralised (positive)
`src/lib/api.ts` provides one axios instance; `src/lib/apiService.ts`, `src/hooks/useApiData.ts`, `useRoleData.ts`, `useStudentData.ts` layer on top. 121 of 133 components consume this. `src/lib/dataStore.ts` and `src/data/studentMockData.ts` are **dead code** — imported by zero components.

## Recommended target architecture (minimal, not fashionable)

No microservices, no Kubernetes, no event sourcing — the workload does not justify them. The gap is layering and integrity, not distribution.

```
routes/      thin HTTP: parse, call service, format response
  ↓
validation/  zod schema per endpoint, applied as middleware
  ↓
services/    business logic, transaction boundaries, audit emission
  ↓
repositories/ Prisma access, typed, no `any`
  ↓
prisma/      schema + versioned migrations (currently absent)
```

Add, in this order: (1) migration baseline, (2) validation middleware, (3) service layer with transactions and audit hooks, (4) background worker for reports/notifications, (5) caching only when measurement justifies it.
