import { notFound } from 'next/navigation';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { money } from '@/lib/format';
import { prisma } from '@/lib/prisma';

export default async function PrintQuotePage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ autoprint?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const { shopId, shop } = await getActiveShopContext();

  const [parkedSale, settings] = await Promise.all([
    prisma.parkedSale.findFirst({
      where: {
        id,
        shopId,
        type: 'QUOTE'
      },
      include: {
        items: {
          orderBy: { createdAt: 'asc' }
        },
        cashier: {
          select: {
            name: true,
            email: true
          }
        }
      }
    }),
    prisma.shopSetting.findUnique({
      where: { shopId },
      select: { currencySymbol: true }
    })
  ]);

  if (!parkedSale) {
    return notFound();
  }

  const currencySymbol = settings?.currencySymbol ?? '₱';

  return (
    <main className="min-h-screen bg-stone-100 p-6 print:bg-white print:p-0">
      {query.autoprint === '1' ? <script dangerouslySetInnerHTML={{ __html: 'window.addEventListener("load",()=>window.print())' }} /> : null}
      <div className="mx-auto max-w-4xl rounded-[32px] border border-stone-200 bg-white p-8 shadow-[0_24px_70px_-42px_rgba(28,25,23,0.28)] print:max-w-none print:rounded-none print:border-0 print:p-8 print:shadow-none">
        <div className="flex items-start justify-between gap-6 border-b border-stone-200 pb-6">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-sky-700">Customer quote</div>
            <h1 className="mt-2 text-3xl font-black text-stone-950">{shop.name}</h1>
            <div className="mt-3 space-y-1 text-sm text-stone-500">
              {shop.address ? <div>{shop.address}</div> : null}
              {shop.phone ? <div>{shop.phone}</div> : null}
              {shop.email ? <div>{shop.email}</div> : null}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Quote reference</div>
            <div className="mt-1 text-2xl font-black text-sky-700">{parkedSale.quoteReference ?? `QUOTE-${parkedSale.id.slice(0, 8).toUpperCase()}`}</div>
            <div className="mt-3 text-sm text-stone-500">Created {parkedSale.createdAt.toLocaleString()}</div>
            <div className="text-sm text-stone-500">Valid until {parkedSale.expiresAt.toLocaleString()}</div>
          </div>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Quoted for</div>
            <div className="mt-2 text-lg font-bold text-stone-950">{parkedSale.customerName || 'Walk-in customer'}</div>
            <div className="mt-1 text-sm text-stone-500">{parkedSale.customerPhone || 'No phone recorded'}</div>
            {parkedSale.title ? <div className="mt-3 text-sm font-semibold text-stone-700">{parkedSale.title}</div> : null}
          </div>
          <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-5 py-4">
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Prepared by</div>
            <div className="mt-2 text-lg font-bold text-stone-950">{parkedSale.cashier.name ?? parkedSale.cashier.email ?? 'Cashier'}</div>
            <div className="mt-1 text-sm text-stone-500">{parkedSale.cashier.email ?? 'No email recorded'}</div>
            {parkedSale.notes ? <div className="mt-3 text-sm text-stone-600">{parkedSale.notes}</div> : null}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-[24px] border border-stone-200">
          <table className="min-w-full divide-y divide-stone-200 text-sm">
            <thead className="bg-stone-50">
              <tr>
                <th className="px-4 py-3 text-left font-semibold uppercase tracking-[0.12em] text-stone-500">Item</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-[0.12em] text-stone-500">Qty</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-[0.12em] text-stone-500">Unit</th>
                <th className="px-4 py-3 text-right font-semibold uppercase tracking-[0.12em] text-stone-500">Line total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200 bg-white">
              {parkedSale.items.map((item) => (
                <tr key={item.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold text-stone-900">{item.productName}</div>
                    <div className="text-xs text-stone-500">{item.variantLabel ?? 'Base item'}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-stone-700">{item.qty}</td>
                  <td className="px-4 py-3 text-right text-stone-700">{money(item.unitPrice, currencySymbol)}</td>
                  <td className="px-4 py-3 text-right font-semibold text-stone-900">{money(item.lineTotal, currencySymbol)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mt-8 ml-auto max-w-sm space-y-2 rounded-[24px] border border-stone-200 bg-stone-50 p-5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Subtotal</span>
            <span className="font-semibold text-stone-900">
              {money(Number(parkedSale.subtotal), currencySymbol)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Tax</span>
            <span className="font-semibold text-stone-900">
              {money(Number(parkedSale.taxAmount), currencySymbol)}
            </span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-stone-500">Discount</span>
            <span className="font-semibold text-stone-900">
              -{money(Number(parkedSale.discountAmount), currencySymbol)}
            </span>
          </div>
          <div className="flex items-center justify-between border-t border-stone-200 pt-3 text-lg font-black text-stone-950">
            <span>Total quote</span>
            <span>{money(Number(parkedSale.totalAmount), currencySymbol)}</span>
          </div>
        </div>

        <div className="mt-8 rounded-[24px] border border-sky-200 bg-sky-50 px-5 py-4 text-sm leading-6 text-sky-900">
          This quote does not deduct stock until it is reopened in checkout and completed as a real sale. Pricing and availability remain subject to branch stock and rule changes before final sale completion.
        </div>
      </div>
    </main>
  );
}
