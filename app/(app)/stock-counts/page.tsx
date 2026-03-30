import AppHeader from '@/components/layout/AppHeader';
import StockCountsManager from '@/components/inventory/StockCountsManager';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export default async function StockCountsPage() {
  const { shopId } = await requirePageRole('CASHIER');

  const stockCounts = await prisma.stockCount.findMany({
    where: { shopId },
    include: {
      items: {
        select: {
          actualQty: true
        }
      },
      createdByUser: {
        select: {
          name: true,
          email: true
        }
      },
      approvedByUser: {
        select: {
          name: true,
          email: true
        }
      }
    },
    orderBy: { createdAt: 'desc' },
    take: 100
  });

  return (
    <div className="space-y-6">
      <AppHeader
        title="Stock Counts"
        subtitle="Run formal stock takes with blind count support, per-product count sheets, approval before posting, and a clear variance trail."
      />

      <StockCountsManager
        stockCounts={stockCounts.map((stockCount) => ({
          id: stockCount.id,
          referenceNumber: stockCount.referenceNumber,
          title: stockCount.title,
          status: stockCount.status,
          isBlind: stockCount.isBlind,
          notes: stockCount.notes,
          createdAt: stockCount.createdAt.toISOString(),
          startedAt: stockCount.startedAt?.toISOString() ?? null,
          submittedAt: stockCount.submittedAt?.toISOString() ?? null,
          approvedAt: stockCount.approvedAt?.toISOString() ?? null,
          postedAt: stockCount.postedAt?.toISOString() ?? null,
          createdBy: stockCount.createdByUser.name ?? stockCount.createdByUser.email,
          approvedBy: stockCount.approvedByUser
            ? stockCount.approvedByUser.name ?? stockCount.approvedByUser.email
            : null,
          itemCount: stockCount.items.length,
          countedItemCount: stockCount.items.filter((item) => item.actualQty !== null).length
        }))}
      />
    </div>
  );
}
