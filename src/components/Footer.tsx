import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="mt-auto flex w-full shrink-0 flex-col items-center justify-between gap-3 border-t border-slate-200 bg-white px-4 py-4 text-center sm:flex-row sm:px-8 sm:text-left">
      <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] leading-5 text-slate-500 sm:justify-start">
        <span>© {new Date().getFullYear()} American Credit Union Financing</span>
        <span aria-hidden="true" className="hidden text-slate-300 sm:inline">|</span>
        <a href="#privacy" className="transition-colors hover:text-slate-700 hover:underline">Privacy &amp; Security</a>
        <span aria-hidden="true" className="hidden text-slate-300 sm:inline">|</span>
        <span>Secure digital banking portal. FDIC insured up to applicable limits.</span>
      </div>

      <div className="flex shrink-0 items-center gap-2" aria-label="Active session">
        <span aria-hidden="true" className="h-2 w-2 rounded-full bg-emerald-500" />
        <span className="text-[10px] font-semibold uppercase tracking-widest text-slate-500">
          Active session
        </span>
      </div>
    </footer>
  );
};
