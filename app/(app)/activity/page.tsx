import AppHeader from '@/components/layout/AppHeader';
import ActivityLogTable from '@/components/activity/ActivityLogTable';
import Card from '@/components/ui/Card';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export default async function ActivityPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const items = await prisma.activityLog.findMany({
    where: { shopId },
    include: {
      user: {
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
        title="Activity log"
        subtitle="Review sales, stock adjustments, purchases, catalog changes, worker jobs, and settings updates in one place."
      />

      <Card>
        <ActivityLogTable
          items={items.map((item) => ({
            ...item,
            createdAt: item.createdAt.toISOString()
          }))}
        />
      </Card>
    </div>
  );
}
