import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { dateTime, money } from '@/lib/format';

type Sale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  cashierName: string | null;
  createdAt: string;
  totalAmount: string;
  customerName: string | null;
  status: string;
};

export default function SalesTable({
  sales,
  currencySymbol
}: {
  sales: Sale[];
  currencySymbol: string;
}) {
  return (
    <Card>
      <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Transactions</div>
          <h2 className="mt-2 text-xl font-black text-stone-900">Sales history</h2>
          <p className="mt-1 text-sm text-stone-500">Completed sales with receipt access and cashier context.</p>
        </div>
        <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
          {sales.length} record(s)
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-[26px] border border-stone-200">
        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-stone-50 text-stone-500">
              <tr>
                <th className="px-4 py-3.5">Sale</th>
                <th className="px-4 py-3.5">Status</th>
                <th className="px-4 py-3.5">Customer</th>
                <th className="px-4 py-3.5">Payment</th>
                <th className="px-4 py-3.5">Cashier</th>
                <th className="px-4 py-3.5">Date</th>
                <th className="px-4 py-3.5">Total</th>
                <th className="px-4 py-3.5">Actions</th>
              </tr>
            </thead>

            <tbody>
              {sales.map((sale) => (
                <tr key={sale.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                  <td className="px-4 py-4">
                    <Link href={`/sales/${sale.id}`} className="font-semibold text-emerald-700">
                      {sale.saleNumber}
                    </Link>
                    <div className="mt-1 text-xs text-stone-500">{sale.receiptNumber}</div>
                  </td>
                  <td className="px-4 py-4">
                    <Badge tone={sale.status === 'VOIDED' ? 'red' : 'emerald'}>{sale.status}</Badge>
                  </td>
                  <td className="px-4 py-4">{sale.customerName ?? 'Walk-in customer'}</td>
                  <td className="px-4 py-4">
                    <Badge tone="blue">{sale.paymentMethod}</Badge>
                  </td>
                  <td className="px-4 py-4">{sale.cashierName ?? 'Cashier'}</td>
                  <td className="px-4 py-4">{dateTime(sale.createdAt)}</td>
                  <td className="px-4 py-4 font-semibold text-stone-900">{money(sale.totalAmount, currencySymbol)}</td>
                  <td className="px-4 py-4">
                    <div className="flex flex-col gap-2">
                      <Link href={`/sales/${sale.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
                        View
                      </Link>
                      <Link href={`/sales/${sale.id}/receipt`} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                        Receipt
                      </Link>
                      <Link href={`/sales/${sale.id}/refund`} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                        Refund
                      </Link>
                      <Link href={`/sales/${sale.id}/void`} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                        Void
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!sales.length ? <div className="border-t border-stone-200 bg-stone-50 py-8 text-center text-sm text-stone-500">No sales yet.</div> : null}
      </div>
    </Card>
  );
}
