'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

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
  const [form, setForm] = useState({
    name: '',
    contactName: '',
    email: '',
    phone: '',
    address: '',
    notes: ''
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function saveSupplier(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');

    const response = await fetch('/api/suppliers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await response.json().catch(() => ({ error: 'Failed to save supplier.' }));
    if (!response.ok) {
      setError(data.error ?? 'Failed to save supplier.');
      return;
    }

    setSuppliers((current) => [data.supplier, ...current]);
    setForm({ name: '', contactName: '', email: '', phone: '', address: '', notes: '' });
    setSuccess('Supplier created successfully.');
  }

  async function toggleSupplier(supplier: Supplier) {
    const confirmed = window.confirm(`${supplier.isActive ? 'Archive' : 'Restore'} ${supplier.name}?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/suppliers/${supplier.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !supplier.isActive })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.supplier) {
      setError(data?.error ?? 'Unable to update supplier.');
      return;
    }

    setSuppliers((current) =>
      current.map((item) => (item.id === supplier.id ? data.supplier : item))
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <h2 id="new-supplier" className="text-xl font-black text-stone-900">Add supplier</h2>
        <form onSubmit={saveSupplier} className="mt-5 grid gap-4">
          <Input placeholder="Supplier name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          <Input placeholder="Contact name" value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
          <Input placeholder="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          <Input placeholder="Phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          <Input placeholder="Address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          <Input placeholder="Notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

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
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={supplier.isActive ? 'emerald' : 'stone'}>
                        {supplier.isActive ? 'Active' : 'Archived'}
                      </Badge>
                      <Badge tone="blue">{supplier._count?.purchases ?? 0} purchase(s)</Badge>
                    </div>
                    <div className="mt-2 text-sm text-stone-500">
                      {supplier.contactName || 'No contact'} | {supplier.phone || 'No phone'}
                    </div>
                    <div className="text-xs text-stone-500">{supplier.email || 'No email on file'}</div>
                  </div>
                  <Button type="button" variant="secondary" onClick={() => toggleSupplier(supplier)}>
                    {supplier.isActive ? 'Archive' : 'Restore'}
                  </Button>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
              No suppliers yet. Add one to start recording purchases against a real vendor.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
