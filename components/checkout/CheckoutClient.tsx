'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import { money } from '@/lib/format';

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  name: string;
  barcode: string | null;
  sku: string | null;
  price: string;
  stockQty: number;
  categoryId: string | null;
  category?: { id: string; name: string } | null;
};

type CartItem = Product & { qty: number };

export default function CheckoutClient({
  products,
  categories,
  taxRate,
  currencySymbol,
  cashierName
}: {
  products: Product[];
  categories: Category[];
  taxRate: number;
  currencySymbol: string;
  cashierName: string;
}) {
  const router = useRouter();

  const [selectedCategory, setSelectedCategory] = useState('');
  const [query, setQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();

    return products
      .filter((product) => {
        const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;

        const matchesTerm =
          !term ||
          [product.name, product.barcode ?? '', product.sku ?? '', product.category?.name ?? '']
            .join(' ')
            .toLowerCase()
            .includes(term);

        return matchesCategory && matchesTerm;
      })
      .slice(0, 30);
  }, [products, query, selectedCategory]);

  function addToCart(product: Product) {
    setError('');

    setCart((prev) => {
      const current = prev.find((item) => item.id === product.id);

      if (current) {
        if (current.qty + 1 > product.stockQty) {
          setError(`Cannot oversell. ${product.name} only has ${product.stockQty} in stock.`);
          return prev;
        }

        return prev.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item));
      }

      if (product.stockQty <= 0) {
        setError(`${product.name} is out of stock.`);
        return prev;
      }

      return [...prev, { ...product, qty: 1 }];
    });
  }

  function decreaseQty(productId: string) {
    setCart((prev) =>
      prev
        .map((item) => (item.id === productId ? { ...item, qty: Math.max(item.qty - 1, 0) } : item))
        .filter((item) => item.qty > 0)
    );
  }

  function increaseQty(productId: string) {
    const hit = products.find((product) => product.id === productId);
    if (!hit) return;
    addToCart(hit);
  }

  function removeFromCart(productId: string) {
    setCart((prev) => prev.filter((item) => item.id !== productId));
  }

  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const vatAmount = subtotal * (taxRate / 100);
  const discount = Number(discountAmount || 0);
  const total = Math.max(subtotal + vatAmount - discount, 0);

  async function completeSale() {
    setError('');

    if (!cart.length) {
      setError('Please add at least one item to cart.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          paymentMethod,
          discountAmount: discount,
          notes: notes || null,
          items: cart.map((item) => ({
            productId: item.id,
            qty: item.qty
          }))
        })
      });

      const data = await response.json().catch(() => ({
        error: 'Failed to create sale.'
      }));

      setLoading(false);

      if (!response.ok) {
        setError(data.error ?? 'Failed to create sale.');
        return;
      }

      setCart([]);
      setDiscountAmount('0');
      setCustomerName('');
      setCustomerPhone('');
      setNotes('');

      router.push(`/print/receipt/${data.sale.id}?autoprint=1`);
      router.refresh();
    } catch {
      setLoading(false);
      setError('Failed to create sale.');
    }
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <Card>
        <div className="mb-5 flex flex-col gap-4">
          <div>
            <h2 className="text-2xl font-black text-stone-900">Find products</h2>
            <p className="mt-1 text-sm text-stone-500">
              Choose a category first, then search or scan a barcode.
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-[240px_1fr]">
            <select
              className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>

            <Input
              placeholder="Search by name, SKU, barcode..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <button
              key={product.id}
              type="button"
              onClick={() => addToCart(product)}
              className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50"
            >
              <div className="font-semibold text-stone-900">{product.name}</div>
              <div className="mt-1 text-sm text-stone-500">
                {product.category?.name ?? 'Uncategorized'}
              </div>
              <div className="mt-1 text-xs text-stone-500">
                SKU: {product.sku ?? '—'} • Barcode: {product.barcode ?? '—'}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="font-black text-emerald-700">
                  {money(product.price, currencySymbol)}
                </div>
                <div className="text-xs font-medium text-stone-500">
                  {product.stockQty} in stock
                </div>
              </div>
            </button>
          ))}
        </div>

        {!filtered.length ? (
          <div className="mt-6 rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
            No matching products found.
          </div>
        ) : null}
      </Card>

      <Card>
        <div className="mb-4">
          <h2 className="text-2xl font-black text-stone-900">Current cart</h2>
          <p className="mt-1 text-sm text-stone-500">
            Cashier: <span className="font-semibold text-stone-700">{cashierName}</span>
          </p>
        </div>

        <div className="space-y-3">
          {cart.length ? (
            cart.map((item) => (
              <div key={item.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.name}</div>
                    <div className="text-sm text-stone-500">
                      {money(item.price, currencySymbol)} each
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" onClick={() => decreaseQty(item.id)}>
                      -
                    </Button>
                    <span className="w-8 text-center font-semibold">{item.qty}</span>
                    <Button type="button" variant="secondary" onClick={() => increaseQty(item.id)}>
                      +
                    </Button>
                    <Button type="button" variant="ghost" onClick={() => removeFromCart(item.id)}>
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="mt-3 text-sm font-semibold text-stone-700">
                  Line total: {money(Number(item.price) * item.qty, currencySymbol)}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
              No items in cart yet.
            </div>
          )}
        </div>

        <div className="mt-5 grid gap-3">
          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Customer name"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
            />
            <Input
              placeholder="Customer phone"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
            >
              <option>Cash</option>
              <option>Card</option>
              <option>E-Wallet</option>
              <option>Bank Transfer</option>
            </select>

            <Input
              type="number"
              step="0.01"
              placeholder="Discount amount"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
            />
          </div>

          <Input
            placeholder="Notes for this sale"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <div className="mt-6 rounded-2xl bg-stone-50 p-5">
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(subtotal, currencySymbol)}</span>
            </div>
            <div className="flex justify-between">
              <span>VAT ({taxRate}%)</span>
              <span>{money(vatAmount, currencySymbol)}</span>
            </div>
            <div className="flex justify-between">
              <span>Discount</span>
              <span>-{money(discount, currencySymbol)}</span>
            </div>
            <div className="flex justify-between border-t border-stone-200 pt-3 text-lg font-black text-stone-900">
              <span>Total</span>
              <span>{money(total, currencySymbol)}</span>
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <Button
          type="button"
          className="mt-4 w-full"
          disabled={!cart.length || loading}
          onClick={completeSale}
        >
          {loading ? 'Completing sale...' : 'Complete sale'}
        </Button>
      </Card>
    </div>
  );
}
