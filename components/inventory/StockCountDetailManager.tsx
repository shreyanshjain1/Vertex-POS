'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';

type StockCountStatus = 'DRAFT' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'POSTED' | 'CANCELLED';
type ShopRole = 'CASHIER' | 'MANAGER' | 'ADMIN';

type StockCountItem = {
  id: string;
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string | null;
  expectedQty: number;
  actualQty: number | null;
  varianceQty: number;
  note: string | null;
  createdAt: string;
  updatedAt: string;
};

type StockCountDetail = {
  id: string;
  shopId: string;
  createdByUserId: string;
  approvedByUserId: string | null;
  referenceNumber: string;
  title: string | null;
  status: StockCountStatus;
  isBlind: boolean;
  revealBlindQuantities: boolean;
  notes: string | null;
  startedAt: string | null;
  submittedAt: string | null;
  approvedAt: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: {
    id: string;
    name: string | null;
    email: string;
  };
  approvedByUser: {
    id: string;
    name: string | null;
    email: string;
  } | null;
  itemCount: number;
  countedItemCount: number;
  items: StockCountItem[];
};

type DraftLine = {
  actualQty: number | null;
  note: string;
};

function toneForStatus(status: StockCountStatus) {
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

function varianceTone(varianceQty: number) {
  if (varianceQty > 0) {
    return 'text-emerald-700';
  }

  if (varianceQty < 0) {
    return 'text-red-700';
  }

  return 'text-stone-600';
}

function formatVariance(varianceQty: number) {
  if (varianceQty > 0) {
    return `+${varianceQty}`;
  }

  return String(varianceQty);
}

function createDraftLines(items: StockCountItem[]) {
  return Object.fromEntries(
    items.map((item) => [
      item.id,
      {
        actualQty: item.actualQty,
        note: item.note ?? ''
      }
    ])
  ) as Record<string, DraftLine>;
}

export default function StockCountDetailManager({
  initialStockCount,
  currentRole,
  currentUserId
}: {
  initialStockCount: StockCountDetail;
  currentRole: ShopRole;
  currentUserId: string;
}) {
  const router = useRouter();
  const [stockCount, setStockCount] = useState(initialStockCount);
  const [sheetNotes, setSheetNotes] = useState(initialStockCount.notes ?? '');
  const [draftLines, setDraftLines] = useState<Record<string, DraftLine>>(() => createDraftLines(initialStockCount.items));
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loadingAction, setLoadingAction] = useState<'SAVE' | 'SUBMIT' | 'APPROVE' | 'POST' | 'CANCEL' | null>(null);

  const canManageApproval = currentRole === 'MANAGER' || currentRole === 'ADMIN';
  const editable = ['DRAFT', 'IN_PROGRESS'].includes(stockCount.status) && (stockCount.createdByUserId === currentUserId || canManageApproval);
  const canSubmit = editable && stockCount.itemCount > 0;
  const canApprove = stockCount.status === 'SUBMITTED' && canManageApproval;
  const canPost = stockCount.status === 'APPROVED' && canManageApproval && !stockCount.postedAt;
  const canCancel =
    !['POSTED', 'CANCELLED'].includes(stockCount.status) &&
    (stockCount.createdByUserId === currentUserId || canManageApproval);

  const filteredItems = useMemo(() => {
    const term = query.trim().toLowerCase();
    if (!term) {
      return stockCount.items;
    }

    return stockCount.items.filter((item) =>
      [item.productNameSnapshot, item.skuSnapshot ?? ''].join(' ').toLowerCase().includes(term)
    );
  }, [query, stockCount.items]);

  const draftCountedItemCount = useMemo(
    () => stockCount.items.filter((item) => draftLines[item.id]?.actualQty !== null).length,
    [draftLines, stockCount.items]
  );

  const draftVarianceLineCount = useMemo(
    () =>
      stockCount.items.filter((item) => {
        const actualQty = draftLines[item.id]?.actualQty;
        return actualQty !== null && actualQty - item.expectedQty !== 0;
      }).length,
    [draftLines, stockCount.items]
  );

  async function applyResponse(response: Response, fallbackMessage: string) {
    const data = await response.json().catch(() => ({ error: fallbackMessage }));
    if (!response.ok || !data?.stockCount) {
      throw new Error(data?.error ?? fallbackMessage);
    }

    setStockCount(data.stockCount);
    setSheetNotes(data.stockCount.notes ?? '');
    setDraftLines(createDraftLines(data.stockCount.items));
    router.refresh();
  }

  async function saveSheet(showSuccessMessage = true) {
    setLoadingAction('SAVE');
    setError('');
    setSuccess('');

    try {
      const response = await fetch(`/api/stock-counts/${stockCount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'SAVE',
          notes: sheetNotes,
          items: stockCount.items.map((item) => ({
            id: item.id,
            actualQty: draftLines[item.id]?.actualQty ?? null,
            note: draftLines[item.id]?.note ?? ''
          }))
        })
      });

      await applyResponse(response, 'Unable to save stock count.');
      if (showSuccessMessage) {
        setSuccess('Count sheet saved.');
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : 'Unable to save stock count.');
      throw saveError;
    } finally {
      setLoadingAction(null);
    }
  }

  async function runTransition(action: 'SUBMIT' | 'APPROVE' | 'POST' | 'CANCEL') {
    setLoadingAction(action);
    setError('');
    setSuccess('');

    try {
      if (action === 'SUBMIT' && editable) {
        await saveSheet(false);
        setLoadingAction(action);
      }

      const response = await fetch(`/api/stock-counts/${stockCount.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action })
      });

      await applyResponse(response, 'Unable to update stock count.');
      setSuccess(
        action === 'SUBMIT'
          ? 'Stock count submitted for approval.'
          : action === 'APPROVE'
            ? 'Stock count approved.'
            : action === 'POST'
              ? 'Variances posted to inventory.'
              : 'Stock count cancelled.'
      );
    } catch (transitionError) {
      setError(transitionError instanceof Error ? transitionError.message : 'Unable to update stock count.');
    } finally {
      setLoadingAction(null);
    }
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[0.96fr_1.04fr]">
        <Card className="space-y-5">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Stock count</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">{stockCount.referenceNumber}</h2>
              <p className="mt-2 text-sm text-stone-500">
                {stockCount.title ?? 'Untitled stock count'}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Badge tone={toneForStatus(stockCount.status)}>{stockCount.status.replaceAll('_', ' ')}</Badge>
              {stockCount.isBlind ? <Badge tone="stone">Blind</Badge> : null}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Progress</div>
              <div className="mt-2 text-3xl font-black text-stone-950">
                {draftCountedItemCount} / {stockCount.itemCount}
              </div>
              <div className="mt-1 text-sm text-stone-500">Products counted</div>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Variance lines</div>
              <div className="mt-2 text-3xl font-black text-stone-950">
                {stockCount.revealBlindQuantities ? draftVarianceLineCount : 'Hidden'}
              </div>
              <div className="mt-1 text-sm text-stone-500">
                {stockCount.revealBlindQuantities ? 'Lines currently off from expectation' : 'Blind count is still unreconciled'}
              </div>
            </div>
          </div>

          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            <div>Created by <span className="font-semibold text-stone-900">{stockCount.createdByUser.name ?? stockCount.createdByUser.email}</span> on <span className="font-semibold text-stone-900">{dateTime(stockCount.createdAt)}</span></div>
            <div className="mt-2">
              {stockCount.approvedByUser
                ? <>Approved by <span className="font-semibold text-stone-900">{stockCount.approvedByUser.name ?? stockCount.approvedByUser.email}</span> on <span className="font-semibold text-stone-900">{stockCount.approvedAt ? dateTime(stockCount.approvedAt) : 'N/A'}</span></>
                : 'Approval has not been completed yet.'}
            </div>
            <div className="mt-2">
              {stockCount.postedAt
                ? <>Posted to inventory on <span className="font-semibold text-stone-900">{dateTime(stockCount.postedAt)}</span></>
                : stockCount.submittedAt
                  ? <>Submitted on <span className="font-semibold text-stone-900">{dateTime(stockCount.submittedAt)}</span></>
                  : stockCount.startedAt
                    ? <>Started on <span className="font-semibold text-stone-900">{dateTime(stockCount.startedAt)}</span></>
                    : 'Counting has not started yet.'}
            </div>
          </div>

          {stockCount.isBlind && !stockCount.revealBlindQuantities ? (
            <div className="rounded-2xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-900">
              Blind count mode is active. Expected quantities and variances stay hidden until the count is submitted for reconciliation.
            </div>
          ) : null}

          <div className="space-y-3">
            <label className="text-sm font-semibold text-stone-700">Count notes</label>
            <textarea
              value={sheetNotes}
              onChange={(event) => setSheetNotes(event.target.value)}
              readOnly={!editable}
              className={`min-h-28 w-full rounded-[24px] border px-4 py-3 text-sm outline-none transition ${
                editable
                  ? 'border-stone-200 bg-white/88 text-stone-900 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10'
                  : 'border-stone-200 bg-stone-50 text-stone-600'
              }`}
            />
          </div>

          {(error || success) ? (
            <div className="space-y-3">
              {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
              {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">{success}</div> : null}
            </div>
          ) : null}

          <div className="flex flex-wrap gap-3">
            {editable ? (
              <Button
                type="button"
                variant="secondary"
                disabled={loadingAction !== null}
                onClick={() => void saveSheet()}
              >
                {loadingAction === 'SAVE' ? 'Saving...' : 'Save sheet'}
              </Button>
            ) : null}

            {canSubmit ? (
              <Button
                type="button"
                disabled={loadingAction !== null || draftCountedItemCount !== stockCount.itemCount}
                onClick={() => void runTransition('SUBMIT')}
              >
                {loadingAction === 'SUBMIT' ? 'Submitting...' : 'Submit for approval'}
              </Button>
            ) : null}

            {canApprove ? (
              <Button
                type="button"
                disabled={loadingAction !== null}
                onClick={() => void runTransition('APPROVE')}
              >
                {loadingAction === 'APPROVE' ? 'Approving...' : 'Approve count'}
              </Button>
            ) : null}

            {canPost ? (
              <Button
                type="button"
                disabled={loadingAction !== null}
                onClick={() => void runTransition('POST')}
              >
                {loadingAction === 'POST' ? 'Posting...' : 'Post variances'}
              </Button>
            ) : null}

            {canCancel ? (
              <Button
                type="button"
                variant="danger"
                disabled={loadingAction !== null}
                onClick={() => void runTransition('CANCEL')}
              >
                {loadingAction === 'CANCEL' ? 'Cancelling...' : 'Cancel count'}
              </Button>
            ) : null}

            <Link href="/stock-counts">
              <Button type="button" variant="ghost">Back to stock counts</Button>
            </Link>
          </div>
        </Card>

        <Card className="space-y-5">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Count sheet</div>
              <h2 className="mt-2 text-2xl font-black text-stone-950">Per-product count entry</h2>
              <p className="mt-2 text-sm leading-6 text-stone-500">
                Count each product once, add notes where needed, and reconcile only through the approval and posting flow.
              </p>
            </div>
            <div className="w-full max-w-xs">
              <Input
                placeholder="Search product or SKU"
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
                    <th className="px-4 py-3.5">Product</th>
                    <th className="px-4 py-3.5">SKU</th>
                    <th className="px-4 py-3.5">Expected</th>
                    <th className="px-4 py-3.5">Actual</th>
                    <th className="px-4 py-3.5">Variance</th>
                    <th className="px-4 py-3.5">Note</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredItems.map((item) => {
                    const actualQty = draftLines[item.id]?.actualQty ?? null;
                    const varianceQty = actualQty === null ? 0 : actualQty - item.expectedQty;

                    return (
                      <tr key={item.id} className="border-t border-stone-200 bg-white align-top transition hover:bg-stone-50/70">
                        <td className="px-4 py-4">
                          <div className="font-semibold text-stone-900">{item.productNameSnapshot}</div>
                          <div className="mt-1 text-xs text-stone-500">Created {shortDate(item.createdAt)}</div>
                        </td>
                        <td className="px-4 py-4 text-stone-600">{item.skuSnapshot ?? 'N/A'}</td>
                        <td className="px-4 py-4 text-stone-600">
                          {stockCount.revealBlindQuantities ? item.expectedQty : 'Hidden'}
                        </td>
                        <td className="px-4 py-4">
                          {editable ? (
                            <Input
                              type="number"
                              min="0"
                              value={actualQty === null ? '' : String(actualQty)}
                              onChange={(event) =>
                                setDraftLines((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...current[item.id],
                                    actualQty:
                                      event.target.value === ''
                                        ? null
                                        : Math.max(0, Math.trunc(Number(event.target.value) || 0))
                                  }
                                }))
                              }
                            />
                          ) : (
                            <div className="font-semibold text-stone-900">{actualQty ?? 'Not counted'}</div>
                          )}
                        </td>
                        <td className="px-4 py-4">
                          <div className={`font-semibold ${stockCount.revealBlindQuantities ? varianceTone(varianceQty) : 'text-stone-500'}`}>
                            {stockCount.revealBlindQuantities ? formatVariance(varianceQty) : 'Hidden'}
                          </div>
                        </td>
                        <td className="min-w-[220px] px-4 py-4">
                          {editable ? (
                            <Input
                              value={draftLines[item.id]?.note ?? ''}
                              onChange={(event) =>
                                setDraftLines((current) => ({
                                  ...current,
                                  [item.id]: {
                                    ...current[item.id],
                                    note: event.target.value
                                  }
                                }))
                              }
                              placeholder="Optional count note"
                            />
                          ) : (
                            <div className="text-stone-600">{draftLines[item.id]?.note || 'No note'}</div>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {!filteredItems.length ? (
              <div className="border-t border-stone-200 bg-stone-50 py-8 text-center text-sm text-stone-500">
                No count lines match the current search.
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
