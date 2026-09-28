import React, { useEffect, useState } from 'react';
import { ShieldAlert, ArrowLeft, Lock } from 'lucide-react';

interface Forbidden403ViewProps {
  onRedirectToDashboard: () => void;
}

export const Forbidden403View: React.FC<Forbidden403ViewProps> = ({ onRedirectToDashboard }) => {
  const [countdown, setCountdown] = useState(6);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onRedirectToDashboard();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [onRedirectToDashboard]);

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-white border border-gray-300 rounded-xs shadow-lg overflow-hidden text-center">
        <div className="h-1.5 bg-[#C9932E]" />

        <div className="p-8">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4 text-[#C9932E]">
            <ShieldAlert className="w-9 h-9" />
          </div>

          <div className="text-xs font-bold text-[#C9932E] uppercase tracking-wider mb-1">
            HTTP 403 Forbidden Access
          </div>

          <h1 className="text-2xl font-bold text-[#0F766E] font-serif mb-2">
            Administrator Authorization Required
          </h1>

          <p className="text-xs text-gray-600 leading-relaxed mb-6">
            Access to administrative tools in this prototype is restricted to accounts with administrator permissions. Your request has been denied.
          </p>

          <div className="p-3 bg-gray-50 border border-gray-200 rounded-xs text-xs text-gray-500 mb-6 font-mono">
            Error Code: SEC_403_ADMIN_ISOLATION_ENFORCED
          </div>

          <div className="text-xs text-gray-500 mb-4">
            Redirecting to your personal account dashboard in <strong className="text-[#0F766E]">{countdown}s</strong>...
          </div>

          <button
            id="btn-return-dashboard"
            onClick={onRedirectToDashboard}
            className="w-full py-2.5 px-4 bg-[#0F766E] hover:bg-[#115E59] text-white font-bold text-xs uppercase tracking-wider rounded-xs shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Return to Account Dashboard</span>
          </button>
        </div>
      </div>
    </div>
  );
};
