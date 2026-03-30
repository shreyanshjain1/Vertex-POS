'use client';

import { type FormEvent, useEffect, useEffectEvent, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money } from '@/lib/format';
import { roundCurrency } from '@/lib/inventory';
import {
  getPaymentSummary,
  getQuickCashAmounts,
  PAYMENT_METHODS,
  PaymentMethod,
  requiresReferenceNumber
} from '@/lib/payments';

type Category = { id: string; name: string };
type Product = {
  id: string;
  productId: string;
  variantId: string | null;
  name: string;
  variantLabel: string | null;
  barcode: string | null;
  sku: string | null;
  price: string;
  stockQty: number;
  categoryId: string | null;
  imageUrl: string | null;
  category?: { id: string; name: string } | null;
};
type CartItem = Product & { qty: number };
type ScanFeedback = { tone: 'success' | 'error'; message: string } | null;
type PaymentLine = {
  id: string;
  method: PaymentMethod;
  amount: string;
  referenceNumber: string;
};
type ParkedSale = {
  id: string;
  shopId: string;
  cashierUserId: string;
  cashierName: string;
  cashierEmail: string | null;
  customerName: string | null;
  customerPhone: string | null;
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

function isTypingTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tagName = target.tagName;
  return target.isContentEditable || tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT';
}

function toNumber(value: string) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function createPaymentLine(method: PaymentMethod): PaymentLine {
  return { id: crypto.randomUUID(), method, amount: '', referenceNumber: '' };
}

function getOptionDisplayName(product: Pick<Product, 'name' | 'variantLabel'>) {
  return product.variantLabel ? `${product.name} - ${product.variantLabel}` : product.name;
}

function getReservedQtyForProduct(items: CartItem[], productId: string, exceptOptionId?: string) {
  return items.reduce((sum, item) => {
    if (item.productId !== productId) return sum;
    if (exceptOptionId && item.id === exceptOptionId) return sum;
    return sum + item.qty;
  }, 0);
}

