'use client';

import Link from 'next/link';
import { type FormEvent, useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { summarizeConversions } from '@/lib/uom';
import { buildVariantLabel } from '@/lib/product-merchandising';

type Product = {
  id: string;
  name: string;
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
  isActive: boolean;
};

type InventoryReason = {
  id: string;
  code: string;
  label: string;
};

export default function AdjustmentForm({
  products,
  reasons
}: {
  products: Product[];
  reasons: InventoryReason[];
}) {
  const activeProducts = products.filter((product) => product.isActive);
  const [productId, setProductId] = useState(activeProducts[0]?.id ?? '');
  const [reasonId, setReasonId] = useState(reasons[0]?.id ?? '');
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

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const parsedQty = Number(qty);

    if (!productId) {
      setError('Please select a product.');
      return;
    }

    if (!reasonId) {
      setError('Please select an adjustment reason.');
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
          reasonId,
          qtyChange: adjustmentType === 'REMOVE' ? parsedQty * -1 : parsedQty,
          notes: notes.trim() || null
        })
      });

      const data = await response.json().catch(() => ({
        error: 'Failed to save stock correction.'
      }));

      setLoading(false);

      if (!response.ok) {
        setError(data.error ?? 'Failed to save stock correction.');
        return;
      }

      setSuccess('Stock correction recorded successfully. Refresh the page to see the latest stock snapshot.');
      setQty('1');
      setNotes('');
    } catch {
      setLoading(false);
      setError('Failed to save stock correction.');
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      {!activeProducts.length ? (
        <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-600">
          <div className="font-semibold text-stone-900">No products are ready for stock corrections yet.</div>
          <div className="mt-2">Create products first, then use this screen only for exceptional corrections that do not belong in stock counts, supplier returns, or branch transfers.</div>
          <div className="mt-3 flex flex-wrap gap-3">
            <Link href="/products" className="font-semibold text-emerald-700 hover:text-emerald-800">
              Open products
            </Link>
            <Link href="/stock-counts" className="font-semibold text-stone-700 hover:text-stone-900">
              Start a stock count
            </Link>
          </div>
        </div>
      ) : null}

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
          <label className="mb-2 block text-sm font-semibold text-stone-700">Correction direction</label>
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
          <label className="mb-2 block text-sm font-semibold text-stone-700">Business reason</label>
          <select
            className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
            value={reasonId}
            onChange={(event) => setReasonId(event.target.value)}
          >
            {reasons.map((reason) => (
              <option key={reason.id} value={reason.id}>
                {reason.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-2 block text-sm font-semibold text-stone-700">Quantity</label>
          <Input type="number" min="1" placeholder="Enter quantity" value={qty} onChange={(event) => setQty(event.target.value)} />
        </div>
      </div>

      <div>
        <label className="mb-2 block text-sm font-semibold text-stone-700">Notes</label>
        <Input placeholder="Supporting notes (optional)" value={notes} onChange={(event) => setNotes(event.target.value)} />
      </div>

      {selectedProduct ? (
        <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
          Selected product: <span className="font-semibold text-stone-900">{selectedProduct.name}</span> | Current stock: <span className="font-semibold text-stone-900">{selectedProduct.stockQty}</span> {selectedProduct.baseUnitOfMeasure?.name.toLowerCase() ?? 'base units'}
          <div className="mt-1 text-xs text-stone-500">
            {summarizeConversions(
              selectedProduct.uomConversions.map((conversion) => ({
                unitName: conversion.unitOfMeasure.name,
                ratioToBase: conversion.ratioToBase
              })),
              selectedProduct.baseUnitOfMeasure?.name
            )}
          </div>
          {selectedProduct.variants.length ? (
            <div className="mt-1 text-xs text-stone-500">
              Variants: {selectedProduct.variants.map((variant) => buildVariantLabel(variant) || variant.sku || variant.barcode || 'Variant').join(' • ')}
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
        Use stock counts for variances, supplier returns for vendor-related removals, and branch transfers for inter-branch movement. This form is best for write-offs, internal use, and opening-balance corrections.
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
      ) : null}

      {success ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div>
      ) : null}

      <Button type="submit" disabled={loading || !activeProducts.length}>
        {loading ? 'Saving stock correction...' : 'Save stock correction'}
      </Button>
    </form>
  );
}
