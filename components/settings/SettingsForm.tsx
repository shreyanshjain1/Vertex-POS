'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { PAYMENT_METHODS, type PaymentMethod } from '@/lib/payments';
import {
  getPrinterConnectionLabel,
  getTaxModeLabel,
  PRINTER_CONNECTION_OPTIONS,
  type PrinterConnectionValue,
  TAX_MODE_OPTIONS,
  type TaxModeValue
} from '@/lib/shop-settings';

type ReceiptWidth = '58mm' | '80mm';

type Props = {
  initialValues: {
    shopName: string;
    legalBusinessName: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    taxId: string | null;
    timezone: string;
    currencyCode: string;
    currencySymbol: string;
    taxMode: TaxModeValue;
    taxRate: string;
    receiptHeader: string | null;
    receiptFooter: string | null;
    receiptWidth: ReceiptWidth;
    defaultPaymentMethods: PaymentMethod[];
    printerName: string;
    printerConnection: PrinterConnectionValue;
    barcodeScannerNotes: string;
    lowStockEnabled: boolean;
    lowStockThreshold: number;
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    fefoEnabled: boolean;
    expiryAlertDays: number;
    openingFloatRequired: boolean;
    openingFloatAmount: string;
    salePrefix: string;
    receiptPrefix: string;
    purchasePrefix: string;
  };
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

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

  function togglePaymentMethod(method: PaymentMethod) {
    setForm((current) => {
      const hasMethod = current.defaultPaymentMethods.includes(method);
      const nextMethods = hasMethod
        ? current.defaultPaymentMethods.filter((entry) => entry !== method)
        : [...current.defaultPaymentMethods, method];

      return {
        ...current,
        defaultPaymentMethods: nextMethods.length ? nextMethods : current.defaultPaymentMethods
      };
    });
  }

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
        lowStockThreshold: Number(form.lowStockThreshold),
        openingFloatAmount: Number(form.openingFloatAmount)
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
        <h2 className="text-xl font-black text-stone-900">Branch settings</h2>
        <p className="mt-2 text-sm text-stone-500">
          Keep the branch identity, tax behavior, checkout defaults, printer setup, and register rules aligned with how this store actually runs.
        </p>
      </Card>

      <Section title="Business details" description="Use the legal business name for formal records and the branch name for day-to-day branch operations.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Branch/store name"
            value={form.shopName}
            onChange={(event) => setForm((current) => ({ ...current, shopName: event.target.value }))}
          />
          <Input
            placeholder="Legal business name"
            value={form.legalBusinessName}
            onChange={(event) => setForm((current) => ({ ...current, legalBusinessName: event.target.value }))}
          />
          <Input
            placeholder="Phone"
            value={form.phone ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))}
          />
          <Input
            placeholder="Email"
            value={form.email ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
          />
          <Input
            placeholder="Tax ID / company reference"
            value={form.taxId ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, taxId: event.target.value }))}
          />
          <Input
            placeholder="Timezone"
            value={form.timezone}
            onChange={(event) => setForm((current) => ({ ...current, timezone: event.target.value }))}
          />
          <div className="md:col-span-2">
            <Input
              placeholder="Address"
              value={form.address ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))}
            />
          </div>
        </div>
      </Section>

      <Section title="Tax and currency" description="These values drive checkout calculations and how totals appear on receipts and reports.">
        <div className="grid gap-4 md:grid-cols-2">
          <Input
            placeholder="Currency code"
            value={form.currencyCode}
            onChange={(event) => setForm((current) => ({ ...current, currencyCode: event.target.value.toUpperCase() }))}
          />
          <Input
            placeholder="Currency symbol"
            value={form.currencySymbol}
            onChange={(event) => setForm((current) => ({ ...current, currencySymbol: event.target.value }))}
          />
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">Tax mode</div>
            <select
              className={selectClassName}
              value={form.taxMode}
              onChange={(event) => setForm((current) => ({ ...current, taxMode: event.target.value as TaxModeValue }))}
            >
              {TAX_MODE_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {getTaxModeLabel(entry)}
                </option>
              ))}
            </select>
          </div>
          <Input
            type="number"
            step="0.01"
            placeholder="Tax rate"
            value={form.taxRate}
            onChange={(event) => setForm((current) => ({ ...current, taxRate: event.target.value }))}
          />
        </div>
      </Section>

      <Section title="Checkout and register" description="Shape the payment methods cashiers see first and the opening float rule each shift must follow.">
        <div className="space-y-4">
          <div>
            <div className="text-sm font-semibold text-stone-700">Default payment methods</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((method) => {
                const active = form.defaultPaymentMethods.includes(method);
                return (
                  <button
                    key={method}
                    type="button"
                    onClick={() => togglePaymentMethod(method)}
                    className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                      active
                        ? 'border-emerald-600 bg-emerald-600 text-white'
                        : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
                    }`}
                  >
                    {method}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.openingFloatRequired}
                onChange={(event) => setForm((current) => ({ ...current, openingFloatRequired: event.target.checked }))}
              />
              Require a minimum opening float before a register session starts
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="Required opening float"
              value={form.openingFloatAmount}
              onChange={(event) => setForm((current) => ({ ...current, openingFloatAmount: event.target.value }))}
            />
            <Input
              type="number"
              placeholder="Low stock threshold"
              value={String(form.lowStockThreshold)}
              onChange={(event) => setForm((current) => ({ ...current, lowStockThreshold: Number(event.target.value) }))}
            />
            <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
              <input
                type="checkbox"
                checked={form.lowStockEnabled}
                onChange={(event) => setForm((current) => ({ ...current, lowStockEnabled: event.target.checked }))}
              />
              Enable low-stock alerts
            </label>
          </div>
        </div>
      </Section>

      <Section title="Inventory defaults" description="These defaults support low-stock warnings, expiry discipline, and how the branch wants stock rotated operationally.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.batchTrackingEnabled}
              onChange={(event) => setForm((current) => ({ ...current, batchTrackingEnabled: event.target.checked }))}
            />
            Enable batch / lot tracking by default
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.expiryTrackingEnabled}
              onChange={(event) => setForm((current) => ({ ...current, expiryTrackingEnabled: event.target.checked }))}
            />
            Enable expiry tracking by default
          </label>
          <label className="flex items-center gap-3 rounded-2xl border border-stone-200 bg-white px-4 py-3 text-sm text-stone-700">
            <input
              type="checkbox"
              checked={form.fefoEnabled}
              onChange={(event) => setForm((current) => ({ ...current, fefoEnabled: event.target.checked }))}
            />
            Prefer FEFO rotation for expiring stock
          </label>
          <Input
            type="number"
            placeholder="Expiry alert days"
            value={String(form.expiryAlertDays)}
            onChange={(event) => setForm((current) => ({ ...current, expiryAlertDays: Number(event.target.value) }))}
          />
        </div>
      </Section>

      <Section title="Receipt and hardware" description="Keep thermal receipt output practical and record the branch's printer or scanner notes without overbuilding hardware integrations.">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">Receipt width</div>
            <select
              className={selectClassName}
              value={form.receiptWidth}
              onChange={(event) =>
                setForm((current) => ({ ...current, receiptWidth: event.target.value as ReceiptWidth }))
              }
            >
              <option value="58mm">58mm thermal roll</option>
              <option value="80mm">80mm thermal roll</option>
            </select>
          </div>
          <div className="space-y-2">
            <div className="text-sm font-semibold text-stone-700">Printer connection</div>
            <select
              className={selectClassName}
              value={form.printerConnection}
              onChange={(event) =>
                setForm((current) => ({ ...current, printerConnection: event.target.value as PrinterConnectionValue }))
              }
            >
              {PRINTER_CONNECTION_OPTIONS.map((entry) => (
                <option key={entry} value={entry}>
                  {getPrinterConnectionLabel(entry)}
                </option>
              ))}
            </select>
          </div>
          <Input
            placeholder="Printer name or queue"
            value={form.printerName}
            onChange={(event) => setForm((current) => ({ ...current, printerName: event.target.value }))}
          />
          <Input
            placeholder="Receipt header"
            value={form.receiptHeader ?? ''}
            onChange={(event) => setForm((current) => ({ ...current, receiptHeader: event.target.value }))}
          />
          <div className="md:col-span-2">
            <Input
              placeholder="Receipt footer"
              value={form.receiptFooter ?? ''}
              onChange={(event) => setForm((current) => ({ ...current, receiptFooter: event.target.value }))}
            />
          </div>
          <div className="md:col-span-2">
            <textarea
              className="min-h-24 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
              placeholder="Barcode scanner notes or cashier guidance"
              value={form.barcodeScannerNotes}
              onChange={(event) => setForm((current) => ({ ...current, barcodeScannerNotes: event.target.value }))}
            />
          </div>
        </div>
      </Section>

      <Section title="Document numbering" description="Use short prefixes so sale, receipt, and purchase or invoice references stay branch-specific and easy to read.">
        <div className="grid gap-4 md:grid-cols-3">
          <Input
            placeholder="Sale prefix"
            value={form.salePrefix}
            onChange={(event) => setForm((current) => ({ ...current, salePrefix: event.target.value.toUpperCase() }))}
          />
          <Input
            placeholder="Receipt prefix"
            value={form.receiptPrefix}
            onChange={(event) => setForm((current) => ({ ...current, receiptPrefix: event.target.value.toUpperCase() }))}
          />
          <Input
            placeholder="Purchase prefix"
            value={form.purchasePrefix}
            onChange={(event) => setForm((current) => ({ ...current, purchasePrefix: event.target.value.toUpperCase() }))}
          />
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
