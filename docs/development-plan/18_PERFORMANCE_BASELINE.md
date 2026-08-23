# 18 — Performance Baseline (Phase 1.5)

**Measured:** 2026-08-23 · **First performance measurement ever taken on this system.**

Everything previously said about performance in this repository was reasoning
about indexes and locking. This is measurement.

---

## Method

| | |
|---|---|
| Volume | **5,005 students · 10,003 fee records · 5,004 course results · 5,026 users** |
| Samples | 20 per endpoint, p50 and p95 |
| Environment | Local PostgreSQL 17, Node dev server (`tsx watch`), same machine |

Rows were inserted directly via SQL, not through the bulk importer: the importer
bcrypt-hashes a password per account, which is deliberately slow (~30 minutes at
this volume) and irrelevant to the read paths being measured. Every synthetic row
was tagged (`perf-*` ids, `perf+…@synthetic.invalid` emails) and **removed after
measurement** — the database is back to 5 students and 26 users.

**This is a dev-machine baseline, not a production figure.** It has no network
latency, no concurrency, and a warm local database. Treat it as a floor and a
regression reference, not as a capacity estimate.

---

## Results

| Endpoint | p50 | p95 |
|---|---|---|
| `library/dashboard` | 7 ms | 24 ms |
| `library/books?pageSize=25` | 7 ms | 9 ms |
| `library/books?pageSize=100` | 6 ms | 27 ms |
| `library/students?pageSize=25` | 6 ms | 8 ms |
| `library/students?pageSize=100` | 8 ms | 10 ms |
| `reports` (catalogue) | 4 ms | 20 ms |
| **`reports/EXAM_PASS_RATE`** | **13 ms** | **34 ms** |
| `reports/ADMISSIONS_INTAKE` | 8 ms | 31 ms |
| `reports/FACULTY_QUALIFICATION` | 5 ms | 6 ms |
| `import/jobs` | 5 ms | 7 ms |

**Nothing exceeded 35 ms at p95.** The indexes added alongside each module are
doing their job at this scale. `EXAM_PASS_RATE` is the heaviest, which is
expected — it aggregates across all 5,004 course results.

Pagination caps also held: `pageSize=100` was not materially slower than
`pageSize=25`, so the page-size limit is protecting the endpoints as intended.

---

## What the measurement found that testing had not

**The finance module was unreachable by the finance officer.**

The latency run called the ledger endpoint as each role. As `finance_officer` it
returned **403**. The cause: the finance module gated on a role named
`accountant`, **which does not exist in this system**.

The consequence was not a subtle one — the person whose job is recording payments
and reading ledgers could not use any of the finance module, for either reading
or writing. Every earlier verification had run as `super_admin` or `registrar`,
so nothing caught it.

Fixed to `finance_officer` and verified: **HTTP 200**.

A guard was added (`src/__tests__/roles.test.ts`) that fails if any
`authorizeRoles()` call references a role the system does not issue — including a
negative control proving the check rejects `accountant`. A sweep found no other
invented roles.

**Why this class of bug is dangerous:** a nonexistent role in a gate does not
throw. The gate simply never matches, and the endpoint is silently unreachable.
It looks exactly like a deliberate permissions decision.

---

## Not measured

- **Concurrency.** All samples were sequential. Lock contention under parallel
  writes — the row-locking in issue/payment/seat-allocation — is unmeasured.
- **Write paths.** Payment recording, bulk import and attainment computation were
  not timed.
- **Larger scale.** 5,000 students is mid-size. A multi-campus university with
  50,000+ is untested, and the 20,000-row importer cap is a known ceiling.
- **Cold cache**, network latency, or a production-grade server.
- The **frontend**: ~20 s to first paint in dev, from the unsplit ~2.1 MB bundle.
  Code-splitting is Phase 4.

## How to re-run
`scratchpad/perf_seed.sql` seeds the volume; `scratchpad/perf_measure.sh` takes
the samples. Both tag and clean up after themselves.
