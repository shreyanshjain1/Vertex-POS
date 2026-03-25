import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
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
  sessions,
  currencySymbol
}: {
  sessions: SerializedCashSession[];
  currencySymbol: string;
}) {
  const closedSessions = sessions.filter((session) => session.status !== 'OPEN');
  const openSessions = sessions.length - closedSessions.length;
  const totalVariance = closedSessions.reduce((sum, session) => sum + Number(session.variance ?? 0), 0);

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Register history</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Session timeline</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Review past register openings and closeouts, including cash expectations, counted cash, and over or short variances.
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
                  <th className="px-4 py-3.5">Status</th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((session) => (
                  <tr key={session.id} className="border-t border-stone-200 bg-white">
                    <td className="px-4 py-4">
                      <div className="font-semibold text-stone-900">{session.cashierName}</div>
                      <div className="mt-1 text-xs text-stone-500">{session.cashierEmail ?? 'Cashier account'}</div>
                    </td>
                    <td className="px-4 py-4 text-stone-600">{dateTime(session.openedAt)}</td>
                    <td className="px-4 py-4 text-stone-600">{session.closedAt ? dateTime(session.closedAt) : 'Still open'}</td>
                    <td className="px-4 py-4 font-semibold text-stone-900">{money(session.openingFloat, currencySymbol)}</td>
                    <td className="px-4 py-4 text-stone-700">{session.closingExpected ? money(session.closingExpected, currencySymbol) : 'Pending'}</td>
                    <td className="px-4 py-4 text-stone-700">{session.closingActual ? money(session.closingActual, currencySymbol) : 'Pending'}</td>
                    <td className="px-4 py-4">
                      <Badge tone={varianceTone(session.variance)}>
                        {session.variance ? money(session.variance, currencySymbol) : 'Pending'}
                      </Badge>
                    </td>
                    <td className="px-4 py-4">
                      <Badge tone={statusTone(session.status)}>{session.status.replaceAll('_', ' ')}</Badge>
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

        {sessions.some((session) => session.notes) ? (
          <div className="mt-6 grid gap-3 md:grid-cols-2">
            {sessions
              .filter((session) => session.notes)
              .slice(0, 6)
              .map((session) => (
                <div key={session.id} className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="font-semibold text-stone-900">{session.cashierName}</div>
                    <div className="text-xs text-stone-500">{shortDate(session.openedAt)}</div>
                  </div>
                  <div className="mt-2 text-sm leading-6 text-stone-600">{session.notes}</div>
                </div>
              ))}
          </div>
        ) : null}
      </Card>
    </div>
  );
}
