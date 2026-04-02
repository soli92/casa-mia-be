-- Cartelle documenti + collegamento documenti; publicUrl opzionale (lettura via presigned GET)

CREATE TABLE "DocumentFolder" (
    "id" TEXT NOT NULL,
    "familyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentFolder_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "DocumentFolder_familyId_idx" ON "DocumentFolder"("familyId");

ALTER TABLE "DocumentFolder" ADD CONSTRAINT "DocumentFolder_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FamilyDocument" ADD COLUMN     "folderId" TEXT;

CREATE INDEX "FamilyDocument_folderId_idx" ON "FamilyDocument"("folderId");

ALTER TABLE "FamilyDocument" ADD CONSTRAINT "FamilyDocument_folderId_fkey" FOREIGN KEY ("folderId") REFERENCES "DocumentFolder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "FamilyDocument" ALTER COLUMN "publicUrl" DROP NOT NULL;
