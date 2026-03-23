'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { dateTime, money } from '@/lib/format';

type Supplier = { id: string; name: string };
type Product = { id: string; name: string; cost: string; stockQty: number };
type Purchase = { id: string; purchaseNumber: string; totalAmount: string; status: string; createdAt: string; supplier: { name: string }; };
type Line = { productId: string; productName: string; qty: number; unitCost: number };

export default function PurchaseManager({ suppliers, products, purchases, currencySymbol }: { suppliers: Supplier[]; products: Product[]; purchases: Purchase[]; currencySymbol: string }) {
  const [history, setHistory] = useState(purchases);
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id ?? '');
  const [status, setStatus] = useState<'DRAFT'|'RECEIVED'>('RECEIVED');
  const [selectedProductId, setSelectedProductId] = useState(products[0]?.id ?? '');
  const [qty, setQty] = useState('1');
  const [unitCost, setUnitCost] = useState(products[0]?.cost ?? '0');
  const [notes, setNotes] = useState('');
  const [lines, setLines] = useState<Line[]>([]);
  const [error, setError] = useState('');

  const selectedProduct = useMemo(() => products.find((product) => product.id === selectedProductId), [products, selectedProductId]);

  function addLine() {
    if (!selectedProduct) return;
    setLines((prev) => [...prev, { productId: selectedProduct.id, productName: selectedProduct.name, qty: Number(qty), unitCost: Number(unitCost) }]);
  }

  async function createPurchase() {
    setError('');
    const response = await fetch('/api/purchases', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ supplierId, status, notes: notes || null, items: lines.map((line) => ({ productId: line.productId, qty: line.qty, unitCost: line.unitCost })) })
    });
    const data = await response.json().catch(() => ({ error: 'Failed to create purchase.' }));
    if (!response.ok) return setError(data.error ?? 'Failed to create purchase.');
    setHistory((prev) => [data.purchase, ...prev]);
    setLines([]);
    setNotes('');
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
      <Card>
        <div className="mb-4 text-lg font-black text-stone-900">Stock-in / purchase entry</div>
        <div className="grid gap-4">
          <select className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={supplierId} onChange={(e) => setSupplierId(e.target.value)}>{suppliers.map((supplier) => <option key={supplier.id} value={supplier.id}>{supplier.name}</option>)}</select>
          <select className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={status} onChange={(e) => setStatus(e.target.value as 'DRAFT'|'RECEIVED')}><option value="RECEIVED">Received now</option><option value="DRAFT">Save as draft</option></select>
          <div className="grid gap-3 md:grid-cols-3">
            <select className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={selectedProductId} onChange={(e) => { setSelectedProductId(e.target.value); const hit = products.find((p) => p.id === e.target.value); if (hit) setUnitCost(hit.cost); }}>{products.map((product) => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
            <Input type="number" min={1} value={qty} onChange={(e) => setQty(e.target.value)} />
            <Input type="number" step="0.01" value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
          </div>
          <Button type="button" variant="secondary" onClick={addLine}>Add line</Button>
          <Input placeholder="Notes" value={notes} onChange={(e) => setNotes(e.target.value)} />
          <div className="space-y-2 rounded-2xl bg-stone-50 p-4">{lines.length ? lines.map((line, index) => <div key={`${line.productId}-${index}`} className="flex justify-between text-sm text-stone-700"><span>{line.productName} • {line.qty} × {money(line.unitCost, currencySymbol)}</span><span>{money(line.qty * line.unitCost, currencySymbol)}</span></div>) : <div className="text-sm text-stone-500">No lines added yet.</div>}</div>
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          <Button onClick={createPurchase} disabled={!lines.length}>Save purchase</Button>
        </div>
      </Card>
      <Card>
        <div className="mb-4 text-lg font-black text-stone-900">Purchase history</div>
        <div className="space-y-3">{history.length ? history.map((purchase) => <div key={purchase.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-center justify-between gap-3"><div><div className="font-semibold text-stone-900">{purchase.purchaseNumber}</div><div className="text-sm text-stone-500">{purchase.supplier.name}</div></div><div className="text-right"><div className="font-black text-stone-900">{money(purchase.totalAmount, currencySymbol)}</div><div className="text-xs text-stone-500">{purchase.status}</div></div></div><div className="mt-2 text-xs text-stone-500">{dateTime(purchase.createdAt)}</div></div>) : <div className="text-sm text-stone-500">No purchases recorded yet.</div>}</div>
      </Card>
    </div>
  );
}
