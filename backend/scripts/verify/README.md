# Live verification scripts

These exercise the application **against a real database**. They are not unit
tests: they need a seeded MongoDB database and assert on things a static test
cannot reach.

```bash
npx tsx scripts/verify/verify-service-scoping.ts   # tenant isolation in the service layer
npm run verify:results                             # publishing results recomputes CGPA
```

Each prints `PASS` / `FAIL` per property and exits non-zero on failure.

The earlier `verify-*.sh` scripts were removed with the move to MongoDB: they
asserted on PostgreSQL objects through `psql` (foreign keys, CHECK constraints,
the append-only triggers on `WorkflowTransition`) that MongoDB does not have.
Those guarantees now rest on the application layer alone — see the note in the
project README before relying on any of them.

## A convention worth keeping

**A check counter.** Each script declares `EXPECTED_CHECKS` and compares it to
the number of `pass`/`fail` calls actually made. A harness that can skip a check
and still report success is worse than no harness. If the counts disagree, the
run is reported INCOMPLETE and treated as failed.
