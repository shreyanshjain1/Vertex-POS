import AppHeader from '@/components/layout/AppHeader';
import RegisterCloseManager from '@/components/register/RegisterCloseManager';
import { hasRole, requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { buildCashSessionSummary, getActiveCashSessionsForShop } from '@/lib/register';
import {
  serializeCashSession,
  serializeRegisterSessionSummary
} from '@/lib/serializers/register';

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
    visibleSessions.map(async (session) => {
      const summary = await buildCashSessionSummary(prisma, session, new Date());

      return {
        ...serializeCashSession(session),
        expectedCash: summary.expectedCash.toFixed(2),
        canOverride: session.userId !== userId,
        canReview: hasRole(role, 'MANAGER'),
        canReopen: hasRole(role, 'MANAGER'),
        summary: serializeRegisterSessionSummary(summary)
      };
    })
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
