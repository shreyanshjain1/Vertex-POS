'use client';

import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { signOut } from 'next-auth/react';
import { useState } from 'react';

type SidebarProps = {
  shopName: string;
  shopType: string;
};

type IconName =
  | 'dashboard'
  | 'checkout'
  | 'sales'
  | 'products'
  | 'categories'
  | 'inventory'
  | 'suppliers'
  | 'purchases'
  | 'reports'
  | 'settings';

type NavLink = {
  href: string;
  label: string;
  description: string;
  icon: IconName;
};

const sections: Array<{ title: string; links: NavLink[] }> = [
  {
    title: 'Overview',
    links: [
      { href: '/dashboard', label: 'Dashboard', description: 'Live business pulse and attention points.', icon: 'dashboard' },
      { href: '/reports', label: 'Reports', description: 'Revenue, trends, and product performance.', icon: 'reports' }
    ]
  },
  {
    title: 'Operations',
    links: [
      { href: '/checkout', label: 'Checkout', description: 'Start a sale and issue receipts quickly.', icon: 'checkout' },
      { href: '/sales', label: 'Sales', description: 'Review completed transactions and receipts.', icon: 'sales' },
      { href: '/inventory', label: 'Inventory', description: 'Track stock levels and adjustments.', icon: 'inventory' },
      { href: '/purchases', label: 'Purchases', description: 'Handle supplier orders and receiving.', icon: 'purchases' }
    ]
  },
  {
    title: 'Catalog',
    links: [
      { href: '/products', label: 'Products', description: 'Manage sellable items and pricing.', icon: 'products' },
      { href: '/categories', label: 'Categories', description: 'Keep the catalog organized cleanly.', icon: 'categories' },
      { href: '/suppliers', label: 'Suppliers', description: 'Maintain vendor relationships and details.', icon: 'suppliers' }
    ]
  },
  {
    title: 'Workspace',
    links: [
      { href: '/settings', label: 'Settings', description: 'Shop rules, tax, receipts, and defaults.', icon: 'settings' }
    ]
  }
];

function formatShopType(shopType: string) {
  return shopType
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function SidebarIcon({ name, active = false }: { name: IconName; active?: boolean }) {
  const common = 'h-[18px] w-[18px]';
  const color = active ? 'text-emerald-700' : 'text-stone-500';

  switch (name) {
    case 'dashboard':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="M4 13h7V4H4z" />
          <path d="M13 20h7v-9h-7z" />
          <path d="M13 11h7V4h-7z" />
          <path d="M4 20h7v-5H4z" />
        </svg>
      );
    case 'checkout':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="M6 4h12l1 5H5z" />
          <path d="M7 9v10h10V9" />
          <path d="M10 13h4" />
        </svg>
      );
    case 'sales':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="M7 4h10v16H7z" />
          <path d="M10 8h4" />
          <path d="M10 12h4" />
          <path d="M10 16h2" />
        </svg>
      );
    case 'products':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="m12 3 8 4.5v9L12 21l-8-4.5v-9z" />
          <path d="m12 12 8-4.5" />
          <path d="m12 12-8-4.5" />
          <path d="M12 12v9" />
        </svg>
      );
    case 'categories':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="M4 7h7v5H4z" />
          <path d="M13 7h7v5h-7z" />
          <path d="M4 14h7v5H4z" />
          <path d="M13 14h7v5h-7z" />
        </svg>
      );
    case 'inventory':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="M4 7h16" />
          <path d="M7 7V4h10v3" />
          <path d="M5 7h14v12H5z" />
          <path d="M9 12h6" />
        </svg>
      );
    case 'suppliers':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="M4 18v-5a4 4 0 0 1 4-4h8a4 4 0 0 1 4 4v5" />
          <path d="M12 9a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
        </svg>
      );
    case 'purchases':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="M7 7h10" />
          <path d="M7 12h10" />
          <path d="M7 17h6" />
          <path d="M5 4h14v16H5z" />
        </svg>
      );
    case 'reports':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="M5 19V5" />
          <path d="M19 19H5" />
          <path d="m8 15 3-4 3 2 3-5" />
        </svg>
      );
    case 'settings':
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className={`${common} ${color}`}>
          <path d="M12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
          <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a2 2 0 0 1-2.8 2.8l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a2 2 0 0 1-4 0v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a2 2 0 0 1-2.8-2.8l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4a2 2 0 0 1 0-4h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a2 2 0 0 1 2.8-2.8l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4a2 2 0 0 1 4 0v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a2 2 0 0 1 2.8 2.8l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6H20a2 2 0 0 1 0 4h-.2a1 1 0 0 0-.4 1.9" />
        </svg>
      );
  }
}

