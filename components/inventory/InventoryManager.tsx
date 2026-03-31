'use client';

import AdjustmentForm from '@/components/inventory/AdjustmentForm';
import InventoryMovementTable from '@/components/inventory/InventoryMovementTable';
import ProductBatchManager from '@/components/inventory/ProductBatchManager';
import Card from '@/components/ui/Card';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
  reorderPoint: number;
  baseUnitOfMeasure?: { id: string; code: string; name: string; isBase: boolean } | null;
  variants: Array<{
    id: string;
    color: string | null;
    size: string | null;
    flavor: string | null;
    model: string | null;
    sku: string | null;
    barcode: string | null;
  }>;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: { id: string; code: string; name: string; isBase: boolean };
  }>;
  trackBatches: boolean;
  trackExpiry: boolean;
  batches: Array<{
    id: string;
    lotNumber: string;
    expiryDate: string | null;
    quantity: number;
  }>;
  isActive: boolean;
};

type InventoryReason = {
  id: string;
  code: string;
  label: string;
};

type Batch = {
  id: string;
  lotNumber: string;
  expiryDate: string | null;
  quantity: number;
  receivedAt: string;
  notes: string | null;
  product: {
    id: string;
    name: string;
    sku: string | null;
    trackBatches: boolean;
    trackExpiry: boolean;
  };
};

type Movement = {
  id: string;
  type: string;
  qtyChange: number;
  referenceId: string | null;
  notes: string | null;
  reasonLabel: string | null;
  reasonCode: string | null;
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
  reasons,
  batches,
  movements,
  lowStockThreshold,
  inventoryFeatures
}: {
  products: Product[];
  reasons: InventoryReason[];
  batches: Batch[];
  movements: Movement[];
  lowStockThreshold: number;
  inventoryFeatures: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    expiryAlertDays: number;
  };
}) {
  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <Card>
          <h2 id="adjust-stock" className="text-xl font-black text-stone-900">Stock corrections and write-offs</h2>
          <p className="mt-2 text-sm text-stone-500">
            Use this screen only for exceptional corrections. Stock counts, supplier returns, customer return restocks, and branch transfers remain the preferred business workflows whenever they apply.
          </p>
          <div className="mt-6">
            <AdjustmentForm products={products} reasons={reasons} />
          </div>
        </Card>

        <Card>
          <ProductBatchManager
            products={products}
            initialBatches={batches}
            inventoryFeatures={inventoryFeatures}
          />
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Inventory movement history</h2>
        <p className="mt-2 text-sm text-stone-500">
          Track purchases, sales, stock count variances, transfers, supplier returns, and reason-coded stock corrections with low-stock context.
        </p>
        <div className="mt-6">
          <InventoryMovementTable movements={movements} lowStockThreshold={lowStockThreshold} />
        </div>
      </Card>
    </div>
  );
}
