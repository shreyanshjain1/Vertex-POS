/*
  Warnings:

  - A unique constraint covering the columns `[shopId,sku]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shopId,barcode]` on the table `Product` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[shopId,receiptNumber]` on the table `Sale` will be added. If there are existing duplicate values, this will fail.
  - Changed the type of `type` on the `InventoryMovement` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Added the required column `updatedAt` to the `PurchaseOrder` table without a default value. This is not possible if the table is not empty.
  - Added the required column `receiptNumber` to the `Sale` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `Sale` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "InventoryMovementType" AS ENUM ('PURCHASE_RECEIVED', 'SALE_COMPLETED', 'MANUAL_ADJUSTMENT', 'OPENING_STOCK');

-- CreateEnum
CREATE TYPE "SaleStatus" AS ENUM ('COMPLETED', 'VOIDED');

-- DropIndex
DROP INDEX "Product_barcode_idx";

-- DropIndex
DROP INDEX "Product_sku_idx";

-- AlterTable
ALTER TABLE "Category" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "parentId" TEXT;

-- AlterTable
ALTER TABLE "InventoryMovement" ADD COLUMN     "userId" TEXT,
DROP COLUMN "type",
ADD COLUMN     "type" "InventoryMovementType" NOT NULL;

-- AlterTable
ALTER TABLE "PurchaseOrder" ADD COLUMN     "receivedAt" TIMESTAMP(3),
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "Sale" ADD COLUMN     "cashierUserId" TEXT,
ADD COLUMN     "customerName" TEXT,
ADD COLUMN     "customerPhone" TEXT,
ADD COLUMN     "receiptNumber" TEXT NOT NULL,
ADD COLUMN     "status" "SaleStatus" NOT NULL DEFAULT 'COMPLETED',
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD COLUMN     "voidReason" TEXT;

-- AlterTable
ALTER TABLE "Shop" ADD COLUMN     "address" TEXT,
ADD COLUMN     "email" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "taxId" TEXT;

-- AlterTable
ALTER TABLE "ShopSetting" ADD COLUMN     "currencyCode" TEXT NOT NULL DEFAULT 'PHP',
ADD COLUMN     "purchasePrefix" TEXT NOT NULL DEFAULT 'PO',
ADD COLUMN     "receiptHeader" TEXT,
ADD COLUMN     "receiptPrefix" TEXT NOT NULL DEFAULT 'RCP',
ADD COLUMN     "salePrefix" TEXT NOT NULL DEFAULT 'SAL';

-- AlterTable
ALTER TABLE "UserShop" ALTER COLUMN "role" SET DEFAULT 'CASHIER';

-- CreateIndex
CREATE INDEX "Category_parentId_idx" ON "Category"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_sku_key" ON "Product"("shopId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "Product_shopId_barcode_key" ON "Product"("shopId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "Sale_shopId_receiptNumber_key" ON "Sale"("shopId", "receiptNumber");

-- AddForeignKey
ALTER TABLE "Category" ADD CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_cashierUserId_fkey" FOREIGN KEY ("cashierUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
