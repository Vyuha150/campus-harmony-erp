-- DropIndex
DROP INDEX "AcademicYear_year_key";

-- DropIndex
DROP INDEX "Course_code_key";

-- DropIndex
DROP INDEX "Department_code_key";

-- DropIndex
DROP INDEX "Department_name_key";

-- DropIndex
DROP INDEX "FacultyProfile_employeeId_key";

-- DropIndex
DROP INDEX "StudentProfile_rollNumber_key";

-- AlterTable
ALTER TABLE "AcademicYear" ADD COLUMN     "institutionId" TEXT;

-- AlterTable
ALTER TABLE "Course" ADD COLUMN     "institutionId" TEXT;

-- AlterTable
ALTER TABLE "Department" ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "hodUserId" TEXT,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "schoolId" TEXT;

-- AlterTable
ALTER TABLE "FacultyProfile" ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "dateOfJoining" TIMESTAMP(3),
ADD COLUMN     "employmentType" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "qualificationLevel" TEXT,
ADD COLUMN     "qualificationVerified" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "qualificationVerifiedAt" TIMESTAMP(3),
ADD COLUMN     "qualificationVerifiedBy" TEXT;

-- AlterTable
ALTER TABLE "StudentProfile" ADD COLUMN     "batchId" TEXT,
ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "category" TEXT,
ADD COLUMN     "dateOfBirth" TIMESTAMP(3),
ADD COLUMN     "domicileState" TEXT,
ADD COLUMN     "gender" TEXT,
ADD COLUMN     "institutionId" TEXT,
ADD COLUMN     "isDifferentlyAbled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "isHosteller" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "nationality" TEXT DEFAULT 'Indian',
ADD COLUMN     "programmeId" TEXT,
ADD COLUMN     "sectionId" TEXT;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "campusId" TEXT,
ADD COLUMN     "institutionId" TEXT;

-- CreateTable
CREATE TABLE "Institution" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "legalName" TEXT,
    "type" TEXT NOT NULL DEFAULT 'university',
    "aisheCode" TEXT,
    "naacGrade" TEXT,
    "nirfId" TEXT,
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "settings" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "establishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Institution_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Campus" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'main',
    "addressLine" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "settings" JSONB,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Campus_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "School" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "campusId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "deanUserId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "School_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Programme" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL,
    "durationYears" INTEGER NOT NULL,
    "totalSemesters" INTEGER NOT NULL,
    "totalCredits" INTEGER NOT NULL,
    "supportsMultipleExit" BOOLEAN NOT NULL DEFAULT false,
    "exitAwards" JSONB,
    "hasHonours" BOOLEAN NOT NULL DEFAULT false,
    "hasHonoursResearch" BOOLEAN NOT NULL DEFAULT false,
    "sanctionedIntake" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Programme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Batch" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "programmeId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "admissionYear" INTEGER NOT NULL,
    "expectedGraduationYear" INTEGER NOT NULL,
    "currentSemester" INTEGER NOT NULL DEFAULT 1,
    "status" TEXT NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Batch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Section" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "batchId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER,
    "classAdvisorUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_code_key" ON "Institution"("code");

-- CreateIndex
CREATE INDEX "Institution_isActive_idx" ON "Institution"("isActive");

-- CreateIndex
CREATE INDEX "Campus_institutionId_idx" ON "Campus"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Campus_institutionId_code_key" ON "Campus"("institutionId", "code");

-- CreateIndex
CREATE INDEX "School_institutionId_idx" ON "School"("institutionId");

-- CreateIndex
CREATE INDEX "School_campusId_idx" ON "School"("campusId");

-- CreateIndex
CREATE UNIQUE INDEX "School_institutionId_code_key" ON "School"("institutionId", "code");

-- CreateIndex
CREATE INDEX "Programme_institutionId_idx" ON "Programme"("institutionId");

-- CreateIndex
CREATE INDEX "Programme_departmentId_idx" ON "Programme"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Programme_institutionId_code_key" ON "Programme"("institutionId", "code");

-- CreateIndex
CREATE INDEX "Batch_programmeId_idx" ON "Batch"("programmeId");

-- CreateIndex
CREATE INDEX "Batch_institutionId_idx" ON "Batch"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Batch_institutionId_code_key" ON "Batch"("institutionId", "code");

-- CreateIndex
CREATE INDEX "Section_institutionId_idx" ON "Section"("institutionId");

-- CreateIndex
CREATE INDEX "Section_batchId_idx" ON "Section"("batchId");

-- CreateIndex
CREATE UNIQUE INDEX "Section_batchId_code_key" ON "Section"("batchId", "code");

-- CreateIndex
CREATE INDEX "AcademicYear_institutionId_idx" ON "AcademicYear"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "AcademicYear_institutionId_year_key" ON "AcademicYear"("institutionId", "year");

-- CreateIndex
CREATE INDEX "Course_institutionId_idx" ON "Course"("institutionId");

-- CreateIndex
CREATE UNIQUE INDEX "Course_institutionId_code_key" ON "Course"("institutionId", "code");

-- CreateIndex
CREATE INDEX "Department_institutionId_idx" ON "Department"("institutionId");

-- CreateIndex
CREATE INDEX "Department_campusId_idx" ON "Department"("campusId");

