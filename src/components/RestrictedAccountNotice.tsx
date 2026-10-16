import React from 'react';
import { CheckCircle2, Clock3, ShieldAlert } from 'lucide-react';
import { RestrictionType } from '../types';

interface RestrictedAccountNoticeProps {
  reason?: string;
  kycStatus?: string;
  rejectionReason?: string;
  isRestricted?: boolean;
  restrictionType?: RestrictionType;
  showVerified?: boolean;
  accountLastFour?: string;
  onResolveRestriction: (restrictionType: RestrictionType) => void;
  onContactSupport: () => void;
}

export const RestrictedAccountNotice: React.FC<RestrictedAccountNoticeProps> = ({
  reason,
  kycStatus,
  rejectionReason,
  isRestricted = false,
  restrictionType,
  showVerified = false,
  accountLastFour,
  onResolveRestriction,
  onContactSupport,
}) => {
  const status = (kycStatus || '').toUpperCase();
  const pending = status === 'PENDING_REVIEW' || status === 'PENDING';
  const rejected = status === 'REJECTED';
  const approved = status === 'APPROVED' && !isRestricted && showVerified;
  const activeRestriction = restrictionType ?? (isRestricted ? 'KYC' : 'NONE');
  if (activeRestriction === 'NONE') return null;
  const restrictionContent = {
    KYC: {
      title: 'Action Required: Please Update Your Account Information',
      message: `Temporary restrictions are active on outgoing transactions for account ending in ••••${accountLastFour || '—'} due to ${reason || 'an expired ID on file'}.`,
      action: rejected ? 'Re-upload Required Documents' : 'Upload ID Documents',
    },
    SECURITY: {
      title: 'Security Notice: Temporary Account Hold',
      message: 'Review your recent transactions and confirm the activity before outgoing transfers and card actions are restored.',
      action: rejected ? 'Verify Activity Again' : 'Verify Activity',
    },
    SOURCE_OF_FUNDS: {
      title: 'Compliance Notice: Documentation Required for Incoming Transfers',
      message: 'Provide proof of income or an invoice to verify the origin of the incoming transfer.',
      action: rejected ? 'Re-upload Required Documents' : 'Provide Documentation',
    },
    NONE: { title: '', message: '', action: '' },
  }[activeRestriction];
  const tone = pending
    ? 'border-blue-200 bg-blue-50 text-blue-950'
    : rejected
      ? 'border-rose-300 bg-rose-50 text-rose-950'
      : approved
        ? 'border-emerald-200 bg-emerald-50 text-emerald-950'
        : 'border-amber-300 bg-amber-50 text-amber-950';
  const title = pending
    ? 'Verification Under Review'
    : rejected
      ? 'Verification Declined — Action Required'
      : approved
        ? 'Identity Successfully Verified'
        : restrictionContent.title;
  const description = pending
    ? 'Your documents are under review. Reviews typically take 1–2 business days.'
    : rejected
      ? 'We were unable to approve your identity verification request with the submitted ID document.'
      : approved
        ? 'Your account restrictions have been cleared and full account access is restored.'
        : restrictionContent.message;

  return (
    <section role={approved ? 'status' : 'alert'} className={`w-full min-w-0 rounded-xl border px-3 py-3 shadow-sm sm:px-4 sm:py-4 ${tone}`}>
      <div className="flex min-w-0 items-start gap-2.5">
        {pending
          ? <Clock3 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-blue-700" />
          : approved
            ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-emerald-700" />
            : <ShieldAlert aria-hidden="true" className={`mt-0.5 h-4 w-4 shrink-0 ${rejected ? 'text-rose-700' : 'text-amber-700'}`} />}
        <div className="w-full min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <h2 className="text-sm font-bold leading-5">{title}</h2>
            {pending && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800">Pending Review</span>}
          </div>
          <p className="mt-0.5 whitespace-pre-wrap break-words text-xs leading-4 [overflow-wrap:anywhere] sm:text-sm">{description}</p>
          {rejected && (
            <>
              <p className="mt-2 break-words text-xs leading-5 [overflow-wrap:anywhere] sm:text-sm">
                <span className="font-semibold">Reason:</span> {rejectionReason || reason || 'Please contact support for details.'}
              </p>
              <div className="mt-2">
                <h3 className="text-xs font-semibold leading-5 sm:text-sm">Guidelines for re-upload</h3>
                <ul className="mt-1 list-disc space-y-1 pl-5 text-xs leading-5 [overflow-wrap:anywhere] sm:text-sm">
                  <li>Ensure all four corners of the ID card are visible.</li>
                  <li>Make sure all text, photos, and expiration dates are clearly legible without flash glare.</li>
                  <li>Ensure the document is unexpired and matches your registered account details.</li>
                </ul>
              </div>
            </>
          )}
          <div className="mt-2 flex w-full flex-col gap-1.5 min-[360px]:flex-row min-[360px]:flex-wrap">
            {!approved && (pending ? (
              <button type="button" disabled className="inline-flex min-h-9 w-full cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-3 py-1.5 text-center text-xs font-semibold text-slate-600 min-[360px]:w-auto">
                Pending Review
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onResolveRestriction(activeRestriction)}
                className={`inline-flex min-h-9 w-full items-center justify-center whitespace-normal break-words rounded-lg px-3 py-1.5 text-center text-xs font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 min-[360px]:w-auto ${rejected ? 'bg-rose-700 hover:bg-rose-800 focus-visible:ring-rose-700' : 'bg-teal-800 hover:bg-teal-900 focus-visible:ring-teal-700'}`}
              >
                {restrictionContent.action}
              </button>
            ))}
            <button
              type="button"
              onClick={onContactSupport}
              className="inline-flex min-h-9 w-full items-center justify-center whitespace-normal break-words rounded-lg border border-current bg-white/80 px-3 py-1.5 text-center text-xs font-semibold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 min-[360px]:w-auto"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
