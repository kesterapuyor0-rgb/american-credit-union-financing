import React, { ChangeEvent, FormEvent, useState } from 'react';
import { ArrowLeft, FileImage, LoaderCircle, Upload } from 'lucide-react';
import { RestrictionType, User } from '../types';
import { getAuthHeaders, safeParseResponse } from '../utils/api';

interface VerifyIdentityViewProps {
  user: User;
  restrictionType: RestrictionType;
  onBack: () => void;
  onReviewTransactions: () => void;
  onSubmitted: (updates: Partial<User>) => void;
}

interface SelectedImage {
  dataUrl: string;
  name: string;
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
    resolve({ dataUrl: reader.result, name: file.name });
  };
  reader.onerror = () => reject(new Error('Unable to read the selected image.'));
  reader.readAsDataURL(file);
});

const readComplianceDocument = (file: File): Promise<SelectedImage> => new Promise((resolve, reject) => {
  if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
    reject(new Error('Select a PDF, JPEG, PNG, WebP, or GIF document up to 5 MB.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    if (typeof reader.result !== 'string' || !reader.result.startsWith(`data:${file.type};base64,`)) {
      reject(new Error('Unable to read the selected document.'));
      return;
    }
    resolve({ dataUrl: reader.result, name: file.name });
  };
  reader.onerror = () => reject(new Error('Unable to read the selected document.'));
  reader.readAsDataURL(file);
});

