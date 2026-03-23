import Card from '@/components/ui/Card';
import Badge from '@/components/ui/Badge';
import { money } from '@/lib/format';
import Link from 'next/link';

type Product = {
  id: string;
  name: string;
  stockQty: number;
  reorderPoint: number;
  price: string;
  category?: { name: string } | null;
};

export default function LowStockCard({
  products,
  currencySymbol
}: {
  products: Product[];
  currencySymbol: string;
}) {
  return (
    <Card>
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-black text-stone-900">Low-stock watch</h2>
          <p className="text-sm text-stone-500">Products that need restocking soon.</p>
        </div>
        <Link href="/inventory" className="text-sm font-semibold text-emerald-600">
          Inventory
        </Link>
      </div>

      <div className="space-y-3">
        {products.length ? (
          products.map((product) => (
            <div key={product.id} className="rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="font-semibold text-stone-900">{product.name}</div>
                  <div className="text-sm text-stone-500">
                    {product.category?.name ?? 'Uncategorized'}
                  </div>
                </div>
                <Badge tone="amber">{product.stockQty} left</Badge>
              </div>

              <div className="mt-2 flex justify-between text-sm text-stone-600">
                <span>Reorder at {product.reorderPoint}</span>
                <span>{money(product.price, currencySymbol)}</span>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
            No low-stock products right now.
          </div>
        )}
      </div>
    </Card>
  );
}