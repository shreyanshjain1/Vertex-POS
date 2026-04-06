'use client';

import Link from 'next/link';
import { useState } from 'react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

export default function ForgotPasswordForm() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    const response = await fetch('/api/auth/request-password-reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to process your request right now.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data?.error ?? 'Unable to process your request right now.');
      return;
    }

    setSuccess(
      data?.message ??
        'If that email address exists in the system, a password reset link has been sent.'
    );
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto flex min-h-screen max-w-3xl items-center px-6 py-12">
        <div className="w-full rounded-3xl border border-stone-200 bg-white p-8 shadow-lg md:p-10">
          <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-2xl font-black text-white">
            V
          </div>
          <h1 className="mt-6 text-3xl font-black text-stone-950">Forgot password</h1>
          <p className="mt-2 text-sm leading-6 text-stone-500">
            Enter your account email address and we&apos;ll send you a password reset link if your account is eligible.
          </p>

          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-800">Email</label>
              <Input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                autoComplete="email"
                required
              />
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>
            ) : null}

            {success ? (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
                {success}
              </div>
            ) : null}

            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Sending reset link...' : 'Send reset link'}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-stone-600">
            <Link href="/login" className="font-semibold text-emerald-600 hover:text-emerald-700">
              Back to sign in
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
