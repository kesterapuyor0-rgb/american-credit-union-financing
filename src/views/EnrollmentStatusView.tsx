import React, { useState } from 'react';
import { AlertCircle, Clock3, LogOut } from 'lucide-react';
import { User } from '../types';
import { SUPPORT_EMAIL } from '../utils/supportEmail';

interface EnrollmentStatusViewProps {
  user: User;
  onSignOut: () => void;
  onGoToDashboard: () => void;
}

export const EnrollmentStatusView: React.FC<EnrollmentStatusViewProps> = ({ user, onSignOut, onGoToDashboard }) => {
  const isRejected = user.verification_status === 'rejected';
  const [showLimitedDashboard, setShowLimitedDashboard] = useState(false);

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F3F4F6] p-4">
      <section className="w-full max-w-lg rounded-sm border border-gray-200 bg-white p-6 text-center shadow-xl sm:p-8">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isRejected ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
          {isRejected ? <AlertCircle className="h-8 w-8" /> : <Clock3 className="h-8 w-8" />}
        </div>
        <h1 className="mt-5 font-serif text-2xl font-bold text-[#173B70]">
          {isRejected
            ? 'Enrollment Not Approved'
            : showLimitedDashboard
              ? 'Member Dashboard · Limited Access'
              : "We're Verifying Your Information"}
        </h1>
        {!isRejected && (
          <p className="mt-2 inline-flex items-center gap-2 rounded-full bg-amber-50 px-3 py-1.5 text-xs font-bold uppercase tracking-wide text-amber-800">
            <Clock3 aria-hidden="true" className="h-4 w-4" />
            Account Under Review
          </p>
        )}
        <p className="mt-3 text-sm leading-6 text-gray-700">
          {isRejected
            ? user.verification_rejection_reason || 'Your enrollment was not approved. Contact customer support for assistance.'
            : showLimitedDashboard
              ? 'Your member profile, identity documents, and verification selfie have been securely submitted. This limited dashboard remains available while Member Services reviews your details to activate full access.'
              : 'Your member profile, identity documents, and verification selfie have been securely submitted. Our Member Services team is reviewing your details to activate full access.'}
        </p>
        {!isRejected && (
          <div className="mt-5 rounded-sm border border-blue-200 bg-blue-50 p-4 text-left text-sm leading-6 text-blue-950">
            Standard review time: 1–2 business days. You will receive an update once verified.
          </div>
        )}
        {isRejected && <div className="mt-5 rounded-sm border border-blue-200 bg-blue-50 p-4 text-left text-sm leading-6 text-blue-950">
          To complete your registration or get help, contact customer support at{' '}
          <a
            href={`mailto:${SUPPORT_EMAIL}`}
            className="break-all font-semibold underline underline-offset-2"
          >
            {SUPPORT_EMAIL}
          </a>
          .
        </div>}
        <p className="mt-4 text-xs text-gray-500">Signed in as {user.email}</p>
        <div className="mt-6 flex flex-col justify-center gap-3 sm:flex-row">
          {!isRejected && (
            <button
              type="button"
              onClick={() => {
                if (showLimitedDashboard) {
                  setShowLimitedDashboard(false);
                } else {
                  onGoToDashboard();
                  setShowLimitedDashboard(true);
                }
              }}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-[#173B70] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#245B9E]"
            >
              {showLimitedDashboard ? 'Back to Review Status' : 'Go to Member Dashboard'}
            </button>
          )}
          <button
            type="button"
            onClick={onSignOut}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-sm border border-gray-300 bg-white px-5 py-3 text-xs font-bold uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-50"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </section>
    </main>
  );
};
