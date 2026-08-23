-- ═══════════════════════════════════════════════════════════════════════════
-- 0010 — Finance: transactional payments, receipts, idempotency
--
-- Two things happen here:
--
--   1. FeeRecord and FeeStructure gain `institutionId`. They were UNSCOPED,
--      meaning a fee query without an explicit filter returned every
--      institution's dues. The backfill below derives the owner from the
--      student's existing scope rather than guessing.
--
--   2. Payment / PaymentAllocation / Receipt / IdempotencyKey are added so that
--      money operations are atomic and repeat-safe.
--
-- No data is destroyed. The backfill is written explicitly rather than left to
-- a default, because a wrong institutionId on a fee record is a financial
-- misattribution, not a cosmetic defect.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── 1. Tenant-scope the existing fee tables ────────────────────────────────

ALTER TABLE "FeeRecord" ADD COLUMN "institutionId" TEXT;
ALTER TABLE "FeeRecord" ADD COLUMN "paidAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FeeRecord" ADD COLUMN "waivedAmount" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "FeeRecord" ADD COLUMN "waiverReason" TEXT;

-- Derive ownership from the student the record belongs to. StudentProfile was
-- scoped in migration 0002, so this is authoritative rather than a guess.
UPDATE "FeeRecord" fr
SET "institutionId" = sp."institutionId"
FROM "StudentProfile" sp
WHERE fr."studentProfileId" = sp."id"
  AND fr."institutionId" IS NULL;

-- Any record whose student no longer exists cannot be attributed. Rather than
-- assign it arbitrarily, fail the migration so a human decides. If this fires,
-- the orphans must be investigated — they represent money with no owner.
DO $$
DECLARE orphans INTEGER;
BEGIN
  SELECT COUNT(*) INTO orphans FROM "FeeRecord" WHERE "institutionId" IS NULL;
  IF orphans > 0 THEN
    RAISE EXCEPTION
      'Cannot scope % FeeRecord row(s): no matching StudentProfile. These are orphaned financial records and must be reconciled by hand before this migration can proceed.',
      orphans;
  END IF;
END $$;

ALTER TABLE "FeeRecord" ALTER COLUMN "institutionId" SET NOT NULL;

-- Existing rows already carry a paid state in `status`; reflect it in the new
-- numeric column so the two do not disagree from day one.
UPDATE "FeeRecord" SET "paidAmount" = "amount" WHERE "status" = 'paid';

CREATE INDEX "FeeRecord_institutionId_idx" ON "FeeRecord"("institutionId");
CREATE INDEX "FeeRecord_studentProfileId_idx" ON "FeeRecord"("studentProfileId");
CREATE INDEX "FeeRecord_status_idx" ON "FeeRecord"("status");

-- FeeStructure has no student to derive from, so ownership is only unambiguous
-- when a single institution exists.
--
-- The column is added NULLABLE here and made NOT NULL in migration 0011. That
-- split is deliberate: an earlier draft raised an exception on ambiguity, which
-- was correct to refuse but left the operator stuck — the failed migration
-- rolls back, so the column they were told to populate did not exist. Two
-- migrations give them somewhere to put the answer.
ALTER TABLE "FeeStructure" ADD COLUMN "institutionId" TEXT;

DO $$
DECLARE inst_count INTEGER; only_inst TEXT; unresolved INTEGER;
BEGIN
  SELECT COUNT(*) INTO inst_count FROM "Institution";

  IF inst_count = 1 THEN
    SELECT "id" INTO only_inst FROM "Institution" LIMIT 1;
    UPDATE "FeeStructure" SET "institutionId" = only_inst WHERE "institutionId" IS NULL;
  END IF;

  SELECT COUNT(*) INTO unresolved FROM "FeeStructure" WHERE "institutionId" IS NULL;

  IF unresolved > 0 THEN
    -- A warning, not an exception. Migration 0011 enforces it.
    RAISE WARNING
      '% FeeStructure row(s) could not be scoped automatically (% institutions exist). Assign "institutionId" on those rows before running migration 0011 — see docs/runbooks/finance-migration.md',
      unresolved, inst_count;
  END IF;
END $$;

CREATE INDEX "FeeStructure_institutionId_idx" ON "FeeStructure"("institutionId");

-- ── 2. Payments ────────────────────────────────────────────────────────────

CREATE TABLE "Payment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "method" TEXT NOT NULL,
    "transactionReference" TEXT,
    "gateway" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "paidAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reconciledAt" TIMESTAMP(3),
    "recordedBy" TEXT NOT NULL,
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- Payment numbers are unique per institution, not globally: two institutions
-- may legitimately both issue PAY-2026-000001.
CREATE UNIQUE INDEX "Payment_institutionId_paymentNumber_key" ON "Payment"("institutionId", "paymentNumber");
CREATE INDEX "Payment_institutionId_idx" ON "Payment"("institutionId");
CREATE INDEX "Payment_studentProfileId_idx" ON "Payment"("studentProfileId");
CREATE INDEX "Payment_status_idx" ON "Payment"("status");
CREATE INDEX "Payment_transactionReference_idx" ON "Payment"("transactionReference");

-- A payment must be positive. A negative "payment" is a refund and belongs in
-- its own flow with its own approval, not smuggled in through this table.
ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive" CHECK ("amount" > 0);

CREATE TABLE "PaymentAllocation" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "feeRecordId" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PaymentAllocation_paymentId_feeRecordId_key" ON "PaymentAllocation"("paymentId", "feeRecordId");
CREATE INDEX "PaymentAllocation_feeRecordId_idx" ON "PaymentAllocation"("feeRecordId");

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_amount_positive" CHECK ("amount" > 0);

ALTER TABLE "PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ── 3. Receipts ────────────────────────────────────────────────────────────

CREATE TABLE "Receipt" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "receiptNumber" TEXT NOT NULL,
    "financialYear" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "amountInWords" TEXT,
    "studentName" TEXT NOT NULL,
    "rollNumber" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedBy" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "cancelledAt" TIMESTAMP(3),
    "cancelledBy" TEXT,
    "cancellationReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Receipt_paymentId_key" ON "Receipt"("paymentId");
CREATE UNIQUE INDEX "Receipt_institutionId_receiptNumber_financialYear_key"
    ON "Receipt"("institutionId", "receiptNumber", "financialYear");
CREATE INDEX "Receipt_institutionId_idx" ON "Receipt"("institutionId");
CREATE INDEX "Receipt_verificationCode_idx" ON "Receipt"("verificationCode");

-- RESTRICT, not CASCADE: deleting a payment must not silently destroy the
-- receipt issued for it. A receipt is a document the student holds.
ALTER TABLE "Receipt" ADD CONSTRAINT "Receipt_paymentId_fkey"
    FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- ── 4. Idempotency ─────────────────────────────────────────────────────────

CREATE TABLE "IdempotencyKey" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "operation" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "responseBody" JSONB,
    "responseStatus" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyKey_pkey" PRIMARY KEY ("id")
);

-- This unique index IS the concurrency control. Two simultaneous requests with
-- the same key race to insert; the loser gets a unique violation and replays
-- the winner's response instead of performing the operation again.
CREATE UNIQUE INDEX "IdempotencyKey_institutionId_key_key" ON "IdempotencyKey"("institutionId", "key");
CREATE INDEX "IdempotencyKey_institutionId_idx" ON "IdempotencyKey"("institutionId");
CREATE INDEX "IdempotencyKey_expiresAt_idx" ON "IdempotencyKey"("expiresAt");
