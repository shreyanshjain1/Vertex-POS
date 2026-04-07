'use client';

export default function CustomerStatementPrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="inline-flex h-11 items-center justify-center rounded-2xl border border-emerald-700/90 bg-[linear-gradient(180deg,#059669,#047857)] px-4 text-sm font-semibold text-white shadow-[0_18px_30px_-20px_rgba(5,150,105,0.9)] transition duration-200 hover:-translate-y-0.5 hover:shadow-[0_22px_36px_-20px_rgba(5,150,105,0.85)]"
    >
      Print statement
    </button>
  );
}
