'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';

type StockCountSummary = {
  id: string;
  referenceNumber: string;
  title: string | null;
  status: 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
  isBlind: boolean;
  notes: string | null;
  createdAt: string;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  createdBy: string;
  approvedBy: string | null;
  itemCount: number;
  countedItemCount: number;
};

function toneForStatus(status: StockCountSummary['status']) {
  switch (status) {
    case 'POSTED':
      return 'emerald';
    case 'APPROVED':
      return 'blue';
    case 'SUBMITTED':
      return 'amber';
    case 'CANCELLED':
      return 'red';
    default:
      return 'stone';
  }
}

export default function StockCountsManager({
  stockCounts
}: {
  stockCounts: StockCountSummary[];
}) {
  const router = useRouter();
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [isBlind, setIsBlind] = useState(false);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const filteredCounts = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return stockCounts;
    }

    return stockCounts.filter((count) =>
      [
        count.referenceNumber,
        count.title ?? '',
        count.status,
        count.createdBy,
        count.approvedBy ?? ''
      ]
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [query, stockCounts]);

  const submittedCount = stockCounts.filter((count) => count.status === 'SUBMITTED').length;
  const activeCount = stockCounts.filter((count) => ['DRAFT', 'IN_PROGRESS'].includes(count.status)).length;
  const postedCount = stockCounts.filter((count) => count.status === 'POSTED').length;

  async function createStockCount() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/stock-counts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title,
          notes,
          isBlind
        })
      });
      const data = await response.json().catch(() => ({ error: 'Unable to create stock count.' }));

      setLoading(false);
      if (!response.ok || !data?.stockCount?.id) {
        setError(data?.error ?? 'Unable to create stock count.');
        return;
      }

      router.push(`/stock-counts/${data.stockCount.id}`);
      router.refresh();
    } catch {
      setLoading(false);
      setError('Unable to create stock count.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <Card className="space-y-5">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">New stock count</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Start a formal count sheet</h2>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Create a shop-wide count, capture actuals product by product, then route the variance through approval before it touches inventory.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Active</div>
              <div className="mt-2 text-3xl font-black text-stone-950">{activeCount}</div>
              <div className="mt-1 text-sm text-stone-500">Draft or in progress</div>
            </div>
            <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">Pending approval</div>
              <div className="mt-2 text-3xl font-black text-stone-950">{submittedCount}</div>
              <div className="mt-1 text-sm text-amber-800">Submitted counts</div>
            </div>
            <div className="rounded-[24px] border border-emerald-200 bg-emerald-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-emerald-700">Posted</div>
              <div className="mt-2 text-3xl font-black text-stone-950">{postedCount}</div>
              <div className="mt-1 text-sm text-emerald-800">Variance already posted</div>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              placeholder="Count title or shift label (optional)"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
            />
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              placeholder="Notes for this count (optional)"
              className="min-h-28 w-full rounded-[24px] border border-stone-200 bg-white/88 px-4 py-3 text-sm text-stone-900 outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10"
            />
            <label className="flex items-start gap-3 rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
              <input
                type="checkbox"
                checked={isBlind}
                onChange={(event) => setIsBlind(event.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-stone-300 text-emerald-600 focus:ring-emerald-500"
              />
              <span>
                <span className="block font-semibold text-stone-900">Blind count</span>
                <span className="mt-1 block">Hide expected quantities on the count sheet until the count is submitted for reconciliation.</span>
              </span>
            </label>
          </div>

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}

          <Button type="button" disabled={loading} onClick={() => void createStockCount()}>
            {loading ? 'Creating stock count...' : 'Create stock count'}
          </Button>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Count history</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">Operational stock counts</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Review in-flight counts, approval status, and whether each sheet has already posted its variance into inventory.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <Input
                placeholder="Search reference, title, or user"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
              />
            </div>
          </div>

          <div className="overflow-hidden rounded-[26px] border border-stone-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-stone-50 text-stone-500">
                  <tr>
                    <th className="px-4 py-3.5">Reference</th>
                    <th className="px-4 py-3.5">Status</th>
                    <th className="px-4 py-3.5">Progress</th>
                    <th className="px-4 py-3.5">Users</th>
                    <th className="px-4 py-3.5">Dates</th>
                    <th className="px-4 py-3.5">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCounts.map((count) => (
                    <tr key={count.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{count.referenceNumber}</div>
                        <div className="mt-1 text-sm text-stone-600">{count.title ?? 'Untitled stock count'}</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Badge tone={toneForStatus(count.status)}>{count.status.replaceAll('_', ' ')}</Badge>
                          {count.isBlind ? <Badge tone="stone">Blind</Badge> : null}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{count.notes ?? 'No notes recorded.'}</div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">
                          {count.countedItemCount} / {count.itemCount}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">Products counted</div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{count.createdBy}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {count.approvedBy ? `Approved by ${count.approvedBy}` : 'Approval pending'}
                        </div>
                      </td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>Created {shortDate(count.createdAt)}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {count.postedAt
                            ? `Posted ${dateTime(count.postedAt)}`
                            : count.submittedAt
                              ? `Submitted ${dateTime(count.submittedAt)}`
                              : count.startedAt
                                ? `Started ${dateTime(count.startedAt)}`
                                : 'Not started'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/stock-counts/${count.id}`}
                          className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600"
                        >
                          Open count
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {!filteredCounts.length ? (
              <div className="border-t border-stone-200 bg-stone-50 py-8 text-center text-sm text-stone-500">
                No stock counts match the current search.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
