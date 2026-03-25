import AppHeader from '@/components/layout/AppHeader';
import RegisterCloseManager from '@/components/register/RegisterCloseManager';
import { hasRole, requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { computeClosingExpectedCash, getActiveCashSessionsForShop } from '@/lib/register';
import { serializeCashSession } from '@/lib/serializers/register';

export default async function RegisterClosePage() {
  const { shopId, userId, role } = await requirePageRole('CASHIER');
  const [settings, openSessions] = await Promise.all([
    prisma.shopSetting.findUnique({ where: { shopId } }),
    getActiveCashSessionsForShop(prisma, shopId)
  ]);

  const visibleSessions = hasRole(role, 'MANAGER')
    ? openSessions
    : openSessions.filter((session) => session.userId === userId);

  const sessions = await Promise.all(
    visibleSessions.map(async (session) => ({
      ...serializeCashSession(session),
      expectedCash: String(await computeClosingExpectedCash(prisma, session, new Date())),
      canOverride: session.userId !== userId
    }))
  );

  return (
    <div className="space-y-6">
      <AppHeader
        title="Close register"
        subtitle="Count the drawer, compare actual cash with expected cash, and close open register sessions with a full audit trail."
      />
      <RegisterCloseManager
        initialSessions={sessions}
        currencySymbol={settings?.currencySymbol ?? 'â‚±'}
      />
    </div>
  );
}
