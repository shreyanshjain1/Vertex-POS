'use client';

import { useMemo, useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { money } from '@/lib/format';

type Product = { id: string; name: string; barcode: string | null; price: string; stockQty: number; category?: { name: string } | null };

type CartItem = Product & { qty: number };

export default function CheckoutClient({ products, taxRate, currencySymbol, cashierName }: { products: Product[]; taxRate: number; currencySymbol: string; cashierName: string }) {
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState<{ saleNumber: string; receiptNumber: string } | null>(null);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return products.slice(0, 25);
    return products.filter((product) => [product.name, product.barcode ?? '', product.category?.name ?? ''].join(' ').toLowerCase().includes(term)).slice(0, 25);
  }, [products, query]);

  function addToCart(product: Product) {
    setError('');
    setCart((prev) => {
      const current = prev.find((item) => item.id === product.id);
      if (current) {
        if (current.qty + 1 > product.stockQty) {
          setError('Cannot oversell available stock.');
          return prev;
        }
        return prev.map((item) => item.id === product.id ? { ...item, qty: item.qty + 1 } : item);
      }
      if (product.stockQty <= 0) {
        setError('This product is out of stock.');
        return prev;
      }
      return [...prev, { ...product, qty: 1 }];
    });
  }

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const discount = Number(discountAmount || 0);
  const total = Math.max(subtotal + taxAmount - discount, 0);

  async function completeSale() {
    setError('');
    setSuccess(null);
    const response = await fetch('/api/sales', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerName: customerName || null,
        customerPhone: customerPhone || null,
        paymentMethod,
        discountAmount: discount,
        notes: notes || null,
        items: cart.map((item) => ({ productId: item.id, qty: item.qty }))
      })
    });
    const data = await response.json().catch(() => ({ error: 'Failed to create sale.' }));
    if (!response.ok) return setError(data.error ?? 'Failed to create sale.');
    setSuccess({ saleNumber: data.sale.saleNumber, receiptNumber: data.sale.receiptNumber });
    setCart([]);
    setDiscountAmount('0');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
      <Card>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h2 className="text-xl font-black text-stone-900">Product search</h2><p className="text-sm text-stone-500">Search by name, barcode, or category. Barcode scanner input also lands here.</p></div><Input placeholder="Search or scan barcode..." value={query} onChange={(e) => setQuery(e.target.value)} className="md:w-80" /></div>
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filtered.map((product) => <button key={product.id} type="button" onClick={() => addToCart(product)} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"><div className="font-semibold text-stone-900">{product.name}</div><div className="mt-1 text-sm text-stone-500">{product.category?.name ?? 'Uncategorized'} • {product.stockQty} available</div><div className="mt-3 font-black text-emerald-700">{money(product.price, currencySymbol)}</div></button>)}</div>
      </Card>
      <Card>
        <h2 className="text-xl font-black text-stone-900">Current cart</h2>
        <div className="mt-4 space-y-3">{cart.length ? cart.map((item) => <div key={item.id} className="rounded-2xl border border-stone-200 p-4"><div className="flex items-start justify-between gap-3"><div><div className="font-semibold text-stone-900">{item.name}</div><div className="text-sm text-stone-500">{money(item.price, currencySymbol)} each</div></div><div className="flex items-center gap-2"><Button type="button" variant="secondary" onClick={() => setCart((prev) => prev.map((entry) => entry.id === item.id ? { ...entry, qty: Math.max(1, entry.qty - 1) } : entry))}>-</Button><span className="w-8 text-center font-semibold">{item.qty}</span><Button type="button" variant="secondary" onClick={() => addToCart(item)}>+</Button><Button type="button" variant="ghost" onClick={() => setCart((prev) => prev.filter((entry) => entry.id !== item.id))}>Remove</Button></div></div><div className="mt-2 text-sm font-semibold text-stone-700">Line total: {money(Number(item.price) * item.qty, currencySymbol)}</div></div>) : <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">No items in cart yet.</div>}</div>
        <div className="mt-5 grid gap-3"><div className="grid gap-3 md:grid-cols-2"><Input placeholder="Customer name" value={customerName} onChange={(e) => setCustomerName(e.target.value)} /><Input placeholder="Customer phone" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} /></div><div className="grid gap-3 md:grid-cols-2"><select className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)}><option>Cash</option><option>Card</option><option>E-Wallet</option><option>Bank Transfer</option></select><Input type="number" step="0.01" placeholder="Discount amount" value={discountAmount} onChange={(e) => setDiscountAmount(e.target.value)} /></div><Input placeholder={`Cashier: ${cashierName}`} value={notes} onChange={(e) => setNotes(e.target.value)} /></div>
        <div className="mt-6 space-y-2 rounded-2xl bg-stone-50 p-4 text-sm"><div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal, currencySymbol)}</span></div><div className="flex justify-between"><span>Tax</span><span>{money(taxAmount, currencySymbol)}</span></div><div className="flex justify-between"><span>Discount</span><span>-{money(discount, currencySymbol)}</span></div><div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-black text-stone-900"><span>Total</span><span>{money(total, currencySymbol)}</span></div></div>
        {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
        {success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">Sale {success.saleNumber} completed. Receipt {success.receiptNumber} is now available in sales history.</div> : null}
        <Button type="button" className="mt-4 w-full" disabled={!cart.length} onClick={completeSale}>Complete sale</Button>
      </Card>
    </div>
  );
}
