import AppHeader from '@/components/layout/AppHeader';
import Card from '@/components/ui/Card';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { money } from '@/lib/format';

export default async function ReportsPage() {
  const { shopId } = await getActiveShopContext();
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - 6);
  weekStart.setHours(0,0,0,0);

  const [daily, weekly, monthly, topProducts, lowStock, purchaseSummary] = await Promise.all([
    prisma.sale.aggregate({ where: { shopId, createdAt: { gte: new Date(new Date().setHours(0,0,0,0)) } }, _sum: { totalAmount: true }, _count: true }),
    prisma.sale.aggregate({ where: { shopId, createdAt: { gte: weekStart } }, _sum: { totalAmount: true }, _count: true }),
    prisma.sale.aggregate({ where: { shopId, createdAt: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true }),
    prisma.saleItem.groupBy({ by: ['productId', 'productName'], where: { sale: { shopId } }, _sum: { qty: true, lineTotal: true }, orderBy: { _sum: { qty: 'desc' } }, take: 8 }),
    prisma.product.findMany({ where: { shopId, isActive: true, stockQty: { lte: settings?.lowStockThreshold ?? 5 } }, orderBy: { stockQty: 'asc' }, take: 8 }),
    prisma.purchaseOrder.aggregate({ where: { shopId, createdAt: { gte: monthStart } }, _sum: { totalAmount: true }, _count: true })
  ]);
  const currency = settings?.currencySymbol ?? '₱';

  return (
    <div className="space-y-6">
      <AppHeader title="Reports" subtitle="Track revenue, purchasing, top sellers, and operational attention points." />
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {[['Today', money(daily._sum.totalAmount?.toString() ?? '0', currency), `${daily._count} sale(s)`], ['Last 7 days', money(weekly._sum.totalAmount?.toString() ?? '0', currency), `${weekly._count} sale(s)`], ['This month', money(monthly._sum.totalAmount?.toString() ?? '0', currency), `${monthly._count} sale(s)`], ['Purchases this month', money(purchaseSummary._sum.totalAmount?.toString() ?? '0', currency), `${purchaseSummary._count} purchase(s)`]].map(([title, value, meta]) => <Card key={title}><div className="text-sm text-stone-500">{title}</div><div className="mt-2 text-3xl font-black text-stone-900">{value}</div><div className="mt-2 text-sm text-stone-500">{meta}</div></Card>)}
      </div>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card><h2 className="text-xl font-black text-stone-900">Top-selling products</h2><div className="mt-4 space-y-3">{topProducts.length ? topProducts.map((item) => <div key={item.productId} className="flex justify-between rounded-2xl border border-stone-200 p-4"><div><div className="font-semibold text-stone-900">{item.productName}</div><div className="text-sm text-stone-500">{item._sum.qty ?? 0} units sold</div></div><div className="font-black text-stone-900">{money(item._sum.lineTotal?.toString() ?? '0', currency)}</div></div>) : <div className="text-sm text-stone-500">No sales yet.</div>}</div></Card>
        <Card><h2 className="text-xl font-black text-stone-900">Low-stock products</h2><div className="mt-4 space-y-3">{lowStock.length ? lowStock.map((item) => <div key={item.id} className="flex justify-between rounded-2xl border border-amber-200 bg-amber-50 p-4"><div><div className="font-semibold text-stone-900">{item.name}</div><div className="text-sm text-stone-500">Reorder at {item.reorderPoint}</div></div><div className="text-lg font-black text-amber-700">{item.stockQty}</div></div>) : <div className="text-sm text-stone-500">No low-stock products.</div>}</div></Card>
      </div>
    </div>
  );
}
