export default function Badge({ children, tone = 'stone' }: { children: React.ReactNode; tone?: 'stone' | 'emerald' | 'amber' | 'red' | 'blue' }) {
  const classes = {
    stone: 'bg-stone-100/90 text-stone-700 ring-1 ring-stone-200/80',
    emerald: 'bg-emerald-100/90 text-emerald-700 ring-1 ring-emerald-200/80',
    amber: 'bg-amber-100/90 text-amber-700 ring-1 ring-amber-200/80',
    red: 'bg-red-100/90 text-red-700 ring-1 ring-red-200/80',
    blue: 'bg-blue-100/90 text-blue-700 ring-1 ring-blue-200/80'
  } as const;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}
