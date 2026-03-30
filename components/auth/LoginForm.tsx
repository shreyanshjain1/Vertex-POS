'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';

function getSafeCallbackUrl(callbackUrl: string | null) {
  if (!callbackUrl) {
    return '/dashboard';
  }

  if (callbackUrl.startsWith('/')) {
    return callbackUrl;
  }

  try {
    const url = new URL(callbackUrl);
    return `${url.pathname}${url.search}${url.hash}` || '/dashboard';
  } catch {
    return '/dashboard';
  }
}

export default function LoginForm({
  inactiveAccess,
  callbackUrl
}: {
  inactiveAccess: boolean;
  callbackUrl: string | null;
}) {
  const router = useRouter();
  const [email, setEmail] = useState('owner@vertexpos.local');
  const [password, setPassword] = useState('password123');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const destination = getSafeCallbackUrl(callbackUrl);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setLoading(true);

    const result = await signIn('credentials', {
      email,
      password,
      redirect: false,
      callbackUrl: destination
    });
    setLoading(false);

    if (result?.error) {
      setError('Invalid email or password.');
      return;
    }

    router.push(destination);
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-2">
        <div className="hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-10 text-white shadow-xl md:block">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black">V</div>
          <h1 className="text-4xl font-black leading-tight">Sign in to manage your store.</h1>
          <p className="mt-4 text-base leading-7 text-emerald-50">Use the seeded demo account or your own account to access products, checkout, purchases, reports, and settings.</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-lg md:p-10">
          <h2 className="text-3xl font-black text-stone-900">Sign in</h2>
          <p className="mt-2 text-sm text-stone-500">Use the seeded demo account or your own account.</p>
          {inactiveAccess ? (
            <div className="mt-5 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              Your shop access is inactive. Contact an administrator if you still need access.
            </div>
          ) : null}
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-800">Email</label>
              <Input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
            </div>
            <div>
              <label className="mb-2 block text-sm font-semibold text-stone-800">Password</label>
              <Input type="password" value={password} onChange={(event) => setPassword(event.target.value)} required />
            </div>
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Signing in...' : 'Sign in'}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-stone-600">Don&apos;t have an account? <button type="button" onClick={() => router.push('/signup')} className="font-semibold text-emerald-600 hover:text-emerald-700">Create one</button></p>
        </div>
      </div>
    </main>
  );
}
