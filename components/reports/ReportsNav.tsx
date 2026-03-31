'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
  { href: '/reports', label: 'Overview' },
  { href: '/reports/sales', label: 'Sales' },
  { href: '/reports/inventory', label: 'Inventory' },
  { href: '/reports/profit', label: 'Profit' },
  { href: '/reports/cashier', label: 'Cashier' }
] as const;

export default function ReportsNav() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => {
        const active = pathname === link.href;

        return (
          <Link
            key={link.href}
            href={link.href}
            className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
              active
                ? 'border-emerald-600 bg-emerald-600 text-white'
                : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
            }`}
          >
            {link.label}
          </Link>
        );
      })}
    </div>
  );
}
