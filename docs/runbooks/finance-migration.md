# Runbook — Finance migration (0010 / 0011)

**Applies to:** migrations `20260820140000_0010_finance` and
`20260820150000_0011_finance_enforce_scope`.

**Read this before running `prisma migrate deploy` on an existing database.**

---

## What these migrations do

`0010` adds the payment/receipt/idempotency tables, and adds `institutionId` to
`FeeRecord` and `FeeStructure` — both of which were previously **unscoped**. A
fee query without an explicit filter returned every institution's dues.

`0011` makes `FeeStructure.institutionId` `NOT NULL`.

They are deliberately two migrations. `FeeRecord` ownership can be derived from
the student it belongs to; `FeeStructure` carries no owning reference at all, so
on a multi-institution database **a human has to decide**. Splitting them gives
you a point at which to record that decision.

---

## Before you start

Take a backup. This alters financial tables.

```bash
npm run backup
```

Verify the backup restores before proceeding — see
[backup-and-recovery.md](backup-and-recovery.md). An untested backup is a
hypothesis.

---

## Expected outcomes

### Single-institution database

Both migrations apply with no intervention. `FeeStructure` rows are assigned to
the only institution that exists.

### Multi-institution database

`0010` applies and emits a warning:

```
WARNING: N FeeStructure row(s) could not be scoped automatically
```

`0011` then **fails deliberately**, naming the affected rows:

```
ERROR: 1 FeeStructure row(s) have no institutionId and cannot be scoped automatically.
Affected id(s): seed-fee-structure-1
```

This is the migration working correctly. It refuses to guess because a fee
structure attributed to the wrong institution generates incorrect fee demands
for real students — an error those students discover before you do.

---

## Resolving unscoped fee structures

1. List the institutions:

```bash
psql -d campus_harmony -c 'SELECT id, name, code FROM "Institution";'
```

2. Inspect the unassigned rows and decide who owns each. `program` and
   `academicYear` are usually enough to identify them:

```bash
psql -d campus_harmony -c 'SELECT id, "academicYear", semester, program, "totalAmount" FROM "FeeStructure" WHERE "institutionId" IS NULL;'
```

3. Assign each one:

```bash
psql -d campus_harmony -c 'UPDATE "FeeStructure" SET "institutionId" = '"'"'<institution-uuid>'"'"' WHERE id = '"'"'<row-id>'"'"';'
```

4. Mark the failed migration rolled back, then re-run:

```bash
npx prisma migrate resolve --rolled-back 20260820150000_0011_finance_enforce_scope
```

```bash
npx prisma migrate deploy
```

---

## If `0010` fails on orphaned fee records

`0010` aborts if a `FeeRecord` has no matching `StudentProfile`:

```
ERROR: Cannot scope N FeeRecord row(s): no matching StudentProfile.
```

These are financial records belonging to nobody. **Do not delete them to make
the migration pass** — they may represent real money received. Find them:

```bash
psql -d campus_harmony -c 'SELECT fr.* FROM "FeeRecord" fr LEFT JOIN "StudentProfile" sp ON fr."studentProfileId" = sp.id WHERE sp.id IS NULL;'
```

Then reconcile with the finance office before continuing. The migration is
blocking you on purpose.

---

## Verifying afterwards

```bash
psql -d campus_harmony -c 'SELECT COUNT(*) FROM "FeeRecord" WHERE "institutionId" IS NULL;'
```

Expected: `0`. The column is `NOT NULL`, so a non-zero result means the
migration did not apply.

Check that the derived paid amounts agree with the recorded statuses:

```bash
psql -d campus_harmony -c 'SELECT status, COUNT(*), SUM("amount"), SUM("paidAmount") FROM "FeeRecord" GROUP BY status;'
```

Rows with `status = ''paid''` should have `paidAmount = amount`. `0010`
backfills this, but pre-existing data may have disagreed before the migration —
the ledger endpoint surfaces any remaining mismatch as `storedStatusMismatch`
rather than silently correcting it.

---

## Rollback

There is no down-migration. To revert, restore the backup taken above.

Dropping the new tables by hand would leave `FeeRecord.institutionId` in place
and the Prisma migration history inconsistent with the schema.
