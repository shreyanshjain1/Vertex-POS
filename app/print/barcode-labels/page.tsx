import Link from 'next/link';
import { notFound } from 'next/navigation';
import BarcodeLabelPreview, { type BarcodeLabelSize } from '@/components/products/BarcodeLabelPreview';
import PrintButton from '@/components/products/PrintButton';
import { getActiveShopContext } from '@/lib/auth/get-active-shop';
import { getVariantDisplayName, buildVariantLabel } from '@/lib/product-merchandising';
import { prisma } from '@/lib/prisma';

const LABEL_SIZES: BarcodeLabelSize[] = ['small', 'medium', 'large'];

export default async function BarcodeLabelsPage({
  searchParams
}: {
  searchParams: Promise<{
    productId?: string;
    variantId?: string;
    size?: string;
    qty?: string;
  }>;
}) {
  const query = await searchParams;
  const { shopId } = await getActiveShopContext();

  if (!query.productId) {
    return notFound();
  }

  const size = LABEL_SIZES.includes(query.size as BarcodeLabelSize)
    ? (query.size as BarcodeLabelSize)
    : 'medium';
  const qty = Math.min(Math.max(Number(query.qty ?? '1') || 1, 1), 24);

  const product = await prisma.product.findFirst({
    where: {
      id: query.productId,
      shopId
    },
    include: {
      images: {
        orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
        take: 1
      },
      variants: {
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!product) {
    return notFound();
  }

  const variant = query.variantId
    ? product.variants.find((entry) => entry.id === query.variantId) ?? null
    : null;

  if (query.variantId && !variant) {
    return notFound();
  }

  const barcodeValue = variant?.barcode ?? product.barcode ?? variant?.sku ?? product.sku;

  if (!barcodeValue) {
    return notFound();
  }

  const variantLabel = variant ? buildVariantLabel(variant) : null;
  const displayName = variant
    ? getVariantDisplayName(product.name, variant)
    : product.name;

  return (
    <main className="min-h-screen bg-stone-50 p-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-emerald-700">Barcode labels</div>
            <h1 className="mt-2 text-3xl font-black text-stone-950">{displayName}</h1>
            <p className="mt-2 text-sm text-stone-500">Choose a label size, then print from this dedicated label sheet.</p>
          </div>
          <div className="flex gap-3">
            <Link href="/products">
              <ButtonLinkLabel />
            </Link>
            <PrintButton />
          </div>
        </div>

        <div className="flex flex-wrap gap-2 print:hidden">
          {LABEL_SIZES.map((candidate) => (
            <Link
              key={candidate}
              href={`/print/barcode-labels?productId=${product.id}${variant ? `&variantId=${variant.id}` : ''}&size=${candidate}&qty=${qty}`}
              className={`rounded-full border px-4 py-2 text-sm font-semibold transition ${
                candidate === size
                  ? 'border-emerald-600 bg-emerald-600 text-white'
                  : 'border-stone-200 bg-white text-stone-700 hover:border-stone-300 hover:bg-stone-50'
              }`}
            >
              {candidate}
            </Link>
          ))}
        </div>

        <div className="grid gap-4 rounded-[28px] border border-stone-200 bg-white p-6 print:border-0 print:bg-white print:p-0">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: qty }).map((_, index) => (
              <div key={index} className="flex justify-center print:break-inside-avoid">
                <BarcodeLabelPreview
                  code={barcodeValue}
                  productName={product.name}
                  variantLabel={variantLabel}
                  sku={variant?.sku ?? product.sku}
                  size={size}
                />
              </div>
            ))}
          </div>
        </div>
      </div>
    </main>
  );
}

function ButtonLinkLabel() {
  return (
    <span className="inline-flex h-11 items-center justify-center rounded-2xl border border-stone-200 bg-white px-4 text-sm font-semibold text-stone-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] transition hover:border-stone-300 hover:bg-stone-50">
      Back to products
    </span>
  );
}
