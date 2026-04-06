'use client';

import { type FormEvent, type ReactNode, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import BarcodeLabelPreview, { type BarcodeLabelSize } from '@/components/products/BarcodeLabelPreview';
import { money, shortDate } from '@/lib/format';
import { getStockLevel, stockLevelLabel } from '@/lib/inventory';
import {
  buildVariantLabel,
  getMarginSummary
} from '@/lib/product-merchandising';
import { summarizeConversions } from '@/lib/uom';

type Category = { id: string; name: string; parentId: string | null };
type UnitOfMeasure = { id: string; code: string; name: string; isBase: boolean };
type Variant = {
  id: string;
  color: string | null;
  size: string | null;
  flavor: string | null;
  model: string | null;
  sku: string | null;
  barcode: string | null;
  priceOverride: string | null;
  costOverride: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};
type ProductImage = {
  id: string;
  imageUrl: string;
  altText: string | null;
  sortOrder: number;
  createdAt: string;
};
type HistoryUser = { id: string; name: string | null; email: string };
type PriceHistory = {
  id: string;
  previousPrice: string;
  newPrice: string;
  effectiveDate: string;
  createdAt: string;
  note: string | null;
  changedByUser: HistoryUser;
};
type CostHistory = {
  id: string;
  previousCost: string;
  newCost: string;
  effectiveDate: string;
  createdAt: string;
  note: string | null;
  changedByUser: HistoryUser;
};
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
  variants: Variant[];
  images: ProductImage[];
  priceHistory: PriceHistory[];
  costHistory: CostHistory[];
  batches: Array<{
    id: string;
    lotNumber: string;
    expiryDate: string | null;
    quantity: number;
  }>;
  category?: { id: string; name: string } | null;
};
type VariantDraft = {
  color: string;
  size: string;
  flavor: string;
  model: string;
  sku: string;
  barcode: string;
  priceOverride: string;
  costOverride: string;
  isActive: boolean;
};
type ImageDraft = {
  imageUrl: string;
  altText: string;
  sortOrder: string;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function FieldLabel({ children }: { children: ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-stone-700">{children}</label>;
}

function emptyVariant(): VariantDraft {
  return {
    color: '',
    size: '',
    flavor: '',
    model: '',
    sku: '',
    barcode: '',
    priceOverride: '',
    costOverride: '',
    isActive: true
  };
}

function emptyImage(sortOrder = 0): ImageDraft {
  return {
    imageUrl: '',
    altText: '',
    sortOrder: String(sortOrder)
  };
}

function toVariantLabel(variant: VariantDraft | Variant) {
  return buildVariantLabel({
    color: variant.color,
    size: variant.size,
    flavor: variant.flavor,
    model: variant.model
  });
}

async function uploadProductImage(file: File) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await fetch('/api/uploads/products', {
    method: 'POST',
    body: formData
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || typeof payload?.imageUrl !== 'string') {
    throw new Error(payload?.error || 'Unable to upload image.');
  }

  return payload.imageUrl as string;
}

export default function ProductManager({
  initialProducts,
  categories,
  units,
  canEditProducts,
  canViewPurchaseCosts,
  currencySymbol,
  lowStockThreshold,
  inventoryDefaults
}: {
  initialProducts: Product[];
  categories: Category[];
  units: UnitOfMeasure[];
  canEditProducts: boolean;
  canViewPurchaseCosts: boolean;
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
  const [labelSize, setLabelSize] = useState<BarcodeLabelSize>('medium');
  const uploadInputRef = useRef<HTMLInputElement>(null);
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
    changeNote: '',
    uomConversions: [] as Array<{ unitOfMeasureId: string; ratioToBase: string }>,
    variants: [] as VariantDraft[],
    images: [] as ImageDraft[],
    isActive: true
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [uploadingImages, setUploadingImages] = useState(false);

  const filtered = useMemo(() => {
    const term = query.toLowerCase().trim();

    return products.filter((product) => {
      const variantSearch = product.variants
        .map((variant) => [variant.sku ?? '', variant.barcode ?? '', toVariantLabel(variant)].join(' '))
        .join(' ');
      const matchesTerm =
        !term ||
        [product.name, product.sku ?? '', product.barcode ?? '', product.category?.name ?? '', variantSearch]
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
  const selectedBaseUnit = units.find((unit) => unit.id === form.baseUnitOfMeasureId) ?? null;
  const currentMargin = getMarginSummary(Number(form.price || 0), Number(form.cost || 0));

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
      changeNote: '',
      uomConversions: [],
      variants: [],
      images: [],
      isActive: true
    });
    if (uploadInputRef.current) {
      uploadInputRef.current.value = '';
    }
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
      changeNote: '',
      uomConversions: product.uomConversions.map((conversion) => ({
        unitOfMeasureId: conversion.unitOfMeasureId,
        ratioToBase: String(conversion.ratioToBase)
      })),
      variants: product.variants.map((variant) => ({
        color: variant.color ?? '',
        size: variant.size ?? '',
        flavor: variant.flavor ?? '',
        model: variant.model ?? '',
        sku: variant.sku ?? '',
        barcode: variant.barcode ?? '',
        priceOverride: variant.priceOverride ?? '',
        costOverride: variant.costOverride ?? '',
        isActive: variant.isActive
      })),
      images: product.images.map((image) => ({
        imageUrl: image.imageUrl,
        altText: image.altText ?? '',
        sortOrder: String(image.sortOrder)
      })),
      isActive: product.isActive
    });
  }

  async function addUploadedImages(files: FileList | null) {
    if (!files?.length) {
      return;
    }

    const remainingSlots = Math.max(0, 6 - form.images.length);
    if (!remainingSlots) {
      setError('You can only add up to 6 images per product.');
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
      return;
    }

    const selectedFiles = Array.from(files).slice(0, remainingSlots);
    setUploadingImages(true);
    setError('');

    try {
      const uploadedImageUrls = await Promise.all(selectedFiles.map((file) => uploadProductImage(file)));
      setForm((current) => ({
        ...current,
        images: [
          ...current.images,
          ...uploadedImageUrls.map((imageUrl, index) => ({
            ...emptyImage(current.images.length + index),
            imageUrl
          }))
        ]
      }));
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Unable to upload one or more images.');
    } finally {
      setUploadingImages(false);
      if (uploadInputRef.current) {
        uploadInputRef.current.value = '';
      }
    }
  }

  async function saveProduct(event: FormEvent<HTMLFormElement>) {
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

    for (const variant of form.variants) {
      if (![variant.color, variant.size, variant.flavor, variant.model, variant.sku, variant.barcode].some(Boolean)) {
        setError('Each variant needs at least one descriptor, SKU, or barcode.');
        return;
      }

      if (variant.priceOverride && Number(variant.priceOverride) < 0) {
        setError('Variant price overrides must not be negative.');
        return;
      }

      if (variant.costOverride && Number(variant.costOverride) < 0) {
        setError('Variant cost overrides must not be negative.');
        return;
      }
    }

    for (const image of form.images) {
      if (!image.imageUrl.trim()) {
        setError('Remove blank image rows or upload an image.');
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
      changeNote: form.changeNote || null,
      cost: Number(form.cost),
      price: Number(form.price),
      reorderPoint: Number(form.reorderPoint),
      uomConversions: form.uomConversions.map((conversion) => ({
        unitOfMeasureId: conversion.unitOfMeasureId,
        ratioToBase: Number(conversion.ratioToBase)
      })),
      variants: form.variants.map((variant) => ({
        color: variant.color || null,
        size: variant.size || null,
        flavor: variant.flavor || null,
        model: variant.model || null,
        sku: variant.sku || null,
        barcode: variant.barcode || null,
        priceOverride: variant.priceOverride ? Number(variant.priceOverride) : null,
        costOverride: variant.costOverride ? Number(variant.costOverride) : null,
        isActive: variant.isActive
      })),
      images: form.images.map((image, index) => ({
        imageUrl: image.imageUrl.trim(),
        altText: image.altText || null,
        sortOrder: Number(image.sortOrder || index)
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
      variants: data.product.variants ?? [],
      images: data.product.images ?? [],
      priceHistory: data.product.priceHistory ?? [],
      costHistory: data.product.costHistory ?? [],
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
    const confirmed = window.confirm(`${product.isActive ? 'Archive' : 'Restore'} ${product.name}?`);
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
      {canEditProducts ? (
      <Card>
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Catalog editor</div>
            <div id="new-product" className="mt-2 text-2xl font-black text-stone-900">
              {editingId ? 'Edit product' : 'Add product'}
            </div>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
              Set product pricing, structured variants, media, and barcode-ready merchandising details while keeping stock changes on their audited flows.
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
                <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} required />
              </div>
              <div>
                <FieldLabel>Category</FieldLabel>
                <select className={selectClassName} value={form.categoryId} onChange={(event) => setForm((current) => ({ ...current, categoryId: event.target.value }))}>
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
                      uomConversions: current.uomConversions.filter((conversion) => conversion.unitOfMeasureId !== event.target.value)
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
                <Input value={form.sku} onChange={(event) => setForm((current) => ({ ...current, sku: event.target.value }))} />
              </div>
              <div>
                <FieldLabel>Barcode</FieldLabel>
                <Input value={form.barcode} onChange={(event) => setForm((current) => ({ ...current, barcode: event.target.value }))} />
              </div>
              {canViewPurchaseCosts ? (
                <div>
                  <FieldLabel>Cost price</FieldLabel>
                  <Input type="number" step="0.01" value={form.cost} onChange={(event) => setForm((current) => ({ ...current, cost: event.target.value }))} />
                </div>
              ) : null}
              <div>
                <FieldLabel>Selling price</FieldLabel>
                <Input type="number" step="0.01" value={form.price} onChange={(event) => setForm((current) => ({ ...current, price: event.target.value }))} />
              </div>
              <div>
                <FieldLabel>{editingId ? 'Current stock' : 'Opening stock quantity'}</FieldLabel>
                <Input type="number" value={form.stockQty} onChange={(event) => setForm((current) => ({ ...current, stockQty: event.target.value }))} disabled={Boolean(editingId)} />
              </div>
              <div>
                <FieldLabel>Low-stock reorder level</FieldLabel>
                <Input type="number" value={form.reorderPoint} onChange={(event) => setForm((current) => ({ ...current, reorderPoint: event.target.value }))} />
              </div>
              <div className="md:col-span-2 xl:col-span-3">
                <FieldLabel>Description</FieldLabel>
                <Input value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
              </div>
              <div>
                <FieldLabel>Change note</FieldLabel>
                <Input value={form.changeNote} onChange={(event) => setForm((current) => ({ ...current, changeNote: event.target.value }))} placeholder="Optional reason for pricing or cost updates" />
              </div>
            </div>

            <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_0.9fr]">
              <div className={`rounded-[20px] border px-4 py-3 text-sm ${currentMargin.tone === 'red' ? 'border-red-200 bg-red-50 text-red-700' : currentMargin.tone === 'amber' ? 'border-amber-200 bg-amber-50 text-amber-700' : 'border-emerald-200 bg-emerald-50 text-emerald-700'}`}>
                Margin check: {currentMargin.message} Current margin {currentMargin.percentage.toFixed(1)}%.
              </div>
              <div className="rounded-[20px] border border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
                Base unit: <span className="font-semibold text-stone-900">{selectedBaseUnit?.name ?? 'Not selected'}</span>
                {' / '}
                Shop alerts within {inventoryDefaults.expiryAlertDays} day(s)
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
            <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Operations</div>
            <div className="grid gap-3 sm:grid-cols-2">
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
              {inventoryDefaults.batchTrackingEnabled ? 'Batch tracking is enabled by default for this shop.' : 'Batch tracking is optional in this shop.'}
              {' '}
              {inventoryDefaults.expiryTrackingEnabled ? 'Expiry tracking is enabled by default.' : 'Expiry tracking is optional.'}
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
                          <span className="font-semibold text-stone-900">{conversion?.ratioToBase || '...'}</span>
                          {' '}
                          {selectedBaseUnit?.name.toLowerCase() ?? 'base unit'}{conversion?.ratioToBase === '1' ? '' : 's'}
                        </div>
                        <Input
                          type="number"
                          min="1"
                          value={conversion?.ratioToBase ?? ''}
                          onChange={(event) =>
                            setForm((current) => {
                              const nextValue = event.target.value;
                              const remaining = current.uomConversions.filter((entry) => entry.unitOfMeasureId !== unit.id);

                              if (!nextValue) {
                                return { ...current, uomConversions: remaining };
                              }

                              return {
                                ...current,
                                uomConversions: [...remaining, { unitOfMeasureId: unit.id, ratioToBase: nextValue }]
                              };
                            })
                          }
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          </div>

          <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
            <div className="mb-4 flex items-center justify-between gap-3">
              <div>
                <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Variants</div>
                <div className="mt-1 text-lg font-black text-stone-900">Structured variant options</div>
              </div>
              <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, variants: [...current.variants, emptyVariant()] }))}>
                Add variant
              </Button>
            </div>

            <div className="space-y-4">
              {form.variants.length ? form.variants.map((variant, index) => (
                <div key={`variant-${index}`} className="rounded-[22px] border border-stone-200 bg-stone-50/80 p-4">
                  <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                    <Input placeholder="Color" value={variant.color} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, color: event.target.value } : entry) }))} />
                    <Input placeholder="Size" value={variant.size} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, size: event.target.value } : entry) }))} />
                    <Input placeholder="Flavor" value={variant.flavor} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, flavor: event.target.value } : entry) }))} />
                    <Input placeholder="Model" value={variant.model} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, model: event.target.value } : entry) }))} />
                    <Input placeholder="Variant SKU" value={variant.sku} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, sku: event.target.value } : entry) }))} />
                    <Input placeholder="Variant barcode" value={variant.barcode} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, barcode: event.target.value } : entry) }))} />
                    <Input type="number" step="0.01" placeholder="Price override" value={variant.priceOverride} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, priceOverride: event.target.value } : entry) }))} />
                    <Input type="number" step="0.01" placeholder="Cost override" value={variant.costOverride} onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, costOverride: event.target.value } : entry) }))} />
                  </div>

                  <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
                    <label className="inline-flex items-center gap-2 text-sm text-stone-600">
                      <input
                        type="checkbox"
                        checked={variant.isActive}
                        onChange={(event) => setForm((current) => ({ ...current, variants: current.variants.map((entry, entryIndex) => entryIndex === index ? { ...entry, isActive: event.target.checked } : entry) }))}
                      />
                      Variant is active
                    </label>
                    <div className="text-xs text-stone-500">{toVariantLabel(variant) || 'Variant label will build from the fields above.'}</div>
                    <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, variants: current.variants.filter((_, entryIndex) => entryIndex !== index) }))}>
                      Remove
                    </Button>
                  </div>
                </div>
              )) : (
                <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                  No variants yet. Add colors, sizes, flavors, or models only when the product needs them.
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
            <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Images</div>
                  <div className="mt-1 text-lg font-black text-stone-900">Product media</div>
                </div>
                <input
                  ref={uploadInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={(event) => void addUploadedImages(event.target.files)}
                />
                <div className="flex gap-2">
                  <Button type="button" variant="secondary" onClick={() => uploadInputRef.current?.click()} disabled={uploadingImages || form.images.length >= 6}>
                    {uploadingImages ? 'Uploading…' : 'Upload image'}
                  </Button>
                  <Button type="button" variant="secondary" onClick={() => setForm((current) => ({ ...current, images: [...current.images, emptyImage(current.images.length)] }))}>
                    Add URL
                  </Button>
                </div>
              </div>

              <div className="space-y-3">
                {form.images.length ? form.images.map((image, index) => (
                  <div key={`image-${index}`} className="rounded-[22px] border border-stone-200 bg-stone-50/80 p-4">
                    <div className="grid gap-3 md:grid-cols-[120px_1fr]">
                      <div className="overflow-hidden rounded-[18px] border border-stone-200 bg-white">
                        {image.imageUrl ? (
                          <img src={image.imageUrl} alt={image.altText || form.name || 'Product image'} className="h-28 w-full object-cover" />
                        ) : (
                          <div className="flex h-28 items-center justify-center text-xs text-stone-400">No image</div>
                        )}
                      </div>
                      <div className="space-y-3">
                        <Input placeholder="Image URL or uploaded file path" value={image.imageUrl} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((entry, entryIndex) => entryIndex === index ? { ...entry, imageUrl: event.target.value } : entry) }))} />
                        <div className="grid gap-3 md:grid-cols-[1fr_120px_auto]">
                          <Input placeholder="Alt text" value={image.altText} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((entry, entryIndex) => entryIndex === index ? { ...entry, altText: event.target.value } : entry) }))} />
                          <Input type="number" placeholder="Sort" value={image.sortOrder} onChange={(event) => setForm((current) => ({ ...current, images: current.images.map((entry, entryIndex) => entryIndex === index ? { ...entry, sortOrder: event.target.value } : entry) }))} />
                          <Button type="button" variant="ghost" onClick={() => setForm((current) => ({ ...current, images: current.images.filter((_, entryIndex) => entryIndex !== index) }))}>
                            Remove
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )) : (
                  <div className="rounded-[22px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                    No images yet. Upload an image or use a hosted image URL.
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Barcode labels</div>
                  <div className="mt-1 text-lg font-black text-stone-900">Preview and print</div>
                </div>
                <select className={selectClassName} value={labelSize} onChange={(event) => setLabelSize(event.target.value as BarcodeLabelSize)}>
                  <option value="small">Small</option>
                  <option value="medium">Medium</option>
                  <option value="large">Large</option>
                </select>
              </div>

              <div className="mt-4 space-y-4">
                <BarcodeLabelPreview code={form.barcode || form.sku} productName={form.name || 'Product'} sku={form.sku || null} size={labelSize} />
                {form.variants.filter((variant) => variant.barcode || variant.sku).slice(0, 2).map((variant, index) => (
                  <BarcodeLabelPreview
                    key={`barcode-preview-${index}`}
                    code={variant.barcode || variant.sku}
                    productName={form.name || 'Product'}
                    variantLabel={toVariantLabel(variant)}
                    sku={variant.sku || null}
                    size={labelSize}
                  />
                ))}
              </div>

              {editingId ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link href={`/print/barcode-labels?productId=${editingId}&size=${labelSize}`} target="_blank">
                    <Button type="button">Print product labels</Button>
                  </Link>
                  {products
                    .find((product) => product.id === editingId)
                    ?.variants.filter((variant) => variant.barcode || variant.sku)
                    .slice(0, 2)
                    .map((variant) => (
                      <Link key={variant.id} href={`/print/barcode-labels?productId=${editingId}&variantId=${variant.id}&size=${labelSize}`} target="_blank">
                        <Button type="button" variant="secondary">
                          Print {toVariantLabel(variant) || 'variant'}
                        </Button>
                      </Link>
                    ))}
                </div>
              ) : null}
            </div>
          </div>

          {editingId ? (
            <div className="grid gap-6 xl:grid-cols-2">
              {canViewPurchaseCosts ? (
                <>
                  <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Price history</div>
                    <div className="mt-1 text-lg font-black text-stone-900">Recent price changes</div>
                    <div className="mt-4 space-y-3">
                      {(products.find((product) => product.id === editingId)?.priceHistory ?? []).length ? (
                        products.find((product) => product.id === editingId)!.priceHistory.map((entry) => (
                          <div key={entry.id} className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                            <div className="font-semibold text-stone-900">
                              {money(entry.previousPrice, currencySymbol)} to {money(entry.newPrice, currencySymbol)}
                            </div>
                            <div className="mt-1 text-xs text-stone-500">
                              {shortDate(entry.effectiveDate)} by {entry.changedByUser.name ?? entry.changedByUser.email}
                            </div>
                            {entry.note ? <div className="mt-2 text-xs text-stone-500">{entry.note}</div> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                          No price changes recorded yet.
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
                    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-stone-400">Cost history</div>
                    <div className="mt-1 text-lg font-black text-stone-900">Recent cost changes</div>
                    <div className="mt-4 space-y-3">
                      {(products.find((product) => product.id === editingId)?.costHistory ?? []).length ? (
                        products.find((product) => product.id === editingId)!.costHistory.map((entry) => (
                          <div key={entry.id} className="rounded-[20px] border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
                            <div className="font-semibold text-stone-900">
                              {money(entry.previousCost, currencySymbol)} to {money(entry.newCost, currencySymbol)}
                            </div>
                            <div className="mt-1 text-xs text-stone-500">
                              {shortDate(entry.effectiveDate)} by {entry.changedByUser.name ?? entry.changedByUser.email}
                            </div>
                            {entry.note ? <div className="mt-2 text-xs text-stone-500">{entry.note}</div> : null}
                          </div>
                        ))
                      ) : (
                        <div className="rounded-[20px] border border-dashed border-stone-300 bg-stone-50 px-4 py-5 text-sm text-stone-500">
                          No cost changes recorded yet.
                        </div>
                      )}
                    </div>
                  </div>
                </>
              ) : null}
            </div>
          ) : null}

          {error ? <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
          {success ? <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}

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
      ) : (
      <Card>
        <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Catalog access</div>
        <div className="mt-2 text-2xl font-black text-stone-900">Read-only product view</div>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
          This account can review the catalog{canViewPurchaseCosts ? ' and purchase-cost data' : ''}, but it does not have permission to create, edit, archive, or restore products.
        </p>
      </Card>
      )}

      <Card>
        <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h2 className="text-xl font-black text-stone-900">Product catalog</h2>
            <p className="text-sm text-stone-500">Search, filter, and manage commercial product records with variants and recent changes.</p>
          </div>

          <div className="flex flex-col gap-3 md:flex-row">
            <Input placeholder="Search products or variants..." value={query} onChange={(event) => setQuery(event.target.value)} className="md:w-72" />
            <select className={`${selectClassName} md:w-56`} value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
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
                  <th className="px-4 py-3.5">Product</th>
                  <th className="px-4 py-3.5">Category</th>
                  <th className="px-4 py-3.5">Commercial data</th>
                  <th className="px-4 py-3.5">Variants</th>
                  <th className="px-4 py-3.5">Pricing</th>
                  <th className="px-4 py-3.5">Stock</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-4 py-3.5">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((product) => {
                  const level = getStockLevel(product.stockQty, product.reorderPoint, lowStockThreshold);
                  const margin = getMarginSummary(Number(product.price), Number(product.cost));
                  const nextExpiryBatch = product.batches.find((batch) => batch.expiryDate && batch.quantity > 0) ?? null;

                  return (
                    <tr key={product.id} className="border-t border-stone-200 bg-white transition hover:bg-stone-50/70">
                      <td className="px-4 py-4">
                        <div className="flex gap-3">
                          <div className="h-14 w-14 overflow-hidden rounded-[18px] border border-stone-200 bg-stone-50">
                            {product.images[0] ? (
                              <img src={product.images[0].imageUrl} alt={product.images[0].altText ?? product.name} className="h-full w-full object-cover" />
                            ) : null}
                          </div>
                          <div>
                            <div className="font-semibold text-stone-900">{product.name}</div>
                            <div className="mt-1 text-xs text-stone-500">{product.description ?? 'No description'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">{product.category?.name ?? 'Uncategorized'}</td>
                      <td className="px-4 py-4 text-stone-600">
                        <div>{product.sku || 'N/A'} / {product.barcode || 'N/A'}</div>
                        <div className="mt-2 text-xs text-stone-500">
                          Base: {product.baseUnitOfMeasure?.name ?? 'Unit not set'}
                        </div>
                        <div className="mt-1 text-xs text-stone-500">
                          {summarizeConversions(
                            product.uomConversions.map((conversion) => ({
                              unitName: conversion.unitOfMeasure.name,
                              ratioToBase: conversion.ratioToBase
                            })),
                            product.baseUnitOfMeasure?.name
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone="blue">{product.variants.length} variant(s)</Badge>
                          {product.images.length ? <Badge tone="stone">{product.images.length} image(s)</Badge> : null}
                        </div>
                        <div className="mt-2 text-xs text-stone-500">
                          {product.variants.slice(0, 2).map((variant) => toVariantLabel(variant) || variant.sku || variant.barcode || 'Variant').join(' | ') || 'No variants'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{money(product.price, currencySymbol)}</div>
                        {canViewPurchaseCosts ? (
                          <>
                            <div className="text-xs text-stone-500">Cost {money(product.cost, currencySymbol)}</div>
                            <div className={`mt-2 text-xs ${margin.tone === 'red' ? 'text-red-700' : margin.tone === 'amber' ? 'text-amber-700' : 'text-emerald-700'}`}>
                              {margin.message}
                            </div>
                          </>
                        ) : (
                          <div className="text-xs text-stone-500">Cost visibility is restricted for this account.</div>
                        )}
                      </td>
                      <td className="px-4 py-4">
                        <div className="font-semibold text-stone-900">{product.stockQty}</div>
                        <div className="mt-1 text-xs text-stone-500">
                          {nextExpiryBatch?.expiryDate
                            ? `Next expiry ${shortDate(nextExpiryBatch.expiryDate)}`
                            : product.batches.length
                              ? `${product.batches.length} batch record(s)`
                              : 'No batch records'}
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-2">
                          <Badge tone={product.isActive ? 'emerald' : 'stone'}>{product.isActive ? 'Active' : 'Archived'}</Badge>
                          <Badge tone={level === 'OUT_OF_STOCK' ? 'red' : level === 'LOW_STOCK' ? 'amber' : 'blue'}>
                            {stockLevelLabel(level)}
                          </Badge>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        {canEditProducts ? (
                          <div className="flex gap-2">
                            <Button type="button" variant="secondary" onClick={() => beginEdit(product)}>
                              Edit
                            </Button>
                            <Button type="button" variant="ghost" className="text-xs uppercase tracking-[0.14em]" onClick={() => toggleArchive(product)}>
                              {product.isActive ? 'Archive' : 'Restore'}
                            </Button>
                          </div>
                        ) : (
                          <span className="text-xs text-stone-500">No edit access</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {!filtered.length ? (
            <div className="border-t border-stone-200 bg-stone-50 py-10 text-center text-sm text-stone-500">
              No products matched that filter.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
