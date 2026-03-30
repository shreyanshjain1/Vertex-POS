import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import SaleAdjustmentManager from '@/components/sales/SaleAdjustmentManager';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { saleDetailInclude, serializeSaleDetail } from '@/lib/sale-adjustments';

export default async function SaleVoidPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { shopId, session } = await getActiveShopContext();

  const [sale, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, shopId },
      include: saleDetailInclude
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: {
        currencySymbol: true
      }
    })
  ]);

  if (!sale) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title={`Void ${sale.saleNumber}`}
        subtitle="Reverse the entire sale, restore stock, record the payout method, and keep the approval trail attached to the adjustment."
      />

      <SaleAdjustmentManager
        mode="void"
        sale={serializeSaleDetail(sale)}
        currencySymbol={settings?.currencySymbol ?? 'â‚±'}
        currentUserEmail={session.user.email ?? ''}
      />
    </div>
  );
}
