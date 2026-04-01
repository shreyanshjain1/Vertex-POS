import AppHeader from '@/components/layout/AppHeader';
import SettingsForm from '@/components/settings/SettingsForm';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { sanitizeDefaultPaymentMethods } from '@/lib/shop-settings';

export default async function SettingsPage() {
  const { shopId } = await requirePageRole('MANAGER');
  const [shop, settings] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId } }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  if (!shop) {
    return null;
  }

  return (
    <div className="space-y-6">
      <AppHeader
        title="Settings"
        subtitle="Manage branch identity, receipt setup, tax behavior, inventory defaults, payment defaults, and document numbering from one practical admin screen."
      />
      <SettingsForm
        initialValues={{
          shopName: shop.name,
          legalBusinessName: shop.legalBusinessName ?? shop.name,
          phone: shop.phone,
          email: shop.email,
          address: shop.address,
          taxId: shop.taxId,
          timezone: settings?.timezone ?? 'Asia/Manila',
          currencyCode: settings?.currencyCode ?? 'PHP',
          currencySymbol: settings?.currencySymbol ?? '₱',
          taxMode: settings?.taxMode ?? 'EXCLUSIVE',
          taxRate: settings?.taxRate.toString() ?? '0',
          receiptHeader: settings?.receiptHeader ?? '',
          receiptFooter: settings?.receiptFooter ?? '',
          receiptWidth: settings?.receiptWidth === '58mm' ? '58mm' : '80mm',
          defaultPaymentMethods: sanitizeDefaultPaymentMethods(settings?.defaultPaymentMethods),
          printerName: settings?.printerName ?? '',
          printerConnection: settings?.printerConnection ?? 'MANUAL',
          barcodeScannerNotes: settings?.barcodeScannerNotes ?? '',
          lowStockEnabled: settings?.lowStockEnabled ?? true,
          lowStockThreshold: settings?.lowStockThreshold ?? 5,
          offlineStockStrict: settings?.offlineStockStrict ?? false,
          offlineStockMaxAgeMinutes: settings?.offlineStockMaxAgeMinutes ?? 240,
          batchTrackingEnabled: settings?.batchTrackingEnabled ?? false,
          expiryTrackingEnabled: settings?.expiryTrackingEnabled ?? false,
          fefoEnabled: settings?.fefoEnabled ?? false,
          expiryAlertDays: settings?.expiryAlertDays ?? 30,
          openingFloatRequired: settings?.openingFloatRequired ?? true,
          openingFloatAmount: settings?.openingFloatAmount?.toString() ?? '0',
          salePrefix: settings?.salePrefix ?? 'SAL',
          receiptPrefix: settings?.receiptPrefix ?? 'RCP',
          purchasePrefix: settings?.purchasePrefix ?? 'PO'
        }}
      />
    </div>
  );
}
