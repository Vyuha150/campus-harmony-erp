-- CreateTable
CREATE TABLE "CurriculumScheme" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "effectiveFromYear" INTEGER NOT NULL,
    "effectiveToYear" INTEGER,
    "totalCreditsRequired" INTEGER NOT NULL,
    "minCreditsPerSemester" INTEGER NOT NULL DEFAULT 12,
    "maxCreditsPerSemester" INTEGER NOT NULL DEFAULT 30,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvingBody" TEXT,
    "createdBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CurriculumScheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseBasket" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "creditsRequired" INTEGER NOT NULL,
    "minCourses" INTEGER,
    "maxCourses" INTEGER,
    "isElective" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseBasket_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SchemeCourse" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "basketId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "semester" INTEGER NOT NULL,
    "credits" INTEGER NOT NULL,
    "lectureHours" INTEGER NOT NULL DEFAULT 0,
    "tutorialHours" INTEGER NOT NULL DEFAULT 0,
    "practicalHours" INTEGER NOT NULL DEFAULT 0,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SchemeCourse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoursePrerequisite" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "schemeCourseId" TEXT NOT NULL,
    "prerequisiteSchemeCourseId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'mandatory',
    "minGradePoint" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoursePrerequisite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgrammeOutcome" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'PO',
    "code" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "attribute" TEXT,
    "attainmentThreshold" DOUBLE PRECISION NOT NULL DEFAULT 60,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProgrammeOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CourseOutcome" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "schemeCourseId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "statement" TEXT NOT NULL,
    "bloomLevel" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CourseOutcome_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CoPoMapping" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "courseOutcomeId" TEXT NOT NULL,
    "programmeOutcomeId" TEXT NOT NULL,
    "strength" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CoPoMapping_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CurriculumScheme_institutionId_idx" ON "CurriculumScheme"("institutionId");

-- CreateIndex
CREATE INDEX "CurriculumScheme_programmeId_idx" ON "CurriculumScheme"("programmeId");

-- CreateIndex
CREATE INDEX "CurriculumScheme_status_idx" ON "CurriculumScheme"("status");

-- CreateIndex
CREATE UNIQUE INDEX "CurriculumScheme_institutionId_code_programmeId_key" ON "CurriculumScheme"("institutionId", "code", "programmeId");

-- CreateIndex
CREATE INDEX "CourseBasket_institutionId_idx" ON "CourseBasket"("institutionId");

-- CreateIndex
CREATE INDEX "CourseBasket_schemeId_idx" ON "CourseBasket"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseBasket_schemeId_code_key" ON "CourseBasket"("schemeId", "code");

-- CreateIndex
CREATE INDEX "SchemeCourse_institutionId_idx" ON "SchemeCourse"("institutionId");

-- CreateIndex
CREATE INDEX "SchemeCourse_schemeId_semester_idx" ON "SchemeCourse"("schemeId", "semester");

-- CreateIndex
CREATE INDEX "SchemeCourse_basketId_idx" ON "SchemeCourse"("basketId");

-- CreateIndex
CREATE UNIQUE INDEX "SchemeCourse_schemeId_courseId_key" ON "SchemeCourse"("schemeId", "courseId");

-- CreateIndex
CREATE INDEX "CoursePrerequisite_institutionId_idx" ON "CoursePrerequisite"("institutionId");

-- CreateIndex
CREATE INDEX "CoursePrerequisite_schemeCourseId_idx" ON "CoursePrerequisite"("schemeCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "CoursePrerequisite_schemeCourseId_prerequisiteSchemeCourseI_key" ON "CoursePrerequisite"("schemeCourseId", "prerequisiteSchemeCourseId");

-- CreateIndex
CREATE INDEX "ProgrammeOutcome_institutionId_idx" ON "ProgrammeOutcome"("institutionId");

-- CreateIndex
CREATE INDEX "ProgrammeOutcome_schemeId_idx" ON "ProgrammeOutcome"("schemeId");

-- CreateIndex
CREATE UNIQUE INDEX "ProgrammeOutcome_schemeId_code_key" ON "ProgrammeOutcome"("schemeId", "code");

-- CreateIndex
CREATE INDEX "CourseOutcome_institutionId_idx" ON "CourseOutcome"("institutionId");

-- CreateIndex
CREATE INDEX "CourseOutcome_schemeCourseId_idx" ON "CourseOutcome"("schemeCourseId");

-- CreateIndex
CREATE UNIQUE INDEX "CourseOutcome_schemeCourseId_code_key" ON "CourseOutcome"("schemeCourseId", "code");

-- CreateIndex
CREATE INDEX "CoPoMapping_institutionId_idx" ON "CoPoMapping"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "CoPoMapping_courseOutcomeId_programmeOutcomeId_key" ON "CoPoMapping"("courseOutcomeId", "programmeOutcomeId");

-- AddForeignKey
ALTER TABLE "CurriculumScheme" ADD CONSTRAINT "CurriculumScheme_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseBasket" ADD CONSTRAINT "CourseBasket_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "CurriculumScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeCourse" ADD CONSTRAINT "SchemeCourse_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "CurriculumScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeCourse" ADD CONSTRAINT "SchemeCourse_basketId_fkey" FOREIGN KEY ("basketId") REFERENCES "CourseBasket"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SchemeCourse" ADD CONSTRAINT "SchemeCourse_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "Course"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_schemeCourseId_fkey" FOREIGN KEY ("schemeCourseId") REFERENCES "SchemeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoursePrerequisite" ADD CONSTRAINT "CoursePrerequisite_prerequisiteSchemeCourseId_fkey" FOREIGN KEY ("prerequisiteSchemeCourseId") REFERENCES "SchemeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgrammeOutcome" ADD CONSTRAINT "ProgrammeOutcome_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "CurriculumScheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseOutcome" ADD CONSTRAINT "CourseOutcome_schemeCourseId_fkey" FOREIGN KEY ("schemeCourseId") REFERENCES "SchemeCourse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoPoMapping" ADD CONSTRAINT "CoPoMapping_courseOutcomeId_fkey" FOREIGN KEY ("courseOutcomeId") REFERENCES "CourseOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CoPoMapping" ADD CONSTRAINT "CoPoMapping_programmeOutcomeId_fkey" FOREIGN KEY ("programmeOutcomeId") REFERENCES "ProgrammeOutcome"("id") ON DELETE CASCADE ON UPDATE CASCADE;

