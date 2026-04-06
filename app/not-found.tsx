import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_26%),linear-gradient(180deg,_#f7faf8_0%,_#eef2ec_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[78vh] max-w-3xl items-center justify-center">
        <Card className="w-full overflow-hidden border border-sky-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(240,249,255,0.94))] p-0">
          <div className="border-b border-sky-100 bg-[radial-gradient(circle_at_top_left,rgba(14,165,233,0.14),transparent_42%),linear-gradient(180deg,rgba(240,249,255,0.98),rgba(255,255,255,0.95))] px-6 py-7 sm:px-8">
            <div className="inline-flex items-center rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-sky-700">
              404 page not found
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-stone-950 sm:text-4xl">That page does not exist.</h1>
            <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-600 sm:text-base">
              The link may be outdated, the page may have been moved, or the address might be incorrect.
            </p>
          </div>
          <div className="grid gap-3 px-6 py-6 sm:grid-cols-2 sm:px-8 sm:py-7">
            <Link href="/" className="block">
              <Button type="button" className="w-full">
                Go to home
              </Button>
            </Link>
            <Link href="/dashboard" className="block">
              <Button type="button" variant="secondary" className="w-full">
                Open dashboard
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
