-- CreateTable
CREATE TABLE "GovernanceCommittee" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "campusId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "purpose" TEXT,
    "constitutedUnder" TEXT,
    "meetingFrequency" TEXT,
    "constitutedOn" TIMESTAMP(3),
    "dissolvedOn" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GovernanceCommittee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMember" (
    "id" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "userId" TEXT,
    "externalName" TEXT,
    "externalAffiliation" TEXT,
    "role" TEXT NOT NULL DEFAULT 'member',
    "tenureFrom" TIMESTAMP(3) NOT NULL,
    "tenureTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommitteeMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommitteeMeeting" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "committeeId" TEXT NOT NULL,
    "meetingNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "heldAt" TIMESTAMP(3),
    "venue" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "agenda" JSONB,
    "attendance" JSONB,
    "minutes" TEXT,
    "minutesApproved" BOOLEAN NOT NULL DEFAULT false,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "resolutions" JSONB,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommitteeMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InstitutionalPolicy" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "campusId" TEXT,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "supersedesPolicyId" TEXT,
    "summary" TEXT,
    "content" TEXT,
    "fileUrl" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvingBody" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "reviewDueOn" TIMESTAMP(3),
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InstitutionalPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GovernanceCommittee_institutionId_idx" ON "GovernanceCommittee"("institutionId");

-- CreateIndex
CREATE INDEX "GovernanceCommittee_type_idx" ON "GovernanceCommittee"("type");

-- CreateIndex
CREATE UNIQUE INDEX "GovernanceCommittee_institutionId_code_key" ON "GovernanceCommittee"("institutionId", "code");

-- CreateIndex
CREATE INDEX "CommitteeMember_committeeId_idx" ON "CommitteeMember"("committeeId");

-- CreateIndex
CREATE INDEX "CommitteeMember_userId_idx" ON "CommitteeMember"("userId");

-- CreateIndex
CREATE INDEX "CommitteeMeeting_institutionId_idx" ON "CommitteeMeeting"("institutionId");

-- CreateIndex
CREATE INDEX "CommitteeMeeting_committeeId_idx" ON "CommitteeMeeting"("committeeId");

-- CreateIndex
CREATE INDEX "CommitteeMeeting_scheduledAt_idx" ON "CommitteeMeeting"("scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "CommitteeMeeting_committeeId_meetingNumber_key" ON "CommitteeMeeting"("committeeId", "meetingNumber");

-- CreateIndex
CREATE INDEX "InstitutionalPolicy_institutionId_idx" ON "InstitutionalPolicy"("institutionId");

-- CreateIndex
CREATE INDEX "InstitutionalPolicy_category_idx" ON "InstitutionalPolicy"("category");

-- CreateIndex
CREATE INDEX "InstitutionalPolicy_status_idx" ON "InstitutionalPolicy"("status");

-- CreateIndex
CREATE UNIQUE INDEX "InstitutionalPolicy_institutionId_code_version_key" ON "InstitutionalPolicy"("institutionId", "code", "version");

-- AddForeignKey
ALTER TABLE "CommitteeMember" ADD CONSTRAINT "CommitteeMember_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "GovernanceCommittee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommitteeMeeting" ADD CONSTRAINT "CommitteeMeeting_committeeId_fkey" FOREIGN KEY ("committeeId") REFERENCES "GovernanceCommittee"("id") ON DELETE CASCADE ON UPDATE CASCADE;

