import React from 'react';

export default function Input(props: React.InputHTMLAttributes<HTMLInputElement> & { className?: string }) {
  return (
    <input
      {...props}
      className={`h-11 w-full rounded-2xl border border-stone-200 bg-white/88 px-4 text-sm text-stone-900 shadow-[inset_0_1px_0_rgba(255,255,255,0.75)] outline-none transition placeholder:text-stone-400 hover:border-stone-300 focus:border-emerald-500 focus:bg-white focus:ring-4 focus:ring-emerald-500/10 ${props.className ?? ''}`}
    />
  );
}
