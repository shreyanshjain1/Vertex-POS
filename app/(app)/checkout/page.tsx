import AppHeader from '@/components/layout/AppHeader';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { hasRole } from '@/lib/authz';
import {
  cleanupExpiredParkedSales,
  serializeParkedSale
} from '@/lib/parked-sales';
import { prisma } from '@/lib/prisma';
import { getActiveCashSession } from '@/lib/register';

export default async function CheckoutPage() {
  const { shopId, session, role, userId } = await getActiveShopContext();

  await cleanupExpiredParkedSales(prisma, shopId);

  const [products, categories, settings, activeCashSession, parkedSales] = await Promise.all([
    prisma.product.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true
          }
        }
      }
    }),
    prisma.category.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    }),
    getActiveCashSession(prisma, shopId, session.user.id),
    prisma.parkedSale.findMany({
      where: {
        shopId,
        status: 'HELD',
        expiresAt: {
          gt: new Date()
        },
        ...(hasRole(role, 'MANAGER') ? {} : { cashierUserId: userId })
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
      orderBy: { createdAt: 'desc' },
      take: 20
    })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Checkout"
        subtitle="Process sales quickly, prevent overselling, and generate receipt-ready transactions."
      />

      <CheckoutClient
        products={products.map((product) => ({
          id: product.id,
          name: product.name,
          barcode: product.barcode,
          sku: product.sku,
          price: product.price.toString(),
          stockQty: product.stockQty,
          categoryId: product.categoryId,
          category: product.category
            ? {
                id: product.category.id,
                name: product.category.name
              }
            : null
        }))}
        categories={categories}
        taxRate={Number(settings?.taxRate ?? 12)}
        currencySymbol={settings?.currencySymbol ?? 'â‚±'}
        cashierName={session.user.name ?? 'Cashier'}
        hasActiveCashSession={Boolean(activeCashSession)}
        initialParkedSales={parkedSales.map(serializeParkedSale)}
      />
    </div>
  );
}
