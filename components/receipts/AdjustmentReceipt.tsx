'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import { dateTime, money } from '@/lib/format';

type AdjustmentItem = {
  id: string;
  itemType: string;
  productName: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
  disposition: string;
};

type AdjustmentPayment = {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string | null;
};

type ExchangeSaleSummary = {
  saleNumber: string;
  receiptNumber: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  paymentMethod: string;
};

export default function AdjustmentReceipt({
  autoprint = false,
  currencySymbol,
  shop,
  adjustment,
  receiptHeader,
  receiptFooter
}: {
  autoprint?: boolean;
  currencySymbol: string;
  shop: {
    name: string;
    address: string | null;
    phone: string | null;
    email: string | null;
  };
  adjustment: {
    adjustmentNumber: string;
    type: string;
    reason: string;
    notes: string | null;
    subtotal: string;
    totalAmount: string;
    createdAt: string;
    createdBy: string;
    approvedBy: string;
    saleNumber: string;
    receiptNumber: string;
    customerName: string | null;
    refundPayments: AdjustmentPayment[];
    items: AdjustmentItem[];
    exchangeSale: ExchangeSaleSummary | null;
  };
  receiptHeader?: string | null;
  receiptFooter?: string | null;
}) {
  useEffect(() => {
    if (!autoprint) return;
    const timer = setTimeout(() => window.print(), 450);
    return () => clearTimeout(timer);
  }, [autoprint]);

  return (
    <div className="space-y-4">
      <style jsx global>{`
        @page {
          size: 80mm auto;
          margin: 4mm;
        }
        @media print {
          body * {
            visibility: hidden;
          }
          .adjustment-receipt,
          .adjustment-receipt * {
            visibility: visible;
          }
          .adjustment-receipt {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
          }
          .adjustment-print-hide {
            display: none !important;
          }
        }
      `}</style>

      <div className="adjustment-print-hide">
        <Button type="button" onClick={() => window.print()}>Print receipt</Button>
      </div>

      <div className="adjustment-receipt mx-auto w-[80mm] rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="border-b border-dashed border-stone-300 pb-4 text-center">
          <div className="text-base font-black text-stone-900">{receiptHeader || shop.name}</div>
          {shop.address ? <div className="mt-1 text-[11px] text-stone-600">{shop.address}</div> : null}
          <div className="mt-1 text-[11px] text-stone-600">
            {shop.phone || 'N/A'}
            {shop.email ? ` | ${shop.email}` : ''}
          </div>
        </div>

        <div className="space-y-1 border-b border-dashed border-stone-300 py-4 text-[11px] text-stone-700">
          <div className="flex justify-between gap-3"><span>Adjustment</span><span>{adjustment.adjustmentNumber}</span></div>
          <div className="flex justify-between gap-3"><span>Type</span><span>{adjustment.type}</span></div>
          <div className="flex justify-between gap-3"><span>Original sale</span><span>{adjustment.saleNumber}</span></div>
          <div className="flex justify-between gap-3"><span>Original receipt</span><span>{adjustment.receiptNumber}</span></div>
          <div className="flex justify-between gap-3"><span>Date</span><span>{dateTime(adjustment.createdAt)}</span></div>
          <div className="flex justify-between gap-3"><span>Customer</span><span>{adjustment.customerName ?? 'Walk-in'}</span></div>
        </div>

        <div className="border-b border-dashed border-stone-300 py-4 text-[11px] text-stone-700">
          <div className="font-semibold text-stone-900">Reason</div>
          <div className="mt-1">{adjustment.reason}</div>
          {adjustment.notes ? <div className="mt-2 text-stone-500">{adjustment.notes}</div> : null}
        </div>

        <div className="space-y-2 border-b border-dashed border-stone-300 py-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-500">Adjustment items</div>
          {adjustment.items.map((item) => (
            <div key={item.id} className="text-[11px]">
              <div className="font-medium text-stone-900">{item.productName}</div>
              <div className="mt-1 flex justify-between gap-3 text-stone-600">
                <span>{item.itemType} / {item.disposition} / {item.qty} x {money(item.unitPrice, currencySymbol)}</span>
                <span>{money(item.lineTotal, currencySymbol)}</span>
              </div>
            </div>
          ))}
        </div>

        {adjustment.exchangeSale ? (
          <div className="space-y-1 border-b border-dashed border-stone-300 py-4 text-[11px] text-stone-700">
            <div className="font-semibold text-stone-900">Exchange sale</div>
            <div className="flex justify-between"><span>Sale</span><span>{adjustment.exchangeSale.saleNumber}</span></div>
            <div className="flex justify-between"><span>Receipt</span><span>{adjustment.exchangeSale.receiptNumber}</span></div>
            <div className="flex justify-between"><span>Subtotal</span><span>{money(adjustment.exchangeSale.subtotal, currencySymbol)}</span></div>
            <div className="flex justify-between"><span>Tax</span><span>{money(adjustment.exchangeSale.taxAmount, currencySymbol)}</span></div>
            <div className="flex justify-between"><span>Credit applied</span><span>-{money(adjustment.exchangeSale.discountAmount, currencySymbol)}</span></div>
            <div className="flex justify-between font-semibold text-stone-900"><span>Collected</span><span>{money(adjustment.exchangeSale.totalAmount, currencySymbol)}</span></div>
            <div className="text-stone-500">Tender: {adjustment.exchangeSale.paymentMethod}</div>
          </div>
        ) : null}

        <div className="space-y-1 border-b border-dashed border-stone-300 py-4 text-[11px] text-stone-700">
          <div className="flex justify-between"><span>Return credit</span><span>{money(adjustment.subtotal, currencySymbol)}</span></div>
          <div className="flex justify-between pt-2 text-sm font-black text-stone-900"><span>Refund paid</span><span>{money(adjustment.totalAmount, currencySymbol)}</span></div>
        </div>

        {adjustment.refundPayments.length ? (
          <div className="space-y-2 border-b border-dashed border-stone-300 py-4 text-[11px] text-stone-700">
            <div className="font-semibold text-stone-900">Refund payments</div>
            {adjustment.refundPayments.map((payment) => (
              <div key={payment.id} className="rounded-2xl border border-stone-200 px-3 py-2">
                <div className="flex justify-between"><span>{payment.method}</span><span>{money(payment.amount, currencySymbol)}</span></div>
                {payment.referenceNumber ? <div className="mt-1 text-stone-500">Ref: {payment.referenceNumber}</div> : null}
              </div>
            ))}
          </div>
        ) : null}

        <div className="pt-4 text-center text-[11px] text-stone-600">
          Processed by {adjustment.createdBy} / Approved by {adjustment.approvedBy}
          <div className="mt-2">{receiptFooter || 'Keep this adjustment receipt for your records.'}</div>
        </div>
      </div>
    </div>
  );
}
