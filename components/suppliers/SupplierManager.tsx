'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money, shortDate } from '@/lib/format';
import { getPayableStatusLabel, payableStatusTone } from '@/lib/purchases';

type SupplierPayment = {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string | null;
  paidAt: string;
  createdAt: string;
  createdByUser: { id: string; name: string | null; email: string };
};

type SupplierInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  totalAmount: string;
  paymentStatus: string;
  notes: string | null;
  purchase: { id: string; purchaseNumber: string; status: string };
  payments?: SupplierPayment[];
  payableEntry?: {
    id: string;
    amountDue: string;
    amountPaid: string;
    balance: string;
    status: string;
    dueDate: string;
    createdAt: string;
    updatedAt: string;
  } | null;
};

export type Supplier = {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  invoices: SupplierInvoice[];
  _count?: { purchases: number; invoices: number };
};

export default function SupplierManager({
  initialSuppliers,
  currencySymbol
}: {
  initialSuppliers: Supplier[];
  currencySymbol: string;
}) {
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

  const supplierCards = useMemo(
    () =>
      suppliers.map((supplier) => {
        const outstanding = supplier.invoices.reduce(
          (sum, invoice) => sum + Number(invoice.payableEntry?.balance ?? 0),
          0
        );
        const overdueCount = supplier.invoices.filter(
          (invoice) => invoice.payableEntry?.status === 'OVERDUE'
        ).length;
        const openInvoiceCount = supplier.invoices.filter(
          (invoice) => invoice.payableEntry && invoice.payableEntry.status !== 'PAID'
        ).length;
        const recentPayments = supplier.invoices
          .flatMap((invoice) =>
            (invoice.payments ?? []).map((payment) => ({
              ...payment,
              invoiceNumber: invoice.invoiceNumber
            }))
          )
          .sort((left, right) => new Date(right.paidAt).getTime() - new Date(left.paidAt).getTime())
          .slice(0, 3);

        return {
          ...supplier,
          outstanding,
          overdueCount,
          openInvoiceCount,
          recentPayments
        };
      }),
    [suppliers]
  );

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

    setSuppliers((current) => [
      {
        ...data.supplier,
        invoices: [],
        _count: { purchases: 0, invoices: 0 }
      },
      ...current
    ]);
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
      current.map((item) =>
        item.id === supplier.id
          ? {
              ...item,
              ...data.supplier,
              invoices: item.invoices,
              _count: item._count
            }
          : item
      )
    );
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
      <Card>
        <h2 id="new-supplier" className="text-xl font-black text-stone-900">Add supplier</h2>
        <form onSubmit={saveSupplier} className="mt-5 grid gap-4">
          <Input placeholder="Supplier name" value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
          <Input placeholder="Contact name" value={form.contactName} onChange={(event) => setForm((current) => ({ ...current, contactName: event.target.value }))} />
          <Input placeholder="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
          <Input placeholder="Phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
          <Input placeholder="Address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          <textarea
            className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            placeholder="Notes"
            value={form.notes}
            onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))}
          />

          {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

          <Button type="submit">Save supplier</Button>
        </form>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Supplier list</h2>
        <div className="mt-4 space-y-4">
          {supplierCards.length ? (
            supplierCards.map((supplier) => (
              <div key={supplier.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <div className="font-semibold text-stone-900">{supplier.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={supplier.isActive ? 'emerald' : 'stone'}>
                        {supplier.isActive ? 'Active' : 'Archived'}
                      </Badge>
                      <Badge tone="blue">{supplier._count?.purchases ?? 0} purchase(s)</Badge>
                      <Badge tone="amber">{supplier._count?.invoices ?? 0} invoice(s)</Badge>
                      {supplier.overdueCount > 0 ? (
                        <Badge tone="red">{supplier.overdueCount} overdue</Badge>
                      ) : null}
                    </div>
                    <div className="mt-2 text-sm text-stone-500">
                      {supplier.contactName || 'No contact'} / {supplier.phone || 'No phone'}
                    </div>
                    <div className="text-xs text-stone-500">{supplier.email || 'No email on file'}</div>
                    {supplier.address ? <div className="mt-1 text-xs text-stone-500">{supplier.address}</div> : null}
                  </div>
                    <div className="text-right">
                      <div className="text-xs text-stone-500">Outstanding payable</div>
                    <div className="text-2xl font-black text-stone-900">{money(supplier.outstanding, currencySymbol)}</div>
                    <div className="text-xs text-stone-500">{supplier.openInvoiceCount} open invoice(s)</div>
                    <div className="mt-3">
                      <Button type="button" variant="secondary" onClick={() => toggleSupplier(supplier)}>
                        {supplier.isActive ? 'Archive' : 'Restore'}
                      </Button>
                    </div>
                  </div>
                </div>

                <div className="mt-4 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-sm font-semibold text-stone-900">Open payables</div>
                    <div className="mt-3 space-y-3">
                      {supplier.invoices.filter((invoice) => invoice.payableEntry && invoice.payableEntry.status !== 'PAID').length ? (
                        supplier.invoices
                          .filter((invoice) => invoice.payableEntry && invoice.payableEntry.status !== 'PAID')
                          .slice(0, 4)
                          .map((invoice) => (
                            <div key={invoice.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                              <div className="flex items-center justify-between gap-3">
                                <div>
                                  <div className="font-semibold text-stone-900">{invoice.invoiceNumber}</div>
                                  <div className="text-xs text-stone-500">
                                    {invoice.purchase.purchaseNumber} / Due {shortDate(invoice.dueDate)}
                                  </div>
                                </div>
                                <Badge tone={payableStatusTone(invoice.payableEntry?.status ?? invoice.paymentStatus)}>
                                  {getPayableStatusLabel(invoice.payableEntry?.status ?? invoice.paymentStatus)}
                                </Badge>
                              </div>
                              <div className="mt-2 text-sm text-stone-600">
                                Balance {money(invoice.payableEntry?.balance ?? '0', currencySymbol)}
                              </div>
                            </div>
                          ))
                      ) : (
                        <div className="text-sm text-stone-500">No outstanding supplier payables right now.</div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="text-sm font-semibold text-stone-900">Recent payments</div>
                    <div className="mt-3 space-y-3">
                      {supplier.recentPayments.length ? (
                        supplier.recentPayments.map((payment) => (
                          <div key={payment.id} className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <div className="font-semibold text-stone-900">
                                  {payment.invoiceNumber} / {money(payment.amount, currencySymbol)}
                                </div>
                                <div className="text-xs text-stone-500">
                                  {payment.method} / {dateTime(payment.paidAt)}
                                </div>
                              </div>
                              <div className="text-xs text-stone-500">
                                {payment.referenceNumber ? `Ref ${payment.referenceNumber}` : 'No reference'}
                              </div>
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-stone-500">No supplier payments recorded yet.</div>
                      )}
                    </div>
                  </div>
                </div>

                {supplier.notes ? (
                  <div className="mt-4 text-sm text-stone-500">Notes: {supplier.notes}</div>
                ) : null}
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
