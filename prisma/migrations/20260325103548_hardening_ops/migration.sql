-- CreateEnum
CREATE TYPE "DocumentSequenceType" AS ENUM ('SALE', 'RECEIPT', 'PURCHASE');

-- CreateTable
CREATE TABLE "DocumentSequence" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" "DocumentSequenceType" NOT NULL,
    "dateKey" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentSequence_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DocumentSequence_shopId_type_idx" ON "DocumentSequence"("shopId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "DocumentSequence_shopId_type_dateKey_key" ON "DocumentSequence"("shopId", "type", "dateKey");

-- CreateIndex
CREATE UNIQUE INDEX "Category_shopId_name_key" ON "Category"("shopId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_shopId_name_key" ON "Supplier"("shopId", "name");

-- AddForeignKey
ALTER TABLE "DocumentSequence" ADD CONSTRAINT "DocumentSequence_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

