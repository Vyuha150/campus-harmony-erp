# 15 — DevOps & Production Readiness

## Inventory

| Capability | Present | Evidence |
|---|---|---|
| CI/CD pipeline | ❌ | `.github/` does not exist; no GitLab/Jenkins/CircleCI config |
| Dockerfile | ❌ | Only inside `node_modules/bcrypt` |
| docker-compose | ❌ | — |
| Kubernetes / IaC | ❌ | — |
| **Database migrations** | ❌ | `backend/prisma/migrations/` does not exist |
| **`.env.example`** | ❌ | No template anywhere |
| Process manager | 🟡 | `ecosystem.config.cjs` (PM2), backend only |
| Frontend deployment | 🟡 | `vercel.json` — static SPA |
| **Backend deployment** | ❌ | No production host defined anywhere |
| Health endpoint | 🟡 | `/api/health` — static, no DB check |
| Structured logging | ❌ | `console.error` only |
| Monitoring / alerting | ❌ | — |
| Backup / restore | ❌ | `BackupRecord` model exists; **no backup code** |
| Disaster recovery | ❌ | — |
| Secret management | ❌ | `.env` files only; `.env` is committed |
| Rollback strategy | ❌ | No migrations to roll back |

## D1 — No migrations means no safe deployment (P0)

With no `migrations/` directory, the only way to materialise the 95-model schema is `prisma db push` — a development command that diffs and force-applies schema changes.

**Concretely, deploying this system today risks data destruction.** `prisma db push` can drop columns and tables to reconcile drift, and there is no migration history, no rollback, and no backup mechanism to recover from it.

The brief asks specifically whether deployment could destroy data, reset the database, or rerun destructive seeds. Answers:

| Risk | Present? | Detail |
|---|---|---|
| Deployment destroys data | **Yes** | `prisma db push` is the only path |
| Deployment resets DB | **Possible** | Drift reconciliation may drop objects |
| Destructive seed re-run | **Mitigated** | `seed.ts` uses `upsert` throughout — idempotent by design ✅ |
| Development credentials exposed | **Yes** | Seed creates 17 privileged accounts sharing `Password@123` (`seed.ts:7`) |
| Incompatible migrations | **N/A** | None exist |

**Positive:** the seed script is genuinely well built — `upsert` with stable seed IDs, and a `assertSeedSchema()` preflight (`seed.ts:55-89`) that verifies 17 required tables exist and fails with a clear message otherwise. This is careful work.

**But:** it creates `super_admin`, `vice_chancellor`, `registrar`, `finance_officer` and 13 other privileged accounts with a shared, repository-visible default password. If seed ever runs against a live environment, that is immediate total compromise. There is no guard preventing it (no `NODE_ENV` check in `seed.ts`).

## D2 — Environment configuration is undocumented (P0 contributor)

No `.env.example`. Required variables, discoverable only by reading source:

| Variable | Consumed at | Consequence if unset |
|---|---|---|
| `DATABASE_URL` | `lib/prisma.ts:6` | ✅ Fails fast with a clear message — **good** |
| **`JWT_SECRET`** | `middleware/auth.ts:4`, `routes/auth.ts:8` | 🔴 **Silently falls back to `'supersecretkey123'`** — auth bypass |
| `PORT` | `server.ts:72` | Defaults to 5000 |
| `SEED_DEFAULT_PASSWORD` | `seed.ts:7` | Defaults to `Password@123` |
| `VITE_API_BASE_URL` | `src/lib/api.ts:5` | Defaults to `http://localhost:5000/api` |

The contrast is instructive: `DATABASE_URL` fails loudly and correctly; `JWT_SECRET` fails silently and catastrophically. The correct pattern already exists in the codebase — it simply was not applied to the security-critical variable.

## D3 — No deployment target for the backend (P1)

`vercel.json` deploys **only the frontend** as a static SPA. There is no backend deployment configuration — no Dockerfile, no Procfile, no serverless config, no host.

Meanwhile three port assumptions conflict:

- `server.ts:72` → `PORT || 5000`
- `ecosystem.config.cjs` → `PORT: 8725`
- `server.ts:35` → CORS hardcoded to `http://localhost:8080`

`ecosystem.config.cjs` also sets `NODE_ENV: 'development'`. Both `ecosystem.config.cjs` and `ecosystem.config.js` exist — duplicate, potentially divergent configs.

**The frontend deploys to Vercel and would call `http://localhost:5000/api`** unless `VITE_API_BASE_URL` is set at build time. CORS would reject it regardless, since the allowed origin is hardcoded to localhost.

