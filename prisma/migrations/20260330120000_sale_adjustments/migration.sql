-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE 'SALE_VOIDED';
ALTER TYPE "InventoryMovementType" ADD VALUE 'RETURN_RESTOCKED';
ALTER TYPE "InventoryMovementType" ADD VALUE 'EXCHANGE_ISSUED';

-- AlterEnum
ALTER TYPE "DocumentSequenceType" ADD VALUE 'RETURN';

-- CreateEnum
CREATE TYPE "SaleAdjustmentType" AS ENUM ('VOID', 'REFUND', 'EXCHANGE');

-- CreateEnum
CREATE TYPE "SaleAdjustmentItemType" AS ENUM ('RETURN', 'REPLACEMENT');

-- CreateEnum
CREATE TYPE "SaleAdjustmentDisposition" AS ENUM ('RESTOCK', 'DAMAGED', 'EXCHANGE');

-- CreateTable
CREATE TABLE "SaleAdjustment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "exchangeSaleId" TEXT,
    "adjustmentNumber" TEXT NOT NULL,
    "type" "SaleAdjustmentType" NOT NULL,
    "reason" TEXT NOT NULL,
    "notes" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "approvedByUserId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SaleAdjustmentItem" (
    "id" TEXT NOT NULL,
    "saleAdjustmentId" TEXT NOT NULL,
    "saleItemId" TEXT,
    "productId" TEXT,
    "itemType" "SaleAdjustmentItemType" NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "disposition" "SaleAdjustmentDisposition" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SaleAdjustmentItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RefundPayment" (
    "id" TEXT NOT NULL,
    "saleAdjustmentId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "referenceNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RefundPayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SaleAdjustment_shopId_adjustmentNumber_key" ON "SaleAdjustment"("shopId", "adjustmentNumber");

-- CreateIndex
CREATE INDEX "SaleAdjustment_shopId_createdAt_idx" ON "SaleAdjustment"("shopId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleAdjustment_saleId_createdAt_idx" ON "SaleAdjustment"("saleId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleAdjustment_exchangeSaleId_idx" ON "SaleAdjustment"("exchangeSaleId");

-- CreateIndex
CREATE INDEX "SaleAdjustmentItem_saleAdjustmentId_createdAt_idx" ON "SaleAdjustmentItem"("saleAdjustmentId", "createdAt");

-- CreateIndex
CREATE INDEX "SaleAdjustmentItem_saleItemId_idx" ON "SaleAdjustmentItem"("saleItemId");

-- CreateIndex
CREATE INDEX "SaleAdjustmentItem_productId_idx" ON "SaleAdjustmentItem"("productId");

-- CreateIndex
CREATE INDEX "RefundPayment_saleAdjustmentId_createdAt_idx" ON "RefundPayment"("saleAdjustmentId", "createdAt");

-- CreateIndex
CREATE INDEX "RefundPayment_method_createdAt_idx" ON "RefundPayment"("method", "createdAt");

-- AddForeignKey
ALTER TABLE "SaleAdjustment" ADD CONSTRAINT "SaleAdjustment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAdjustment" ADD CONSTRAINT "SaleAdjustment_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAdjustment" ADD CONSTRAINT "SaleAdjustment_exchangeSaleId_fkey" FOREIGN KEY ("exchangeSaleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAdjustment" ADD CONSTRAINT "SaleAdjustment_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAdjustment" ADD CONSTRAINT "SaleAdjustment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAdjustmentItem" ADD CONSTRAINT "SaleAdjustmentItem_saleAdjustmentId_fkey" FOREIGN KEY ("saleAdjustmentId") REFERENCES "SaleAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAdjustmentItem" ADD CONSTRAINT "SaleAdjustmentItem_saleItemId_fkey" FOREIGN KEY ("saleItemId") REFERENCES "SaleItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleAdjustmentItem" ADD CONSTRAINT "SaleAdjustmentItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RefundPayment" ADD CONSTRAINT "RefundPayment_saleAdjustmentId_fkey" FOREIGN KEY ("saleAdjustmentId") REFERENCES "SaleAdjustment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
