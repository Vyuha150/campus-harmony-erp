# Runbook — Backup & Recovery

**Owner:** Platform / DevOps · **Last verified:** 2026-08-19 (restore drill PASSED)

---

## Why this document exists

Before 2026-08-19 there was **no backup capability**. `BackupRecord` was a model the Admin UI read from, populated by a seed row describing a fictional 122 MB backup to `s3://campus-harmony-backups/daily/`. The screen reported a capability the system did not have.

That row has been deleted and backups are now real, verified, and restorable.

## Commands

```bash
npm run backup
```

```bash
npm run backup:list
```

```bash
npm run backup:verify
```

```bash
npm run backup:prune
```

| Command | What it does |
|---|---|
| `backup` | `pg_dump -Fc -Z9`, verifies the dump is listable, records SHA-256 and a `BackupRecord` row |
| `backup:list` | Backups on disk, newest first |
| `backup:verify` | **Restore drill** — restores the newest backup into a scratch database and confirms it is usable |
| `backup:prune` | Deletes backups past `BACKUP_RETENTION_DAYS` |

## Configuration

| Variable | Default | Notes |
|---|---|---|
| `BACKUP_DIR` | `backups` | **Must be off-host durable storage in production** |
| `PG_BIN_DIR` | *(PATH)* | Directory holding `pg_dump`/`pg_restore`/`psql` |
| `BACKUP_RETENTION_DAYS` | `30` | Confirm against statutory retention for academic records |
| `BACKUP_VERIFY_DB` | `campus_harmony_restore_check` | Scratch DB for drills. **Never the live database** |

## Last verified drill — 2026-08-19

```
source            campus_harmony_2026-08-19T09-42-13-823Z.dump (236.4 KB)
target            campus_harmony_restore_check  [scratch]
tables restored   121
duration          2.5s
RESULT            PASS
```

Row-count comparison, live vs restored — all matched:

| Table | Live | Restored |
|---|---:|---:|
| User | 23 | 23 |
| StudentProfile | 2 | 2 |
| Institution | 2 | 2 |
| AdmissionApplication | 5 | 5 |
| AdmissionSeatMatrix | 4 | 4 |
| SystemAuditLog | 20 | 20 |
| FeeRecord | 2 | 2 |

The admitted student (`BTCSE20260001`) and both institutions survived intact — tenant isolation is preserved through a restore.

## Safety guarantees

1. **A backup is verified at creation.** `pg_restore --list` must show table data, or the backup is marked `failed`. A dump that cannot be read is not a backup.
2. **Restore refuses to overwrite the live database.** Verified:
   ```
   BLOCKED - Refusing to restore over the live database "campus_harmony".
   ```
   Overriding requires `allowOverwriteLiveDatabase: true`, which exists only for genuine recovery.
3. **Restore recreates the target** so it never merges into existing data.
4. **Restore uses `--exit-on-error`** — a partial restore fails loudly instead of producing a half-populated database.
5. **SHA-256 recorded** so silent corruption is detectable later.

---

## Recovery procedure

### Scenario A — restore to a point in time (data loss or corruption)

1. **Stop the application.** Prevent writes during recovery.
   ```bash
   pm2 stop backend
   ```
2. **Identify the backup.**
   ```bash
   npm run backup:list
   ```
3. **Rehearse into the scratch database first.** Never restore straight over production.
   ```bash
   npm run backup:verify
   ```
4. **Take a safety backup of the current (damaged) state** — you may need it for forensics.
   ```bash
   npm run backup
   ```
5. **Restore.** Requires the explicit override:
   ```bash
   npx tsx -e "import('./src/lib/backup.js').then(m=>m.restoreBackup({filePath:'<path>',targetDatabase:'campus_harmony',allowOverwriteLiveDatabase:true}))"
   ```
6. **Verify** row counts against expectations before restarting.
7. **Apply migrations** in case the backup predates the current schema:
   ```bash
   npx prisma migrate deploy
   ```
8. **Restart and check readiness:**
   ```bash
   curl -s http://localhost:5000/api/ready
   ```
9. **Record the incident** — what was lost, the recovery window, and root cause.

### Scenario B — total host loss

1. Provision a new host with PostgreSQL and the same major version.
2. Retrieve the newest off-host backup.
3. Create the database, restore, run `prisma migrate deploy`.
4. Restore uploaded files **separately** — see the gap below.
5. Repoint DNS / load balancer.

---

## Outstanding gaps — stated plainly

These are **not** solved by this work and must not be assumed:

| Gap | Impact | Tracked |
|---|---|---|
| **Backups are local-disk only** | A host loss destroys the backups with the data. **This is the largest remaining risk.** | A1-followup |
| **No off-host replication** | Needs S3/equivalent with server-side encryption | A1-followup |
| **No automated schedule** | Backups are manual until a cron/scheduled job exists | A1-followup |
| **Uploaded files are not backed up** | `pg_dump` covers the database only; `uploads/` is on ephemeral local disk | A5 |
| **No PITR** | Only full dumps; WAL archiving would reduce RPO to minutes | A1-followup |
| **RPO/RTO not agreed** | Measured restore is 2.5s at current volume, but no target has been set with the institution | — |
| **Encryption at rest not configured** | Dumps are unencrypted on disk | A1-followup |

> **Current honest position:** backups exist, are verified, and are provably restorable. They are **not yet disaster-proof** — a host loss would take the backups with it. Off-host replication is the immediate next step.

## Schedule (recommended, not yet implemented)

| When | Action |
|---|---|
| Daily 02:00 | `npm run backup` → replicate off-host |
| Weekly | `npm run backup:verify` — drill, and alert on failure |
| Monthly | Full recovery rehearsal into a staging host |
| Quarterly | Review retention against statutory obligations |
