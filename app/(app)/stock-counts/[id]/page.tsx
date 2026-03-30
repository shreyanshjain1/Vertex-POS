import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import StockCountDetailManager from '@/components/inventory/StockCountDetailManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { serializeStockCount, stockCountInclude } from '@/lib/stock-counts';

export default async function StockCountDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { shopId, role, userId } = await requirePageRole('CASHIER');

  const stockCount = await prisma.stockCount.findFirst({
    where: { id, shopId },
    include: stockCountInclude
  });

  if (!stockCount) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title={`Stock Count ${stockCount.referenceNumber}`}
        subtitle="Capture physical counts, compare actuals against expectations, then route the variance through approval before posting inventory changes."
      />

      <StockCountDetailManager
        initialStockCount={serializeStockCount(stockCount)}
        currentRole={role}
        currentUserId={userId}
      />
    </div>
  );
}
