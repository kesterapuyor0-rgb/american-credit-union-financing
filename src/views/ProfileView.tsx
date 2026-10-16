import React, { FormEvent, useEffect, useRef, useState } from 'react';
import { startRegistration } from '@simplewebauthn/browser';
import { CheckCircle2, FileImage, KeyRound, LoaderCircle, LogOut, Mail, MapPin, Phone, Save, Trash2, Upload, UserRound } from 'lucide-react';
import { User } from '../types';
import { getAuthHeaders, safeParseResponse } from '../utils/api';
import { formatDisplayName } from '../utils/formatDisplayName';

interface ProfileViewProps {
  user: User;
  onUserUpdated: (updates: Partial<User>) => void;
  onSignOut: () => void;
  focusIdentityVerification: boolean;
  onIdentityVerificationFocused: () => void;
}

interface ProfileForm {
  phone: string;
  address: string;
}

interface PasskeyCredential {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string | null;
}

interface SelectedIdentityImage {
  dataUrl: string;
  name: string;
}

const readIdentityImage = (file: File): Promise<SelectedIdentityImage> => new Promise((resolve, reject) => {
  if (!['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
    reject(new Error('Select a JPEG, PNG, WebP, or GIF image up to 5 MB.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string' || !reader.result.startsWith(`data:${file.type};base64,`)) {
      reject(new Error('Unable to read the selected image.'));
      return;
    }
    resolve({ dataUrl: reader.result, name: file.name });
  };
  reader.onerror = () => reject(new Error('Unable to read the selected image.'));
  reader.readAsDataURL(file);
});

const formatUsPhoneForDisplay = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
  }
  return phone;
};

