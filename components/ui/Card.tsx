export default function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`rounded-[30px] border border-white/80 bg-[linear-gradient(180deg,rgba(255,255,255,0.96),rgba(255,255,255,0.9))] p-6 shadow-[0_24px_70px_-36px_rgba(28,25,23,0.25)] backdrop-blur-sm sm:p-7 ${className}`}
    >
      {children}
    </div>
  );
}
