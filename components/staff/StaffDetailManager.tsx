'use client';

import { useState } from 'react';
import Badge from '@/components/ui/Badge';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';
import Input from '@/components/ui/Input';
import { dateTime, shortDate } from '@/lib/format';
import { SerializedAuthAuditLog } from '@/lib/serializers/staff';

type ManagedShop = {
  id: string;
  name: string;
  slug: string;
};

type StaffDetail = {
  id: string;
  userId: string;
  name: string;
  email: string;
  role: 'ADMIN' | 'MANAGER' | 'CASHIER';
  shopId: string;
  shopName: string;
  shopSlug: string;
  isActive: boolean;
  assignedAt: string;
  disabledAt: string | null;
  lastLogin: string | null;
  authActivity: SerializedAuthAuditLog[];
  hasPin: boolean;
  pinSetAt: string | null;
};

const selectClassName =
  'h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10';

function authTone(action: string) {
  if (action.includes('FAILURE') || action.includes('BLOCKED')) {
    return 'red';
  }

  if (action.includes('COMPLETED') || action.includes('SUCCESS')) {
    return 'emerald';
  }

  return 'amber';
}

export default function StaffDetailManager({
  initialStaff,
  shops
}: {
  initialStaff: StaffDetail;
  shops: ManagedShop[];
}) {
  const [staff, setStaff] = useState(initialStaff);
  const [assignment, setAssignment] = useState({
    role: initialStaff.role,
    shopId: initialStaff.shopId,
    isActive: initialStaff.isActive
  });
  const [pin, setPin] = useState('');
  const [resetUrl, setResetUrl] = useState('');
  const [resetExpiresAt, setResetExpiresAt] = useState('');
  const [assignmentError, setAssignmentError] = useState('');
  const [assignmentSuccess, setAssignmentSuccess] = useState('');
  const [resetError, setResetError] = useState('');
  const [resetSuccess, setResetSuccess] = useState('');
  const [pinError, setPinError] = useState('');
  const [pinSuccess, setPinSuccess] = useState('');
  const [savingAssignment, setSavingAssignment] = useState(false);
  const [issuingReset, setIssuingReset] = useState(false);
  const [savingPin, setSavingPin] = useState(false);

  async function saveAssignment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setAssignmentError('');
    setAssignmentSuccess('');
    setSavingAssignment(true);

    const response = await fetch(`/api/staff/${staff.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(assignment)
    });

    const data = await response.json().catch(() => ({ error: 'Unable to update the staff record.' }));
    setSavingAssignment(false);

    if (!response.ok || !data?.item) {
      setAssignmentError(data?.error ?? 'Unable to update the staff record.');
      return;
    }

    setStaff((current) => ({
      ...current,
      ...data.item,
      hasPin: data.item.role === 'CASHIER' ? current.hasPin : false,
      pinSetAt: data.item.role === 'CASHIER' ? current.pinSetAt : null
    }));
    setAssignment({
      role: data.item.role,
      shopId: data.item.shopId,
      isActive: data.item.isActive
    });
    setAssignmentSuccess('Staff assignment updated successfully.');
  }

  async function issueResetLink() {
    setResetError('');
    setResetSuccess('');
    setIssuingReset(true);

    const response = await fetch(`/api/staff/${staff.id}/reset-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ expiresInHours: 24 })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to create a reset link.' }));
    setIssuingReset(false);

    if (!response.ok) {
      setResetError(data?.error ?? 'Unable to create a reset link.');
      return;
    }

    setResetUrl(data.resetUrl);
    setResetExpiresAt(data.expiresAt);
    setResetSuccess('Password reset link generated. Share it securely with the staff member.');
  }

  async function copyResetLink() {
    try {
      await navigator.clipboard.writeText(resetUrl);
      setResetSuccess('Reset link copied to the clipboard.');
    } catch {
      setResetError('Unable to copy the reset link automatically.');
    }
  }

  async function savePin(nextPin: string | null) {
    setPinError('');
    setPinSuccess('');
    setSavingPin(true);

    const response = await fetch(`/api/staff/${staff.id}/pin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin: nextPin })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to update the quick-unlock PIN.' }));
    setSavingPin(false);

    if (!response.ok) {
      setPinError(data?.error ?? 'Unable to update the quick-unlock PIN.');
      return;
    }

    setStaff((current) => ({
      ...current,
      hasPin: data.hasPin,
      pinSetAt: data.pinSetAt
    }));
    setPin('');
    setPinSuccess(data.hasPin ? 'Cashier PIN saved securely.' : 'Cashier PIN cleared.');
  }

  return (
    <div className="space-y-6">
      <Card>
        <div className="grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
          <div>
            <div className="text-[11px] font-semibold uppercase tracking-[0.22em] text-emerald-700">Staff profile</div>
            <h2 className="mt-2 text-3xl font-black text-stone-950">{staff.name}</h2>
            <p className="mt-2 text-sm text-stone-500">{staff.email}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              <Badge tone={staff.isActive ? 'emerald' : 'red'}>
                {staff.isActive ? 'Active' : 'Inactive'}
              </Badge>
              <Badge tone={staff.role === 'ADMIN' ? 'blue' : staff.role === 'MANAGER' ? 'amber' : 'stone'}>
                {staff.role}
              </Badge>
              <Badge tone="stone">{staff.shopName}</Badge>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Assigned</div>
              <div className="mt-2 text-lg font-black text-stone-950">{shortDate(staff.assignedAt)}</div>
              <div className="mt-1 text-sm text-stone-500">{staff.shopSlug}</div>
            </div>
            <div className="rounded-[24px] border border-stone-200 bg-stone-50 px-4 py-4">
              <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Last login</div>
              <div className="mt-2 text-lg font-black text-stone-950">
                {staff.lastLogin ? dateTime(staff.lastLogin) : 'Never'}
              </div>
              <div className="mt-1 text-sm text-stone-500">
                {staff.disabledAt ? `Disabled ${dateTime(staff.disabledAt)}` : 'Current assignment is live.'}
              </div>
            </div>
          </div>
        </div>
      </Card>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <Card>
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Assignment controls</div>
          <h3 className="mt-2 text-xl font-black text-stone-950">Role, shop, and access</h3>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Update the staff member&apos;s role, move the assignment to another managed shop, or safely suspend access.
          </p>

          <form onSubmit={saveAssignment} className="mt-6 space-y-4">
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">Role</label>
                <select
                  className={selectClassName}
                  value={assignment.role}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      role: event.target.value as StaffDetail['role']
                    }))
                  }
                >
                  <option value="ADMIN">Admin</option>
                  <option value="MANAGER">Manager</option>
                  <option value="CASHIER">Cashier</option>
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-semibold text-stone-700">Assigned shop</label>
                <select
                  className={selectClassName}
                  value={assignment.shopId}
                  onChange={(event) =>
                    setAssignment((current) => ({
                      ...current,
                      shopId: event.target.value
                    }))
                  }
                >
                  {shops.map((shop) => (
                    <option key={shop.id} value={shop.id}>
                      {shop.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <label className="inline-flex items-center gap-3 text-sm font-medium text-stone-700">
              <input
                type="checkbox"
                checked={assignment.isActive}
                onChange={(event) =>
                  setAssignment((current) => ({
                    ...current,
                    isActive: event.target.checked
                  }))
                }
              />
              Staff assignment is active and can sign in to the selected shop
            </label>

            {assignmentError ? (
              <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{assignmentError}</div>
            ) : null}

            {assignmentSuccess ? (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {assignmentSuccess}
              </div>
            ) : null}

            <Button type="submit" disabled={savingAssignment}>
              {savingAssignment ? 'Saving changes...' : 'Save assignment'}
            </Button>
          </form>
        </Card>

        <div className="space-y-6">
          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Password reset</div>
            <h3 className="mt-2 text-xl font-black text-stone-950">Admin-managed reset link</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Generate a one-time reset link that expires in 24 hours. The raw token is never stored in the database.
            </p>

            <div className="mt-5 flex flex-wrap gap-3">
              <Button type="button" onClick={issueResetLink} disabled={issuingReset}>
                {issuingReset ? 'Generating link...' : 'Generate reset link'}
              </Button>
              {resetUrl ? (
                <Button type="button" variant="secondary" onClick={copyResetLink}>
                  Copy link
                </Button>
              ) : null}
            </div>

            {resetUrl ? (
              <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4">
                <div className="text-[11px] font-semibold uppercase tracking-[0.16em] text-stone-400">Secure link</div>
                <div className="mt-2 break-all text-sm text-stone-700">{resetUrl}</div>
                <div className="mt-2 text-xs text-stone-500">Expires {dateTime(resetExpiresAt)}</div>
              </div>
            ) : null}

            {resetError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{resetError}</div>
            ) : null}

            {resetSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {resetSuccess}
              </div>
            ) : null}
          </Card>

          <Card>
            <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Cashier quick unlock</div>
            <h3 className="mt-2 text-xl font-black text-stone-950">Optional staff PIN</h3>
            <p className="mt-2 text-sm leading-6 text-stone-500">
              Store a cashier PIN as a secure hash. This can support quick-unlock flows without storing the PIN in plain text.
            </p>

            {staff.role === 'CASHIER' ? (
              <>
                <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_auto]">
                  <Input
                    type="password"
                    inputMode="numeric"
                    placeholder="4 to 8 digit PIN"
                    value={pin}
                    onChange={(event) => setPin(event.target.value)}
                  />
                  <Button type="button" onClick={() => savePin(pin)} disabled={savingPin}>
                    {savingPin ? 'Saving...' : staff.hasPin ? 'Update PIN' : 'Set PIN'}
                  </Button>
                  {staff.hasPin ? (
                    <Button type="button" variant="secondary" onClick={() => savePin(null)} disabled={savingPin}>
                      Clear PIN
                    </Button>
                  ) : null}
                </div>

                <div className="mt-3 text-sm text-stone-500">
                  {staff.hasPin && staff.pinSetAt ? `PIN last updated ${dateTime(staff.pinSetAt)}.` : 'No PIN stored for this cashier yet.'}
                </div>
              </>
            ) : (
              <div className="mt-4 rounded-[22px] border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-600">
                Quick-unlock PINs are limited to cashier assignments.
              </div>
            )}

            {pinError ? (
              <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{pinError}</div>
            ) : null}

            {pinSuccess ? (
              <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {pinSuccess}
              </div>
            ) : null}
          </Card>
        </div>
      </div>

      <Card>
        <div className="mb-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.18em] text-stone-400">Auth activity</div>
          <h3 className="mt-2 text-xl font-black text-stone-950">Recent login and password events</h3>
          <p className="mt-2 text-sm text-stone-500">
            Review successful logins, failed attempts, and password reset activity for this staff account.
          </p>
        </div>

        <div className="overflow-hidden rounded-[26px] border border-stone-200">
          <div className="overflow-x-auto">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-stone-50 text-stone-500">
                <tr>
                  <th className="px-4 py-3.5">When</th>
                  <th className="px-4 py-3.5">Action</th>
                  <th className="px-4 py-3.5">Email</th>
                  <th className="px-4 py-3.5">IP</th>
                  <th className="px-4 py-3.5">User agent</th>
                </tr>
              </thead>
              <tbody>
                {staff.authActivity.map((log) => (
                  <tr key={log.id} className="border-t border-stone-200 bg-white">
                    <td className="px-4 py-4 text-stone-600">{dateTime(log.createdAt)}</td>
                    <td className="px-4 py-4">
                      <Badge tone={authTone(log.action)}>{log.action.replaceAll('_', ' ')}</Badge>
                    </td>
                    <td className="px-4 py-4 text-stone-700">{log.email ?? staff.email}</td>
                    <td className="px-4 py-4 text-stone-600">{log.ipAddress ?? 'N/A'}</td>
                    <td className="max-w-xs px-4 py-4 text-xs text-stone-500">{log.userAgent ?? 'N/A'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {!staff.authActivity.length ? (
            <div className="border-t border-stone-200 bg-stone-50 px-6 py-10 text-center text-sm text-stone-500">
              No auth activity has been recorded for this staff account yet.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}
