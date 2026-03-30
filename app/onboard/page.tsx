'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { SHOP_TYPE_OPTIONS, getShopTypeDefaults, type SupportedShopType } from '@/lib/shop-config';

function createCategoryRows(shopType: SupportedShopType) {
  return getShopTypeDefaults(shopType).starterCategories.map((name) => ({ name }));
}

function createSupplierRows(shopType: SupportedShopType) {
  return getShopTypeDefaults(shopType).starterSuppliers.map((supplier) => ({ ...supplier }));
}

function createProductRows(shopType: SupportedShopType) {
  return getShopTypeDefaults(shopType).starterProducts.map((product) => ({
    ...product,
    cost: String(product.cost),
    price: String(product.price),
    stockQty: String(product.stockQty),
    reorderPoint: String(product.reorderPoint)
  }));
}

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    shopName: '',
    posType: 'GENERAL_RETAIL' as SupportedShopType,
    phone: '',
    email: '',
    address: '',
    taxId: '',
    currencyCode: 'PHP',
    currencySymbol: '₱',
    taxRate: '12',
    receiptHeader: 'Thank you for shopping with us!',
    receiptFooter: 'Please come again.',
    lowStockThreshold: String(getShopTypeDefaults('GENERAL_RETAIL').lowStockThreshold)
  });
  const [categories, setCategories] = useState(() => createCategoryRows('GENERAL_RETAIL'));
  const [suppliers, setSuppliers] = useState(() => createSupplierRows('GENERAL_RETAIL'));
  const [products, setProducts] = useState(() => createProductRows('GENERAL_RETAIL'));

  const selectedShopType = useMemo(() => getShopTypeDefaults(form.posType), [form.posType]);

  function applyShopType(shopType: SupportedShopType) {
    const defaults = getShopTypeDefaults(shopType);
    setForm((current) => ({
      ...current,
      posType: shopType,
      lowStockThreshold: String(defaults.lowStockThreshold)
    }));
    setCategories(createCategoryRows(shopType));
    setSuppliers(createSupplierRows(shopType));
    setProducts(createProductRows(shopType));
  }

  function canContinue() {
    if (step === 1) {
      return form.shopName.trim().length >= 2;
    }

    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (step < 4) {
      if (!canContinue()) {
        setError('Please complete the required fields.');
        return;
      }

      setStep((value) => value + 1);
      return;
    }

    setLoading(true);
    const response = await fetch('/api/onboard', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        taxRate: Number(form.taxRate),
        lowStockThreshold: Number(form.lowStockThreshold),
        categories: categories.filter((item) => item.name.trim()),
        suppliers: suppliers.filter((item) => item.name.trim()),
        products: products.filter((item) => item.name.trim()).map((item) => ({
          ...item,
          cost: Number(item.cost),
          price: Number(item.price),
          stockQty: Number(item.stockQty),
          reorderPoint: Number(item.reorderPoint)
        }))
      })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to complete onboarding.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Unable to complete onboarding.');
      return;
    }

    router.push('/dashboard');
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-stone-50 py-10">
      <div className="mx-auto max-w-6xl px-6">
        <div className="mb-8">
          <div className="text-sm font-semibold uppercase tracking-[0.18em] text-emerald-600">Onboarding wizard</div>
          <h1 className="mt-2 text-4xl font-black text-stone-900">Set up your shop to start selling.</h1>
          <p className="mt-2 text-sm text-stone-500">We will create your shop profile, defaults, categories, starter products, suppliers, and inventory settings in one guided flow.</p>
        </div>

        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          {[1, 2, 3, 4].map((value) => (
            <div
              key={value}
              className={`rounded-full px-4 py-2 font-semibold ${
                step >= value ? 'bg-emerald-600 text-white' : 'border border-stone-200 bg-white text-stone-500'
              }`}
            >
              Step {value}
            </div>
          ))}
        </div>

        <form onSubmit={onSubmit} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          {step === 1 ? (
            <div className="space-y-6">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">Shop name</label>
                  <Input value={form.shopName} onChange={(event) => setForm((current) => ({ ...current, shopName: event.target.value }))} required />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">Phone</label>
                  <Input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">Email</label>
                  <Input type="email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                </div>
                <div>
                  <label className="mb-2 block text-sm font-semibold">Tax ID / Permit</label>
                  <Input value={form.taxId} onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))} />
                </div>
                <div className="md:col-span-2">
                  <label className="mb-2 block text-sm font-semibold">Address</label>
                  <Input value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
                </div>
              </div>

              <div>
                <div className="mb-3 text-sm font-semibold text-stone-900">Shop type</div>
                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {SHOP_TYPE_OPTIONS.map((option) => (
                    <button
                      key={option.value}
                      type="button"
                      onClick={() => applyShopType(option.value)}
                      className={`rounded-[24px] border p-4 text-left transition ${
                        form.posType === option.value
                          ? 'border-emerald-300 bg-emerald-50'
                          : 'border-stone-200 bg-white hover:border-stone-300 hover:bg-stone-50'
                      }`}
                    >
                      <div className="text-base font-black text-stone-950">{option.label}</div>
                      <div className="mt-2 text-sm leading-6 text-stone-500">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Inventory defaults</div>
                  <div className="mt-3 space-y-2 text-sm text-stone-600">
                    <div>Batch tracking: <span className="font-semibold text-stone-900">{selectedShopType.batchTrackingEnabled ? 'Enabled' : 'Optional'}</span></div>
                    <div>Expiry tracking: <span className="font-semibold text-stone-900">{selectedShopType.expiryTrackingEnabled ? 'Enabled' : 'Optional'}</span></div>
                    <div>FEFO display: <span className="font-semibold text-stone-900">{selectedShopType.fefoEnabled ? 'Emphasized' : 'Available'}</span></div>
                    <div>Expiry alerts: <span className="font-semibold text-stone-900">{selectedShopType.expiryAlertDays} day(s)</span></div>
                  </div>
                </div>
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Starter guidance</div>
                  <div className="mt-3 space-y-2 text-sm text-stone-600">
                    {selectedShopType.hints.map((hint) => (
                      <div key={hint}>{hint}</div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold">Currency code</label>
                <Input value={form.currencyCode} onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">Currency symbol</label>
                <Input value={form.currencySymbol} onChange={(event) => setForm((current) => ({ ...current, currencySymbol: event.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">Tax rate (%)</label>
                <Input type="number" step="0.01" value={form.taxRate} onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))} />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold">Low stock threshold</label>
                <Input type="number" value={form.lowStockThreshold} onChange={(event) => setForm((current) => ({ ...current, lowStockThreshold: event.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold">Receipt header</label>
                <Input value={form.receiptHeader} onChange={(event) => setForm((current) => ({ ...current, receiptHeader: event.target.value }))} />
              </div>
              <div className="md:col-span-2">
                <label className="mb-2 block text-sm font-semibold">Receipt footer</label>
                <Input value={form.receiptFooter} onChange={(event) => setForm((current) => ({ ...current, receiptFooter: event.target.value }))} />
              </div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <div className="mb-3 text-lg font-black text-stone-900">Starter categories</div>
                <div className="space-y-3">
                  {categories.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="flex gap-3">
                      <Input value={item.name} onChange={(event) => setCategories((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} />
                      <Button type="button" variant="secondary" onClick={() => setCategories((current) => current.filter((_, entryIndex) => entryIndex !== index))}>Remove</Button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="secondary" className="mt-3" onClick={() => setCategories((current) => [...current, { name: '' }])}>Add category</Button>
              </div>

              <div>
                <div className="mb-3 text-lg font-black text-stone-900">Starter suppliers</div>
                <div className="space-y-3">
                  {suppliers.map((item, index) => (
                    <div key={`${item.name}-${index}`} className="grid gap-3 md:grid-cols-3">
                      <Input placeholder="Supplier name" value={item.name} onChange={(event) => setSuppliers((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} />
                      <Input placeholder="Contact name" value={item.contactName} onChange={(event) => setSuppliers((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, contactName: event.target.value } : entry))} />
                      <div className="flex gap-3">
                        <Input placeholder="Phone" value={item.phone} onChange={(event) => setSuppliers((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, phone: event.target.value } : entry))} />
                        <Button type="button" variant="secondary" onClick={() => setSuppliers((current) => current.filter((_, entryIndex) => entryIndex !== index))}>Remove</Button>
                      </div>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="secondary" className="mt-3" onClick={() => setSuppliers((current) => [...current, { name: '', contactName: '', phone: '' }])}>Add supplier</Button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <div className="mb-3 text-lg font-black text-stone-900">Starter products</div>
              <div className="mb-4 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                Shop type defaults: batch tracking <span className="font-semibold text-stone-900">{selectedShopType.batchTrackingEnabled ? 'enabled' : 'optional'}</span>, expiry tracking <span className="font-semibold text-stone-900">{selectedShopType.expiryTrackingEnabled ? 'enabled' : 'optional'}</span>.
              </div>
              <div className="space-y-3">
                {products.map((item, index) => (
                  <div key={`${item.name}-${index}`} className="rounded-[24px] border border-stone-200 bg-stone-50/70 p-4">
                    <div className="grid gap-3 md:grid-cols-4">
                      <Input placeholder="Name" value={item.name} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, name: event.target.value } : entry))} />
                      <Input placeholder="Category name" value={item.categoryName} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, categoryName: event.target.value } : entry))} />
                      <Input placeholder="SKU" value={item.sku} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, sku: event.target.value } : entry))} />
                      <Input placeholder="Barcode" value={item.barcode} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, barcode: event.target.value } : entry))} />
                      <Input type="number" step="0.01" placeholder="Cost" value={item.cost} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, cost: event.target.value } : entry))} />
                      <Input type="number" step="0.01" placeholder="Price" value={item.price} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, price: event.target.value } : entry))} />
                      <Input type="number" placeholder="Opening stock" value={item.stockQty} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, stockQty: event.target.value } : entry))} />
                      <div className="flex gap-3">
                        <Input type="number" placeholder="Reorder level" value={item.reorderPoint} onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, reorderPoint: event.target.value } : entry))} />
                        <Button type="button" variant="secondary" onClick={() => setProducts((current) => current.filter((_, entryIndex) => entryIndex !== index))}>Remove</Button>
                      </div>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-6 text-sm text-stone-600">
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.trackBatches}
                          onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, trackBatches: event.target.checked, trackExpiry: event.target.checked ? entry.trackExpiry : false } : entry))}
                        />
                        Track batches
                      </label>
                      <label className="inline-flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={item.trackExpiry}
                          onChange={(event) => setProducts((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, trackExpiry: event.target.checked, trackBatches: event.target.checked ? true : entry.trackBatches } : entry))}
                        />
                        Track expiry
                      </label>
                    </div>
                  </div>
                ))}
              </div>
              <Button
                type="button"
                variant="secondary"
                className="mt-3"
                onClick={() =>
                  setProducts((current) => [
                    ...current,
                    {
                      name: '',
                      categoryName: '',
                      sku: '',
                      barcode: '',
                      cost: '0',
                      price: '0',
                      stockQty: '0',
                      reorderPoint: String(selectedShopType.lowStockThreshold),
                      trackBatches: selectedShopType.batchTrackingEnabled,
                      trackExpiry: selectedShopType.expiryTrackingEnabled
                    }
                  ])
                }
              >
                Add product
              </Button>
            </div>
          ) : null}

          {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <div className="mt-6 flex flex-wrap justify-between gap-3">
            <Button type="button" variant="secondary" onClick={() => setStep((value) => Math.max(1, value - 1))} disabled={step === 1}>Back</Button>
            <Button type="submit" disabled={loading}>{loading ? 'Finishing setup...' : step === 4 ? 'Finish setup' : 'Continue'}</Button>
          </div>
        </form>
      </div>
    </main>
  );
}
