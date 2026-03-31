import AppHeader from '@/components/layout/AppHeader';
import Card from '@/components/ui/Card';
import { requirePageRole } from '@/lib/authz';
import { money } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export default async function ReportsPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(todayStart);
  weekStart.setDate(todayStart.getDate() - 6);

  const [daily, dailyRefunds, weekly, weeklyRefunds, monthly, monthlyRefunds, topProducts, lowStock, purchaseReceipts] = await Promise.all([
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: todayStart } },
      _sum: { totalAmount: true },
      _count: true
    }),
    prisma.saleAdjustment.aggregate({
      where: { shopId, createdAt: { gte: todayStart } },
      _sum: { totalAmount: true }
    }),
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: weekStart } },
      _sum: { totalAmount: true },
      _count: true
    }),
    prisma.saleAdjustment.aggregate({
      where: { shopId, createdAt: { gte: weekStart } },
      _sum: { totalAmount: true }
    }),
    prisma.sale.aggregate({
      where: { shopId, status: 'COMPLETED', createdAt: { gte: monthStart } },
      _sum: { totalAmount: true },
      _count: true
    }),
    prisma.saleAdjustment.aggregate({
      where: { shopId, createdAt: { gte: monthStart } },
      _sum: { totalAmount: true }
    }),
    prisma.saleItem.groupBy({
      by: ['productId', 'productName'],
      where: { sale: { shopId, status: 'COMPLETED' } },
      _sum: { qty: true, lineTotal: true },
      orderBy: { _sum: { qty: 'desc' } },
      take: 8
    }),
    prisma.product.findMany({
      where: {
        shopId,
        isActive: true,
        stockQty: { lte: settings?.lowStockThreshold ?? 5 }
      },
      orderBy: { stockQty: 'asc' },
      take: 8
    }),
    prisma.purchaseReceipt.findMany({
      where: { shopId, receivedAt: { gte: monthStart } },
      select: {
        purchaseId: true,
        items: {
          select: {
            qtyReceived: true,
            purchaseItem: {
              select: {
                unitCost: true
              }
            }
          }
        }
      }
    })
  ]);

  const currency = settings?.currencySymbol ?? 'â‚±';
  const dailyNet = Number(daily._sum.totalAmount ?? 0) - Number(dailyRefunds._sum.totalAmount ?? 0);
  const weeklyNet = Number(weekly._sum.totalAmount ?? 0) - Number(weeklyRefunds._sum.totalAmount ?? 0);
  const monthlyNet = Number(monthly._sum.totalAmount ?? 0) - Number(monthlyRefunds._sum.totalAmount ?? 0);
  const purchaseSpend = purchaseReceipts.reduce(
    (sum, receipt) =>
      sum +
      receipt.items.reduce(
        (receiptSum, item) => receiptSum + item.qtyReceived * Number(item.purchaseItem.unitCost.toString()),
        0
      ),
    0
  );
  const purchaseCount = new Set(purchaseReceipts.map((receipt) => receipt.purchaseId)).size;

  return (
    <div className="space-y-6">
      <AppHeader
        title="Reports"
        subtitle="Track net revenue after refunds and voids, plus purchasing, top sellers, and low-stock pressure."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[
          ['Today', money(dailyNet, currency), `${daily._count} completed sale(s)`],
          ['Last 7 days', money(weeklyNet, currency), `${weekly._count} completed sale(s)`],
          ['This month', money(monthlyNet, currency), `${monthly._count} completed sale(s)`],
          ['Purchases received', money(purchaseSpend, currency), `${purchaseCount} purchase(s) with receipt activity`]
        ].map(([title, value, meta]) => (
          <Card key={title}>
            <div className="text-sm text-stone-500">{title}</div>
            <div className="mt-2 text-3xl font-black text-stone-900">{value}</div>
            <div className="mt-2 text-sm text-stone-500">{meta}</div>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Top-selling products</h2>
          <div className="mt-4 space-y-3">
            {topProducts.length ? (
              topProducts.map((item) => (
                <div key={item.productId} className="flex justify-between rounded-2xl border border-stone-200 p-4">
                  <div>
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-sm text-stone-500">{item._sum.qty ?? 0} units sold</div>
                  </div>
                  <div className="font-black text-stone-900">
                    {money(item._sum.lineTotal?.toString() ?? '0', currency)}
                  </div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No completed sales yet.</div>
            )}
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Low-stock products</h2>
          <div className="mt-4 space-y-3">
            {lowStock.length ? (
              lowStock.map((item) => (
                <div key={item.id} className="flex justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4">
                  <div>
                    <div className="font-semibold text-stone-900">{item.name}</div>
                    <div className="text-sm text-stone-500">Reorder at {item.reorderPoint}</div>
                  </div>
                  <div className="text-lg font-black text-amber-700">{item.stockQty}</div>
                </div>
              ))
            ) : (
              <div className="text-sm text-stone-500">No low-stock products right now.</div>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}
