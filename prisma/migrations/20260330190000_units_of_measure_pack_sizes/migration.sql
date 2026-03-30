-- CreateTable
CREATE TABLE "UnitOfMeasure" (
    "id" TEXT NOT NULL,
    "shopId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isBase" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UnitOfMeasure_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductUomConversion" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitOfMeasureId" TEXT NOT NULL,
    "ratioToBase" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductUomConversion_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "Product"
ADD COLUMN "baseUnitOfMeasureId" TEXT;

-- AlterTable
ALTER TABLE "PurchaseItem"
ADD COLUMN "unitOfMeasureId" TEXT,
ADD COLUMN "unitCode" TEXT,
ADD COLUMN "unitName" TEXT,
ADD COLUMN "ratioToBase" INTEGER,
ADD COLUMN "receivedBaseQty" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "UnitOfMeasure_shopId_code_key" ON "UnitOfMeasure"("shopId", "code");

-- CreateIndex
CREATE INDEX "UnitOfMeasure_shopId_isActive_idx" ON "UnitOfMeasure"("shopId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "ProductUomConversion_productId_unitOfMeasureId_key" ON "ProductUomConversion"("productId", "unitOfMeasureId");

-- CreateIndex
CREATE INDEX "ProductUomConversion_productId_idx" ON "ProductUomConversion"("productId");

-- CreateIndex
CREATE INDEX "ProductUomConversion_unitOfMeasureId_idx" ON "ProductUomConversion"("unitOfMeasureId");

-- CreateIndex
CREATE INDEX "Product_baseUnitOfMeasureId_idx" ON "Product"("baseUnitOfMeasureId");

-- CreateIndex
CREATE INDEX "PurchaseItem_unitOfMeasureId_idx" ON "PurchaseItem"("unitOfMeasureId");

-- Seed default UOMs for existing shops
INSERT INTO "UnitOfMeasure" ("id", "shopId", "code", "name", "isBase", "isActive", "createdAt", "updatedAt")
SELECT
  'uom_' || md5(s."id" || ':' || u."code"),
  s."id",
  u."code",
  u."name",
  u."isBase",
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Shop" s
CROSS JOIN (
  VALUES
    ('PIECE', 'Piece', true),
    ('BOX', 'Box', false),
    ('CARTON', 'Carton', false),
    ('PACK', 'Pack', false)
) AS u("code", "name", "isBase")
ON CONFLICT ("shopId", "code") DO NOTHING;

-- Backfill product base unit as PIECE
UPDATE "Product" p
SET "baseUnitOfMeasureId" = u."id"
FROM "UnitOfMeasure" u
WHERE u."shopId" = p."shopId"
  AND u."code" = 'PIECE'
  AND p."baseUnitOfMeasureId" IS NULL;

-- Backfill purchase item unit snapshot as PIECE
UPDATE "PurchaseItem" pi
SET
  "unitOfMeasureId" = u."id",
  "unitCode" = u."code",
  "unitName" = u."name",
  "ratioToBase" = 1,
  "receivedBaseQty" = pi."qty"
FROM "PurchaseOrder" po
JOIN "UnitOfMeasure" u
  ON u."shopId" = po."shopId"
 AND u."code" = 'PIECE'
WHERE po."id" = pi."purchaseId"
  AND pi."unitOfMeasureId" IS NULL;

-- Enforce not-null after backfill
ALTER TABLE "Product"
ALTER COLUMN "baseUnitOfMeasureId" SET NOT NULL;

ALTER TABLE "PurchaseItem"
ALTER COLUMN "unitOfMeasureId" SET NOT NULL,
ALTER COLUMN "unitCode" SET NOT NULL,
ALTER COLUMN "unitName" SET NOT NULL,
ALTER COLUMN "ratioToBase" SET NOT NULL,
ALTER COLUMN "receivedBaseQty" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "UnitOfMeasure" ADD CONSTRAINT "UnitOfMeasure_shopId_fkey" FOREIGN KEY ("shopId") REFERENCES "Shop"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Product" ADD CONSTRAINT "Product_baseUnitOfMeasureId_fkey" FOREIGN KEY ("baseUnitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUomConversion" ADD CONSTRAINT "ProductUomConversion_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductUomConversion" ADD CONSTRAINT "ProductUomConversion_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseItem" ADD CONSTRAINT "PurchaseItem_unitOfMeasureId_fkey" FOREIGN KEY ("unitOfMeasureId") REFERENCES "UnitOfMeasure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
