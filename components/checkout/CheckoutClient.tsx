'use client';

import { useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
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
type ScanFeedback = { tone: 'success' | 'error'; message: string } | null;

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  const tagName = target.tagName;
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

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
  const scanInputRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<CartItem[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [query, setQuery] = useState('');
  const [scanQuery, setScanQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [paymentMethod, setPaymentMethod] = useState('Cash');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(null);
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

  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const discount = Number(discountAmount || 0);
  const total = Math.max(subtotal + taxAmount - discount, 0);
  const canCompleteSale = cart.length > 0 && !loading && discount >= 0 && discount <= subtotal + taxAmount;

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  function focusScanInput(selectText = false) {
    const input = scanInputRef.current;
    if (!input) {
      return;
    }

    input.focus();
    if (selectText) {
      input.select();
    }
  }

  function addToCart(product: Product) {
    setError('');
    const existing = cartRef.current.find((item) => item.id === product.id);

    if (existing) {
      if (existing.qty + 1 > product.stockQty) {
        setError(`Cannot oversell. ${product.name} only has ${product.stockQty} in stock.`);
        return false;
      }

      setCart((currentCart) =>
        currentCart.map((item) =>
          item.id === product.id ? { ...item, qty: item.qty + 1 } : item
        )
      );
      return true;
    }

    if (product.stockQty <= 0) {
      setError(`${product.name} is out of stock.`);
      return false;
    }

    setCart((currentCart) => [...currentCart, { ...product, qty: 1 }]);
    return true;
  }

  function updateQty(productId: string, direction: 'increase' | 'decrease') {
    const product = products.find((item) => item.id === productId);
    if (!product) {
      return;
    }

    setError('');
    setScanFeedback(null);
    setCart((currentCart) => {
      const existing = currentCart.find((item) => item.id === productId);
      if (!existing) {
        return currentCart;
      }

      const nextQty = direction === 'increase' ? existing.qty + 1 : existing.qty - 1;
      if (nextQty <= 0) {
        return currentCart.filter((item) => item.id !== productId);
      }

      if (nextQty > product.stockQty) {
        setError(`Cannot oversell. ${product.name} only has ${product.stockQty} in stock.`);
        return currentCart;
      }

      return currentCart.map((item) =>
        item.id === productId ? { ...item, qty: nextQty } : item
      );
    });
  }

  function removeFromCart(productId: string) {
    setError('');
    setScanFeedback(null);
    setCart((currentCart) => currentCart.filter((item) => item.id !== productId));
  }

  function clearCart() {
    setCart([]);
    setDiscountAmount('0');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setScanQuery('');
    setScanFeedback(null);
    setError('');
  }

  function requestClearCart() {
    if (!cart.length || loading) {
      return;
    }

    const shouldClear = window.confirm('Clear all items from the current cart?');
    if (!shouldClear) {
      return;
    }

    clearCart();
    focusScanInput();
  }

  function findProductByScan(value: string) {
    const normalizedValue = value.trim();
    const normalizedSku = normalizedValue.toLowerCase();

    return (
      products.find((product) => product.barcode?.trim() === normalizedValue) ??
      products.find((product) => product.sku?.trim().toLowerCase() === normalizedSku) ??
      null
    );
  }

  function handleScanSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const value = scanQuery.trim();
    setError('');
    setScanFeedback(null);

    if (!value) {
      setScanFeedback({
        tone: 'error',
        message: 'Scan or enter a barcode/SKU, then press Enter to add it.'
      });
      focusScanInput();
      return;
    }

    const product = findProductByScan(value);
    if (!product) {
      setScanFeedback({
        tone: 'error',
        message: `No product matched barcode/SKU "${value}".`
      });
      focusScanInput(true);
      return;
    }

    const added = addToCart(product);
    if (!added) {
      focusScanInput(true);
      return;
    }

    setScanQuery('');
    setScanFeedback({
      tone: 'success',
      message: `${product.name} added to cart.`
    });
    focusScanInput();
  }

  async function completeSale() {
    setError('');

    if (!cart.length) {
      setError('Please add at least one item to the cart.');
      return;
    }

    if (discount < 0) {
      setError('Discount amount cannot be negative.');
      return;
    }

    if (discount > subtotal + taxAmount) {
      setError('Discount cannot exceed the sale total.');
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

      clearCart();
      router.push(`/print/receipt/${data.sale.id}?autoprint=1`);
      router.refresh();
    } catch {
      setLoading(false);
      setError('Failed to create sale.');
    }
  }

  const handleCompleteSaleShortcut = useEffectEvent(() => {
    void completeSale();
  });

  const handleClearCartShortcut = useEffectEvent(() => {
    requestClearCart();
  });

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'F2') {
        event.preventDefault();
        focusScanInput(true);
        return;
      }

      if (isTypingTarget(event.target)) {
        return;
      }

      if (event.key === 'F9' && canCompleteSale) {
        event.preventDefault();
        handleCompleteSaleShortcut();
        return;
      }

      if (event.key === 'F4' && cart.length) {
        event.preventDefault();
        handleClearCartShortcut();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [canCompleteSale, cart.length]);

  return (
    <div className="grid gap-6 xl:grid-cols-[1.08fr_0.92fr]">
      <Card className="overflow-hidden">
        <div className="mb-5 flex flex-col gap-4">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Product browser</div>
              <h2 className="mt-2 text-2xl font-black text-stone-900">Find products</h2>
              <p className="mt-1 text-sm text-stone-500">
                Search by name, SKU, barcode, or category to build a reliable cart quickly.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-3 sm:w-auto">
              <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Visible</div>
                <div className="mt-1 text-xl font-black text-stone-950">{filtered.length}</div>
              </div>
              <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Cart lines</div>
                <div className="mt-1 text-xl font-black text-stone-950">{cart.length}</div>
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-3 sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
              <form onSubmit={handleScanSubmit} className="flex gap-3">
                <Input
                  ref={scanInputRef}
                  placeholder="Scan barcode or enter SKU"
                  value={scanQuery}
                  onChange={(event) => setScanQuery(event.target.value)}
                />
                <Button type="submit" variant="secondary" className="shrink-0">
                  Add
                </Button>
              </form>

              <Input
                placeholder="Search by product name, SKU, barcode..."
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>

            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setSelectedCategory('')}
                className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  !selectedCategory
                    ? 'border-emerald-600 bg-emerald-600 text-white shadow-[0_14px_28px_-22px_rgba(5,150,105,0.9)]'
                    : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                }`}
              >
                All
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setSelectedCategory(category.id)}
                  className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                    selectedCategory === category.id
                      ? 'border-emerald-600 bg-emerald-600 text-white shadow-[0_14px_28px_-22px_rgba(5,150,105,0.9)]'
                      : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>

            <div className="mt-3 flex flex-wrap gap-2 text-xs text-stone-500">
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 font-semibold text-stone-600">
                F2 focus scan
              </span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 font-semibold text-stone-600">
                F9 complete sale
              </span>
              <span className="rounded-full border border-stone-200 bg-white px-3 py-1.5 font-semibold text-stone-600">
                F4 clear cart
              </span>
            </div>

            {scanFeedback ? (
              <div
                className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${
                  scanFeedback.tone === 'success'
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-red-200 bg-red-50 text-red-700'
                }`}
              >
                {scanFeedback.message}
              </div>
            ) : null}
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => {
            const stockTone =
              product.stockQty <= 0
                ? 'border-red-200 bg-red-50 text-red-700'
                : product.stockQty <= 5
                  ? 'border-amber-200 bg-amber-50 text-amber-700'
                  : 'border-emerald-200 bg-emerald-50 text-emerald-700';

            return (
              <button
                key={product.id}
                type="button"
                onClick={() => {
                  setScanFeedback(null);
                  addToCart(product);
                }}
                className="group rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.92))] p-4 text-left shadow-[0_18px_36px_-30px_rgba(28,25,23,0.35)] transition hover:-translate-y-1 hover:border-emerald-300 hover:shadow-[0_22px_40px_-28px_rgba(5,150,105,0.35)]"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-stone-900">{product.name}</div>
                    <div className="mt-1 text-sm text-stone-500">{product.category?.name ?? 'Uncategorized'}</div>
                  </div>
                  <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${stockTone}`}>
                    {product.stockQty <= 0 ? 'Out' : product.stockQty <= 5 ? 'Low' : 'Ready'}
                  </div>
                </div>

                <div className="mt-3 rounded-[20px] border border-stone-200/80 bg-white/80 px-3 py-2 text-xs text-stone-500">
                  SKU: {product.sku ?? 'N/A'} / Barcode: {product.barcode ?? 'N/A'}
                </div>

                <div className="mt-4 flex items-end justify-between gap-3">
                  <div>
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Selling price</div>
                    <div className="mt-1 text-2xl font-black text-emerald-700">{money(product.price, currencySymbol)}</div>
                  </div>
                  <div className="text-right text-xs font-medium text-stone-500">
                    <div>{product.stockQty} in stock</div>
                    <div className="mt-1 text-stone-400 group-hover:text-stone-500">Tap to add</div>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {!filtered.length ? (
          <div className="mt-6 rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
            No products matched that search. Try a different term or clear the category filter.
          </div>
        ) : null}
      </Card>

      <Card className="xl:sticky xl:top-6">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Sale desk</div>
            <h2 className="mt-2 text-2xl font-black text-stone-900">Checkout summary</h2>
            <p className="mt-1 text-sm text-stone-500">
              Cashier: <span className="font-semibold text-stone-700">{cashierName}</span>
            </p>
          </div>
          <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Items</div>
            <div className="text-2xl font-black text-stone-950">{itemCount}</div>
          </div>
        </div>

        <div className="space-y-3">
          {cart.length ? (
            cart.map((item) => (
              <div key={item.id} className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.9))] p-4">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.name}</div>
                    <div className="text-sm text-stone-500">{money(item.price, currencySymbol)} each</div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button type="button" variant="secondary" className="h-10 w-10 px-0" onClick={() => updateQty(item.id, 'decrease')}>
                      -
                    </Button>
                    <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-white px-3 text-center font-semibold text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
                      {item.qty}
                    </span>
                    <Button type="button" variant="secondary" className="h-10 w-10 px-0" onClick={() => updateQty(item.id, 'increase')}>
                      +
                    </Button>
                    <Button type="button" variant="ghost" className="h-10 px-3 text-xs uppercase tracking-[0.14em]" onClick={() => removeFromCart(item.id)}>
                      Remove
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between gap-3 rounded-[20px] border border-stone-200/80 bg-white/80 px-3 py-2.5 text-sm">
                  <span className="text-stone-500">Line total</span>
                  <span className="font-semibold text-stone-900">{money(Number(item.price) * item.qty, currencySymbol)}</span>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">
              No items in the cart yet. Add products from the catalog to start the sale.
            </div>
          )}
        </div>

        <div className="mt-5 space-y-4 rounded-[26px] border border-stone-200 bg-stone-50/85 p-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Customer and payment</div>
            <p className="mt-1 text-sm text-stone-500">Optional customer details help with receipt context and follow-up support.</p>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <Input
              placeholder="Customer name"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
            <Input
              placeholder="Customer phone"
              value={customerPhone}
              onChange={(event) => setCustomerPhone(event.target.value)}
            />
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select
              className="h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              value={paymentMethod}
              onChange={(event) => setPaymentMethod(event.target.value)}
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
              onChange={(event) => setDiscountAmount(event.target.value)}
            />
          </div>

          <Input
            placeholder="Notes for this sale"
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
          />
        </div>

        <div className="mt-6 overflow-hidden rounded-[28px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,245,244,0.96))]">
          <div className="border-b border-stone-200 bg-stone-950 px-5 py-4 text-white">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-300">Payment summary</div>
            <div className="mt-2 flex items-end justify-between gap-4">
              <div>
                <div className="text-sm text-stone-300">Total due</div>
                <div className="text-3xl font-black tracking-tight">{money(total, currencySymbol)}</div>
              </div>
              <div className="rounded-full bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-200">
                {itemCount} item(s)
              </div>
            </div>
          </div>

          <div className="space-y-3 p-5 text-sm">
            <div className="flex justify-between">
              <span>Subtotal</span>
              <span>{money(subtotal, currencySymbol)}</span>
            </div>
            <div className="flex justify-between">
              <span>Tax ({taxRate}%)</span>
              <span>{money(taxAmount, currencySymbol)}</span>
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

          <div className="px-5 pb-5">
            <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
              {cart.length
                ? `${itemCount} item(s) across ${cart.length} line(s) are ready for validation and receipt printing.`
                : 'Add at least one product before finalizing the sale.'}
            </div>
          </div>
        </div>

        {error ? (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-5 flex flex-col gap-3 sm:flex-row">
          <Button type="button" className="flex-1" disabled={!canCompleteSale} onClick={() => void completeSale()}>
            {loading ? 'Completing sale...' : 'Complete sale'}
          </Button>
          <Button type="button" variant="secondary" className="sm:min-w-32" disabled={!cart.length || loading} onClick={requestClearCart}>
            Clear
          </Button>
        </div>
      </Card>
    </div>
  );
}
