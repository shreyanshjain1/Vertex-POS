import AppHeader from '@/components/layout/AppHeader';
import CategoryManager from '@/components/categories/CategoryManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export default async function CategoriesPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const categories = await prisma.category.findMany({
    where: { shopId },
    orderBy: [{ parentId: 'asc' }, { name: 'asc' }],
    include: { _count: { select: { products: true, children: true } } }
  });

  return (
    <div className="space-y-6">
      <AppHeader
        title="Categories"
        subtitle="Organize the catalog without breaking product assignments or creating duplicate category trees."
      />
      <CategoryManager initialCategories={categories} />
    </div>
  );
}
