'use client';

import Link from 'next/link';
import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, money } from '@/lib/format';
import { SerializedActiveCashSession, SerializedCashSession } from '@/lib/serializers/register';

type SessionForms = Record<string, { closingActual: string; notes: string }>;

export default function RegisterCloseManager({
  initialSessions,
  currencySymbol
}: {
  initialSessions: SerializedActiveCashSession[];
  currencySymbol: string;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [forms, setForms] = useState<SessionForms>(
    Object.fromEntries(
      initialSessions.map((session) => [
        session.id,
        {
          closingActual: session.expectedCash,
          notes: ''
        }
      ])
    )
  );
  const [result, setResult] = useState<SerializedCashSession | null>(null);
  const [error, setError] = useState('');
  const [loadingId, setLoadingId] = useState<string | null>(null);

  function updateForm(sessionId: string, patch: Partial<SessionForms[string]>) {
    setForms((current) => ({
      ...current,
      [sessionId]: {
        ...current[sessionId],
        ...patch
      }
    }));
  }

  async function closeSession(session: SerializedActiveCashSession) {
    const form = forms[session.id];
    setError('');

    if (session.canOverride && !form?.notes.trim()) {
      setError("Add an override note before closing another cashier's register session.");
      return;
    }

    setLoadingId(session.id);

    const response = await fetch(`/api/register/sessions/${session.id}/close`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        closingActual: Number(form.closingActual),
        notes: form.notes || null
      })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to close the register session.' }));
    setLoadingId(null);

    if (!response.ok || !data?.session) {
      setError(data?.error ?? 'Unable to close the register session.');
      return;
    }

    setResult(data.session);
    setSessions((current) => current.filter((entry) => entry.id !== session.id));
  }

  if (!sessions.length) {
    return (
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Close register</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">No active sessions to close</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              There are no open register sessions available for closing right now.
            </p>
          </div>

          <Link href="/register/open">
            <Button>Open a register</Button>
          </Link>
        </div>

        {result ? (
          <div className="mt-6 rounded-[26px] border border-emerald-200 bg-emerald-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Last closed session</div>
            <div className="mt-2 text-lg font-black text-emerald-800">
              {result.cashierName} / Variance {money(result.variance, currencySymbol)}
            </div>
            <div className="mt-1 text-sm text-emerald-700">
              Closed {result.closedAt ? dateTime(result.closedAt) : 'just now'} with expected {money(result.closingExpected, currencySymbol)} and actual {money(result.closingActual, currencySymbol)}.
            </div>
          </div>
        ) : null}
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Drawer closeout</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Close active register sessions</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Count the drawer, enter the actual cash on hand, and the system will calculate expected cash and the variance automatically.
            </p>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            {sessions.length} active session(s) ready for closeout.
          </div>
        </div>

        {error ? (
          <div className="mt-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}
      </Card>

      {sessions.map((session) => {
        const form = forms[session.id];
        return (
          <Card key={session.id}>
            <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge tone={session.canOverride ? 'amber' : 'emerald'}>
                    {session.canOverride ? 'Manager override' : 'Own session'}
                  </Badge>
                  <Badge tone="stone">{session.status}</Badge>
                </div>
                <h3 className="mt-3 text-2xl font-black text-stone-950">{session.cashierName}</h3>
                <p className="mt-1 text-sm text-stone-500">{session.cashierEmail ?? 'Cashier account'}</p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Opened</div>
                  <div className="mt-1 text-sm font-semibold text-stone-900">{dateTime(session.openedAt)}</div>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Opening float</div>
                  <div className="mt-1 text-lg font-black text-stone-950">{money(session.openingFloat, currencySymbol)}</div>
                </div>
                <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Expected cash</div>
                  <div className="mt-1 text-lg font-black text-emerald-700">{money(session.expectedCash, currencySymbol)}</div>
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">Actual counted cash</label>
                <Input
                  type="number"
                  min="0"
                  step="0.01"
                  value={form?.closingActual ?? ''}
                  onChange={(event) => updateForm(session.id, { closingActual: event.target.value })}
                  required
                />
              </div>
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">Closeout notes</label>
                <Input
                  value={form?.notes ?? ''}
                  onChange={(event) => updateForm(session.id, { notes: event.target.value })}
                  placeholder={session.canOverride ? 'Reason for override close' : 'Optional drawer notes'}
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button
                type="button"
                disabled={loadingId === session.id}
                onClick={() => void closeSession(session)}
              >
                {loadingId === session.id
                  ? 'Closing register...'
                  : session.canOverride
                    ? 'Override close register'
                    : 'Close register'}
              </Button>
              <Link href="/register/history">
                <Button type="button" variant="secondary">View history</Button>
              </Link>
            </div>
          </Card>
        );
      })}
    </div>
  );
}
