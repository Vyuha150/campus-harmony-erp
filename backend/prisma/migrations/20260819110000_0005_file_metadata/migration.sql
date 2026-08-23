-- CreateTable
CREATE TABLE "FileMetadata" (
    "id" TEXT NOT NULL,
    "institutionId" TEXT NOT NULL,
    "campusId" TEXT,
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL DEFAULT 'local',
    "module" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "checksum" TEXT,
    "uploadedBy" TEXT NOT NULL,
    "ownerUserId" TEXT,
    "visibility" TEXT NOT NULL DEFAULT 'private',
    "allowedRoles" JSONB,
    "isConfidential" BOOLEAN NOT NULL DEFAULT false,
    "relatedEntityType" TEXT,
    "relatedEntityId" TEXT,
    "deletedAt" TIMESTAMP(3),
    "deletedBy" TEXT,
    "retainUntil" TIMESTAMP(3),
    "downloadCount" INTEGER NOT NULL DEFAULT 0,
    "lastDownloadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FileMetadata_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FileMetadata_institutionId_idx" ON "FileMetadata"("institutionId");

-- CreateIndex
CREATE INDEX "FileMetadata_module_idx" ON "FileMetadata"("module");

-- CreateIndex
CREATE INDEX "FileMetadata_uploadedBy_idx" ON "FileMetadata"("uploadedBy");

-- CreateIndex
CREATE INDEX "FileMetadata_relatedEntityType_relatedEntityId_idx" ON "FileMetadata"("relatedEntityType", "relatedEntityId");

-- CreateIndex
CREATE INDEX "FileMetadata_deletedAt_idx" ON "FileMetadata"("deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "FileMetadata_institutionId_storageKey_key" ON "FileMetadata"("institutionId", "storageKey");

