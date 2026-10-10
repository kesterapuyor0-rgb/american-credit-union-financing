import React, { ChangeEvent, FormEvent, useEffect, useState } from 'react';
import { CheckCircle2, HandCoins, RefreshCw, Upload } from 'lucide-react';
import { GrantApplication, GrantStatus, User } from '../types';
import { getAuthHeaders } from '../utils/api';

const GRANT_CATEGORIES = [
  'Small Business Expansion',
  'Community Project',
  'Tech/Innovation',
  'Emergency Business Relief',
] as const;

const GRANT_STATUS_STYLES: Record<GrantStatus, string> = {
  'PENDING REVIEW': 'border-amber-200 bg-amber-50 text-amber-900',
  'UNDER COMMITTEE EVALUATION': 'border-blue-200 bg-blue-50 text-blue-900',
  APPROVED: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  DISBURSED: 'border-teal-200 bg-teal-50 text-teal-900',
  REJECTED: 'border-rose-200 bg-rose-50 text-rose-900',
};

interface GrantApplicationViewProps {
  user: User;
}

interface GrantFormData {
  businessName: string;
  category: string;
  requestedAmount: string;
  purpose: string;
  implementationPlan: string;
  projectedTimeline: string;
}

interface GrantDocument {
  data: string;
  name: string;
  contentType: string;
}

