'use client';

import { useState } from 'react';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  _count?: { purchases: number };
};

export default function SupplierManager({ initialSuppliers }: { initialSuppliers: Supplier[] }) {
  const [suppliers, setSuppliers] = useState(initialSuppliers);
  const [form, setForm] = useState({ name: '', contactName: '', email: '', phone: '', address: '', notes: '' });
  const [error, setError] = useState('');

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    const response = await fetch('/api/suppliers', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    const data = await response.json().catch(() => ({ error: 'Failed to save supplier.' }));
    if (!response.ok) return setError(data.error ?? 'Failed to save supplier.');
    setSuppliers((prev) => [data.supplier, ...prev]);
    setForm({ name: '', contactName: '', email: '', phone: '', address: '', notes: '' });
  }

  async function toggleSupplier(supplier: Supplier) {
    const response = await fetch(`/api/suppliers/${supplier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !supplier.isActive })
    });
    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.supplier) return;
    setSuppliers((prev) => prev.map((item) => (item.id === supplier.id ? data.supplier : item)));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <h2 className="text-xl font-black text-stone-900">Add supplier</h2>
        <form onSubmit={saveSupplier} className="mt-5 grid gap-4">
          <Input placeholder="Supplier name" value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required />
          <Input placeholder="Contact name" value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
          <Input placeholder="Email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
          <Input placeholder="Phone" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
          <Input placeholder="Address" value={form.address} onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
          <Input placeholder="Notes" value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          <Button type="submit">Save supplier</Button>
        </form>
      </Card>
      <Card>
        <h2 className="text-xl font-black text-stone-900">Supplier list</h2>
        <div className="mt-4 space-y-3">
          {suppliers.length ? (
            suppliers.map((supplier) => (
              <div key={supplier.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-stone-900">{supplier.name}</div>
                    <div className="text-sm text-stone-500">{supplier.contactName || 'No contact'} • {supplier.phone || 'No phone'}</div>
                    <div className="text-xs text-stone-500">{supplier.email || 'No email'} • {supplier._count?.purchases ?? 0} purchase(s)</div>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => toggleSupplier(supplier)}>
                    {supplier.isActive ? 'Archive' : 'Activate'}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">No suppliers yet.</div>
          )}
        </div>
      </Card>
    </div>
  );
}
