import Link from 'next/link';
import DashboardStats from '@/components/dashboard/DashboardStats';
import RecentSalesCard from '@/components/dashboard/RecentSalesCard';
import LowStockCard from '@/components/dashboard/LowStockCard';
import Card from '@/components/ui/Card';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { money, shortDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function DashboardPage() {
  const { shopId, shop } = await getActiveShopContext();
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 6);

  const [totalProducts, totalSuppliers, lowStockCount, lowStockProducts, recentSales, todaySales, todaySaleCount, weeklySales] =
    await Promise.all([
      prisma.product.count({ where: { shopId, isActive: true } }),
      prisma.supplier.count({ where: { shopId, isActive: true } }),
      prisma.product.count({ where: { shopId, isActive: true, stockQty: { lte: settings?.lowStockThreshold ?? 5 } } }),
      prisma.product.findMany({
        where: { shopId, isActive: true, stockQty: { lte: settings?.lowStockThreshold ?? 5 } },
        include: { category: true },
        orderBy: [{ stockQty: 'asc' }, { name: 'asc' }],
        take: 8
      }),
      prisma.sale.findMany({
        where: { shopId, status: 'COMPLETED' },
        orderBy: { createdAt: 'desc' },
        take: 8,
        include: { items: true }
      }),
      prisma.sale.aggregate({ where: { shopId, status: 'COMPLETED', createdAt: { gte: todayStart } }, _sum: { totalAmount: true } }),
      prisma.sale.count({ where: { shopId, status: 'COMPLETED', createdAt: { gte: todayStart } } }),
      prisma.sale.aggregate({ where: { shopId, status: 'COMPLETED', createdAt: { gte: weekStart } }, _sum: { totalAmount: true } })
    ]);

  const currency = settings?.currencySymbol ?? 'PHP ';
  const todaySalesValue = Number(todaySales._sum.totalAmount ?? 0);
  const weeklySalesValue = Number(weeklySales._sum.totalAmount ?? 0);
  const averageTicket = todaySaleCount > 0 ? todaySalesValue / todaySaleCount : 0;
  const stockCoverage = totalProducts > 0 ? Math.max(0, Math.round(((totalProducts - lowStockCount) / totalProducts) * 100)) : 100;
  const criticalLowStockCount = lowStockProducts.filter((product) => product.stockQty <= Math.max(1, Math.floor(product.reorderPoint / 2))).length;
  const paymentMethodCounts = recentSales.reduce<Record<string, number>>((accumulator, sale) => {
    const key = sale.paymentMethod;
    accumulator[key] = (accumulator[key] ?? 0) + 1;
    return accumulator;
  }, {});
  const leadingPaymentMethod = Object.entries(paymentMethodCounts).sort((left, right) => right[1] - left[1])[0]?.[0] ?? 'Cash';

  return (
    <div className="space-y-6">
      <section className="relative overflow-hidden rounded-[32px] border border-white/80 bg-[linear-gradient(135deg,rgba(16,185,129,0.16),rgba(255,255,255,0.94),rgba(14,165,233,0.10))] p-6 shadow-[0_26px_90px_-40px_rgba(28,25,23,0.3)] sm:p-8">
        <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_center,_rgba(16,185,129,0.20),_transparent_55%)] lg:block" />
        <div className="relative grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
          <div>
            <div className="inline-flex rounded-full border border-emerald-200 bg-white/80 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">
              {shortDate(now)} / Live dashboard
            </div>
            <h1 className="mt-4 text-4xl font-black tracking-tight text-stone-950 sm:text-5xl">Dashboard</h1>
            <p className="mt-4 max-w-3xl text-base leading-7 text-stone-600 sm:text-lg">
              Welcome back. {shop.name} is ready for today&apos;s operations, with checkout, inventory, and reporting all in one place.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {[
                { href: '/checkout', label: 'Start checkout', tone: 'bg-stone-950 text-white hover:bg-stone-800' },
                { href: '/inventory', label: 'Review inventory', tone: 'bg-white text-stone-900 ring-1 ring-stone-200 hover:bg-stone-50' },
                { href: '/products', label: 'Update catalog', tone: 'bg-white text-stone-900 ring-1 ring-stone-200 hover:bg-stone-50' }
              ].map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className={`rounded-full px-5 py-3 text-sm font-semibold transition ${action.tone}`}
                >
                  {action.label}
                </Link>
              ))}
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <div className="rounded-[26px] border border-white/80 bg-white/80 p-4 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Average ticket</div>
                <div className="mt-2 text-2xl font-black text-stone-950">{money(averageTicket, currency)}</div>
                <div className="mt-1 text-sm text-stone-500">Based on today&apos;s completed sales.</div>
              </div>
              <div className="rounded-[26px] border border-white/80 bg-white/80 p-4 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Last 7 days</div>
                <div className="mt-2 text-2xl font-black text-stone-950">{money(weeklySalesValue, currency)}</div>
                <div className="mt-1 text-sm text-stone-500">Rolling revenue snapshot for the week.</div>
              </div>
              <div className="rounded-[26px] border border-white/80 bg-white/80 p-4 backdrop-blur">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Stock coverage</div>
                <div className="mt-2 text-2xl font-black text-stone-950">{stockCoverage}%</div>
                <div className="mt-1 text-sm text-stone-500">Catalog currently above the reorder threshold.</div>
              </div>
            </div>
          </div>

          <Card className="border-white/70 bg-white/88">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.2em] text-stone-400">Operations pulse</div>
                <h2 className="mt-2 text-2xl font-black text-stone-950">What needs attention now</h2>
              </div>
              <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">Live</div>
            </div>

            <div className="mt-6 space-y-4">
              <div className="rounded-[24px] bg-stone-950 p-4 text-white">
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-300">Sales today</div>
                <div className="mt-2 text-3xl font-black">{money(todaySalesValue, currency)}</div>
                <div className="mt-2 text-sm text-stone-300">{pluralize(todaySaleCount, 'sale')} completed so far.</div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Restock pressure</div>
                  <div className="mt-2 text-2xl font-black text-stone-950">{pluralize(lowStockCount, 'product')}</div>
                  <div className="mt-2 text-sm text-stone-500">
                    {criticalLowStockCount > 0
                      ? `${pluralize(criticalLowStockCount, 'item')} are in the critical zone.`
                      : 'Nothing has dropped into the critical zone yet.'}
                  </div>
                </div>

                <div className="rounded-[24px] border border-stone-200 bg-stone-50 p-4">
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Checkout mix</div>
                  <div className="mt-2 text-2xl font-black text-stone-950">{leadingPaymentMethod}</div>
                  <div className="mt-2 text-sm text-stone-500">Most common payment method across the latest receipts.</div>
                </div>
              </div>

              <div className="rounded-[24px] border border-stone-200 bg-white p-4">
                <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">
                  <span>Catalog health</span>
                  <span>{stockCoverage}% stable</span>
                </div>
                <div className="mt-3 h-2 rounded-full bg-stone-200">
                  <div className="h-full rounded-full bg-emerald-500" style={{ width: `${stockCoverage}%` }} />
                </div>
                <div className="mt-3 text-sm text-stone-500">
                  Keep an eye on the restock queue so the sales floor stays ready throughout the day.
                </div>
              </div>
            </div>
          </Card>
        </div>
      </section>

      <DashboardStats
        totalProducts={totalProducts}
        lowStockCount={lowStockCount}
        totalSuppliers={totalSuppliers}
        todaySales={money(todaySalesValue, currency)}
        todaySaleCount={todaySaleCount}
        stockCoverage={stockCoverage}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <RecentSalesCard
          sales={recentSales.map((sale) => ({
            ...sale,
            createdAt: sale.createdAt.toISOString(),
            totalAmount: sale.totalAmount.toString(),
            items: sale.items.map((item) => ({ ...item, lineTotal: item.lineTotal.toString() }))
          }))}
          currencySymbol={currency}
        />
        <LowStockCard
          products={lowStockProducts.map((product) => ({ ...product, price: product.price.toString() }))}
          currencySymbol={currency}
        />
      </div>
    </div>
  );
}
