import AppHeader from '@/components/layout/AppHeader';
import PurchaseManager from '@/components/purchases/PurchaseManager';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function PurchasesPage() {
  const { shopId } = await getActiveShopContext();
  const [suppliers, products, purchases, settings] = await Promise.all([
    prisma.supplier.findMany({ where: { shopId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.product.findMany({ where: { shopId, isActive: true }, orderBy: { name: 'asc' } }),
    prisma.purchaseOrder.findMany({ where: { shopId }, include: { supplier: true }, orderBy: { createdAt: 'desc' }, take: 20 }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader title="Purchases" subtitle="Receive inventory from suppliers, save drafts, and update stock when goods arrive." />
      <PurchaseManager suppliers={suppliers} products={products.map((product) => ({ ...product, cost: product.cost.toString() }))} purchases={purchases.map((purchase) => ({ ...purchase, totalAmount: purchase.totalAmount.toString(), createdAt: purchase.createdAt.toISOString() }))} currencySymbol={settings?.currencySymbol ?? '₱'} />
    </div>
  );
}
