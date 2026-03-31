import AppHeader from '@/components/layout/AppHeader';
import StockTransferManager from '@/components/transfers/StockTransferManager';
import type { StockTransferView } from '@/components/transfers/StockTransferManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { stockTransferDetailInclude } from '@/lib/stock-transfer-operations';
import { serializeStockTransfer } from '@/lib/stock-transfers';

export default async function TransfersPage() {
  const { shopId, userId } = await requirePageRole('MANAGER');

  const [shop, settings, memberships, sourceProducts, stockTransfers] = await Promise.all([
    prisma.shop.findUniqueOrThrow({
      where: { id: shopId },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: {
        currencySymbol: true
      }
    }),
    prisma.userShop.findMany({
      where: {
        userId,
        isActive: true
      },
      include: {
        shop: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: [{ assignedAt: 'asc' }]
    }),
    prisma.product.findMany({
      where: {
        shopId,
        isActive: true
      },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        stockQty: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.stockTransfer.findMany({
      where: {
        OR: [{ fromShopId: shopId }, { toShopId: shopId }]
      },
      include: stockTransferDetailInclude,
      orderBy: [{ createdAt: 'desc' }]
    })
  ]);

  const otherShops = memberships
    .filter((membership) => membership.shop.id !== shopId)
    .map((membership) => ({
      id: membership.shop.id,
      name: membership.shop.name,
      role: membership.role
    }));

  const destinationProducts = otherShops.length
    ? await prisma.product.findMany({
        where: {
          shopId: {
            in: otherShops.map((entry) => entry.id)
          },
          isActive: true
        },
        select: {
          id: true,
          shopId: true,
          name: true,
          sku: true,
          barcode: true,
          stockQty: true
        },
        orderBy: [{ shopId: 'asc' }, { name: 'asc' }]
      })
    : [];

  return (
    <div className="space-y-6">
      <AppHeader
        title="Branch transfers"
        subtitle="Create stock transfers from the active branch, send them into transit, and confirm receipt only once at the destination branch."
      />
      <StockTransferManager
        activeShopId={shop.id}
        activeShopName={shop.name}
        currencySymbol={settings?.currencySymbol ?? 'PHP '}
        otherShops={otherShops}
        sourceProducts={sourceProducts}
        destinationProducts={destinationProducts}
        initialTransfers={stockTransfers.map((stockTransfer) => serializeStockTransfer(stockTransfer)) as unknown as StockTransferView[]}
      />
    </div>
  );
}
