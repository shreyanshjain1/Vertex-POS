type PageSkeletonProps = {
  mode?: 'app' | 'auth' | 'public';
};

function PulseBlock({ className }: { className: string }) {
  return <div className={`animate-pulse rounded-3xl bg-white/70 ${className}`} />;
}

export default function PageSkeleton({ mode = 'public' }: PageSkeletonProps) {
  if (mode === 'auth') {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_26%),linear-gradient(180deg,_#f7faf8_0%,_#eef2ec_100%)] px-4 py-10 sm:px-6 lg:px-8">
        <div className="mx-auto flex min-h-[80vh] max-w-6xl items-center justify-center">
          <div className="w-full max-w-md rounded-[34px] border border-white/80 bg-white/55 p-4 shadow-[0_32px_90px_-48px_rgba(28,25,23,0.32)] backdrop-blur-xl">
            <div className="rounded-[28px] border border-white/80 bg-white/75 p-6 sm:p-8">
              <PulseBlock className="h-5 w-24" />
              <PulseBlock className="mt-4 h-10 w-2/3" />
              <PulseBlock className="mt-3 h-4 w-full" />
              <div className="mt-8 space-y-4">
                <PulseBlock className="h-11 w-full" />
                <PulseBlock className="h-11 w-full" />
                <PulseBlock className="h-11 w-full" />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'app') {
    return (
      <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_26%),linear-gradient(180deg,_#f7faf8_0%,_#eef2ec_100%)]">
        <div className="relative lg:flex">
          <aside className="hidden min-h-screen w-[280px] border-r border-white/60 bg-white/35 px-5 py-6 shadow-[inset_-1px_0_0_rgba(255,255,255,0.45)] backdrop-blur-xl lg:block">
            <PulseBlock className="h-10 w-40" />
            <div className="mt-8 space-y-3">
              {Array.from({ length: 8 }).map((_, index) => (
                <PulseBlock key={index} className="h-12 w-full" />
              ))}
            </div>
          </aside>
          <main className="min-h-screen flex-1 px-4 py-4 sm:px-6 lg:px-8 lg:py-6">
            <div className="mx-auto max-w-[1500px]">
              <div className="mb-4 flex justify-end">
                <PulseBlock className="h-11 w-11 rounded-full" />
              </div>
              <div className="rounded-[34px] border border-white/70 bg-white/28 p-2 shadow-[0_28px_70px_-48px_rgba(28,25,23,0.28)] backdrop-blur-[2px] sm:p-3">
                <div className="rounded-[30px] bg-white/20 p-4 sm:p-6">
                  <div className="grid gap-4 lg:grid-cols-3">
                    <PulseBlock className="h-36 w-full lg:col-span-2" />
                    <PulseBlock className="h-36 w-full" />
                  </div>
                  <div className="mt-4 grid gap-4 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, index) => (
                      <PulseBlock key={index} className="h-28 w-full" />
                    ))}
                  </div>
                  <PulseBlock className="mt-4 h-[360px] w-full" />
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(16,185,129,0.18),_transparent_32%),radial-gradient(circle_at_bottom_right,_rgba(14,165,233,0.16),_transparent_26%),linear-gradient(180deg,_#f7faf8_0%,_#eef2ec_100%)] px-4 py-10 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[70vh] max-w-5xl items-center justify-center">
        <div className="w-full space-y-4 rounded-[34px] border border-white/75 bg-white/45 p-5 shadow-[0_30px_80px_-50px_rgba(28,25,23,0.32)] backdrop-blur-xl sm:p-6">
          <PulseBlock className="h-12 w-48" />
          <PulseBlock className="h-5 w-2/3" />
          <PulseBlock className="h-72 w-full" />
        </div>
      </div>
    </div>
  );
}
