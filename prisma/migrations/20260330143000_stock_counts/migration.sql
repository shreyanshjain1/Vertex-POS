-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'STOCK_COUNT_POSTED';

-- AlterEnum
ALTER TYPE "DocumentSequenceType" ADD VALUE 'STOCK_COUNT';

-- CreateEnum
CREATE TYPE "StockCountStatus" AS ENUM ('DRAFT', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'POSTED', 'CANCELLED');

-- CreateTable
CREATE TABLE "StockCount" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "referenceNumber" TEXT NOT NULL,
    "title" TEXT,
    "status" "StockCountStatus" NOT NULL DEFAULT 'DRAFT',
    "isBlind" BOOLEAN NOT NULL DEFAULT false,
    "startedAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "postedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockCountItem" (
    "id" TEXT NOT NULL,
    "stockCountId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "skuSnapshot" TEXT,
    "expectedQty" INTEGER NOT NULL,
    "actualQty" INTEGER,
    "varianceQty" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockCountItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockCount_shopId_referenceNumber_key" ON "StockCount"("shopId", "referenceNumber");

-- CreateIndex
CREATE INDEX "StockCount_shopId_createdAt_idx" ON "StockCount"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "StockCount_shopId_status_createdAt_idx" ON "StockCount"("shopId", "status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "StockCountItem_stockCountId_productId_key" ON "StockCountItem"("stockCountId", "productId");

-- CreateIndex
CREATE INDEX "StockCountItem_stockCountId_createdAt_idx" ON "StockCountItem"("stockCountId", "createdAt");

-- CreateIndex
CREATE INDEX "StockCountItem_productId_idx" ON "StockCountItem"("productId");

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCount" ADD CONSTRAINT "StockCount_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_stockCountId_fkey" FOREIGN KEY ("stockCountId") REFERENCES "StockCount"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockCountItem" ADD CONSTRAINT "StockCountItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
