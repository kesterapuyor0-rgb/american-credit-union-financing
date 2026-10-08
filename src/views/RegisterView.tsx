import React, { useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { User } from '../types';
import { safeParseResponse, setStoredAuthToken } from '../utils/api';
import {
  ShieldCheck,
  Lock,
  ArrowRight,
  RefreshCw,
  Eye,
  EyeOff,
  User as UserIcon,
  Mail,
  Phone,
  KeyRound,
  CheckCircle2,
  AlertCircle,
  Building2,
  Check
} from 'lucide-react';

interface RegisterViewProps {
  onRegisterSuccess: (user: User, token: string) => void;
  onNavigateToLogin: (registeredNotice?: string) => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onRegisterSuccess,
  onNavigateToLogin,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<{
    user: User;
    token: string;
    accountNumber?: string;
    routingNumber?: string;
    accountType?: string;
    status?: string;
    startingBalance?: number;
    currency?: string;
  } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim() || !email.trim() || !phone.trim() || !password) {
      setError('Please fill out all required registration fields.');
      return;
    }

    if (password.length < 6) {
      setError('Passcode must be at least 6 characters in length.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passcodes do not match. Please verify your passcode entries.');
      return;
    }

    if (!securityPin || securityPin.trim().length !== 4) {
      setError('Please enter a 4-digit Initial Security PIN.');
      return;
    }

    if (!agreeTerms) {
      setError('Please accept the account portal terms of service.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify({
          fullName: fullName.trim(),
          email: email.trim().toLowerCase(),
          phone: phone.trim(),
          password,
          securityPin: securityPin.trim(),
        }),
      });

      const result = await safeParseResponse(res);
      if (!result.ok) {
        throw new Error(result.error || 'Registration failed. Please check your details and try again.');
      }

      const data = result.data;
      if (data.token) {
        setStoredAuthToken(data.token);
      }
      setSuccessData({
        user: data.user,
        token: data.token,
        accountNumber: data.account?.account_number,
        routingNumber: data.account?.routing_number,
        accountType: data.account?.account_type,
        status: data.account?.status,
        startingBalance: data.account?.balance,
        currency: data.account?.currency,
      });
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#f3f7f6] via-white to-emerald-50 flex flex-col justify-between font-sans">
      {/* Corporate Header */}
      <header className="bg-white text-slate-900 px-4 sm:px-8 py-4 flex justify-between items-center min-h-[80px] shrink-0 border-b-4 border-emerald-600 shadow-sm">
        <div className="cursor-pointer" onClick={() => onNavigateToLogin()}>
          <BrandLogo showSubtitle={true} />
        </div>

        <div className="flex items-center space-x-3 text-xs">
          <span className="hidden sm:inline text-slate-500">Already registered?</span>
          <button
            type="button"
            onClick={() => onNavigateToLogin()}
            className="bg-teal-800 text-white px-4 py-2 rounded-lg font-bold hover:bg-teal-900 uppercase transition-colors shadow-sm cursor-pointer"
          >
            Sign In
          </button>
        </div>
      </header>

      {/* Main Registration Body */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="bg-white border border-emerald-100 rounded-2xl shadow-xl shadow-teal-950/10 max-w-lg w-full overflow-hidden">
          <div className="h-1.5 bg-gradient-to-r from-emerald-500 via-teal-700 to-emerald-500" />

          <div className="p-6 sm:p-8">
            {/* Header section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-teal-700 uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>New Client Enrollment</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#0F766E] font-serif tracking-tight">
                Create Your Account
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Enter your details to create your member profile and checking account.
              </p>
            </div>

            {/* Error Banner */}
            {error && (
              <div className="mb-5 p-3.5 bg-rose-50 border-l-4 border-rose-500 text-rose-800 text-xs flex items-start gap-2.5 rounded-r-lg">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <span className="font-medium leading-relaxed">{error}</span>
              </div>
            )}

            {/* Success state */}
            {successData ? (
              <div className="text-center py-4 space-y-4">
                <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto text-emerald-600">
                  <CheckCircle2 className="w-8 h-8" />
                </div>

                <div>
                  <h3 className="text-xl font-bold text-[#0F766E] font-serif">
                    Welcome, {successData.user.full_name}!
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    Your checking account is ready.
                  </p>
                </div>

                <div className="bg-emerald-50/60 border border-emerald-100 rounded-xl p-4 text-xs space-y-2 text-left">
                  {successData.accountNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Number:</span>
                      <span className="font-mono font-bold text-[#0F766E] text-sm">
                        {successData.accountNumber}
                      </span>
                    </div>
                  )}
                  {successData.routingNumber && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Routing Number (ABA):</span>
                      <span className="font-mono font-bold text-gray-900">{successData.routingNumber}</span>
                    </div>
                  )}
                  {successData.accountType && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Type:</span>
                      <span className="font-semibold text-gray-900">{successData.accountType}</span>
                    </div>
                  )}
                  {successData.startingBalance !== undefined && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Starting Balance:</span>
                      <span className="font-mono font-bold text-emerald-700">
                        {new Intl.NumberFormat('en-US', {
                          style: 'currency',
                          currency: successData.currency || 'USD',
                        }).format(successData.startingBalance)}{' '}
                        {successData.currency || 'USD'}
                      </span>
                    </div>
                  )}
                  {successData.status && (
                    <div className="flex justify-between">
                      <span className="text-gray-500">Status:</span>
                      <span className={`font-bold ${successData.status === 'Active' ? 'text-emerald-700' : 'text-gray-700'}`}>
                        {successData.status}
                      </span>
                    </div>
                  )}
                </div>

                <div className="pt-3 flex flex-col sm:flex-row gap-3">
                  <button
                    type="button"
                    onClick={() => onRegisterSuccess(successData.user, successData.token)}
                    className="flex-1 py-3 px-4 bg-teal-800 hover:bg-teal-900 text-white font-bold text-xs uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <span>Proceed to Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>

                  <button
                    type="button"
                    onClick={() => onNavigateToLogin('Registration completed successfully. You may now sign in with your Online ID.')}
                    className="py-3 px-4 bg-white hover:bg-emerald-50 text-teal-900 border border-emerald-200 font-semibold text-xs rounded-lg transition-colors cursor-pointer"
                  >
                    Go to Sign In
                  </button>
                </div>
              </div>
            ) : (
              /* Registration Form */
              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Full Name */}
                <div>
                  <label
                    htmlFor="reg-fullname"
                    className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                  >
                    Full Legal Name
                  </label>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-fullname"
                      type="text"
                      required
                      placeholder="Enter your full legal name"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700/20 focus:border-teal-700 outline-hidden transition-colors"
                    />
                  </div>
                </div>

                {/* Email Address */}
                <div>
                  <label
                    htmlFor="reg-email"
                    className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                  >
                    Email Address / Online ID
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-email"
                      type="email"
                      required
                      placeholder="Enter your email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700/20 focus:border-teal-700 outline-hidden transition-colors"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    This will be your primary Online ID for account notifications and security codes.
                  </span>
                </div>

                {/* Phone Number */}
                <div>
                  <label
                    htmlFor="reg-phone"
                    className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                  >
                    Mobile Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-phone"
                      type="tel"
                      required
                      placeholder="Enter your mobile phone number"
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700/20 focus:border-teal-700 outline-hidden transition-colors"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    Used as contact information for your profile.
                  </span>
                </div>

                {/* Passcode & Confirm */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label
                      htmlFor="reg-password"
                      className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                    >
                      Passcode
                    </label>
                    <div className="relative">
                      <input
                        id="reg-password"
                        type={showPassword ? 'text' : 'password'}
                        required
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-3 py-2.5 pr-8 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700/20 focus:border-teal-700 outline-hidden transition-colors"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 cursor-pointer"
                      >
                        {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="reg-confirm-password"
                      className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                    >
                      Confirm Passcode
                    </label>
                    <input
                      id="reg-confirm-password"
                      type={showPassword ? 'text' : 'password'}
                      required
                      placeholder="••••••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-3 py-2.5 text-sm border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700/20 focus:border-teal-700 outline-hidden transition-colors"
                    />
                  </div>
                </div>

                {/* Initial Security PIN */}
                <div>
                  <label
                    htmlFor="reg-pin"
                    className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                  >
                    Initial Security PIN (4 Digits)
                  </label>
                  <div className="relative max-w-[200px]">
                    <KeyRound className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      id="reg-pin"
                      type="password"
                      maxLength={4}
                      pattern="[0-9]{4}"
                      required
                      placeholder="Enter your 4-digit PIN"
                      value={securityPin}
                      onChange={(e) => setSecurityPin(e.target.value.replace(/\D/g, ''))}
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono tracking-widest border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-700/20 focus:border-teal-700 outline-hidden"
                    />
                  </div>
                  <span className="text-[11px] text-gray-500 mt-1 block">
                    Used for ATM operations and high-value wire transfers.
                  </span>
                </div>

                {/* Terms and Conditions Checkbox */}
                <div className="pt-2">
                  <label className="flex items-start gap-2.5 text-xs text-gray-600 cursor-pointer">
                    <input
                      id="reg-agree"
                      type="checkbox"
                      checked={agreeTerms}
                      onChange={(e) => setAgreeTerms(e.target.checked)}
                      className="mt-0.5 rounded text-teal-800 focus:ring-teal-700"
                    />
                    <span>
                      I certify that I am at least 18 years of age and agree to the{' '}
                      <span className="text-[#0F766E] font-semibold hover:underline">
                        American Credit Union Financing Terms
                      </span>{' '}
                      and Electronic Disclosures.
                    </span>
                  </label>
                </div>

                {/* Submit Button */}
                <button
                  id="btn-submit-register"
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 px-4 bg-teal-800 hover:bg-teal-900 text-white font-bold text-sm uppercase tracking-wider rounded-lg shadow-sm transition-colors flex items-center justify-center gap-2 mt-5 cursor-pointer disabled:opacity-75"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <span>Open Account & Complete Enrollment</span>
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </form>
            )}
          </div>

        </div>
      </main>

      {/* Corporate Footer */}
      <footer className="min-h-[40px] bg-white/80 border-t border-emerald-100 px-4 sm:px-8 py-2 flex items-center justify-between shrink-0 text-[10px] text-slate-500">
        <div className="flex items-center space-x-4">
          <span>© {new Date().getFullYear()} American Credit Union Financing</span>
          <span className="hidden sm:inline">|</span>
          <a href="#privacy" className="hover:underline hidden sm:inline">Privacy</a>
          <a href="#security" className="hover:underline hidden sm:inline">Security</a>
        </div>
        <div className="flex items-center space-x-2">
          <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
          <span className="text-[10px] font-bold text-gray-600 uppercase tracking-widest">
            Online enrollment
          </span>
        </div>
      </footer>
    </div>
  );
};
