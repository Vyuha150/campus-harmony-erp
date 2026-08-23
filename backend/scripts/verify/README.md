# Live verification scripts

These exercise a **running server against a real database**. They are not unit
tests and deliberately do not run in CI: they need Postgres, a seeded database
and an authenticated session, and they assert on things a static test cannot
reach — that a database trigger actually refuses an UPDATE, that a role gate
actually returns 403, that a decision actually lands in an append-only log.

Every phase in this project has been signed off with a run of one of these. They
were previously kept outside the repository, which meant the evidence could not
be reproduced by anyone else; that is why they now live here.

## Running

Start the backend and seed the database first, then:

```bash
bash scripts/verify/verify-23-workflow-engine.sh
bash scripts/verify/verify-24-result-publication.sh
```

Each prints `PASS` / `FAIL` per property and exits non-zero on failure.

## Two conventions worth keeping

**Token caching.** The login limiter allows 5 attempts per 15 minutes per
`ip:email`. That limit is correct and must not be relaxed for a test, so the
scripts cache tokens between runs and re-authenticate only when a cached token
stops working.

**A check counter.** Each script declares `EXPECTED_CHECKS` and compares it to
the number of `pass`/`fail` calls actually made. This exists because of a real
incident: a broken arithmetic expansion caused one check to abort before
reporting either way, and the run printed `ALL CHECKS PASSED` while silently
skipping it. A harness that can skip a check and still report success is worse
than no harness. If the counts disagree, the run is reported INCOMPLETE and
treated as failed.
