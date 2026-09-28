import React from 'react';

export const Footer: React.FC = () => {
  return (
    <footer className="w-full bg-white border-t border-gray-200 px-4 sm:px-8 py-3.5 flex flex-col sm:flex-row items-center justify-between shrink-0 gap-2 mt-auto">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-gray-500">
        <span>© {new Date().getFullYear()} American Credit Union Financing</span>
        <span className="hidden sm:inline text-gray-300">|</span>
        <span className="hover:underline cursor-pointer">Privacy & Security</span>
        <span className="hidden sm:inline text-gray-300">|</span>
        <span className="text-gray-500">Secure digital banking portal . FDIC insured up to applicable limits</span>
      </div>

      <div className="flex items-center space-x-2">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
        <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
          Active Session
        </span>
      </div>
    </footer>
  );
};
