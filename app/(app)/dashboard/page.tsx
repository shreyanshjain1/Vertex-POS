import Link from 'next/link';
import DashboardStats from '@/components/dashboard/DashboardStats';
import LowStockCard from '@/components/dashboard/LowStockCard';
import RecentSalesCard from '@/components/dashboard/RecentSalesCard';
import Card from '@/components/ui/Card';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { dateTime, money, shortDate } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import {
  lowStockCardProductSelect,
  recentSaleCardSelect,
  serializeLowStockProduct,
  serializeRecentSale
} from '@/lib/serializers/dashboard';

function pluralize(count: number, singular: string, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`;
}

export default async function DashboardPage() {
  const { shopId, shop, role } = await getActiveShopContext();
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  const now = new Date();
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 6);

  const [
    totalProducts,
    lowStockCount,
    lowStockProducts,
    recentSales,
    todaySales,
    todaySaleCount,
    weeklySales,
    pendingPurchases,
    recentMovements
  ] = await Promise.all([
    prisma.product.count({ where: { shopId, isActive: true } }),
    prisma.product.count({
      where: {
        shopId,
        isActive: true,
        stockQty: { lte: settings?.lowStockThreshold ?? 5 }
      }
    }),
    prisma.product.findMany({
      where: {
        shopId,
        isActive: true,
        stockQty: { lte: settings?.lowStockThreshold ?? 5 }
      },
      select: lowStockCardProductSelect,
      orderBy: [{ stockQty: 'asc' }, { name: 'asc' }],
      take: 8
    }),
    prisma.sale.findMany({
      where: { shopId, status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 8,
      select: recentSaleCardSelect
    }),
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: todayStart } },
      _sum: { totalAmount: true }
    }),
    prisma.sale.count({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: todayStart } }
    }),
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: weekStart } },
      _sum: { totalAmount: true }
    }),
    prisma.purchaseOrder.count({
      where: { shopId, status: 'DRAFT' }
    }),
    prisma.inventoryMovement.findMany({
      where: { shopId },
      include: {
        product: {
          select: {
            id: true,
            name: true
          }
        }
      },
      orderBy: { createdAt: 'desc' },
      take: 6
    })
  ]);

  const currency = settings?.currencySymbol ?? '₱';
  const todaySalesValue = Number(todaySales._sum.totalAmount ?? 0);
  const weeklySalesValue = Number(weeklySales._sum.totalAmount ?? 0);
  const averageTicket = todaySaleCount > 0 ? todaySalesValue / todaySaleCount : 0;
  const stockCoverage =
    totalProducts > 0 ? Math.max(0, Math.round(((totalProducts - lowStockCount) / totalProducts) * 100)) : 100;
  const criticalLowStockCount = lowStockProducts.filter(
    (product) => product.stockQty <= Math.max(1, Math.floor(product.reorderPoint / 2))
  ).length;

  const allowedQuickLinks =
    role === 'CASHIER'
      ? [
          { href: '/checkout', label: 'Start checkout' },
          { href: '/sales', label: 'View sales' }
        ]
      : [
          { href: '/checkout', label: 'Start checkout' },
          { href: '/products', label: 'Add product' },
          { href: '/purchases', label: 'Record purchase' },
          { href: '/activity', label: 'Open activity log' }
        ];

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
              Welcome back. {shop.name} is ready for today&apos;s operations, with checkout, stock control, and reporting all connected.
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              {allowedQuickLinks.map((action) => (
                <Link
                  key={action.href}
                  href={action.href}
                  className="rounded-full bg-white px-5 py-3 text-sm font-semibold text-stone-900 ring-1 ring-stone-200 transition hover:bg-stone-50"
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
                <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Pending purchases</div>
                <div className="mt-2 text-2xl font-black text-stone-950">{pendingPurchases}</div>
                <div className="mt-1 text-sm text-stone-500">Draft purchase order(s) still waiting to be received.</div>
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
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400">Receiving queue</div>
                  <div className="mt-2 text-2xl font-black text-stone-950">{pendingPurchases}</div>
                  <div className="mt-2 text-sm text-stone-500">
                    {pendingPurchases > 0 ? 'Draft purchases are waiting for stock receipt.' : 'No draft purchases are waiting.'}
                  </div>
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
        pendingPurchases={pendingPurchases}
        todaySales={money(todaySalesValue, currency)}
        todaySaleCount={todaySaleCount}
        stockCoverage={stockCoverage}
      />

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <RecentSalesCard
          sales={recentSales.map(serializeRecentSale)}
          currencySymbol={currency}
        />
        <LowStockCard
          products={lowStockProducts.map(serializeLowStockProduct)}
          currencySymbol={currency}
        />
      </div>

      <Card>
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-sky-700">Movement watch</div>
            <h2 className="mt-2 text-2xl font-black text-stone-950">Recent stock movements</h2>
          </div>
          <Link href="/inventory" className="text-sm font-semibold text-emerald-700 hover:text-emerald-800">
            Open inventory
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {recentMovements.length ? (
            recentMovements.map((movement) => (
              <div key={movement.id} className="flex items-center justify-between rounded-2xl border border-stone-200 p-4">
                <div>
                  <div className="font-semibold text-stone-900">{movement.product.name}</div>
                  <div className="mt-1 text-sm text-stone-500">
                    {movement.type.replaceAll('_', ' ')} / {dateTime(movement.createdAt)}
                  </div>
                </div>
                <div className={`text-lg font-black ${movement.qtyChange >= 0 ? 'text-emerald-700' : 'text-red-700'}`}>
                  {movement.qtyChange > 0 ? `+${movement.qtyChange}` : movement.qtyChange}
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
              No stock movement has been recorded yet.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
