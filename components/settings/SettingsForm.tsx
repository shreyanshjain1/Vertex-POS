'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

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

function Section({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="space-y-4 rounded-2xl border border-stone-200 p-5">
      <div>
        <h3 className="text-lg font-black text-stone-900">{title}</h3>
        <p className="mt-1 text-sm text-stone-500">{description}</p>
      </div>
      {children}
    </div>
  );
}

export default function SettingsForm({ initialValues }: Props) {
  const [form, setForm] = useState({ ...initialValues, taxRate: String(initialValues.taxRate) });
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage('');
    setError('');
    setLoading(true);

    const response = await fetch('/api/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        taxRate: Number(form.taxRate),
        lowStockThreshold: Number(form.lowStockThreshold)
      })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to save settings.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Unable to save settings.');
      return;
    }

    setMessage('Settings saved successfully.');
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <Card>
        <h2 className="text-xl font-black text-stone-900">Shop settings</h2>
        <p className="mt-2 text-sm text-stone-500">
          Configure how the business appears on receipts, how taxes are applied, and when low-stock alerts should fire.
        </p>
      </Card>

      <Section title="Business details" description="This information is used across receipts, reports, and the workspace header.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Shop name" value={form.shopName} onChange={(event) => setForm((current) => ({ ...current, shopName: event.target.value }))} />
          <Input placeholder="Phone" value={form.phone ?? ''} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          <Input placeholder="Email" value={form.email ?? ''} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          <Input placeholder="Tax ID" value={form.taxId ?? ''} onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))} />
          <div className="md:col-span-2">
            <Input placeholder="Address" value={form.address ?? ''} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </div>
        </div>
      </Section>

      <Section title="Tax and currency" description="Use realistic defaults so cashiers see accurate totals and receipts stay consistent.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input placeholder="Currency code" value={form.currencyCode} onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))} />
          <Input placeholder="Currency symbol" value={form.currencySymbol} onChange={(event) => setForm((current) => ({ ...current, currencySymbol: event.target.value }))} />
          <Input type="number" step="0.01" placeholder="Tax rate" value={form.taxRate} onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))} />
          <Input type="number" placeholder="Low stock threshold" value={String(form.lowStockThreshold)} onChange={(event) => setForm((current) => ({ ...current, lowStockThreshold: Number(event.target.value) }))} />
        </div>

        <label className="flex items-center gap-2 text-sm font-medium text-stone-700">
          <input type="checkbox" checked={form.lowStockEnabled} onChange={(event) => setForm((current) => ({ ...current, lowStockEnabled: event.target.checked }))} />
          Enable low-stock alerts
        </label>
      </Section>

      <Section title="Receipt content" description="Short, readable content prints best on thermal paper.">
        <div className="grid gap-4">
          <Input placeholder="Receipt header" value={form.receiptHeader ?? ''} onChange={(event) => setForm((current) => ({ ...current, receiptHeader: event.target.value }))} />
          <Input placeholder="Receipt footer" value={form.receiptFooter ?? ''} onChange={(event) => setForm((current) => ({ ...current, receiptFooter: event.target.value }))} />
        </div>
      </Section>

      <Section title="Numbering prefixes" description="These prefixes are used when generating sale, receipt, and purchase document numbers.">
        <div className="grid gap-4 md:grid-cols-3">
          <Input placeholder="Sale prefix" value={form.salePrefix} onChange={(event) => setForm((current) => ({ ...current, salePrefix: event.target.value.toUpperCase() }))} />
          <Input placeholder="Receipt prefix" value={form.receiptPrefix} onChange={(event) => setForm((current) => ({ ...current, receiptPrefix: event.target.value.toUpperCase() }))} />
          <Input placeholder="Purchase prefix" value={form.purchasePrefix} onChange={(event) => setForm((current) => ({ ...current, purchasePrefix: event.target.value.toUpperCase() }))} />
        </div>
      </Section>

      {message ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div> : null}
      {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

      <div>
        <Button type="submit" disabled={loading}>
          {loading ? 'Saving settings...' : 'Save settings'}
        </Button>
      </div>
    </form>
  );
}
