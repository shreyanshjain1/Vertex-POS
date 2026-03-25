'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money } from '@/lib/format';
import { SerializedCashSession } from '@/lib/serializers/register';

export default function RegisterOpenForm({
  currencySymbol,
  activeSession
}: {
  currencySymbol: string;
  activeSession: SerializedCashSession | null;
}) {
  const [openingFloat, setOpeningFloat] = useState('0.00');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function openRegister(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/register/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        openingFloat: Number(openingFloat),
        notes: notes || null
      })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to open the register.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? 'Unable to open the register.');
      return;
    }

    window.location.href = '/register/close';
  }

  if (activeSession) {
    return (
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Register already open</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Current drawer is active</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              You already have an active register session, so a second one can&apos;t be opened for this shop.
            </p>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            Opened {dateTime(activeSession.openedAt)}
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Opening float</div>
            <div className="mt-2 text-2xl font-black text-stone-950">
              {money(activeSession.openingFloat, currencySymbol)}
            </div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Status</div>
            <div className="mt-2 text-2xl font-black text-emerald-700">{activeSession.status}</div>
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Notes</div>
            <div className="mt-2 text-sm leading-6 text-stone-600">{activeSession.notes ?? 'No opening notes.'}</div>
          </div>
        </div>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link href="/register/close">
            <Button>Go to close register</Button>
          </Link>
          <Link href="/register/history">
            <Button variant="secondary">View register history</Button>
          </Link>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Open register</div>
          <h2 className="mt-2 text-2xl font-black text-stone-950">Start a drawer session</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Opening the register records the starting cash float and begins the cashier&apos;s active drawer session for this shop.
          </p>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
          One cashier can only have one active register session in a shop at a time.
        </div>
      </div>

      <form onSubmit={openRegister} className="mt-6 space-y-6">
        <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Opening details</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Opening float</label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={openingFloat}
                onChange={(event) => setOpeningFloat(event.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-700">Notes</label>
              <Input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Optional opening notes"
              />
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={loading}>
            {loading ? 'Opening register...' : 'Open register'}
          </Button>
          <Link href="/register/history">
            <Button type="button" variant="secondary">View history</Button>
          </Link>
        </div>
      </form>
    </Card>
  );
}
