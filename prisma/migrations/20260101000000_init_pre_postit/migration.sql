-- Schema Casa Mia senza tabella PostIt (lavagna).
-- DB di produzione già allineato (es. `prisma db push`): vedi DATABASE_SETUP.md → baseline P3005
-- (`prisma migrate resolve --applied "20260101000000_init_pre_postit"` una tantum).

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ADMIN', 'MEMBER');

-- CreateEnum
CREATE TYPE "ShoppingItemCategory" AS ENUM ('FRUTTA', 'VERDURA', 'CARNE', 'PESCE', 'LATTICINI', 'PANE', 'PASTA', 'BEVANDE', 'SNACK', 'ALTRO');

-- CreateEnum
CREATE TYPE "PantryItemStatus" AS ENUM ('OK', 'EXPIRING_SOON', 'EXPIRED');

-- CreateEnum
CREATE TYPE "DeadlineCategory" AS ENUM ('BOLLETTE', 'TASSE', 'BOLLO_AUTO', 'ASSICURAZIONI', 'AFFITTO', 'ABBONAMENTI', 'ALTRO');

-- CreateEnum
CREATE TYPE "IoTDeviceType" AS ENUM ('LIGHT', 'THERMOSTAT', 'PLUG', 'SENSOR', 'CAMERA', 'OTHER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" "UserRole" NOT NULL DEFAULT 'MEMBER',
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Family" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Family_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ShoppingItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "category" "ShoppingItemCategory" NOT NULL DEFAULT 'ALTRO',
    "checked" BOOLEAN NOT NULL DEFAULT false,
    "familyId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "purchasedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ShoppingItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PantryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "quantity" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pz',
    "category" "ShoppingItemCategory" NOT NULL DEFAULT 'ALTRO',
    "expirationDate" TIMESTAMP(3),
    "status" "PantryItemStatus" NOT NULL DEFAULT 'OK',
    "familyId" TEXT NOT NULL,
    "addedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PantryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Recipe" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ingredients" TEXT[],
    "instructions" TEXT NOT NULL,
    "prepTime" INTEGER,
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Recipe_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RecipeView" (
    "id" TEXT NOT NULL,
    "recipeId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "viewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RecipeView_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deadline" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "category" "DeadlineCategory" NOT NULL DEFAULT 'ALTRO',
    "amount" DOUBLE PRECISION,
    "isPaid" BOOLEAN NOT NULL DEFAULT false,
    "familyId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deadline_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NotificationPreference" (
    "id" TEXT NOT NULL,
    "deadlineId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "daysBefore" INTEGER NOT NULL DEFAULT 7,

    CONSTRAINT "NotificationPreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IoTDevice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "IoTDeviceType" NOT NULL,
    "brand" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'offline',
    "lastPing" TIMESTAMP(3),
    "webhookUrl" TEXT,
    "apiKey" TEXT,
    "metadata" JSONB,
    "familyId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IoTDevice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "IoTEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IoTEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_familyId_idx" ON "User"("familyId");

-- CreateIndex
CREATE INDEX "ShoppingItem_familyId_idx" ON "ShoppingItem"("familyId");

-- CreateIndex
CREATE INDEX "ShoppingItem_addedById_idx" ON "ShoppingItem"("addedById");

-- CreateIndex
CREATE INDEX "PantryItem_familyId_idx" ON "PantryItem"("familyId");

-- CreateIndex
CREATE INDEX "PantryItem_status_idx" ON "PantryItem"("status");

-- CreateIndex
CREATE INDEX "PantryItem_expirationDate_idx" ON "PantryItem"("expirationDate");

-- CreateIndex
CREATE INDEX "Recipe_familyId_idx" ON "Recipe"("familyId");

-- CreateIndex
CREATE INDEX "RecipeView_recipeId_idx" ON "RecipeView"("recipeId");

-- CreateIndex
CREATE INDEX "RecipeView_userId_idx" ON "RecipeView"("userId");

-- CreateIndex
CREATE INDEX "Deadline_familyId_idx" ON "Deadline"("familyId");

-- CreateIndex
CREATE INDEX "Deadline_dueDate_idx" ON "Deadline"("dueDate");

-- CreateIndex
CREATE INDEX "Deadline_category_idx" ON "Deadline"("category");

-- CreateIndex
CREATE INDEX "NotificationPreference_deadlineId_idx" ON "NotificationPreference"("deadlineId");

-- CreateIndex
CREATE INDEX "NotificationPreference_userId_idx" ON "NotificationPreference"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "NotificationPreference_deadlineId_userId_key" ON "NotificationPreference"("deadlineId", "userId");

-- CreateIndex
CREATE INDEX "IoTDevice_familyId_idx" ON "IoTDevice"("familyId");

-- CreateIndex
CREATE INDEX "IoTDevice_status_idx" ON "IoTDevice"("status");

-- CreateIndex
CREATE INDEX "IoTEvent_deviceId_idx" ON "IoTEvent"("deviceId");

-- CreateIndex
CREATE INDEX "IoTEvent_createdAt_idx" ON "IoTEvent"("createdAt");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ShoppingItem" ADD CONSTRAINT "ShoppingItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PantryItem" ADD CONSTRAINT "PantryItem_addedById_fkey" FOREIGN KEY ("addedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Recipe" ADD CONSTRAINT "Recipe_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeView" ADD CONSTRAINT "RecipeView_recipeId_fkey" FOREIGN KEY ("recipeId") REFERENCES "Recipe"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RecipeView" ADD CONSTRAINT "RecipeView_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deadline" ADD CONSTRAINT "Deadline_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_deadlineId_fkey" FOREIGN KEY ("deadlineId") REFERENCES "Deadline"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NotificationPreference" ADD CONSTRAINT "NotificationPreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IoTDevice" ADD CONSTRAINT "IoTDevice_familyId_fkey" FOREIGN KEY ("familyId") REFERENCES "Family"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IoTEvent" ADD CONSTRAINT "IoTEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "IoTDevice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

