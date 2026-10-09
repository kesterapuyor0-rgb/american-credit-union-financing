import React from 'react';

interface BrandLogoProps {
  className?: string;
  variant?: 'dark' | 'white';
}

export const BrandLogo: React.FC<BrandLogoProps> = ({
  className = 'h-10',
  variant = 'dark',
}) => {
  const isWhite = variant === 'white';
  const textColor = isWhite ? '#FFFFFF' : '#173B70';

  return (
    <div className={`flex min-w-0 items-center gap-2 select-none sm:gap-3 ${className}`}>
      <img
        src="/img/acu%20logo.jpeg"
        alt=""
        aria-hidden="true"
        className="h-10 w-10 shrink-0 rounded-lg border border-white/20 bg-white object-contain shadow-sm"
      />

      <span
        style={{ color: textColor }}
        className="min-w-0 max-w-[min(16rem,calc(100vw-5rem))] text-xs font-bold leading-[1.15] tracking-tight font-serif sm:max-w-none sm:text-lg md:text-xl"
      >
        American Credit Union Financing
      </span>
    </div>
  );
};