-- CreateIndex
CREATE INDEX "Department_schoolId_idx" ON "Department"("schoolId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_institutionId_code_key" ON "Department"("institutionId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Department_institutionId_name_key" ON "Department"("institutionId", "name");

-- CreateIndex
CREATE INDEX "FacultyProfile_institutionId_idx" ON "FacultyProfile"("institutionId");

-- CreateIndex
CREATE INDEX "FacultyProfile_campusId_idx" ON "FacultyProfile"("campusId");

-- CreateIndex
CREATE INDEX "FacultyProfile_qualificationLevel_idx" ON "FacultyProfile"("qualificationLevel");

-- CreateIndex
CREATE UNIQUE INDEX "FacultyProfile_institutionId_employeeId_key" ON "FacultyProfile"("institutionId", "employeeId");

-- CreateIndex
CREATE INDEX "StudentProfile_institutionId_idx" ON "StudentProfile"("institutionId");

-- CreateIndex
CREATE INDEX "StudentProfile_campusId_idx" ON "StudentProfile"("campusId");

-- CreateIndex
CREATE INDEX "StudentProfile_programmeId_idx" ON "StudentProfile"("programmeId");

-- CreateIndex
CREATE INDEX "StudentProfile_batchId_idx" ON "StudentProfile"("batchId");

-- CreateIndex
CREATE INDEX "StudentProfile_sectionId_idx" ON "StudentProfile"("sectionId");

-- CreateIndex
CREATE UNIQUE INDEX "StudentProfile_institutionId_rollNumber_key" ON "StudentProfile"("institutionId", "rollNumber");

-- CreateIndex
CREATE INDEX "User_institutionId_idx" ON "User"("institutionId");

-- CreateIndex
CREATE INDEX "User_campusId_idx" ON "User"("campusId");

-- CreateIndex
CREATE INDEX "User_institutionId_role_idx" ON "User"("institutionId", "role");

-- AddForeignKey
ALTER TABLE "Campus" ADD CONSTRAINT "Campus_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "School" ADD CONSTRAINT "School_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Programme" ADD CONSTRAINT "Programme_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Batch" ADD CONSTRAINT "Batch_programmeId_fkey" FOREIGN KEY ("programmeId") REFERENCES "Programme"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Section" ADD CONSTRAINT "Section_batchId_fkey" FOREIGN KEY ("batchId") REFERENCES "Batch"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_campusId_fkey" FOREIGN KEY ("campusId") REFERENCES "Campus"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Department" ADD CONSTRAINT "Department_schoolId_fkey" FOREIGN KEY ("schoolId") REFERENCES "School"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AcademicYear" ADD CONSTRAINT "AcademicYear_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- ═══════════════════════════════════════════════════════════════════════════
-- DATA BACKFILL  (ADR-0001)
--
-- The DDL above adds institutionId to every tenant-owned table as NULLABLE.
-- Existing rows would otherwise be tenant-less and invisible to every scoped
-- query — a silent data-loss outcome.
--
-- This step creates a default Institution and Campus, then attaches all
-- existing rows to it. Idempotent, and safe to run against an empty database
-- (every statement is a no-op when there are no rows).
--
-- Existing single-institution data is PRESERVED, not discarded.
-- ═══════════════════════════════════════════════════════════════════════════

-- 1. Default institution — only when tenant-owned data already exists.
INSERT INTO "Institution" (id, code, name, "legalName", type, "isActive", "createdAt", "updatedAt")
SELECT
  '00000000-0000-4000-8000-000000000001',
  'DEFAULT',
  'Default Institution',
  'Default Institution (created by tenancy migration 0002)',
  'university',
  true,
  NOW(),
  NOW()
WHERE EXISTS (SELECT 1 FROM "User")
  AND NOT EXISTS (SELECT 1 FROM "Institution" WHERE id = '00000000-0000-4000-8000-000000000001');

-- 2. Default main campus.
INSERT INTO "Campus" (id, "institutionId", code, name, type, "isActive", "createdAt", "updatedAt")
SELECT
  '00000000-0000-4000-8000-000000000002',
  '00000000-0000-4000-8000-000000000001',
  'MAIN',
  'Main Campus',
  'main',
  true,
  NOW(),
  NOW()
WHERE EXISTS (SELECT 1 FROM "Institution" WHERE id = '00000000-0000-4000-8000-000000000001')
  AND NOT EXISTS (SELECT 1 FROM "Campus" WHERE id = '00000000-0000-4000-8000-000000000002');

-- 3. Attach existing rows to the default tenant.
UPDATE "User"           SET "institutionId" = '00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL;
UPDATE "Department"     SET "institutionId" = '00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL;
UPDATE "Course"         SET "institutionId" = '00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL;
UPDATE "StudentProfile" SET "institutionId" = '00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL;
UPDATE "FacultyProfile" SET "institutionId" = '00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL;
UPDATE "AcademicYear"   SET "institutionId" = '00000000-0000-4000-8000-000000000001' WHERE "institutionId" IS NULL;

-- 4. Assign campus. Departments and profiles inherit the main campus.
UPDATE "Department"     SET "campusId" = '00000000-0000-4000-8000-000000000002' WHERE "campusId" IS NULL AND "institutionId" IS NOT NULL;
UPDATE "StudentProfile" SET "campusId" = '00000000-0000-4000-8000-000000000002' WHERE "campusId" IS NULL AND "institutionId" IS NOT NULL;
UPDATE "FacultyProfile" SET "campusId" = '00000000-0000-4000-8000-000000000002' WHERE "campusId" IS NULL AND "institutionId" IS NOT NULL;

-- Institution-wide roles intentionally keep campusId = NULL, which denotes
-- "sees every campus" (ADR-0001). Operational roles are pinned to the campus.
UPDATE "User" SET "campusId" = '00000000-0000-4000-8000-000000000002'
WHERE "campusId" IS NULL
  AND "institutionId" IS NOT NULL
  AND role NOT IN ('super_admin', 'vice_chancellor', 'pro_vc', 'registrar', 'coe');
