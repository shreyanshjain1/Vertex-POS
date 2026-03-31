-- CreateEnum
CREATE TYPE "CustomerType" AS ENUM ('INDIVIDUAL', 'BUSINESS');

-- CreateEnum
CREATE TYPE "CustomerLoyaltyLedgerType" AS ENUM ('EARNED', 'REDEEMED', 'ADJUSTED');

-- CreateEnum
CREATE TYPE "CustomerCreditStatus" AS ENUM ('OPEN', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'VOIDED');

-- AlterTable
ALTER TABLE "Sale"
ADD COLUMN "customerId" TEXT,
ADD COLUMN "isCreditSale" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "loyaltyPointsEarned" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loyaltyPointsRedeemed" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "loyaltyDiscountAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "ParkedSale"
ADD COLUMN "customerId" TEXT;

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "type" "CustomerType" NOT NULL DEFAULT 'INDIVIDUAL',
    "firstName" TEXT,
    "lastName" TEXT,
    "businessName" TEXT,
    "contactPerson" TEXT,
    "taxId" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerLoyaltyLedger" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleId" TEXT,
    "type" "CustomerLoyaltyLedgerType" NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CustomerLoyaltyLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerCreditLedger" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "saleId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "originalAmount" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "status" "CustomerCreditStatus" NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerCreditLedger_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReceivablePayment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "customerCreditLedgerId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "method" TEXT NOT NULL,
    "referenceNumber" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ReceivablePayment_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Sale_customerId_createdAt_idx" ON "Sale"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "ParkedSale_customerId_status_createdAt_idx" ON "ParkedSale"("customerId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "Customer_shopId_isActive_updatedAt_idx" ON "Customer"("shopId", "isActive", "updatedAt");

-- CreateIndex
CREATE INDEX "Customer_shopId_type_isActive_idx" ON "Customer"("shopId", "type", "isActive");

-- CreateIndex
CREATE INDEX "CustomerLoyaltyLedger_shopId_customerId_createdAt_idx" ON "CustomerLoyaltyLedger"("shopId", "customerId", "createdAt");

-- CreateIndex
CREATE INDEX "CustomerLoyaltyLedger_saleId_idx" ON "CustomerLoyaltyLedger"("saleId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerCreditLedger_saleId_key" ON "CustomerCreditLedger"("saleId");

-- CreateIndex
CREATE INDEX "CustomerCreditLedger_shopId_status_dueDate_idx" ON "CustomerCreditLedger"("shopId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "CustomerCreditLedger_customerId_status_dueDate_idx" ON "CustomerCreditLedger"("customerId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "ReceivablePayment_shopId_paidAt_idx" ON "ReceivablePayment"("shopId", "paidAt");

-- CreateIndex
CREATE INDEX "ReceivablePayment_customerCreditLedgerId_paidAt_idx" ON "ReceivablePayment"("customerCreditLedgerId", "paidAt");

-- CreateIndex
CREATE INDEX "ReceivablePayment_createdByUserId_paidAt_idx" ON "ReceivablePayment"("createdByUserId", "paidAt");

-- AddForeignKey
ALTER TABLE "Sale" ADD CONSTRAINT "Sale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ParkedSale" ADD CONSTRAINT "ParkedSale_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Customer" ADD CONSTRAINT "Customer_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLoyaltyLedger" ADD CONSTRAINT "CustomerLoyaltyLedger_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLoyaltyLedger" ADD CONSTRAINT "CustomerLoyaltyLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerLoyaltyLedger" ADD CONSTRAINT "CustomerLoyaltyLedger_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditLedger" ADD CONSTRAINT "CustomerCreditLedger_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditLedger" ADD CONSTRAINT "CustomerCreditLedger_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerCreditLedger" ADD CONSTRAINT "CustomerCreditLedger_saleId_fkey" FOREIGN KEY ("saleId") REFERENCES "Sale"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_customerCreditLedgerId_fkey" FOREIGN KEY ("customerCreditLedgerId") REFERENCES "CustomerCreditLedger"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReceivablePayment" ADD CONSTRAINT "ReceivablePayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
