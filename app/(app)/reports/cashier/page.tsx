import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePageRole } from '@/lib/authz';
import { compactNumber, dateTime, money } from '@/lib/format';
import { getCashierReportData, getReportFilterOptions, parseReportFilters } from '@/lib/reporting';

export default async function CashierReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePageRole('ADMIN');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getCashierReportData(shopId, filters)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Cashier Reports"
        subtitle="Review sales performance by cashier and keep refunds and voids visible as operational exceptions."
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/cashier"
          fromValue={filters.fromValue}
          toValue={filters.toValue}
          cashierId={filters.cashierId}
          cashiers={options.cashiers}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">Cashier sales</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.totalRevenue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Transactions</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{compactNumber(report.summary.totalTransactions)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Refund activity</div>
          <div className="mt-2 text-3xl font-black text-amber-700">{money(report.summary.refundTotal, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Void activity</div>
          <div className="mt-2 text-3xl font-black text-red-700">{money(report.summary.voidTotal, options.currencySymbol)}</div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Top cashiers</h2>
        <div className="mt-4 space-y-3">
          {report.topCashiers.length ? report.topCashiers.map((entry) => (
            <div key={entry.cashierId} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{entry.cashierName}</div>
                  <div className="text-sm text-stone-500">{entry.transactions} transaction(s)</div>
                </div>
                <div className="text-right">
                  <div className="font-black text-stone-900">{money(entry.revenue, options.currencySymbol)}</div>
                  <div className="text-sm text-stone-500">Avg {money(entry.averageTicket, options.currencySymbol)}</div>
                </div>
              </div>
            </div>
          )) : <div className="text-sm text-stone-500">No cashier sales matched that range.</div>}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Refund report</h2>
          <div className="mt-4 space-y-3">
            {report.refunds.length ? report.refunds.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.adjustmentNumber} / {entry.saleNumber}</div>
                    <div className="text-sm text-stone-600">{entry.type} by {entry.cashierName}</div>
                    <div className="text-sm text-stone-500">{entry.reason}</div>
                    <div className="mt-1 text-xs text-stone-500">Approved by {entry.approvedByName} / {dateTime(entry.createdAt)}</div>
                  </div>
                  <div className="font-black text-amber-700">{money(entry.totalAmount, options.currencySymbol)}</div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No refund or exchange adjustments in this range.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Void report</h2>
          <div className="mt-4 space-y-3">
            {report.voids.length ? report.voids.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-red-200 bg-red-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.adjustmentNumber} / {entry.saleNumber}</div>
                    <div className="text-sm text-stone-600">Voided by {entry.cashierName}</div>
                    <div className="text-sm text-stone-500">{entry.reason}</div>
                    <div className="mt-1 text-xs text-stone-500">Approved by {entry.approvedByName} / {dateTime(entry.createdAt)}</div>
                  </div>
                  <div className="font-black text-red-700">{money(entry.totalAmount, options.currencySymbol)}</div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No void adjustments in this range.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
