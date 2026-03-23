import AppHeader from '@/components/layout/AppHeader';
import SupplierManager from '@/components/suppliers/SupplierManager';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function SuppliersPage() {
  const { shopId } = await getActiveShopContext();
  const suppliers = await prisma.supplier.findMany({ where: { shopId }, include: { _count: { select: { purchases: true } } }, orderBy: { name: 'asc' } });

  return (
    <div className="space-y-6">
      <AppHeader title="Suppliers" subtitle="Maintain supplier contacts and use them when receiving stock or recording purchases." />
      <SupplierManager initialSuppliers={suppliers} />
    </div>
  );
}
