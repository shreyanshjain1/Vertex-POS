import AppHeader from '@/components/layout/AppHeader';
import InventoryManager from '@/components/inventory/InventoryManager';
import { prisma } from '@/lib/prisma';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';

export default async function InventoryPage() {
  const { shopId } = await getActiveShopContext();

  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' }
    }),
    prisma.inventoryMovement.findMany({
      where: { shopId },
      include: {
        product: true
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Inventory"
        subtitle="Adjust stock manually and review all movement history."
      />

      <InventoryManager
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          stockQty: product.stockQty
        }))}
        movements={movements.map((movement) => ({
          id: movement.id,
          type: movement.type,
          qtyChange: movement.qtyChange,
          referenceId: movement.referenceId,
          notes: movement.notes,
          createdAt: movement.createdAt.toISOString(),
          product: {
            id: movement.product.id,
            name: movement.product.name,
            sku: movement.product.sku,
            barcode: movement.product.barcode
          }
        }))}
      />
    </div>
  );
}