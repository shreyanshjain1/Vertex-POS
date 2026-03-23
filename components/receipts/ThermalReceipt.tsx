'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import { dateTime, money } from '@/lib/format';

type ReceiptItem = {
  id: string;
  productName: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
};

type ReceiptSale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  cashierName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  notes: string | null;
  createdAt: string;
  items: ReceiptItem[];
};

type ReceiptShop = {
  name: string;
  address: string | null;
  phone: string | null;
  email: string | null;
};

export default function ThermalReceipt({
  sale,
  shop,
  currencySymbol,
  receiptHeader,
  receiptFooter,
  autoprint = false
}: {
  sale: ReceiptSale;
  shop: ReceiptShop;
  currencySymbol: string;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  autoprint?: boolean;
}) {
  useEffect(() => {
    if (!autoprint) return;
    const timer = setTimeout(() => {
      window.print();
    }, 450);
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
          html,
          body {
            background: #fff !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          body * {
            visibility: hidden;
          }

          .receipt-root,
          .receipt-root * {
            visibility: visible;
          }

          .receipt-root {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 80mm !important;
            max-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          .receipt-print-hide {
            display: none !important;
          }
        }
      `}</style>

      <div className="receipt-print-hide">
        <Button type="button" onClick={() => window.print()}>
          Print receipt
        </Button>
      </div>

      <div className="receipt-root mx-auto w-full max-w-[320px] rounded-3xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="border-b border-dashed border-stone-300 pb-4 text-center">
          <div className="text-base font-black text-stone-900">{receiptHeader || shop.name}</div>
          {shop.address ? <div className="mt-1 text-[11px] text-stone-600">{shop.address}</div> : null}
          <div className="mt-1 text-[11px] text-stone-600">
            {shop.phone || '—'} {shop.email ? `• ${shop.email}` : ''}
          </div>
        </div>

        <div className="space-y-1 border-b border-dashed border-stone-300 py-4 text-[11px] text-stone-700">
          <div className="flex justify-between">
            <span>Receipt No.</span>
            <span>{sale.receiptNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Sale No.</span>
            <span>{sale.saleNumber}</span>
          </div>
          <div className="flex justify-between">
            <span>Date</span>
            <span>{dateTime(sale.createdAt)}</span>
          </div>
          <div className="flex justify-between">
            <span>Cashier</span>
            <span>{sale.cashierName ?? 'Cashier'}</span>
          </div>
          <div className="flex justify-between">
            <span>Payment</span>
            <span>{sale.paymentMethod}</span>
          </div>
          <div className="flex justify-between">
            <span>Customer</span>
            <span>{sale.customerName ?? 'Walk-in'}</span>
          </div>
          {sale.customerPhone ? (
            <div className="flex justify-between">
              <span>Phone</span>
              <span>{sale.customerPhone}</span>
            </div>
          ) : null}
        </div>

        <div className="space-y-2 border-b border-dashed border-stone-300 py-4">
          {sale.items.map((item) => (
            <div key={item.id} className="text-[11px]">
              <div className="font-medium text-stone-900">{item.productName}</div>
              <div className="mt-1 flex justify-between text-stone-600">
                <span>
                  {item.qty} × {money(item.unitPrice, currencySymbol)}
                </span>
                <span>{money(item.lineTotal, currencySymbol)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="space-y-1 border-b border-dashed border-stone-300 py-4 text-[11px] text-stone-700">
          <div className="flex justify-between">
            <span>Subtotal</span>
            <span>{money(sale.subtotal, currencySymbol)}</span>
          </div>
          <div className="flex justify-between">
            <span>VAT</span>
            <span>{money(sale.taxAmount, currencySymbol)}</span>
          </div>
          <div className="flex justify-between">
            <span>Discount</span>
            <span>-{money(sale.discountAmount, currencySymbol)}</span>
          </div>
          <div className="flex justify-between pt-2 text-sm font-black text-stone-900">
            <span>Total</span>
            <span>{money(sale.totalAmount, currencySymbol)}</span>
          </div>
        </div>

        {sale.notes ? (
          <div className="border-b border-dashed border-stone-300 py-4 text-[11px] text-stone-600">
            <div className="font-semibold text-stone-900">Notes</div>
            <div className="mt-1">{sale.notes}</div>
          </div>
        ) : null}

        <div className="pt-4 text-center text-[11px] text-stone-600">
          {receiptFooter || 'Thank you for your purchase.'}
        </div>
      </div>
    </div>
  );
}