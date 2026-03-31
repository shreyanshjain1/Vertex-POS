import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { compactNumber, money } from '@/lib/format';
import { getReportFilterOptions, getSalesReportData, parseReportFilters } from '@/lib/reporting';

export default async function SalesReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getSalesReportData(shopId, filters)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Sales Reports"
        subtitle="Review daily and monthly performance, hourly trading patterns, payment mix, and what is actually moving."
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/sales"
          fromValue={filters.fromValue}
          toValue={filters.toValue}
          cashierId={filters.cashierId}
          paymentMethod={filters.paymentMethod}
          cashiers={options.cashiers}
          paymentMethods={options.paymentMethods}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">Revenue</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.revenue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Transactions</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{compactNumber(report.summary.transactionCount)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Average ticket</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.averageTicket, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Customer credit sales</div>
          <div className="mt-2 text-3xl font-black text-amber-700">{money(report.summary.creditSales, options.currencySymbol)}</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Daily sales</h2>
          <div className="mt-4 space-y-3">
            {report.dailySales.length ? report.dailySales.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.label}</div>
                  <div className="text-sm text-stone-500">{entry.count} sale(s)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">No completed sales matched that range.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Monthly sales</h2>
          <div className="mt-4 space-y-3">
            {report.monthlySales.length ? report.monthlySales.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.label}</div>
                  <div className="text-sm text-stone-500">{entry.count} sale(s)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">No monthly totals available for that range.</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Hourly sales distribution</h2>
          <div className="mt-4 space-y-3">
            {report.hourlySales.map((entry) => (
              <div key={entry.hour} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.label}</div>
                  <div className="text-sm text-stone-500">{entry.count} sale(s)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Payment method totals</h2>
          <div className="mt-4 space-y-3">
            {report.paymentMethodTotals.length ? report.paymentMethodTotals.map((entry) => (
              <div key={entry.method} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div className="font-semibold text-stone-900">{entry.method}</div>
                <div className="font-black text-stone-900">{money(entry.total, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">No payment totals matched that filter set.</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Top items</h2>
          <div className="mt-4 space-y-3">
            {report.topItems.length ? report.topItems.map((entry) => (
              <div key={entry.productId} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.name}</div>
                  <div className="text-sm text-stone-500">{entry.qty} unit(s)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.revenue, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">No top items yet for this range.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Top categories</h2>
          <div className="mt-4 space-y-3">
            {report.topCategories.length ? report.topCategories.map((entry) => (
              <div key={entry.key} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{entry.name}</div>
                  <div className="text-sm text-stone-500">{entry.qty} unit(s)</div>
                </div>
                <div className="font-black text-stone-900">{money(entry.revenue, options.currencySymbol)}</div>
              </div>
            )) : <div className="text-sm text-stone-500">No category performance data yet.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
