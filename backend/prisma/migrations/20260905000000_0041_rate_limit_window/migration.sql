-- 0041 - Shared rate-limit counters.
--
-- The login throttle kept its counters in a Map inside the process. Two
-- consequences, both observed rather than theorised:
--
--   1. Restarting the server cleared a live lockout. That happened during this
--      project's own testing: the login limit was hit, the backend restarted,
--      and the next attempt went straight through. Anything that can crash or
--      redeploy the process resets the protection.
--
--   2. N instances meant N times the limit, since each process counted only
--      the attempts it happened to receive.
--
-- Development plan item F1 names Redis. The requirement is a store shared by
-- every instance; Redis is one way to get one and PostgreSQL — already a hard
-- dependency here — is another. Postgres is used because it can be verified in
-- this environment today.
--
-- Not tenant-scoped on purpose: these rows are written BEFORE authentication,
-- when no institution is known.

CREATE TABLE "RateLimitWindow" (
    "key"     TEXT NOT NULL,
    "count"   INTEGER NOT NULL,
    "resetAt" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "RateLimitWindow_pkey" PRIMARY KEY ("key")
);

-- Supports pruning expired windows without scanning the table.
CREATE INDEX "RateLimitWindow_resetAt_idx" ON "RateLimitWindow"("resetAt");
