import Card from '@/components/ui/Card';
import { dateTime, money } from '@/lib/format';
import Link from 'next/link';

type Sale = {
  id: string;
  saleNumber: string;
  receiptNumber: string;
  paymentMethod: string;
  cashierName: string | null;
  createdAt: string;
  totalAmount: string;
  items: { id: string; productName: string; qty: number; lineTotal: string }[];
};

export default function RecentSalesCard({
  sales,
  currencySymbol
}: {
  sales: Sale[];
  currencySymbol: string;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-stone-900">Recent sales</h2>
          <p className="text-sm text-stone-500">Latest completed transactions.</p>
        </div>
        <Link href="/sales" className="text-sm font-semibold text-emerald-600">
          View all
        </Link>
      </div>

      <div className="space-y-3">
        {sales.length ? (
          sales.map((sale) => (
            <div key={sale.id} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="font-semibold text-stone-900">
                    <Link href={`/sales/${sale.id}`} className="hover:text-emerald-700">
                      {sale.saleNumber}
                    </Link>
                  </div>
                  <div className="text-sm text-stone-500">
                    {sale.paymentMethod} • {sale.cashierName || 'Cashier'}
                  </div>
                  <div className="text-xs text-stone-500">
                    {sale.receiptNumber} • {dateTime(sale.createdAt)}
                  </div>
                </div>

                <div className="text-right font-black text-stone-900">
                  {money(sale.totalAmount, currencySymbol)}
                </div>
              </div>

              <div className="mt-3 space-y-1 text-sm text-stone-600">
                {sale.items.slice(0, 3).map((item) => (
                  <div key={item.id} className="flex justify-between">
                    <span>
                      {item.productName} × {item.qty}
                    </span>
                    <span>{money(item.lineTotal, currencySymbol)}</span>
                  </div>
                ))}
              </div>

              <div className="mt-3">
                <Link
                  href={`/sales/${sale.id}/receipt`}
                  className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                >
                  Open receipt →
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
            No sales yet.
          </div>
        )}
      </div>
    </Card>
  );
}