import AppHeader from '@/components/layout/AppHeader';
import CategoryManager from '@/components/categories/CategoryManager';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function CategoriesPage() {
  const { shopId } = await getActiveShopContext();
  const categories = await prisma.category.findMany({
    where: { shopId },
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true, children: true } } }
  });

  return (
    <div className="space-y-6">
      <AppHeader title="Categories" subtitle="Organize products into categories and subcategories without breaking existing product assignments." />
      <CategoryManager initialCategories={categories} />
    </div>
  );
}
