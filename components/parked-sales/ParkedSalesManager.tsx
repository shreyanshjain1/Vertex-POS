'use client';

import { ShopRole } from '@prisma/client';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money } from '@/lib/format';

type ParkedSale = {
  id: string;
  shopId: string;
  cashierUserId: string;
  customerId: string | null;
  cashierName: string;
  cashierEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
  title: string | null;
  quoteReference: string | null;
  type: 'SAVED_CART' | 'QUOTE';
  notes: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  status: 'HELD' | 'RESUMED' | 'CANCELLED' | 'EXPIRED';
  expiresAt: string;
  resumedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  itemCount: number;
  items: Array<{
    id: string;
    productId: string;
    productVariantId: string | null;
    productName: string;
    variantLabel: string | null;
    qty: number;
    unitPrice: string;
    lineTotal: string;
    createdAt: string;
  }>;
};

function getExpiryTone(expiresAt: string) {
  const msRemaining = new Date(expiresAt).getTime() - Date.now();
  if (msRemaining <= 6 * 60 * 60 * 1000) return 'border-red-200 bg-red-50 text-red-700';
  if (msRemaining <= 24 * 60 * 60 * 1000) return 'border-amber-200 bg-amber-50 text-amber-700';
  return 'border-emerald-200 bg-emerald-50 text-emerald-700';
}