export default function CheckoutClient({
  products,
  categories,
  taxRate,
  currencySymbol,
  cashierName,
  hasActiveCashSession,
  initialParkedSales
}: {
  products: Product[];
  categories: Category[];
  taxRate: number;
  currencySymbol: string;
  cashierName: string;
  hasActiveCashSession: boolean;
  initialParkedSales: ParkedSale[];
}) {
  const router = useRouter();
  const scanInputRef = useRef<HTMLInputElement>(null);
  const cartRef = useRef<CartItem[]>([]);
  const canAcceptCash = hasActiveCashSession;

  const [selectedCategory, setSelectedCategory] = useState('');
  const [query, setQuery] = useState('');
  const [scanQuery, setScanQuery] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discountAmount, setDiscountAmount] = useState('0');
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [payments, setPayments] = useState<PaymentLine[]>([
    createPaymentLine(canAcceptCash ? 'Cash' : 'Card')
  ]);
  const [parkedSales, setParkedSales] = useState<ParkedSale[]>(initialParkedSales);
  const [error, setError] = useState('');
  const [scanFeedback, setScanFeedback] = useState<ScanFeedback>(null);
  const [parkedFeedback, setParkedFeedback] = useState('');
  const [loading, setLoading] = useState(false);
  const [holding, setHolding] = useState(false);
  const [resumeLoadingId, setResumeLoadingId] = useState<string | null>(null);
  const [cancelLoadingId, setCancelLoadingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    return products
      .filter((product) => {
        const matchesCategory = !selectedCategory || product.categoryId === selectedCategory;
        const matchesTerm =
          !term ||
          [product.name, product.variantLabel ?? '', product.barcode ?? '', product.sku ?? '', product.category?.name ?? '']
            .join(' ')
            .toLowerCase()
            .includes(term);
        return matchesCategory && matchesTerm;
      })
      .slice(0, 30);
  }, [products, query, selectedCategory]);

  const productMap = useMemo(() => new Map(products.map((product) => [product.id, product])), [products]);
  const itemCount = cart.reduce((sum, item) => sum + item.qty, 0);
  const subtotal = cart.reduce((sum, item) => sum + Number(item.price) * item.qty, 0);
  const taxAmount = subtotal * (taxRate / 100);
  const discount = Number(discountAmount || 0);
  const total = Math.max(subtotal + taxAmount - discount, 0);

  const paymentInputs = useMemo(
    () =>
      payments.map((payment) => ({
        method: payment.method,
        amount: roundCurrency(toNumber(payment.amount)),
        referenceNumber: payment.referenceNumber.trim() || null
      })),
    [payments]
  );

  const paymentSummary = useMemo(() => getPaymentSummary(total, paymentInputs), [paymentInputs, total]);

  const paymentError = useMemo(() => {
    if (!payments.length) return 'Add at least one payment line.';
    for (const payment of paymentInputs) {
      if (payment.amount <= 0) return 'Each payment line needs an amount greater than zero.';
      if (requiresReferenceNumber(payment.method) && !payment.referenceNumber) {
        return `${payment.method} payments require a reference number.`;
      }
    }
    if (paymentSummary.totalPaid < total) return 'Total paid must cover the sale total before checkout can finish.';
    if (!paymentSummary.hasCashPayment && paymentSummary.totalPaid !== total) {
      return 'Non-cash payments must match the sale total exactly.';
    }
    return '';
  }, [paymentInputs, paymentSummary, payments.length, total]);

  const canCompleteSale =
    cart.length > 0 &&
    !loading &&
    discount >= 0 &&
    discount <= subtotal + taxAmount &&
    !paymentError;

  useEffect(() => {
    cartRef.current = cart;
  }, [cart]);

  function focusScanInput(selectText = false) {
    const input = scanInputRef.current;
    if (!input) return;
    input.focus();
    if (selectText) input.select();
  }

  function resetPayments() {
    setPayments([createPaymentLine(canAcceptCash ? 'Cash' : 'Card')]);
  }

  function resetCheckoutState() {
    setCart([]);
    setDiscountAmount('0');
    setCustomerName('');
    setCustomerPhone('');
    setNotes('');
    setScanQuery('');
    setScanFeedback(null);
    setError('');
    resetPayments();
  }

  function addToCart(product: Product) {
    setError('');
    setParkedFeedback('');
    const existing = cartRef.current.find((item) => item.id === product.id);
    const reservedQty = getReservedQtyForProduct(cartRef.current, product.productId);

    if (existing) {
      if (reservedQty + 1 > product.stockQty) {
        setError(`Cannot oversell. ${product.name} only has ${product.stockQty} in stock.`);
        return false;
      }
      setCart((current) => current.map((item) => (item.id === product.id ? { ...item, qty: item.qty + 1 } : item)));
      return true;
    }

    if (product.stockQty <= 0) {
      setError(`${product.name} is out of stock.`);
      return false;
    }

    if (reservedQty + 1 > product.stockQty) {
      setError(`Cannot oversell. ${product.name} only has ${product.stockQty} in stock.`);
      return false;
    }

    setCart((current) => [...current, { ...product, qty: 1 }]);
    return true;
  }

  function updateQty(optionId: string, direction: 'increase' | 'decrease') {
    const product = productMap.get(optionId);
    if (!product) return;
    setError('');
    setScanFeedback(null);
    setParkedFeedback('');
    setCart((current) => {
      const existing = current.find((item) => item.id === optionId);
      if (!existing) return current;
      const nextQty = direction === 'increase' ? existing.qty + 1 : existing.qty - 1;
      if (nextQty <= 0) return current.filter((item) => item.id !== optionId);

      const reservedOtherQty = getReservedQtyForProduct(current, product.productId, optionId);
      if (reservedOtherQty + nextQty > product.stockQty) {
        setError(`Cannot oversell. ${product.name} only has ${product.stockQty} in stock.`);
        return current;
      }

      return current.map((item) => (item.id === optionId ? { ...item, qty: nextQty } : item));
    });
  }

  function removeFromCart(optionId: string) {
    setError('');
    setScanFeedback(null);
    setParkedFeedback('');
    setCart((current) => current.filter((item) => item.id !== optionId));
  }

  function requestClearCart() {
    if (!cart.length || loading || holding) return;
    if (!window.confirm('Clear all items from the current cart?')) return;
    resetCheckoutState();
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

  function handleScanSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = scanQuery.trim();
    setError('');
    setParkedFeedback('');
    setScanFeedback(null);
    if (!value) {
      setScanFeedback({ tone: 'error', message: 'Scan or enter a barcode/SKU, then press Enter to add it.' });
      focusScanInput();
      return;
    }
    const product = findProductByScan(value);
    if (!product) {
      setScanFeedback({ tone: 'error', message: `No product matched barcode/SKU "${value}".` });
      focusScanInput(true);
      return;
    }
    const added = addToCart(product);
    if (!added) {
      focusScanInput(true);
      return;
    }
    setScanQuery('');
    setScanFeedback({ tone: 'success', message: `${getOptionDisplayName(product)} added to cart.` });
    focusScanInput();
  }

  function updatePaymentLine(lineId: string, patch: Partial<PaymentLine>) {
    setPayments((current) =>
      current.map((payment) => {
        if (payment.id !== lineId) return payment;
        const next = { ...payment, ...patch };
        if (patch.method && !requiresReferenceNumber(patch.method)) next.referenceNumber = '';
        return next;
      })
    );
  }

  function addPaymentLine() {
    const nextMethod = canAcceptCash && payments.every((payment) => payment.method !== 'Cash') ? 'Cash' : 'Card';
    setPayments((current) => [...current, createPaymentLine(nextMethod)]);
  }

  function removePaymentLine(lineId: string) {
    setPayments((current) => (current.length === 1 ? current : current.filter((payment) => payment.id !== lineId)));
  }

  function getExactAmountForLine(lineId: string) {
    const paidExcludingLine = roundCurrency(
      paymentInputs.reduce((sum, payment, index) => (payments[index]?.id === lineId ? sum : sum + payment.amount), 0)
    );
    return roundCurrency(Math.max(total - paidExcludingLine, 0));
  }

  function setPaymentLineAmount(lineId: string, amount: number) {
    updatePaymentLine(lineId, { amount: amount.toFixed(2) });
  }

  async function holdCart() {
    setError('');
    setParkedFeedback('');
    if (!cart.length) {
      setError('Add at least one item before holding the cart.');
      return;
    }
    setHolding(true);
    try {
      const response = await fetch('/api/parked-sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          discountAmount: discount,
          notes: notes || null,
          items: cart.map((item) => ({ productId: item.productId, variantId: item.variantId, qty: item.qty }))
        })
      });
      const data = await response.json().catch(() => ({ error: 'Unable to hold the cart.' }));
      setHolding(false);
      if (!response.ok || !data?.parkedSale) {
        setError(data?.error ?? 'Unable to hold the cart.');
        return;
      }
      setParkedSales((current) => [data.parkedSale, ...current].slice(0, 20));
      resetCheckoutState();
      setParkedFeedback('Cart held successfully and moved to the held cart list.');
      focusScanInput();
    } catch {
      setHolding(false);
      setError('Unable to hold the cart.');
    }
  }

  async function resumeParkedSale(parkedSale: ParkedSale) {
    setError('');
    setParkedFeedback('');
    const missingOption = parkedSale.items.find((item) => !productMap.has(item.productVariantId ?? item.productId));
    if (missingOption) {
      setError('One or more items in this held cart are no longer available in the active catalog.');
      return;
    }
    if (cart.length && !window.confirm('Resume this held cart and replace the current checkout cart?')) return;
    setResumeLoadingId(parkedSale.id);
    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}/resume`, { method: 'POST' });
      const data = await response.json().catch(() => ({ error: 'Unable to resume the held cart.' }));
      setResumeLoadingId(null);
      if (!response.ok) {
        setError(data?.error ?? 'Unable to resume the held cart.');
        return;
      }
      setCart(
        parkedSale.items.map((item) => {
          const option = productMap.get(item.productVariantId ?? item.productId)!;
          return { ...option, qty: item.qty };
        })
      );
      setCustomerName(parkedSale.customerName ?? '');
      setCustomerPhone(parkedSale.customerPhone ?? '');
      setNotes(parkedSale.notes ?? '');
      setDiscountAmount(parkedSale.discountAmount);
      setScanQuery('');
      setScanFeedback(null);
      resetPayments();
      setParkedSales((current) => current.filter((entry) => entry.id !== parkedSale.id));
      setParkedFeedback(`Resumed held cart from ${parkedSale.cashierName}.`);
      focusScanInput();
    } catch {
      setResumeLoadingId(null);
      setError('Unable to resume the held cart.');
    }
  }

  async function cancelParkedSale(parkedSale: ParkedSale) {
    setError('');
    setParkedFeedback('');
    if (!window.confirm('Cancel this held cart? This removes it from the active held cart list.')) return;
    setCancelLoadingId(parkedSale.id);
    try {
      const response = await fetch(`/api/parked-sales/${parkedSale.id}`, { method: 'DELETE' });
      const data = await response.json().catch(() => ({ error: 'Unable to cancel the held cart.' }));
      setCancelLoadingId(null);
      if (!response.ok) {
        setError(data?.error ?? 'Unable to cancel the held cart.');
        return;
      }
      setParkedSales((current) => current.filter((entry) => entry.id !== parkedSale.id));
      setParkedFeedback('Held cart cancelled successfully.');
    } catch {
      setCancelLoadingId(null);
      setError('Unable to cancel the held cart.');
    }
  }

  async function completeSale() {
    setError('');
    setParkedFeedback('');
    if (!cart.length) return setError('Please add at least one item to the cart.');
    if (discount < 0) return setError('Discount amount cannot be negative.');
    if (discount > subtotal + taxAmount) return setError('Discount cannot exceed the sale total.');
    if (paymentError) return setError(paymentError);
    setLoading(true);
    try {
      const response = await fetch('/api/sales', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: customerName || null,
          customerPhone: customerPhone || null,
          discountAmount: discount,
          notes: notes || null,
          payments: payments.map((payment) => ({
            method: payment.method,
            amount: Number(payment.amount),
            referenceNumber: payment.referenceNumber || null
          })),
          items: cart.map((item) => ({ productId: item.productId, variantId: item.variantId, qty: item.qty }))
        })
      });
      const data = await response.json().catch(() => ({ error: 'Failed to create sale.' }));
      setLoading(false);
      if (!response.ok) {
        setError(data.error ?? 'Failed to create sale.');
        return;
      }
      resetCheckoutState();
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
      if (isTypingTarget(event.target)) return;
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
      <Card className="space-y-5 overflow-hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Product browser</div>
            <h2 className="mt-2 text-2xl font-black text-stone-900">Find products</h2>
            <p className="mt-1 text-sm text-stone-500">Search by name, variant, SKU, barcode, or category to build a reliable cart quickly.</p>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:w-auto">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Visible</div><div className="mt-1 text-xl font-black text-stone-950">{filtered.length}</div></div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Cart lines</div><div className="mt-1 text-xl font-black text-stone-950">{cart.length}</div></div>
          </div>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-stone-50/80 p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,320px)_1fr]">
            <form onSubmit={handleScanSubmit} className="flex gap-3">
              <Input ref={scanInputRef} placeholder="Scan barcode or enter SKU" value={scanQuery} onChange={(event) => setScanQuery(event.target.value)} />
              <Button type="submit" variant="secondary" className="shrink-0">Add</Button>
            </form>
            <Input placeholder="Search by product, variant, SKU, barcode..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => setSelectedCategory('')} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${!selectedCategory ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}>All</button>
            {categories.map((category) => (
              <button key={category.id} type="button" onClick={() => setSelectedCategory(category.id)} className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${selectedCategory === category.id ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'}`}>{category.name}</button>
            ))}
          </div>

          {scanFeedback ? <div className={`mt-3 rounded-2xl border px-4 py-3 text-sm ${scanFeedback.tone === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-red-200 bg-red-50 text-red-700'}`}>{scanFeedback.message}</div> : null}
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((product) => (
            <button key={product.id} type="button" onClick={() => { setScanFeedback(null); addToCart(product); }} className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.92))] p-4 text-left shadow-[0_18px_36px_-30px_rgba(28,25,23,0.35)] transition hover:-translate-y-1 hover:border-emerald-300">
              <div className="flex items-start gap-3">
                <div className="h-16 w-16 overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50">
                  {product.imageUrl ? <img src={product.imageUrl} alt={getOptionDisplayName(product)} className="h-full w-full object-cover" /> : null}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold text-stone-900">{product.name}</div>
                  <div className="mt-1 text-sm text-stone-500">{product.variantLabel ?? product.category?.name ?? 'Standard item'}</div>
                  <div className="mt-2 text-xs text-stone-500">SKU: {product.sku ?? 'N/A'} / Barcode: {product.barcode ?? 'N/A'}</div>
                </div>
                <div className={`rounded-full border px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${product.stockQty <= 0 ? 'border-red-200 bg-red-50 text-red-700' : product.stockQty <= 5 ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>{product.stockQty <= 0 ? 'Out' : product.stockQty <= 5 ? 'Low' : 'Ready'}</div>
              </div>
              <div className="mt-4 flex items-end justify-between gap-3">
                <div><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Selling price</div><div className="mt-1 text-2xl font-black text-emerald-700">{money(product.price, currencySymbol)}</div></div>
                <div className="text-right text-xs font-medium text-stone-500">{product.stockQty} in stock</div>
              </div>
            </button>
          ))}
        </div>

        {!filtered.length ? <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">No products matched that search.</div> : null}
      </Card>

      <Card className="space-y-5 xl:sticky xl:top-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Sale desk</div>
            <h2 className="mt-2 text-2xl font-black text-stone-900">Checkout summary</h2>
            <p className="mt-1 text-sm text-stone-500">Cashier: <span className="font-semibold text-stone-700">{cashierName}</span></p>
          </div>
          <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 text-right"><div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">Items</div><div className="text-2xl font-black text-stone-950">{itemCount}</div></div>
        </div>

        <div className="space-y-3">
          {cart.length ? cart.map((item) => (
            <div key={item.id} className="rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(245,245,244,0.9))] p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{item.name}</div>
                  <div className="text-sm text-stone-500">{item.variantLabel ?? 'Base item'}</div>
                  <div className="mt-1 text-xs text-stone-500">{money(item.price, currencySymbol)} each</div>
                </div>
                <div className="flex items-center gap-2">
                  <Button type="button" variant="secondary" className="h-10 w-10 px-0" onClick={() => updateQty(item.id, 'decrease')}>-</Button>
                  <span className="inline-flex h-10 min-w-10 items-center justify-center rounded-2xl bg-white px-3 font-semibold text-stone-900">{item.qty}</span>
                  <Button type="button" variant="secondary" className="h-10 w-10 px-0" onClick={() => updateQty(item.id, 'increase')}>+</Button>
                  <Button type="button" variant="ghost" className="h-10 px-3 text-xs uppercase tracking-[0.14em]" onClick={() => removeFromCart(item.id)}>Remove</Button>
                </div>
              </div>
              <div className="mt-4 flex items-center justify-between rounded-[20px] border border-stone-200/80 bg-white/80 px-3 py-2.5 text-sm"><span className="text-stone-500">Line total</span><span className="font-semibold text-stone-900">{money(Number(item.price) * item.qty, currencySymbol)}</span></div>
            </div>
          )) : <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-6 text-sm text-stone-500">No items in the cart yet.</div>}
        </div>

        <div className="rounded-[26px] border border-stone-200 bg-stone-50/85 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Customer and payment</div>
          <p className="mt-1 text-sm text-stone-500">Capture payment lines quickly and keep totals accurate.</p>
          {!canAcceptCash ? <div className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">Open a register session first to accept cash payments. Non-cash payments can still be processed safely.</div> : null}
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Input placeholder="Customer name" value={customerName} onChange={(event) => setCustomerName(event.target.value)} />
            <Input placeholder="Customer phone" value={customerPhone} onChange={(event) => setCustomerPhone(event.target.value)} />
            <Input type="number" step="0.01" placeholder="Discount amount" value={discountAmount} onChange={(event) => setDiscountAmount(event.target.value)} />
            <Input placeholder="Notes for this sale" value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>

          <div className="mt-4 space-y-3">
            {payments.map((payment) => {
              const exactAmount = getExactAmountForLine(payment.id);
              const quickAmounts = getQuickCashAmounts(exactAmount).filter((amount) => amount !== exactAmount);
              return (
                <div key={payment.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
                  <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,0.8fr)_auto]">
                    <select className="h-11 w-full rounded-2xl border border-stone-200 bg-white px-4 text-sm text-stone-900 outline-none focus:border-emerald-500" value={payment.method} onChange={(event) => updatePaymentLine(payment.id, { method: event.target.value as PaymentMethod })}>
                      {PAYMENT_METHODS.map((method) => <option key={method} value={method} disabled={method === 'Cash' && !canAcceptCash}>{method === 'Cash' && !canAcceptCash ? 'Cash (open register required)' : method}</option>)}
                    </select>
                    <Input type="number" step="0.01" placeholder={payment.method === 'Cash' ? 'Cash received' : 'Amount'} value={payment.amount} onChange={(event) => updatePaymentLine(payment.id, { amount: event.target.value })} />
                    <Button type="button" variant="ghost" onClick={() => removePaymentLine(payment.id)} disabled={payments.length === 1}>Remove</Button>
                  </div>
                  {requiresReferenceNumber(payment.method) ? <div className="mt-3"><Input placeholder={payment.method === 'Card' ? 'Card reference number' : 'E-wallet reference number'} value={payment.referenceNumber} onChange={(event) => updatePaymentLine(payment.id, { referenceNumber: event.target.value })} /></div> : null}
                  {payment.method === 'Cash' ? <div className="mt-3 flex flex-wrap gap-2"><Button type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setPaymentLineAmount(payment.id, exactAmount)}>Exact amount</Button>{quickAmounts.map((amount) => <Button key={`${payment.id}-${amount}`} type="button" variant="secondary" className="h-9 px-3 text-xs" onClick={() => setPaymentLineAmount(payment.id, amount)}>{money(amount, currencySymbol)}</Button>)}</div> : null}
                </div>
              );
            })}
            <Button type="button" variant="secondary" onClick={addPaymentLine}>Add payment line</Button>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Paid total</div><div className="mt-1 text-2xl font-black text-stone-950">{money(paymentSummary.totalPaid, currencySymbol)}</div></div>
            <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Remaining</div><div className={`mt-1 text-2xl font-black ${paymentSummary.remainingAmount > 0 ? 'text-red-700' : 'text-emerald-700'}`}>{money(paymentSummary.remainingAmount, currencySymbol)}</div></div>
            <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Cash received</div><div className="mt-1 text-2xl font-black text-stone-950">{money(paymentSummary.cashReceived, currencySymbol)}</div></div>
            <div className="rounded-[22px] border border-stone-200 bg-white px-4 py-3"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Change due</div><div className={`mt-1 text-2xl font-black ${paymentSummary.changeDue > 0 ? 'text-emerald-700' : 'text-stone-950'}`}>{money(paymentSummary.changeDue, currencySymbol)}</div></div>
          </div>
        </div>

        <div className="rounded-[26px] border border-stone-200 bg-[linear-gradient(180deg,rgba(255,255,255,0.92),rgba(245,245,244,0.96))] p-5 text-sm">
          <div className="flex justify-between"><span>Subtotal</span><span>{money(subtotal, currencySymbol)}</span></div>
          <div className="mt-2 flex justify-between"><span>Tax ({taxRate}%)</span><span>{money(taxAmount, currencySymbol)}</span></div>
          <div className="mt-2 flex justify-between"><span>Discount</span><span>-{money(discount, currencySymbol)}</span></div>
          <div className="mt-2 flex justify-between"><span>Paid</span><span>{money(paymentSummary.totalPaid, currencySymbol)}</span></div>
          <div className="mt-2 flex justify-between"><span>Change</span><span>{money(paymentSummary.changeDue, currencySymbol)}</span></div>
          <div className="mt-3 flex justify-between border-t border-stone-200 pt-3 text-lg font-black text-stone-900"><span>Total</span><span>{money(total, currencySymbol)}</span></div>
          <div className="mt-4 rounded-[22px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">{cart.length ? paymentError || `${itemCount} item(s) across ${cart.length} line(s) are ready for validation and receipt printing.` : 'Add at least one product before finalizing the sale.'}</div>
        </div>

        {parkedFeedback ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{parkedFeedback}</div> : null}
        {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" className="flex-1" disabled={!canCompleteSale} onClick={() => void completeSale()}>{loading ? 'Completing sale...' : 'Complete sale'}</Button>
          <Button type="button" variant="secondary" className="sm:min-w-32" disabled={!cart.length || loading || holding} onClick={() => void holdCart()}>{holding ? 'Holding cart...' : 'Hold cart'}</Button>
          <Button type="button" variant="secondary" className="sm:min-w-32" disabled={!cart.length || loading || holding} onClick={requestClearCart}>Clear</Button>
        </div>

        <div className="rounded-[26px] border border-stone-200 bg-stone-50/85 p-4">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Held carts</div>
              <h3 className="mt-2 text-xl font-black text-stone-900">Suspend and resume checkout</h3>
              <p className="mt-1 text-sm text-stone-500">Held carts keep item snapshots, customer details, and notes for up to 24 hours.</p>
            </div>
            <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3 text-right"><div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Active holds</div><div className="mt-1 text-2xl font-black text-stone-950">{parkedSales.length}</div></div>
          </div>
          <div className="mt-4 space-y-3">
            {parkedSales.length ? parkedSales.map((parkedSale) => (
              <div key={parkedSale.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-amber-700">Held</span>
                      <span className="rounded-full border border-stone-200 bg-stone-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-600">{parkedSale.itemCount} item(s)</span>
                    </div>
                    <div className="mt-3 text-lg font-black text-stone-950">{money(parkedSale.totalAmount, currencySymbol)}</div>
                    <div className="mt-1 text-sm text-stone-500">{parkedSale.cashierName}{parkedSale.customerName ? ` / ${parkedSale.customerName}` : ''}</div>
                    <div className="mt-2 text-xs text-stone-500">Created {dateTime(parkedSale.createdAt)} / Expires {dateTime(parkedSale.expiresAt)}</div>
                    {parkedSale.notes ? <div className="mt-3 rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">{parkedSale.notes}</div> : null}
                  </div>
                  <div className="min-w-[220px] space-y-2">
                    <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-xs text-stone-500">
                      {parkedSale.items.map((item) => `${item.qty}x ${item.productName}${item.variantLabel ? ` (${item.variantLabel})` : ''}`).join(', ')}
                    </div>
                    <div className="flex flex-col gap-2 sm:flex-row lg:flex-col">
                      <Button type="button" disabled={resumeLoadingId === parkedSale.id || cancelLoadingId === parkedSale.id} onClick={() => void resumeParkedSale(parkedSale)}>{resumeLoadingId === parkedSale.id ? 'Resuming...' : 'Resume'}</Button>
                      <Button type="button" variant="danger" disabled={resumeLoadingId === parkedSale.id || cancelLoadingId === parkedSale.id} onClick={() => void cancelParkedSale(parkedSale)}>{cancelLoadingId === parkedSale.id ? 'Cancelling...' : 'Cancel'}</Button>
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="rounded-[24px] border border-dashed border-stone-300 bg-white px-4 py-5 text-sm text-stone-500">No active held carts right now.</div>}
          </div>
        </div>
      </Card>
    </div>
  );
}
