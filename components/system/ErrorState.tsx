import Link from 'next/link';
import Button from '@/components/ui/Button';
import Card from '@/components/ui/Card';

type ErrorStateProps = {
  title?: string;
  message?: string;
  onRetry?: () => void;
  retryLabel?: string;
  homeHref?: string;
  homeLabel?: string;
  details?: string | null;
};

export default function ErrorState({
  title = 'Something went wrong',
  message = 'The page could not be loaded right now. Please try again.',
  onRetry,
  retryLabel = 'Try again',
  homeHref = '/',
  homeLabel = 'Back to home',
  details
}: ErrorStateProps) {
  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-2xl">
        <Card className="overflow-hidden border border-red-100 bg-[linear-gradient(180deg,rgba(255,255,255,0.98),rgba(255,247,247,0.96))] p-0">
          <div className="border-b border-red-100 bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.12),transparent_45%),linear-gradient(180deg,rgba(254,242,242,0.96),rgba(255,255,255,0.92))] px-6 py-6 sm:px-8">
            <div className="inline-flex items-center rounded-full border border-red-200 bg-red-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.18em] text-red-700">
              App error
            </div>
            <h1 className="mt-4 text-2xl font-semibold tracking-tight text-stone-950 sm:text-3xl">{title}</h1>
            <p className="mt-3 max-w-xl text-sm leading-6 text-stone-600 sm:text-base">{message}</p>
          </div>

          <div className="space-y-5 px-6 py-6 sm:px-8 sm:py-7">
            <div className="grid gap-3 sm:grid-cols-2">
              {onRetry ? (
                <Button type="button" onClick={onRetry} className="w-full">
                  {retryLabel}
                </Button>
              ) : null}
              <Link href={homeHref} className={onRetry ? '' : 'sm:col-span-2'}>
                <Button type="button" variant="secondary" className="w-full">
                  {homeLabel}
                </Button>
              </Link>
            </div>

            {details ? (
              <div className="rounded-3xl border border-stone-200 bg-stone-950 px-4 py-4 text-xs leading-6 text-stone-200 shadow-[inset_0_1px_0_rgba(255,255,255,0.05)]">
                <div className="mb-2 font-semibold uppercase tracking-[0.18em] text-stone-400">Debug details</div>
                <pre className="overflow-x-auto whitespace-pre-wrap break-words font-mono">{details}</pre>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
    </div>
  );
}
