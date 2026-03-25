-- CreateEnum
CREATE TYPE "ParkedSaleStatus" AS ENUM ('HELD', 'RESUMED', 'CANCELLED', 'EXPIRED');

-- CreateTable
CREATE TABLE "ParkedSale" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "cashierUserId" TEXT NOT NULL,
    "customerName" TEXT,
    "customerPhone" TEXT,
    "notes" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "taxAmount" DECIMAL(12,2) NOT NULL,
    "discountAmount" DECIMAL(12,2) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "status" "ParkedSaleStatus" NOT NULL DEFAULT 'HELD',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "resumedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ParkedSale_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ParkedSaleItem" (
    "id" TEXT NOT NULL,
    "parkedSaleId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "qty" INTEGER NOT NULL,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "lineTotal" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ParkedSaleItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "ParkedSale_shopId_status_createdAt_idx" ON "ParkedSale"("shopId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ParkedSale_shopId_status_expiresAt_idx" ON "ParkedSale"("shopId", "status", "expiresAt");

-- CreateIndex
CREATE INDEX "ParkedSale_cashierUserId_status_createdAt_idx" ON "ParkedSale"("cashierUserId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "ParkedSaleItem_parkedSaleId_createdAt_idx" ON "ParkedSaleItem"("parkedSaleId", "createdAt");

-- CreateIndex
CREATE INDEX "ParkedSaleItem_productId_idx" ON "ParkedSaleItem"("productId");

-- AddForeignKey
ALTER TABLE "ParkedSale" ADD CONSTRAINT "ParkedSale_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkedSale" ADD CONSTRAINT "ParkedSale_cashierUserId_fkey" FOREIGN KEY ("cashierUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkedSaleItem" ADD CONSTRAINT "ParkedSaleItem_parkedSaleId_fkey" FOREIGN KEY ("parkedSaleId") REFERENCES "ParkedSale"("id") ON DELETE CASCADE ON UPDATE CASCADE;
