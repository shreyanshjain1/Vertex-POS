'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money, shortDate } from '@/lib/format';
import {
  bucketReceivableAmount,
  calculateCustomerLoyaltyBalance,
  createAgingBucketTotals,
  customerCreditStatusTone,
  customerTypeTone,
  getCustomerCreditStatusLabel,
  getCustomerDisplayName,
  getCustomerLoyaltyTypeLabel,
  getCustomerTypeLabel,
  normalizeCustomerCreditStatus
} from '@/lib/customers';

type CustomerSale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  isCreditSale: boolean;
  totalAmount: string;
  createdAt: string;
};

type LoyaltyEntry = {
  id: string;
  type: string;
  points: number;
  balanceAfter: number;
  note: string | null;
  createdAt: string;
};

type ReceivablePayment = {
  id: string;
  amount: string;
  method: string;
  referenceNumber: string | null;
  paidAt: string;
  createdAt: string;
  createdByUser: {
    id: string;
    name: string | null;
    email: string;
  };
};

type CreditLedger = {
  id: string;
  dueDate: string;
  originalAmount: string;
  balance: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  sale?: {
    id: string;
    saleNumber: string;
    receiptNumber: string;
    totalAmount: string;
    createdAt: string;
  } | null;
  payments: ReceivablePayment[];
};

export type CustomerRecord = {
  id: string;
  type: string;
  firstName: string | null;
  lastName: string | null;
  businessName: string | null;
  contactPerson: string | null;
  taxId: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  notes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  sales: CustomerSale[];
  loyaltyLedger: LoyaltyEntry[];
  creditLedgers: CreditLedger[];
};

type CustomerForm = {
  type: 'INDIVIDUAL' | 'BUSINESS';
  firstName: string;
  lastName: string;
  businessName: string;
  contactPerson: string;
  taxId: string;
  phone: string;
  email: string;
  address: string;
  notes: string;
  isActive: boolean;
};

type PaymentDraft = {
  customerCreditLedgerId: string;
  amount: string;
  method: 'Cash' | 'Card' | 'E-Wallet' | 'Bank Transfer';
  referenceNumber: string;
  paidAt: string;
};

function blankForm(): CustomerForm {
  return {
    type: 'INDIVIDUAL',
    firstName: '',
    lastName: '',
    businessName: '',
    contactPerson: '',
    taxId: '',
    phone: '',
    email: '',
    address: '',
    notes: '',
    isActive: true
  };
}

function formFromCustomer(customer: CustomerRecord): CustomerForm {
  return {
    type: customer.type === 'BUSINESS' ? 'BUSINESS' : 'INDIVIDUAL',
    firstName: customer.firstName ?? '',
    lastName: customer.lastName ?? '',
    businessName: customer.businessName ?? '',
    contactPerson: customer.contactPerson ?? '',
    taxId: customer.taxId ?? '',
    phone: customer.phone ?? '',
    email: customer.email ?? '',
    address: customer.address ?? '',
    notes: customer.notes ?? '',
    isActive: customer.isActive
  };
}

function paymentDraftFromCustomer(customer?: CustomerRecord | null): PaymentDraft {
  const ledger = customer?.creditLedgers.find((entry) => Number(entry.balance) > 0);
  return {
    customerCreditLedgerId: ledger?.id ?? '',
    amount: ledger?.balance ?? '0',
    method: 'Cash',
    referenceNumber: '',
    paidAt: new Date().toISOString().slice(0, 10)
  };
}

function payloadFromForm(form: CustomerForm) {
  return {
    type: form.type,
    firstName: form.firstName || null,
    lastName: form.lastName || null,
    businessName: form.businessName || null,
    contactPerson: form.contactPerson || null,
    taxId: form.taxId || null,
    phone: form.phone || null,
    email: form.email || null,
    address: form.address || null,
    notes: form.notes || null,
    isActive: form.isActive
  };
}

