import React from 'react';
import { AlertCircle, Clock3, LogOut } from 'lucide-react';
import { User } from '../types';

interface EnrollmentStatusViewProps {
  user: User;
  onSignOut: () => void;
}

export const EnrollmentStatusView: React.FC<EnrollmentStatusViewProps> = ({ user, onSignOut }) => {
  const isRejected = user.verification_status === 'rejected';

  return (
    <main className="flex min-h-[100dvh] items-center justify-center bg-[#F3F4F6] p-4">
      <section className="w-full max-w-lg rounded-sm border border-gray-200 bg-white p-6 text-center shadow-xl sm:p-8">
        <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-full ${isRejected ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'}`}>
          {isRejected ? <AlertCircle className="h-8 w-8" /> : <Clock3 className="h-8 w-8" />}
        </div>
        <h1 className="mt-5 font-serif text-2xl font-bold text-[#173B70]">
          {isRejected ? 'Enrollment Not Approved' : 'Account Under Review'}
        </h1>
        <p className="mt-3 text-sm leading-6 text-gray-700">
          {isRejected
            ? user.verification_rejection_reason || 'Your enrollment was not approved. Contact customer support for assistance.'
            : 'Account Under Review - This will take 3-5 business days to approve.'}
        </p>
        {!isRejected && (
          <p className="mt-4 text-sm leading-6 text-gray-700">
            Your enrollment is being reviewed. You will have access to your banking dashboard once it is approved.
          </p>
        )}
        <div className="mt-5 rounded-sm border border-blue-200 bg-blue-50 p-4 text-left text-sm leading-6 text-blue-950">
          To complete your registration or get help, contact customer support at{' '}
          <a
            href="mailto:americancreditunion.financing@gmail.com"
            className="break-all font-semibold underline underline-offset-2"
          >
            americancreditunion.financing@gmail.com
          </a>
          .
        </div>
        <p className="mt-4 text-xs text-gray-500">Signed in as {user.email}</p>
        <button
          type="button"
          onClick={onSignOut}
          className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-sm bg-[#173B70] px-5 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#245B9E]"
        >
          <LogOut className="h-4 w-4" />
          Sign Out
        </button>
      </section>
    </main>
  );
};