## D4 — File uploads on ephemeral local disk (P1)

`uploads.ts:10` — `path.resolve(process.cwd(), 'uploads')`; `server.ts:30-31` creates it at boot.

Local disk storage means: files lost on container restart or redeploy; no sharing across instances (horizontal scaling breaks downloads); no CDN; no lifecycle or retention policy; not included in any backup.

For an ERP storing degree certificates, grievance evidence and accreditation documents, **local ephemeral storage is data loss waiting to happen.** Object storage (S3-compatible) is required.

## D5 — No observability (P1)

| Question an operator must answer | Answerable? |
|---|---|
| What failed? | 🟡 `console.error(err.stack)` to stdout only |
| For whom? | ❌ No user context in logs |
| Where? | ❌ No correlation/request IDs |
| Why? | 🟡 Stack trace only |
| How often? | ❌ No metrics |
| Was it authorised? | ❌ **Audit log never written** |

Absent: structured/JSON logging, log aggregation, correlation IDs, error tracking (Sentry-class), metrics (API/DB latency, error rates), distributed tracing, failed-job visibility, auth-failure monitoring, and uptime checks. Failed logins are neither logged nor counted — brute force would be invisible.

## D6 — Backup and disaster recovery do not exist (P0)

`BackupRecord` is a **model with no implementation** — the seed inserts a row describing a fictional backup to `s3://campus-harmony-backups/daily/`, and the Admin UI displays it. There is no backup code, no scheduler, no restore path, no retention policy, no tested recovery, no RPO/RTO.

This is the same façade pattern as `SystemAuditLog`: a UI reporting a capability the system does not have. **For an institutional record system, absent backup is P0.**

## D7 — No CI/CD (P1)

No pipeline exists. Nothing enforces: type checking (58 errors would be caught), linting, tests, dependency audit (53 vulns), build verification, or migration checks. Every deployment is manual and unverified.

## D8 — Repository hygiene (P2)

| Issue | Detail |
|---|---|
| `.env` committed | Tracked in a public repo. Currently only `VITE_API_BASE_URL`; `.gitignore` covers only `.env*.local` |
| `testsprite_exec_log.txt` | Tool output committed to root |
| Duplicate lockfiles | `package-lock.json`, `bun.lock`, `bun.lockb` — three lockfiles, ambiguous install |
| Duplicate PM2 configs | `ecosystem.config.cjs` + `ecosystem.config.js` |
| No LICENSE | README claims MIT and links `[LICENSE](LICENSE)` — **the file does not exist** |
| README inaccurate | Instructs `npx ts-node backend/prisma/seed.ts` and states the app runs on port 3000; actual is `tsx` and port 8080 |

## Production readiness gate

| Gate | Status |
|---|---|
| Deploys reproducibly | ❌ No migrations, no backend target |
| Rolls back safely | ❌ No rollback path |
| Recovers from failure | ❌ No backups |
| Detects failure | ❌ No monitoring |
| Diagnoses failure | ❌ No structured logs |
| Verifies before deploy | ❌ No CI |
| Protects secrets | ❌ Hardcoded fallback, `.env` committed |
| Scales horizontally | ❌ Local disk uploads, no shared state |

**Score: 5 / 100.**

## Minimum path to deployability

**Before any production deployment:**

1. Generate a **baseline migration**; switch to `prisma migrate deploy` (**P0**)
2. Remove the `JWT_SECRET` fallback; **fail fast** (**P0**)
3. Add `.env.example` documenting every variable (**P0**)
4. Implement **automated backups with a tested restore** (**P0**)
5. Guard `seed.ts` against non-development environments (**P0**)
6. Move uploads to object storage, behind authentication (**P0/P1**)
7. Define a backend deployment target; make CORS and ports configurable (**P1**)
8. Add CI: typecheck → lint → test → audit → build (**P1**)
9. Add structured logging with correlation IDs and error tracking (**P1**)
10. Make `/api/health` verify the database; add readiness (**P2**)
11. Resolve duplicate lockfiles and PM2 configs; add LICENSE; correct README (**P3**)

## BLOCKED / NOT VERIFIED

- No deployment was attempted; no staging or production environment was inspected.
- `npm run build` was **not executed** — production build viability is unverified.
- Whether any deployed instance exists (the repo lists homepage `vyuha1.vercel.app`) and how it is configured was **not investigated**.
- Backup/restore claims are based on code absence, not on inspecting infrastructure that may exist outside the repository.
