import React from 'react';

interface BrandLogoProps {
  className?: string;
  variant?: 'dark' | 'white';
  showSubtitle?: boolean;
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'h-10',
  variant = 'dark',
  showSubtitle = false,
}) => {
  const isWhite = variant === 'white';
  const textColor = isWhite ? '#FFFFFF' : '#0F766E';
  const subColor = isWhite ? '#D1D5DB' : '#5A6872';

  return (
    <div className={`flex min-w-0 items-center gap-2 select-none sm:gap-3 ${className}`}>
      <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/20 bg-white shadow-sm">
        <div className="grid h-7 w-7 place-items-center rounded-lg bg-[#0F766E]">
          <div className="h-3 w-3 rounded-full bg-[#D6A84F]" />
        </div>
      </div>

      <div className="min-w-0 flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span
            style={{ color: textColor }}
            className="max-w-[116px] truncate font-bold tracking-tight text-sm font-serif sm:max-w-[230px] sm:text-lg md:text-xl"
          >
            American Credit Union Financing
          </span>
        </div>
        {showSubtitle && (
          <span
            style={{ color: subColor }}
            className="mt-0.5 text-[9px] tracking-wider uppercase font-sans font-semibold sm:text-[10px]"
          >
            Account Portal
          </span>
        )}
      </div>
    </div>
  );
};
