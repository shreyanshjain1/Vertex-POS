export default function AppHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: React.ReactNode }) {
  return (
    <div className="rounded-[30px] border border-white/80 bg-[linear-gradient(135deg,rgba(255,255,255,0.96),rgba(255,255,255,0.82))] px-5 py-5 shadow-[0_24px_60px_-38px_rgba(28,25,23,0.24)] backdrop-blur-sm sm:px-6 sm:py-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div className="max-w-3xl">
          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-emerald-700">Workspace</div>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-stone-950 sm:text-[2rem]">{title}</h1>
          {subtitle ? <p className="mt-3 max-w-2xl text-sm leading-6 text-stone-500 sm:text-[15px]">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex flex-wrap gap-3 lg:justify-end">{actions}</div> : null}
      </div>
    </div>
  );
}
