-- AlterEnum
ALTER TYPE "ShopType" ADD VALUE 'GENERAL_RETAIL';
ALTER TYPE "ShopType" ADD VALUE 'GROCERY_CONVENIENCE';
ALTER TYPE "ShopType" ADD VALUE 'PHARMACY';
ALTER TYPE "ShopType" ADD VALUE 'FOOD_BEVERAGE';
ALTER TYPE "ShopType" ADD VALUE 'COSMETICS_BEAUTY';
ALTER TYPE "ShopType" ADD VALUE 'MEDICAL_SUPPLIES';
ALTER TYPE "ShopType" ADD VALUE 'HARDWARE';

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "trackBatches" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "trackExpiry" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "InventoryMovement"
ADD COLUMN "reasonId" TEXT;

-- AlterTable
ALTER TABLE "ShopSetting"
ADD COLUMN "batchTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "expiryTrackingEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "fefoEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "expiryAlertDays" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "InventoryReason" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReason_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductBatch" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "lotNumber" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "quantity" INTEGER NOT NULL DEFAULT 0,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductBatch_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InventoryReason_shopId_code_key" ON "InventoryReason"("shopId", "code");

-- CreateIndex
CREATE INDEX "InventoryReason_shopId_isActive_idx" ON "InventoryReason"("shopId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductBatch_productId_lotNumber_key" ON "ProductBatch"("productId", "lotNumber");

-- CreateIndex
CREATE INDEX "ProductBatch_shopId_expiryDate_idx" ON "ProductBatch"("shopId", "expiryDate");

-- CreateIndex
CREATE INDEX "ProductBatch_productId_expiryDate_idx" ON "ProductBatch"("productId", "expiryDate");

-- CreateIndex
CREATE INDEX "InventoryMovement_reasonId_idx" ON "InventoryMovement"("reasonId");

-- AddForeignKey
ALTER TABLE "InventoryMovement" ADD CONSTRAINT "InventoryMovement_reasonId_fkey" FOREIGN KEY ("reasonId") REFERENCES "InventoryReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryReason" ADD CONSTRAINT "InventoryReason_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductBatch" ADD CONSTRAINT "ProductBatch_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;
