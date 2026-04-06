-- Enforce one active/open cash session per cashier per shop.
-- Prisma schema cannot express a partial unique index, so this is maintained as raw SQL.
CREATE UNIQUE INDEX IF NOT EXISTS "CashSession_shopId_userId_open_unique"
ON "CashSession" ("shopId", "userId")
WHERE "status" = 'OPEN';