export const ProfileView: React.FC<ProfileViewProps> = ({
  user,
  onUserUpdated,
  onSignOut,
  focusIdentityVerification,
  onIdentityVerificationFocused,
}) => {
  const [form, setForm] = useState<ProfileForm>({ phone: user.phone || '', address: user.address || '' });
  const [loadingProfile, setLoadingProfile] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [passkeys, setPasskeys] = useState<PasskeyCredential[]>([]);
  const [passkeyName, setPasskeyName] = useState('This device');
  const [loadingPasskeys, setLoadingPasskeys] = useState(true);
  const [passkeyBusy, setPasskeyBusy] = useState(false);
  const [passkeyMessage, setPasskeyMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [governmentId, setGovernmentId] = useState<SelectedIdentityImage | null>(null);
  const [addressProof, setAddressProof] = useState<SelectedIdentityImage | null>(null);
  const [governmentIdType, setGovernmentIdType] = useState<'' | 'Passport' | "Driver's License" | 'State ID'>('');
  const [identityBusy, setIdentityBusy] = useState(false);
  const [identityMessage, setIdentityMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const identityVerificationRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setForm({ phone: user.phone || '', address: user.address || '' });
  }, [user.phone, user.address]);

  useEffect(() => {
    if (!focusIdentityVerification || !identityVerificationRef.current) return;
    identityVerificationRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    onIdentityVerificationFocused();
  }, [focusIdentityVerification, onIdentityVerificationFocused]);

  useEffect(() => {
    let cancelled = false;
    const loadProfile = async () => {
      setLoadingProfile(true);
      try {
        const response = await fetch('/api/user/profile', { headers: getAuthHeaders(), credentials: 'include' });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load your profile.');
        if (!cancelled && data.profile) {
          setForm({ phone: data.profile.phone || '', address: data.profile.address || '' });
          onUserUpdated({
            email: data.profile.email || user.email,
            full_name: data.profile.full_name || user.full_name,
            phone: data.profile.phone || '',
            address: data.profile.address || '',
            profilePicture: data.profile.profilePicture || '',
            kycStatus: data.profile.kycStatus || 'UNVERIFIED',
            restrictionType: data.profile.restrictionType && data.profile.restrictionType !== 'NONE' ? data.profile.restrictionType : data.profile.isRestricted ? 'KYC' : 'NONE',
            rejectionReason: data.profile.rejectionReason || '',
            kycSubmittedAt: data.profile.kycSubmittedAt,
            isRestricted: data.profile.isRestricted === true,
            restrictionReason: data.profile.restrictionReason || '',
            restrictionReviewStatus: data.profile.restrictionReviewStatus || 'not_requested',
            restrictionReviewReason: data.profile.restrictionReviewReason || '',
          });
        }
      } catch (error) {
        if (!cancelled) setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load your profile.' });
      } finally {
        if (!cancelled) setLoadingProfile(false);
      }
    };
    void loadProfile();
    return () => { cancelled = true; };
  }, [user.id]);

  const loadPasskeys = async () => {
    setLoadingPasskeys(true);
    try {
      const response = await fetch('/api/auth/passkey/credentials', { headers: getAuthHeaders(), credentials: 'include' });
      const result = await safeParseResponse<{ credentials?: PasskeyCredential[] }>(response);
      if (!result.ok) throw new Error(result.error || 'Unable to load passkeys.');
      setPasskeys(Array.isArray(result.data.credentials) ? result.data.credentials : []);
    } catch (error) {
      setPasskeyMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to load passkeys.' });
    } finally {
      setLoadingPasskeys(false);
    }
  };

  useEffect(() => {
    void loadPasskeys();
  }, [user.id]);

  const registerPasskey = async () => {
    setPasskeyBusy(true);
    setPasskeyMessage(null);
    try {
      const optionsResponse = await fetch('/api/auth/passkey/register-options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
      });
      const optionsResult = await safeParseResponse(optionsResponse);
      if (!optionsResult.ok) throw new Error(optionsResult.error || 'Unable to start passkey registration.');
      if (typeof optionsResult.data?.challengeId !== 'string' || !optionsResult.data?.options) {
        throw new Error('The passkey registration response was incomplete.');
      }

      const credential = await startRegistration({ optionsJSON: optionsResult.data.options });
      const verifyResponse = await fetch('/api/auth/passkey/verify-registration', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          challengeId: optionsResult.data.challengeId,
          response: credential,
          name: passkeyName.trim(),
        }),
      });
      const verifyResult = await safeParseResponse(verifyResponse);
      if (!verifyResult.ok) throw new Error(verifyResult.error || 'Unable to save this passkey.');
      setPasskeyName('This device');
      setPasskeyMessage({ type: 'success', text: 'Passkey added. You can now use it to sign in.' });
      await loadPasskeys();
    } catch (error) {
      setPasskeyMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to register a passkey.' });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const removePasskey = async (credential: PasskeyCredential) => {
    if (!window.confirm(`Remove the passkey "${credential.name}"? It will no longer work to sign in.`)) return;
    setPasskeyBusy(true);
    setPasskeyMessage(null);
    try {
      const response = await fetch(`/api/auth/passkey/credentials/${encodeURIComponent(credential.id)}`, {
        method: 'DELETE',
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const result = await safeParseResponse(response);
      if (!result.ok) throw new Error(result.error || 'Unable to remove this passkey.');
      setPasskeys((current) => current.filter((passkey) => passkey.id !== credential.id));
      setPasskeyMessage({ type: 'success', text: 'Passkey removed.' });
    } catch (error) {
      setPasskeyMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to remove this passkey.' });
    } finally {
      setPasskeyBusy(false);
    }
  };

  const submitRestrictionIdentityDocuments = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!governmentId || !addressProof) {
      setIdentityMessage({ type: 'error', text: 'Upload a government-issued ID and proof of address.' });
      return;
    }
    setIdentityBusy(true);
    setIdentityMessage(null);
    try {
      const response = await fetch('/api/user/restriction-identity-documents', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          governmentIdType,
          governmentIdUrl: governmentId.dataUrl,
          governmentIdMetadata: { name: governmentId.name },
          addressProofUrl: addressProof.dataUrl,
          addressProofMetadata: { name: addressProof.name },
        }),
      });
      const result = await safeParseResponse<{ user?: Pick<User, 'restrictionReviewStatus' | 'kycStatus' | 'rejectionReason' | 'kycSubmittedAt' | 'isRestricted'> }>(response);
      if (!result.ok) throw new Error(result.error || 'Unable to submit your identity documents.');
      onUserUpdated({
        restrictionReviewStatus: result.data.user?.restrictionReviewStatus || 'pending',
        kycStatus: result.data.user?.kycStatus || 'PENDING_REVIEW',
        rejectionReason: result.data.user?.rejectionReason || '',
        kycSubmittedAt: result.data.user?.kycSubmittedAt,
        isRestricted: result.data.user?.isRestricted ?? user.isRestricted,
      });
      setIdentityMessage({ type: 'success', text: 'Your identity documents were submitted to Member Services for review.' });
    } catch (error) {
      setIdentityMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to submit your identity documents.' });
    } finally {
      setIdentityBusy(false);
    }
  };

  const identityImageField = (
    label: string,
    image: SelectedIdentityImage | null,
    setter: React.Dispatch<React.SetStateAction<SelectedIdentityImage | null>>,
  ) => (
    <label className="block min-w-0 space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
      <span className="font-semibold text-slate-800">{label} <span className="text-rose-700">*</span></span>
      <span className="block text-xs leading-5 text-slate-500">JPEG, PNG, WebP, or GIF · up to 5 MB</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        required={!image}
        disabled={identityBusy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          void readIdentityImage(file).then(setter).catch((error: unknown) => {
            setter(null);
            setIdentityMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to read the selected image.' });
          });
        }}
        className="block w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-800"
      />
      {image && <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-emerald-800"><FileImage aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">{image.name}</span></span>}
    </label>
  );

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ phone: form.phone, address: form.address }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to save your profile.');
      const updatedUser = data.user as Partial<User>;
      setForm({ phone: updatedUser.phone || '', address: updatedUser.address || '' });
      onUserUpdated(updatedUser);
      setMessage({ type: 'success', text: 'Profile details saved.' });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to save your profile.' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section aria-labelledby="profile-heading" className="mx-auto w-full min-w-0 max-w-full space-y-6 pb-32 sm:max-w-3xl">
      <header className="flex flex-col items-center gap-4 rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm sm:flex-row sm:text-left">
        <div className="relative h-24 w-24 shrink-0">
          <div className="grid h-24 w-24 place-items-center overflow-hidden rounded-full border-2 border-amber-400 bg-emerald-50 text-3xl font-semibold text-teal-800">
            {user.profilePicture ? <img src={user.profilePicture} alt={`${user.full_name} profile`} className="h-full w-full object-cover" /> : user.full_name.charAt(0).toUpperCase() || 'U'}
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Personal details</p>
          <h1 id="profile-heading" className="mt-1 break-words text-2xl font-bold text-teal-900">{formatDisplayName(user.full_name)}</h1>
          <p className="mt-1 text-sm text-slate-500">Manage your contact information. Your profile photo is managed by Member Services.</p>
          {user.kycStatus === 'APPROVED' && (
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800">
              <CheckCircle2 aria-hidden="true" className="h-4 w-4" />
              Identity Verified
            </p>
          )}
        </div>
      </header>

      <form onSubmit={handleSave} className="space-y-5 rounded-2xl border border-slate-200 bg-white px-3.5 py-4 shadow-sm sm:p-7">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">Profile information</h2>
          <p className="mt-1 text-sm text-slate-500">Your full name is read-only. Update your phone number or address below.</p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><UserRound aria-hidden="true" className="h-4 w-4 text-slate-400" />Full name</span>
            <input value={formatDisplayName(user.full_name)} readOnly disabled className="min-h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600" />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><Mail aria-hidden="true" className="h-4 w-4 text-slate-400" />Email address</span>
            <input type="email" value={user.email} readOnly disabled className="min-h-11 w-full cursor-not-allowed rounded-lg border border-slate-200 bg-slate-100 px-3 py-2.5 text-sm text-slate-600" />
          </label>

          <label className="block space-y-1.5">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><Phone aria-hidden="true" className="h-4 w-4 text-slate-400" />Phone number</span>
            <input type="tel" autoComplete="tel" value={formatUsPhoneForDisplay(form.phone)} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} required maxLength={32} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15" />
          </label>

          <label className="block space-y-1.5 sm:col-span-2">
            <span className="flex items-center gap-2 text-sm font-medium text-slate-700"><MapPin aria-hidden="true" className="h-4 w-4 text-slate-400" />Address</span>
            <textarea autoComplete="street-address" value={form.address} onChange={(event) => setForm((current) => ({ ...current, address: event.target.value }))} rows={3} maxLength={200} placeholder="Enter your mailing address" className="w-full resize-y rounded-lg border border-slate-300 px-3 py-2.5 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15" />
          </label>
        </div>

        {message && <p role="status" aria-live="polite" className={`rounded-lg px-3 py-2.5 text-sm ${message.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{message.text}</p>}

        <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-slate-500">{loadingProfile ? 'Loading profile details…' : 'Changes apply to your contact details.'}</p>
          <button type="submit" disabled={saving || loadingProfile} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60">
            {saving ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Save aria-hidden="true" className="h-4 w-4" />}
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </form>
      {(user.restrictionType && user.restrictionType !== 'NONE' ? user.restrictionType : user.isRestricted ? 'KYC' : 'NONE') === 'KYC' && (
        <section ref={identityVerificationRef} aria-labelledby="identity-verification-heading" className="min-w-0 scroll-mt-24 space-y-4 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm sm:p-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Profile &amp; Settings</p>
            <h2 id="identity-verification-heading" className="mt-1 text-lg font-semibold text-slate-900">Identity Verification</h2>
            <p className="mt-1 text-sm leading-5 text-slate-600">Submit a valid government-issued ID and proof of your current address. Member Services will review these documents before full account access is restored.</p>
          </div>
          {user.restrictionReviewStatus === 'pending' || user.kycStatus === 'PENDING_REVIEW' ? (
            <p role="status" className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">
              Your documents are under review. Your account remains restricted during review; your available balance remains visible on the dashboard.
            </p>
          ) : (
            <form onSubmit={(event) => { void submitRestrictionIdentityDocuments(event); }} className="space-y-4">
              {user.restrictionReviewStatus === 'rejected' && user.restrictionReviewReason && (
                <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm leading-5 text-rose-800">
                  Member Services requested new documents: {user.restrictionReviewReason}
                </p>
              )}
              <label className="block space-y-2 text-sm">
                <span className="font-semibold text-slate-800">Government-issued ID type <span className="text-rose-700">*</span></span>
                <select
                  required
                  value={governmentIdType}
                  onChange={(event) => setGovernmentIdType(event.target.value as typeof governmentIdType)}
                  disabled={identityBusy}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select an ID type</option>
                  <option value="Passport">Passport</option>
                  <option value="Driver's License">Driver’s License</option>
                  <option value="State ID">State ID</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {identityImageField('Government-issued ID', governmentId, setGovernmentId)}
                {identityImageField('Proof of address', addressProof, setAddressProof)}
              </div>
              {identityMessage && <p role={identityMessage.type === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2.5 text-sm ${identityMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{identityMessage.text}</p>}
              <button type="submit" disabled={identityBusy || !governmentIdType || !governmentId || !addressProof} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
                {identityBusy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Upload aria-hidden="true" className="h-4 w-4" />}
                {identityBusy ? 'Submitting…' : 'Submit identity documents'}
              </button>
            </form>
          )}
        </section>
      )}
      <section aria-labelledby="passkeys-heading" className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
        <div>
          <h2 id="passkeys-heading" className="flex items-center gap-2 text-lg font-semibold text-slate-900">
            <KeyRound aria-hidden="true" className="h-5 w-5 text-teal-800" />
            Passkeys
          </h2>
          <p className="mt-1 text-sm text-slate-600">Sign in securely with Touch ID, Face ID, a fingerprint, or your device’s screen lock.</p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="min-w-0 flex-1">
            <span className="sr-only">Passkey name</span>
            <input
              value={passkeyName}
              onChange={(event) => setPasskeyName(event.target.value)}
              maxLength={50}
              aria-label="Passkey name"
              className="min-h-11 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
              placeholder="Name this passkey"
            />
          </label>
          <button
            type="button"
            onClick={() => { void registerPasskey(); }}
            disabled={passkeyBusy || !passkeyName.trim()}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {passkeyBusy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <KeyRound aria-hidden="true" className="h-4 w-4" />}
            Add a passkey
          </button>
        </div>
        {passkeyMessage && (
          <p role={passkeyMessage.type === 'error' ? 'alert' : 'status'} className={`rounded-lg px-3 py-2.5 text-sm ${passkeyMessage.type === 'success' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>
            {passkeyMessage.text}
          </p>
        )}
        {loadingPasskeys ? (
          <p className="text-sm text-slate-500">Loading passkeys…</p>
        ) : passkeys.length ? (
          <ul className="divide-y divide-slate-100">
            {passkeys.map((passkey) => (
              <li key={passkey.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-900">{passkey.name}</p>
                  <p className="text-xs text-slate-500">Added {new Date(passkey.createdAt).toLocaleDateString()}</p>
                </div>
                <button
                  type="button"
                  disabled={passkeyBusy}
                  onClick={() => { void removePasskey(passkey); }}
                  className="inline-flex min-h-10 items-center justify-center gap-1.5 self-start rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50 sm:self-auto"
                >
                  <Trash2 aria-hidden="true" className="h-4 w-4" />
                  Remove
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-slate-500">No passkeys registered for this account yet.</p>
        )}
      </section>
      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Sign out</h2>
          <p className="mt-1 text-xs text-slate-500">End your current session on this device.</p>
        </div>
        <button type="button" onClick={onSignOut} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 px-4 py-2.5 text-sm font-semibold text-rose-700 hover:bg-rose-50">
          <LogOut aria-hidden="true" className="h-4 w-4" /> Sign Out
        </button>
      </div>
      <div className="flex items-center gap-2 text-xs text-emerald-800"><CheckCircle2 aria-hidden="true" className="h-4 w-4" />Your full name cannot be changed from this form.</div>
    </section>
  );
};
