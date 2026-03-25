import AppHeader from '@/components/layout/AppHeader';
import SupplierManager from '@/components/suppliers/SupplierManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export default async function SuppliersPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const suppliers = await prisma.supplier.findMany({
    where: { shopId },
    include: { _count: { select: { purchases: true } } },
    orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
  });

  return (
    <div className="space-y-6">
      <AppHeader
        title="Suppliers"
        subtitle="Maintain supplier contacts, archive old vendors safely, and keep procurement data clean."
      />
      <SupplierManager initialSuppliers={suppliers} />
    </div>
  );
}
