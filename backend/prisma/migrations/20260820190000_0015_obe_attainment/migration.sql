-- ═══════════════════════════════════════════════════════════════════════════
-- 0015 — OBE attainment: assessments, CO-wise marks, policy
--
-- Additive. The CO/PO models from 0007 had no link to student marks, so
-- attainment could not be computed from anything that existed.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE "Assessment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "schemeCourseId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "sectionId" TEXT,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "weightPercent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "conductedOn" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Assessment_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "Assessment_institutionId_idx" ON "Assessment"("institutionId");
CREATE INDEX "Assessment_schemeCourseId_idx" ON "Assessment"("schemeCourseId");
CREATE INDEX "Assessment_academicYear_idx" ON "Assessment"("academicYear");
CREATE INDEX "Assessment_status_idx" ON "Assessment"("status");

ALTER TABLE "Assessment" ADD CONSTRAINT "Assessment_maxMarks_positive" CHECK ("maxMarks" > 0);

CREATE TABLE "AssessmentOutcome" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "maxMarks" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AssessmentOutcome_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "AssessmentOutcome_assessmentId_courseOutcomeId_key"
    ON "AssessmentOutcome"("assessmentId", "courseOutcomeId");
CREATE INDEX "AssessmentOutcome_courseOutcomeId_idx" ON "AssessmentOutcome"("courseOutcomeId");

ALTER TABLE "AssessmentOutcome" ADD CONSTRAINT "AssessmentOutcome_maxMarks_positive" CHECK ("maxMarks" > 0);

ALTER TABLE "AssessmentOutcome" ADD CONSTRAINT "AssessmentOutcome_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentOutcome" ADD CONSTRAINT "AssessmentOutcome_courseOutcomeId_fkey"
    FOREIGN KEY ("courseOutcomeId") REFERENCES "CourseOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "AssessmentCoMark" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "studentProfileId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "marksObtained" DOUBLE PRECISION NOT NULL,
    "isAbsent" BOOLEAN NOT NULL DEFAULT false,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssessmentCoMark_pkey" PRIMARY KEY ("id")
);

-- One mark per student per CO per assessment. This is what makes re-entry
-- idempotent rather than additive.
CREATE UNIQUE INDEX "AssessmentCoMark_assessmentId_studentProfileId_courseOutcomeId_key"
    ON "AssessmentCoMark"("assessmentId", "studentProfileId", "courseOutcomeId");
CREATE INDEX "AssessmentCoMark_institutionId_idx" ON "AssessmentCoMark"("institutionId");
CREATE INDEX "AssessmentCoMark_studentProfileId_idx" ON "AssessmentCoMark"("studentProfileId");
CREATE INDEX "AssessmentCoMark_courseOutcomeId_idx" ON "AssessmentCoMark"("courseOutcomeId");

-- Negative marks are not a thing. The upper bound is enforced in the service,
-- where the CO's max for that assessment is known.
ALTER TABLE "AssessmentCoMark" ADD CONSTRAINT "AssessmentCoMark_marks_nonnegative"
    CHECK ("marksObtained" >= 0);

ALTER TABLE "AssessmentCoMark" ADD CONSTRAINT "AssessmentCoMark_assessmentId_fkey"
    FOREIGN KEY ("assessmentId") REFERENCES "Assessment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentCoMark" ADD CONSTRAINT "AssessmentCoMark_studentProfileId_fkey"
    FOREIGN KEY ("studentProfileId") REFERENCES "StudentProfile"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AssessmentCoMark" ADD CONSTRAINT "AssessmentCoMark_courseOutcomeId_fkey"
    FOREIGN KEY ("courseOutcomeId") REFERENCES "CourseOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "IndirectAttainment" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "academicYear" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "level" DOUBLE PRECISION NOT NULL,
    "respondents" INTEGER NOT NULL DEFAULT 0,
    "recordedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IndirectAttainment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "IndirectAttainment_courseOutcomeId_academicYear_source_key"
    ON "IndirectAttainment"("courseOutcomeId", "academicYear", "source");
CREATE INDEX "IndirectAttainment_institutionId_idx" ON "IndirectAttainment"("institutionId");

ALTER TABLE "IndirectAttainment" ADD CONSTRAINT "IndirectAttainment_courseOutcomeId_fkey"
    FOREIGN KEY ("courseOutcomeId") REFERENCES "CourseOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "ObeAttainmentPolicy" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "studentTargetPercent" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "level3Percent" DOUBLE PRECISION NOT NULL DEFAULT 70,
    "level2Percent" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "level1Percent" DOUBLE PRECISION NOT NULL DEFAULT 50,
    "directWeight" DOUBLE PRECISION NOT NULL DEFAULT 80,
    "indirectWeight" DOUBLE PRECISION NOT NULL DEFAULT 20,
    "maxLevel" DOUBLE PRECISION NOT NULL DEFAULT 3,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ObeAttainmentPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ObeAttainmentPolicy_institutionId_key" ON "ObeAttainmentPolicy"("institutionId");

-- The blend must be a blend.
ALTER TABLE "ObeAttainmentPolicy" ADD CONSTRAINT "ObeAttainmentPolicy_weights_sum_100"
    CHECK ("directWeight" + "indirectWeight" = 100);

-- Every institution gets a policy row. The service refuses to compute without
-- one rather than substituting defaults at runtime — an attainment figure
-- derived from invented thresholds is exactly what must not reach an assessor.
INSERT INTO "ObeAttainmentPolicy" ("id", "institutionId", "updatedAt")
SELECT gen_random_uuid()::text, "id", CURRENT_TIMESTAMP FROM "Institution";
