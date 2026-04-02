-- CreateTable
CREATE TABLE "PostIt" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT 'amber',
    "xPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "yPercent" DOUBLE PRECISION NOT NULL DEFAULT 12,
    "zIndex" INTEGER NOT NULL DEFAULT 1,
    "rotation" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "familyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PostIt_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PostIt_familyId_idx" ON "PostIt"("familyId");

-- AddForeignKey
ALTER TABLE "PostIt" ADD CONSTRAINT "PostIt_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PostIt" ADD CONSTRAINT "PostIt_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
