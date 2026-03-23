'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

type Props = {
  initialValues: {
    shopName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxId: string | null;
    currencyCode: string;
    currencySymbol: string;
    taxRate: string;
    receiptHeader: string | null;
    receiptFooter: string | null;
    lowStockEnabled: boolean;
    lowStockThreshold: number;
    salePrefix: string;
    receiptPrefix: string;
    purchasePrefix: string;
  };
};

export default function SettingsForm({ initialValues }: Props) {
  const [form, setForm] = useState({ ...initialValues, taxRate: String(initialValues.taxRate) });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    const response = await fetch('/api/settings', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...form, taxRate: Number(form.taxRate), lowStockThreshold: Number(form.lowStockThreshold) }) });
    const data = await response.json().catch(() => ({ error: 'Unable to save settings.' }));
    if (!response.ok) return setError(data.error ?? 'Unable to save settings.');
    setMessage('Settings saved successfully.');
  }

  return (
    <Card>
      <h2 className="text-xl font-black text-stone-900">Shop settings</h2>
      <form onSubmit={onSubmit} className="mt-5 grid gap-4 md:grid-cols-2">
        <Input placeholder="Shop name" value={form.shopName} onChange={(e) => setForm((p) => ({ ...p, shopName: e.target.value }))} />
        <Input placeholder="Phone" value={form.phone ?? ''} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
        <Input placeholder="Email" value={form.email ?? ''} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        <Input placeholder="Tax ID" value={form.taxId ?? ''} onChange={(e) => setForm((p) => ({ ...p, taxId: e.target.value }))} />
        <div className="md:col-span-2"><Input placeholder="Address" value={form.address ?? ''} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} /></div>
        <Input placeholder="Currency code" value={form.currencyCode} onChange={(e) => setForm((p) => ({ ...p, currencyCode: e.target.value.toUpperCase() }))} />
        <Input placeholder="Currency symbol" value={form.currencySymbol} onChange={(e) => setForm((p) => ({ ...p, currencySymbol: e.target.value }))} />
        <Input type="number" step="0.01" placeholder="Tax rate" value={form.taxRate} onChange={(e) => setForm((p) => ({ ...p, taxRate: e.target.value }))} />
        <Input type="number" placeholder="Low stock threshold" value={String(form.lowStockThreshold)} onChange={(e) => setForm((p) => ({ ...p, lowStockThreshold: Number(e.target.value) }))} />
        <Input placeholder="Sale prefix" value={form.salePrefix} onChange={(e) => setForm((p) => ({ ...p, salePrefix: e.target.value }))} />
        <Input placeholder="Receipt prefix" value={form.receiptPrefix} onChange={(e) => setForm((p) => ({ ...p, receiptPrefix: e.target.value }))} />
        <Input placeholder="Purchase prefix" value={form.purchasePrefix} onChange={(e) => setForm((p) => ({ ...p, purchasePrefix: e.target.value }))} />
        <div className="md:col-span-2"><Input placeholder="Receipt header" value={form.receiptHeader ?? ''} onChange={(e) => setForm((p) => ({ ...p, receiptHeader: e.target.value }))} /></div>
        <div className="md:col-span-2"><Input placeholder="Receipt footer" value={form.receiptFooter ?? ''} onChange={(e) => setForm((p) => ({ ...p, receiptFooter: e.target.value }))} /></div>
        <label className="flex items-center gap-2 text-sm font-medium text-stone-700 md:col-span-2"><input type="checkbox" checked={form.lowStockEnabled} onChange={(e) => setForm((p) => ({ ...p, lowStockEnabled: e.target.checked }))} /> Enable low-stock alerts</label>
        {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 md:col-span-2">{message}</div> : null}
        {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 md:col-span-2">{error}</div> : null}
        <div className="md:col-span-2"><Button type="submit">Save settings</Button></div>
      </form>
    </Card>
  );
}
