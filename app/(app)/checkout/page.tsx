import AppHeader from '@/components/layout/AppHeader';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function CheckoutPage() {
  const { shopId, session } = await getActiveShopContext();

  const [products, categories, settings] = await Promise.all([
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
      where: { shopId },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
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
        currencySymbol={settings?.currencySymbol ?? '₱'}
        cashierName={session.user.name ?? 'Cashier'}
      />
    </div>
  );
}