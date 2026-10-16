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
  onResolveRestriction: (restrictionType: RestrictionType) => void;
  onContactSupport: () => void;
}

export const RestrictedAccountNotice: React.FC<RestrictedAccountNoticeProps> = ({
  reason,
  kycStatus,
  rejectionReason,
  isRestricted = false,
  restrictionType = 'NONE',
  showVerified = false,
  onResolveRestriction,
  onContactSupport,
}) => {
  const status = (kycStatus || '').toUpperCase();
  const pending = status === 'PENDING_REVIEW' || status === 'PENDING';
  const rejected = status === 'REJECTED';
  const approved = status === 'APPROVED' && !isRestricted && showVerified;
  const activeRestriction = restrictionType !== 'NONE' ? restrictionType : isRestricted ? 'KYC' : 'NONE';
  if (!pending && !rejected && !approved && activeRestriction === 'NONE') return null;
  const restrictionContent = {
    KYC: {
      title: 'ACCOUNT RESTRICTED - Identity Verification Needed',
      message: 'Upload a valid government-issued ID and proof of address to restore full account access.',
      action: 'Upload ID Documents',
    },
    SECURITY: {
      title: 'SECURITY HOLD - Suspicious Activity Detected',
      message: 'Review your recent transactions and confirm the activity before outgoing transfers and card actions are restored.',
      action: 'Verify Activity',
    },
    SOURCE_OF_FUNDS: {
      title: 'COMPLIANCE REVIEW - Documentation Required',
      message: 'Provide proof of income or an invoice to verify the origin of the incoming transfer.',
      action: 'Provide Documentation',
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
      ? 'Verification Declined - Action Required'
      : approved
        ? 'Identity Successfully Verified'
        : restrictionContent.title;
  const description = pending
    ? 'Our compliance team is reviewing your submission (1–2 business days).'
    : rejected
      ? `We were unable to approve your submission.${rejectionReason ? ` ${rejectionReason}` : reason ? ` ${reason}` : ''}`
      : approved
        ? 'Your account restrictions have been cleared and full account access is restored.'
        : `${restrictionContent.message}${reason ? ` ${reason}` : ''}`;
  const actionLabel = rejected
    ? activeRestriction === 'SECURITY' ? 'Verify Activity Again' : 'Re-upload Requirements'
    : restrictionContent.action;
  const resolutionSteps = {
    KYC: [
      'Go to Profile & Settings -> Identity Verification.',
      'Upload a valid government-issued ID and proof of address.',
    ],
    SECURITY: [
      'Review recent account transactions for activity you recognize.',
      'Confirm the activity to send the account for compliance review.',
    ],
    SOURCE_OF_FUNDS: [
      'Locate the incoming transfer under review.',
      'Upload proof of income or an invoice showing the transfer origin.',
    ],
    NONE: [],
  }[activeRestriction];

  return (
    <section role={approved ? 'status' : 'alert'} className={`w-full min-w-0 rounded-xl border p-3.5 shadow-sm sm:p-5 ${tone}`}>
      <div className="flex min-w-0 items-start gap-3">
        {pending
          ? <Clock3 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-blue-700" />
          : approved
            ? <CheckCircle2 aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-emerald-700" />
            : <ShieldAlert aria-hidden="true" className={`mt-0.5 h-5 w-5 shrink-0 ${rejected ? 'text-rose-700' : 'text-amber-700'}`} />}
        <div className="w-full min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-sm font-bold">{title}</h2>
            {pending && <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-blue-800">Pending Review</span>}
          </div>
          <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-5 [overflow-wrap:anywhere]">{description}</p>
          {!pending && !rejected && !approved && (
            <>
              <h3 className="mt-3 text-sm font-semibold">How to restore full access</h3>
              <ol className="mt-1 list-decimal space-y-1 pl-5 text-sm leading-5 [overflow-wrap:anywhere]">
                {resolutionSteps.map((step) => <li key={step}>{step}</li>)}
              </ol>
              <p className="mt-2 text-xs leading-5 [overflow-wrap:anywhere]">
                Your account balance and transaction history remain visible while the review is active. Full access is restored after approval.
              </p>
            </>
          )}
          <div className="mt-3 flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap">
            {!approved && (pending ? (
              <button type="button" disabled className="inline-flex min-h-11 w-full cursor-not-allowed items-center justify-center rounded-lg bg-slate-200 px-4 py-2 text-center text-sm font-semibold text-slate-600 sm:w-auto">
                Pending Review
              </button>
            ) : (
              <button
                type="button"
                onClick={() => onResolveRestriction(activeRestriction)}
                className={`inline-flex min-h-11 w-full items-center justify-center whitespace-normal break-words rounded-lg px-4 py-2 text-center text-sm font-semibold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 sm:w-auto ${rejected ? 'bg-rose-700 hover:bg-rose-800 focus-visible:ring-rose-700' : 'bg-teal-800 hover:bg-teal-900 focus-visible:ring-teal-700'}`}
              >
                {actionLabel}
              </button>
            ))}
            <button
              type="button"
              onClick={onContactSupport}
              className="inline-flex min-h-11 w-full items-center justify-center whitespace-normal break-words rounded-lg border border-current bg-white/80 px-4 py-2 text-center text-sm font-semibold hover:bg-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-current focus-visible:ring-offset-2 sm:w-auto"
            >
              Contact Support
            </button>
          </div>
        </div>
      </div>
    </section>
  );
};
