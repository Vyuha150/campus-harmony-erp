-- 0033 - Tenant keys for the remaining finance models.
--
-- Vendor, PurchaseOrder, BudgetAllocation and PayrollRecord carried no
-- institutionId and were absent from TENANT_OWNED_MODELS. All four were global.
--
-- PayrollRecord is the one that matters most: it holds an employee's salary,
-- allowances, deductions and net pay. Every finance officer in the deployment
-- could read every institution's payroll, and nothing in the record would show
-- that a boundary had been crossed. Purchase orders and budgets are the same
-- shape with money attached.
--
-- Backfill: these tables have no user or student reference to derive from, so
-- rows are assigned only where their id marks them as seed data. The rule from
-- 0027/0028 applies unchanged - a payroll row filed under the wrong university
-- is somebody's salary in a stranger's ledger.

ALTER TABLE "Vendor"           ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "PurchaseOrder"    ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "BudgetAllocation" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
ALTER TABLE "PayrollRecord"    ADD COLUMN IF NOT EXISTS "institutionId" TEXT;

UPDATE "Vendor"           SET "institutionId"='00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL AND id LIKE 'seed-%';
UPDATE "PurchaseOrder"    SET "institutionId"='00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL AND id LIKE 'seed-%';
UPDATE "BudgetAllocation" SET "institutionId"='00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL AND id LIKE 'seed-%';
UPDATE "PayrollRecord"    SET "institutionId"='00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE t TEXT; n INT;
BEGIN
  FOREACH t IN ARRAY ARRAY['Vendor','PurchaseOrder','BudgetAllocation','PayrollRecord']
  LOOP
    EXECUTE format('SELECT COUNT(*) FROM %I WHERE "institutionId" IS NULL', t) INTO n;
    IF n > 0 THEN
      RAISE EXCEPTION 'Cannot scope % row(s) in %: not seed data and no owner can be derived. Assign them deliberately.', n, t;
    END IF;
  END LOOP;
END $$;

ALTER TABLE "Vendor"           ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "PurchaseOrder"    ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "BudgetAllocation" ALTER COLUMN "institutionId" SET NOT NULL;
ALTER TABLE "PayrollRecord"    ALTER COLUMN "institutionId" SET NOT NULL;

DO $$
DECLARE t TEXT;
BEGIN
  FOREACH t IN ARRAY ARRAY['Vendor','PurchaseOrder','BudgetAllocation','PayrollRecord']
  LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = t || '_institutionId_fkey') THEN
      EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE', t, t || '_institutionId_fkey');
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON %I("institutionId")', t || '_institutionId_idx', t);
  END LOOP;
END $$;

-- `poNumber` was GLOBALLY unique. Two universities each numbering a purchase
-- order PO-2026-001 would collide, and the second could not raise it - the same
-- correctness bug fixed for Department code, Course code and grievanceNumber.
DROP INDEX IF EXISTS "PurchaseOrder_poNumber_key";
ALTER TABLE "PurchaseOrder" DROP CONSTRAINT IF EXISTS "PurchaseOrder_poNumber_key";
CREATE UNIQUE INDEX IF NOT EXISTS "PurchaseOrder_institutionId_poNumber_key"
  ON "PurchaseOrder"("institutionId","poNumber");
