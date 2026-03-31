import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import PurchaseManager from '@/components/purchases/PurchaseManager';
import type { Purchase as PurchaseView } from '@/components/purchases/PurchaseManager';
import Card from '@/components/ui/Card';
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
  const missingSetup = [
    suppliers.length === 0 ? { href: '/suppliers', label: 'Add at least one supplier' } : null,
    products.length === 0 ? { href: '/products', label: 'Add at least one product' } : null
  ].filter((item): item is { href: string; label: string } => Boolean(item));

  return (
    <div className="space-y-6">
      <AppHeader
        title="Purchases"
        subtitle="Run purchase orders through sending, receiving, invoicing, and supplier settlement without losing inventory accuracy."
      />
      {missingSetup.length ? (
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-amber-700">Setup required</div>
          <h2 className="mt-2 text-xl font-black text-stone-900">Purchases are waiting for a few master records</h2>
          <p className="mt-2 text-sm text-stone-500">
            This branch can review existing purchase history, but new purchase orders should wait until suppliers and products are in place. That keeps purchasing operational instead of relying on starter data.
          </p>
          <div className="mt-4 flex flex-wrap gap-3">
            {missingSetup.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-900 transition hover:border-stone-300 hover:bg-white"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </Card>
      ) : null}
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
