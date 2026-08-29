-- 0040 - Tenant key for SystemNotificationRecord.
--
-- Same audit, admin.ts's turn: `sentBy` is a free-text string, not a foreign
-- key, so SystemNotificationRecord has no relation to derive an owner from.
-- GET /admin/notifications, /admin/systemnotifications and POST
-- /admin/notifications were all global — every institution's system
-- notifications visible to (and, on create, mixed in with) every other
-- institution's.
--
-- SystemAuditLog, checked in the same pass, does NOT need this: it already
-- has a real `userId -> User` relation (added in migration 0019), so
-- GET /admin/audit-logs and the two analytics endpoints built on it are fixed
-- by scoping through that relation instead, in the same commit as this
-- migration.

ALTER TABLE "SystemNotificationRecord" ADD COLUMN IF NOT EXISTS "institutionId" TEXT;
UPDATE "SystemNotificationRecord"
SET "institutionId" = '00000000-0000-4000-8000-000000000001'
WHERE "institutionId" IS NULL AND id LIKE 'seed-%';

DO $$
DECLARE n INT;
BEGIN
  SELECT COUNT(*) INTO n FROM "SystemNotificationRecord" WHERE "institutionId" IS NULL;
  IF n > 0 THEN
    RAISE EXCEPTION 'Cannot scope % row(s) in SystemNotificationRecord: no owner can be derived and they are not seed rows. Assign them deliberately - see migration 0040.', n;
  END IF;
END $$;

ALTER TABLE "SystemNotificationRecord" ALTER COLUMN "institutionId" SET NOT NULL;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'SystemNotificationRecord_institutionId_fkey') THEN
    ALTER TABLE "SystemNotificationRecord"
      ADD CONSTRAINT "SystemNotificationRecord_institutionId_fkey"
      FOREIGN KEY ("institutionId") REFERENCES "Institution"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS "SystemNotificationRecord_institutionId_idx" ON "SystemNotificationRecord"("institutionId");
