import AppHeader from '@/components/layout/AppHeader';
import SupplierManager from '@/components/suppliers/SupplierManager';
import type { Supplier as SupplierView } from '@/components/suppliers/SupplierManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { serializeSupplierInvoice } from '@/lib/purchases';

export default async function SuppliersPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const [suppliers, settings] = await Promise.all([
    prisma.supplier.findMany({
      where: { shopId },
      include: {
        _count: { select: { purchases: true, invoices: true } },
        invoices: {
          include: {
            purchase: {
              select: {
                id: true,
                purchaseNumber: true,
                status: true
              }
            },
            payments: {
              include: {
                createdByUser: {
                  select: {
                    id: true,
                    name: true,
                    email: true
                  }
                }
              },
              orderBy: [{ paidAt: 'desc' }, { createdAt: 'desc' }]
            },
            payableEntry: true
          },
          orderBy: [{ dueDate: 'asc' }, { createdAt: 'desc' }]
        }
      },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }]
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Suppliers"
        subtitle="Keep supplier contacts, invoices, outstanding balances, and payment history visible from one practical operations screen."
      />
      <SupplierManager
        initialSuppliers={suppliers.map((supplier) => ({
          ...supplier,
          invoices: supplier.invoices.map(serializeSupplierInvoice)
        })) as unknown as SupplierView[]}
        currencySymbol={settings?.currencySymbol ?? 'PHP '}
      />
    </div>
  );
}
