'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

type Product = {
  id: string;
  name: string;
  stockQty: number;
  reorderPoint: number;
  isActive: boolean;
};

export default function AdjustmentForm({ products }: { products: Product[] }) {
  const activeProducts = products.filter((product) => product.isActive);
  const [productId, setProductId] = useState(activeProducts[0]?.id ?? '');
  const [adjustmentType, setAdjustmentType] = useState<'ADD' | 'REMOVE'>('ADD');
  const [qty, setQty] = useState('1');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const selectedProduct = useMemo(
    () => activeProducts.find((product) => product.id === productId),
    [activeProducts, productId]
  );

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const parsedQty = Number(qty);

    if (!productId) {
      setError('Please select a product.');
      return;
    }

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError('Adjustment quantity must be greater than 0.');
      return;
    }

    if (adjustmentType === 'REMOVE' && selectedProduct && parsedQty > selectedProduct.stockQty) {
      setError('Cannot remove more stock than currently available.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/inventory/adjustments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          productId,
          qtyChange: adjustmentType === 'REMOVE' ? parsedQty * -1 : parsedQty,
          notes: notes.trim() || null
        })
      });

      const data = await response.json().catch(() => ({
        error: 'Failed to save adjustment.'
      }));

      setLoading(false);

      if (!response.ok) {
        setError(data.error ?? 'Failed to save adjustment.');
        return;
      }

      setSuccess('Inventory adjustment recorded successfully. Refresh the page to see the latest stock snapshot.');
      setQty('1');
      setNotes('');
    } catch {
      setLoading(false);
      setError('Failed to save adjustment.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-700">Product</label>
        <select
          className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
          value={productId}
          onChange={(event) => setProductId(event.target.value)}
        >
          {activeProducts.map((product) => (
            <option key={product.id} value={product.id}>
              {product.name} | Current stock: {product.stockQty}
            </option>
          ))}
        </select>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-700">Adjustment type</label>
          <select
            className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
            value={adjustmentType}
            onChange={(event) => setAdjustmentType(event.target.value as 'ADD' | 'REMOVE')}
          >
            <option value="ADD">Add stock</option>
            <option value="REMOVE">Remove stock</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-700">Quantity</label>
          <Input type="number" min="1" placeholder="Enter quantity" value={qty} onChange={(event) => setQty(event.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-700">Notes</label>
        <Input placeholder="Reason for adjustment" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      {selectedProduct ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Selected product: <span className="font-semibold text-stone-900">{selectedProduct.name}</span> | Current stock: <span className="font-semibold text-stone-900">{selectedProduct.stockQty}</span>
        </div>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <Button type="submit" disabled={loading || !activeProducts.length}>
        {loading ? 'Saving adjustment...' : 'Save adjustment'}
      </Button>
    </form>
  );
}
