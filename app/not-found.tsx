import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center px-6 py-12">
      <Card className="w-full max-w-2xl text-center">
        <div className="mx-auto inline-flex rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
          404 page not found
        </div>
        <h1 className="mt-5 text-4xl font-black tracking-tight text-stone-900">That page does not exist.</h1>
        <p className="mt-4 text-sm leading-7 text-stone-600">
          The link may be outdated, the page may have moved, or the route was entered incorrectly.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link href="/dashboard">
            <Button>Go to dashboard</Button>
          </Link>
          <Link href="/login">
            <Button variant="secondary">Sign in</Button>
          </Link>
        </div>
      </Card>
    </main>
  );
}
