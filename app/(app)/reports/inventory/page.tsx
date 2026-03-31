import AppHeader from '@/components/layout/AppHeader';
import ReportFilters from '@/components/reports/ReportFilters';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { compactNumber, money } from '@/lib/format';
import { getInventoryReportData, getReportFilterOptions, parseReportFilters } from '@/lib/reporting';

export default async function InventoryReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, report] = await Promise.all([
    getReportFilterOptions(shopId),
    getInventoryReportData(shopId, filters)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Inventory Reports"
        subtitle="Review current stock value at cost and sell price, surface low-stock value at risk, and keep slow or dead stock visible by date range."
      />

      <ReportsNav />

      <Card>
        <ReportFilters
          action="/reports/inventory"
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
          <div className="text-sm text-stone-500">Stock on hand</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{compactNumber(report.summary.totalUnitsOnHand)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Cost value</div>
          <div className="mt-2 text-3xl font-black text-stone-900">{money(report.summary.costValue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Sell value</div>
          <div className="mt-2 text-3xl font-black text-emerald-700">{money(report.summary.sellValue, options.currencySymbol)}</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Low-stock value at risk</div>
          <div className="mt-2 text-3xl font-black text-amber-700">{money(report.summary.lowStockValueAtRisk, options.currencySymbol)}</div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Inventory valuation</h2>
          <div className="mt-4 space-y-3">
            {report.valuationRows.length ? report.valuationRows.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">
                      {entry.categoryName} / {entry.stockQty} on hand / {entry.stockLevel.replaceAll('_', ' ')}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-stone-900">{money(entry.costValue, options.currencySymbol)}</div>
                    <div className="text-sm text-stone-500">Sell {money(entry.sellValue, options.currencySymbol)}</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No valuation data matched the current filters.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Low-stock value at risk</h2>
          <div className="mt-4 space-y-3">
            {report.lowStockRisk.length ? report.lowStockRisk.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">
                      {entry.categoryName} / Reorder point {entry.reorderPoint} / {entry.stockQty} left
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-amber-700">{money(entry.sellValue, options.currencySymbol)}</div>
                    <div className="text-sm text-stone-500">Cost {money(entry.costValue, options.currencySymbol)}</div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No low-stock exposure matched the current filters.</div>}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Low movement items</h2>
          <div className="mt-4 space-y-3">
            {report.lowMovement.length ? report.lowMovement.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">{entry.categoryName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-amber-700">{entry.soldQty} sold</div>
                    <div className="text-sm text-stone-500">
                      Revenue {money(entry.soldRevenue, options.currencySymbol)} / Cost value {money(entry.costValue, options.currencySymbol)}
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No low movement products in this range.</div>}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Dead stock</h2>
          <div className="mt-4 space-y-3">
            {report.deadStock.length ? report.deadStock.map((entry) => (
              <div key={entry.id} className="rounded-2xl border border-red-200 bg-red-50/70 p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold text-stone-900">{entry.name}</div>
                    <div className="text-sm text-stone-500">{entry.categoryName}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-red-700">{entry.stockQty} still on hand</div>
                    <div className="text-sm text-stone-500">
                      Cost {money(entry.costValue, options.currencySymbol)} / Sell {money(entry.sellValue, options.currencySymbol)}
                    </div>
                  </div>
                </div>
              </div>
            )) : <div className="text-sm text-stone-500">No dead stock in the selected period.</div>}
          </div>
        </Card>
      </div>
    </div>
  );
}
