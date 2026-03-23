import AppHeader from '@/components/layout/AppHeader';
import SalesTable from '@/components/sales/SalesTable';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function SalesPage() {
  const { shopId } = await getActiveShopContext();
  const [sales, settings] = await Promise.all([
    prisma.sale.findMany({ where: { shopId }, orderBy: { createdAt: 'desc' }, take: 50 }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader title="Sales history" subtitle="Searchable transaction history with receipts and item breakdown available per sale." />
      <SalesTable sales={sales.map((sale) => ({ ...sale, totalAmount: sale.totalAmount.toString(), createdAt: sale.createdAt.toISOString() }))} currencySymbol={settings?.currencySymbol ?? '₱'} />
    </div>
  );
}
