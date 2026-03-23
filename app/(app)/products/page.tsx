import AppHeader from '@/components/layout/AppHeader';
import ProductManager from '@/components/products/ProductManager';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function ProductsPage() {
  const { shopId } = await getActiveShopContext();
  const [products, categories, settings] = await Promise.all([
    prisma.product.findMany({ where: { shopId }, include: { category: true }, orderBy: { createdAt: 'desc' } }),
    prisma.category.findMany({ where: { shopId }, orderBy: { name: 'asc' } }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader title="Products" subtitle="Maintain products, pricing, stock quantities, and category assignment." />
      <ProductManager initialProducts={products.map((product) => ({ ...product, cost: product.cost.toString(), price: product.price.toString() }))} categories={categories} currencySymbol={settings?.currencySymbol ?? '₱'} />
    </div>
  );
}
