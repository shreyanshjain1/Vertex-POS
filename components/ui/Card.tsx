export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-3xl border border-stone-200 bg-white p-6 shadow-sm ${className}`}>{children}</div>;
}
