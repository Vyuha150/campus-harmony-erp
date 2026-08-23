-- ═══════════════════════════════════════════════════════════════════════════
-- 0014 — Bulk import
--
-- Additive only. No existing table is touched, so this migration carries none
-- of the backfill risk of 0010/0012.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "ImportJob" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "contentHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "dryRun" BOOLEAN NOT NULL DEFAULT false,
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "validRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "importedRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "failureReason" TEXT,
    "startedBy" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportJob_institutionId_idx" ON "ImportJob"("institutionId");
CREATE INDEX "ImportJob_status_idx" ON "ImportJob"("status");
-- Supports the duplicate-file check: re-uploading the same content is caught
-- before it duplicates a student roll.
CREATE INDEX "ImportJob_institutionId_contentHash_idx" ON "ImportJob"("institutionId", "contentHash");

CREATE TABLE "ImportError" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "rowNumber" INTEGER NOT NULL,
    "column" TEXT,
    "value" TEXT,
    "errorType" TEXT NOT NULL,
    "message" TEXT NOT NULL,

    CONSTRAINT "ImportError_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ImportError_jobId_idx" ON "ImportError"("jobId");
CREATE INDEX "ImportError_jobId_rowNumber_idx" ON "ImportError"("jobId", "rowNumber");

-- CASCADE here is correct and deliberate, unlike the RESTRICT used for
-- receipts and loans: an error message has no meaning once its job is gone.
ALTER TABLE "ImportError" ADD CONSTRAINT "ImportError_jobId_fkey"
    FOREIGN KEY ("jobId") REFERENCES "ImportJob"("id") ON DELETE CASCADE ON UPDATE CASCADE;
