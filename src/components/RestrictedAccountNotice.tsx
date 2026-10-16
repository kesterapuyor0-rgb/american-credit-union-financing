import React from 'react';
import { ShieldAlert } from 'lucide-react';

interface RestrictedAccountNoticeProps {
  reason?: string;
  onVerifyIdentity: () => void;
  onContactSupport: () => void;
}

export const RestrictedAccountNotice: React.FC<RestrictedAccountNoticeProps> = ({
  reason,
  onVerifyIdentity,
  onContactSupport,
}) => (
  <section role="alert" className="w-full min-w-0 rounded-xl border border-amber-300 bg-amber-50 p-3.5 text-amber-950 shadow-sm sm:p-5">
    <div className="flex min-w-0 items-start gap-3">
      <ShieldAlert aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
      <div className="w-full min-w-0 flex-1">
        <h2 className="text-sm font-bold uppercase tracking-wide text-amber-900">Account restricted</h2>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 [overflow-wrap:anywhere]">{reason || 'Your account is currently restricted.'}</p>
        <h3 className="mt-3 text-sm font-semibold">How to restore full access</h3>
        <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-5 [overflow-wrap:anywhere]">
          <li>Go to Profile &amp; Settings -&gt; Identity Verification.</li>
          <li>Upload a valid government-issued ID and proof of address.</li>
        </ol>
        <p className="mt-2 text-xs leading-5 text-amber-900 [overflow-wrap:anywhere]">
          Member Services will review your documents. Your account balance remains visible; full access is restored after your identity review is approved.
        </p>
        <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            onClick={onVerifyIdentity}
            className="inline-flex min-h-11 w-full items-center justify-center whitespace-normal break-words rounded-lg bg-teal-800 px-4 py-2 text-center text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2 sm:w-auto"
          >
            Verify Identity
          </button>
          <button
            type="button"
            onClick={onContactSupport}
            className="inline-flex min-h-11 w-full items-center justify-center whitespace-normal break-words rounded-lg border border-amber-400 bg-white px-4 py-2 text-center text-sm font-semibold text-amber-950 hover:bg-amber-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-700 focus-visible:ring-offset-2 sm:w-auto"
          >
            Contact Support
          </button>
        </div>
      </div>
    </div>
  </section>
);
