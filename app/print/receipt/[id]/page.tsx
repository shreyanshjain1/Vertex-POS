import { notFound } from 'next/navigation';
import ThermalReceipt from '@/components/receipts/ThermalReceipt';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function PrintReceiptPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { shopId, shop } = await getActiveShopContext();
  const { id } = await params;
  const query = await searchParams;

  const [sale, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, shopId },
      include: {
        items: true,
        customer: {
          select: {
            email: true,
            businessName: true
          }
        },
        customerCreditLedger: true,
        payments: {
          orderBy: { createdAt: 'asc' }
        }
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    })
  ]);

  if (!sale) {
    return notFound();
  }

  const payments = sale.payments.length
    ? sale.payments.map((payment) => ({
        id: payment.id,
        method: payment.method,
        amount: payment.amount.toString(),
        referenceNumber: payment.referenceNumber,
        createdAt: payment.createdAt.toISOString()
      }))
    : sale.isCreditSale
      ? []
      : [
        {
          id: `legacy-${sale.id}`,
          method: sale.paymentMethod,
          amount: sale.totalAmount.toString(),
          referenceNumber: null,
          createdAt: sale.createdAt.toISOString()
        }
      ];

  const totalPaid = payments.reduce((sum, payment) => sum + Number(payment.amount), 0);
  const cashReceived = payments
    .filter((payment) => payment.method === 'Cash')
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const changeDue = sale.payments.length ? Number(sale.changeDue) : 0;

  return (
    <main className="min-h-screen bg-stone-50 p-6">
      <ThermalReceipt
        autoprint={query.autoprint === '1'}
        currencySymbol={settings?.currencySymbol ?? '₱'}
        receiptHeader={settings?.receiptHeader}
        receiptFooter={settings?.receiptFooter}
        receiptWidth={settings?.receiptWidth === '58mm' ? '58mm' : '80mm'}
        shop={{
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          email: shop.email
        }}
        sale={{
          id: sale.id,
          saleNumber: sale.saleNumber,
          receiptNumber: sale.receiptNumber,
          paymentMethod: sale.paymentMethod,
          cashierName: sale.cashierName,
          customerEmail: sale.customer?.email ?? null,
          customerBusinessName: sale.customer?.businessName ?? null,
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          isCreditSale: sale.isCreditSale,
          creditDueDate: sale.customerCreditLedger?.dueDate.toISOString() ?? null,
          loyaltyPointsEarned: sale.loyaltyPointsEarned,
          loyaltyPointsRedeemed: sale.loyaltyPointsRedeemed,
          loyaltyDiscountAmount: sale.loyaltyDiscountAmount.toString(),
          subtotal: sale.subtotal.toString(),
          taxAmount: sale.taxAmount.toString(),
          discountAmount: sale.discountAmount.toString(),
          totalAmount: sale.totalAmount.toString(),
          totalPaid: totalPaid.toFixed(2),
          cashReceived: cashReceived.toFixed(2),
          changeDue: changeDue.toFixed(2),
          notes: sale.notes,
          createdAt: sale.createdAt.toISOString(),
          payments,
          items: sale.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            qty: item.qty,
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString()
          }))
        }}
      />
    </main>
  );
}