export const GrantApplicationView: React.FC<GrantApplicationViewProps> = ({ user }) => {
  const [applications, setApplications] = useState<GrantApplication[]>([]);
  const [form, setForm] = useState<GrantFormData>({
    businessName: '',
    category: GRANT_CATEGORIES[0],
    requestedAmount: '',
    purpose: '',
    implementationPlan: '',
    projectedTimeline: '',
  });
  const [document, setDocument] = useState<GrantDocument | null>(null);
  const [loadingApplications, setLoadingApplications] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadApplications = async (showLoading = true) => {
    if (showLoading) {
      setLoadingApplications(true);
      setError(null);
    }
    try {
      const response = await fetch('/api/grants/user', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to load grant applications.');
      setApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load grant applications.');
    } finally {
      if (showLoading) setLoadingApplications(false);
    }
  };

  useEffect(() => {
    void loadApplications();
    const refreshTimer = window.setInterval(() => void loadApplications(false), 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [user.id]);

  const handleDocumentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['application/pdf', 'image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setError('Upload a PDF, JPEG, PNG, or WebP supporting document.');
      return;
    }
    if (file.size <= 0 || file.size > 5 * 1024 * 1024) {
      setError('Choose a supporting document smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') {
        setError('Unable to read the selected document.');
        return;
      }
      setDocument({ data: reader.result, name: file.name, contentType: file.type });
      setError(null);
    };
    reader.onerror = () => setError('Unable to read the selected document.');
    reader.readAsDataURL(file);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!document) {
      setError('Attach a business plan, financial plan, or project proposal to continue.');
      return;
    }
    const amount = Number(form.requestedAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 5_000_000) {
      setError('Enter a grant amount greater than $0 and no more than $5,000,000.');
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      const response = await fetch('/api/grants/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          ...form,
          requestedAmount: amount,
          documentBase64: document.data,
          documentName: document.name,
          documentContentType: document.contentType,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to submit your grant application.');
      setApplications((current) => [data.application, ...current]);
      setForm({
        businessName: '',
        category: GRANT_CATEGORIES[0],
        requestedAmount: '',
        purpose: '',
        implementationPlan: '',
        projectedTimeline: '',
      });
      setDocument(null);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit your grant application.');
    } finally {
      setSubmitting(false);
    }
  };

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
  }).format(amount);

  const isActiveApplication = (application: GrantApplication) => {
    const status = application.status.toUpperCase().replace(/[_-]+/g, ' ').trim();
    return ['PENDING', 'PENDING REVIEW', 'UNDER REVIEW', 'UNDER COMMITTEE EVALUATION', 'APPROVED'].includes(status);
  };
  const activeApplication = applications.find(isActiveApplication);
  const latestRejectedApplication = applications.find((application) =>
    application.status.toUpperCase().replace(/[_-]+/g, ' ').trim() === 'REJECTED'
  );

  if (loadingApplications && applications.length === 0) {
    return <p role="status" className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white p-5 text-sm text-slate-600">Loading your grant application status…</p>;
  }

  if (error && applications.length === 0) {
    return (
      <section className="mx-auto max-w-3xl space-y-3">
        <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>
        <button type="button" onClick={() => void loadApplications()} disabled={loadingApplications} className="rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:opacity-60">
          Try again
        </button>
      </section>
    );
  }

  if (activeApplication) {
    const normalizedStatus = activeApplication.status.toUpperCase().replace(/[_-]+/g, ' ').trim();
    const displayStatus = normalizedStatus === 'PENDING' ? 'PENDING REVIEW'
      : normalizedStatus === 'UNDER REVIEW' ? 'UNDER COMMITTEE EVALUATION'
        : normalizedStatus;
    const statusStyle = GRANT_STATUS_STYLES[activeApplication.status] || GRANT_STATUS_STYLES['PENDING REVIEW'];

    return (
      <section className="mx-auto w-full max-w-3xl">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="bg-gradient-to-r from-[#102a50] to-teal-900 p-5 text-white sm:p-7">
            <div className="flex items-start gap-3">
              <HandCoins aria-hidden="true" className="mt-1 h-7 w-7 shrink-0 text-amber-300" />
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Business & Community Grant Program</p>
                <h1 className="mt-1 text-xl font-bold tracking-tight sm:text-2xl">
                  {displayStatus === 'APPROVED' ? 'Grant Application Status Tracker' : 'Grant Application Under Review'}
                </h1>
                <p className="mt-2 text-sm leading-6 text-blue-50">
                  Your application is being handled by our Member Services Grant Committee.
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-4 sm:p-6">
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}
            <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200">
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Business / project</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">{activeApplication.businessName}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Amount requested</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">{formatMoney(activeApplication.requestedAmount)}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Category</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">{activeApplication.category}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Submission date</dt>
                <dd className="text-right text-sm font-semibold text-slate-900">{new Date(activeApplication.submittedAt).toLocaleDateString()}</dd>
              </div>
              <div className="flex justify-between gap-4 px-4 py-3">
                <dt className="text-sm text-slate-500">Current status</dt>
                <dd className="text-right"><span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${statusStyle}`}>{displayStatus}</span></dd>
              </div>
            </dl>

            {displayStatus === 'APPROVED' && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">
                <h2 className="font-semibold">Official grant award notice</h2>
                <p className="mt-1">
                  Your application has been approved for {formatMoney(activeApplication.approvedAmount || 0)}.
                  {activeApplication.adminNotes ? ` ${activeApplication.adminNotes}` : ' The award is approved and awaiting disbursement.'}
                </p>
              </div>
            )}

            <p className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-sm leading-6 text-blue-950">
              For inquiries, contact{' '}
              <a className="font-semibold underline" href="mailto:americancreditunion.financing@gmail.com">americancreditunion.financing@gmail.com</a>.
            </p>
          </div>
        </article>
      </section>
    );
  }

  return (
    <section className="mx-auto w-full max-w-5xl space-y-6">
      <header className="rounded-2xl bg-gradient-to-r from-[#102a50] to-teal-900 p-5 text-white shadow-sm sm:p-7">
        <div className="flex items-start gap-3">
          <HandCoins aria-hidden="true" className="mt-1 h-7 w-7 shrink-0 text-amber-300" />
          <div>
            <p className="text-xs font-bold uppercase tracking-wider text-amber-200">Business & Community Grant Program</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">Grants & Business Support</h1>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-blue-50">
              Apply for funding that supports small business growth, community investment, and projects that strengthen local economic opportunity.
            </p>
          </div>
        </div>
      </header>

      {latestRejectedApplication && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-950">
          <p className="font-semibold">Application Not Approved: {latestRejectedApplication.rejectionReason || 'No specific reason was provided.'}</p>
          <p className="mt-1">You may submit a new application below.</p>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-900">{error}</p>}

      <form onSubmit={handleSubmit} className="space-y-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Grant application</h2>
            <p className="mt-1 text-sm text-slate-600">Share how the funding will support your business or community project.</p>
          </div>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>Grant category</span>
            <select value={form.category} onChange={(event) => setForm((current) => ({ ...current, category: event.target.value }))} className="min-h-11 w-full rounded-lg border border-slate-200 bg-white px-3">
              {GRANT_CATEGORIES.map((category) => <option key={category}>{category}</option>)}
            </select>
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              <span>Requested amount (USD)</span>
              <input type="number" min="0.01" max="5000000" step="0.01" required value={form.requestedAmount} onChange={(event) => setForm((current) => ({ ...current, requestedAmount: event.target.value }))} placeholder="0.00" className="min-h-11 w-full rounded-lg border border-slate-200 px-3" />
            </label>
            <label className="block space-y-1 text-sm font-medium text-slate-700">
              <span>Business / project name</span>
              <input type="text" maxLength={120} required value={form.businessName} onChange={(event) => setForm((current) => ({ ...current, businessName: event.target.value }))} className="min-h-11 w-full rounded-lg border border-slate-200 px-3" />
            </label>
          </div>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>Project description, purpose of funds, and expected community or economic impact</span>
            <textarea required maxLength={3000} rows={4} value={form.purpose} onChange={(event) => setForm((current) => ({ ...current, purpose: event.target.value }))} className="w-full rounded-lg border border-slate-200 p-3" />
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>Projected timeline</span>
            <input required maxLength={200} value={form.projectedTimeline} onChange={(event) => setForm((current) => ({ ...current, projectedTimeline: event.target.value }))} placeholder="For example, 6 months beginning January 2027" className="min-h-11 w-full rounded-lg border border-slate-200 px-3" />
          </label>
          <label className="block space-y-1 text-sm font-medium text-slate-700">
            <span>Implementation plan</span>
            <textarea required maxLength={3000} rows={3} value={form.implementationPlan} onChange={(event) => setForm((current) => ({ ...current, implementationPlan: event.target.value }))} placeholder="Describe milestones and how the funds will be used." className="w-full rounded-lg border border-slate-200 p-3" />
          </label>
          <div>
            <label htmlFor="grant-supporting-document" className="block space-y-1 text-sm font-medium text-slate-700">
              <span>Supporting document (PDF or image, up to 5 MB)</span>
              <span className="flex min-h-12 cursor-pointer items-center gap-2 rounded-lg border border-dashed border-slate-300 px-3 text-sm text-slate-600 hover:bg-slate-50">
                <Upload aria-hidden="true" className="h-4 w-4" />
                {document?.name || 'Choose a business plan, financial plan, or project proposal'}
              </span>
            </label>
            <input id="grant-supporting-document" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" required={!document} onChange={handleDocumentChange} className="sr-only" />
          </div>
          <button type="submit" disabled={submitting} className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-60">
            {submitting ? <><RefreshCw aria-hidden="true" className="h-4 w-4 animate-spin" /> Submitting…</> : 'Submit Grant Application'}
          </button>
      </form>
    </section>
  );
};
