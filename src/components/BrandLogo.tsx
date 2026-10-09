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
  const textColor = isWhite ? '#FFFFFF' : '#173B70';
  const subColor = isWhite ? '#D1D5DB' : '#5A6872';

  return (
    <div className={`flex min-w-0 items-center gap-2 select-none sm:gap-3 ${className}`}>
      <img
        src="/img/acu%20logo.jpeg"
        alt=""
        aria-hidden="true"
        className="h-10 w-10 shrink-0 rounded-lg border border-white/20 bg-white object-contain shadow-sm"
      />

      <div className="min-w-0 flex flex-col leading-none">
        <div className="flex items-center gap-1.5">
          <span
            style={{ color: textColor }}
            className="max-w-[125px] break-words font-bold leading-tight tracking-tight text-[11px] font-serif sm:max-w-none sm:text-lg md:text-xl"
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
