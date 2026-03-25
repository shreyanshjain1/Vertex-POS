'use client';

import AdjustmentForm from '@/components/inventory/AdjustmentForm';
import InventoryMovementTable from '@/components/inventory/InventoryMovementTable';
import Card from '@/components/ui/Card';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
  reorderPoint: number;
  isActive: boolean;
};

type Movement = {
  id: string;
  type: string;
  qtyChange: number;
  referenceId: string | null;
  notes: string | null;
  createdAt: string;
  product: {
    id: string;
    name: string;
    sku: string | null;
    barcode: string | null;
  };
};

export default function InventoryManager({
  products,
  movements,
  lowStockThreshold
}: {
  products: Product[];
  movements: Movement[];
  lowStockThreshold: number;
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <h2 id="adjust-stock" className="text-xl font-black text-stone-900">Manual stock adjustment</h2>
        <p className="mt-2 text-sm text-stone-500">
          Increase or decrease stock manually and preserve an auditable movement record for every change.
        </p>
        <div className="mt-6">
          <AdjustmentForm products={products} />
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Inventory movement history</h2>
        <p className="mt-2 text-sm text-stone-500">
          Track stock-in, stock-out, and manual adjustments with low-stock context.
        </p>
        <div className="mt-6">
          <InventoryMovementTable movements={movements} lowStockThreshold={lowStockThreshold} />
        </div>
      </Card>
    </div>
  );
}
