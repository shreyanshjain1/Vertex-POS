import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import InventoryManager from '@/components/inventory/InventoryManager';
import Button from '@/components/ui/Button';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export default async function InventoryPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });

  const [products, movements] = await Promise.all([
    prisma.product.findMany({
      where: { shopId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    }),
    prisma.inventoryMovement.findMany({
      where: { shopId },
      include: {
        product: true
      },
      orderBy: { createdAt: 'desc' },
      take: 80
    })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Inventory"
        subtitle="Adjust stock manually, export the live catalog, and review the full movement history with clear status signals."
        actions={
          <Link href="/api/inventory/export">
            <Button type="button" variant="secondary">
              Export inventory CSV
            </Button>
          </Link>
        }
      />

      <InventoryManager
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          sku: product.sku,
          barcode: product.barcode,
          stockQty: product.stockQty,
          reorderPoint: product.reorderPoint,
          isActive: product.isActive
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
        lowStockThreshold={settings?.lowStockThreshold ?? 5}
      />
    </div>
  );
}
