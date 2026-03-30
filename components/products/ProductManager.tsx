'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { money } from '@/lib/format';
import { getStockLevel, stockLevelLabel } from '@/lib/inventory';
import { summarizeConversions } from '@/lib/uom';

type Category = { id: string; name: string; parentId: string | null };
type UnitOfMeasure = { id: string; code: string; name: string; isBase: boolean };
type Product = {
  id: string;
  categoryId: string | null;
  baseUnitOfMeasureId: string | null;
  sku: string | null;
  barcode: string | null;
  name: string;
  description: string | null;
  cost: string;
  price: string;
  stockQty: number;
  reorderPoint: number;
  trackBatches: boolean;
  trackExpiry: boolean;
  isActive: boolean;
  baseUnitOfMeasure?: UnitOfMeasure | null;
  uomConversions: Array<{
    id: string;
    unitOfMeasureId: string;
    ratioToBase: number;
    unitOfMeasure: UnitOfMeasure;
  }>;
  batches: Array<{
    id: string;
    lotNumber: string;
    expiryDate: string | null;
    quantity: number;
  }>;
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
  units,
  currencySymbol,
  lowStockThreshold,
  inventoryDefaults
}: {
  initialProducts: Product[];
  categories: Category[];
  units: UnitOfMeasure[];
  currencySymbol: string;
  lowStockThreshold: number;
  inventoryDefaults: {
    batchTrackingEnabled: boolean;
    expiryTrackingEnabled: boolean;
    expiryAlertDays: number;
  };
}) {
  const [products, setProducts] = useState(initialProducts);
  const [query, setQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    categoryId: '',
    baseUnitOfMeasureId: units.find((unit) => unit.code === 'PIECE')?.id ?? units[0]?.id ?? '',
    sku: '',
    barcode: '',
    name: '',
    description: '',
    cost: '0.00',
    price: '0.00',
    stockQty: '0',
    reorderPoint: '5',
    trackBatches: inventoryDefaults.batchTrackingEnabled,
    trackExpiry: inventoryDefaults.expiryTrackingEnabled,
    uomConversions: [] as Array<{ unitOfMeasureId: string; ratioToBase: string }>,
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
      baseUnitOfMeasureId: units.find((unit) => unit.code === 'PIECE')?.id ?? units[0]?.id ?? '',
      sku: '',
      barcode: '',
      name: '',
      description: '',
      cost: '0.00',
      price: '0.00',
      stockQty: '0',
      reorderPoint: '5',
      trackBatches: inventoryDefaults.batchTrackingEnabled,
      trackExpiry: inventoryDefaults.expiryTrackingEnabled,
      uomConversions: [],
      isActive: true
    });
  }

  function beginEdit(product: Product) {
    setEditingId(product.id);
    setError('');
    setSuccess('');
    setForm({
      categoryId: product.categoryId ?? '',
      baseUnitOfMeasureId: product.baseUnitOfMeasureId ?? units.find((unit) => unit.code === 'PIECE')?.id ?? '',
      sku: product.sku ?? '',
      barcode: product.barcode ?? '',
      name: product.name,
      description: product.description ?? '',
      cost: product.cost,
      price: product.price,
      stockQty: String(product.stockQty),
      reorderPoint: String(product.reorderPoint),
      trackBatches: product.trackBatches,
      trackExpiry: product.trackExpiry,
      uomConversions: product.uomConversions.map((conversion) => ({
        unitOfMeasureId: conversion.unitOfMeasureId,
        ratioToBase: String(conversion.ratioToBase)
      })),
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

    if (!form.baseUnitOfMeasureId) {
      setError('Select a base unit.');
      return;
    }

    for (const conversion of form.uomConversions) {
      if (!conversion.unitOfMeasureId || !conversion.ratioToBase) {
        setError('Complete or remove any blank pack conversion rows.');
        return;
      }

      if (Number(conversion.ratioToBase) <= 0) {
        setError('Pack conversion ratios must be greater than zero.');
        return;
      }
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
      uomConversions: form.uomConversions.map((conversion) => ({
        unitOfMeasureId: conversion.unitOfMeasureId,
        ratioToBase: Number(conversion.ratioToBase)
      })),
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
      price: String(data.product.price),
      baseUnitOfMeasure: data.product.baseUnitOfMeasure,
      uomConversions: data.product.uomConversions ?? [],
      batches: editingId
        ? products.find((item) => item.id === editingId)?.batches ?? []
        : []
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
                <FieldLabel>Base selling unit</FieldLabel>
                <select
                  className={selectClassName}
                  value={form.baseUnitOfMeasureId}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      baseUnitOfMeasureId: event.target.value,
                      uomConversions: current.uomConversions.filter(
                        (conversion) => conversion.unitOfMeasureId !== event.target.value
                      )
                    }))
                  }
                >
                  {units.map((unit) => (
                    <option key={unit.id} value={unit.id}>
                      {unit.name}
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

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.trackBatches}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trackBatches: event.target.checked,
                      trackExpiry: event.target.checked ? current.trackExpiry : false
                    }))
                  }
                />
                Track lot / batch records
              </label>
              <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
                <input
                  type="checkbox"
                  checked={form.trackExpiry}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      trackExpiry: event.target.checked,
                      trackBatches: event.target.checked ? true : current.trackBatches
                    }))
                  }
                />
                Track expiry dates
              </label>
            </div>

            <div className="mt-4 rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
              Shop defaults: {inventoryDefaults.batchTrackingEnabled ? 'batch tracking on' : 'batch tracking optional'}
              {' / '}
              {inventoryDefaults.expiryTrackingEnabled ? 'expiry tracking on' : 'expiry tracking optional'}
              {' / '}
              Alerts within {inventoryDefaults.expiryAlertDays} day(s)
            </div>

            <div className="mt-4 rounded-[20px] border border-stone-200 bg-white p-4">
              <div className="mb-3 text-sm font-semibold text-stone-900">Pack conversions</div>
              <div className="space-y-3">
                {units
                  .filter((unit) => unit.id !== form.baseUnitOfMeasureId)
                  .map((unit) => {
                    const conversion = form.uomConversions.find((entry) => entry.unitOfMeasureId === unit.id);

                    return (
                      <div key={unit.id} className="grid gap-3 sm:grid-cols-[1fr_180px] sm:items-center">
                        <div className="text-sm text-stone-600">
                          1 <span className="font-semibold text-stone-900">{unit.name.toLowerCase()}</span>
                          {' = '}
                          <span className="font-semibold text-stone-900">
                            {conversion?.ratioToBase || '...'}
                          </span>
                          {' '}
                          {units.find((entry) => entry.id === form.baseUnitOfMeasureId)?.name.toLowerCase() ?? 'base unit'}{conversion?.ratioToBase === '1' ? '' : 's'}
                        </div>
                        <Input
                          type="number"
                          min="1"
                          placeholder={`Qty in ${units.find((entry) => entry.id === form.baseUnitOfMeasureId)?.name.toLowerCase() ?? 'base unit'}s`}
                          value={conversion?.ratioToBase ?? ''}
                          onChange={(event) =>
                            setForm((current) => {
                              const nextValue = event.target.value;
                              const remaining = current.uomConversions.filter((entry) => entry.unitOfMeasureId !== unit.id);

                              if (!nextValue) {
                                return {
                                  ...current,
                                  uomConversions: remaining
                                };
                              }

                              return {
                                ...current,
                                uomConversions: [
                                  ...remaining,
                                  {
                                    unitOfMeasureId: unit.id,
                                    ratioToBase: nextValue
                                  }
                                ]
                              };
                            })
                          }
                        />
                      </div>
                    );
                  })}
              </div>
              <div className="mt-3 text-xs text-stone-500">
                Use direct-to-base ratios such as 1 box = 12 pieces or 1 carton = 288 pieces.
              </div>
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
                  <th className="px-4 py-3.5">UOM / Tracking</th>
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
                  const nextExpiryBatch = product.batches.find((batch) => batch.expiryDate && batch.quantity > 0) ?? null;
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
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          {product.baseUnitOfMeasure ? <Badge tone="stone">Base: {product.baseUnitOfMeasure.name}</Badge> : null}
                          {product.trackBatches ? <Badge tone="blue">Batch</Badge> : null}
                          {product.trackExpiry ? <Badge tone="amber">Expiry</Badge> : null}
                          {!product.trackBatches && !product.trackExpiry && !product.baseUnitOfMeasure ? <Badge tone="stone">Standard</Badge> : null}
                        </div>
                        <div className="mt-2 text-xs text-stone-500">
                          {summarizeConversions(
                            product.uomConversions.map((conversion) => ({
                              unitName: conversion.unitOfMeasure.name,
                              ratioToBase: conversion.ratioToBase
                            })),
                            product.baseUnitOfMeasure?.name
                          )}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          {nextExpiryBatch?.expiryDate
                            ? `Next expiry ${new Date(nextExpiryBatch.expiryDate).toLocaleDateString('en-PH')}`
                            : product.batches.length
                              ? `${product.batches.length} batch record(s)`
                              : 'No batch records yet'}
                        </div>
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
