-- CreateTable
CREATE TABLE "GradeScale" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "maxPoint" DOUBLE PRECISION NOT NULL DEFAULT 10,
    "passingPoint" DOUBLE PRECISION NOT NULL DEFAULT 4,
    "version" TEXT NOT NULL DEFAULT '1.0',
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "effectiveTo" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GradeScale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeBand" (
    "id" TEXT NOT NULL,
    "scaleId" TEXT NOT NULL,
    "letter" TEXT NOT NULL,
    "point" DOUBLE PRECISION NOT NULL,
    "minMarks" DOUBLE PRECISION NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "isPassing" BOOLEAN NOT NULL DEFAULT true,
    "isExcludedFromGpa" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,

    CONSTRAINT "GradeBand_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseResult" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "internalMarks" DOUBLE PRECISION,
    "externalMarks" DOUBLE PRECISION,
    "totalMarks" DOUBLE PRECISION,
    "maxMarks" DOUBLE PRECISION,
    "letterGrade" TEXT NOT NULL,
    "gradePoint" DOUBLE PRECISION NOT NULL,
    "credits" INTEGER NOT NULL,
    "isPassing" BOOLEAN NOT NULL DEFAULT true,
    "isExcludedFromGpa" BOOLEAN NOT NULL DEFAULT false,
    "attempt" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SemesterResult" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "academicYear" TEXT NOT NULL,
    "gradeScaleId" TEXT NOT NULL,
    "creditsRegistered" INTEGER NOT NULL,
    "creditsEarned" INTEGER NOT NULL,
    "sgpa" DOUBLE PRECISION NOT NULL,
    "cgpa" DOUBLE PRECISION NOT NULL,
    "cumulativeCreditsRegistered" INTEGER NOT NULL,
    "cumulativeCreditsEarned" INTEGER NOT NULL,
    "resultStatus" TEXT NOT NULL DEFAULT 'pass',
    "batchRank" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "publishedAt" TIMESTAMP(3),
    "publishedBy" TEXT,
    "computedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SemesterResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GradeHistory" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseResultId" TEXT NOT NULL,
    "oldLetterGrade" TEXT,
    "newLetterGrade" TEXT NOT NULL,
    "oldGradePoint" DOUBLE PRECISION,
    "newGradePoint" DOUBLE PRECISION NOT NULL,
    "oldTotalMarks" DOUBLE PRECISION,
    "newTotalMarks" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "changeType" TEXT NOT NULL DEFAULT 'correction',
    "changedBy" TEXT NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "ipAddress" TEXT,

    CONSTRAINT "GradeHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GradeScale_institutionId_idx" ON "GradeScale"("institutionId");

-- CreateIndex
CREATE INDEX "GradeScale_isActive_idx" ON "GradeScale"("isActive");

-- CreateIndex
CREATE UNIQUE INDEX "GradeScale_institutionId_code_version_key" ON "GradeScale"("institutionId", "code", "version");

-- CreateIndex
CREATE INDEX "GradeBand_scaleId_idx" ON "GradeBand"("scaleId");

-- CreateIndex
CREATE UNIQUE INDEX "GradeBand_scaleId_letter_key" ON "GradeBand"("scaleId", "letter");

-- CreateIndex
CREATE INDEX "CourseResult_institutionId_idx" ON "CourseResult"("institutionId");

-- CreateIndex
CREATE INDEX "CourseResult_studentProfileId_idx" ON "CourseResult"("studentProfileId");

-- CreateIndex
CREATE INDEX "CourseResult_courseId_idx" ON "CourseResult"("courseId");

-- CreateIndex
CREATE INDEX "CourseResult_status_idx" ON "CourseResult"("status");

-- CreateIndex
CREATE INDEX "CourseResult_studentProfileId_semester_idx" ON "CourseResult"("studentProfileId", "semester");

-- CreateIndex
CREATE UNIQUE INDEX "CourseResult_studentProfileId_courseId_attempt_key" ON "CourseResult"("studentProfileId", "courseId", "attempt");

-- CreateIndex
CREATE INDEX "SemesterResult_institutionId_idx" ON "SemesterResult"("institutionId");

-- CreateIndex
CREATE INDEX "SemesterResult_studentProfileId_idx" ON "SemesterResult"("studentProfileId");

-- CreateIndex
CREATE INDEX "SemesterResult_status_idx" ON "SemesterResult"("status");

-- CreateIndex
CREATE UNIQUE INDEX "SemesterResult_studentProfileId_semester_academicYear_key" ON "SemesterResult"("studentProfileId", "semester", "academicYear");

-- CreateIndex
CREATE INDEX "GradeHistory_institutionId_idx" ON "GradeHistory"("institutionId");

-- CreateIndex
CREATE INDEX "GradeHistory_courseResultId_idx" ON "GradeHistory"("courseResultId");

-- CreateIndex
CREATE INDEX "GradeHistory_changedAt_idx" ON "GradeHistory"("changedAt");

-- CreateIndex
CREATE INDEX "GradeHistory_changedBy_idx" ON "GradeHistory"("changedBy");

-- AddForeignKey
ALTER TABLE "GradeBand" ADD CONSTRAINT "GradeBand_scaleId_fkey" FOREIGN KEY ("scaleId") REFERENCES "GradeScale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SemesterResult" ADD CONSTRAINT "SemesterResult_gradeScaleId_fkey" FOREIGN KEY ("gradeScaleId") REFERENCES "GradeScale"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GradeHistory" ADD CONSTRAINT "GradeHistory_courseResultId_fkey" FOREIGN KEY ("courseResultId") REFERENCES "CourseResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

