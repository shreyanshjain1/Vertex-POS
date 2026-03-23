import { notFound } from 'next/navigation';
import ThermalReceipt from '@/components/receipts/ThermalReceipt';
import AppHeader from '@/components/layout/AppHeader';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function SaleReceiptPage({
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
        items: true
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    })
  ]);

  if (!sale) return notFound();

  return (
    <div className="space-y-6">
      <AppHeader
        title="Receipt"
        subtitle={`Receipt ${sale.receiptNumber} ready for thermal printing or PDF export.`}
      />

      <ThermalReceipt
        autoprint={query.autoprint === '1'}
        currencySymbol={settings?.currencySymbol ?? '₱'}
        receiptHeader={settings?.receiptHeader}
        receiptFooter={settings?.receiptFooter}
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
          customerName: sale.customerName,
          customerPhone: sale.customerPhone,
          subtotal: sale.subtotal.toString(),
          taxAmount: sale.taxAmount.toString(),
          discountAmount: sale.discountAmount.toString(),
          totalAmount: sale.totalAmount.toString(),
          notes: sale.notes,
          createdAt: sale.createdAt.toISOString(),
          items: sale.items.map((item) => ({
            id: item.id,
            productName: item.productName,
            qty: item.qty,
            unitPrice: item.unitPrice.toString(),
            lineTotal: item.lineTotal.toString()
          }))
        }}
      />
    </div>
  );
}