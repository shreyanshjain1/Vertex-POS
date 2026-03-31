-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_OUT';
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'TRANSFER_IN';

-- AlterEnum
ALTER TYPE "DocumentSequenceType" ADD VALUE IF NOT EXISTS 'TRANSFER';

-- CreateEnum
CREATE TYPE "TaxMode" AS ENUM ('EXCLUSIVE', 'INCLUSIVE', 'NON_TAXABLE');

-- CreateEnum
CREATE TYPE "PrinterConnectionType" AS ENUM ('USB', 'NETWORK', 'BLUETOOTH', 'MANUAL');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'IN_TRANSIT', 'RECEIVED', 'CANCELLED');

-- AlterTable
ALTER TABLE "Shop"
ADD COLUMN "legalBusinessName" TEXT;

-- Backfill
UPDATE "Shop"
SET "legalBusinessName" = "name"
WHERE "legalBusinessName" IS NULL;

-- AlterTable
ALTER TABLE "ShopSetting"
ADD COLUMN "timezone" TEXT NOT NULL DEFAULT 'Asia/Manila',
ADD COLUMN "taxMode" "TaxMode" NOT NULL DEFAULT 'EXCLUSIVE',
ADD COLUMN "defaultPaymentMethods" JSONB,
ADD COLUMN "printerName" TEXT,
ADD COLUMN "printerConnection" "PrinterConnectionType" NOT NULL DEFAULT 'MANUAL',
ADD COLUMN "barcodeScannerNotes" TEXT,
ADD COLUMN "openingFloatRequired" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN "openingFloatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "fromShopId" TEXT NOT NULL,
    "toShopId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "receivedByUserId" TEXT,
    "transferNumber" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "notes" TEXT,
    "sentAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "fromProductId" TEXT NOT NULL,
    "toProductId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "destinationProductNameSnapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_fromShopId_transferNumber_key" ON "StockTransfer"("fromShopId", "transferNumber");

-- CreateIndex
CREATE INDEX "StockTransfer_fromShopId_status_createdAt_idx" ON "StockTransfer"("fromShopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransfer_toShopId_status_createdAt_idx" ON "StockTransfer"("toShopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransferItem_stockTransferId_createdAt_idx" ON "StockTransferItem"("stockTransferId", "createdAt");

-- CreateIndex
CREATE INDEX "StockTransferItem_fromProductId_idx" ON "StockTransferItem"("fromProductId");

-- CreateIndex
CREATE INDEX "StockTransferItem_toProductId_idx" ON "StockTransferItem"("toProductId");

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromShopId_fkey" FOREIGN KEY ("fromShopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toShopId_fkey" FOREIGN KEY ("toShopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_fromProductId_fkey" FOREIGN KEY ("fromProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_toProductId_fkey" FOREIGN KEY ("toProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
