'use client';

import Card from '@/components/ui/Card';
import AdjustmentForm from '@/components/inventory/AdjustmentForm';
import InventoryMovementTable from '@/components/inventory/InventoryMovementTable';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
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
  movements
}: {
  products: Product[];
  movements: Movement[];
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <h2 className="text-xl font-black text-stone-900">Manual stock adjustment</h2>
        <p className="mt-2 text-sm text-stone-500">
          Increase or decrease stock manually and store an audit trail for each change.
        </p>
        <div className="mt-6">
          <AdjustmentForm products={products} />
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Inventory movement history</h2>
        <p className="mt-2 text-sm text-stone-500">
          Track stock-in, stock-out, and manual adjustments.
        </p>
        <div className="mt-6">
          <InventoryMovementTable movements={movements} />
        </div>
      </Card>
    </div>
  );
}