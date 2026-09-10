-- 0042 - Self-service password reset.
--
-- There was no self-service recovery path at all: a forgotten password could
-- only be fixed by an administrator manually setting a new one. This table
-- backs a real forgot-password / reset-password flow.
--
-- Only the SHA-256 of the raw token is stored, matching the discipline
-- already applied to `User.password` — a leaked table must not itself grant
-- account takeover. Not tenant-scoped, for the same reason RateLimitWindow
-- (0041) is not: this exists before any tenant context is resolved, and
-- `userId` alone reaches the right account.

CREATE TABLE "PasswordResetToken" (
    "id"        TEXT NOT NULL,
    "userId"    TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMPTZ(3) NOT NULL,
    "usedAt"    TIMESTAMPTZ(3),
    "createdAt" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "requestIp" TEXT,

    CONSTRAINT "PasswordResetToken_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PasswordResetToken_tokenHash_key" ON "PasswordResetToken"("tokenHash");
CREATE INDEX "PasswordResetToken_userId_idx" ON "PasswordResetToken"("userId");
CREATE INDEX "PasswordResetToken_expiresAt_idx" ON "PasswordResetToken"("expiresAt");

ALTER TABLE "PasswordResetToken" ADD CONSTRAINT "PasswordResetToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