export default function AppSidebar({ shopName, shopType }: SidebarProps) {
  const pathname = usePathname();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const shopTypeLabel = formatShopType(shopType);
  const activeLink = sections
    .flatMap((section) => section.links)
    .find((link) => pathname === link.href || pathname.startsWith(`${link.href}/`));

  const sidebarContent = (
    <div className="flex h-full flex-col gap-4 p-4">
      <div className="rounded-[30px] border border-white/80 bg-white/80 p-4 shadow-[0_18px_40px_-28px_rgba(28,25,23,0.35)] backdrop-blur">
        <div className="flex items-start justify-between gap-3">
          <div className={`min-w-0 ${isCollapsed ? 'w-full text-center' : ''}`}>
            <div className={`inline-flex h-12 w-12 items-center justify-center rounded-2xl bg-stone-950 text-base font-black text-white shadow-lg shadow-emerald-500/20 ${isCollapsed ? 'mx-auto' : ''}`}>
              V
            </div>
            {!isCollapsed ? (
              <>
                <div className="mt-4 text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Vertex POS</div>
                <div className="mt-1 truncate text-xl font-black text-stone-950">{shopName}</div>
                <div className="mt-2 inline-flex rounded-full bg-stone-100 px-3 py-1 text-xs font-semibold text-stone-600">
                  {shopTypeLabel}
                </div>
              </>
            ) : null}
          </div>

          <button
            type="button"
            onClick={() => setIsCollapsed((value) => !value)}
            className="hidden h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-900 lg:inline-flex"
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              {isCollapsed ? <path d="m9 6 6 6-6 6" /> : <path d="m15 6-6 6 6 6" />}
            </svg>
          </button>
        </div>
      </div>

      {!isCollapsed ? (
        <div className="rounded-[28px] border border-emerald-100 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(14,165,233,0.08))] p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Current focus</div>
          <div className="mt-2 text-lg font-black text-stone-950">{activeLink?.label ?? 'Workspace'}</div>
          <p className="mt-2 text-sm leading-6 text-stone-600">
            {activeLink?.description ?? 'Move between sales, catalog, and back-office work without losing context.'}
          </p>
        </div>
      ) : null}

      <nav className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
        {sections.map((section) => (
          <div key={section.title}>
            {!isCollapsed ? (
              <div className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-stone-400">{section.title}</div>
            ) : null}

            <div className="space-y-2">
              {section.links.map((link) => {
                const active = pathname === link.href || pathname.startsWith(`${link.href}/`);
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    onClick={() => setIsMobileOpen(false)}
                    title={isCollapsed ? link.label : undefined}
                    className={`group flex items-center gap-3 rounded-[26px] border px-3 py-3 transition duration-200 ${
                      active
                        ? 'border-emerald-200 bg-emerald-500/10 text-stone-950 shadow-[0_14px_32px_-24px_rgba(5,150,105,0.7)]'
                        : 'border-transparent text-stone-600 hover:border-stone-200 hover:bg-white/75 hover:text-stone-950'
                    } ${isCollapsed ? 'justify-center px-2' : ''}`}
                  >
                    <div
                      className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl transition ${
                        active ? 'bg-white shadow-sm shadow-emerald-500/10' : 'bg-stone-100 group-hover:bg-white'
                      }`}
                    >
                      <SidebarIcon name={link.icon} active={active} />
                    </div>

                    {!isCollapsed ? (
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-sm font-semibold">{link.label}</div>
                        <div className="mt-0.5 truncate text-xs text-stone-500">{link.description}</div>
                      </div>
                    ) : null}

                    {!isCollapsed ? (
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        className={`h-4 w-4 shrink-0 transition ${active ? 'text-emerald-700' : 'text-stone-300 group-hover:text-stone-500'}`}
                      >
                        <path d="m9 6 6 6-6 6" />
                      </svg>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </nav>

      {!isCollapsed ? (
        <div className="rounded-[28px] border border-stone-200/80 bg-white/80 p-4">
          <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Quick jump</div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {[
              { href: '/checkout', label: 'Checkout' },
              { href: '/products', label: 'Products' },
              { href: '/reports', label: 'Reports' }
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsMobileOpen(false)}
                className="rounded-2xl border border-stone-200 bg-stone-50 px-3 py-2 text-center text-xs font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-white hover:text-stone-950"
              >
                {item.label}
              </Link>
            ))}
          </div>
        </div>
      ) : null}

      <button
        type="button"
        onClick={() => signOut({ callbackUrl: '/login' })}
        aria-label="Sign out"
        className={`inline-flex items-center justify-center rounded-[22px] border border-stone-300 bg-white px-4 py-3 text-sm font-semibold text-stone-900 transition hover:border-stone-400 hover:bg-stone-50 ${isCollapsed ? 'px-0' : ''}`}
      >
        {isCollapsed ? (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
            <path d="M15 3h4v18h-4" />
            <path d="m10 17 5-5-5-5" />
            <path d="M15 12H5" />
          </svg>
        ) : (
          'Sign out'
        )}
      </button>
    </div>
  );

  return (
    <>
      <div className="border-b border-white/70 bg-white/75 px-4 py-3 backdrop-blur lg:hidden">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Vertex POS</div>
            <div className="truncate text-lg font-black text-stone-950">{shopName}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              setIsCollapsed(false);
              setIsMobileOpen(true);
            }}
            className="inline-flex h-11 w-11 items-center justify-center rounded-2xl border border-stone-200 bg-white text-stone-700 shadow-sm"
            aria-label="Open sidebar"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5">
              <path d="M4 7h16" />
              <path d="M4 12h16" />
              <path d="M4 17h16" />
            </svg>
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isMobileOpen ? (
          <motion.div
            className="fixed inset-0 z-50 bg-stone-950/45 lg:hidden"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileOpen(false)}
          >
            <motion.aside
              className="h-full w-[88vw] max-w-sm border-r border-white/70 bg-[linear-gradient(180deg,rgba(249,250,251,0.98),rgba(244,244,240,0.96))] shadow-2xl"
              initial={{ x: -28, opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: -24, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 240, damping: 28 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex h-full flex-col">{sidebarContent}</div>
            </motion.aside>
          </motion.div>
        ) : null}
      </AnimatePresence>

      <aside
        className={`hidden border-r border-white/80 bg-[linear-gradient(180deg,rgba(249,250,251,0.92),rgba(244,244,240,0.88))] backdrop-blur lg:sticky lg:top-0 lg:flex lg:h-screen lg:shrink-0 lg:transition-[width] lg:duration-300 ${
          isCollapsed ? 'lg:w-28' : 'lg:w-[320px]'
        }`}
      >
        <div className="flex h-full w-full flex-col">{sidebarContent}</div>
      </aside>
    </>
  );
}
