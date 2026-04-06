'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';

type SignupFormState = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
};

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState<SignupFormState>({ name: '', email: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [pendingEmail, setPendingEmail] = useState('');
  const [verificationExpiresAt, setVerificationExpiresAt] = useState('');
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendMessage, setResendMessage] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    setSuccess('');
    setResendMessage('');
    setLoading(true);

    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form)
    });

    const data = await response.json().catch(() => ({ error: 'Unable to create account.' }));
    setLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Unable to create account.');
      return;
    }

    setPendingEmail(form.email.trim().toLowerCase());
    setVerificationExpiresAt(data.expiresAt ?? '');
    setSuccess(data.message ?? 'Account created. Check your inbox to verify the email address before signing in.');
    setForm({ name: '', email: '', password: '', confirmPassword: '' });
  }

  async function resendVerificationEmail() {
    if (!pendingEmail) {
      setError('Enter your email address and create an account first.');
      return;
    }

    setError('');
    setResendMessage('');
    setResendLoading(true);

    const response = await fetch('/api/auth/resend-verification', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: pendingEmail })
    });

    const data = await response.json().catch(() => ({ error: 'Unable to resend the verification email.' }));
    setResendLoading(false);

    if (!response.ok) {
      setError(data.error ?? 'Unable to resend the verification email.');
      return;
    }

    setVerificationExpiresAt(data.expiresAt ?? '');
    setResendMessage(data.message ?? 'A fresh verification email has been sent.');
  }

  return (
    <main className="min-h-screen bg-stone-50">
      <div className="mx-auto grid min-h-screen max-w-6xl items-center gap-10 px-6 py-12 md:grid-cols-2">
        <div className="hidden rounded-3xl bg-gradient-to-br from-emerald-600 to-emerald-700 p-10 text-white shadow-xl md:block">
          <div className="mb-6 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-white/15 text-2xl font-black">V</div>
          <h1 className="text-4xl font-black leading-tight">Create your store management account.</h1>
          <p className="mt-4 text-base leading-7 text-emerald-50">Sign up once, complete the onboarding wizard, add your first categories, products, and suppliers, then start selling immediately.</p>
        </div>
        <div className="rounded-3xl border border-stone-200 bg-white p-8 shadow-lg md:p-10">
          <h2 className="text-3xl font-black text-stone-900">Create account</h2>
          <form onSubmit={onSubmit} className="mt-8 space-y-5">
            <div><label className="mb-2 block text-sm font-semibold text-stone-800">Name</label><Input value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} required /></div>
            <div><label className="mb-2 block text-sm font-semibold text-stone-800">Email</label><Input type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} required /></div>
            <div><label className="mb-2 block text-sm font-semibold text-stone-800">Password</label><Input type="password" value={form.password} onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} required /></div>
            <div><label className="mb-2 block text-sm font-semibold text-stone-800">Confirm password</label><Input type="password" value={form.confirmPassword} onChange={(e) => setForm((p) => ({ ...p, confirmPassword: e.target.value }))} required /></div>
            {error ? <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div> : null}
            {success ? <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{success}</div> : null}
            {pendingEmail ? (
              <div className="rounded-2xl border border-stone-200 bg-stone-50 px-4 py-4 text-sm text-stone-700">
                <div className="font-semibold text-stone-900">Verification email sent</div>
                <div className="mt-2">We sent the verification link to <span className="font-semibold">{pendingEmail}</span>.</div>
                {verificationExpiresAt ? (
                  <div className="mt-2 text-xs text-stone-500">Current link expires {new Date(verificationExpiresAt).toLocaleString()}</div>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-3">
                  <Button type="button" variant="secondary" onClick={resendVerificationEmail} disabled={resendLoading}>
                    {resendLoading ? 'Resending...' : 'Resend verification email'}
                  </Button>
                  <Button type="button" variant="ghost" onClick={() => router.push('/login')}>
                    Go to sign in
                  </Button>
                </div>
                {resendMessage ? <div className="mt-3 text-sm text-emerald-700">{resendMessage}</div> : null}
              </div>
            ) : null}
            <Button type="submit" className="w-full" disabled={loading}>{loading ? 'Creating account...' : 'Create account'}</Button>
          </form>
          <p className="mt-6 text-center text-sm text-stone-600">Already verified? <button type="button" onClick={() => router.push('/login')} className="font-semibold text-emerald-600 hover:text-emerald-700">Go to sign in</button></p>
        </div>
      </div>
    </main>
  );
}