export default function ParkedSalesManager({
  initialParkedSales,
  currencySymbol,
  currentUserId,
  role
}: {
  initialParkedSales: ParkedSale[];
  currencySymbol: string;
  currentUserId: string;
  role: ShopRole;
}) {
  const [parkedSales, setParkedSales] = useState(initialParkedSales);
  const [query, setQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'ALL' | 'SAVED_CART' | 'QUOTE'>('ALL');
  const [ownershipFilter, setOwnershipFilter] = useState<'ALL' | 'MINE'>('ALL');
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [error, setError] = useState('');

  const visibleSales = useMemo(() => {
    const term = query.trim().toLowerCase();
    return parkedSales.filter((sale) => {
      if (typeFilter !== 'ALL' && sale.type !== typeFilter) return false;
      if (ownershipFilter === 'MINE' && sale.cashierUserId !== currentUserId) return false;
      if (!term) return true;
      return [
        sale.customerName ?? '',
        sale.customerPhone ?? '',
        sale.cashierName,
        sale.cashierEmail ?? '',
        sale.title ?? '',
        sale.quoteReference ?? '',
        ...sale.items.map((item) => `${item.productName} ${item.variantLabel ?? ''}`)
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [currentUserId, ownershipFilter, parkedSales, query, typeFilter]);

  const totals = useMemo(() => ({
    count: visibleSales.length,
    quoteCount: visibleSales.filter((sale) => sale.type === 'QUOTE').length,
    cartCount: visibleSales.filter((sale) => sale.type === 'SAVED_CART').length,
    totalAmount: visibleSales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0)
  }), [visibleSales]);

  async function cancelParkedSale(parkedSale: ParkedSale) {
    if (!window.confirm(`Cancel this ${parkedSale.type === 'QUOTE' ? 'quote' : 'saved cart'}?`)) return;
    setCancelLoadingId(parkedSale.id);
    setError('');
    setFeedback('');
    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({ error: 'Unable to cancel the saved entry.' }));
      if (!response.ok) {
        setError(data?.error ?? 'Unable to cancel the saved entry.');
        return;
      }
      setParkedSales((current) => current.filter((entry) => entry.id !== parkedSale.id));
      setFeedback(`${parkedSale.type === 'QUOTE' ? 'Quote' : 'Saved cart'} cancelled successfully.`);
    } catch {
      setError('Unable to cancel the saved entry.');
    } finally {
      setCancelLoadingId(null);
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Workspace</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Held checkout visibility</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Managers can review all active held entries. Cashiers can still focus on their own work, print quotes, and reopen saved carts directly inside checkout.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-4">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Visible</div><div className="mt-1 text-2xl font-black text-stone-950">{totals.count}</div></div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Quotes</div><div className="mt-1 text-2xl font-black text-sky-700">{totals.quoteCount}</div></div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Saved carts</div><div className="mt-1 text-2xl font-black text-amber-700">{totals.cartCount}</div></div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Value</div><div className="mt-1 text-2xl font-black text-stone-950">{money(totals.totalAmount, currencySymbol)}</div></div>
          </div>
        </div>

        <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_180px]">
          <Input placeholder="Search by quote ref, customer, cashier, or item" value={query} onChange={(event) => setQuery(event.target.value)} />
          <select className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-emerald-500" value={typeFilter} onChange={(event) => setTypeFilter(event.target.value as 'ALL' | 'SAVED_CART' | 'QUOTE')}>
            <option value="ALL">All types</option>
            <option value="QUOTE">Quotes only</option>
            <option value="SAVED_CART">Saved carts only</option>
          </select>
          <select className="h-11 rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-emerald-500" value={ownershipFilter} onChange={(event) => setOwnershipFilter(event.target.value as 'ALL' | 'MINE')}>
            <option value="ALL">{role === 'MANAGER' || role === 'ADMIN' ? 'All cashiers' : 'Visible to me'}</option>
            <option value="MINE">My entries</option>
          </select>
        </div>

        {feedback ? <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{feedback}</div> : null}
        {error ? <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
      </Card>

      <div className="space-y-4">
        {visibleSales.length ? visibleSales.map((sale) => (
          <Card key={sale.id} className="space-y-4">
            <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${sale.type === 'QUOTE' ? 'border-sky-200 bg-sky-50 text-sky-700' : 'border-amber-200 bg-amber-50 text-amber-700'}`}>{sale.type === 'QUOTE' ? 'Quote' : 'Saved cart'}</span>
                  <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${getExpiryTone(sale.expiresAt)}`}>Expires {dateTime(sale.expiresAt)}</span>
                  <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">{sale.itemCount} item(s)</span>
                  {sale.quoteReference ? <span className="rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-sky-700">{sale.quoteReference}</span> : null}
                </div>
                <div className="mt-3 flex flex-wrap items-end gap-4">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Total</div>
                    <div className="mt-1 text-3xl font-black text-stone-950">{money(sale.totalAmount, currencySymbol)}</div>
                  </div>
                  <div className="min-w-[220px] text-sm text-stone-500">
                    <div><span className="font-semibold text-stone-700">Cashier:</span> {sale.cashierName}</div>
                    <div><span className="font-semibold text-stone-700">Customer:</span> {sale.customerName || 'Walk-in / not attached'}</div>
                    <div><span className="font-semibold text-stone-700">Created:</span> {dateTime(sale.createdAt)}</div>
                  </div>
                </div>
                {sale.title ? <div className="mt-3 text-sm font-semibold text-stone-700">{sale.title}</div> : null}
                {sale.notes ? <div className="mt-3 rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">{sale.notes}</div> : null}
              </div>
              <div className="grid min-w-[250px] gap-2">
                <Link href={`/checkout?parkedSaleId=${sale.id}`} className="inline-flex">
                  <Button type="button" className="w-full justify-center">{sale.type === 'QUOTE' ? 'Load in checkout' : 'Resume in checkout'}</Button>
                </Link>
                {sale.type === 'QUOTE' ? (
                  <Link href={`/print/quote/${sale.id}`} className="inline-flex" target="_blank">
                    <Button type="button" variant="secondary" className="w-full justify-center">Print quote</Button>
                  </Link>
                ) : null}
                <Button type="button" variant="danger" className="w-full justify-center" disabled={cancelLoadingId === sale.id} onClick={() => void cancelParkedSale(sale)}>{cancelLoadingId === sale.id ? 'Cancelling...' : 'Cancel entry'}</Button>
              </div>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Held line items</div>
              <div className="mt-3 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sale.items.map((item) => (
                  <div key={item.id} className="rounded-[20px] border border-stone-200 bg-white px-4 py-3">
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="mt-1 text-sm text-stone-500">{item.variantLabel ?? 'Base item'}</div>
                    <div className="mt-3 flex items-center justify-between text-sm"><span className="text-stone-500">Qty</span><span className="font-semibold text-stone-900">{item.qty}</span></div>
                    <div className="mt-1 flex items-center justify-between text-sm"><span className="text-stone-500">Unit</span><span className="font-semibold text-stone-900">{money(item.unitPrice, currencySymbol)}</span></div>
                    <div className="mt-1 flex items-center justify-between text-sm"><span className="text-stone-500">Line total</span><span className="font-semibold text-stone-900">{money(item.lineTotal, currencySymbol)}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        )) : (
          <Card>
            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-4 py-8 text-center">
              <div className="text-sm font-semibold text-stone-900">No saved carts or quotes matched these filters.</div>
              <div className="mt-2 text-sm text-stone-500">Try changing the type filter, ownership filter, or free-text search.</div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
