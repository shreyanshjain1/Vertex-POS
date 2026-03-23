import AppHeader from '@/components/layout/AppHeader';
import SettingsForm from '@/components/settings/SettingsForm';
import { requireRole } from '@/lib/authz';
import { prisma } from '@/lib/prisma';

export default async function SettingsPage() {
  const { shopId } = await requireRole('MANAGER');
  const [shop, settings] = await Promise.all([
    prisma.shop.findUnique({ where: { id: shopId } }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  if (!shop) return null;

  return (
    <div className="space-y-6">
      <AppHeader title="Settings" subtitle="Manage shop profile, tax, currency, receipt content, numbering, and low-stock defaults." />
      <SettingsForm initialValues={{
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
        lowStockEnabled: settings?.lowStockEnabled ?? true,
        lowStockThreshold: settings?.lowStockThreshold ?? 5,
        salePrefix: settings?.salePrefix ?? 'SAL',
        receiptPrefix: settings?.receiptPrefix ?? 'RCP',
        purchasePrefix: settings?.purchasePrefix ?? 'PO'
      }} />
    </div>
  );
}
