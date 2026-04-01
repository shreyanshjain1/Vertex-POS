'use client';

import Link from 'next/link';
import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { getRegisterSessionStatusLabel } from '@/lib/business-labels';
import { dateTime, money, shortDate } from '@/lib/format';
import { SerializedCashSession } from '@/lib/serializers/register';

function statusTone(status: SerializedCashSession['status']) {
  if (status === 'OPEN') {
    return 'blue';
  }

  if (status === 'OVERRIDE_CLOSED') {
    return 'amber';
  }

  return 'emerald';
}

function varianceTone(variance: string | null) {
  const amount = Number(variance ?? 0);
  if (amount > 0) {
    return 'emerald';
  }

  if (amount < 0) {
    return 'red';
  }

  return 'stone';
}

export default function RegisterHistoryTable({
  sessions: initialSessions,
  currencySymbol,
  canManageSessions
}: {
  sessions: SerializedCashSession[];
  currencySymbol: string;
  canManageSessions: boolean;
}) {
  const [sessions, setSessions] = useState(initialSessions);
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [error, setError] = useState('');

  const closedSessions = sessions.filter((session) => session.status !== 'OPEN');
  const openSessions = sessions.length - closedSessions.length;
  const totalVariance = closedSessions.reduce((sum, session) => sum + Number(session.variance ?? 0), 0);

  async function reviewSession(session: SerializedCashSession) {
    const reviewNote = window.prompt(
      'Optional manager review note',
      session.reviewNote ?? ''
    );

    if (reviewNote === null) {
      return;
    }

    setError('');
    setLoadingId(session.id);

    const response = await fetch(`/api/register/sessions/${session.id}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reviewNote: reviewNote || null })
    });
    const data = await response.json().catch(() => ({ error: 'Unable to review register session.' }));
    setLoadingId(null);

    if (!response.ok || !data?.session) {
      setError(data?.error ?? 'Unable to review register session.');
      return;
    }

    setSessions((current) =>
      current.map((entry) => (entry.id === session.id ? data.session : entry))
    );
  }

  async function reopenSession(session: SerializedCashSession) {
    const reason = window.prompt('Reason for reopening this closed shift');

    if (!reason) {
      return;
    }

    setError('');
    setLoadingId(session.id);

    const response = await fetch(`/api/register/sessions/${session.id}/reopen`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await response.json().catch(() => ({ error: 'Unable to reopen register session.' }));
    setLoadingId(null);

    if (!response.ok || !data?.session) {
      setError(data?.error ?? 'Unable to reopen register session.');
      return;
    }

    setSessions((current) =>
      current.map((entry) => (entry.id === session.id ? data.session : entry))
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Register history</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Session timeline</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Review past register openings and closeouts, including cash expectations, counted cash, manager approval, reopen actions, and over or short variances.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Sessions</div>
              <div className="mt-1 text-2xl font-black text-stone-950">{sessions.length}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Open</div>
              <div className="mt-1 text-2xl font-black text-sky-700">{openSessions}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Net variance</div>
              <div className={`mt-1 text-2xl font-black ${totalVariance > 0 ? 'text-emerald-700' : totalVariance < 0 ? 'text-red-700' : 'text-stone-950'}`}>
                {money(totalVariance, currencySymbol)}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <Card>
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">Cashier</th>
                  <th className="px-4 py-3.5">Opened</th>
                  <th className="px-4 py-3.5">Closed</th>
                  <th className="px-4 py-3.5">Float</th>
                  <th className="px-4 py-3.5">Expected</th>
                  <th className="px-4 py-3.5">Actual</th>
                  <th className="px-4 py-3.5">Variance</th>
                  <th className="px-4 py-3.5">Review</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-t border-stone-200 bg-white align-top">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-stone-900">{session.cashierName}</div>
                      <div className="mt-1 text-xs text-stone-500">{session.cashierEmail ?? 'Cashier account'}</div>
                      {session.reopenedAt ? (
                        <div className="mt-2 text-xs text-amber-700">
                          Reopened {dateTime(session.reopenedAt)}
                          {session.reopenedByName ? ` by ${session.reopenedByName}` : ''}
                        </div>
                      ) : null}
                    </td>
                    <td className="px-4 py-4 text-stone-600">{dateTime(session.openedAt)}</td>
                    <td className="px-4 py-4 text-stone-600">
                      {session.closedAt ? (
                        <>
                          <div>{dateTime(session.closedAt)}</div>
                          {session.closedByName ? <div className="mt-1 text-xs text-stone-500">By {session.closedByName}</div> : null}
                        </>
                      ) : 'Still open'}
                    </td>
                    <td className="px-4 py-4 font-semibold text-stone-900">{money(session.openingFloat, currencySymbol)}</td>
                    <td className="px-4 py-4 text-stone-700">{session.closingExpected ? money(session.closingExpected, currencySymbol) : 'Awaiting closeout'}</td>
                    <td className="px-4 py-4 text-stone-700">{session.closingActual ? money(session.closingActual, currencySymbol) : 'Awaiting count'}</td>
                    <td className="px-4 py-4">
                      <Badge tone={varianceTone(session.variance)}>
                        {session.variance ? money(session.variance, currencySymbol) : 'Awaiting closeout'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      {session.reviewedAt ? (
                        <div className="text-xs text-stone-600">
                          <div className="font-semibold text-emerald-700">Approved</div>
                          <div>{dateTime(session.reviewedAt)}</div>
                          {session.reviewedByName ? <div>By {session.reviewedByName}</div> : null}
                        </div>
                      ) : (
                        <span className="text-xs text-stone-500">Pending review</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={statusTone(session.status)}>{getRegisterSessionStatusLabel(session.status)}</Badge>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex min-w-[220px] flex-col gap-2">
                        <Link href={`/print/register-z-read/${session.id}`} className="inline-flex">
                          <Button type="button" variant="secondary" className="w-full justify-center">
                            Z-read
                          </Button>
                        </Link>
                        {canManageSessions && session.status !== 'OPEN' ? (
                          <Button
                            type="button"
                            disabled={loadingId === session.id}
                            onClick={() => void reviewSession(session)}
                          >
                            {loadingId === session.id ? 'Saving...' : session.reviewedAt ? 'Update review' : 'Approve'}
                          </Button>
                        ) : null}
                        {canManageSessions && session.status !== 'OPEN' ? (
                          <Button
                            type="button"
                            variant="secondary"
                            disabled={loadingId === session.id}
                            onClick={() => void reopenSession(session)}
                          >
                            Reopen shift
                          </Button>
                        ) : null}
                        {session.status === 'OPEN' ? (
                          <Link href="/register/close" className="inline-flex">
                            <Button type="button" className="w-full justify-center">Go to closeout</Button>
                          </Link>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!sessions.length ? (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
              No register sessions have been recorded yet.
            </div>
          ) : null}
        </div>

        {sessions.some((session) => session.notes || session.reviewNote || session.reopenReason) ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {sessions
              .filter((session) => session.notes || session.reviewNote || session.reopenReason)
              .slice(0, 8)
              .map((session) => (
                <div key={session.id} className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-stone-900">{session.cashierName}</div>
                    <div className="text-xs text-stone-500">{shortDate(session.openedAt)}</div>
                  </div>
                  {session.notes ? <div className="mt-2 text-sm leading-6 text-stone-600">{session.notes}</div> : null}
                  {session.reviewNote ? <div className="mt-3 rounded-[18px] border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">Manager review: {session.reviewNote}</div> : null}
                  {session.reopenReason ? <div className="mt-3 rounded-[18px] border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">Reopen reason: {session.reopenReason}</div> : null}
                </div>
              ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
