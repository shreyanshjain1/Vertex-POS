import AppHeader from '@/components/layout/AppHeader';
import PurchaseManager from '@/components/purchases/PurchaseManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
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
      include: { supplier: true, items: true },
      orderBy: { createdAt: 'desc' },
      take: 40
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Purchases"
        subtitle="Create draft POs, receive stock safely, and keep supplier-backed inventory movements accurate."
      />
      <PurchaseManager
        suppliers={suppliers}
        products={products.map((product) => ({
          ...product,
          cost: product.cost.toString()
        }))}
        units={units}
        purchases={purchases.map((purchase) => ({
          ...purchase,
          totalAmount: purchase.totalAmount.toString(),
          createdAt: purchase.createdAt.toISOString(),
          updatedAt: purchase.updatedAt.toISOString(),
          receivedAt: purchase.receivedAt?.toISOString() ?? null,
          items: purchase.items.map((item) => ({
            ...item,
            unitCost: item.unitCost.toString(),
            lineTotal: item.lineTotal.toString()
          }))
        }))}
        currencySymbol={settings?.currencySymbol ?? '₱'}
      />
    </div>
  );
}
