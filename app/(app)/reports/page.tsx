import Link from 'next/link';
import AppHeader from '@/components/layout/AppHeader';
import ReportsNav from '@/components/reports/ReportsNav';
import Card from '@/components/ui/Card';
import { requirePagePermission } from '@/lib/authz';
import { money } from '@/lib/format';
import { getReportFilterOptions, getReportsOverviewData, parseReportFilters } from '@/lib/reporting';

export default async function ReportsPage({
  searchParams
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { shopId } = await requirePagePermission('VIEW_REPORTS');
  const filters = await parseReportFilters(searchParams);
  const [options, overview] = await Promise.all([
    getReportFilterOptions(shopId),
    getReportsOverviewData(shopId, filters)
  ]);

  const sections = [
    {
      href: '/reports/sales',
      title: 'Sales reports',
      description: 'Daily, monthly, hourly, top-item, category, and payment mix visibility.'
    },
    {
      href: '/reports/inventory',
      title: 'Inventory reports',
      description: 'Valuation, low movement, and dead stock visibility for current stock.'
    },
    {
      href: '/reports/profit',
      title: 'Profit reports',
      description: 'Estimated gross profit trends and high-margin item visibility.'
    },
    {
      href: '/reports/cashier',
      title: 'Cashier reports',
      description: 'Cashier performance, refunds, voids, and approval-heavy exceptions.'
    }
  ];

  return (
    <div className="space-y-6">
      <AppHeader
        title="Owner Reports"
        subtitle="Sensitive reporting is limited to admin access in the current role model. Use the dedicated tabs below to review sales, stock, profit, and cashier performance."
      />

      <ReportsNav />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <div className="text-sm text-stone-500">Revenue in range</div>
          <div className="mt-2 text-3xl font-black text-stone-900">
            {money(overview.revenue, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">{overview.transactionCount} completed sale(s)</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Estimated gross profit</div>
          <div className="mt-2 text-3xl font-black text-emerald-700">
            {money(overview.grossProfit, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">Uses current product cost as the available cost basis.</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Inventory valuation</div>
          <div className="mt-2 text-3xl font-black text-stone-900">
            {money(overview.inventoryValuation, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">Current stock quantity multiplied by current unit cost.</div>
        </Card>
        <Card>
          <div className="text-sm text-stone-500">Refunds and voids</div>
          <div className="mt-2 text-3xl font-black text-red-700">
            {money(overview.refundTotal + overview.voidTotal, options.currencySymbol)}
          </div>
          <div className="mt-2 text-sm text-stone-500">
            Refunds {money(overview.refundTotal, options.currencySymbol)} / Voids {money(overview.voidTotal, options.currencySymbol)}
          </div>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        {sections.map((section) => (
          <Link key={section.href} href={section.href}>
            <Card className="h-full transition hover:-translate-y-0.5 hover:border-emerald-200">
              <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Report module</div>
              <h2 className="mt-2 text-2xl font-black text-stone-900">{section.title}</h2>
              <p className="mt-3 text-sm leading-6 text-stone-600">{section.description}</p>
              <div className="mt-6 text-sm font-semibold text-emerald-700">Open report</div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
