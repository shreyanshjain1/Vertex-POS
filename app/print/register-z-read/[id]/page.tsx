import { notFound } from 'next/navigation';
import RegisterZReadReceipt from '@/components/receipts/RegisterZReadReceipt';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { buildCashSessionSummary } from '@/lib/register';
import {
  serializeCashSession,
  serializeRegisterSessionSummary
} from '@/lib/serializers/register';

export default async function PrintRegisterZReadPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { shopId, shop } = await getActiveShopContext();
  const { id } = await params;
  const query = await searchParams;

  const [cashSession, settings] = await Promise.all([
    prisma.cashSession.findFirst({
      where: {
        id,
        shopId
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        closedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reviewedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reopenedByUser: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    })
  ]);

  if (!cashSession) {
    return notFound();
  }

  const summary = await buildCashSessionSummary(
    prisma,
    cashSession,
    cashSession.closedAt ?? new Date()
  );

  return (
    <main className="min-h-screen bg-stone-50 p-6">
      <RegisterZReadReceipt
        autoprint={query.autoprint === '1'}
        currencySymbol={settings?.currencySymbol ?? 'PHP '}
        session={serializeCashSession(cashSession)}
        summary={serializeRegisterSessionSummary(summary)}
        shop={{
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          email: shop.email
        }}
      />
    </main>
  );
}
