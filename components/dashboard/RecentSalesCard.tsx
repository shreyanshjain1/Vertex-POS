'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { dateTime, money } from '@/lib/format';
import type { SerializedRecentSale } from '@/lib/serializers/dashboard';

export default function RecentSalesCard({
  sales,
  currencySymbol
}: {
  sales: SerializedRecentSale[];
  currencySymbol: string;
}) {
  const paymentToneMap: Record<string, 'stone' | 'emerald' | 'amber' | 'red' | 'blue'> = {
    cash: 'emerald',
    gcash: 'blue',
    card: 'stone',
    transfer: 'blue'
  };

  return (
    <Card className="overflow-hidden border-stone-200/80 bg-white/95">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Activity stream</div>
          <h2 className="mt-2 text-2xl font-black text-stone-900">Recent sales</h2>
          <p className="mt-1 text-sm text-stone-500">Latest completed transactions with receipt access and line-item context.</p>
        </div>
        <Link
          href="/sales"
          className="inline-flex rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
        >
          View all
        </Link>
      </div>

      <div className="space-y-3">
        {sales.length ? (
          sales.map((sale, index) => (
            <motion.div
              key={sale.id}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.24, delay: index * 0.04 }}
              whileHover={{ y: -4 }}
            >
              <div className="rounded-[28px] border border-stone-200/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.99),rgba(245,245,244,0.92))] p-4 shadow-[0_18px_36px_-28px_rgba(28,25,23,0.42)] transition">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link href={`/sales/${sale.id}`} className="text-lg font-black text-stone-900 transition hover:text-emerald-700">
                        {sale.saleNumber}
                      </Link>
                      <Badge tone={paymentToneMap[sale.paymentMethod.toLowerCase()] ?? 'stone'}>{sale.paymentMethod}</Badge>
                      <Badge tone="stone">
                        {sale.items.reduce((sum, item) => sum + item.qty, 0)} item(s)
                      </Badge>
                    </div>

                    <div className="mt-2 text-sm text-stone-500">
                      {sale.cashierName || 'Cashier'} / {sale.receiptNumber}
                    </div>
                    <div className="mt-1 text-xs font-medium uppercase tracking-[0.18em] text-stone-400">
                      {dateTime(sale.createdAt)}
                    </div>
                  </div>

                  <div className="rounded-[22px] bg-[linear-gradient(135deg,#0f172a,#111827)] px-4 py-3 text-right text-white shadow-[0_24px_48px_-32px_rgba(15,23,42,0.8)]">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-300">Total</div>
                    <div className="mt-1 text-2xl font-black">{money(sale.totalAmount, currencySymbol)}</div>
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  {sale.items.slice(0, 3).map((item) => (
                    <div key={item.id} className="flex items-center justify-between rounded-[20px] border border-stone-200/70 bg-stone-50 px-3 py-2.5 text-sm text-stone-600">
                      <span className="truncate pr-4">
                        {item.productName} x {item.qty}
                      </span>
                      <span className="shrink-0 font-semibold text-stone-900">{money(item.lineTotal, currencySymbol)}</span>
                    </div>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between gap-3">
                  <div className="text-xs font-medium text-stone-500">
                    {sale.items.length > 3 ? `${sale.items.length - 3} more line(s) in this receipt.` : 'Receipt details are ready to review.'}
                  </div>
                  <Link
                    href={`/sales/${sale.id}/receipt`}
                    className="inline-flex rounded-full border border-stone-200 bg-white px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-700 transition hover:border-emerald-200 hover:text-emerald-700"
                  >
                    Open receipt
                  </Link>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
            No sales yet.
          </div>
        )}
      </div>
    </Card>
  );
}
