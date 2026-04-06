import Card from '@/components/ui/Card';

type Props = {
  title?: string;
  subtitle?: string;
  rows?: number;
};

export default function PageSkeleton({
  title = 'Loading workspace',
  subtitle = 'Preparing your latest store data and controls.',
  rows = 4
}: Props) {
  return (
    <main className="mx-auto w-full max-w-7xl px-6 py-8">
      <div className="animate-pulse">
        <div className="h-3 w-28 rounded-full bg-emerald-100" />
        <div className="mt-4 h-10 w-72 rounded-2xl bg-stone-200" />
        <div className="mt-3 h-5 w-[34rem] max-w-full rounded-xl bg-stone-200" />
        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <Card key={index} className="space-y-4">
              <div className="h-4 w-28 rounded-xl bg-stone-200" />
              <div className="h-9 w-24 rounded-2xl bg-stone-200" />
              <div className="h-4 w-full rounded-xl bg-stone-100" />
            </Card>
          ))}
        </div>
        <Card className="mt-6">
          <div className="h-6 w-56 rounded-xl bg-stone-200" />
          <div className="mt-3 h-4 w-80 max-w-full rounded-xl bg-stone-100" />
          <div className="mt-6 space-y-3">
            {Array.from({ length: rows }).map((_, index) => (
              <div key={index} className="flex items-center gap-3">
                <div className="h-11 w-11 rounded-2xl bg-stone-200" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-1/3 rounded-xl bg-stone-200" />
                  <div className="h-4 w-2/3 rounded-xl bg-stone-100" />
                </div>
              </div>
            ))}
          </div>
        </Card>
        <p className="mt-5 text-sm text-stone-500">{title} · {subtitle}</p>
      </div>
    </main>
  );
}
