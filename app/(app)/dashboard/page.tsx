import AppHeader from '@/components/layout/AppHeader';
import DashboardStats from '@/components/dashboard/DashboardStats';
import RecentSalesCard from '@/components/dashboard/RecentSalesCard';
import LowStockCard from '@/components/dashboard/LowStockCard';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { money } from '@/lib/format';

export default async function DashboardPage() {
  const { shopId, shop } = await getActiveShopContext();
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [totalProducts, totalSuppliers, lowStockProducts, recentSales, todaySales] = await Promise.all([
    prisma.product.count({ where: { shopId, isActive: true } }),
    prisma.supplier.count({ where: { shopId, isActive: true } }),
    prisma.product.findMany({ where: { shopId, isActive: true, stockQty: { lte: settings?.lowStockThreshold ?? 5 } }, include: { category: true }, orderBy: [{ stockQty: 'asc' }, { name: 'asc' }], take: 8 }),
    prisma.sale.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' }, take: 8, include: { items: true } }),
    prisma.sale.aggregate({ where: { shopId, createdAt: { gte: todayStart } }, _sum: { totalAmount: true } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader title="Dashboard" subtitle={`Welcome back. ${shop.name} is ready for today’s operations.`} />
      <DashboardStats totalProducts={totalProducts} lowStockCount={lowStockProducts.length} totalSuppliers={totalSuppliers} todaySales={money(todaySales._sum.totalAmount?.toString() ?? '0', settings?.currencySymbol ?? '₱')} />
      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <RecentSalesCard sales={recentSales.map((sale) => ({ ...sale, createdAt: sale.createdAt.toISOString(), totalAmount: sale.totalAmount.toString(), items: sale.items.map((item) => ({ ...item, lineTotal: item.lineTotal.toString() })) }))} currencySymbol={settings?.currencySymbol ?? '₱'} />
        <LowStockCard products={lowStockProducts.map((product) => ({ ...product, price: product.price.toString() }))} currencySymbol={settings?.currencySymbol ?? '₱'} />
      </div>
    </div>
  );
}