function getCustomerStats(customer: CustomerRecord) {
  return {
    purchaseCount: customer.sales.length,
    lastPurchaseAt: customer.sales[0]?.createdAt ?? null,
    totalSpend: customer.sales.reduce((sum, sale) => sum + Number(sale.totalAmount), 0),
    loyaltyBalance:
      customer.loyaltyLedger[0]?.balanceAfter ?? calculateCustomerLoyaltyBalance(customer.loyaltyLedger),
    receivableBalance: customer.creditLedgers.reduce((sum, ledger) => sum + Number(ledger.balance), 0)
  };
}

export default function CustomerDirectoryManager({
  customers,
  currencySymbol
}: {
  customers: CustomerRecord[];
  currencySymbol: string;
}) {
  const [records, setRecords] = useState(customers);
  const [selectedId, setSelectedId] = useState<string | null>(customers[0]?.id ?? null);
  const [form, setForm] = useState<CustomerForm>(customers[0] ? formFromCustomer(customers[0]) : blankForm());
  const [paymentDraft, setPaymentDraft] = useState<PaymentDraft>(paymentDraftFromCustomer(customers[0] ?? null));
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [saving, setSaving] = useState(false);
  const [postingPayment, setPostingPayment] = useState(false);

  const selectedCustomer = useMemo(
    () => records.find((customer) => customer.id === selectedId) ?? null,
    [records, selectedId]
  );

  const filteredCustomers = useMemo(() => {
    const term = query.trim().toLowerCase();
    return records.filter((customer) => {
      if (!term) {
        return true;
      }

      return [
        getCustomerDisplayName(customer),
        customer.phone ?? '',
        customer.email ?? '',
        customer.businessName ?? '',
        customer.contactPerson ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(term);
    });
  }, [query, records]);

  const topCustomers = useMemo(
    () =>
      [...records]
        .map((customer) => ({ customer, stats: getCustomerStats(customer) }))
        .sort((left, right) => right.stats.totalSpend - left.stats.totalSpend)
        .slice(0, 5),
    [records]
  );

  const agingSummary = useMemo(() => {
    const totals = createAgingBucketTotals();
    records.forEach((customer) => {
      customer.creditLedgers.forEach((ledger) => {
        const status = normalizeCustomerCreditStatus(ledger.status, ledger.dueDate, Number(ledger.balance));
        if (status !== 'VOIDED') {
          bucketReceivableAmount(totals, ledger.dueDate, Number(ledger.balance));
        }
      });
    });
    return totals;
  }, [records]);

  function replaceCustomer(updatedCustomer: CustomerRecord) {
    setRecords((current) =>
      current.map((customer) => (customer.id === updatedCustomer.id ? updatedCustomer : customer))
    );
  }

  function selectCustomerRecord(customer: CustomerRecord) {
    setSelectedId(customer.id);
    setForm(formFromCustomer(customer));
    setPaymentDraft(paymentDraftFromCustomer(customer));
    setError('');
    setSuccess('');
  }

  function startNewCustomer() {
    setSelectedId(null);
    setForm(blankForm());
    setPaymentDraft(paymentDraftFromCustomer(null));
    setError('');
    setSuccess('');
  }

  async function saveCustomer() {
    setSaving(true);
    setError('');
    setSuccess('');

    const response = await fetch(selectedCustomer ? `/api/customers/${selectedCustomer.id}` : '/api/customers', {
      method: selectedCustomer ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payloadFromForm(form))
    });

    const data = await response.json().catch(() => ({ error: 'Unable to save customer.' }));
    setSaving(false);

    if (!response.ok) {
      setError(data.error ?? 'Unable to save customer.');
      return;
    }

    if (selectedCustomer) {
      replaceCustomer(data.customer);
      setForm(formFromCustomer(data.customer));
      setPaymentDraft(paymentDraftFromCustomer(data.customer));
      setSuccess('Customer updated.');
      return;
    }

    setRecords((current) => [data.customer, ...current]);
    setSelectedId(data.customer.id);
    setForm(formFromCustomer(data.customer));
    setPaymentDraft(paymentDraftFromCustomer(data.customer));
    setSuccess('Customer created.');
  }

  async function postPayment() {
    if (!selectedCustomer) {
      return;
    }

    setPostingPayment(true);
    setError('');
    setSuccess('');

    const response = await fetch(`/api/customers/${selectedCustomer.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'RECORD_PAYMENT',
        customerCreditLedgerId: paymentDraft.customerCreditLedgerId,
        amount: Number(paymentDraft.amount),
        method: paymentDraft.method,
        referenceNumber: paymentDraft.referenceNumber || null,
        paidAt: paymentDraft.paidAt
      })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to post receivable payment.' }));
    setPostingPayment(false);

    if (!response.ok) {
      setError(data.error ?? 'Unable to post receivable payment.');
      return;
    }

    replaceCustomer(data.customer);
    setPaymentDraft(paymentDraftFromCustomer(data.customer));
    setSuccess('Receivable payment posted.');
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card><div className="text-sm text-stone-500">Current</div><div className="mt-2 text-3xl font-black text-stone-900">{money(agingSummary.current, currencySymbol)}</div></Card>
        <Card><div className="text-sm text-stone-500">1-30 days</div><div className="mt-2 text-3xl font-black text-amber-700">{money(agingSummary.days_1_30, currencySymbol)}</div></Card>
        <Card><div className="text-sm text-stone-500">31-60 days</div><div className="mt-2 text-3xl font-black text-orange-700">{money(agingSummary.days_31_60, currencySymbol)}</div></Card>
        <Card><div className="text-sm text-stone-500">61+ days</div><div className="mt-2 text-3xl font-black text-red-700">{money(agingSummary.days_61_plus, currencySymbol)}</div></Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
        <Card>
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Customer directory</div>
              <h2 className="mt-2 text-xl font-black text-stone-900">{selectedCustomer ? 'Edit customer' : 'New customer'}</h2>
            </div>
            <Button type="button" variant="secondary" onClick={startNewCustomer}>New</Button>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <select className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={form.type} onChange={(event) => setForm((current) => ({ ...current, type: event.target.value as CustomerForm['type'] }))}>
              <option value="INDIVIDUAL">Individual</option>
              <option value="BUSINESS">Business</option>
            </select>
            <select className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={form.isActive ? 'active' : 'archived'} onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.value === 'active' }))}>
              <option value="active">Active</option>
              <option value="archived">Archived</option>
            </select>
            <Input placeholder="First name" value={form.firstName} onChange={(event) => setForm((current) => ({ ...current, firstName: event.target.value }))} />
            <Input placeholder="Last name" value={form.lastName} onChange={(event) => setForm((current) => ({ ...current, lastName: event.target.value }))} />
            <Input placeholder="Business name" value={form.businessName} onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))} />
            <Input placeholder="Contact person" value={form.contactPerson} onChange={(event) => setForm((current) => ({ ...current, contactPerson: event.target.value }))} />
            <Input placeholder="Phone" value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} />
            <Input placeholder="Email" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
            <Input placeholder="Tax ID / company reference" value={form.taxId} onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))} />
            <Input placeholder="Address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} />
          </div>

          <textarea className="mt-3 min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10" placeholder="Notes" value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />

          {error ? <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

          <div className="mt-4 flex gap-2">
            <Button type="button" onClick={() => void saveCustomer()} disabled={saving}>
              {saving ? 'Saving...' : selectedCustomer ? 'Update customer' : 'Create customer'}
            </Button>
            {selectedCustomer ? <Button type="button" variant="ghost" onClick={startNewCustomer}>Cancel</Button> : null}
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Growth view</div>
              <h2 className="mt-2 text-xl font-black text-stone-900">Customers</h2>
            </div>
            <Input placeholder="Search by name, phone, email, business..." value={query} onChange={(event) => setQuery(event.target.value)} />
          </div>

          <div className="mb-4 grid gap-3 md:grid-cols-5">
            {topCustomers.map(({ customer, stats }) => (
              <button key={customer.id} type="button" onClick={() => selectCustomerRecord(customer)} className="rounded-2xl border border-stone-200 bg-stone-50 p-4 text-left transition hover:border-emerald-300">
                <div className="truncate font-semibold text-stone-900">{getCustomerDisplayName(customer)}</div>
                <div className="mt-1 text-xs text-stone-500">{stats.purchaseCount} sale(s)</div>
                <div className="mt-2 text-xl font-black text-emerald-700">{money(stats.totalSpend, currencySymbol)}</div>
              </button>
            ))}
          </div>

          <div className="space-y-3">
            {filteredCustomers.map((customer) => {
              const stats = getCustomerStats(customer);
              return (
                <button key={customer.id} type="button" onClick={() => selectCustomerRecord(customer)} className={`w-full rounded-2xl border p-4 text-left transition ${selectedId === customer.id ? 'border-emerald-300 bg-emerald-50/60' : 'border-stone-200 bg-white hover:border-stone-300'}`}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="font-semibold text-stone-900">{getCustomerDisplayName(customer)}</div>
                        <Badge tone={customerTypeTone(customer.type)}>{getCustomerTypeLabel(customer.type)}</Badge>
                        {!customer.isActive ? <Badge tone="red">Archived</Badge> : null}
                      </div>
                      <div className="mt-1 text-sm text-stone-500">{customer.phone || 'No phone'}{customer.email ? ` / ${customer.email}` : ''}</div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-sm lg:min-w-[280px]">
                      <div><div className="text-xs uppercase tracking-[0.14em] text-stone-400">Spend</div><div className="font-semibold text-stone-900">{money(stats.totalSpend, currencySymbol)}</div></div>
                      <div><div className="text-xs uppercase tracking-[0.14em] text-stone-400">Points</div><div className="font-semibold text-stone-900">{stats.loyaltyBalance}</div></div>
                      <div><div className="text-xs uppercase tracking-[0.14em] text-stone-400">Last purchase</div><div className="font-semibold text-stone-900">{stats.lastPurchaseAt ? shortDate(stats.lastPurchaseAt) : 'No sales yet'}</div></div>
                      <div><div className="text-xs uppercase tracking-[0.14em] text-stone-400">Receivables</div><div className="font-semibold text-stone-900">{money(stats.receivableBalance, currencySymbol)}</div></div>
                    </div>
                  </div>
                </button>
              );
            })}

            {!filteredCustomers.length ? <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">No customers matched that search.</div> : null}
          </div>
        </Card>
      </div>

      {selectedCustomer ? (
        <Card>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <h2 className="text-2xl font-black text-stone-900">{getCustomerDisplayName(selectedCustomer)}</h2>
            <Badge tone={customerTypeTone(selectedCustomer.type)}>{getCustomerTypeLabel(selectedCustomer.type)}</Badge>
          </div>

          <div className="grid gap-6 xl:grid-cols-3">
            <div>
              <div className="mb-3 text-sm font-semibold text-stone-900">Recent sales</div>
              <div className="space-y-3">
                {selectedCustomer.sales.length ? selectedCustomer.sales.slice(0, 12).map((sale) => (
                  <div key={sale.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-stone-900">{sale.saleNumber}</div>
                        <div className="text-xs text-stone-500">{dateTime(sale.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-stone-900">{money(sale.totalAmount, currencySymbol)}</div>
                        {sale.isCreditSale ? <Badge tone="amber">Credit</Badge> : null}
                      </div>
                    </div>
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">No completed sales yet.</div>}
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-stone-900">Loyalty ledger</div>
              <div className="space-y-3">
                {selectedCustomer.loyaltyLedger.length ? selectedCustomer.loyaltyLedger.slice(0, 16).map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-semibold text-stone-900">{getCustomerLoyaltyTypeLabel(entry.type)}</div>
                        <div className="text-xs text-stone-500">{dateTime(entry.createdAt)}</div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-stone-900">{entry.type === 'REDEEMED' ? '-' : '+'}{entry.points} pts</div>
                        <div className="text-xs text-stone-500">Balance {entry.balanceAfter}</div>
                      </div>
                    </div>
                    {entry.note ? <div className="mt-2 text-sm text-stone-600">{entry.note}</div> : null}
                  </div>
                )) : <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">No loyalty activity yet.</div>}
              </div>
            </div>

            <div>
              <div className="mb-3 text-sm font-semibold text-stone-900">Receivables</div>
              <div className="space-y-3">
                {selectedCustomer.creditLedgers.length ? selectedCustomer.creditLedgers.map((ledger) => {
                  const status = normalizeCustomerCreditStatus(ledger.status, ledger.dueDate, Number(ledger.balance));
                  return (
                    <div key={ledger.id} className="rounded-2xl border border-stone-200 bg-stone-50 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="font-semibold text-stone-900">{ledger.sale?.saleNumber ?? 'Credit sale'}</div>
                          <div className="text-xs text-stone-500">Due {shortDate(ledger.dueDate)}</div>
                        </div>
                        <Badge tone={customerCreditStatusTone(status)}>{getCustomerCreditStatusLabel(status)}</Badge>
                      </div>
                      <div className="mt-3 flex justify-between text-sm"><span>Original</span><span className="font-semibold text-stone-900">{money(ledger.originalAmount, currencySymbol)}</span></div>
                      <div className="mt-1 flex justify-between text-sm"><span>Balance</span><span className="font-semibold text-stone-900">{money(ledger.balance, currencySymbol)}</span></div>
                      <div className="mt-3 space-y-2">
                        {ledger.payments.map((payment) => (
                          <div key={payment.id} className="rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm text-stone-700">
                            <div className="flex justify-between gap-3"><span>{payment.method}</span><span>{money(payment.amount, currencySymbol)}</span></div>
                            <div className="mt-1 text-xs text-stone-500">{shortDate(payment.paidAt)} by {payment.createdByUser.name ?? payment.createdByUser.email}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                }) : <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">No receivables posted for this customer.</div>}
              </div>

              {selectedCustomer.creditLedgers.some((ledger) => Number(ledger.balance) > 0) ? (
                <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4">
                  <div className="text-sm font-semibold text-stone-900">Post receivable payment</div>
                  <div className="mt-3 grid gap-3">
                    <select className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={paymentDraft.customerCreditLedgerId} onChange={(event) => {
                      const ledger = selectedCustomer.creditLedgers.find((entry) => entry.id === event.target.value);
                      setPaymentDraft((current) => ({ ...current, customerCreditLedgerId: event.target.value, amount: ledger?.balance ?? current.amount }));
                    }}>
                      {selectedCustomer.creditLedgers.filter((ledger) => Number(ledger.balance) > 0).map((ledger) => (
                        <option key={ledger.id} value={ledger.id}>{ledger.sale?.saleNumber ?? 'Credit sale'} / {money(ledger.balance, currencySymbol)}</option>
                      ))}
                    </select>
                    <Input type="number" step="0.01" value={paymentDraft.amount} onChange={(event) => setPaymentDraft((current) => ({ ...current, amount: event.target.value }))} />
                    <select className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm" value={paymentDraft.method} onChange={(event) => setPaymentDraft((current) => ({ ...current, method: event.target.value as PaymentDraft['method'] }))}>
                      <option value="Cash">Cash</option>
                      <option value="Card">Card</option>
                      <option value="E-Wallet">E-Wallet</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                    </select>
                    <Input placeholder="Reference number" value={paymentDraft.referenceNumber} onChange={(event) => setPaymentDraft((current) => ({ ...current, referenceNumber: event.target.value }))} />
                    <Input type="date" value={paymentDraft.paidAt} onChange={(event) => setPaymentDraft((current) => ({ ...current, paidAt: event.target.value }))} />
                  </div>
                  <div className="mt-4">
                    <Button type="button" onClick={() => void postPayment()} disabled={postingPayment}>
                      {postingPayment ? 'Posting...' : 'Post payment'}
                    </Button>
                  </div>
                </div>
              ) : null}
            </div>
          </div>
        </Card>
      ) : null}
    </div>
  );
}
