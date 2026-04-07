import AppHeader from '@/components/layout/AppHeader';
import ParkedSalesManager from '@/components/parked-sales/ParkedSalesManager';
import { requirePageRole } from '@/lib/authz';
import { cleanupExpiredParkedSales, serializeParkedSale } from '@/lib/parked-sales';
import { prisma } from '@/lib/prisma';

export default async function ParkedSalesPage() {
  const { shopId, userId, role } = await requirePageRole('CASHIER');

  await cleanupExpiredParkedSales(prisma, shopId);

  const [parkedSales, settings] = await Promise.all([
    prisma.parkedSale.findMany({
      where: {
        shopId,
        status: 'HELD',
        expiresAt: {
          gt: new Date()
        }
      },
      include: {
        cashier: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        items: {
          orderBy: { createdAt: 'asc' }
        }
      },
      orderBy: [{ type: 'desc' }, { createdAt: 'desc' }],
      take: 100
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: { currencySymbol: true }
    })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Saved carts and quotes"
        subtitle="Review held checkout work, filter quotes versus saved carts, jump a quote back into checkout, and print customer-ready quote copies without digging through the checkout screen."
      />
      <ParkedSalesManager
        initialParkedSales={parkedSales.map(serializeParkedSale)}
        currencySymbol={settings?.currencySymbol ?? '₱'}
        currentUserId={userId}
        role={role}
      />
    </div>
  );
}
