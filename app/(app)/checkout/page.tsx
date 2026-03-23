import AppHeader from '@/components/layout/AppHeader';
import CheckoutClient from '@/components/checkout/CheckoutClient';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';

export default async function CheckoutPage() {
  const { shopId, session } = await getActiveShopContext();
  const [products, settings] = await Promise.all([
    prisma.product.findMany({ where: { shopId, isActive: true }, orderBy: { name: 'asc' }, include: { category: { select: { name: true } } } }),
    prisma.shopSetting.findUnique({ where: { shopId } })
  ]);

  return (
    <div className="space-y-6">
      <AppHeader title="Checkout" subtitle="Process sales quickly, prevent overselling, and generate receipt-ready transactions." />
      <CheckoutClient products={products.map((product) => ({ ...product, price: product.price.toString() }))} taxRate={Number(settings?.taxRate ?? 0)} currencySymbol={settings?.currencySymbol ?? '₱'} cashierName={session.user.name ?? 'Cashier'} />
    </div>
  );
}
