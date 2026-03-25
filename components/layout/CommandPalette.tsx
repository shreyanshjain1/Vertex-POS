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
          className="inline-flex items-center gap-3 rounded-full border border-stone-200 bg-white/90 px-4 py-2.5 text-sm font-semibold text-stone-700 shadow-sm transition hover:border-emerald-200 hover:text-stone-950"
        >
          <span>Quick actions</span>
          <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-500">Ctrl K</span>
        </button>
      </div>

      {open ? (
        <div
          className="fixed inset-0 z-50 bg-stone-950/45 px-4 py-12"
          onClick={() => setOpen(false)}
        >
          <div
            className="mx-auto max-w-2xl rounded-[28px] border border-stone-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-black text-stone-950">Quick actions</h2>
                <p className="mt-1 text-sm text-stone-500">
                  Search for common operational tasks and jump there instantly.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-full border border-stone-200 px-3 py-1.5 text-sm font-semibold text-stone-500 hover:text-stone-900"
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
                    className="flex w-full items-start justify-between gap-4 rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-left transition hover:border-emerald-200 hover:bg-emerald-50"
                  >
                    <div>
                      <div className="font-semibold text-stone-900">{item.label}</div>
                      <div className="mt-1 text-sm text-stone-500">{item.description}</div>
                    </div>
                    <div className="rounded-full bg-white px-3 py-1 text-xs font-semibold text-stone-500">
                      {item.minRole}
                    </div>
                  </button>
                ))
              ) : (
                <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
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
