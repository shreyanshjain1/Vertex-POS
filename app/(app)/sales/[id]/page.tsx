import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Link from 'next/link';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { prisma } from '@/lib/prisma';
import { dateTime, money } from '@/lib/format';

export default async function SaleDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { shopId, shop } = await getActiveShopContext();
  const { id } = await params;

  const [sale, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, shopId },
      include: { items: true }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    })
  ]);

  if (!sale) return notFound();

  const currencySymbol = settings?.currencySymbol ?? '₱';

  return (
    <div className="space-y-6">
      <AppHeader
        title={sale.saleNumber}
        subtitle={`Receipt ${sale.receiptNumber} • ${dateTime(sale.createdAt)}`}
      />

      <div className="flex flex-wrap gap-3">
        <Link href={`/sales/${sale.id}/receipt`}>
          <Button type="button">Open receipt</Button>
        </Link>
        <Link href={`/sales/${sale.id}/receipt?autoprint=1`}>
          <Button type="button" variant="secondary">
            Print receipt
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
        <Card>
          <h2 className="text-xl font-black text-stone-900">Receipt preview</h2>

          <div className="mt-5 space-y-3 text-sm">
            <div>
              <div className="font-black text-stone-900">{settings?.receiptHeader || shop.name}</div>
              <div className="text-stone-500">{shop.address ?? 'No address set'}</div>
            </div>

            <div className="grid gap-2 md:grid-cols-2">
              <div>
                Receipt number: <span className="font-semibold">{sale.receiptNumber}</span>
              </div>
              <div>
                Cashier: <span className="font-semibold">{sale.cashierName ?? 'Cashier'}</span>
              </div>
              <div>
                Payment method: <span className="font-semibold">{sale.paymentMethod}</span>
              </div>
              <div>
                Date: <span className="font-semibold">{dateTime(sale.createdAt)}</span>
              </div>
            </div>

            <div className="space-y-2 rounded-2xl border border-stone-200 p-4">
              {sale.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>
                    {item.productName} × {item.qty}
                  </span>
                  <span>{money(item.lineTotal.toString(), currencySymbol)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <div className="flex justify-between">
                <span>Subtotal</span>
                <span>{money(sale.subtotal.toString(), currencySymbol)}</span>
              </div>
              <div className="flex justify-between">
                <span>Tax</span>
                <span>{money(sale.taxAmount.toString(), currencySymbol)}</span>
              </div>
              <div className="flex justify-between">
                <span>Discount</span>
                <span>{money(sale.discountAmount.toString(), currencySymbol)}</span>
              </div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-black">
                <span>Total</span>
                <span>{money(sale.totalAmount.toString(), currencySymbol)}</span>
              </div>
            </div>

            <div className="text-xs text-stone-500">
              {settings?.receiptFooter ?? 'Thank you for your purchase.'}
            </div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Sale metadata</h2>
          <div className="mt-5 space-y-3 text-sm text-stone-600">
            <div>
              Customer: <span className="font-semibold text-stone-900">{sale.customerName ?? 'Walk-in customer'}</span>
            </div>
            <div>
              Phone: <span className="font-semibold text-stone-900">{sale.customerPhone ?? '—'}</span>
            </div>
            <div>
              Notes: <span className="font-semibold text-stone-900">{sale.notes ?? '—'}</span>
            </div>
            <div>
              Status: <span className="font-semibold text-stone-900">{sale.status}</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}