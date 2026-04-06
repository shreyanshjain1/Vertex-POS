'use client';

import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

type Props = {
  title?: string;
  message?: string;
  resetLabel?: string;
  onReset?: (() => void) | null;
  homeHref?: string;
  homeLabel?: string;
};

export default function ErrorState({
  title = 'Something went wrong',
  message = 'The page hit an unexpected problem. Please try again or head back to a safe page.',
  resetLabel = 'Try again',
  onReset,
  homeHref = '/dashboard',
  homeLabel = 'Go to dashboard'
}: Props) {
  return (
    <main className="flex min-h-[60vh] items-center justify-center px-6 py-12">
      <Card className="w-full max-w-2xl border border-red-100/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(254,242,242,0.94))]">
        <div className="inline-flex rounded-full border border-red-200 bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-red-700">
          Vertex POS error state
        </div>
        <h1 className="mt-5 text-3xl font-black tracking-tight text-stone-900">{title}</h1>
        <p className="mt-3 max-w-xl text-sm leading-7 text-stone-600">{message}</p>
        <div className="mt-8 flex flex-wrap gap-3">
          {onReset ? <Button onClick={onReset}>{resetLabel}</Button> : null}
          <Link href={homeHref}>
            <Button variant="secondary">{homeLabel}</Button>
          </Link>
          <Link href="/login">
            <Button variant="ghost">Back to sign in</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
