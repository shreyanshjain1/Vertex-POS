import AppHeader from '@/components/layout/AppHeader';
import RegisterOpenForm from '@/components/register/RegisterOpenForm';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { getActiveCashSession } from '@/lib/register';
import { serializeCashSession } from '@/lib/serializers/register';

export default async function RegisterOpenPage() {
  const { shopId, userId } = await requirePageRole('CASHIER');
  const [settings, activeSession] = await Promise.all([
    prisma.shopSetting.findUnique({ where: { shopId } }),
    getActiveCashSession(prisma, shopId, userId)
  ]);

  return (
    <div className="space-y-6">
      <AppHeader
        title="Open register"
        subtitle="Start a cash drawer session with an opening float before accepting cash payments."
      />
      <RegisterOpenForm
        currencySymbol={settings?.currencySymbol ?? '₱'}
        activeSession={activeSession ? serializeCashSession(activeSession) : null}
        openingFloatRequired={settings?.openingFloatRequired ?? true}
        openingFloatAmount={settings?.openingFloatAmount?.toString() ?? '0'}
      />
    </div>
  );
}
