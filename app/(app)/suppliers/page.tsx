import AppHeader from '@/components/layout/AppHeader';
import SupplierManager from '@/components/suppliers/SupplierManager';
import SupplierReturnManager from '@/components/suppliers/SupplierReturnManager';
import type { Supplier as SupplierView } from '@/components/suppliers/SupplierManager';
import type { SupplierReturn as SupplierReturnView } from '@/components/suppliers/SupplierReturnManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { supplierReturnDetailInclude } from '@/lib/supplier-return-operations';
import { serializeSupplierInvoice } from '@/lib/purchases';
import { serializeSupplierReturn } from '@/lib/supplier-returns';

export default async function SuppliersPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const [suppliers, products, supplierReturns, settings] = await Promise.all([
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
    prisma.product.findMany({
      where: { shopId, isActive: true },
      select: {
        id: true,
        name: true,
        cost: true,
        stockQty: true,
        isActive: true
      },
      orderBy: { name: 'asc' }
    }),
    prisma.supplierReturn.findMany({
      where: { shopId },
      include: supplierReturnDetailInclude,
      orderBy: [{ createdAt: 'desc' }]
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Suppliers"
        subtitle="Keep supplier contacts, invoices, outstanding balances, and payment history visible from one practical operations screen."
      />
      <SupplierReturnManager
        suppliers={suppliers.map((supplier) => ({
          id: supplier.id,
          name: supplier.name,
          isActive: supplier.isActive
        }))}
        products={products.map((product) => ({
          ...product,
          cost: product.cost.toString()
        }))}
        supplierReturns={supplierReturns.map((supplierReturn) => serializeSupplierReturn(supplierReturn) as unknown as SupplierReturnView)}
        currencySymbol={settings?.currencySymbol ?? 'PHP '}
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
