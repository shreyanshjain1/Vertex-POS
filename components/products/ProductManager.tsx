'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { money } from '@/lib/format';
import { getStockLevel, stockLevelLabel } from '@/lib/inventory';

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
  category?: { id: string; name: string } | null;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-stone-700">{children}</label>;
}

export default function ProductManager({
  initialProducts,
  categories,
  currencySymbol,
  lowStockThreshold
}: {
  initialProducts: Product[];
  categories: Category[];
  currencySymbol: string;
  lowStockThreshold: number;
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
  const [success, setSuccess] = useState('');
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

  const activeCount = products.filter((product) => product.isActive).length;
  const archivedCount = products.length - activeCount;
  const lowStockCount = products.filter(
    (product) => getStockLevel(product.stockQty, product.reorderPoint, lowStockThreshold) !== 'IN_STOCK'
  ).length;

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
    setError('');
    setSuccess('');
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
    setSuccess('');

    if (!form.name.trim()) {
      setError('Product name is required.');
      return;
    }

    if (Number(form.cost) < 0 || Number(form.price) < 0) {
      setError('Cost and selling price must not be negative.');
      return;
    }

    if (!editingId && Number(form.stockQty) < 0) {
      setError('Opening stock must not be negative.');
      return;
    }

    if (Number(form.reorderPoint) < 0) {
      setError('Low-stock reorder level must not be negative.');
      return;
    }

    setLoading(true);

    const payload = {
      ...form,
      categoryId: form.categoryId || null,
      sku: form.sku || null,
      barcode: form.barcode || null,
      description: form.description || null,
      cost: Number(form.cost),
      price: Number(form.price),
      reorderPoint: Number(form.reorderPoint),
      ...(editingId ? {} : { stockQty: Number(form.stockQty) })
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

    setProducts((currentProducts) =>
      editingId
        ? currentProducts.map((item) => (item.id === editingId ? product : item))
        : [product, ...currentProducts]
    );

    setSuccess(editingId ? 'Product updated successfully.' : 'Product created successfully.');
    resetForm();
  }

  async function toggleArchive(product: Product) {
    const confirmed = window.confirm(
      `${product.isActive ? 'Archive' : 'Restore'} ${product.name}?`
    );
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/products/${product.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isActive: !product.isActive
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.product) {
      setError(data?.error ?? 'Unable to update product status.');
      return;
    }

    setProducts((currentProducts) =>
      currentProducts.map((item) =>
        item.id === product.id
          ? { ...item, isActive: data.product.isActive }
          : item
      )
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Catalog editor</div>
            <div id="new-product" className="mt-2 text-2xl font-black text-stone-900">
              {editingId ? 'Edit product' : 'Add product'}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Set pricing, tax-ready sell values, archive status, and opening stock. Ongoing stock changes should happen through purchases or inventory adjustments.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Active</div>
              <div className="mt-1 text-xl font-black text-stone-950">{activeCount}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Low stock</div>
              <div className="mt-1 text-xl font-black text-amber-700">{lowStockCount}</div>
            </div>
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Archived</div>
              <div className="mt-1 text-xl font-black text-stone-950">{archivedCount}</div>
            </div>
          </div>
        </div>

        <form onSubmit={saveProduct} className="space-y-6">
          <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Core details</div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div>
                <FieldLabel>Product name</FieldLabel>
                <Input
                  placeholder="e.g. Iced Latte"
                  value={form.name}
                  onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                  required
                />
              </div>

              <div>
                <FieldLabel>Category</FieldLabel>
                <select
                  className={selectClassName}
                  value={form.categoryId}
                  onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}
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
                  onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))}
                />
              </div>

              <div>
                <FieldLabel>Barcode</FieldLabel>
                <Input
                  placeholder="Scan or type barcode"
                  value={form.barcode}
                  onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))}
                />
              </div>

              <div>
                <FieldLabel>Cost price</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.cost}
                  onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))}
                />
              </div>

              <div>
                <FieldLabel>Selling price</FieldLabel>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={form.price}
                  onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))}
                />
              </div>

              <div>
                <FieldLabel>{editingId ? 'Current stock' : 'Opening stock quantity'}</FieldLabel>
                <Input
                  type="number"
                  placeholder="0"
                  value={form.stockQty}
                  onChange={(event) => setForm((current) => ({ ...current, stockQty: event.target.value }))}
                  disabled={Boolean(editingId)}
                />
              </div>

              <div>
                <FieldLabel>Low-stock reorder level</FieldLabel>
                <Input
                  type="number"
                  placeholder="5"
                  value={form.reorderPoint}
                  onChange={(event) => setForm((current) => ({ ...current, reorderPoint: event.target.value }))}
                />
              </div>
            </div>
          </div>

          {editingId ? (
            <div className="rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Stock is adjusted from the Inventory or Purchases pages so every change keeps an audit trail.
            </div>
          ) : null}

          <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Selling details</div>
            <div>
              <FieldLabel>Description</FieldLabel>
              <Input
                placeholder="Optional product description"
                value={form.description}
                onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
              />
            </div>

            <label className="mt-4 inline-flex items-center gap-3 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={form.isActive}
                onChange={(event) => setForm((current) => ({ ...current, isActive: event.target.checked }))}
              />
              Product is active and available for selling
            </label>
          </div>

          {error ? (
            <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row">
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
            <p className="text-sm text-stone-500">Search, filter, and manage active or archived products.</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Input
              placeholder="Search products..."
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="md:w-72"
            />
            <select
              className={`${selectClassName} md:w-56`}
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
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

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">Name</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">SKU / Barcode</th>
                  <th className="px-4 py-3.5">Cost</th>
                  <th className="px-4 py-3.5">Price</th>
                  <th className="px-4 py-3.5">Stock</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const level = getStockLevel(product.stockQty, product.reorderPoint, lowStockThreshold);
                  return (
                    <tr key={product.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{product.name}</div>
                        <div className="mt-1 text-xs text-stone-500">{product.description ?? 'No description'}</div>
                      </td>
                      <td className="px-4 py-4">{product.category?.name ?? 'Uncategorized'}</td>
                      <td className="px-4 py-4 text-stone-600">
                        {(product.sku || 'N/A')} / {(product.barcode || 'N/A')}
                      </td>
                      <td className="px-4 py-4">{money(product.cost, currencySymbol)}</td>
                      <td className="px-4 py-4 font-semibold text-stone-900">{money(product.price, currencySymbol)}</td>
                      <td className="px-4 py-4 font-semibold text-stone-900">{product.stockQty}</td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={product.isActive ? 'emerald' : 'stone'}>
                            {product.isActive ? 'Active' : 'Archived'}
                          </Badge>
                          <Badge tone={level === 'OUT_OF_STOCK' ? 'red' : level === 'LOW_STOCK' ? 'amber' : 'blue'}>
                            {stockLevelLabel(level)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex gap-2">
                          <Button type="button" variant="secondary" onClick={() => beginEdit(product)}>
                            Edit
                          </Button>
                          <Button type="button" variant="ghost" className="text-xs uppercase tracking-[0.14em]" onClick={() => toggleArchive(product)}>
                            {product.isActive ? 'Archive' : 'Restore'}
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filtered.length ? (
            <div className="border-t border-stone-200 bg-stone-50 py-10 text-center text-sm text-stone-500">
              No products matched that filter. Add a product above or clear the search to see the full catalog.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
