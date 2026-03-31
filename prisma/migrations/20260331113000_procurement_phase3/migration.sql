-- AlterEnum
ALTER TYPE "PurchaseStatus" RENAME TO "PurchaseStatus_old";

CREATE TYPE "PurchaseStatus" AS ENUM (
    'DRAFT',
    'SENT',
    'PARTIALLY_RECEIVED',
    'FULLY_RECEIVED',
    'CANCELLED',
    'CLOSED'
);

ALTER TABLE "PurchaseOrder"
ALTER COLUMN "status" DROP DEFAULT,
ALTER COLUMN "status" TYPE "PurchaseStatus"
USING (
    CASE
        WHEN "status"::text = 'RECEIVED' THEN 'FULLY_RECEIVED'
        ELSE "status"::text
    END
)::"PurchaseStatus",
ALTER COLUMN "status" SET DEFAULT 'DRAFT';

DROP TYPE "PurchaseStatus_old";

-- CreateEnum
CREATE TYPE "PayableStatus" AS ENUM ('UNPAID', 'PARTIALLY_PAID', 'PAID', 'OVERDUE');

-- CreateTable
CREATE TABLE "PurchaseReceipt" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "receivedByUserId" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReceipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseReceiptItem" (
    "id" TEXT NOT NULL,
    "purchaseReceiptId" TEXT NOT NULL,
    "purchaseItemId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "qtyReceived" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PurchaseReceiptItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierInvoice" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "paymentStatus" "PayableStatus" NOT NULL DEFAULT 'UNPAID',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupplierInvoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupplierPayment" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "supplierInvoiceId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "referenceNumber" TEXT,
    "paidAt" TIMESTAMP(3) NOT NULL,
    "createdByUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SupplierPayment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountsPayableEntry" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "supplierInvoiceId" TEXT NOT NULL,
    "amountDue" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL,
    "balance" DECIMAL(12,2) NOT NULL,
    "status" "PayableStatus" NOT NULL DEFAULT 'UNPAID',
    "dueDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AccountsPayableEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PurchaseReceipt_shopId_receivedAt_idx" ON "PurchaseReceipt"("shopId", "receivedAt");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_purchaseId_receivedAt_idx" ON "PurchaseReceipt"("purchaseId", "receivedAt");

-- CreateIndex
CREATE INDEX "PurchaseReceipt_receivedByUserId_receivedAt_idx" ON "PurchaseReceipt"("receivedByUserId", "receivedAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseReceiptItem_purchaseReceiptId_purchaseItemId_key" ON "PurchaseReceiptItem"("purchaseReceiptId", "purchaseItemId");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_purchaseItemId_createdAt_idx" ON "PurchaseReceiptItem"("purchaseItemId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseReceiptItem_productId_createdAt_idx" ON "PurchaseReceiptItem"("productId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_purchaseId_key" ON "SupplierInvoice"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "SupplierInvoice_supplierId_invoiceNumber_key" ON "SupplierInvoice"("supplierId", "invoiceNumber");

-- CreateIndex
CREATE INDEX "SupplierInvoice_shopId_paymentStatus_dueDate_idx" ON "SupplierInvoice"("shopId", "paymentStatus", "dueDate");

-- CreateIndex
CREATE INDEX "SupplierInvoice_supplierId_dueDate_idx" ON "SupplierInvoice"("supplierId", "dueDate");

-- CreateIndex
CREATE INDEX "SupplierPayment_shopId_paidAt_idx" ON "SupplierPayment"("shopId", "paidAt");

-- CreateIndex
CREATE INDEX "SupplierPayment_supplierInvoiceId_paidAt_idx" ON "SupplierPayment"("supplierInvoiceId", "paidAt");

-- CreateIndex
CREATE INDEX "SupplierPayment_createdByUserId_paidAt_idx" ON "SupplierPayment"("createdByUserId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "AccountsPayableEntry_supplierInvoiceId_key" ON "AccountsPayableEntry"("supplierInvoiceId");

-- CreateIndex
CREATE INDEX "AccountsPayableEntry_shopId_status_dueDate_idx" ON "AccountsPayableEntry"("shopId", "status", "dueDate");

-- CreateIndex
CREATE INDEX "AccountsPayableEntry_supplierId_status_dueDate_idx" ON "AccountsPayableEntry"("supplierId", "status", "dueDate");

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceipt" ADD CONSTRAINT "PurchaseReceipt_receivedByUserId_fkey" FOREIGN KEY ("receivedByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseReceiptId_fkey" FOREIGN KEY ("purchaseReceiptId") REFERENCES "PurchaseReceipt"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseReceiptItem" ADD CONSTRAINT "PurchaseReceiptItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierInvoice" ADD CONSTRAINT "SupplierInvoice_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupplierPayment" ADD CONSTRAINT "SupplierPayment_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayableEntry" ADD CONSTRAINT "AccountsPayableEntry_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayableEntry" ADD CONSTRAINT "AccountsPayableEntry_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountsPayableEntry" ADD CONSTRAINT "AccountsPayableEntry_supplierInvoiceId_fkey" FOREIGN KEY ("supplierInvoiceId") REFERENCES "SupplierInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
