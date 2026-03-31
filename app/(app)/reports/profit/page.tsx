import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { money, shortDate } from '@/lib/format';
import { getProfitReportData, getReportFilterOptions, parseReportFilters } from '@/lib/reporting';

export default async function ProfitReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getProfitReportData(shopId, filters)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Profit Reports"
        subtitle="Gross profit uses the best available cost basis per sale date: matching cost history when available, then the earliest prior or current product cost when a direct sale snapshot does not exist."
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/profit"
          fromValue={filters.fromValue}
          toValue={filters.toValue}
          categoryId={filters.categoryId}
          productId={filters.productId}
          categories={options.categories}
          products={options.products}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">Net revenue basis</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.revenue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Estimated cost of goods</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.costOfGoods, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Gross profit</div>
          <div className="mt-2 text-3xl font-black text-emerald-700">{money(report.summary.grossProfit, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Gross margin</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{report.summary.grossMarginPercent.toFixed(2)}%</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Profit by day</h2>
          <div className="mt-4 space-y-3">
            {report.dailyProfit.length ? report.dailyProfit.map((entry) => (
              <div key={entry.key} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.label}</div>
                    <div className="text-sm text-stone-500">
                      Revenue {money(entry.revenue, options.currencySymbol)} / Cost {money(entry.cost, options.currencySymbol)}
                    </div>
                  </div>
                  <div className={`font-black ${entry.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {money(entry.profit, options.currencySymbol)}
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No profit trend data in this range.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Profit by month</h2>
          <div className="mt-4 space-y-3">
            {report.monthlyProfit.length ? report.monthlyProfit.map((entry) => (
              <div key={entry.key} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.label}</div>
                    <div className="text-sm text-stone-500">
                      Revenue {money(entry.revenue, options.currencySymbol)} / Cost {money(entry.cost, options.currencySymbol)}
                    </div>
                  </div>
                  <div className={`font-black ${entry.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                    {money(entry.profit, options.currencySymbol)}
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No monthly profit data for this range.</div>}
          </div>
        </Card>
      </div>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Profit per sale</h2>
        <div className="mt-4 space-y-3">
          {report.profitPerSale.length ? report.profitPerSale.map((entry) => (
            <div key={entry.saleId} className="rounded-2xl border border-stone-200 p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{entry.saleNumber}</div>
                  <div className="text-sm text-stone-500">
                    Sale date {shortDate(entry.saleDate)} / Net {entry.qty} unit(s)
                  </div>
                  {entry.returnCount ? (
                    <div className="text-xs text-amber-700">{entry.returnCount} return adjustment(s) affected this sale in the selected period.</div>
                  ) : null}
                </div>
                <div className="text-right">
                  <div className="font-black text-emerald-700">{money(entry.profit, options.currencySymbol)}</div>
                  <div className="text-sm text-stone-500">
                    Revenue {money(entry.revenue, options.currencySymbol)} / Margin {entry.marginPercent.toFixed(2)}%
                  </div>
                </div>
              </div>
            </div>
          )) : <div className="text-sm text-stone-500">No sale profitability data matched the current filters.</div>}
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Profit per category</h2>
          <div className="mt-4 space-y-3">
            {report.profitPerCategory.length ? report.profitPerCategory.map((entry) => (
              <div key={entry.name} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">
                      Revenue {money(entry.revenue, options.currencySymbol)} / Cost {money(entry.cost, options.currencySymbol)}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black ${entry.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {money(entry.profit, options.currencySymbol)}
                    </div>
                    <div className="text-sm text-stone-500">{entry.marginPercent.toFixed(2)}% margin</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No category profitability data matched the current filters.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Profit per item</h2>
          <div className="mt-4 space-y-3">
            {report.profitPerItem.length ? report.profitPerItem.map((entry) => (
              <div key={entry.productId} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">{entry.categoryName} / Net {entry.qty} unit(s)</div>
                  </div>
                  <div className="text-right">
                    <div className={`font-black ${entry.profit >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                      {money(entry.profit, options.currencySymbol)}
                    </div>
                    <div className="text-sm text-stone-500">{entry.marginPercent.toFixed(2)}% margin</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No item profitability data matched the current filters.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
