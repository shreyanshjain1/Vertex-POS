import Link from 'next/link';
import { getOwnerAnalyticsData } from '@/lib/owner-analytics';
import { money } from '@/lib/format';
import Card from '@/components/ui/Card';

type OwnerAnalytics = Awaited<ReturnType<typeof getOwnerAnalyticsData>>;

function percent(value: number) {
  return `${value.toFixed(1)}%`;
}

function heatColor(intensity: number) {
  if (intensity >= 0.85) return 'bg-emerald-700 text-white';
  if (intensity >= 0.65) return 'bg-emerald-600 text-white';
  if (intensity >= 0.45) return 'bg-emerald-500 text-white';
  if (intensity >= 0.25) return 'bg-emerald-200 text-emerald-950';
  if (intensity > 0) return 'bg-emerald-100 text-emerald-800';
  return 'bg-stone-100 text-stone-400';
}

export default function OwnerAnalyticsPanel({
  analytics
}: {
  analytics: OwnerAnalytics;
}) {
  return (
    <Card>
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            Owner analytics
          </div>
          <h2 className="mt-2 text-2xl font-black text-stone-950">Commercial signals that need action</h2>
          <p className="mt-2 max-w-3xl text-sm text-stone-500">
            These insights stay tied to the current branch inventory, purchase, sales, refund, and
            movement records for {analytics.periodLabel.toLowerCase()}.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/inventory"
            className="rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition hover:bg-emerald-100"
          >
            Open reorder queue
          </Link>
          <Link
            href="/reports"
            className="rounded-full border border-stone-200 bg-white px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            Open reports
          </Link>
        </div>
      </div>

      <div className="mt-6 grid gap-4 xl:grid-cols-4">
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(16,185,129,0.12),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Sell-through
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">{percent(analytics.summary.sellThroughPercent)}</div>
          <div className="mt-2 text-sm text-stone-500">Recent sold units against sold plus current on-hand stock.</div>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(245,158,11,0.14),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Margin leakage
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">
            {money(analytics.summary.marginLeakageValue, analytics.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">Discount, refund, and price-cost squeeze indicators worth review.</div>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(14,165,233,0.14),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Stock age
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">
            {analytics.summary.averageStockAgeDays.toFixed(1)} days
          </div>
          <div className="mt-2 text-sm text-stone-500">Weighted by current stock using the latest provable inbound date.</div>
        </div>
        <div className="rounded-[24px] border border-stone-200 bg-[linear-gradient(135deg,rgba(120,113,108,0.14),rgba(255,255,255,0.98))] p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Reorder queue
          </div>
          <div className="mt-2 text-3xl font-black text-stone-950">{analytics.summary.reorderCount}</div>
          <div className="mt-2 text-sm text-stone-500">
            {money(analytics.summary.reorderCost, analytics.currencySymbol)} projected replenishment cost.
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                Sales heatmap
              </div>
              <div className="mt-1 text-lg font-black text-stone-950">Hour and weekday demand pattern</div>
            </div>
            <div className="text-xs text-stone-500">{analytics.periodLabel}</div>
          </div>
          <div className="mt-4 overflow-x-auto">
            <div className="min-w-[780px]">
              <div className="grid grid-cols-[80px_repeat(24,minmax(24px,1fr))] gap-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                <div />
                {analytics.heatmap.hours.map((hour) => (
                  <div key={hour.hour} className="text-center">
                    {hour.label.replace(':00', '')}
                  </div>
                ))}
              </div>
              <div className="mt-2 space-y-1">
                {analytics.heatmap.rows.map((row) => (
                  <div
                    key={row.dayLabel}
                    className="grid grid-cols-[80px_repeat(24,minmax(24px,1fr))] gap-1"
                  >
                    <div className="flex items-center text-xs font-semibold text-stone-500">
                      {row.dayLabel}
                    </div>
                    {row.cells.map((cell) => (
                      <div
                        key={`${row.dayLabel}-${cell.hour}`}
                        className={`flex h-9 items-center justify-center rounded-md text-[10px] font-semibold ${heatColor(cell.intensity)}`}
                        title={`${row.dayLabel} ${analytics.heatmap.hours[cell.hour]?.label}: ${money(cell.revenue, analytics.currencySymbol)} across ${cell.count} sale(s)`}
                      >
                        {cell.count > 0 ? cell.count : ''}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-stone-50/80 p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Pressure points
          </div>
          <div className="mt-3 space-y-3 text-sm">
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">Refund trend</div>
              <div className="mt-1 text-stone-500">
                {money(analytics.summary.totalRefunds, analytics.currencySymbol)} refunded in the selected period.
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">Shrinkage trend</div>
              <div className="mt-1 text-stone-500">
                {money(analytics.summary.totalShrinkageValue, analytics.currencySymbol)} written off through negative corrections and count variances.
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">Supplier lead time</div>
              <div className="mt-1 text-stone-500">
                {analytics.summary.averageLeadTimeDays.toFixed(1)} days average from purchase creation to receiving.
              </div>
            </div>
            <div className="rounded-2xl border border-stone-200 bg-white px-4 py-3">
              <div className="font-semibold text-stone-900">Stockout events</div>
              <div className="mt-1 text-stone-500">
                {analytics.summary.stockoutEvents} reconstructed stockout transition(s) from movement history.
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Fast movers
          </div>
          <div className="mt-4 space-y-3">
            {analytics.fastMovers.length ? (
              analytics.fastMovers.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">{item.soldQty} sold / {item.currentStock} left</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-950">{item.avgDailySales.toFixed(1)}</div>
                    <div className="text-xs text-stone-500">units/day</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No completed sales yet for this analytics window.</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Slow movers
          </div>
          <div className="mt-4 space-y-3">
            {analytics.slowMovers.length ? (
              analytics.slowMovers.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">{item.currentStock} on hand</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-950">{item.avgDailySales.toFixed(1)}</div>
                    <div className="text-xs text-stone-500">units/day</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No slow-moving stock is visible yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Stock aging
          </div>
          <div className="mt-4 space-y-3">
            {analytics.stockAging.length ? (
              analytics.stockAging.map((item) => (
                <div key={item.productId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">{item.productName}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {item.stockQty} on hand / last inbound {item.lastInboundAt.toLocaleDateString('en-PH')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-stone-900">{item.ageDays} day(s) aging</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No aging inventory is available yet.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Margin leakage report
          </div>
          <div className="mt-4 space-y-3">
            {analytics.marginLeakage.length ? (
              analytics.marginLeakage.map((item) => (
                <div key={item.productId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">{item.productName}</div>
                  <div className="mt-2 flex justify-between text-xs text-stone-500">
                    <span>Discounts</span>
                    <span>{money(item.discountLeak, analytics.currencySymbol)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-stone-500">
                    <span>Refunds</span>
                    <span>{money(item.refundLeak, analytics.currencySymbol)}</span>
                  </div>
                  <div className="mt-1 flex justify-between text-xs text-stone-500">
                    <span>Squeeze</span>
                    <span>{money(item.marginSqueeze, analytics.currencySymbol)}</span>
                  </div>
                  <div className="mt-2 flex justify-between text-sm font-semibold text-stone-900">
                    <span>Total leakage</span>
                    <span>{money(item.totalLeak, analytics.currencySymbol)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No meaningful leakage signals yet.</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Refund and shrink trend
          </div>
          <div className="mt-4 space-y-3">
            {analytics.refundTrend.length ? (
              analytics.refundTrend.slice(-6).map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-stone-900">{item.label}</div>
                    <div className="text-xs text-stone-500">{item.count} refund or exchange adjustment(s)</div>
                  </div>
                  <div className="font-semibold text-stone-900">{money(item.total, analytics.currencySymbol)}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No refunds or exchanges were posted in this period.</div>
            )}
            {analytics.shrinkageTrend.length ? (
              analytics.shrinkageTrend.slice(-6).map((item) => (
                <div key={item.key} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-red-50/60 px-4 py-3 text-sm">
                  <div>
                    <div className="font-semibold text-stone-900">{item.label}</div>
                    <div className="text-xs text-stone-500">{item.qty} unit(s) written off</div>
                  </div>
                  <div className="font-semibold text-red-700">{money(item.value, analytics.currencySymbol)}</div>
                </div>
              ))
            ) : null}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Purchase lead times
          </div>
          <div className="mt-4 space-y-3">
            {analytics.purchaseLeadTimes.length ? (
              analytics.purchaseLeadTimes.map((item) => (
                <div key={item.supplierId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="font-semibold text-stone-900">{item.supplierName}</div>
                  <div className="mt-1 text-xs text-stone-500">
                    {item.receiptCount} receipt(s) / last received {item.lastReceivedAt.toLocaleDateString('en-PH')}
                  </div>
                  <div className="mt-2 text-sm font-semibold text-stone-900">
                    {item.avgLeadTimeDays.toFixed(1)} day(s) average lead time
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">Lead-time reporting will appear after purchases are received.</div>
            )}
          </div>
        </div>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
            Stockout frequency
          </div>
          <div className="mt-4 space-y-3">
            {analytics.stockoutFrequency.length ? (
              analytics.stockoutFrequency.map((item) => (
                <div key={item.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">
                      {item.currentStock} left / reorder point {item.reorderPoint}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-950">{item.stockoutEvents}</div>
                    <div className="text-xs text-stone-500">stockout event(s)</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No stockout transitions were reconstructed in this window.</div>
            )}
          </div>
        </div>

        <div className="rounded-[28px] border border-stone-200 bg-white p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">
                Reorder engine preview
              </div>
              <div className="mt-1 text-lg font-black text-stone-950">Priority replenishment suggestions</div>
            </div>
            <Link
              href="/inventory"
              className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-semibold text-stone-700 transition hover:border-stone-300 hover:bg-white"
            >
              Review queue
            </Link>
          </div>
          <div className="mt-4 space-y-3">
            {analytics.reorderPreview.length ? (
              analytics.reorderPreview.map((item) => (
                <div key={item.productId} className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-3">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="font-semibold text-stone-900">{item.productName}</div>
                      <div className="text-xs text-stone-500">
                        {item.supplierName} / lead time {item.leadTimeDays} day(s)
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-stone-950">{item.suggestedQty}</div>
                      <div className="text-xs text-stone-500">suggested</div>
                    </div>
                  </div>
                  <div className="mt-2 flex justify-between text-xs text-stone-500">
                    <span>Reorder point {item.reorderPoint}</span>
                    <span>{money(item.suggestedCost, analytics.currencySymbol)}</span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No products currently need smart reorder action.</div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
}
