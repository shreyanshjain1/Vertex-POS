import AppHeader from '@/components/layout/AppHeader';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function CheckoutPage() {
  const { shopId, session } = await getActiveShopContext();

  const [products, settings] = await Promise.all([
    prisma.product.findMany({
      where: { shopId, isActive: true },
      orderBy: { name: 'asc' },
      include: {
        category: {
          select: {
            id: true,
            name: true,
            slug: true,
            shopId: true,
            createdAt: true,
            updatedAt: true
          }
        }
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
          shopId: product.shopId,
          categoryId: product.categoryId,
          sku: product.sku,
          barcode: product.barcode,
          name: product.name,
          description: product.description,
          cost: product.cost.toString(),
          price: product.price.toString(),
          stockQty: product.stockQty,
          reorderPoint: product.reorderPoint,
          isActive: product.isActive,
          createdAt: product.createdAt.toISOString(),
          updatedAt: product.updatedAt.toISOString(),
          category: product.category
            ? {
                id: product.category.id,
                name: product.category.name,
                slug: product.category.slug,
                shopId: product.category.shopId,
                createdAt: product.category.createdAt.toISOString(),
                updatedAt: product.category.updatedAt.toISOString()
              }
            : null
        }))}
        taxRate={Number(settings?.taxRate ?? 0)}
        currencySymbol={settings?.currencySymbol ?? '₱'}
        cashierName={session.user.name ?? 'Cashier'}
      />
    </div>
  );
}