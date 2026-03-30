'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money } from '@/lib/format';
import { summarizeConversions } from '@/lib/uom';

type Supplier = { id: string; name: string };
type UnitOfMeasure = { id: string; code: string; name: string; isBase: boolean };
type Product = {
  id: string;
  name: string;
  cost: string;
  stockQty: number;
  baseUnitOfMeasureId: string | null;
  baseUnitOfMeasure?: UnitOfMeasure | null;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: UnitOfMeasure;
  }>;
};
type PurchaseItem = {
  id: string;
  productId: string;
  unitName: string;
  ratioToBase: number;
  receivedBaseQty: number;
  productName: string;
  qty: number;
  unitCost: string;
  lineTotal: string;
};
type Purchase = {
  id: string;
  purchaseNumber: string;
  totalAmount: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  receivedAt: string | null;
  supplier: { name: string };
  items: PurchaseItem[];
};
type Line = {
  productId: string;
  productName: string;
  unitOfMeasureId: string;
  unitName: string;
  ratioToBase: number;
  receivedBaseQty: number;
  qty: number;
  unitCost: number;
};

function purchaseTone(status: string) {
  switch (status) {
    case 'RECEIVED':
      return 'emerald';
    case 'CANCELLED':
      return 'red';
    default:
      return 'amber';
  }
}

