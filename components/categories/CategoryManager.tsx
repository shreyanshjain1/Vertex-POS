'use client';

import { useMemo, useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

type Category = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  isActive: boolean;
  _count?: { products: number; children: number };
};

export default function CategoryManager({ initialCategories }: { initialCategories: Category[] }) {
  const [categories, setCategories] = useState(initialCategories);
  const [name, setName] = useState('');
  const [parentId, setParentId] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const parents = useMemo(() => categories.filter((item) => !item.parentId), [categories]);

  async function addCategory() {
    setError('');
    setSuccess('');

    const response = await fetch('/api/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, parentId: parentId || null })
    });

    const data = await response.json().catch(() => ({ error: 'Failed to create category.' }));
    if (!response.ok) {
      setError(data.error ?? 'Failed to create category.');
      return;
    }

    setCategories((current) => [data.category, ...current]);
    setName('');
    setParentId('');
    setSuccess('Category created successfully.');
  }

  async function toggleActive(category: Category) {
    const confirmed = window.confirm(`${category.isActive ? 'Archive' : 'Restore'} ${category.name}?`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/categories/${category.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        isActive: !category.isActive,
        name: category.name,
        parentId: category.parentId
      })
    });

    const data = await response.json().catch(() => null);
    if (!response.ok || !data?.category) {
      setError(data?.error ?? 'Failed to update category.');
      return;
    }

    setCategories((current) =>
      current.map((entry) => (entry.id === category.id ? data.category : entry))
    );
  }

  async function removeCategory(category: Category) {
    const confirmed = window.confirm(`Delete ${category.name}? This cannot be undone.`);
    if (!confirmed) {
      return;
    }

    const response = await fetch(`/api/categories/${category.id}`, { method: 'DELETE' });
    const data = await response.json().catch(() => ({ error: 'Failed to delete category.' }));

    if (!response.ok) {
      setError(data.error ?? 'Failed to delete category.');
      return;
    }

    setCategories((current) => current.filter((entry) => entry.id !== category.id));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
      <Card>
        <h2 id="new-category" className="text-xl font-black text-stone-900">Create category</h2>
        <div className="mt-5 grid gap-4">
          <div>
            <label className="mb-2 block text-sm font-semibold">Category name</label>
            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Soft Drinks" />
          </div>
          <div>
            <label className="mb-2 block text-sm font-semibold">Parent category</label>
            <select
              className="w-full rounded-xl border border-stone-300 bg-stone-50 px-4 py-2.5 text-sm"
              value={parentId}
              onChange={(event) => setParentId(event.target.value)}
            >
              <option value="">No parent</option>
              {parents.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>

          {error ? (
            <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
              {success}
            </div>
          ) : null}

          <Button type="button" onClick={addCategory}>Save category</Button>
        </div>
      </Card>

      <Card>
        <h2 className="text-xl font-black text-stone-900">Category list</h2>
        <div className="mt-4 space-y-3">
          {categories.length ? (
            categories.map((category) => (
              <div key={category.id} className="rounded-2xl border border-stone-200 p-4">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold text-stone-900">{category.name}</div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge tone={category.isActive ? 'emerald' : 'stone'}>
                        {category.isActive ? 'Active' : 'Archived'}
                      </Badge>
                      <Badge tone="blue">{category.parentId ? 'Subcategory' : 'Top level'}</Badge>
                    </div>
                    <div className="mt-2 text-sm text-stone-500">
                      {category._count?.products ?? 0} product(s) / {category._count?.children ?? 0} child category(s)
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button type="button" variant="secondary" onClick={() => toggleActive(category)}>
                      {category.isActive ? 'Archive' : 'Restore'}
                    </Button>
                    <Button type="button" variant="danger" onClick={() => removeCategory(category)}>
                      Delete
                    </Button>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50 p-5 text-sm text-stone-500">
              No categories yet. Create one to keep the product catalog organized.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