export const VerifyIdentityView: React.FC<VerifyIdentityViewProps> = ({ user, restrictionType, onBack, onReviewTransactions, onSubmitted }) => {
  const [governmentIdType, setGovernmentIdType] = useState<'' | 'Passport' | "Driver's License" | 'State ID'>('');
  const [governmentId, setGovernmentId] = useState<SelectedImage | null>(null);
  const [addressProof, setAddressProof] = useState<SelectedImage | null>(null);
  const [sourceDocument, setSourceDocument] = useState<SelectedImage | null>(null);
  const [activityConfirmed, setActivityConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const kycStatus = String(user.kycStatus || '').toUpperCase();

  const selectImage = (
    event: ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<SelectedImage | null>>,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void readImage(file).then((image) => {
      setter(image);
      setMessage(null);
    }).catch((error: unknown) => {
      setter(null);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to read the selected image.' });
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (restrictionType === 'KYC' && (!governmentIdType || !governmentId || !addressProof)) {
      setMessage({ type: 'error', text: 'Choose an ID type and upload both required documents.' });
      return;
    }
    if (restrictionType === 'SOURCE_OF_FUNDS' && !sourceDocument) {
      setMessage({ type: 'error', text: 'Upload proof of income or an invoice.' });
      return;
    }
    if (restrictionType === 'SECURITY' && !activityConfirmed) {
      setMessage({ type: 'error', text: 'Review the recent activity and confirm that you recognize it.' });
      return;
    }
    setBusy(true);
    setMessage(null);
    try {
      const endpoint = restrictionType === 'SECURITY'
        ? '/api/user/restriction-activity-confirmation'
        : restrictionType === 'SOURCE_OF_FUNDS'
          ? '/api/user/restriction-source-of-funds-document'
          : '/api/user/restriction-identity-documents';
      const body = restrictionType === 'SECURITY'
        ? {}
        : restrictionType === 'SOURCE_OF_FUNDS'
          ? { documentData: sourceDocument?.dataUrl, documentName: sourceDocument?.name }
          : {
            governmentIdType,
            governmentIdUrl: governmentId?.dataUrl,
            governmentIdMetadata: { name: governmentId?.name },
            addressProofUrl: addressProof?.dataUrl,
            addressProofMetadata: { name: addressProof?.name },
          };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = await safeParseResponse<{
        user?: Pick<User, 'kycStatus' | 'rejectionReason' | 'kycSubmittedAt' | 'isRestricted' | 'restrictionReviewStatus'>;
      }>(response);
      if (!result.ok) throw new Error(result.error || 'Unable to submit your identity documents.');
      onSubmitted({
        kycStatus: result.data.user?.kycStatus || 'PENDING_REVIEW',
        rejectionReason: '',
        kycSubmittedAt: result.data.user?.kycSubmittedAt,
        isRestricted: result.data.user?.isRestricted ?? user.isRestricted,
        restrictionReviewStatus: result.data.user?.restrictionReviewStatus || 'pending',
        restrictionReviewReason: '',
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to submit your identity documents.' });
    } finally {
      setBusy(false);
    }
  };

  const imageInput = (
    label: string,
    image: SelectedImage | null,
    setter: React.Dispatch<React.SetStateAction<SelectedImage | null>>,
  ) => (
    <label className="block min-w-0 space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
      <span className="font-semibold text-slate-800">{label} <span className="text-rose-700">*</span></span>
      <span className="block text-xs leading-5 text-slate-500">JPEG, PNG, WebP, or GIF · up to 5 MB</span>
      <input
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        required={!image}
        disabled={busy}
        onChange={(event) => selectImage(event, setter)}
        className="block w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-800"
      />
      {image && <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-emerald-800"><FileImage aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">{image.name}</span></span>}
    </label>
  );

  const submitButton = (label: string) => (
    <button type="submit" disabled={busy} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
      {busy ? <LoaderCircle aria-hidden="true" className="h-4 w-4 animate-spin" /> : <Upload aria-hidden="true" className="h-4 w-4" />}
      {busy ? 'Submitting…' : label}
    </button>
  );

  return (
    <section aria-labelledby="verify-identity-heading" className="mx-auto w-full max-w-3xl space-y-5">
      <button type="button" onClick={onBack} className="inline-flex min-h-10 items-center gap-2 rounded-lg px-3 text-sm font-semibold text-teal-900 hover:bg-teal-50">
        <ArrowLeft aria-hidden="true" className="h-4 w-4" />
        Back to dashboard
      </button>
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-7">
        <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Profile &amp; Settings</p>
        <h1 id="verify-identity-heading" className="mt-1 text-2xl font-bold text-slate-900">Identity Verification</h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">Upload a valid government-issued ID and proof of your current address. Your documents are securely submitted to our compliance team for review.</p>

        {kycStatus === 'PENDING_REVIEW' || kycStatus === 'PENDING' ? (
          <div role="status" className="mt-5 rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">
            <p className="font-semibold">Verification Under Review</p>
            <p className="mt-1">Your identity documents have been submitted and are currently being reviewed by our compliance team. Reviews typically take 1–2 business days.</p>
            <p className="mt-2 text-xs">Re-upload is unavailable while your documents are pending review.</p>
          </div>
        ) : kycStatus === 'APPROVED' ? (
          <div role="status" className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-900">
            Your identity has been successfully verified.
          </div>
        ) : restrictionType === 'SECURITY' ? (
          <form onSubmit={(event) => { void submit(event); }} className="mt-5 space-y-4">
            {kycStatus === 'REJECTED' && user.rejectionReason && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
                <p className="font-semibold">Verification Declined - Action Required</p>
                <p className="mt-1">{user.rejectionReason}</p>
              </div>
            )}
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
              Review your recent transactions. If you recognize the activity, confirm it below to send your account for a security review. Outgoing transfers and card actions remain paused until review is complete.
            </div>
            <button type="button" onClick={onReviewTransactions} className="min-h-10 rounded-lg border border-blue-300 bg-white px-4 py-2 text-sm font-semibold text-blue-900 hover:bg-blue-100">
              Review recent transactions
            </button>
            <label className="flex items-start gap-2 text-sm leading-5 text-slate-700">
              <input type="checkbox" checked={activityConfirmed} onChange={(event) => setActivityConfirmed(event.target.checked)} className="mt-1 h-4 w-4 accent-teal-800" />
              I have reviewed the recent activity and confirm that I recognize it.
            </label>
            {message && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{message.text}</p>}
            {submitButton('Confirm Activity')}
          </form>
        ) : restrictionType === 'SOURCE_OF_FUNDS' ? (
          <form onSubmit={(event) => { void submit(event); }} className="mt-5 space-y-4">
            {kycStatus === 'REJECTED' && user.rejectionReason && (
              <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
                <p className="font-semibold">Verification Declined - Action Required</p>
                <p className="mt-1">{user.rejectionReason}</p>
              </div>
            )}
            <label className="block space-y-2 rounded-xl border border-slate-200 bg-white p-4 text-sm">
              <span className="font-semibold text-slate-800">Proof of income or incoming-transfer invoice <span className="text-rose-700">*</span></span>
              <span className="block text-xs leading-5 text-slate-500">PDF, JPEG, PNG, WebP, or GIF · up to 5 MB</span>
              <input
                type="file"
                accept="application/pdf,image/jpeg,image/png,image/webp,image/gif"
                required={!sourceDocument}
                disabled={busy}
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  if (!file) return;
                  void readComplianceDocument(file).then(setSourceDocument).catch((error: unknown) => {
                    setSourceDocument(null);
                    setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to read the selected document.' });
                  });
                }}
                className="block w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-800"
              />
              {sourceDocument && <span className="flex min-w-0 items-center gap-2 text-xs font-medium text-emerald-800"><FileImage aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">{sourceDocument.name}</span></span>}
            </label>
            {message && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{message.text}</p>}
            {submitButton(kycStatus === 'REJECTED' ? 'Re-upload Requirements' : 'Submit Documentation')}
          </form>
        ) : (
          <>
            {kycStatus === 'REJECTED' && user.rejectionReason && (
              <div role="alert" className="mt-5 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900">
                <p className="font-semibold">Verification Declined - Action Required</p>
                <p className="mt-1">{user.rejectionReason}</p>
                <p className="mt-2">Please upload updated documents below.</p>
              </div>
            )}
            <form onSubmit={(event) => { void submit(event); }} className="mt-5 space-y-4">
              <label className="block space-y-2 text-sm">
                <span className="font-semibold text-slate-800">Government-issued ID type <span className="text-rose-700">*</span></span>
                <select
                  required
                  value={governmentIdType}
                  onChange={(event) => setGovernmentIdType(event.target.value as typeof governmentIdType)}
                  disabled={busy}
                  className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="">Select an ID type</option>
                  <option value="Passport">Passport</option>
                  <option value="Driver's License">Driver’s License</option>
                  <option value="State ID">State ID</option>
                </select>
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {imageInput('Government-issued ID', governmentId, setGovernmentId)}
                {imageInput('Proof of address', addressProof, setAddressProof)}
              </div>
              {message && <p role="alert" className="rounded-lg bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{message.text}</p>}
              {submitButton(kycStatus === 'REJECTED' ? 'Re-upload Requirements' : 'Submit identity documents')}
            </form>
          </>
        )}
        {message?.type === 'success' && <p role="status" className="mt-4 rounded-lg bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{message.text}</p>}
      </div>
    </section>
  );
};
