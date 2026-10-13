import React, { FormEvent, useState } from 'react';
import { ArrowLeft, CheckCircle2, KeyRound, LockKeyhole, Mail, ShieldCheck } from 'lucide-react';
import { BrandLogo } from '../components/BrandLogo';
import { safeParseResponse } from '../utils/api';

const RecoveryShell: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="flex min-h-[100dvh] flex-col bg-[#F3F4F6] font-sans">
    <header className="flex min-h-[72px] items-center border-b-4 border-[#D6A832] bg-[#173B70] px-4 py-3 text-white shadow-lg sm:px-8">
      <div className="mx-auto w-full max-w-7xl">
        <BrandLogo variant="white" />
      </div>
    </header>
    <main className="flex flex-1 items-center justify-center p-4 sm:p-6">
      <section className="w-full max-w-md overflow-hidden rounded-sm border border-gray-200 bg-white shadow-xl">
        <div className="h-1.5 bg-[#D6A832]" />
        <div className="p-6 sm:p-8">{children}</div>
      </section>
    </main>
  </div>
);

interface RecoveryFormProps {
  onBackToLogin: () => void;
}

export const ForgotPasswordView: React.FC<RecoveryFormProps> = ({ onBackToLogin }) => {
  const [email, setEmail] = useState(() => new URLSearchParams(window.location.search).get('email') || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    try {
      const response = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });
      const result = await safeParseResponse(response);
      if (!result.ok) throw new Error(result.error || 'Unable to request a passcode reset.');
      setSubmitted(true);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to request a passcode reset.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RecoveryShell>
      <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D6A832]">
        <ShieldCheck className="h-4 w-4" />
        Account security
      </div>
      <h1 className="font-serif text-2xl font-bold tracking-tight text-[#173B70]">Forgot your passcode?</h1>
      {submitted ? (
        <div className="mt-5 rounded-sm border-l-4 border-emerald-600 bg-emerald-50 p-4 text-sm leading-relaxed text-emerald-900" role="status">
          <p className="flex items-center gap-2 font-semibold">
            <CheckCircle2 className="h-5 w-5 shrink-0" />
            Check your email inbox
          </p>
          <p className="mt-2">If an account with that email exists, a password reset link has been sent. The link expires in 20 minutes.</p>
        </div>
      ) : (
        <>
          <p className="mt-2 text-sm leading-relaxed text-gray-600">
            Enter the email address associated with your account. If it is registered, we’ll email you a secure reset link.
          </p>
          <form onSubmit={handleSubmit} className="mt-6 space-y-4">
            <div>
              <label htmlFor="forgot-email" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
                Email address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  required
                  maxLength={254}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  className="w-full rounded-sm border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-hidden focus:border-[#173B70] focus:ring-1 focus:ring-[#173B70]"
                  placeholder="you@example.com"
                />
              </div>
            </div>
            {error && <p role="alert" className="rounded-sm border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-[#173B70] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#245B9E] disabled:opacity-60"
            >
              <KeyRound className="h-4 w-4" />
              {loading ? 'Sending…' : 'Send reset link'}
            </button>
          </form>
        </>
      )}
      <button type="button" onClick={onBackToLogin} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#173B70] hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </button>
    </RecoveryShell>
  );
};

interface ResetPasswordViewProps extends RecoveryFormProps {
  onPasswordReset: () => void;
}

export const ResetPasswordView: React.FC<ResetPasswordViewProps> = ({ onBackToLogin, onPasswordReset }) => {
  const params = new URLSearchParams(window.location.search);
  const email = params.get('email') || '';
  const token = params.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    if (newPassword !== confirmPassword) {
      setError('The passcode entries do not match.');
      return;
    }
    if (!email || !token) {
      setError('This reset link is invalid or incomplete. Request a new link and try again.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ email, token, newPassword }),
      });
      const result = await safeParseResponse(response);
      if (!result.ok) throw new Error(result.error || 'Unable to reset your passcode.');
      onPasswordReset();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Unable to reset your passcode.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <RecoveryShell>
      <div className="mb-6 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#D6A832]">
        <ShieldCheck className="h-4 w-4" />
        Secure passcode reset
      </div>
      <h1 className="font-serif text-2xl font-bold tracking-tight text-[#173B70]">Create a new passcode</h1>
      <p className="mt-2 text-sm leading-relaxed text-gray-600">Choose a new passcode to regain access to your account.</p>
      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label htmlFor="new-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
            New passcode
          </label>
          <div className="relative">
            <LockKeyhole className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <input
              id="new-password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              className="w-full rounded-sm border border-gray-300 py-2.5 pl-10 pr-3 text-sm outline-hidden focus:border-[#173B70] focus:ring-1 focus:ring-[#173B70]"
            />
          </div>
          <p className="mt-1 text-xs text-gray-500">Use between 8 and 128 characters.</p>
        </div>
        <div>
          <label htmlFor="confirm-password" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
            Confirm new passcode
          </label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            minLength={8}
            maxLength={128}
            required
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className="w-full rounded-sm border border-gray-300 px-3 py-2.5 text-sm outline-hidden focus:border-[#173B70] focus:ring-1 focus:ring-[#173B70]"
          />
        </div>
        {error && <p role="alert" className="rounded-sm border-l-4 border-red-600 bg-red-50 p-3 text-sm text-red-800">{error}</p>}
        <button
          type="submit"
          disabled={loading || !token || !email}
          className="flex min-h-12 w-full items-center justify-center gap-2 rounded-sm bg-[#173B70] px-4 py-3 text-sm font-bold uppercase tracking-wider text-white hover:bg-[#245B9E] disabled:opacity-60"
        >
          <KeyRound className="h-4 w-4" />
          {loading ? 'Updating…' : 'Reset passcode'}
        </button>
      </form>
      <button type="button" onClick={onBackToLogin} className="mt-6 inline-flex items-center gap-2 text-sm font-semibold text-[#173B70] hover:underline">
        <ArrowLeft className="h-4 w-4" />
        Back to sign in
      </button>
    </RecoveryShell>
  );
};
