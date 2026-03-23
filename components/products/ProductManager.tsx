'use client';

import { useMemo, useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Card from '@/components/ui/Card';
import { money } from '@/lib/format';

type Category = { id: string; name: string; parentId: string | null };
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

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-stone-700">{children}</label>;
}

export default function ProductManager({
  initialProducts,
  categories,
  currencySymbol
}: {
  initialProducts: Product[];
  categories: Category[];
  currencySymbol: string;
}) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
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

    return products.filter((product) => {
      const matchesTerm =
        !term ||
        [product.name, product.sku ?? '', product.barcode ?? '', product.category?.name ?? '']
          .join(' ')
          .toLowerCase()
          .includes(term);

      const matchesCategory = !categoryFilter || product.categoryId === categoryFilter;

      return matchesTerm && matchesCategory;
    });
  }, [products, query, categoryFilter]);

  function resetForm() {
    setEditingId(null);
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
  }

  function beginEdit(product: Product) {
    setEditingId(product.id);
    setForm({
      categoryId: product.categoryId ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      name: product.name,
      description: product.description ?? '',
      cost: product.cost,
      price: product.price,
      stockQty: String(product.stockQty),
      reorderPoint: String(product.reorderPoint),
      isActive: product.isActive
    });
  }

  async function saveProduct(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');

    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }

    if (Number(form.cost) < 0 || Number(form.price) < 0) {
      setError('Cost and selling price must not be negative.');
      return;
    }

    if (Number(form.stockQty) < 0 || Number(form.reorderPoint) < 0) {
      setError('Stock quantity and reorder level must not be negative.');
      return;
    }

    setLoading(true);

    const payload = {
      ...form,
      categoryId: form.categoryId || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      description: form.description || null,
      stockQty: Number(form.stockQty),
      reorderPoint: Number(form.reorderPoint),
      cost: Number(form.cost),
      price: Number(form.price)
    };

    const response = await fetch(editingId ? `/api/products/${editingId}` : '/api/products', {
      method: editingId ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({ error: 'Failed to save product.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Failed to save product.');
      return;
    }

    const product = {
      ...data.product,
      cost: String(data.product.cost),
      price: String(data.product.price)
    };

    setProducts((prev) =>
      editingId ? prev.map((item) => (item.id === editingId ? product : item)) : [product, ...prev]
    );

    resetForm();
  }

  async function archiveProduct(product: Product) {
    const response = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ isActive: !product.isActive })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.product) return;

    setProducts((prev) =>
      prev.map((item) =>
        item.id === product.id ? { ...item, isActive: data.product.isActive } : item
      )
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="mb-1 text-2xl font-black text-stone-900">
          {editingId ? 'Edit product' : 'Add product'}
        </div>
        <p className="mb-6 text-sm text-stone-500">
          Set pricing, stock levels, barcode, and reorder behavior clearly so cashiers and managers understand each item.
        </p>

        <form onSubmit={saveProduct} className="space-y-6">
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
                className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm outline-none transition focus:border-emerald-500 focus:bg-white"
                value={form.categoryId}
                onChange={(e) => setForm((p) => ({ ...p, categoryId: e.target.value }))}
              >
                <option value="">Uncategorized</option>
                {categories.map((category) => (
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
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.cost}
                onChange={(e) => setForm((p) => ({ ...p, cost: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Selling price</FieldLabel>
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                value={form.price}
                onChange={(e) => setForm((p) => ({ ...p, price: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Opening stock quantity</FieldLabel>
              <Input
                type="number"
                placeholder="0"
                value={form.stockQty}
                onChange={(e) => setForm((p) => ({ ...p, stockQty: e.target.value }))}
              />
            </div>

            <div>
              <FieldLabel>Low-stock reorder level</FieldLabel>
              <Input
                type="number"
                placeholder="5"
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
            />
            Product is active and available for selling
          </label>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          <div className="flex gap-3">
            <Button type="submit" disabled={loading}>
              {loading ? 'Saving product...' : editingId ? 'Update product' : 'Save product'}
            </Button>

            {editingId ? (
              <Button type="button" variant="secondary" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-stone-900">Product catalog</h2>
            <p className="text-sm text-stone-500">
              Search, filter, and manage active or archived products.
            </p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              placeholder="Search products..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="md:w-72"
            />
            <select
              className="rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="">All categories</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
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
                <th className="px-3 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((product) => (
                <tr key={product.id} className="border-t border-stone-200">
                  <td className="px-3 py-3">
                    <div className="font-semibold text-stone-900">{product.name}</div>
                    <div className="text-xs text-stone-500">{product.description ?? 'No description'}</div>
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
                  <td className="px-3 py-3">
                    <div className="flex gap-2">
                      <Button type="button" variant="secondary" onClick={() => beginEdit(product)}>
                        Edit
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => archiveProduct(product)}>
                        {product.isActive ? 'Archive' : 'Activate'}
                      </Button>
                    </div>
                  </td>
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
      </Card>
    </div>
  );
}