'use client';

import Link from 'next/link';
import { useState } from 'react';
import AdjustmentForm from '@/components/inventory/AdjustmentForm';
import InventoryMovementTable from '@/components/inventory/InventoryMovementTable';
import ProductBatchManager from '@/components/inventory/ProductBatchManager';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { money } from '@/lib/format';

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

type ReorderSuggestion = {
  productId: string;
  productName: string;
  sku: string | null;
  currentStock: number;
  avgDailySales: number;
  leadTimeDays: number;
  safetyStock: number;
  reorderPoint: number;
  targetStock: number;
  suggestedQty: number;
  unitCost: number;
  suggestedCost: number;
  supplierId: string | null;
  supplierName: string;
  stockoutEvents: number;
  sellThroughPercent: number;
  baseUnitOfMeasureId: string;
  baseUnitName: string;
};

type ReorderGroup = {
  supplierId: string | null;
  supplierName: string;
  totalUnits: number;
  totalCost: number;
  items: ReorderSuggestion[];
};

type ReorderSuggestions = {
  generatedAt: string;
  safetyStock: number;
  summary: {
    itemsNeedingAction: number;
    suppliersImpacted: number;
    projectedCost: number;
    projectedUnits: number;
  };
  items: ReorderSuggestion[];
  groups: ReorderGroup[];
};

