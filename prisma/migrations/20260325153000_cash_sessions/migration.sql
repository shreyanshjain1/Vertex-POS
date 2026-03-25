-- CreateEnum
CREATE TYPE "CashSessionStatus" AS ENUM ('OPEN', 'CLOSED', 'OVERRIDE_CLOSED');

-- CreateTable
CREATE TABLE "CashSession" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "openingFloat" DECIMAL(12,2) NOT NULL,
    "closedAt" TIMESTAMP(3),
    "closingExpected" DECIMAL(12,2),
    "closingActual" DECIMAL(12,2),
    "variance" DECIMAL(12,2),
    "notes" TEXT,
    "status" "CashSessionStatus" NOT NULL DEFAULT 'OPEN',

    CONSTRAINT "CashSession_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "CashSession_shopId_openedAt_idx" ON "CashSession"("shopId", "openedAt");

-- CreateIndex
CREATE INDEX "CashSession_shopId_userId_status_idx" ON "CashSession"("shopId", "userId", "status");

-- CreateIndex
CREATE INDEX "CashSession_userId_openedAt_idx" ON "CashSession"("userId", "openedAt");

-- Enforce one active session per cashier per shop
CREATE UNIQUE INDEX "CashSession_one_open_session_per_cashier_idx"
ON "CashSession"("shopId", "userId")
WHERE "status" = 'OPEN';

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CashSession" ADD CONSTRAINT "CashSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
