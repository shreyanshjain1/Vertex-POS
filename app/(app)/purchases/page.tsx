import AppHeader from '@/components/layout/AppHeader';
import PurchaseManager from '@/components/purchases/PurchaseManager';
import type { Purchase as PurchaseView } from '@/components/purchases/PurchaseManager';
import { requirePageRole } from '@/lib/authz';
import { purchaseDetailInclude } from '@/lib/purchase-operations';
import { prisma } from '@/lib/prisma';
import { serializePurchase } from '@/lib/purchases';
import { ensureUnitsOfMeasure } from '@/lib/uom';

export default async function PurchasesPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const units = await ensureUnitsOfMeasure(shopId);
  const [suppliers, products, purchases, settings] = await Promise.all([
    prisma.supplier.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' }
    }),
    prisma.product.findMany({
      where: { shopId, isActive: true },
      include: {
        baseUnitOfMeasure: true,
        uomConversions: {
          include: {
            unitOfMeasure: true
          },
          orderBy: {
            ratioToBase: 'asc'
          }
        }
      },
      orderBy: { name: 'asc' }
    }),
    prisma.purchaseOrder.findMany({
      where: { shopId },
      include: purchaseDetailInclude,
      orderBy: { createdAt: 'desc' },
      take: 40
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Purchases"
        subtitle="Run purchase orders through sending, receiving, invoicing, and supplier settlement without losing inventory accuracy."
      />
      <PurchaseManager
        suppliers={suppliers}
        products={products.map((product) => ({
          ...product,
          cost: product.cost.toString()
        }))}
        units={units}
        purchases={purchases.map((purchase) => serializePurchase(purchase) as unknown as PurchaseView)}
        currencySymbol={settings?.currencySymbol ?? 'PHP '}
      />
    </div>
  );
}
