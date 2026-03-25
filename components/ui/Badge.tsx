export default function Badge({ children, tone = 'stone' }: { children: React.ReactNode; tone?: 'stone' | 'emerald' | 'amber' | 'red' | 'blue' }) {
  const classes = {
    stone: 'border border-stone-200 bg-stone-100/90 text-stone-700',
    emerald: 'border border-emerald-200 bg-emerald-100/90 text-emerald-700',
    amber: 'border border-amber-200 bg-amber-100/90 text-amber-700',
    red: 'border border-red-200 bg-red-100/90 text-red-700',
    blue: 'border border-sky-200 bg-sky-100/90 text-sky-700'
  } as const;

  return (
    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] ${classes[tone]}`}>
      {children}
    </span>
  );
}
