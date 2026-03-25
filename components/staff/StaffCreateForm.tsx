'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';

type ManagedShop = {
  id: string;
  name: string;
  slug: string;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <label className="mb-2 block text-sm font-semibold text-stone-700">{children}</label>;
}

export default function StaffCreateForm({
  shops,
  defaultShopId
}: {
  shops: ManagedShop[];
  defaultShopId: string;
}) {
  const router = useRouter();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    role: 'CASHIER',
    shopId: defaultShopId
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const response = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await response.json().catch(() => ({ error: 'Unable to create the staff account.' }));
    setLoading(false);

    if (!response.ok || !data?.item) {
      setError(data?.error ?? 'Unable to create the staff account.');
      return;
    }

    router.push(`/staff/${data.item.id}`);
    router.refresh();
  }

  return (
    <Card>
      <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">New team member</div>
          <h2 className="mt-2 text-2xl font-black text-stone-950">Create a staff account</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-stone-500">
            Create the account, choose the assigned shop, and set the role in one pass. Password resets and cashier PIN setup can be managed after creation.
          </p>
        </div>

        <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
          Only admins can create staff accounts for the shops they manage.
        </div>
      </div>

      <form onSubmit={onSubmit} className="mt-6 space-y-6">
        <div className="rounded-[26px] border border-stone-200 bg-stone-50/80 p-4 sm:p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Profile</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Full name</FieldLabel>
              <Input
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                placeholder="e.g. Jamie Santos"
                required
              />
            </div>

            <div>
              <FieldLabel>Email</FieldLabel>
              <Input
                type="email"
                value={form.email}
                onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                placeholder="staff@shop.local"
                required
              />
            </div>

            <div>
              <FieldLabel>Initial password</FieldLabel>
              <Input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                placeholder="At least 8 characters"
                required
              />
            </div>

            <div>
              <FieldLabel>Role</FieldLabel>
              <select
                className={selectClassName}
                value={form.role}
                onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
              >
                <option value="ADMIN">Admin</option>
                <option value="MANAGER">Manager</option>
                <option value="CASHIER">Cashier</option>
              </select>
            </div>
          </div>
        </div>

        <div className="rounded-[26px] border border-stone-200 bg-white/70 p-4 sm:p-5">
          <div className="mb-4 text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Assignment</div>
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <FieldLabel>Assigned shop</FieldLabel>
              <select
                className={selectClassName}
                value={form.shopId}
                onChange={(event) => setForm((current) => ({ ...current, shopId: event.target.value }))}
              >
                {shops.map((shop) => (
                  <option key={shop.id} value={shop.id}>
                    {shop.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm leading-6 text-stone-600">
              The staff record is created as active immediately, and last-login activity will appear after the first successful sign-in.
            </div>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row">
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating account...' : 'Create staff account'}
          </Button>
          <Button type="button" variant="secondary" onClick={() => router.push('/staff')}>
            Back to staff
          </Button>
        </div>
      </form>
    </Card>
  );
}
