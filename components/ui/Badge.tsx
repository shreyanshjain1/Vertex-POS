export default function Badge({ children, tone = 'stone' }: { children: React.ReactNode; tone?: 'stone' | 'emerald' | 'amber' | 'red' | 'blue' }) {
  const classes = {
    stone: 'bg-stone-100 text-stone-700',
    emerald: 'bg-emerald-100 text-emerald-700',
    amber: 'bg-amber-100 text-amber-700',
    red: 'bg-red-100 text-red-700',
    blue: 'bg-blue-100 text-blue-700'
  } as const;
  return <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${classes[tone]}`}>{children}</span>;
}
