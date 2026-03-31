'use client';

import { useEffect } from 'react';
import Button from '@/components/ui/Button';
import { dateTime, money, shortDate } from '@/lib/format';

type ReceiptWidth = '58mm' | '80mm';

type ReceiptItem = {
  id: string;
  productName: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
};

type ReceiptPayment = {
  id: string;
  method: string;
  amount: string;
  referenceNumber: string | null;
  createdAt: string;
};

type ReceiptSale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  cashierName: string | null;
  customerName: string | null;
  customerPhone: string | null;
  isCreditSale: boolean;
  creditDueDate: string | null;
  loyaltyPointsEarned: number;
  loyaltyPointsRedeemed: number;
  loyaltyDiscountAmount: string;
  subtotal: string;
  taxAmount: string;
  discountAmount: string;
  totalAmount: string;
  totalPaid: string;
  cashReceived: string;
  changeDue: string;
  notes: string | null;
  createdAt: string;
  payments: ReceiptPayment[];
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
  receiptWidth = '80mm',
  autoprint = false
}: {
  sale: ReceiptSale;
  shop: ReceiptShop;
  currencySymbol: string;
  receiptHeader?: string | null;
  receiptFooter?: string | null;
  receiptWidth?: ReceiptWidth;
  autoprint?: boolean;
}) {
  const paperWidth = receiptWidth === '58mm' ? '58mm' : '80mm';
  const compact = paperWidth === '58mm';

  useEffect(() => {
    if (!autoprint) return;
    const timer = setTimeout(() => window.print(), 450);
    return () => clearTimeout(timer);
  }, [autoprint]);

  return (
    <div className="space-y-4">
      <style jsx global>{`
        @page {
          size: ${paperWidth} auto;
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
            width: ${paperWidth} !important;
            max-width: ${paperWidth} !important;
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

      <div className={`receipt-root mx-auto rounded-3xl border border-stone-200 bg-white shadow-sm ${compact ? 'p-4' : 'p-5'}`} style={{ width: paperWidth, maxWidth: paperWidth }}>
        <div className="border-b border-dashed border-stone-300 pb-4 text-center">
          <div className={`${compact ? 'text-sm' : 'text-base'} font-black text-stone-900`}>{receiptHeader || shop.name}</div>
          {shop.address ? <div className={`mt-1 ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-600`}>{shop.address}</div> : null}
          <div className={`mt-1 ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-600`}>
            {shop.phone || 'N/A'}
            {shop.email ? ` | ${shop.email}` : ''}
          </div>
        </div>

        <div className={`space-y-1 border-b border-dashed border-stone-300 py-4 ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-700`}>
          <div className="flex justify-between gap-3"><span>Receipt No.</span><span className="text-right">{sale.receiptNumber}</span></div>
          <div className="flex justify-between gap-3"><span>Sale No.</span><span className="text-right">{sale.saleNumber}</span></div>
          <div className="flex justify-between gap-3"><span>Date</span><span className="text-right">{dateTime(sale.createdAt)}</span></div>
          <div className="flex justify-between gap-3"><span>Cashier</span><span className="text-right">{sale.cashierName ?? 'Cashier'}</span></div>
          <div className="flex justify-between gap-3"><span>Payment</span><span className="text-right">{sale.paymentMethod}</span></div>
          <div className="flex justify-between gap-3"><span>Customer</span><span className="text-right">{sale.customerName ?? 'Walk-in'}</span></div>
          {sale.customerPhone ? <div className="flex justify-between gap-3"><span>Phone</span><span className="text-right">{sale.customerPhone}</span></div> : null}
          {sale.isCreditSale && sale.creditDueDate ? <div className="flex justify-between gap-3"><span>Due</span><span className="text-right">{shortDate(sale.creditDueDate)}</span></div> : null}
        </div>

        <div className="space-y-2 border-b border-dashed border-stone-300 py-4">
          {sale.items.map((item) => (
            <div key={item.id} className={compact ? 'text-[10px]' : 'text-[11px]'}>
              <div className="font-medium text-stone-900">{item.productName}</div>
              <div className="mt-1 flex justify-between gap-3 text-stone-600">
                <span>{item.qty} x {money(item.unitPrice, currencySymbol)}</span>
                <span className="text-right">{money(item.lineTotal, currencySymbol)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className={`space-y-1 border-b border-dashed border-stone-300 py-4 ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-700`}>
          <div className="flex justify-between"><span>Subtotal</span><span>{money(sale.subtotal, currencySymbol)}</span></div>
          <div className="flex justify-between"><span>Tax</span><span>{money(sale.taxAmount, currencySymbol)}</span></div>
          <div className="flex justify-between"><span>Discount</span><span>-{money(sale.discountAmount, currencySymbol)}</span></div>
          {Number(sale.loyaltyDiscountAmount) > 0 ? <div className="flex justify-between"><span>Loyalty discount</span><span>-{money(sale.loyaltyDiscountAmount, currencySymbol)}</span></div> : null}
          <div className="flex justify-between pt-2 text-sm font-black text-stone-900"><span>Total</span><span>{money(sale.totalAmount, currencySymbol)}</span></div>
        </div>

        {sale.loyaltyPointsEarned > 0 || sale.loyaltyPointsRedeemed > 0 ? (
          <div className={`space-y-1 border-b border-dashed border-stone-300 py-4 ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-700`}>
            <div className="font-semibold text-stone-900">Loyalty</div>
            {sale.loyaltyPointsEarned > 0 ? <div className="flex justify-between"><span>Points earned</span><span>{sale.loyaltyPointsEarned}</span></div> : null}
            {sale.loyaltyPointsRedeemed > 0 ? <div className="flex justify-between"><span>Points redeemed</span><span>{sale.loyaltyPointsRedeemed}</span></div> : null}
          </div>
        ) : null}

        <div className={`space-y-2 border-b border-dashed border-stone-300 py-4 ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-700`}>
          <div className="font-semibold text-stone-900">Payment summary</div>
          {sale.payments.map((payment) => (
            <div key={payment.id} className="rounded-2xl border border-stone-200 px-3 py-2">
              <div className="flex justify-between gap-3">
                <span>{payment.method}</span>
                <span className="text-right">{money(payment.amount, currencySymbol)}</span>
              </div>
              {payment.referenceNumber ? <div className="mt-1 text-stone-500">Ref: {payment.referenceNumber}</div> : null}
            </div>
          ))}
          <div className="flex justify-between"><span>Paid total</span><span>{money(sale.totalPaid, currencySymbol)}</span></div>
          {Number(sale.cashReceived) > 0 ? <div className="flex justify-between"><span>Cash received</span><span>{money(sale.cashReceived, currencySymbol)}</span></div> : null}
          {Number(sale.changeDue) > 0 ? <div className="flex justify-between font-semibold text-emerald-700"><span>Change due</span><span>{money(sale.changeDue, currencySymbol)}</span></div> : null}
        </div>

        {sale.notes ? (
          <div className={`border-b border-dashed border-stone-300 py-4 ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-600`}>
            <div className="font-semibold text-stone-900">Notes</div>
            <div className="mt-1">{sale.notes}</div>
          </div>
        ) : null}

        <div className={`pt-4 text-center ${compact ? 'text-[10px]' : 'text-[11px]'} text-stone-600`}>
          {receiptFooter || 'Thank you for your purchase.'}
        </div>
      </div>
    </div>
  );
}