export default function InventoryManager({
  products,
  reasons,
  batches,
  movements,
  lowStockThreshold,
  currencySymbol,
  reorderSuggestions,
  inventoryFeatures
}: {
  products: Product[];
  reasons: InventoryReason[];
  batches: Batch[];
  movements: Movement[];
  lowStockThreshold: number;
  currencySymbol: string;
  reorderSuggestions: ReorderSuggestions;
  inventoryFeatures: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    expiryAlertDays: number;
  };
}) {
  const [busySupplierId, setBusySupplierId] = useState<string | null>(null);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [createdSupplierIds, setCreatedSupplierIds] = useState<string[]>([]);

  async function createSuggestedPurchase(group: ReorderGroup) {
    if (!group.supplierId) {
      setError('This recommendation group has no supplier history yet, so a purchase order cannot be generated safely.');
      return;
    }

    setBusySupplierId(group.supplierId);
    setError('');
    setSuccess('');

    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId: group.supplierId,
        status: 'DRAFT',
        notes: `Smart reorder draft generated from the inventory queue on ${new Date().toLocaleDateString('en-PH')}.`,
        items: group.items.map((item) => ({
          productId: item.productId,
          unitOfMeasureId: item.baseUnitOfMeasureId,
          qty: item.suggestedQty,
          unitCost: item.unitCost
        }))
      })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to create the suggested purchase order.' }));
    setBusySupplierId(null);

    if (!response.ok) {
      setError(data.error ?? 'Unable to create the suggested purchase order.');
      return;
    }

    setCreatedSupplierIds((current) => [...new Set([...current, group.supplierId!])]);
    setSuccess(`Created draft purchase ${data.purchase?.purchaseNumber ?? ''} for ${group.supplierName}.`);
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <div className="space-y-6">
        <Card>
          <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <h2 className="text-xl font-black text-stone-900">Smart reorder suggestions</h2>
              <p className="mt-2 text-sm text-stone-500">
                Suggested quantities combine recent sales velocity, supplier lead time, branch safety stock, current stock, and stockout pressure before reusing the standard purchase order flow.
              </p>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              <div className="font-semibold text-stone-900">{reorderSuggestions.summary.itemsNeedingAction} product(s) need attention</div>
              <div className="mt-1">
                {reorderSuggestions.summary.projectedUnits} units / {money(reorderSuggestions.summary.projectedCost, currencySymbol)}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Safety stock</div>
              <div className="mt-2 text-2xl font-black text-stone-950">{reorderSuggestions.safetyStock}</div>
              <div className="mt-1 text-xs text-stone-500">branch default</div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Suppliers impacted</div>
              <div className="mt-2 text-2xl font-black text-stone-950">{reorderSuggestions.summary.suppliersImpacted}</div>
              <div className="mt-1 text-xs text-stone-500">with draftable recommendations</div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Generated</div>
              <div className="mt-2 text-lg font-black text-stone-950">
                {new Date(reorderSuggestions.generatedAt).toLocaleDateString('en-PH')}
              </div>
              <div className="mt-1 text-xs text-stone-500">live inventory snapshot</div>
            </div>
          </div>

          {success ? (
            <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success} <Link href="/purchases" className="font-semibold underline">Open purchases</Link>
            </div>
          ) : null}
          {error ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="mt-6 space-y-4">
            {reorderSuggestions.groups.length ? (
              reorderSuggestions.groups.map((group) => {
                const alreadyCreated = Boolean(group.supplierId && createdSupplierIds.includes(group.supplierId));

                return (
                  <div key={`${group.supplierId ?? 'none'}-${group.supplierName}`} className="rounded-[28px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.88))] p-5">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                          Supplier reorder pack
                        </div>
                        <h3 className="mt-2 text-lg font-black text-stone-900">{group.supplierName}</h3>
                        <div className="mt-1 text-sm text-stone-500">
                          {group.items.length} line(s) / {group.totalUnits} unit(s) / {money(group.totalCost, currencySymbol)}
                        </div>
                      </div>
                      {group.supplierId ? (
                        <Button
                          type="button"
                          onClick={() => createSuggestedPurchase(group)}
                          disabled={busySupplierId === group.supplierId || alreadyCreated}
                        >
                          {alreadyCreated
                            ? 'Draft created'
                            : busySupplierId === group.supplierId
                              ? 'Creating draft...'
                              : 'Create PO draft'}
                        </Button>
                      ) : (
                        <div className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700">
                          Supplier history required
                        </div>
                      )}
                    </div>

                    <div className="mt-4 space-y-3">
                      {group.items.map((item) => (
                        <div key={item.productId} className="rounded-2xl border border-stone-200 bg-white px-4 py-4">
                          <div className="flex flex-col gap-2 lg:flex-row lg:items-start lg:justify-between">
                            <div>
                              <div className="font-semibold text-stone-900">{item.productName}</div>
                              <div className="mt-1 text-xs text-stone-500">
                                {item.sku ? `${item.sku} / ` : ''}
                                {item.baseUnitName}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xl font-black text-stone-950">{item.suggestedQty}</div>
                              <div className="text-xs text-stone-500">suggested qty</div>
                            </div>
                          </div>
                          <div className="mt-4 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
                            <div className="rounded-2xl bg-stone-50 px-3 py-2 text-xs text-stone-500">
                              <div className="font-semibold text-stone-900">On hand</div>
                              <div className="mt-1">{item.currentStock}</div>
                            </div>
                            <div className="rounded-2xl bg-stone-50 px-3 py-2 text-xs text-stone-500">
                              <div className="font-semibold text-stone-900">Velocity</div>
                              <div className="mt-1">{item.avgDailySales.toFixed(1)} / day</div>
                            </div>
                            <div className="rounded-2xl bg-stone-50 px-3 py-2 text-xs text-stone-500">
                              <div className="font-semibold text-stone-900">Lead time</div>
                              <div className="mt-1">{item.leadTimeDays} day(s)</div>
                            </div>
                            <div className="rounded-2xl bg-stone-50 px-3 py-2 text-xs text-stone-500">
                              <div className="font-semibold text-stone-900">Reorder point</div>
                              <div className="mt-1">{item.reorderPoint}</div>
                            </div>
                            <div className="rounded-2xl bg-stone-50 px-3 py-2 text-xs text-stone-500">
                              <div className="font-semibold text-stone-900">Stockouts</div>
                              <div className="mt-1">{item.stockoutEvents}</div>
                            </div>
                            <div className="rounded-2xl bg-stone-50 px-3 py-2 text-xs text-stone-500">
                              <div className="font-semibold text-stone-900">Projected cost</div>
                              <div className="mt-1">{money(item.suggestedCost, currencySymbol)}</div>
                            </div>
                          </div>
                          <div className="mt-3 text-xs text-stone-500">
                            Sell-through {item.sellThroughPercent.toFixed(1)}% / target stock {item.targetStock} / safety stock {item.safetyStock}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                No products currently need a lead-time-aware reorder draft.
              </div>
            )}
          </div>
        </Card>

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
