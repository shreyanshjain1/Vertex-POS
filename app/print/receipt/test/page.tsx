import ThermalReceipt from '@/components/receipts/ThermalReceipt';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function ReceiptPrintTestPage({
  searchParams
}: {
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { shopId, shop } = await getActiveShopContext();
  const query = await searchParams;
  const settings = await prisma.shopSetting.findUnique({ where: { shopId } });
  const now = new Date();
  const receiptNumber = `${settings?.receiptPrefix ?? 'RCP'}-TEST-${now
    .toISOString()
    .slice(2, 10)
    .replaceAll('-', '')}`;
  const saleNumber = `${settings?.salePrefix ?? 'SAL'}-TEST-${now
    .toISOString()
    .slice(11, 19)
    .replaceAll(':', '')}`;

  return (
    <main className="min-h-screen bg-stone-50 p-6">
      <ThermalReceipt
        autoprint={query.autoprint === '1'}
        testMode
        currencySymbol={settings?.currencySymbol ?? 'PHP '}
        receiptHeader={settings?.receiptHeader ?? shop.name}
        receiptFooter={
          settings?.receiptFooter ?? 'Printer test page for thermal alignment and cashier training.'
        }
        receiptWidth={settings?.receiptWidth === '58mm' ? '58mm' : '80mm'}
        receiptShowBrandMark={settings?.receiptShowBrandMark ?? false}
        printerSafeMode={settings?.printerSafeMode ?? true}
        cashDrawerKickEnabled={settings?.cashDrawerKickEnabled ?? false}
        shop={{
          name: shop.name,
          address: shop.address,
          phone: shop.phone,
          email: shop.email
        }}
        sale={{
          id: 'thermal-print-test',
          saleNumber,
          receiptNumber,
          paymentMethod: 'Cash',
          cashierName: 'Printer Test',
          customerEmail: null,
          customerBusinessName: null,
          customerName: 'Walk-in',
          customerPhone: null,
          isCreditSale: false,
          creditDueDate: null,
          loyaltyPointsEarned: 0,
          loyaltyPointsRedeemed: 0,
          loyaltyDiscountAmount: '0.00',
          subtotal: '187.00',
          taxAmount: '22.44',
          discountAmount: '7.00',
          totalAmount: '202.44',
          totalPaid: '210.00',
          cashReceived: '210.00',
          changeDue: '7.56',
          notes:
            'Use this page to check margins, barcode clarity, paper width, and the cash drawer trigger.',
          createdAt: now.toISOString(),
          payments: [
            {
              id: 'cash',
              method: 'Cash',
              amount: '210.00',
              referenceNumber: null,
              createdAt: now.toISOString()
            }
          ],
          items: [
            {
              id: 'line-1',
              productName: 'Thermal print alignment sample',
              qty: 1,
              unitPrice: '125.00',
              lineTotal: '125.00'
            },
            {
              id: 'line-2',
              productName: 'Compact layout width check',
              qty: 2,
              unitPrice: '31.00',
              lineTotal: '62.00'
            }
          ]
        }}
      />
    </main>
  );
}
