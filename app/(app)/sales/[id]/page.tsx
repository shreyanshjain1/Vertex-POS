import Link from 'next/link';
import { notFound } from 'next/navigation';
import AppHeader from '@/components/layout/AppHeader';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { getCustomerDisplayName } from '@/lib/customers';
import { dateTime, money } from '@/lib/format';
import { prisma } from '@/lib/prisma';
import { getSaleRefundState, saleDetailInclude } from '@/lib/sale-adjustments';

export default async function SaleDetailPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  const { shopId, shop, permissions } = await getActiveShopContext();
  const { id } = await params;

  const [sale, settings] = await Promise.all([
    prisma.sale.findFirst({
      where: { id, shopId },
      include: saleDetailInclude
    }),
    prisma.shopSetting.findUnique({
      where: { shopId }
    })
  ]);

  if (!sale) {
    return notFound();
  }

  const currencySymbol = settings?.currencySymbol ?? '₱';
  const refundState = getSaleRefundState(sale);
  const canRefundSales = permissions.REFUND_SALES;
  const canVoidSales = permissions.VOID_SALES;

  return (
    <div className="space-y-6">
      <AppHeader title={sale.saleNumber} subtitle={`Receipt ${sale.receiptNumber} | ${dateTime(sale.createdAt)}`} />

      <div className="flex flex-wrap gap-3">
        <Link href={`/sales/${sale.id}/refund`}>
          <Button type="button" disabled={!canRefundSales || !refundState.canRefund}>Refund / Exchange</Button>
        </Link>
        <Link href={`/sales/${sale.id}/void`}>
          <Button type="button" variant="secondary" disabled={!canVoidSales || !refundState.canVoid}>Void sale</Button>
        </Link>
        <Link href={`/print/receipt/${sale.id}`}>
          <Button type="button" variant="secondary">Open receipt</Button>
        </Link>
        <Link href={`/print/receipt/${sale.id}?autoprint=1`}>
          <Button type="button" variant="secondary">Print receipt</Button>
        </Link>
        <Link href="/returns">
          <Button type="button" variant="ghost">Returns history</Button>
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
              <div>Receipt number: <span className="font-semibold">{sale.receiptNumber}</span></div>
              <div>Cashier: <span className="font-semibold">{sale.cashierName ?? 'Cashier'}</span></div>
              <div>Payment method: <span className="font-semibold">{sale.paymentMethod}</span></div>
              <div>Date: <span className="font-semibold">{dateTime(sale.createdAt)}</span></div>
            </div>

            <div className="space-y-2 rounded-2xl border border-stone-200 p-4">
              {sale.items.map((item) => (
                <div key={item.id} className="flex justify-between">
                  <span>{item.productName} x {item.qty}</span>
                  <span>{money(item.lineTotal.toString(), currencySymbol)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 rounded-2xl bg-stone-50 p-4">
              <div className="flex justify-between"><span>Subtotal</span><span>{money(sale.subtotal.toString(), currencySymbol)}</span></div>
              <div className="flex justify-between"><span>Tax</span><span>{money(sale.taxAmount.toString(), currencySymbol)}</span></div>
              <div className="flex justify-between"><span>Discount</span><span>-{money(sale.discountAmount.toString(), currencySymbol)}</span></div>
              <div className="flex justify-between border-t border-stone-200 pt-2 text-lg font-black"><span>Total</span><span>{money(sale.totalAmount.toString(), currencySymbol)}</span></div>
            </div>

            <div className="text-xs text-stone-500">{settings?.receiptFooter ?? 'Thank you for your purchase.'}</div>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-black text-stone-900">Sale metadata</h2>
          <div className="mt-5 space-y-3 text-sm text-stone-600">
            <div>Customer: <span className="font-semibold text-stone-900">{sale.customer ? getCustomerDisplayName(sale.customer) : sale.customerName ?? 'Walk-in customer'}</span></div>
            <div>Phone: <span className="font-semibold text-stone-900">{sale.customerPhone ?? 'N/A'}</span></div>
            {sale.customer?.email ? <div>Email: <span className="font-semibold text-stone-900">{sale.customer.email}</span></div> : null}
            <div>Customer type: <span className="font-semibold text-stone-900">{sale.customer?.type ?? 'WALK_IN'}</span></div>
            <div>Notes: <span className="font-semibold text-stone-900">{sale.notes ?? 'N/A'}</span></div>
            <div>Status: <span className="font-semibold text-stone-900">{sale.status}</span></div>
            <div>Credit sale: <span className="font-semibold text-stone-900">{sale.isCreditSale ? 'Yes' : 'No'}</span></div>
            {sale.loyaltyPointsEarned > 0 || sale.loyaltyPointsRedeemed > 0 ? (
              <div>
                Loyalty: <span className="font-semibold text-stone-900">+{sale.loyaltyPointsEarned} earned / -{sale.loyaltyPointsRedeemed} redeemed</span>
              </div>
            ) : null}
            {sale.customerCreditLedger ? (
              <>
                <div>Due date: <span className="font-semibold text-stone-900">{dateTime(sale.customerCreditLedger.dueDate)}</span></div>
                <div>Receivable balance: <span className="font-semibold text-stone-900">{money(sale.customerCreditLedger.balance.toString(), currencySymbol)}</span></div>
              </>
            ) : null}
            <div>Remaining refundable value: <span className="font-semibold text-stone-900">{money(refundState.refundableAmount, currencySymbol)}</span></div>
            {sale.voidReason ? <div>Void reason: <span className="font-semibold text-stone-900">{sale.voidReason}</span></div> : null}
          </div>

          <div className="mt-6 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
            <div>
              {refundState.canVoid
                ? canVoidSales
                  ? 'This sale is still eligible for a full void.'
                  : 'This sale could still be voided, but your account does not have void permission.'
                : sale.isCreditSale
                  ? 'Credit sales are locked from refund/void adjustments in this pass so receivables stay consistent.'
                  : 'Full void is no longer available because the sale already has adjustments or has already been voided.'}
            </div>
            <div className="mt-2">
              {refundState.canRefund
                ? canRefundSales
                  ? 'Refund and exchange actions are still available for remaining quantities.'
                  : 'Refundable quantity remains, but your account does not have refund permission.'
                : sale.isCreditSale
                  ? 'Refund and exchange actions are disabled for credit sales in this pass.'
                  : 'No refundable quantity is left on this sale.'}
            </div>
          </div>
        </Card>
      </div>

      <Card>
        <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-emerald-700">Adjustment history</div>
            <h2 className="mt-2 text-xl font-black text-stone-900">Voids, refunds, and exchanges</h2>
            <p className="mt-1 text-sm text-stone-500">Every adjustment is linked to the original sale, the acting user, and the approving manager/admin account.</p>
          </div>
          <div className="rounded-full border border-stone-200 bg-stone-50 px-4 py-2 text-xs font-semibold uppercase tracking-[0.14em] text-stone-500">
            {sale.adjustments.length} adjustment(s)
          </div>
        </div>

        <div className="space-y-4">
          {sale.adjustments.map((adjustment) => (
            <div key={adjustment.id} className="rounded-[24px] border border-stone-200 bg-white p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge tone={adjustment.type === 'VOID' ? 'red' : adjustment.type === 'EXCHANGE' ? 'blue' : 'amber'}>
                      {adjustment.type}
                    </Badge>
                    <span className="text-sm font-semibold text-stone-900">{adjustment.adjustmentNumber}</span>
                  </div>
                  <div className="mt-3 text-sm text-stone-700">{adjustment.reason}</div>
                  <div className="mt-2 text-xs text-stone-500">
                    Created {dateTime(adjustment.createdAt)} by {adjustment.createdByUser.name ?? adjustment.createdByUser.email}
                  </div>
                  <div className="mt-1 text-xs text-stone-500">
                    Approved by {adjustment.approvedByUser.name ?? adjustment.approvedByUser.email}
                  </div>
                  {adjustment.notes ? <div className="mt-3 rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-600">{adjustment.notes}</div> : null}
                </div>
                <div className="min-w-[240px] space-y-2">
                  <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    Credit {money(adjustment.subtotal.toString(), currencySymbol)} / Refunded {money(adjustment.totalAmount.toString(), currencySymbol)}
                  </div>
                  {adjustment.exchangeSale ? (
                    <div className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                      Exchange sale {adjustment.exchangeSale.saleNumber} / Collected {money(adjustment.exchangeSale.totalAmount.toString(), currencySymbol)}
                    </div>
                  ) : null}
                  <div className="flex flex-col gap-2">
                    <Link href={`/print/refund/${adjustment.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-emerald-600">
                      Adjustment receipt
                    </Link>
                    {adjustment.exchangeSale ? (
                      <Link href={`/sales/${adjustment.exchangeSale.id}`} className="text-xs font-semibold uppercase tracking-[0.14em] text-stone-600 hover:text-stone-900">
                        Exchange sale
                      </Link>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {adjustment.items.map((item) => (
                  <div key={item.id} className="rounded-[18px] border border-stone-200 bg-stone-50 px-3 py-2 text-sm text-stone-700">
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="mt-1">{item.itemType} / {item.disposition} / Qty {item.qty}</div>
                    <div className="mt-1">{money(item.lineTotal.toString(), currencySymbol)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {!sale.adjustments.length ? (
            <div className="rounded-[24px] border border-dashed border-stone-300 bg-stone-50 px-4 py-6 text-sm text-stone-500">
              No adjustments have been processed for this sale yet.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
