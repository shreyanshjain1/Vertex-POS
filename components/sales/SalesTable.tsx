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
      <h2 className="text-xl font-black text-stone-900">Sales history</h2>

      <div className="mt-4 overflow-x-auto">
        <table className="min-w-full text-left text-sm">
          <thead className="text-stone-500">
            <tr>
              <th className="px-3 py-3">Sale</th>
              <th className="px-3 py-3">Customer</th>
              <th className="px-3 py-3">Payment</th>
              <th className="px-3 py-3">Cashier</th>
              <th className="px-3 py-3">Date</th>
              <th className="px-3 py-3">Total</th>
              <th className="px-3 py-3">Actions</th>
            </tr>
          </thead>

          <tbody>
            {sales.map((sale) => (
              <tr key={sale.id} className="border-t border-stone-200">
                <td className="px-3 py-3">
                  <Link href={`/sales/${sale.id}`} className="font-semibold text-emerald-700">
                    {sale.saleNumber}
                  </Link>
                  <div className="text-xs text-stone-500">{sale.receiptNumber}</div>
                </td>
                <td className="px-3 py-3">{sale.customerName ?? 'Walk-in customer'}</td>
                <td className="px-3 py-3">
                  <Badge tone="blue">{sale.paymentMethod}</Badge>
                </td>
                <td className="px-3 py-3">{sale.cashierName ?? 'Cashier'}</td>
                <td className="px-3 py-3">{dateTime(sale.createdAt)}</td>
                <td className="px-3 py-3 font-semibold text-stone-900">{money(sale.totalAmount, currencySymbol)}</td>
                <td className="px-3 py-3">
                  <div className="flex flex-col gap-1">
                    <Link href={`/sales/${sale.id}`} className="text-xs font-semibold text-emerald-600">
                      View
                    </Link>
                    <Link href={`/sales/${sale.id}/receipt`} className="text-xs font-semibold text-stone-600 hover:text-stone-900">
                      Receipt
                    </Link>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {!sales.length ? <div className="py-6 text-sm text-stone-500">No sales yet.</div> : null}
      </div>
    </Card>
  );
}
