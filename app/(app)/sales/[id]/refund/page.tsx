import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import SaleAdjustmentManager from '@/components/sales/SaleAdjustmentManager';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { saleDetailInclude, serializeSaleDetail } from '@/lib/sale-adjustments';

export default async function SaleRefundPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { shopId, session } = await getActiveShopContext();

  const [sale, settings, products] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, shopId },
      include: saleDetailInclude
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: {
        currencySymbol: true,
        taxRate: true
      }
    }),
    prisma.product.findMany({
      where: {
        shopId,
        isActive: true
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        sku: true,
        barcode: true,
        price: true,
        stockQty: true
      }
    })
  ]);

  if (!sale) {
    return notFound();
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title={`Refund / Exchange ${sale.saleNumber}`}
        subtitle="Process full refunds, partial refunds, damaged returns, and exchanges with manager approval and a printable adjustment receipt."
      />

      <SaleAdjustmentManager
        mode="refund"
        sale={serializeSaleDetail(sale)}
        products={products.map((product) => ({
          ...product,
          price: product.price.toString()
        }))}
        taxRate={Number(settings?.taxRate ?? 0)}
        currencySymbol={settings?.currencySymbol ?? 'â‚±'}
        currentUserEmail={session.user.email ?? ''}
      />
    </div>
  );
}
