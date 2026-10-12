import React, { useState } from 'react';
import { AlertCircle, FileImage, LoaderCircle, LogOut, Upload } from 'lucide-react';
import { User } from '../types';
import { getAuthHeaders } from '../utils/api';

interface SelectedImage {
  dataUrl: string;
  name: string;
  type: string;
  size: number;
}

interface KycResubmissionViewProps {
  user: User;
  onSubmitted: (updates: Partial<User>) => void;
  onSignOut: () => void;
}

const readImage = (file: File): Promise<SelectedImage> => new Promise((resolve, reject) => {
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
    resolve({ dataUrl: reader.result, name: file.name, type: file.type, size: file.size });
  };
  reader.onerror = () => reject(new Error('Unable to read the selected image.'));
  reader.readAsDataURL(file);
});

export const KycResubmissionView: React.FC<KycResubmissionViewProps> = ({ user, onSubmitted, onSignOut }) => {
  const [governmentId, setGovernmentId] = useState<SelectedImage | null>(null);
  const [addressProof, setAddressProof] = useState<SelectedImage | null>(null);
  const [selfie, setSelfie] = useState<SelectedImage | null>(null);
  const [verificationNumber, setVerificationNumber] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [storedRejectionData] = useState<Partial<User> | null>(() => {
    try {
      const saved = localStorage.getItem('kyc_rejection_data');
      if (!saved) return null;
      const parsed = JSON.parse(saved) as Partial<User>;
      return parsed.id === user.id ? parsed : null;
    } catch (storageError) {
      console.error('Unable to read stored KYC rejection data:', storageError);
      return null;
    }
  });
  const rejectionReason = user.verification_rejection_reason || storedRejectionData?.verification_rejection_reason || '';
  const rejectionDetails = user.verification_rejection_details?.length
    ? user.verification_rejection_details
    : storedRejectionData?.verification_rejection_details?.length
      ? storedRejectionData.verification_rejection_details
      : (rejectionReason || 'Your submitted documents require an update.').split(/\r?\n/).filter(Boolean);
  const requiresVerificationNumber = rejectionDetails.some((detail) => /SSN|Social Security|Tax ID/i.test(detail));

  const selectImage = async (
    file: File | undefined,
    setter: React.Dispatch<React.SetStateAction<SelectedImage | null>>,
  ) => {
    if (!file) return;
    setError('');
    try {
      setter(await readImage(file));
    } catch (selectionError) {
      setter(null);
      setError(selectionError instanceof Error ? selectionError.message : 'Unable to read the selected image.');
    }
  };

  const submitResubmission = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!governmentId || !addressProof || !selfie) {
      setError('Upload a government ID, proof of address, and a new verification selfie.');
      return;
    }
    if (requiresVerificationNumber && !verificationNumber) {
      setError('Enter the corrected 9-digit Social Security or Tax ID number requested by Member Services.');
      return;
    }
    if (verificationNumber && !/^\d{9}$/.test(verificationNumber)) {
      setError('Enter all 9 digits of your Social Security or Tax ID number.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/user/kyc-resubmission', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          governmentIdUrl: governmentId.dataUrl,
          governmentIdMetadata: { name: governmentId.name },
          addressProofUrl: addressProof.dataUrl,
          addressProofMetadata: { name: addressProof.name },
          selfieUrl: selfie.dataUrl,
          verificationNumber: verificationNumber.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to submit replacement KYC documents.');
      const statusUpdate: Partial<User> = {
        status: 'pending_review',
        verification_status: data.user.verification_status,
        verification_rejection_reason: '',
        verification_rejection_details: [],
      };
      try {
        localStorage.setItem(`kyc-status-updated:${user.id}`, JSON.stringify(statusUpdate));
      } catch (storageError) {
        console.error('KYC documents were submitted, but the status could not be synchronized across tabs:', storageError);
      }
      window.dispatchEvent(new CustomEvent('kyc:status-updated', { detail: { userId: user.id, ...statusUpdate } }));
      onSubmitted(statusUpdate);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit replacement KYC documents.');
    } finally {
      setLoading(false);
    }
  };

  const imageField = (
    label: string,
    image: SelectedImage | null,
    setter: React.Dispatch<React.SetStateAction<SelectedImage | null>>,
  ) => (
    <label className="block space-y-2 rounded-lg border border-slate-200 p-3 text-sm">
      <span className="font-semibold text-slate-800">{label} <span className="text-rose-700">*</span></span>
      <span className="block text-xs text-slate-500">JPEG, PNG, WebP, or GIF · up to 5 MB</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        required
        onChange={(event) => { void selectImage(event.target.files?.[0], setter); }}
        className="block w-full text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-800"
      />
      {image && (
        <span className="flex items-center gap-2 text-xs font-medium text-emerald-800">
          <FileImage aria-hidden="true" className="h-4 w-4 shrink-0" /> {image.name}
        </span>
      )}
    </label>
  );

  return (
    <main className="mx-auto flex min-h-[calc(100dvh-8rem)] w-full max-w-2xl items-center justify-center px-4 py-8 pb-32">
      <section className="w-full rounded-xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
        <div className="flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-rose-100 text-rose-700">
            <AlertCircle aria-hidden="true" className="h-6 w-6" />
          </span>
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-rose-700">Action required</p>
            <h1 className="text-xl font-bold text-slate-950">Resubmit your verification documents</h1>
          </div>
        </div>
        <p className="mt-4 text-sm leading-6 text-slate-700">
          Member Services reviewed your application and needs the following items updated before it can be approved:
        </p>
        <ul className="mt-3 list-disc space-y-1 rounded-lg border border-rose-200 bg-rose-50 p-4 pl-8 text-sm text-rose-950">
          {rejectionDetails.map((detail, index) => <li key={`${index}-${detail}`}>{detail}</li>)}
        </ul>

        <form onSubmit={submitResubmission} className="mt-6 space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            {imageField('Replacement government ID', governmentId, setGovernmentId)}
            {imageField('Proof of current address', addressProof, setAddressProof)}
            <div className="sm:col-span-2">{imageField('New verification selfie', selfie, setSelfie)}</div>
          </div>
          <label className="block space-y-1.5 text-sm font-semibold text-slate-800">
            Updated SSN or Tax ID {requiresVerificationNumber ? '(required)' : '(optional)'}
            <input
              type="text"
              inputMode="numeric"
              autoComplete="off"
              maxLength={9}
              required={requiresVerificationNumber}
              value={verificationNumber}
              onChange={(event) => setVerificationNumber(event.target.value.replace(/\D/g, '').slice(0, 9))}
              placeholder={requiresVerificationNumber ? 'Enter the corrected 9-digit number' : 'Enter 9 digits only if the previous number needs correction'}
              className="min-h-11 w-full rounded-md border border-slate-300 px-3 py-2 text-sm font-normal"
            />
          </label>
          {error && <p role="alert" className="rounded-md border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
          <div className="flex flex-col-reverse gap-3 border-t border-slate-100 pt-4 sm:flex-row sm:justify-between">
            <button type="button" onClick={onSignOut} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50">
              <LogOut aria-hidden="true" className="h-4 w-4" /> Sign out
            </button>
            <button type="submit" disabled={loading} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-[#173B70] px-5 py-2.5 text-sm font-bold text-white hover:bg-[#245B9E] disabled:opacity-60">
              {loading ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Upload aria-hidden="true" className="h-4 w-4" />}
              {loading ? 'Submitting…' : 'Submit replacement documents'}
            </button>
          </div>
        </form>
      </section>
    </main>
  );
};
