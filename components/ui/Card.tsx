export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[28px] border border-white/80 bg-white/90 p-6 shadow-[0_24px_80px_-36px_rgba(28,25,23,0.28)] backdrop-blur-sm ${className}`}
    >
      {children}
    </div>
  );
}
