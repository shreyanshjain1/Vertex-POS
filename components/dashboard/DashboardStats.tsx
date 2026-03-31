'use client';

import { motion } from 'framer-motion';
import Card from '@/components/ui/Card';

type Props = {
  totalProducts: number;
  lowStockCount: number;
  pendingPurchases: number;
  todaySales: string;
  todaySaleCount: number;
  stockCoverage: number;
  showPendingPurchases?: boolean;
};

const items = [
  {
    label: 'Active products',
    helper: 'Sellable catalog items ready for checkout.',
    meta: (stockCoverage: number) => `${stockCoverage}% above reorder point`,
    icon: 'products',
    tone: {
      shell: 'border-emerald-200/80 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(255,255,255,0.95))]',
      icon: 'bg-emerald-100 text-emerald-700',
      pill: 'bg-emerald-100/90 text-emerald-700'
    }
  },
  {
    label: 'Low-stock products',
    helper: 'Items that need replenishment attention.',
    meta: (stockCoverage: number, lowStockCount: number) =>
      lowStockCount === 0 ? 'Restock queue is clear' : `${100 - stockCoverage}% of catalog needs a check`,
    icon: 'alert',
    tone: {
      shell: 'border-amber-200/80 bg-[linear-gradient(135deg,rgba(245,158,11,0.18),rgba(255,255,255,0.95))]',
      icon: 'bg-amber-100 text-amber-700',
      pill: 'bg-amber-100/90 text-amber-700'
    }
  },
  {
    label: 'Pending purchases',
    helper: 'Open purchase orders still moving through procurement.',
    meta: (_stockCoverage: number, _lowStockCount: number, pendingPurchases: number) =>
      pendingPurchases === 0 ? 'Receiving queue is clear' : `${pendingPurchases} open purchase(s)`,
    icon: 'purchases',
    tone: {
      shell: 'border-sky-200/80 bg-[linear-gradient(135deg,rgba(14,165,233,0.16),rgba(255,255,255,0.95))]',
      icon: 'bg-sky-100 text-sky-700',
      pill: 'bg-sky-100/90 text-sky-700'
    }
  },
  {
    label: 'Sales today',
    helper: 'Completed transactions captured today.',
    meta: (_stockCoverage: number, _lowStockCount: number, _pendingPurchases: number, todaySaleCount: number) =>
      `${todaySaleCount} completed sale(s)`,
    icon: 'sales',
    tone: {
      shell: 'border-stone-300/80 bg-[linear-gradient(135deg,rgba(28,25,23,0.10),rgba(255,255,255,0.98))]',
      icon: 'bg-stone-950 text-white',
      pill: 'bg-stone-950 text-white'
    }
  }
] as const;

function StatIcon({ icon }: { icon: 'products' | 'alert' | 'purchases' | 'sales' }) {
  switch (icon) {
    case 'products':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="m12 12 8-4.5" />
          <path d="m12 12-8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );
    case 'alert':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.72 3h16.92a2 2 0 0 0 1.72-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
        </svg>
      );
    case 'purchases':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M7 7h10" />
          <path d="M7 12h10" />
          <path d="M7 17h6" />
          <path d="M5 4h14v16H5z" />
        </svg>
      );
    case 'sales':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
          <path d="M7 4h10v16H7z" />
          <path d="M10 8h4" />
          <path d="M10 12h4" />
          <path d="M10 16h2" />
        </svg>
      );
  }
}

export default function DashboardStats({
  totalProducts,
  lowStockCount,
  pendingPurchases,
  todaySales,
  todaySaleCount,
  stockCoverage,
  showPendingPurchases = true
}: Props) {
  const visibleItems = showPendingPurchases ? items : items.filter((item) => item.label !== 'Pending purchases');
  const values = [String(totalProducts), String(lowStockCount), String(pendingPurchases), todaySales];

  return (
    <div className={`grid gap-4 sm:grid-cols-2 ${showPendingPurchases ? 'xl:grid-cols-4' : 'xl:grid-cols-3'}`}>
      {visibleItems.map((item) => {
        const index = items.findIndex((entry) => entry.label === item.label);

        return (
        <motion.div
          key={item.label}
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, delay: index * 0.05 }}
          whileHover={{ y: -6 }}
        >
          <Card className={`overflow-hidden border ${item.tone.shell}`}>
            <div className="flex items-start justify-between gap-3">
              <div className={`inline-flex h-12 w-12 items-center justify-center rounded-[18px] shadow-[0_16px_28px_-20px_rgba(28,25,23,0.38)] ${item.tone.icon}`}>
                <StatIcon icon={item.icon} />
              </div>
              <div className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] ${item.tone.pill}`}>
                {item.meta(stockCoverage, lowStockCount, pendingPurchases, todaySaleCount)}
              </div>
            </div>

            <div className="mt-7 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-500">{item.label}</div>
            <div className="mt-3 text-3xl font-black tracking-tight text-stone-950">{values[index]}</div>
            <div className="mt-2 text-sm leading-6 text-stone-600">{item.helper}</div>
          </Card>
        </motion.div>
        );
      })}
    </div>
  );
}
