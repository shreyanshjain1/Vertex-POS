'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

const POS_TYPES = [
  { value: 'RETAIL', label: 'Retail' },
  { value: 'COFFEE', label: 'Coffee' },
  { value: 'FOOD', label: 'Food' },
  { value: 'BUILDING_MATERIALS', label: 'Building Materials' },
  { value: 'SERVICES', label: 'Services' }
] as const;

export default function OnboardPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    shopName: '',
    posType: 'RETAIL',
    phone: '',
    email: '',
    address: '',
    taxId: '',
    currencyCode: 'PHP',
    currencySymbol: '₱',
    taxRate: '12',
    receiptHeader: 'Thank you for shopping with us!',
    receiptFooter: 'Please come again.',
    lowStockThreshold: '5'
  });
  const [categories, setCategories] = useState([{ name: 'Beverages' }, { name: 'Snacks' }]);
  const [suppliers, setSuppliers] = useState([{ name: 'Default Supplier', contactName: '', phone: '' }]);
  const [products, setProducts] = useState([{ name: 'Mineral Water 500ml', categoryName: 'Beverages', sku: 'WATER-500', barcode: '', cost: '10', price: '18', stockQty: '24', reorderPoint: '6' }]);

  function canContinue() {
    if (step === 1) return form.shopName.trim().length >= 2;
    return true;
  }

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (step < 4) {
      if (!canContinue()) return setError('Please complete the required fields.');
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
          <p className="mt-2 text-sm text-stone-500">We will create your shop profile, settings, categories, starter products, and suppliers in one flow.</p>
        </div>
        <div className="mb-6 flex flex-wrap gap-3 text-sm">
          {[1,2,3,4].map((value) => <div key={value} className={`rounded-full px-4 py-2 font-semibold ${step >= value ? 'bg-emerald-600 text-white' : 'bg-white text-stone-500 border border-stone-200'}`}>Step {value}</div>)}
        </div>
        <form onSubmit={onSubmit} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
          {step === 1 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div className="md:col-span-2"><label className="mb-2 block text-sm font-semibold">Shop name</label><Input value={form.shopName} onChange={(e) => setForm((p) => ({ ...p, shopName: e.target.value }))} required /></div>
              <div><label className="mb-2 block text-sm font-semibold">Business type</label><select className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={form.posType} onChange={(e) => setForm((p) => ({ ...p, posType: e.target.value }))}>{POS_TYPES.map((item) => <option key={item.value} value={item.value}>{item.label}</option>)}</select></div>
              <div><label className="mb-2 block text-sm font-semibold">Phone</label><Input value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} /></div>
              <div><label className="mb-2 block text-sm font-semibold">Email</label><Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
              <div><label className="mb-2 block text-sm font-semibold">Tax ID / Permit</label><Input value={form.taxId} onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))} /></div>
              <div className="md:col-span-2"><label className="mb-2 block text-sm font-semibold">Address</label><Input value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /></div>
            </div>
          ) : null}

          {step === 2 ? (
            <div className="grid gap-4 md:grid-cols-2">
              <div><label className="mb-2 block text-sm font-semibold">Currency code</label><Input value={form.currencyCode} onChange={(e) => setForm((p) => ({ ...p, currencyCode: e.target.value.toUpperCase() }))} /></div>
              <div><label className="mb-2 block text-sm font-semibold">Currency symbol</label><Input value={form.currencySymbol} onChange={(e) => setForm((p) => ({ ...p, currencySymbol: e.target.value }))} /></div>
              <div><label className="mb-2 block text-sm font-semibold">Tax rate (%)</label><Input type="number" step="0.01" value={form.taxRate} onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value }))} /></div>
              <div><label className="mb-2 block text-sm font-semibold">Low stock threshold</label><Input type="number" value={form.lowStockThreshold} onChange={(e) => setForm((p) => ({ ...p, lowStockThreshold: e.target.value }))} /></div>
              <div className="md:col-span-2"><label className="mb-2 block text-sm font-semibold">Receipt header</label><Input value={form.receiptHeader} onChange={(e) => setForm((p) => ({ ...p, receiptHeader: e.target.value }))} /></div>
              <div className="md:col-span-2"><label className="mb-2 block text-sm font-semibold">Receipt footer</label><Input value={form.receiptFooter} onChange={(e) => setForm((p) => ({ ...p, receiptFooter: e.target.value }))} /></div>
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-6">
              <div>
                <div className="mb-3 text-lg font-black text-stone-900">Starter categories</div>
                <div className="space-y-3">{categories.map((item, index) => <div key={index} className="flex gap-3"><Input value={item.name} onChange={(e) => setCategories((prev) => prev.map((entry, i) => i === index ? { ...entry, name: e.target.value } : entry))} /><Button type="button" variant="secondary" onClick={() => setCategories((prev) => prev.filter((_, i) => i !== index))}>Remove</Button></div>)}</div>
                <Button type="button" variant="secondary" className="mt-3" onClick={() => setCategories((prev) => [...prev, { name: '' }])}>Add category</Button>
              </div>
              <div>
                <div className="mb-3 text-lg font-black text-stone-900">Starter suppliers</div>
                <div className="space-y-3">{suppliers.map((item, index) => <div key={index} className="grid gap-3 md:grid-cols-3"><Input placeholder="Supplier name" value={item.name} onChange={(e) => setSuppliers((prev) => prev.map((entry, i) => i === index ? { ...entry, name: e.target.value } : entry))} /><Input placeholder="Contact name" value={item.contactName} onChange={(e) => setSuppliers((prev) => prev.map((entry, i) => i === index ? { ...entry, contactName: e.target.value } : entry))} /><div className="flex gap-3"><Input placeholder="Phone" value={item.phone} onChange={(e) => setSuppliers((prev) => prev.map((entry, i) => i === index ? { ...entry, phone: e.target.value } : entry))} /><Button type="button" variant="secondary" onClick={() => setSuppliers((prev) => prev.filter((_, i) => i !== index))}>Remove</Button></div></div>)}</div>
                <Button type="button" variant="secondary" className="mt-3" onClick={() => setSuppliers((prev) => [...prev, { name: '', contactName: '', phone: '' }])}>Add supplier</Button>
              </div>
            </div>
          ) : null}

          {step === 4 ? (
            <div>
              <div className="mb-3 text-lg font-black text-stone-900">Starter products</div>
              <div className="space-y-3">{products.map((item, index) => <div key={index} className="grid gap-3 md:grid-cols-4"><Input placeholder="Name" value={item.name} onChange={(e) => setProducts((prev) => prev.map((entry, i) => i === index ? { ...entry, name: e.target.value } : entry))} /><Input placeholder="Category name" value={item.categoryName} onChange={(e) => setProducts((prev) => prev.map((entry, i) => i === index ? { ...entry, categoryName: e.target.value } : entry))} /><Input placeholder="SKU" value={item.sku} onChange={(e) => setProducts((prev) => prev.map((entry, i) => i === index ? { ...entry, sku: e.target.value } : entry))} /><Input placeholder="Barcode" value={item.barcode} onChange={(e) => setProducts((prev) => prev.map((entry, i) => i === index ? { ...entry, barcode: e.target.value } : entry))} /><Input type="number" step="0.01" placeholder="Cost" value={item.cost} onChange={(e) => setProducts((prev) => prev.map((entry, i) => i === index ? { ...entry, cost: e.target.value } : entry))} /><Input type="number" step="0.01" placeholder="Price" value={item.price} onChange={(e) => setProducts((prev) => prev.map((entry, i) => i === index ? { ...entry, price: e.target.value } : entry))} /><Input type="number" placeholder="Opening stock" value={item.stockQty} onChange={(e) => setProducts((prev) => prev.map((entry, i) => i === index ? { ...entry, stockQty: e.target.value } : entry))} /><div className="flex gap-3"><Input type="number" placeholder="Reorder level" value={item.reorderPoint} onChange={(e) => setProducts((prev) => prev.map((entry, i) => i === index ? { ...entry, reorderPoint: e.target.value } : entry))} /><Button type="button" variant="secondary" onClick={() => setProducts((prev) => prev.filter((_, i) => i !== index))}>Remove</Button></div></div>)}</div>
              <Button type="button" variant="secondary" className="mt-3" onClick={() => setProducts((prev) => [...prev, { name: '', categoryName: '', sku: '', barcode: '', cost: '0', price: '0', stockQty: '0', reorderPoint: '5' }])}>Add product</Button>
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
