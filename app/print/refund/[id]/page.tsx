import { notFound } from 'next/navigation';
import AdjustmentReceipt from '@/components/receipts/AdjustmentReceipt';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function PrintAdjustmentReceiptPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { shopId, shop } = await getActiveShopContext();

  const [adjustment, settings] = await Promise.all([
    prisma.saleAdjustment.findFirst({
      where: {
        id,
        shopId
      },
      include: {
        sale: {
          select: {
            saleNumber: true,
            receiptNumber: true,
            customerName: true
          }
        },
        items: {
          orderBy: [{ itemType: 'asc' }, { createdAt: 'asc' }]
        },
        refundPayments: {
          orderBy: { createdAt: 'asc' }
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
        },
        exchangeSale: {
          select: {
            saleNumber: true,
            receiptNumber: true,
            subtotal: true,
            taxAmount: true,
            discountAmount: true,
            totalAmount: true,
            paymentMethod: true
          }
        }
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: {
        currencySymbol: true,
        receiptHeader: true,
        receiptFooter: true
      }
    })
  ]);

  if (!adjustment) {
    return notFound();
  }

  return (
    <main className="min-h-screen bg-stone-50 p-6">
      <AdjustmentReceipt
        autoprint={query.autoprint === '1'}
        currencySymbol={settings?.currencySymbol ?? 'â‚±'}
        receiptHeader={settings?.receiptHeader}
        receiptFooter={settings?.receiptFooter}
        shop={{
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          email: shop.email
        }}
        adjustment={{
          adjustmentNumber: adjustment.adjustmentNumber,
          type: adjustment.type,
          reason: adjustment.reason,
          notes: adjustment.notes,
          subtotal: adjustment.subtotal.toString(),
          totalAmount: adjustment.totalAmount.toString(),
          createdAt: adjustment.createdAt.toISOString(),
          createdBy: adjustment.createdByUser.name ?? adjustment.createdByUser.email,
          approvedBy: adjustment.approvedByUser.name ?? adjustment.approvedByUser.email,
          saleNumber: adjustment.sale.saleNumber,
          receiptNumber: adjustment.sale.receiptNumber,
          customerName: adjustment.sale.customerName,
          items: adjustment.items.map((item) => ({
            id: item.id,
            itemType: item.itemType,
            productName: item.productName,
            qty: item.qty,
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString(),
            disposition: item.disposition
          })),
          refundPayments: adjustment.refundPayments.map((payment) => ({
            id: payment.id,
            method: payment.method,
            amount: payment.amount.toString(),
            referenceNumber: payment.referenceNumber
          })),
          exchangeSale: adjustment.exchangeSale
            ? {
                saleNumber: adjustment.exchangeSale.saleNumber,
                receiptNumber: adjustment.exchangeSale.receiptNumber,
                subtotal: adjustment.exchangeSale.subtotal.toString(),
                taxAmount: adjustment.exchangeSale.taxAmount.toString(),
                discountAmount: adjustment.exchangeSale.discountAmount.toString(),
                totalAmount: adjustment.exchangeSale.totalAmount.toString(),
                paymentMethod: adjustment.exchangeSale.paymentMethod
              }
            : null
        }}
      />
    </main>
  );
}
