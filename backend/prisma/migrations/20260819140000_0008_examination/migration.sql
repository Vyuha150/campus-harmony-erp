-- CreateTable
CREATE TABLE "ExamSession" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "campusId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "registrationStartsAt" TIMESTAMP(3) NOT NULL,
    "registrationEndsAt" TIMESTAMP(3) NOT NULL,
    "examStartsAt" TIMESTAMP(3) NOT NULL,
    "examEndsAt" TIMESTAMP(3) NOT NULL,
    "minAttendancePercentage" DOUBLE PRECISION NOT NULL DEFAULT 75,
    "requireFeeClearance" BOOLEAN NOT NULL DEFAULT true,
    "lateRegistrationFee" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamSchedule" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "examDate" TIMESTAMP(3) NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "venue" TEXT,
    "maxMarks" INTEGER NOT NULL DEFAULT 100,
    "passingMarks" INTEGER,
    "paperSetterId" TEXT,
    "evaluatorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ExamRegistration" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "attendancePercentage" DOUBLE PRECISION,
    "attendanceMet" BOOLEAN NOT NULL DEFAULT false,
    "feesCleared" BOOLEAN NOT NULL DEFAULT false,
    "outstandingFeeAmount" DOUBLE PRECISION,
    "isEligible" BOOLEAN NOT NULL DEFAULT false,
    "ineligibilityReasons" JSONB,
    "isCondoned" BOOLEAN NOT NULL DEFAULT false,
    "condonedBy" TEXT,
    "condonedAt" TIMESTAMP(3),
    "condonationReason" TEXT,
    "status" TEXT NOT NULL DEFAULT 'registered',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "registeredBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ExamRegistration_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallTicket" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "ticketNumber" TEXT NOT NULL,
    "verificationCode" TEXT NOT NULL,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issuedBy" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'valid',
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "HallTicket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HallTicketEntry" (
    "id" TEXT NOT NULL,
    "hallTicketId" TEXT NOT NULL,
    "scheduleId" TEXT NOT NULL,
    "seatNumber" TEXT,
    "roomNumber" TEXT,

    CONSTRAINT "HallTicketEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RevaluationRequest" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseResultId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'revaluation',
    "requestNumber" TEXT NOT NULL,
    "reason" TEXT,
    "fee" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "feePaid" BOOLEAN NOT NULL DEFAULT false,
    "originalMarks" DOUBLE PRECISION NOT NULL,
    "revisedMarks" DOUBLE PRECISION,
    "marksChanged" BOOLEAN NOT NULL DEFAULT false,
    "status" TEXT NOT NULL DEFAULT 'requested',
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "evaluatedBy" TEXT,
    "evaluatedAt" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RevaluationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ExamSession_institutionId_idx" ON "ExamSession"("institutionId");

-- CreateIndex
CREATE INDEX "ExamSession_status_idx" ON "ExamSession"("status");

-- CreateIndex
CREATE INDEX "ExamSession_academicYear_semester_idx" ON "ExamSession"("academicYear", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSession_institutionId_code_key" ON "ExamSession"("institutionId", "code");

-- CreateIndex
CREATE INDEX "ExamSchedule_institutionId_idx" ON "ExamSchedule"("institutionId");

-- CreateIndex
CREATE INDEX "ExamSchedule_sessionId_idx" ON "ExamSchedule"("sessionId");

-- CreateIndex
CREATE INDEX "ExamSchedule_examDate_idx" ON "ExamSchedule"("examDate");

-- CreateIndex
CREATE UNIQUE INDEX "ExamSchedule_sessionId_courseId_key" ON "ExamSchedule"("sessionId", "courseId");

-- CreateIndex
CREATE INDEX "ExamRegistration_institutionId_idx" ON "ExamRegistration"("institutionId");

-- CreateIndex
CREATE INDEX "ExamRegistration_sessionId_idx" ON "ExamRegistration"("sessionId");

-- CreateIndex
CREATE INDEX "ExamRegistration_studentProfileId_idx" ON "ExamRegistration"("studentProfileId");

-- CreateIndex
CREATE INDEX "ExamRegistration_status_idx" ON "ExamRegistration"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ExamRegistration_scheduleId_studentProfileId_key" ON "ExamRegistration"("scheduleId", "studentProfileId");

-- CreateIndex
CREATE INDEX "HallTicket_institutionId_idx" ON "HallTicket"("institutionId");

-- CreateIndex
CREATE INDEX "HallTicket_verificationCode_idx" ON "HallTicket"("verificationCode");

-- CreateIndex
CREATE UNIQUE INDEX "HallTicket_institutionId_ticketNumber_key" ON "HallTicket"("institutionId", "ticketNumber");

-- CreateIndex
CREATE UNIQUE INDEX "HallTicket_sessionId_studentProfileId_key" ON "HallTicket"("sessionId", "studentProfileId");

-- CreateIndex
CREATE INDEX "HallTicketEntry_scheduleId_idx" ON "HallTicketEntry"("scheduleId");

-- CreateIndex
CREATE UNIQUE INDEX "HallTicketEntry_hallTicketId_scheduleId_key" ON "HallTicketEntry"("hallTicketId", "scheduleId");

-- CreateIndex
CREATE INDEX "RevaluationRequest_institutionId_idx" ON "RevaluationRequest"("institutionId");

-- CreateIndex
CREATE INDEX "RevaluationRequest_courseResultId_idx" ON "RevaluationRequest"("courseResultId");

-- CreateIndex
CREATE INDEX "RevaluationRequest_studentProfileId_idx" ON "RevaluationRequest"("studentProfileId");

-- CreateIndex
CREATE INDEX "RevaluationRequest_status_idx" ON "RevaluationRequest"("status");

-- CreateIndex
CREATE UNIQUE INDEX "RevaluationRequest_institutionId_requestNumber_key" ON "RevaluationRequest"("institutionId", "requestNumber");

-- AddForeignKey
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamSchedule" ADD CONSTRAINT "ExamSchedule_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "ExamSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ExamRegistration" ADD CONSTRAINT "ExamRegistration_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallTicketEntry" ADD CONSTRAINT "HallTicketEntry_hallTicketId_fkey" FOREIGN KEY ("hallTicketId") REFERENCES "HallTicket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HallTicketEntry" ADD CONSTRAINT "HallTicketEntry_scheduleId_fkey" FOREIGN KEY ("scheduleId") REFERENCES "ExamSchedule"("id") ON DELETE CASCADE ON UPDATE CASCADE;

