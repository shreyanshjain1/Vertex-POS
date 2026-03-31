import AppHeader from '@/components/layout/AppHeader';
import ActivityLogTable from '@/components/activity/ActivityLogTable';
import Badge from '@/components/ui/Badge';
import Card from '@/components/ui/Card';
import { requirePageRole } from '@/lib/authz';
import { dateTime } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export default async function ActivityPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const [items, authItems] = await Promise.all([
    prisma.activityLog.findMany({
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
    }),
    prisma.authAuditLog.findMany({
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
      take: 50
    })
  ]);

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

      <Card>
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Security trail</div>
          <h2 className="mt-2 text-xl font-black text-stone-900">Authentication and account events</h2>
          <p className="mt-1 text-sm text-stone-500">Review sign-ins, blocked access, password reset activity, and verification events for this branch.</p>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">When</th>
                  <th className="px-4 py-3.5">User</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">IP</th>
                  <th className="px-4 py-3.5">User agent</th>
                </tr>
              </thead>
              <tbody>
                {authItems.map((item) => (
                  <tr key={item.id} className="border-t border-stone-200 bg-white">
                    <td className="px-4 py-4 text-stone-600">{dateTime(item.createdAt)}</td>
                    <td className="px-4 py-4 text-stone-700">{item.user?.name ?? item.user?.email ?? item.email ?? 'Unknown user'}</td>
                    <td className="px-4 py-4">
                      <Badge tone={item.action.includes('FAILURE') || item.action.includes('BLOCKED') ? 'red' : item.action.includes('SUCCESS') || item.action.includes('VERIFIED') ? 'emerald' : 'amber'}>
                        {item.action.replaceAll('_', ' ')}
                      </Badge>
                    </td>
                    <td className="px-4 py-4 text-stone-600">{item.ipAddress ?? 'N/A'}</td>
                    <td className="max-w-xs px-4 py-4 text-xs text-stone-500">{item.userAgent ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!authItems.length ? (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
              No security events have been recorded for this branch yet.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
