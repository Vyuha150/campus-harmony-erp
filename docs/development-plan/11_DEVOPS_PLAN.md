# 11 — DevOps Plan

## Before → Now

| Capability | Before | Now |
|---|---|---|
| Database migrations | ❌ **None** for 95 models | ✅ **Baseline created and applied** |
| Environment template | ❌ None | ✅ `.env.example` documents every variable |
| Config validation | ❌ Silent unsafe defaults | ✅ Fails fast at boot |
| Readiness check | ❌ Static `{status:'healthy'}` | ✅ `/api/ready` verifies the database |
| Structured logging | ❌ `console.error` only | ✅ JSON + correlation IDs + redaction |
| Security headers | ❌ None | ✅ nosniff, DENY, CSP, HSTS (prod) |
| Backend tests | ❌ No runner | ✅ vitest, 19 passing |
| Connection pool | ❌ Unconfigured | ✅ Sized and tunable |
| CI/CD | ❌ None | ❌ **Still none** |
| Backups | ❌ Façade model | ❌ **Still none** |

## Deployment (works today)

```bash
cd backend
cp .env.example .env       # set DATABASE_URL; generate JWT_SECRET
npx prisma migrate deploy  # versioned, non-destructive
npm run start
```

Generate a secret:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

**Never** `prisma db push` against a shared database — it is destructive by design.

The server now refuses to start on invalid configuration and reports every problem at once. A server that will not start is recoverable; one that silently trusts forged admin tokens is not.

## T-109 — Backup & restore (P0, not started)

**The highest-priority remaining DevOps task.** `BackupRecord` is a model with no implementation — the seed inserts a row describing a fictional S3 backup and the Admin UI displays it. Same façade pattern as the audit log was.

Required:

| Element | Requirement |
|---|---|
| Schedule | Nightly full + WAL archiving for PITR |
| Storage | Off-host, encrypted at rest |
| Retention | Defined per record class, with legal input |
| **Restore drill** | **Rehearsed and documented** |
| RPO / RTO | Explicit, agreed targets |
| File backup | After T-209 (object storage) |
| Verification | Automated integrity check per backup |

> A backup that has never been restored is not a backup.

## T-020 — CI pipeline (P1, not started)

Nothing currently enforces quality. Proposed gates:

```
install → lint → typecheck → unit tests → integration tests
  → npm audit → build → migration validation → artifact
```

| Gate | Threshold |
|---|---|
| Typecheck | **0 errors** — backend is there now; keep it |
| Unit tests | All pass (19 today) |
| `npm audit` | No new critical/high |
| Migrations | Apply cleanly to an empty database |
| Build | Succeeds |

Migration validation matters most: it catches a migration that works against a developer's drifted database but fails on a clean one.

## T-018 — Dependency vulnerabilities (P1)

53 total (frontend 32 incl. 1 critical; backend 21). Triage the critical and high findings with compatibility testing — **do not bulk-upgrade**. Also review `lovable-tagger` and `@testsprite/testsprite-mcp`, both third-party tooling in the build path.

## T-D1 — Deployment target (P1)

`vercel.json` deploys **only the frontend**. There is no backend deployment configuration — no Dockerfile, no Procfile, no host.

Three conflicting port assumptions previously coexisted; `PORT` and `CORS_ORIGINS` are now configurable, which removes the hardcoded-localhost blocker. Still needed: a backend host, a container image, and `NODE_ENV=production` (`ecosystem.config.cjs` currently sets `development`).

## T-209 — File storage (P1)

Uploads sit on ephemeral local disk (`process.cwd()/uploads`): lost on redeploy, not shared across instances, absent from any backup, no lifecycle policy. For a system storing degree certificates, grievance evidence and accreditation documents this is data loss waiting to happen.

Move to S3-compatible object storage behind a `StorageProvider` interface, with a `FileMetadata` model carrying owner, module, allowed roles and checksum — which also enables the per-file authorization still missing from the upload fix.

## Observability roadmap

| Signal | Now | Next |
|---|---|---|
| Structured logs | ✅ JSON + `requestId` | Ship to an aggregator |
| Error tracking | ❌ | Sentry-class, with `requestId` correlation |
| Metrics | ❌ | API latency, error rate, DB pool utilisation |
| **Failed logins** | ✅ Logged + rate-limited | Alert on spikes — now possible |
| **Audit events** | ✅ Written | Alert on privileged actions |
| Health / readiness | ✅ Both | Wire to orchestrator probes |
| Slow queries | ❌ | `pg_stat_statements` |

Failed-login and audit alerting are newly *possible* — neither had any data source before Phase 0.

## Environment separation

| Env | `NODE_ENV` | Seeding | Notes |
|---|---|---|---|
| Development | `development` | Allowed | |
| Test | `test` | `ALLOW_SEED=yes` | Disposable DB |
| Staging | `production` | **Refused** | Production-like |
| Production | `production` | **Refused** | HTTPS-only CORS enforced |

The seed guard exists because that script creates 17 privileged accounts sharing one repository-visible password.

## Repository hygiene (P3)

| Issue | Action |
|---|---|
| `.env` committed and tracked | Untrack; extend `.gitignore` |
| Three lockfiles (`package-lock`, `bun.lock`, `bun.lockb`) | Standardise on one |
| Duplicate PM2 configs (`.cjs` + `.js`) | Remove one |
| README claims MIT, links a non-existent LICENSE | Add the file or correct the claim |
| README says `ts-node` / port 3000; actual is `tsx` / 8080 | Correct |
| `testsprite_exec_log.txt` committed | Remove; gitignore |

## Sequence

| Order | Task | Priority |
|---:|---|---|
| ✅ | Migration baseline, `.env.example`, config validation, readiness, logging, headers, tests | P0/P1 |
| 1 | **T-109 backup + tested restore** | **P0** |
| 2 | T-020 CI pipeline | P1 |
| 3 | T-018 dependency triage | P1 |
| 4 | T-D1 backend deployment target | P1 |
| 5 | T-209 object storage | P1 |
| 6 | Error tracking + metrics | P1 |
| 7 | Repository hygiene | P3 |

## Production gate

| Gate | Status |
|---|---|
| Deploys reproducibly | ✅ Migrations exist |
| Config validated | ✅ Fails fast |
| Rolls back safely | 🔶 Migrations exist; no rehearsed rollback |
| **Recovers from failure** | ❌ **No backups** |
| Detects failure | 🔶 Logs + readiness; no alerting |
| Diagnoses failure | ✅ Correlation IDs |
| Verifies before deploy | ❌ No CI |
| Protects secrets | ✅ No fallback; validated |
| Scales horizontally | ❌ Local disk uploads; in-process rate limiter |

**Not production-ready — backups and CI are the blocking items.**
