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

interface SelectedDocument {
  dataUrl: string;
  name: string;
  contentType: string;
}

type GovernmentIdType = '' | "Driver's License" | 'National ID Card';

const readSelectedDocument = (file: File, allowPdf: boolean): Promise<SelectedDocument> => new Promise((resolve, reject) => {
  const allowedTypes = allowPdf
    ? ['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/gif']
    : ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
  if (!allowedTypes.includes(file.type) || file.size <= 0 || file.size > 5 * 1024 * 1024) {
    reject(new Error(allowPdf
      ? 'Select a PDF, JPEG, PNG, WebP, or GIF file up to 5 MB.'
      : 'Select a JPEG, PNG, WebP, or GIF image up to 5 MB.'));
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    const expectedMimeType = file.type === 'image/jpg' ? 'image/jpeg' : file.type;
    if (typeof reader.result !== 'string' || !reader.result.startsWith(`data:${expectedMimeType};base64,`)) {
      reject(new Error('Unable to read the selected document.'));
      return;
    }
    resolve({ dataUrl: reader.result, name: file.name, contentType: expectedMimeType });
  };
  reader.onerror = () => reject(new Error('Unable to read the selected document.'));
  reader.readAsDataURL(file);
});

export const VerifyIdentityView: React.FC<VerifyIdentityViewProps> = ({ user, restrictionType, onBack, onReviewTransactions, onSubmitted }) => {
  const [governmentIdType, setGovernmentIdType] = useState<GovernmentIdType>('');
  const [governmentIdFile, setGovernmentIdFile] = useState<SelectedDocument | null>(null);
  const [proofOfAddressFile, setProofOfAddressFile] = useState<SelectedDocument | null>(null);
  const [sourceDocument, setSourceDocument] = useState<SelectedDocument | null>(null);
  const [activityConfirmed, setActivityConfirmed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ type: 'error' | 'success'; text: string } | null>(null);
  const kycStatus = String(user.kycStatus || '').toUpperCase();

  const selectDocument = (
    event: ChangeEvent<HTMLInputElement>,
    setter: React.Dispatch<React.SetStateAction<SelectedDocument | null>>,
    allowPdf: boolean,
  ) => {
    const file = event.target.files?.[0];
    if (!file) return;
    void readSelectedDocument(file, allowPdf).then((document) => {
      setter(document);
      setMessage(null);
    }).catch((error: unknown) => {
      setter(null);
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to read the selected document.' });
    });
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (restrictionType === 'KYC' && (!governmentIdType || !governmentIdFile || !proofOfAddressFile)) {
      setMessage({ type: 'error', text: 'Choose a government ID type and attach both the ID and proof of address.' });
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
          : '/api/kyc/submit';
      const body = restrictionType === 'SECURITY'
        ? {}
        : restrictionType === 'SOURCE_OF_FUNDS'
          ? { documentData: sourceDocument?.dataUrl, documentName: sourceDocument?.name }
          : {
            governmentIdType,
            governmentIdUrl: governmentIdFile?.dataUrl,
            governmentIdMetadata: { name: governmentIdFile?.name, type: governmentIdFile?.contentType },
            addressProofUrl: proofOfAddressFile?.dataUrl,
            addressProofMetadata: { name: proofOfAddressFile?.name, type: proofOfAddressFile?.contentType },
          };
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify(body),
      });
      const result = await safeParseResponse<{
        user?: Pick<User, 'kycStatus' | 'rejectionReason' | 'kycSubmittedAt' | 'isRestricted' | 'restrictionType' | 'restrictionReviewStatus'>;
      }>(response);
      if (!result.ok) throw new Error(result.error || 'Unable to submit your identity documents.');
      onSubmitted({
        kycStatus: result.data.user?.kycStatus || 'PENDING_REVIEW',
        rejectionReason: '',
        kycSubmittedAt: result.data.user?.kycSubmittedAt,
        isRestricted: result.data.user?.isRestricted ?? user.isRestricted,
        restrictionType: result.data.user?.restrictionType || user.restrictionType,
        restrictionReviewStatus: result.data.user?.restrictionReviewStatus || 'pending',
        restrictionReviewReason: '',
      });
    } catch (error) {
      setMessage({ type: 'error', text: error instanceof Error ? error.message : 'Unable to submit your identity documents.' });
    } finally {
      setBusy(false);
    }
  };

  const documentFileInput = (
    label: string,
    accept: string,
    capture: boolean,
    document: SelectedDocument | null,
    setter: React.Dispatch<React.SetStateAction<SelectedDocument | null>>,
    allowPdf: boolean,
  ) => (
    <label className="block space-y-1 text-xs font-semibold text-slate-700">
      <span>{label}</span>
      <input
        type="file"
        accept={accept}
        {...(capture ? { capture: 'environment' as const } : {})}
        required={!document}
        disabled={busy}
        onChange={(event) => selectDocument(event, setter, allowPdf)}
        className="block w-full min-w-0 text-xs text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-xs file:font-semibold file:text-slate-800"
      />
    </label>
  );

  const documentPreview = (label: string, document: SelectedDocument | null) => (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 p-3">
      <p className="text-xs font-semibold text-slate-700">{label}</p>
      {document ? (
        <>
          {document.contentType === 'application/pdf'
            ? <iframe src={document.dataUrl} title={`Preview of ${document.name}`} className="mt-2 h-56 w-full rounded-md border border-slate-200 bg-white" />
            : <img src={document.dataUrl} alt={`Preview of ${document.name}`} className="mt-2 max-h-56 w-full rounded-md bg-white object-contain" />}
          <p className="mt-2 flex min-w-0 items-center gap-2 text-xs font-medium text-emerald-800"><FileImage aria-hidden="true" className="h-4 w-4 shrink-0" /><span className="truncate">{document.name}</span></p>
        </>
      ) : <p className="mt-2 text-xs text-slate-500">No file selected.</p>}
    </div>
  );

  const submitButton = (label: string) => (
    <button type="submit" disabled={busy || (restrictionType === 'KYC' && (!governmentIdType || !governmentIdFile || !proofOfAddressFile))} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-5 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto">
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
                onChange={(event) => selectDocument(event, setSourceDocument, true)}
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
              <section aria-labelledby="government-id-upload-heading" className="space-y-4 rounded-xl border border-slate-200 p-4">
                <div>
                  <h2 id="government-id-upload-heading" className="text-base font-semibold text-slate-900">Government-Issued ID</h2>
                  <label className="mt-3 block space-y-1.5 text-sm">
                    <span className="font-medium text-slate-700">Document Type <span className="text-rose-700">*</span></span>
                    <select
                      required
                      value={governmentIdType}
                      onChange={(event) => setGovernmentIdType(event.target.value as GovernmentIdType)}
                      disabled={busy}
                      className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="">Select a document type</option>
                      <option value="Driver's License">Driver’s License</option>
                      <option value="National ID Card">National ID Card</option>
                    </select>
                  </label>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {documentFileInput('Take Photo (Camera)', 'image/*', true, governmentIdFile, setGovernmentIdFile, false)}
                  {documentFileInput('Choose from Gallery', 'image/*,.pdf', false, governmentIdFile, setGovernmentIdFile, true)}
                </div>
                {documentPreview('Government-Issued ID Preview', governmentIdFile)}
              </section>
              <section aria-labelledby="address-proof-upload-heading" className="space-y-4 rounded-xl border border-slate-200 p-4">
                <div>
                  <h2 id="address-proof-upload-heading" className="text-base font-semibold text-slate-900">Proof of Address</h2>
                  <p className="mt-1 text-sm text-slate-600">Proof of Address (Utility Bill / Bank Statement)</p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {documentFileInput('Take Photo (Camera)', 'image/*', true, proofOfAddressFile, setProofOfAddressFile, false)}
                  {documentFileInput('Choose from Gallery / Files', 'image/*,.pdf', false, proofOfAddressFile, setProofOfAddressFile, true)}
                </div>
                {documentPreview('Proof of Address Preview', proofOfAddressFile)}
              </section>
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
