'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';

type Product = {
  id: string;
  name: string;
  sku: string | null;
  barcode: string | null;
  stockQty: number;
  reorderPoint: number;
  trackBatches: boolean;
  trackExpiry: boolean;
  isActive: boolean;
};

type ProductBatch = {
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

function batchTone(batch: ProductBatch, expiryAlertDays: number) {
  if (batch.quantity <= 0) {
    return 'stone';
  }

  if (batch.expiryDate) {
    const now = new Date();
    const expiry = new Date(batch.expiryDate);
    if (expiry.getTime() < now.getTime()) {
      return 'red';
    }

    const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= expiryAlertDays) {
      return 'amber';
    }
  }

  return 'emerald';
}

function batchStatusLabel(batch: ProductBatch, expiryAlertDays: number) {
  if (batch.quantity <= 0) {
    return 'Depleted';
  }

  if (!batch.expiryDate) {
    return 'No expiry';
  }

  const now = new Date();
  const expiry = new Date(batch.expiryDate);
  if (expiry.getTime() < now.getTime()) {
    return 'Expired';
  }

  const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays <= expiryAlertDays) {
    return 'Near expiry';
  }

  return 'Active';
}

export default function ProductBatchManager({
  products,
  initialBatches,
  inventoryFeatures
}: {
  products: Product[];
  initialBatches: ProductBatch[];
  inventoryFeatures: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    expiryAlertDays: number;
  };
}) {
  const router = useRouter();
  const trackedProducts = useMemo(
    () => products.filter((product) => product.isActive && (product.trackBatches || product.trackExpiry)),
    [products]
  );
  const [batches, setBatches] = useState(initialBatches);
  const [productId, setProductId] = useState(trackedProducts[0]?.id ?? '');
  const [lotNumber, setLotNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [quantity, setQuantity] = useState('0');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedProduct = trackedProducts.find((product) => product.id === productId);
  const sortedBatches = useMemo(
    () =>
      [...batches].sort((left, right) => {
        if (left.expiryDate && right.expiryDate) {
          return new Date(left.expiryDate).getTime() - new Date(right.expiryDate).getTime();
        }

        if (left.expiryDate) {
          return -1;
        }

        if (right.expiryDate) {
          return 1;
        }

        return new Date(right.receivedAt).getTime() - new Date(left.receivedAt).getTime();
      }),
    [batches]
  );

  const expiryAlerts = useMemo(
    () =>
      sortedBatches.filter((batch) => {
        if (!batch.expiryDate || batch.quantity <= 0) {
          return false;
        }

        const now = new Date();
        const expiry = new Date(batch.expiryDate);
        const diffDays = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        return diffDays <= inventoryFeatures.expiryAlertDays;
      }),
    [inventoryFeatures.expiryAlertDays, sortedBatches]
  );

  async function createBatch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    if (!productId) {
      setError('Select a tracked product.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`/api/products/${productId}/batches`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lotNumber,
          expiryDate: expiryDate || null,
          quantity: Number(quantity),
          notes: notes || null
        })
      });

      const data = await response.json().catch(() => ({ error: 'Unable to save the product batch.' }));
      setLoading(false);

      if (!response.ok || !data?.batch) {
        setError(data?.error ?? 'Unable to save the product batch.');
        return;
      }

      setBatches((current) => [data.batch, ...current]);
      setLotNumber('');
      setExpiryDate('');
      setQuantity('0');
      setNotes('');
      setSuccess('Product batch saved. Stock quantity stays product-level, while batch data supports FEFO and expiry review.');
      router.refresh();
    } catch {
      setLoading(false);
      setError('Unable to save the product batch.');
    }
  }

  if (!inventoryFeatures.batchTrackingEnabled && !inventoryFeatures.expiryTrackingEnabled) {
    return (
      <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
        Batch and expiry tracking are currently turned off for this shop type.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-black text-stone-900">Batches and expiry</h2>
        <p className="mt-2 text-sm text-stone-500">
          Keep lot numbers, tracked batch quantities, and expiry dates visible without disturbing the current product-level stock engine.
        </p>
      </div>

      {inventoryFeatures.expiryTrackingEnabled ? (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-[22px] border border-red-200 bg-red-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-red-700">Expiry alerts</div>
            <div className="mt-2 text-3xl font-black text-stone-950">{expiryAlerts.length}</div>
            <div className="mt-1 text-sm text-red-800">Expired or due within {inventoryFeatures.expiryAlertDays} day(s)</div>
          </div>
          <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">FEFO mode</div>
            <div className="mt-2 text-lg font-black text-stone-950">
              {inventoryFeatures.fefoEnabled ? 'Emphasized' : 'Available'}
            </div>
            <div className="mt-1 text-sm text-stone-500">
              {inventoryFeatures.fefoEnabled ? 'Batches are sorted toward earliest expiry first.' : 'Expiry data is visible for manual review.'}
            </div>
          </div>
        </div>
      ) : null}

      <form onSubmit={createBatch} className="space-y-4 rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Register tracked batch</div>
        <div className="grid gap-3 md:grid-cols-2">
          <select
            className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none transition focus:border-emerald-500"
            value={productId}
            onChange={(event) => setProductId(event.target.value)}
          >
            <option value="">Select tracked product</option>
            {trackedProducts.map((product) => (
              <option key={product.id} value={product.id}>
                {product.name} / {product.sku ?? 'No SKU'}
              </option>
            ))}
          </select>
          <Input placeholder="Lot number" value={lotNumber} onChange={(event) => setLotNumber(event.target.value)} />
          <Input type="date" value={expiryDate} onChange={(event) => setExpiryDate(event.target.value)} />
          <Input type="number" min="0" placeholder="Tracked batch qty" value={quantity} onChange={(event) => setQuantity(event.target.value)} />
        </div>
        <Input placeholder="Supporting notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />

        {selectedProduct ? (
          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
            <span className="font-semibold text-stone-900">{selectedProduct.name}</span>
            {' / '}Product stock: <span className="font-semibold text-stone-900">{selectedProduct.stockQty}</span>
            {' / '}Tracking: <span className="font-semibold text-stone-900">{selectedProduct.trackExpiry ? 'Batch + expiry' : 'Batch only'}</span>
          </div>
        ) : null}

        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

        <Button type="submit" disabled={loading || !trackedProducts.length}>
          {loading ? 'Saving batch...' : 'Save batch'}
        </Button>
      </form>

      <div className="overflow-hidden rounded-[24px] border border-stone-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3.5">Product</th>
                <th className="px-4 py-3.5">Lot</th>
                <th className="px-4 py-3.5">Expiry</th>
                <th className="px-4 py-3.5">Qty</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Received</th>
              </tr>
            </thead>
            <tbody>
              {sortedBatches.map((batch) => (
                <tr key={batch.id} className="border-t border-stone-200 bg-white">
                  <td className="px-4 py-4">
                    <div className="font-semibold text-stone-900">{batch.product.name}</div>
                    <div className="mt-1 text-xs text-stone-500">{batch.product.sku ?? 'No SKU'}</div>
                  </td>
                  <td className="px-4 py-4 font-mono text-xs text-stone-700">{batch.lotNumber}</td>
                  <td className="px-4 py-4 text-stone-600">{batch.expiryDate ? shortDate(batch.expiryDate) : 'No expiry'}</td>
                  <td className={`px-4 py-4 font-semibold ${batch.quantity <= 0 ? 'text-stone-500' : 'text-stone-900'}`}>{batch.quantity}</td>
                  <td className="px-4 py-4">
                    <Badge tone={batchTone(batch, inventoryFeatures.expiryAlertDays)}>
                      {batchStatusLabel(batch, inventoryFeatures.expiryAlertDays)}
                    </Badge>
                  </td>
                  <td className="px-4 py-4 text-stone-600">
                    <div>{dateTime(batch.receivedAt)}</div>
                    <div className="mt-1 text-xs text-stone-500">{batch.notes ?? 'No notes'}</div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!sortedBatches.length ? (
          <div className="border-t border-stone-200 bg-stone-50 py-8 text-center text-sm text-stone-500">
            No tracked batches recorded yet.
          </div>
        ) : null}
      </div>
    </div>
  );
}
