'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/checkout', label: 'Checkout' },
  { href: '/sales', label: 'Sales' },
  { href: '/products', label: 'Products' },
  { href: '/categories', label: 'Categories' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/suppliers', label: 'Suppliers' },
  { href: '/purchases', label: 'Purchases' },
  { href: '/reports', label: 'Reports' },
  { href: '/settings', label: 'Settings' }
];

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-full border-b border-stone-200 bg-white px-4 py-4 md:min-h-screen md:w-72 md:border-b-0 md:border-r">
      <div className="mb-6">
        <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-600">Vertex POS</div>
        <div className="mt-2 text-xl font-black text-stone-900">Operations Suite</div>
      </div>

      <nav className="grid gap-2">
        {links.map((link) => {
          const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`rounded-2xl px-4 py-3 text-sm font-medium transition ${active ? 'bg-emerald-50 text-emerald-700' : 'text-stone-700 hover:bg-stone-100'}`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        className="mt-8 inline-flex w-full items-center justify-center rounded-xl border border-stone-300 bg-white px-4 py-2.5 text-sm font-semibold text-stone-900 transition hover:bg-stone-50"
      >
        Sign out
      </button>
    </aside>
  );
}
