import React, { useEffect, useRef, useState } from 'react';
import { BrandLogo } from '../components/BrandLogo';
import { User } from '../types';
import { safeParseResponse } from '../utils/api';
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
  Check,
  Upload,
  Clock3
} from 'lucide-react';

const readVerificationDocument = (file: File): Promise<{ data: string; contentType: string }> => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string') {
      reject(new Error('Unable to read the selected image.'));
      return;
    }

    const dataUrlPrefix = `data:${file.type};base64,`;
    if (!reader.result.startsWith(dataUrlPrefix)) {
      reject(new Error('Unable to convert the selected image.'));
      return;
    }

    resolve({
      data: reader.result.slice(dataUrlPrefix.length),
      contentType: file.type,
    });
  };
  reader.onerror = () => reject(reader.error || new Error('Unable to read the selected image.'));
  reader.readAsDataURL(file);
});

interface RegisterViewProps {
  onNavigateToLogin: (registeredNotice?: string) => void;
}

export const RegisterView: React.FC<RegisterViewProps> = ({
  onNavigateToLogin,
}) => {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [securityPin, setSecurityPin] = useState('');
  const [verificationNumber, setVerificationNumber] = useState('');
  const [sampleFile, setSampleFile] = useState<File | null>(null);
  const [step, setStep] = useState<1 | 2>(1);
  const [showPassword, setShowPassword] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successData, setSuccessData] = useState<User | null>(null);
  const errorBannerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (error) {
      errorBannerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [error]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!fullName.trim()) {
      setError('Enter your full legal name to continue.');
      return;
    }

    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Enter a valid email address to continue.');
      return;
    }

    if (!phone.trim()) {
      setError('Enter your mobile phone number to continue.');
      return;
    }

    if (!password) {
      setError('Enter a passcode to continue.');
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

    if (!/^\d{4}$/.test(securityPin)) {
      setError('Please enter a 4-digit Initial Security PIN.');
      return;
    }

    if (!agreeTerms) {
      setError('Please accept the terms of service.');
      return;
    }

    if (step === 1) {
      setStep(2);
      return;
    }

    if (!/^(?:ACUF-)?[A-Z0-9]{4,12}$/.test(verificationNumber.trim().toUpperCase())) {
      setError('Enter a verification reference with 4–12 letters or numbers, optionally prefixed with ACUF-. Do not enter a Social Security number.');
      return;
    }
    if (!sampleFile) {
      setError('Choose a sample image file to continue.');
      return;
    }

    setLoading(true);

    try {
      const verificationDocument = await readVerificationDocument(sampleFile);
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
          verificationNumber: verificationNumber.trim().toUpperCase(),
          sampleFile: {
            name: sampleFile.name,
            type: sampleFile.type,
            size: sampleFile.size,
          },
          verificationDocument,
        }),
      });

      const result = await safeParseResponse(res);
      if (!result.ok) {
        throw new Error(result.error || 'Registration failed. Please check your details and try again.');
      }

      const data = result.data;
      setSuccessData(data.user);
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-[100dvh] bg-[#F3F4F6] flex flex-col justify-between font-sans">
      {/* Corporate Header */}
      <header className="flex min-h-[72px] shrink-0 items-center border-b-4 border-[#D6A832] bg-[#173B70] px-4 py-3 text-white shadow-lg sm:px-8">
        <div className="mx-auto flex w-full max-w-7xl items-center justify-between gap-3">
          <button type="button" className="min-w-0 cursor-pointer text-left" onClick={() => onNavigateToLogin()} aria-label="American Credit Union Financing home">
            <BrandLogo className="min-w-0" variant="white" />
          </button>

          <div className="flex shrink-0 items-center gap-2 text-xs sm:gap-3">
            <span className="hidden text-slate-300 sm:inline">Already registered?</span>
            <button
              type="button"
              onClick={() => onNavigateToLogin()}
              className="min-h-10 rounded-sm bg-white px-3 py-2 font-bold uppercase text-[#173B70] shadow-xs transition-colors hover:bg-gray-100"
            >
              Sign In
            </button>
          </div>
        </div>
      </header>

      {/* Main Registration Body */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6">
        <div className="bg-white border border-gray-200 rounded-sm shadow-xl max-w-lg w-full overflow-hidden">
          <div className="h-1.5 bg-[#D6A832]" />

          <div className="p-6 sm:p-8">
            {/* Header section */}
            <div className="mb-6">
              <div className="flex items-center gap-2 text-xs font-bold text-[#D6A832] uppercase tracking-wider mb-1">
                <ShieldCheck className="w-4 h-4" />
                <span>New Client Enrollment</span>
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-[#173B70] font-serif tracking-tight">
                Create Your Account
              </h1>
              <p className="text-xs text-gray-500 mt-1">
                Submit your member profile and verification details for review.
              </p>
            </div>

            {/* Success state */}
            {successData ? (
              <div className="space-y-5 py-4 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-100 text-amber-700">
                  <Clock3 className="h-8 w-8" />
                </div>
                <div>
                  <h3 className="font-serif text-xl font-bold text-[#173B70]">
                    Enrollment under review
                  </h3>
                  <p className="mt-2 text-sm text-gray-700">
                    Thank you, {successData.full_name}. Your enrollment is being reviewed. Dashboard access will be available after approval.
                  </p>
                </div>
                <div className="rounded-sm border border-amber-200 bg-amber-50 p-3 text-left text-xs leading-relaxed text-amber-900">
                  For your security, do not enter a Social Security number. The uploaded image is stored with your enrollment and is visible to authorized administrators reviewing your application.
                </div>
                <div className="rounded-sm border border-blue-200 bg-blue-50 p-4 text-left text-sm leading-6 text-blue-950">
                  To complete your registration, contact customer support at{' '}
                  <a
                    href="mailto:americancreditunion.financing@gmail.com"
                    className="break-all font-semibold underline underline-offset-2"
                  >
                    americancreditunion.financing@gmail.com
                  </a>
                  .
                </div>
                <button
                  type="button"
                  onClick={() => onNavigateToLogin('Your enrollment is awaiting administrator review.')}
                  className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-sm bg-[#173B70] px-4 py-3 text-xs font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#245B9E]"
                >
                  Return to Sign In
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            ) : (
              /* Registration Form */
              <form onSubmit={handleSubmit} noValidate className="space-y-4">
                <div className="flex items-center gap-3 rounded-sm bg-slate-50 p-3 text-xs">
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full font-bold ${step === 1 ? 'bg-[#173B70] text-white' : 'bg-emerald-700 text-white'}`}>1</span>
                  <span className={step === 1 ? 'font-semibold text-[#173B70]' : 'text-gray-500'}>Profile</span>
                  <span className="h-px flex-1 bg-gray-300" />
                  <span className={`flex h-7 w-7 items-center justify-center rounded-full font-bold ${step === 2 ? 'bg-[#173B70] text-white' : 'bg-gray-200 text-gray-500'}`}>2</span>
                  <span className={step === 2 ? 'font-semibold text-[#173B70]' : 'text-gray-500'}>Identity Verification</span>
                </div>

                {step === 1 ? (
                <>
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
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#173B70] focus:border-[#173B70] outline-hidden transition-colors"
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
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#173B70] focus:border-[#173B70] outline-hidden transition-colors"
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
                      className="w-full pl-9 pr-3.5 py-2.5 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#173B70] focus:border-[#173B70] outline-hidden transition-colors"
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
                        className="w-full px-3 py-2.5 pr-8 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#173B70] focus:border-[#173B70] outline-hidden transition-colors"
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
                      className="w-full px-3 py-2.5 text-sm border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#173B70] focus:border-[#173B70] outline-hidden transition-colors"
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
                      className="w-full pl-9 pr-3 py-2.5 text-sm font-mono tracking-widest border border-gray-300 rounded-sm focus:ring-1 focus:ring-[#173B70] focus:border-[#173B70] outline-hidden"
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
                      className="mt-0.5 rounded-sm text-[#173B70] focus:ring-[#173B70]"
                    />
                    <span>
                      I certify that I am at least 18 years of age and agree to the{' '}
                      <span className="text-[#173B70] font-semibold hover:underline">
                        American Credit Union Financing Terms
                      </span>{' '}
                      and Electronic Disclosures.
                    </span>
                  </label>
                </div>
                </>
                ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="reg-verification-number" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
                      Identity Verification Reference
                    </label>
                    <input
                      id="reg-verification-number"
                      type="text"
                      required
                      maxLength={17}
                      pattern="(ACUF-)?[A-Za-z0-9]{4,12}"
                      autoComplete="off"
                      placeholder="ACUF-123456 or 123456"
                      value={verificationNumber}
                      onChange={(event) => setVerificationNumber(event.target.value.toUpperCase())}
                      className="w-full rounded-sm border border-gray-300 px-3 py-2.5 font-mono text-sm uppercase focus:border-[#173B70] focus:ring-1 focus:ring-[#173B70] outline-hidden"
                    />
                  </div>

                  <div>
                    <label htmlFor="reg-sample-file" className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-gray-700">
                      Supporting Document Image
                    </label>
                    <label htmlFor="reg-sample-file" className="flex min-h-24 cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-5 text-center hover:border-[#173B70]">
                      <Upload className="h-5 w-5 text-[#173B70]" />
                      <span className="text-xs font-semibold text-gray-700">{sampleFile ? sampleFile.name : 'Choose an image file'}</span>
                      <span className="text-[11px] text-gray-500">JPEG, PNG, WebP, or GIF · up to 5 MB · stored for enrollment review</span>
                    </label>
                    <input
                      id="reg-sample-file"
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/gif"
                      className="sr-only"
                      onChange={(event) => {
                        const file = event.target.files?.[0] || null;
                        if (!file) {
                          setSampleFile(null);
                          return;
                        }
                        if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
                          setSampleFile(null);
                          event.target.value = '';
                          setError('Choose a JPEG, PNG, WebP, or GIF image up to 5 MB.');
                          return;
                        }
                        setError(null);
                        setSampleFile(file);
                      }}
                    />
                    {sampleFile && <p className="mt-1 text-[11px] text-gray-500">Selected file: {Math.ceil(sampleFile.size / 1024)} KB. The image will be stored for administrator review.</p>}
                  </div>
                </div>
                )}

                {/* Submit Button */}
                <div className="mt-5 space-y-3">
                  {error && (
                    <div
                      ref={errorBannerRef}
                      role="alert"
                      aria-live="assertive"
                      className="flex scroll-mt-4 items-start gap-2.5 rounded-r-sm border-l-4 border-[#D6A832] bg-red-50 p-3.5 text-xs text-red-800"
                    >
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#D6A832]" />
                      <span className="font-medium leading-relaxed">{error}</span>
                    </div>
                  )}
                  <div className="flex gap-3">
                    {step === 2 && (
                      <button
                        type="button"
                        onClick={() => { setError(null); setStep(1); }}
                        disabled={loading}
                        className="min-h-12 rounded-sm border border-gray-300 px-4 text-xs font-bold uppercase tracking-wider text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        Back
                      </button>
                    )}
                    <button
                      id="btn-submit-register"
                      type="submit"
                      disabled={loading}
                      className="flex min-h-12 flex-1 items-center justify-center gap-2 rounded-sm bg-[#173B70] px-4 py-3.5 text-sm font-bold uppercase tracking-wider text-white shadow-sm transition-colors hover:bg-[#245B9E] disabled:opacity-75"
                    >
                      {loading ? <RefreshCw className="h-4 w-4 animate-spin" /> : (
                        <>
                          <span>{step === 1 ? 'Continue to Verification' : 'Open Account & Complete Enrollment'}</span>
                          {step === 1 ? <ArrowRight className="h-4 w-4" /> : <CheckCircle2 className="h-4 w-4" />}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </form>
            )}
          </div>

        </div>
      </main>

      {/* Corporate Footer */}
      <footer className="h-[40px] bg-white border-t border-gray-200 px-4 sm:px-8 flex items-center justify-between shrink-0 text-[10px] text-gray-500">
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
