import AppHeader from '@/components/layout/AppHeader';
import ProductManager from '@/components/products/ProductManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export default async function ProductsPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const [products, categories, settings] = await Promise.all([
    prisma.product.findMany({
      where: { shopId },
      include: { category: true },
      orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }]
    }),
    prisma.category.findMany({
      where: { shopId },
      orderBy: { name: 'asc' }
    }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Products"
        subtitle="Maintain products, pricing, archive status, and reorder behavior without bypassing stock controls."
      />
      <ProductManager
        initialProducts={products.map((product) => ({
          ...product,
          cost: product.cost.toString(),
          price: product.price.toString()
        }))}
        categories={categories}
        currencySymbol={settings?.currencySymbol ?? '₱'}
        lowStockThreshold={settings?.lowStockThreshold ?? 5}
      />
    </div>
  );
}
