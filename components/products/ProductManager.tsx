'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { money } from '@/lib/format';

type Category = {
  id: string;
  name: string;
};

type Product = {
  id: string;
  categoryId: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  cost: string;
  price: string;
  stockQty: number;
  reorderPoint: number;
  isActive: boolean;
  category?: { name: string } | null;
};

type ProductManagerProps = {
  products?: Product[];
  initialProducts?: Product[];
  categories: Category[];
  currencySymbol: string;
};

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-stone-700">{children}</label>;
}

export default function ProductManager({
  products,
  initialProducts,
  categories,
  currencySymbol
}: ProductManagerProps) {
  const safeProducts = products ?? initialProducts ?? [];
  const safeCategories = categories ?? [];

  const [items, setItems] = useState<Product[]>(safeProducts);
  const [query, setQuery] = useState('');
  const [form, setForm] = useState({
    categoryId: '',
    sku: '',
    barcode: '',
    name: '',
    description: '',
    cost: '0.00',
    price: '0.00',
    stockQty: '0',
    reorderPoint: '5',
    isActive: true
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();
    if (!term) return items;

    return items.filter((product) =>
      [product.name, product.sku ?? '', product.barcode ?? '', product.category?.name ?? '']
        .join(' ')
        .toLowerCase()
        .includes(term)
    );
  }, [items, query]);

  async function createProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }

    if (Number(form.price) < 0 || Number(form.cost) < 0) {
      setError('Cost and selling price must not be negative.');
      return;
    }

    if (Number(form.stockQty) < 0 || Number(form.reorderPoint) < 0) {
      setError('Stock quantity and reorder level must not be negative.');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          categoryId: form.categoryId || null,
          sku: form.sku || null,
          barcode: form.barcode || null,
          name: form.name.trim(),
          description: form.description || null,
          cost: Number(form.cost),
          price: Number(form.price),
          stockQty: Number(form.stockQty),
          reorderPoint: Number(form.reorderPoint),
          isActive: form.isActive
        })
      });

      const data = await response.json().catch(() => ({ error: 'Failed to create product.' }));
      setLoading(false);

      if (!response.ok) {
        setError(data.error ?? 'Failed to create product.');
        return;
      }

      const createdProduct: Product = {
        ...data.product,
        cost: String(data.product.cost),
        price: String(data.product.price)
      };

      setItems((prev) => [createdProduct, ...prev]);
      setForm({
        categoryId: '',
        sku: '',
        barcode: '',
        name: '',
        description: '',
        cost: '0.00',
        price: '0.00',
        stockQty: '0',
        reorderPoint: '5',
        isActive: true
      });
    } catch {
      setLoading(false);
      setError('Failed to create product.');
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-1 text-2xl font-black text-stone-900">Add product</div>
        <p className="mb-6 text-sm text-stone-500">
          Create a product with pricing, stock, barcode, and reorder details.
        </p>

        <form onSubmit={createProduct} className="space-y-6">
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <div>
              <FieldLabel>Product name</FieldLabel>
              <Input
                placeholder="e.g. Iced Latte"
                value={form.name}
                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                required
              />
            </div>

            <div>
              <FieldLabel>Category</FieldLabel>
              <select
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-3 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                value={form.categoryId}
                onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
              >
                <option value="">No category</option>
                {safeCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <FieldLabel>SKU</FieldLabel>
              <Input
                placeholder="e.g. COF-ICE-001"
                value={form.sku}
                onChange={(e) => setForm((p) => ({ ...p, sku: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Barcode</FieldLabel>
              <Input
                placeholder="Scan or type barcode"
                value={form.barcode}
                onChange={(e) => setForm((p) => ({ ...p, barcode: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Cost price</FieldLabel>
              <Input
                placeholder="0.00"
                type="number"
                step="0.01"
                value={form.cost}
                onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Selling price</FieldLabel>
              <Input
                placeholder="0.00"
                type="number"
                step="0.01"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Opening stock quantity</FieldLabel>
              <Input
                placeholder="0"
                type="number"
                value={form.stockQty}
                onChange={(e) => setForm((p) => ({ ...p, stockQty: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Low-stock reorder level</FieldLabel>
              <Input
                placeholder="5"
                type="number"
                value={form.reorderPoint}
                onChange={(e) => setForm((p) => ({ ...p, reorderPoint: e.target.value }))}
              />
            </div>
          </div>

          <div>
            <FieldLabel>Description</FieldLabel>
            <Input
              placeholder="Optional product description"
              value={form.description}
              onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
            />
          </div>

          <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
              className="h-4 w-4 rounded border-stone-300"
            />
            Product is active and can be sold
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div>
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving product...' : 'Save product'}
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="text-lg font-black text-stone-900">Product catalog</div>
            <div className="text-sm text-stone-500">Search, review, and monitor your products.</div>
          </div>
          <div className="w-full md:w-80">
            <Input
              placeholder="Search by name, SKU, barcode, or category..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="text-stone-500">
              <tr>
                <th className="px-3 py-3">Name</th>
                <th className="px-3 py-3">Category</th>
                <th className="px-3 py-3">SKU / Barcode</th>
                <th className="px-3 py-3">Cost</th>
                <th className="px-3 py-3">Price</th>
                <th className="px-3 py-3">Stock</th>
                <th className="px-3 py-3">Reorder</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-t border-stone-200">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-stone-900">{product.name}</div>
                    {product.description ? (
                      <div className="text-xs text-stone-500">{product.description}</div>
                    ) : null}
                  </td>
                  <td className="px-3 py-3">{product.category?.name ?? '—'}</td>
                  <td className="px-3 py-3 text-stone-600">
                    {product.sku ?? '—'} / {product.barcode ?? '—'}
                  </td>
                  <td className="px-3 py-3">{money(product.cost, currencySymbol)}</td>
                  <td className="px-3 py-3">{money(product.price, currencySymbol)}</td>
                  <td
                    className={`px-3 py-3 font-semibold ${
                      product.stockQty <= product.reorderPoint ? 'text-red-600' : 'text-stone-900'
                    }`}
                  >
                    {product.stockQty}
                  </td>
                  <td className="px-3 py-3">{product.reorderPoint}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {!filtered.length ? (
            <div className="py-10 text-center text-sm text-stone-500">
              No products found. Add your first product above to start selling.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}