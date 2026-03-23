import AppHeader from '@/components/layout/AppHeader';
import InventoryManager from '@/components/inventory/InventoryManager';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function InventoryPage() {
  const { shopId } = await getActiveShopContext();
  const [products, movements] = await Promise.all([
    prisma.product.findMany({ where: { shopId }, orderBy: { name: 'asc' }, select: { id: true, name: true, stockQty: true } }),
    prisma.inventoryMovement.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' }, take: 25, include: { product: { select: { name: true } } } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader title="Inventory" subtitle="Review stock movement history and record manual adjustments with an audit trail." />
      <InventoryManager products={products} movements={movements.map((move) => ({ ...move, createdAt: move.createdAt.toISOString() }))} />
    </div>
  );
}
