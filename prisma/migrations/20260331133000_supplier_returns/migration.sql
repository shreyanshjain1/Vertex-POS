-- AlterEnum
ALTER TYPE "InventoryMovementType" ADD VALUE IF NOT EXISTS 'SUPPLIER_RETURN_POSTED';

-- CreateEnum
CREATE TYPE "SupplierReturnStatus" AS ENUM ('DRAFT', 'POSTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SupplierReturnReason" AS ENUM (
    'DAMAGED_FROM_SUPPLIER',
    'WRONG_ITEM',
    'OVER_DELIVERY',
    'EXPIRED_ON_RECEIPT',
    'QUALITY_ISSUE'
);

-- CreateEnum
CREATE TYPE "SupplierReturnDisposition" AS ENUM ('SELLABLE', 'DAMAGED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "SupplierCreditMemoStatus" AS ENUM ('PENDING', 'ISSUED', 'APPLIED');

-- CreateTable
CREATE TABLE "SupplierReturn" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "approvedByUserId" TEXT,
    "status" "SupplierReturnStatus" NOT NULL DEFAULT 'DRAFT',
    "returnNumber" TEXT NOT NULL,
    "reasonSummary" TEXT NOT NULL,
    "notes" TEXT,
    "creditMemoNumber" TEXT,
    "creditMemoDate" TIMESTAMP(3),
    "creditAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "creditMemoStatus" "SupplierCreditMemoStatus" NOT NULL DEFAULT 'PENDING',
    "postedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierReturnItem" (
    "id" TEXT NOT NULL,
    "supplierReturnId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productNameSnapshot" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitCost" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "reason" "SupplierReturnReason" NOT NULL,
    "disposition" "SupplierReturnDisposition" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierReturnItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SupplierReturn_shopId_returnNumber_key" ON "SupplierReturn"("shopId", "returnNumber");

-- CreateIndex
CREATE INDEX "SupplierReturn_shopId_status_createdAt_idx" ON "SupplierReturn"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierReturn_supplierId_status_createdAt_idx" ON "SupplierReturn"("supplierId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierReturnItem_supplierReturnId_createdAt_idx" ON "SupplierReturnItem"("supplierReturnId", "createdAt");

-- CreateIndex
CREATE INDEX "SupplierReturnItem_productId_createdAt_idx" ON "SupplierReturnItem"("productId", "createdAt");

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturn" ADD CONSTRAINT "SupplierReturn_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_supplierReturnId_fkey" FOREIGN KEY ("supplierReturnId") REFERENCES "SupplierReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierReturnItem" ADD CONSTRAINT "SupplierReturnItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