export default function PurchaseManager({
  suppliers,
  products,
  units,
  purchases,
  currencySymbol
}: {
  suppliers: Supplier[];
  products: Product[];
  units: UnitOfMeasure[];
  purchases: Purchase[];
  currencySymbol: string;
}) {
  const [history, setHistory] = useState(purchases);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [status, setStatus] = useState<'DRAFT' | 'RECEIVED'>('DRAFT');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [selectedUnitId, setSelectedUnitId] = useState(
    products[0]?.uomConversions[0]?.unitOfMeasureId ?? products[0]?.baseUnitOfMeasureId ?? units[0]?.id ?? ''
  );
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState(products[0]?.cost ?? '0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  const selectedProduct = useMemo(
    () => products.find((product) => product.id === selectedProductId),
    [products, selectedProductId]
  );
  const availableUnits = useMemo(() => {
    if (!selectedProduct) {
      return [];
    }

    const options = [];
    if (selectedProduct.baseUnitOfMeasure) {
      options.push({
        unitOfMeasureId: selectedProduct.baseUnitOfMeasure.id,
        unitName: selectedProduct.baseUnitOfMeasure.name,
        ratioToBase: 1
      });
    }

    for (const conversion of selectedProduct.uomConversions) {
      options.push({
        unitOfMeasureId: conversion.unitOfMeasureId,
        unitName: conversion.unitOfMeasure.name,
        ratioToBase: conversion.ratioToBase
      });
    }

    return options;
  }, [selectedProduct]);
  const selectedUnit = availableUnits.find((unit) => unit.unitOfMeasureId === selectedUnitId) ?? availableUnits[0] ?? null;
  const lineTotal = lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);

  function addLine() {
    setError('');
    setSuccess('');

    if (!selectedProduct) {
      setError('Please select a product.');
      return;
    }

    if (!selectedUnit) {
      setError('Select a purchase unit.');
      return;
    }

    const parsedQty = Number(qty);
    const parsedCost = Number(unitCost);

    if (!Number.isFinite(parsedQty) || parsedQty <= 0) {
      setError('Quantity must be greater than zero.');
      return;
    }

    if (!Number.isFinite(parsedCost) || parsedCost < 0) {
      setError('Unit cost must be zero or greater.');
      return;
    }

    setLines((currentLines) => {
      const existing = currentLines.find(
        (line) => line.productId === selectedProduct.id && line.unitOfMeasureId === selectedUnit.unitOfMeasureId
      );
      if (existing) {
        return currentLines.map((line) =>
          line.productId === selectedProduct.id && line.unitOfMeasureId === selectedUnit.unitOfMeasureId
            ? {
                ...line,
                qty: line.qty + parsedQty,
                receivedBaseQty: (line.qty + parsedQty) * line.ratioToBase,
                unitCost: parsedCost
              }
            : line
        );
      }

      return [
        ...currentLines,
        {
          productId: selectedProduct.id,
          productName: selectedProduct.name,
          unitOfMeasureId: selectedUnit.unitOfMeasureId,
          unitName: selectedUnit.unitName,
          ratioToBase: selectedUnit.ratioToBase,
          receivedBaseQty: parsedQty * selectedUnit.ratioToBase,
          qty: parsedQty,
          unitCost: parsedCost
        }
      ];
    });
    setQty('1');
  }

  function removeLine(productId: string, unitOfMeasureId: string) {
    setLines((currentLines) =>
      currentLines.filter((line) => !(line.productId === productId && line.unitOfMeasureId === unitOfMeasureId))
    );
  }

  async function createPurchase() {
    setError('');
    setSuccess('');

    if (!supplierId) {
      setError('Please select a supplier.');
      return;
    }

    if (!lines.length) {
      setError('Add at least one purchase line.');
      return;
    }

    setLoading(true);

    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        supplierId,
        status,
        notes: notes || null,
        items: lines.map((line) => ({
          productId: line.productId,
          unitOfMeasureId: line.unitOfMeasureId,
          qty: line.qty,
          unitCost: line.unitCost
        }))
      })
    });

    const data = await response.json().catch(() => ({ error: 'Failed to create purchase.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Failed to create purchase.');
      return;
    }

    setHistory((currentHistory) => [data.purchase, ...currentHistory]);
    setLines([]);
    setNotes('');
    setStatus('DRAFT');
    setSuccess(status === 'RECEIVED' ? 'Purchase received successfully.' : 'Draft purchase saved successfully.');
  }

  async function updatePurchaseStatus(id: string, nextStatus: 'RECEIVED' | 'CANCELLED') {
    const response = await fetch(`/api/purchases/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: nextStatus })
    });

    const data = await response.json().catch(() => ({ error: 'Failed to update purchase.' }));
    if (!response.ok) {
      setError(data.error ?? 'Failed to update purchase.');
      return;
    }

    setHistory((currentHistory) =>
      currentHistory.map((purchase) => (purchase.id === id ? data.purchase : purchase))
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <div id="record-purchase" className="mb-4 text-lg font-black text-stone-900">Stock-in / purchase entry</div>
        <div className="grid gap-4">
          <select className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={supplierId} onChange={(event) => setSupplierId(event.target.value)}>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>

          <select className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={status} onChange={(event) => setStatus(event.target.value as 'DRAFT' | 'RECEIVED')}>
            <option value="DRAFT">Save as draft</option>
            <option value="RECEIVED">Receive now</option>
          </select>

          <div className="grid gap-3 md:grid-cols-4">
            <select
              className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={selectedProductId}
              onChange={(event) => {
                setSelectedProductId(event.target.value);
                const hit = products.find((product) => product.id === event.target.value);
                if (hit) {
                  setUnitCost(hit.cost);
                  setSelectedUnitId(hit.uomConversions[0]?.unitOfMeasureId ?? hit.baseUnitOfMeasureId ?? '');
                }
              }}
            >
              {products.map((product) => (
                <option key={product.id} value={product.id}>
                  {product.name}
                </option>
              ))}
            </select>
            <select
              className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={selectedUnitId}
              onChange={(event) => setSelectedUnitId(event.target.value)}
            >
              {availableUnits.map((unit) => (
                <option key={unit.unitOfMeasureId} value={unit.unitOfMeasureId}>
                  {unit.unitName}
                </option>
              ))}
            </select>
            <Input type="number" min={1} value={qty} onChange={(event) => setQty(event.target.value)} />
            <Input type="number" step="0.01" value={unitCost} onChange={(event) => setUnitCost(event.target.value)} />
          </div>

          {selectedProduct ? (
            <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Current stock for <span className="font-semibold text-stone-900">{selectedProduct.name}</span>: {selectedProduct.stockQty} {selectedProduct.baseUnitOfMeasure?.name.toLowerCase() ?? 'base units'}
              <div className="mt-1 text-xs text-stone-500">
                {summarizeConversions(
                  selectedProduct.uomConversions.map((conversion) => ({
                    unitName: conversion.unitOfMeasure.name,
                    ratioToBase: conversion.ratioToBase
                  })),
                  selectedProduct.baseUnitOfMeasure?.name
                )}
              </div>
              {selectedUnit ? (
                <div className="mt-1 text-xs text-stone-500">
                  Receiving preview: {qty || '0'} {selectedUnit.unitName.toLowerCase()}{Number(qty) === 1 ? '' : 's'} = {(Number(qty) || 0) * selectedUnit.ratioToBase} {selectedProduct.baseUnitOfMeasure?.name.toLowerCase() ?? 'base units'}
                </div>
              ) : null}
            </div>
          ) : null}

          <Button type="button" variant="secondary" onClick={addLine}>Add line</Button>
          <Input placeholder="Notes" value={notes} onChange={(event) => setNotes(event.target.value)} />

          <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
            {lines.length ? (
              lines.map((line) => (
                <div key={`${line.productId}-${line.unitOfMeasureId}`} className="flex items-center justify-between gap-3 text-sm text-stone-700">
                  <span>
                    {line.productName} | {line.qty} {line.unitName.toLowerCase()}{line.qty === 1 ? '' : 's'} x {money(line.unitCost, currencySymbol)}
                    <span className="ml-2 text-xs text-stone-500">
                      ({line.receivedBaseQty ?? line.qty * line.ratioToBase} base units)
                    </span>
                  </span>
                  <div className="flex items-center gap-3">
                    <span>{money(line.qty * line.unitCost, currencySymbol)}</span>
                    <Button type="button" variant="ghost" onClick={() => removeLine(line.productId, line.unitOfMeasureId)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No lines added yet. Add one or more products to build the purchase order.</div>
            )}
          </div>

          <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            Estimated total: <span className="font-semibold text-stone-950">{money(lineTotal, currencySymbol)}</span>
          </div>

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

          <Button onClick={createPurchase} disabled={!lines.length || loading}>
            {loading ? 'Saving purchase...' : 'Save purchase'}
          </Button>
        </div>
      </Card>

      <Card>
        <div className="mb-4 text-lg font-black text-stone-900">Purchase history</div>
        <div className="space-y-3">
          {history.length ? (
            history.map((purchase) => (
              <div key={purchase.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{purchase.purchaseNumber}</div>
                    <div className="text-sm text-stone-500">{purchase.supplier.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={purchaseTone(purchase.status)}>{purchase.status}</Badge>
                      <Badge tone="blue">{purchase.items.length} line(s)</Badge>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-900">{money(purchase.totalAmount, currencySymbol)}</div>
                    <div className="text-xs text-stone-500">{dateTime(purchase.createdAt)}</div>
                  </div>
                </div>

                <div className="mt-3 space-y-2 text-sm text-stone-600">
                  {purchase.items.map((item) => (
                    <div key={item.id} className="flex justify-between">
                      <span>
                        {item.productName} x {item.qty} {item.unitName.toLowerCase()}{item.qty === 1 ? '' : 's'}
                        <span className="ml-2 text-xs text-stone-500">({item.receivedBaseQty} base units)</span>
                      </span>
                      <span>{money(item.lineTotal, currencySymbol)}</span>
                    </div>
                  ))}
                </div>

                {purchase.notes ? (
                  <div className="mt-3 text-sm text-stone-500">Notes: {purchase.notes}</div>
                ) : null}

                {purchase.status === 'DRAFT' ? (
                  <div className="mt-4 flex gap-2">
                    <Button type="button" onClick={() => updatePurchaseStatus(purchase.id, 'RECEIVED')}>
                      Receive stock
                    </Button>
                    <Button type="button" variant="secondary" onClick={() => updatePurchaseStatus(purchase.id, 'CANCELLED')}>
                      Cancel draft
                    </Button>
                  </div>
                ) : null}
              </div>
            ))
          ) : (
            <div className="text-sm text-stone-500">No purchases recorded yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
