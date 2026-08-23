# 15 — Dependency Vulnerability Triage (A3)

**Date:** 2026-08-19 · **Method:** `npm audit fix` (semver-compatible only), then verify build/tests/migrations. **No `--force`.**

Per audit rule 28: *"Do not automatically upgrade every package to newest. Determine compatibility first."*

---

## Result

| Package | Before | After | Reduction |
|---|---:|---:|---:|
| **Frontend** | 32 (1 critical, 22 high) | **4** (0 critical, 1 high) | **−88%** |
| **Backend** | 21 (0 critical, 13 high) | **4** (0 critical, 3 high) | **−81%** |
| **Total** | **53** | **8** | **−85%** |

**The one critical vulnerability is eliminated.**

### Verified after upgrading

| Check | Result |
|---|---|
| Frontend production build | ✅ Passes (13.6s) |
| Backend typecheck | ✅ 0 errors |
| Backend tests | ✅ 66 passing |
| `prisma generate` | ✅ OK |
| `prisma migrate status` | ✅ 4 migrations, schema up to date |

Nothing regressed.

---

## Deliberately NOT applied

### 1. Prisma "fix" is a **downgrade** — rejected

npm proposes resolving three `high` findings with `prisma@6.12.0`. The project runs **Prisma 7**.

Accepting it would:
- drop from v7 to v6 — a **major downgrade**
- break `@prisma/adapter-pg`, the driver-adapter setup in `lib/prisma.ts`
- break the tenant-isolation Prisma extension (`$extends` client-extension API)
- risk invalidating all four migrations

`npm audit fix` resolves by *version range satisfaction*, not by *correctness*. Applying it here would cause a far worse outcome than the vulnerability.

**What was done instead:** the Prisma CLI moved **7.5.0 → 7.9.1** (a safe minor upgrade within v7). The transitive advisory is `deepmerge-ts` — *"stack exhaustion when merging recursive object graphs"* — reached only through Prisma's own config loading, which processes our `prisma.config.ts`, not user input.

**Assessment:** not reachable by an attacker through this application. **Accepted risk**, revisit when Prisma ships a v7 release with the updated transitive.

### 2. `vite` 5 → 8 — deferred

One `high` on the frontend. Requires jumping **three major versions**.

The advisory (`esbuild`, and its backend counterpart) is *"arbitrary file read when running the development server"* — it affects the **dev server only, not production builds**. Production serves static assets from `dist/`; the vulnerable dev server never runs there.

**Assessment:** no production exposure. Deferred as planned work with a compatibility check, not an emergency.
**Mitigation now:** do not run the dev server on an untrusted network.

### 3. `react-router-dom` 6 → 7 — deferred

Two `moderate`. A v6 → v7 migration touches routing across 133 components and would need the full frontend regression pass that does not yet exist (T-216).

**Assessment:** moderate severity, meaningful migration cost, no test net. Schedule alongside the frontend work in `07_FRONTEND_IMPLEMENTATION_PLAN.md`.

---

## Remaining — 8 total

| Severity | Package | Scope | Decision |
|---|---|---|---|
| high | `prisma` / `@prisma/config` / `deepmerge-ts` | Backend, build-time | **Rejected fix** (downgrade). Not attacker-reachable |
| high | `vite` | Frontend, **dev only** | Deferred — no production exposure |
| moderate | `esbuild` | Frontend, **dev only** | Same as vite |
| moderate | `react-router` / `react-router-dom` | Frontend runtime | Deferred — needs migration + tests |
| low | `esbuild` | Backend, dev only | Deferred |

**None is reachable by an attacker against a production deployment.**

---

## CI enforcement

`.github/workflows/ci.yml` blocks on **critical** for the backend today:

```yaml
- name: Audit backend (blocks on critical)
  run: npm audit --audit-level=critical
```

Set deliberately: with the Prisma finding unresolvable without a harmful downgrade, `--audit-level=high` would fail every build and train people to ignore CI. **Tighten to `high` once the Prisma transitive is resolved upstream.**

## Follow-up

| # | Action | Priority |
|---|---|---|
| 1 | Watch for a Prisma v7 release updating `deepmerge-ts`; then raise CI to `--audit-level=high` | P2 |
| 2 | Plan `vite` 5→8 with a build/dev smoke test | P2 |
| 3 | Plan `react-router` 6→7 after frontend tests exist (T-216) | P3 |
| 4 | Add Dependabot/Renovate for continuous visibility | P3 |
| 5 | Review `lovable-tagger` and `@testsprite/testsprite-mcp` — third-party tooling in the build path | P2 |
