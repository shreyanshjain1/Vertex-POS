'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { money } from '@/lib/format';
import type { SerializedLowStockProduct } from '@/lib/serializers/dashboard';

export default function LowStockCard({
  products,
  currencySymbol
}: {
  products: SerializedLowStockProduct[];
  currencySymbol: string;
}) {
  return (
    <Card className="overflow-hidden border-stone-200/80 bg-white/95">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-amber-700">Restock queue</div>
          <h2 className="mt-2 text-2xl font-black text-stone-900">Low-stock watch</h2>
          <p className="mt-1 text-sm text-stone-500">Products that are approaching or already below their reorder threshold.</p>
        </div>
        <Link
          href="/inventory"
          className="inline-flex rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-700 transition hover:bg-amber-100"
        >
          Inventory
        </Link>
      </div>

      <div className="space-y-3">
        {products.length ? (
          products.map((product, index) => {
            const isCritical = product.stockQty <= Math.max(1, Math.floor(product.reorderPoint / 2));
            const fill = Math.max(0, Math.min(100, Math.round((product.stockQty / Math.max(product.reorderPoint, 1)) * 100)));

            return (
              <motion.div
                key={product.id}
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.24, delay: index * 0.04 }}
                whileHover={{ y: -4 }}
              >
                <div
                  className={`rounded-[28px] border p-4 shadow-[0_18px_36px_-28px_rgba(28,25,23,0.42)] ${
                    isCritical
                      ? 'border-red-200 bg-[linear-gradient(180deg,rgba(254,242,242,0.98),rgba(255,255,255,0.94))]'
                      : 'border-amber-200 bg-[linear-gradient(180deg,rgba(255,251,235,0.98),rgba(255,255,255,0.94))]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate text-lg font-black text-stone-900">{product.name}</div>
                      <div className="mt-1 text-sm text-stone-500">{product.category?.name ?? 'Uncategorized'}</div>
                    </div>
                    <Badge tone={isCritical ? 'red' : 'amber'}>{isCritical ? 'Critical' : 'Watch'}</Badge>
                  </div>

                  <div className="mt-4 rounded-[22px] bg-white/86 p-3">
                    <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                      <span>On hand {product.stockQty}</span>
                      <span>Reorder point {product.reorderPoint}</span>
                    </div>
                    <div className="mt-3 h-2.5 rounded-full bg-stone-200">
                      <div
                        className={`h-full rounded-full ${isCritical ? 'bg-red-500' : 'bg-amber-500'}`}
                        style={{ width: `${fill}%` }}
                      />
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3 text-sm text-stone-600">
                    <span>{product.stockQty} unit(s) left before replenishment.</span>
                    <span className="font-semibold text-stone-900">{money(product.price, currencySymbol)}</span>
                  </div>
                </div>
              </motion.div>
            );
          })
        ) : (
          <div className="rounded-[28px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
            No low-stock products right now.
          </div>
        )}
      </div>
    </Card>
  );
}
