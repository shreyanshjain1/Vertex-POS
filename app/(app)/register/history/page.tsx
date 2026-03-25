import AppHeader from '@/components/layout/AppHeader';
import RegisterHistoryTable from '@/components/register/RegisterHistoryTable';
import { hasRole, requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { serializeCashSession } from '@/lib/serializers/register';

export default async function RegisterHistoryPage() {
  const { shopId, userId, role } = await requirePageRole('CASHIER');
  const [settings, sessions] = await Promise.all([
    prisma.shopSetting.findUnique({ where: { shopId } }),
    prisma.cashSession.findMany({
      where: {
        shopId,
        ...(hasRole(role, 'MANAGER') ? {} : { userId })
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      },
      orderBy: { openedAt: 'desc' },
      take: 100
    })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Register history"
        subtitle="Review open and closed drawer sessions, cash expectations, counted totals, and over or short outcomes."
      />
      <RegisterHistoryTable
        sessions={sessions.map(serializeCashSession)}
        currencySymbol={settings?.currencySymbol ?? 'â‚±'}
      />
    </div>
  );
}
