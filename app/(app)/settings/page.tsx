import AppHeader from '@/components/layout/AppHeader';
import SettingsForm from '@/components/settings/SettingsForm';
import { requirePageRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

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
        subtitle="Manage business identity, tax, currency, receipt content, print width, numbering prefixes, and low-stock defaults."
      />
      <SettingsForm
        initialValues={{
          shopName: shop.name,
          phone: shop.phone,
          email: shop.email,
          address: shop.address,
          taxId: shop.taxId,
          currencyCode: settings?.currencyCode ?? 'PHP',
          currencySymbol: settings?.currencySymbol ?? '₱',
          taxRate: settings?.taxRate.toString() ?? '0',
          receiptHeader: settings?.receiptHeader ?? '',
          receiptFooter: settings?.receiptFooter ?? '',
          receiptWidth: settings?.receiptWidth === '58mm' ? '58mm' : '80mm',
          lowStockEnabled: settings?.lowStockEnabled ?? true,
          lowStockThreshold: settings?.lowStockThreshold ?? 5,
          salePrefix: settings?.salePrefix ?? 'SAL',
          receiptPrefix: settings?.receiptPrefix ?? 'RCP',
          purchasePrefix: settings?.purchasePrefix ?? 'PO'
        }}
      />
    </div>
  );
}
