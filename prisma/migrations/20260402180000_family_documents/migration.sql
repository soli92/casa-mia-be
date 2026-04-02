-- Documenti condivisi per famiglia (metadati DB + file su S3/R2 + URL pubblico CDN)

CREATE TABLE "FamilyDocument" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "publicUrl" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyDocument_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FamilyDocument_storageKey_key" ON "FamilyDocument"("storageKey");

CREATE INDEX "FamilyDocument_familyId_idx" ON "FamilyDocument"("familyId");

ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
