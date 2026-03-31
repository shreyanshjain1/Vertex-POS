'use client';

import { ShopRole } from '@prisma/client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';

type QuickAction = {
  id: string;
  label: string;
  description: string;
  minRole: ShopRole;
  href?: string;
  action?: () => void;
};

const ROLE_WEIGHT: Record<ShopRole, number> = {
  CASHIER: 1,
  MANAGER: 2,
  ADMIN: 3
};

export default function CommandPalette({ role }: { role: ShopRole }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  const actions = useMemo<QuickAction[]>(
    () => [
      {
        id: 'new-sale',
        label: 'New sale',
        description: 'Open checkout and start a transaction.',
        minRole: 'CASHIER',
        href: '/checkout'
      },
      {
        id: 'open-register',
        label: 'Open register',
        description: 'Start a cashier drawer session with an opening float.',
        minRole: 'CASHIER',
        href: '/register/open'
      },
      {
        id: 'close-register',
        label: 'Close register',
        description: 'Count the drawer and close an active cash session.',
        minRole: 'CASHIER',
        href: '/register/close'
      },
      {
        id: 'register-history',
        label: 'Register history',
        description: 'Review previous drawer sessions and variances.',
        minRole: 'CASHIER',
        href: '/register/history'
      },
      {
        id: 'add-product',
        label: 'Add product',
        description: 'Open the catalog manager to add a product.',
        minRole: 'MANAGER',
        href: '/products#new-product'
      },
      {
        id: 'add-supplier',
        label: 'Add supplier',
        description: 'Create or update a supplier record.',
        minRole: 'MANAGER',
        href: '/suppliers#new-supplier'
      },
      {
        id: 'record-purchase',
        label: 'Record purchase',
        description: 'Create a purchase order or receive stock.',
        minRole: 'MANAGER',
        href: '/purchases#record-purchase'
      },
      {
        id: 'branch-transfer',
        label: 'Branch transfer',
        description: 'Create or receive stock transfers between branches.',
        minRole: 'MANAGER',
        href: '/transfers'
      },
      {
        id: 'inventory-adjustment',
        label: 'Inventory adjustment',
        description: 'Increase or decrease stock with an audit trail.',
        minRole: 'MANAGER',
        href: '/inventory#adjust-stock'
      },
      {
        id: 'activity-log',
        label: 'Activity log',
        description: 'Review recent actions across the shop.',
        minRole: 'MANAGER',
        href: '/activity'
      },
      {
        id: 'staff',
        label: 'Manage staff',
        description: 'Open employee access, role, and login controls.',
        minRole: 'ADMIN',
        href: '/staff'
      },
      {
        id: 'export-inventory',
        label: 'Export inventory CSV',
        description: 'Download the current catalog stock snapshot.',
        minRole: 'MANAGER',
        action: () => {
          window.location.assign('/api/inventory/export');
        }
      }
    ],
    []
  );

  const visibleActions = actions.filter((item) => ROLE_WEIGHT[role] >= ROLE_WEIGHT[item.minRole]);
  const filteredActions = visibleActions.filter((item) =>
    [item.label, item.description].join(' ').toLowerCase().includes(query.trim().toLowerCase())
  );

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }

      if (event.key === 'Escape') {
        setOpen(false);
      }
    }

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  function runAction(action: QuickAction) {
    setOpen(false);
    setQuery('');

    if (action.action) {
      action.action();
      return;
    }

    if (action.href) {
      router.push(action.href);
    }
  }

  return (
    <>
      <div className="mb-6 flex items-center justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-3 rounded-full border border-white/80 bg-white/82 px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-[0_18px_36px_-28px_rgba(28,25,23,0.35)] backdrop-blur transition hover:-translate-y-0.5 hover:border-emerald-200 hover:text-stone-950"
        >
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-4 w-4">
              <path d="M10 6H6a2 2 0 0 0-2 2v10h10a2 2 0 0 0 2-2v-4" />
              <path d="M14 4h6v6" />
              <path d="m20 4-9 9" />
            </svg>
          </span>
          <span>Quick actions</span>
          <span className="rounded-full border border-stone-200 bg-white px-2.5 py-1 text-[11px] uppercase tracking-[0.18em] text-stone-500">
            Ctrl K
          </span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-stone-950/45 px-4 py-12"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto max-w-2xl rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(248,250,252,0.96))] p-5 shadow-[0_40px_120px_-48px_rgba(28,25,23,0.55)] backdrop-blur"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Launcher</div>
                <h2 className="mt-2 text-2xl font-black text-stone-950">Quick actions</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Search for common operational tasks and jump there instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-stone-200 bg-white px-3 py-1.5 text-sm font-semibold text-stone-500 hover:text-stone-900"
              >
                Esc
              </button>
            </div>

            <Input
              autoFocus
              placeholder="Search actions like sale, product, supplier, inventory..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />

            <div className="mt-4 space-y-2">
              {filteredActions.length ? (
                filteredActions.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => runAction(item)}
                    className="flex w-full items-start justify-between gap-4 rounded-[24px] border border-stone-200 bg-[linear-gradient(180deg,rgba(250,250,249,0.98),rgba(245,245,244,0.88))] px-4 py-3.5 text-left transition hover:-translate-y-0.5 hover:border-emerald-200 hover:bg-[linear-gradient(180deg,rgba(236,253,245,0.96),rgba(255,255,255,0.96))]"
                  >
                    <div>
                      <div className="font-semibold text-stone-900">{item.label}</div>
                      <div className="mt-1 text-sm text-stone-500">{item.description}</div>
                    </div>
                    <div className="rounded-full border border-stone-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-500">
                      {item.minRole}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
                  No quick actions matched that search.
                </div>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
