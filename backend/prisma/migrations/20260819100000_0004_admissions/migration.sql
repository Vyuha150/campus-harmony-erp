-- CreateTable
CREATE TABLE "AdmissionCycle" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "campusId" TEXT,
    "programmeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "applicationStartsAt" TIMESTAMP(3) NOT NULL,
    "applicationEndsAt" TIMESTAMP(3) NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "applicationFee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "minimumQualifyingPercentage" DOUBLE PRECISION,
    "entranceExamName" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionCycle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionSeatMatrix" (
    "id" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "totalSeats" INTEGER NOT NULL,
    "filledSeats" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionSeatMatrix_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionApplication" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "cycleId" TEXT NOT NULL,
    "applicationNumber" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,
    "gender" TEXT,
    "category" TEXT NOT NULL DEFAULT 'GENERAL',
    "domicileState" TEXT,
    "nationality" TEXT DEFAULT 'Indian',
    "isDifferentlyAbled" BOOLEAN NOT NULL DEFAULT false,
    "guardianName" TEXT,
    "guardianPhone" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "previousQualification" TEXT,
    "previousBoard" TEXT,
    "previousInstitution" TEXT,
    "previousYearOfPassing" INTEGER,
    "previousPercentage" DOUBLE PRECISION,
    "entranceExamRollNumber" TEXT,
    "entranceExamScore" DOUBLE PRECISION,
    "entranceExamRank" INTEGER,
    "meritScore" DOUBLE PRECISION,
    "meritRank" INTEGER,
    "isEligible" BOOLEAN,
    "eligibilityRemark" TEXT,
    "status" TEXT NOT NULL DEFAULT 'submitted',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "decidedBy" TEXT,
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "applicationFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "applicationFeeRef" TEXT,
    "studentProfileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionApplication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionDocument" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSizeBytes" INTEGER,
    "verificationStatus" TEXT NOT NULL DEFAULT 'pending',
    "verifiedBy" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AdmissionDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdmissionOffer" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "seatCategory" TEXT NOT NULL,
    "offeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "offeredBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "respondedAt" TIMESTAMP(3),
    "admissionFeeAmount" DOUBLE PRECISION,
    "admissionFeePaid" BOOLEAN NOT NULL DEFAULT false,
    "admissionFeeRef" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AdmissionOffer_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AdmissionCycle_institutionId_idx" ON "AdmissionCycle"("institutionId");

-- CreateIndex
CREATE INDEX "AdmissionCycle_programmeId_idx" ON "AdmissionCycle"("programmeId");

-- CreateIndex
CREATE INDEX "AdmissionCycle_status_idx" ON "AdmissionCycle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionCycle_institutionId_code_key" ON "AdmissionCycle"("institutionId", "code");

-- CreateIndex
CREATE INDEX "AdmissionSeatMatrix_cycleId_idx" ON "AdmissionSeatMatrix"("cycleId");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionSeatMatrix_cycleId_category_key" ON "AdmissionSeatMatrix"("cycleId", "category");

-- CreateIndex
CREATE INDEX "AdmissionApplication_institutionId_idx" ON "AdmissionApplication"("institutionId");

-- CreateIndex
CREATE INDEX "AdmissionApplication_cycleId_idx" ON "AdmissionApplication"("cycleId");

-- CreateIndex
CREATE INDEX "AdmissionApplication_status_idx" ON "AdmissionApplication"("status");

-- CreateIndex
CREATE INDEX "AdmissionApplication_cycleId_category_idx" ON "AdmissionApplication"("cycleId", "category");

-- CreateIndex
CREATE INDEX "AdmissionApplication_email_idx" ON "AdmissionApplication"("email");

-- CreateIndex
CREATE UNIQUE INDEX "AdmissionApplication_institutionId_applicationNumber_key" ON "AdmissionApplication"("institutionId", "applicationNumber");

-- CreateIndex
CREATE INDEX "AdmissionDocument_applicationId_idx" ON "AdmissionDocument"("applicationId");

-- CreateIndex
CREATE INDEX "AdmissionDocument_verificationStatus_idx" ON "AdmissionDocument"("verificationStatus");

-- CreateIndex
CREATE INDEX "AdmissionOffer_institutionId_idx" ON "AdmissionOffer"("institutionId");

-- CreateIndex
CREATE INDEX "AdmissionOffer_applicationId_idx" ON "AdmissionOffer"("applicationId");

-- CreateIndex
CREATE INDEX "AdmissionOffer_status_idx" ON "AdmissionOffer"("status");

-- AddForeignKey
ALTER TABLE "AdmissionCycle" ADD CONSTRAINT "AdmissionCycle_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionSeatMatrix" ADD CONSTRAINT "AdmissionSeatMatrix_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AdmissionCycle"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionApplication" ADD CONSTRAINT "AdmissionApplication_cycleId_fkey" FOREIGN KEY ("cycleId") REFERENCES "AdmissionCycle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionDocument" ADD CONSTRAINT "AdmissionDocument_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdmissionOffer" ADD CONSTRAINT "AdmissionOffer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "AdmissionApplication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

