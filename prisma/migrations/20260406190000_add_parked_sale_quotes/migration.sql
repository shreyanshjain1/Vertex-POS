-- CreateEnum
CREATE TYPE "ParkedSaleType" AS ENUM ('SAVED_CART', 'QUOTE');

-- AlterTable
ALTER TABLE "ParkedSale"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "quoteReference" TEXT,
  ADD COLUMN "type" "ParkedSaleType" NOT NULL DEFAULT 'SAVED_CART';

-- CreateIndex
CREATE UNIQUE INDEX "ParkedSale_shopId_quoteReference_key" ON "ParkedSale"("shopId", "quoteReference");

-- CreateIndex
CREATE INDEX "ParkedSale_shopId_type_status_createdAt_idx" ON "ParkedSale"("shopId", "type", "status", "createdAt");
