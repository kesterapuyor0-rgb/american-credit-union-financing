import React, { useState, useEffect } from 'react';
import { User, AuditLog, AdminOverviewData, UserWithAccounts, BankAccount, Transaction, CardApplication, BankCard } from '../types';
import { getStoredAuthToken } from '../utils/api';
import { formatTransactionDescription } from '../utils/transactionFormatting';
import {
  ShieldAlert,
  Search,
  DollarSign,
  PlusCircle,
  MinusCircle,
  AlertTriangle,
  History,
  Users,
  CheckCircle2,
  RefreshCw,
  Sliders,
  FileSpreadsheet,
  Lock,
  ArrowDownCircle,
  ArrowUpCircle,
  LogOut
} from 'lucide-react';

interface AdminViewProps {
  user: User;
  token: string;
  onSignOut: () => void;
}

interface VerificationApplicant {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  created_at: string;
  verification_status: 'under_review' | 'approved' | 'rejected';
  verification_rejection_reason?: string;
  verificationDocument?: User['verificationDocument'];
  documentUrl?: string;
  verification_submission?: {
    verificationNumber?: string;
    sampleFileName?: string;
    sampleFileType?: string;
    sampleFileSize?: number;
    submittedAt?: string;
  };
}

const CARD_COLOR_OPTIONS = ['emerald', 'navy', 'crimson', 'gold'] as const;

const getVerificationDocumentUrl = (
  document?: User['verificationDocument'],
  documentUrl?: string,
  fallbackContentType?: string,
): string | null => {
  const data = document?.data?.trim();
  if (data && /^data:image\/(jpeg|png|webp|gif);base64,/i.test(data)) return data;

  const contentType = (document?.contentType || fallbackContentType || '').trim().toLowerCase();
  if (data && /^image\/(jpeg|png|webp|gif)$/.test(contentType)) {
    return `data:${contentType};base64,${data}`;
  }

  const path = documentUrl?.trim();
  if (path && (/^https?:\/\/[^\s]+$/i.test(path) || (path.startsWith('/') && !path.startsWith('//')))) {
    return path;
  }
  return null;
};

export const AdminView: React.FC<AdminViewProps> = ({ user, token, onSignOut }) => {
const [activeTab, setActiveTab] = useState<'users' | 'pending' | 'verifications' | 'cards' | 'audit' | 'transactions'>('users');
  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [users, setUsers] = useState<UserWithAccounts[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [pendingDeposits, setPendingDeposits] = useState<Transaction[]>([]);
  const [cardApplications, setCardApplications] = useState<CardApplication[]>([]);
  const [verificationApplicants, setVerificationApplicants] = useState<VerificationApplicant[]>([]);
  const [verificationStatusEdits, setVerificationStatusEdits] = useState<Record<string, { status: VerificationApplicant['verification_status']; reason: string }>>({});
  const [savingVerificationId, setSavingVerificationId] = useState<string | null>(null);
  const [issuedCards, setIssuedCards] = useState<BankCard[]>([]);
  const [savingCardColorId, setSavingCardColorId] = useState<string | null>(null);
  const [cardColorError, setCardColorError] = useState<string | null>(null);
  const [cardToDebit, setCardToDebit] = useState<BankCard | null>(null);
  const [cardDebitAmount, setCardDebitAmount] = useState('');
  const [cardDebitReason, setCardDebitReason] = useState('');
  const [submittingCardDebit, setSubmittingCardDebit] = useState(false);
  const [cardReviewReasons, setCardReviewReasons] = useState<Record<string, string>>({});
  const [reviewingCardId, setReviewingCardId] = useState<string | null>(null);
  const [allTransactions, setAllTransactions] = useState<Transaction[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [restrictionEdits, setRestrictionEdits] = useState<Record<string, { isRestricted: boolean; restrictionReason: string }>>({});
  const [savingRestrictionId, setSavingRestrictionId] = useState<string | null>(null);
  const [restrictionError, setRestrictionError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Pending Deposits Processing State
  const [approvingDepositId, setApprovingDepositId] = useState<string | null>(null);
  const [transactionReviewReasons, setTransactionReviewReasons] = useState<Record<string, string>>({});

  // Adjustment Modal State
  const [adjustModalOpen, setAdjustModalOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<BankAccount | null>(null);
  const [targetAccountOwner, setTargetAccountOwner] = useState<string>('');
  const [adjustAction, setAdjustAction] = useState<'credit' | 'debit' | 'hold' | 'release'>('credit');
  const [adjustAmount, setAdjustAmount] = useState<string>('');
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [submittingAdjustment, setSubmittingAdjustment] = useState(false);

  // Admin Fund Injection Feature State
  const [creditModalOpen, setCreditModalOpen] = useState(false);
  const [creditAccountId, setCreditAccountId] = useState('');
  const [creditAmount, setCreditAmount] = useState('');
  const [creditMemo, setCreditMemo] = useState('');
  const [submittingCredit, setSubmittingCredit] = useState(false);

  const activeToken = token || getStoredAuthToken();

  const fetchOverview = async () => {
    try {
      const res = await fetch('/api/admin/overview', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load Member Services overview');
      const data = await res.json();
      setOverview(data.overview);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchUsers = async () => {
    setLoading(true);
    try {
      const url = searchQuery.trim()
        ? `/api/admin/users?search=${encodeURIComponent(searchQuery.trim())}`
        : '/api/admin/users';
      const res = await fetch(url, {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load user accounts');
      const data = await res.json();
      const loadedUsers: UserWithAccounts[] = data.users || [];
      setUsers(loadedUsers);
      setRestrictionEdits(Object.fromEntries(loadedUsers.map((loadedUser) => [
        loadedUser.id,
        {
          isRestricted: loadedUser.isRestricted === true,
          restrictionReason: loadedUser.restrictionReason || '',
        },
      ])));
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const saveUserRestriction = async (targetUser: UserWithAccounts) => {
    const edit = restrictionEdits[targetUser.id] || {
      isRestricted: targetUser.isRestricted === true,
      restrictionReason: targetUser.restrictionReason || '',
    };
    if (edit.isRestricted && !edit.restrictionReason.trim()) {
      setRestrictionError('Enter a restriction reason before saving.');
      return;
    }

    setSavingRestrictionId(targetUser.id);
    setRestrictionError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(targetUser.id)}/restriction`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify(edit),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to update account restriction.');

      setUsers((currentUsers) => currentUsers.map((currentUser) =>
        currentUser.id === targetUser.id
          ? { ...currentUser, ...data.user }
          : currentUser
      ));
      setRestrictionEdits((current) => ({
        ...current,
        [targetUser.id]: {
          isRestricted: data.user.isRestricted === true,
          restrictionReason: data.user.restrictionReason || '',
        },
      }));
      setSuccessMsg(`Account restriction updated for ${targetUser.full_name}.`);
    } catch (err) {
      setRestrictionError(err instanceof Error ? err.message : 'Unable to update account restriction.');
    } finally {
      setSavingRestrictionId(null);
    }
  };

  const fetchPendingDeposits = async () => {
    try {
      const res = await fetch('/api/admin/pending-deposits', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load pending deposits');
      const data = await res.json();
      const deposits = Array.isArray(data.pendingDeposits) ? data.pendingDeposits : [];
      setPendingDeposits(deposits);
    } catch (err: any) {
      console.error(err);
      setError(err.message);
    }
  };

  const fetchCardApplications = async () => {
    try {
      const res = await fetch('/api/admin/card-applications', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load card applications.');
      const data = await res.json();
      setCardApplications(Array.isArray(data.applications) ? data.applications : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load card applications.');
    }
  };

  const fetchVerificationApplicants = async () => {
    try {
      const res = await fetch('/api/admin/verifications', {
        headers: activeToken ? { Authorization: 'Bearer ' + activeToken } : {},
        credentials: 'include',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load enrollment records.');
      const applicants: VerificationApplicant[] = Array.isArray(data.applicants) ? data.applicants : [];
      setVerificationApplicants(applicants);
      setVerificationStatusEdits(Object.fromEntries(applicants.map((applicant) => [
        applicant.id,
        {
          status: applicant.verification_status,
          reason: applicant.verification_rejection_reason || '',
        },
      ])));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load enrollment records.');
    }
  };

  const saveVerificationStatus = async (applicant: VerificationApplicant) => {
    const edit = verificationStatusEdits[applicant.id] || {
      status: applicant.verification_status,
      reason: applicant.verification_rejection_reason || '',
    };
    const reason = edit.reason.trim();
    if (edit.status === 'rejected' && !reason) {
      setError('Enter a reason before rejecting an enrollment.');
      return;
    }
    setSavingVerificationId(applicant.id);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(applicant.id)}/verification-status`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: 'Bearer ' + activeToken } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ verificationStatus: edit.status, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to update enrollment status.');
      setVerificationApplicants((current) => current.map((currentApplicant) =>
        currentApplicant.id === applicant.id
          ? { ...currentApplicant, ...data.user }
          : currentApplicant
      ));
      setVerificationStatusEdits((current) => ({
        ...current,
        [applicant.id]: {
          status: data.user.verification_status,
          reason: data.user.verification_rejection_reason || '',
        },
      }));
      setSuccessMsg(`${data.user.full_name} enrollment status set to ${data.user.verification_status.replace('_', ' ')}.`);
      await Promise.all([fetchUsers(), fetchOverview(), fetchAuditLogs()]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to update enrollment status.');
    } finally {
      setSavingVerificationId(null);
    }
  };

  const fetchIssuedCards = async () => {
    try {
      const res = await fetch('/api/admin/cards', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load issued cards.');
      const data = await res.json();
      setIssuedCards(Array.isArray(data.cards) ? data.cards : []);
    } catch (err: any) {
      setError(err.message || 'Failed to load issued cards.');
    }
  };

  const updateCardColor = async (card: BankCard, cardColor: NonNullable<BankCard['cardColor']>) => {
    setSavingCardColorId(card.id);
    setCardColorError(null);
    setSuccessMsg(null);
    try {
      const res = await fetch(`/api/admin/cards/${encodeURIComponent(card.id)}/color`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ cardColor }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to update card color.');
      setIssuedCards((currentCards) => currentCards.map((currentCard) =>
        currentCard.id === card.id ? { ...currentCard, cardColor: data.card.cardColor } : currentCard
      ));
      setSuccessMsg(`Updated ${card.product_name} color to ${cardColor}.`);
    } catch (err) {
      setCardColorError(err instanceof Error ? err.message : 'Unable to update card color.');
    } finally {
      setSavingCardColorId(null);
    }
  };

  const fetchAuditLogs = async () => {
    try {
      const res = await fetch('/api/admin/audit-logs', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load audit logs');
      const data = await res.json();
      setAuditLogs(data.logs || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  const fetchTransactions = async () => {
    try {
      const res = await fetch('/api/admin/transactions', {
        headers: activeToken ? { Authorization: `Bearer ${activeToken}` } : {},
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Failed to load system transactions');
      const data = await res.json();
      setAllTransactions(data.transactions || []);
    } catch (err: any) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchOverview();
    fetchUsers();
    fetchAuditLogs();
    fetchTransactions();
    fetchPendingDeposits();
    fetchCardApplications();
    fetchVerificationApplicants();
    fetchIssuedCards();
  }, []);

  const handleCardDecision = async (applicationId: string, decision: 'approve' | 'reject') => {
    const reason = String(cardReviewReasons[applicationId] || '').trim();
    if (!reason) {
      setError('Enter a review reason before approving or rejecting a card application.');
      return;
    }
    setReviewingCardId(applicationId);
    setError(null);
    try {
      const res = await fetch('/api/admin/card-applications/decision', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ applicationId, decision, reason }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to review card application.');
      setSuccessMsg(decision === 'approve' ? 'Card application approved and card activated.' : 'Card application rejected.');
      await Promise.all([fetchCardApplications(), fetchIssuedCards(), fetchUsers(), fetchOverview(), fetchAuditLogs()]);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      setError(err.message || 'Unable to review card application.');
    } finally {
      setReviewingCardId(null);
    }
  };

  const handleCardDebit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!cardToDebit || !cardDebitReason.trim() || Number(cardDebitAmount) <= 0) return;
    setSubmittingCardDebit(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/cards/${encodeURIComponent(cardToDebit.id)}/debit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({ amount: Number(cardDebitAmount), reason: cardDebitReason.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Unable to record card debit.');
      setSuccessMsg('Card debit recorded against the linked checking ledger.');
      setCardToDebit(null);
      setCardDebitAmount('');
      setCardDebitReason('');
      await Promise.all([fetchIssuedCards(), fetchUsers(), fetchOverview(), fetchAuditLogs(), fetchTransactions()]);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      setError(err.message || 'Unable to record card debit.');
    } finally {
      setSubmittingCardDebit(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const openAdjustment = (account: BankAccount, ownerName: string) => {
    setSelectedAccount(account);
    setTargetAccountOwner(ownerName);
    setAdjustAction('credit');
    setAdjustAmount('');
    setAdjustReason('');
    setAdjustModalOpen(true);
    setError(null);
  };

  const openCreditModal = (account?: BankAccount, ownerName?: string) => {
    if (account) {
      setCreditAccountId(account.id);
    } else {
      const firstAcc = users.flatMap((u) => u.accounts || [])[0];
      setCreditAccountId(firstAcc?.id || '');
    }
    setCreditAmount('');
    setCreditMemo('Member Services Account Credit');
    setCreditModalOpen(true);
    setError(null);
  };

  const handleProcessCreditUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = parseFloat(creditAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid credit amount greater than $0.00 USD.');
      return;
    }

    if (!creditAccountId) {
      setError('Please select a customer account to credit.');
      return;
    }

    if (!creditMemo.trim()) {
      setError('A transaction memo / description is required.');
      return;
    }

    setSubmittingCredit(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/balance-adjustment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          accountId: creditAccountId,
          amount: parsed,
          action: 'credit',
          reason: creditMemo.trim(),
          token: activeToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || 'Failed to process customer credit injection.');
      }

      setSuccessMsg(data.message || `Successfully credited $${parsed.toFixed(2)} to customer account.`);
      setCreditModalOpen(false);
      fetchUsers();
      fetchOverview();
      fetchAuditLogs();
      fetchTransactions();
    } catch (err: any) {
      console.error('Error in handleProcessCreditUser:', err);
      setError(err.message || 'Error processing credit to customer account.');
    } finally {
      setSubmittingCredit(false);
    }
  };

  const handleProcessAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAccount) return;

    const parsed = parseFloat(adjustAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setError('Please enter a valid amount greater than $0.00 USD.');
      return;
    }

    if (!adjustReason.trim()) {
      setError('A regulatory reason / justification is required for balance adjustments.');
      return;
    }

    setSubmittingAdjustment(true);
    setError(null);

    try {
      const res = await fetch('/api/admin/balance-adjustment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          accountId: selectedAccount.id,
          action: adjustAction,
          amount: parsed,
          reason: adjustReason.trim(),
          token: activeToken,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Adjustment failed');
      }

      setSuccessMsg(data.message);
      setAdjustModalOpen(false);
      // Refresh state
      fetchOverview();
      fetchUsers();
      fetchAuditLogs();
      fetchTransactions();

      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setSubmittingAdjustment(false);
    }
  };

  const handleReviewTransaction = async (transaction: Transaction, decision: 'approve' | 'reject') => {
    const reason = String(transactionReviewReasons[transaction.id] || '').trim();
    if (!reason) {
      setError('Enter a reason before approving or rejecting this transaction.');
      return;
    }
    setApprovingDepositId(transaction.id);
    setError(null);

    try {
      const res = await fetch('/api/admin/transactions/review', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
          },
          credentials: 'include',
          body: JSON.stringify({
            transactionId: transaction.id,
            decision,
            reason,
            token: activeToken,
          }),
        });

        const data = await res.json();
        if (!res.ok) {
          throw new Error(data?.error || 'Failed to review transaction.');
        }

      setSuccessMsg(`Transaction ${decision === 'approve' ? 'approved' : 'rejected'}.`);
      await Promise.all([
        fetchPendingDeposits(),
        fetchOverview(),
        fetchUsers(),
        fetchAuditLogs(),
        fetchTransactions(),
      ]);
      setTimeout(() => setSuccessMsg(null), 6000);
    } catch (err: any) {
      console.error('Error reviewing transaction:', err);
      setError(err.message || 'Failed to review transaction.');
    } finally {
      setApprovingDepositId(null);
    }
  };

  const formatUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  return (
    <div className="space-y-6">
      {/* Member Services Operations Banner */}
      <div className="bg-[#1E293B] text-white p-5 rounded-xs shadow-xs border border-slate-700 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-[#D6A832] rounded-xs text-white">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <div>
            <div className="text-xs text-red-400 font-bold uppercase tracking-wider">
              Restricted Operations Area
            </div>
            <h1 className="text-xl font-bold font-serif text-white">
              American Credit Union Financing · Member Services Operations
            </h1>
            <p className="text-xs text-slate-300">
              Authorized Member Services Specialist: <span className="font-mono text-white">{user.email}</span> | MongoDB Atlas Storage
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => {
              fetchOverview();
                fetchUsers();
                fetchAuditLogs();
                fetchTransactions();
                fetchPendingDeposits();
                fetchCardApplications();
              }}
              disabled={loading}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-600 rounded text-xs text-white font-medium flex items-center gap-1.5 cursor-pointer"
          >
              <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Ledger</span>
          </button>
          <button type="button" onClick={onSignOut} className="flex items-center gap-1.5 rounded border border-slate-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700">
            <LogOut className="h-3.5 w-3.5" /> Sign Out
          </button>
        </div>
      </div>

      {/* Metrics Row */}
      {overview && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
            <div className="text-xs text-gray-500 font-medium">Total Registered Users</div>
            <div className="text-2xl font-bold text-[#173B70] font-serif mt-1">
              {overview.totalUsers}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Consumer & Business Profiles</div>
          </div>

          <div className="bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
            <div className="text-xs text-gray-500 font-medium">Total Deposits (USD)</div>
            <div className="text-2xl font-bold text-emerald-700 font-serif mt-1">
              {formatUSD(overview.totalDepositsUSD)}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Across all checking & savings</div>
          </div>

          <div className="bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
            <div className="text-xs text-gray-500 font-medium">Total Accounts Hosted</div>
            <div className="text-2xl font-bold text-gray-900 font-serif mt-1">
              {overview.totalAccounts}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Active bank accounts</div>
          </div>

          <div className="bg-white p-4 border border-gray-200 rounded-sm shadow-sm">
            <div className="text-xs text-gray-500 font-medium">Audited Actions</div>
            <div className="text-2xl font-bold text-[#D6A832] font-serif mt-1">
              {overview.totalAuditLogs}
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">Immutable audit events</div>
          </div>
        </div>
      )}

      {/* Success Alert */}
      {successMsg && (
        <div className="p-4 bg-emerald-50 border-l-4 border-emerald-600 text-emerald-900 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
          <span className="font-medium">{successMsg}</span>
        </div>
      )}

      {/* Admin Tabs */}
      <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
        <div className="border-b border-gray-200 bg-[#F8F9FA] px-4 py-2 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('users')}
              className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                activeTab === 'users'
                  ? 'bg-[#173B70] text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Manage Customer Balances ({users.reduce((acc, u) => acc + (u.accounts?.length || 0), 0)} Accounts)
            </button>
              <button
                onClick={() => {
                  setActiveTab('pending');
                  fetchPendingDeposits();
                }}
                className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                  activeTab === 'pending'
                    ? 'bg-[#D6A832] text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Pending Transactions ({pendingDeposits.length})
              </button>
              <button
                onClick={() => {
                  setActiveTab('verifications');
                  fetchVerificationApplicants();
                }}
                className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                  activeTab === 'verifications'
                    ? 'bg-[#173B70] text-white'
                    : 'text-gray-700 hover:bg-gray-200'
                }`}
              >
                Enrollment review ({verificationApplicants.filter((applicant) => applicant.verification_status === 'under_review').length} pending)
              </button>
            <button
              onClick={() => {
                setActiveTab('cards');
                fetchCardApplications();
              }}
              className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                activeTab === 'cards'
                  ? 'bg-[#173B70] text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Card applications ({cardApplications.filter((application) => application.status === 'Pending').length})
            </button>
            <button
              onClick={() => setActiveTab('audit')}
              className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                activeTab === 'audit'
                  ? 'bg-[#173B70] text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              Transaction Audit Logs ({auditLogs.length})
            </button>
            <button
              onClick={() => setActiveTab('transactions')}
              className={`px-3 py-1.5 rounded-sm transition-colors cursor-pointer ${
                activeTab === 'transactions'
                  ? 'bg-[#173B70] text-white'
                  : 'text-gray-700 hover:bg-gray-200'
              }`}
            >
              System Transactions Master ({allTransactions.length})
            </button>
          </div>
        </div>

        {/* TAB 1: MANAGE CUSTOMER BALANCES */}
        {activeTab === 'users' && (
          <div className="p-5">
            {/* Header: Manage Customer Balances Panel */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-[#173B70] font-serif flex items-center gap-2">
                  <Users className="w-4 h-4 text-[#173B70]" />
                  <span>Manage Customer Balances</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">
                  Review registered customers, process account funding adjustments, and manage ledger balances with complete audit tracking.
                </p>
              </div>

              <button
                id="btn-admin-credit-customer-modal"
                type="button"
                onClick={() => openCreditModal()}
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#D6A832] hover:bg-[#AD841B] text-white font-bold text-xs uppercase tracking-wider rounded-xs shadow-xs transition-colors cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Funds / Credit Account</span>
              </button>
            </div>

            {/* Search Bar */}
            <form onSubmit={handleSearch} className="flex gap-2 max-w-lg mb-5">
              <div className="relative flex-1">
                <Search className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  id="admin-search-accounts"
                  type="text"
                  placeholder="Search by customer name, email, or account number..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#173B70] outline-hidden"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 bg-[#173B70] text-white text-xs font-semibold rounded-xs hover:bg-[#245B9E] cursor-pointer"
              >
                Search
              </button>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setTimeout(() => fetchUsers(), 50);
                  }}
                  className="px-3 py-2 bg-gray-100 text-gray-600 text-xs rounded-xs hover:bg-gray-200 cursor-pointer"
                >
                  Clear
                </button>
              )}
            </form>

            <section aria-labelledby="account-restrictions-heading" className="mb-6 rounded-sm border border-gray-200 bg-gray-50 p-4">
              <div className="mb-3">
                <h4 id="account-restrictions-heading" className="text-sm font-bold text-gray-900">Account restrictions</h4>
                <p className="mt-1 text-xs text-gray-600">Set a customer restriction and the message shown on their dashboard.</p>
              </div>
              {restrictionError && <p role="alert" className="mb-3 rounded-sm border border-red-200 bg-red-50 p-3 text-xs text-red-800">{restrictionError}</p>}
              <div className="space-y-3">
                {users.map((customer) => {
                  const edit = restrictionEdits[customer.id] || {
                    isRestricted: customer.isRestricted === true,
                    restrictionReason: customer.restrictionReason || '',
                  };
                  const isAdminAccount = customer.role.toLowerCase() === 'admin';
                  return (
                    <div key={customer.id} className="grid gap-3 rounded-sm border border-gray-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)_auto] sm:items-center">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-gray-900">{customer.full_name}</p>
                        <p className="truncate text-xs text-gray-500">{customer.email}</p>
                        <p className={`mt-1 text-[10px] font-bold uppercase ${edit.isRestricted ? 'text-red-700' : 'text-emerald-700'}`}>
                          {isAdminAccount ? 'Member Services account' : edit.isRestricted ? 'Restricted' : 'Active'}
                        </p>
                      </div>
                      <label className="min-w-0 space-y-1 text-xs font-medium text-gray-700">
                        <span>Restriction reason shown to customer</span>
                        <textarea
                          value={edit.restrictionReason}
                          maxLength={500}
                          disabled={isAdminAccount}
                          onChange={(event) => setRestrictionEdits((current) => ({
                            ...current,
                            [customer.id]: { ...edit, restrictionReason: event.target.value },
                          }))}
                          rows={2}
                          className="w-full resize-y rounded-sm border border-gray-300 px-3 py-2 text-sm disabled:bg-gray-100"
                          placeholder="Explain why this account is restricted"
                        />
                      </label>
                      <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                        <label className="flex min-h-11 items-center gap-2 text-xs font-semibold text-gray-700">
                          <input
                            type="checkbox"
                            checked={edit.isRestricted}
                            disabled={isAdminAccount}
                            onChange={(event) => setRestrictionEdits((current) => ({
                              ...current,
                              [customer.id]: { ...edit, isRestricted: event.target.checked },
                            }))}
                            className="h-4 w-4 accent-red-700 disabled:opacity-50"
                          />
                          Restrict
                        </label>
                        <button
                          type="button"
                          disabled={isAdminAccount || savingRestrictionId === customer.id}
                          onClick={() => void saveUserRestriction(customer)}
                          className="min-h-11 rounded-sm bg-[#173B70] px-3 py-2 text-xs font-bold text-white hover:bg-[#245B9E] disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {savingRestrictionId === customer.id ? 'Saving…' : 'Save'}
                        </button>
                      </div>
                    </div>
                  );
                })}
                {users.length === 0 && <p className="py-3 text-center text-xs text-gray-500">No users match this search.</p>}
              </div>
            </section>

            {/* Users / Accounts Table */}
            <div className="overflow-x-auto border border-gray-200 rounded-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Account Number</th>
                    <th className="py-3 px-4">Account Nickname / Type</th>
                    <th className="py-3 px-4">Account Holder</th>
                    <th className="py-3 px-4">Available / Held (USD)</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {users.flatMap((u) =>
                    (u.accounts || []).map((acc) => (
                      <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                        <td className="py-3.5 px-4 font-mono font-bold text-[#173B70]">
                          {acc.account_number}
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{acc.nickname}</div>
                          <div className="text-[11px] text-gray-500">{acc.account_type}</div>
                        </td>
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{u.full_name}</div>
                          <div className="text-[11px] text-gray-500 font-mono">{u.email}</div>
                        </td>
                        <td className="py-3.5 px-4 font-mono font-bold text-sm text-gray-900">
                          <div>{formatUSD(acc.account_type === 'Credit Card' ? acc.balance : Math.max(0, acc.balance - (acc.held_balance || 0)))} available</div>
                          {acc.account_type !== 'Credit Card' && Number(acc.held_balance || 0) > 0 && (
                            <div className="mt-1 text-[11px] font-medium text-amber-700">{formatUSD(acc.held_balance || 0)} held</div>
                          )}
                        </td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                            {acc.status}
                          </span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              id={`btn-credit-customer-${acc.id}`}
                              type="button"
                              onClick={() => openCreditModal(acc, u.full_name)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold rounded-xs shadow-2xs transition-colors cursor-pointer"
                              title="Add Funds / Credit Account"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>Add Funds / Credit</span>
                            </button>

                            <button
                              id={`btn-adjust-account-${acc.id}`}
                              type="button"
                              onClick={() => openAdjustment(acc, u.full_name)}
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-[#173B70] text-white hover:bg-[#245B9E] text-xs font-medium rounded-xs shadow-2xs transition-colors cursor-pointer"
                            >
                              <Sliders className="w-3.5 h-3.5" />
                              <span>Adjust</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {activeTab === 'verifications' && (
          <section className="p-4 sm:p-5">
            <div className="mb-5 flex flex-col gap-2 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-[#173B70]">Customer enrollment status</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-gray-600">
                  Review customer registration details and uploaded supporting images, then set each enrollment to under review, approved, or rejected.
                </p>
              </div>
              <button type="button" onClick={fetchVerificationApplicants} className="inline-flex items-center justify-center gap-2 rounded-sm border border-gray-300 px-3 py-2 text-xs font-semibold text-gray-700 hover:bg-gray-50">
                <RefreshCw className="h-3.5 w-3.5" />
                Refresh customers
              </button>
            </div>

            {verificationApplicants.length === 0 ? (
              <div className="rounded-sm border border-dashed border-gray-300 bg-gray-50 p-8 text-center text-sm text-gray-500">
                No customer profiles are available.
              </div>
            ) : (
              <div className="space-y-4">
                {verificationApplicants.map((applicant) => {
                  const documentUrl = getVerificationDocumentUrl(
                    applicant.verificationDocument,
                    applicant.documentUrl,
                    applicant.verification_submission?.sampleFileType,
                  );
                  return (
                  <article key={applicant.id} className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
                    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                      <div className="space-y-3">
                        <div>
                          <h4 className="font-semibold text-slate-900">{applicant.full_name}</h4>
                          <p className="text-xs text-slate-600">{applicant.email} · {applicant.phone}</p>
                          <p className="mt-1 text-xs text-slate-500">Current status: <span className="font-semibold text-slate-800">{applicant.verification_status.replace('_', ' ')}</span></p>
                        </div>
                        <dl className="grid gap-2 rounded-md bg-slate-50 p-3 text-xs sm:grid-cols-2">
                          <div>
                            <dt className="text-slate-500">Verification reference</dt>
                            <dd className="mt-1 font-mono font-bold text-slate-900">
                              {(applicant.verification_submission?.verificationNumber || '').replace(/^[A-Z]{4}-/i, 'ACUF-') || 'Not supplied'}
                            </dd>
                          </div>
                          <div>
                            <dt className="text-slate-500">Submitted</dt>
                            <dd className="mt-1 text-slate-900">
                              {applicant.verification_submission?.submittedAt
                                ? new Date(applicant.verification_submission.submittedAt).toLocaleString()
                                : new Date(applicant.created_at).toLocaleString()}
                            </dd>
                          </div>
                          <div className="sm:col-span-2">
                            <dt className="text-slate-500">Supporting document</dt>
                            <dd className="mt-1 break-all text-slate-900">
                              {applicant.verification_submission?.sampleFileName || 'No document selected'}
                              {applicant.verification_submission?.sampleFileType ? ` · ${applicant.verification_submission.sampleFileType}` : ''}
                              {applicant.verification_submission?.sampleFileSize ? ` · ${Math.ceil(applicant.verification_submission.sampleFileSize / 1024)} KB` : ''}
                            </dd>
                          </div>
                        </dl>
                        {documentUrl && (
                          <div className="space-y-2">
                            <img
                              src={documentUrl}
                              alt="Verification ID"
                              className="mb-2 mt-2 h-auto w-48 rounded border border-slate-200 object-cover"
                            />
                            <a
                              href={documentUrl}
                              download="verification-id.jpg"
                              className="inline-block rounded bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                            >
                              Download Document
                            </a>
                          </div>
                        )}
                        {!documentUrl && applicant.verification_submission?.sampleFileName && (
                          <p className="mt-2 text-xs text-amber-800">
                            This existing record contains document metadata only; no stored image is available to preview or download.
                          </p>
                        )}
                      </div>
                      <div className="space-y-3">
                        <label htmlFor={`verification-status-${applicant.id}`} className="block text-xs font-semibold text-slate-700">
                          Enrollment status
                          <select
                            id={`verification-status-${applicant.id}`}
                            value={verificationStatusEdits[applicant.id]?.status || applicant.verification_status}
                            onChange={(event) => setVerificationStatusEdits((current) => ({
                              ...current,
                              [applicant.id]: {
                                status: event.target.value as VerificationApplicant['verification_status'],
                                reason: current[applicant.id]?.reason || applicant.verification_rejection_reason || '',
                              },
                            }))}
                            className="mt-1 w-full rounded-md border border-slate-200 bg-white p-2.5 text-xs outline-none focus:ring-2 focus:ring-[#173B70]"
                          >
                            <option value="under_review">Under review</option>
                            <option value="approved">Approved</option>
                            <option value="rejected">Rejected</option>
                          </select>
                        </label>
                        {(verificationStatusEdits[applicant.id]?.status || applicant.verification_status) === 'rejected' && (
                          <label htmlFor={`verification-reason-${applicant.id}`} className="block text-xs font-semibold text-slate-700">
                            Rejection reason (required)
                            <textarea
                              id={`verification-reason-${applicant.id}`}
                              rows={3}
                              maxLength={500}
                              placeholder="Explain why this enrollment is rejected"
                              value={verificationStatusEdits[applicant.id]?.reason || ''}
                              onChange={(event) => setVerificationStatusEdits((current) => ({
                                ...current,
                                [applicant.id]: {
                                  status: current[applicant.id]?.status || applicant.verification_status,
                                  reason: event.target.value,
                                },
                              }))}
                              className="mt-1 w-full rounded-md border border-slate-200 p-2.5 text-xs outline-none focus:ring-2 focus:ring-[#173B70]"
                            />
                          </label>
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <button
                            type="button"
                            disabled={savingVerificationId === applicant.id}
                            onClick={() => void saveVerificationStatus(applicant)}
                            className="inline-flex min-h-10 items-center gap-1.5 rounded-md bg-[#173B70] px-3 py-2 text-xs font-semibold text-white hover:bg-[#245B9E] disabled:opacity-50"
                          >
                            {savingVerificationId === applicant.id ? 'Saving…' : 'Save status'}
                          </button>
                          {applicant.verification_status === 'under_review' && (
                            <span className="text-[11px] text-amber-800">Dashboard access is locked until approval.</span>
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                  );
                })}
              </div>
            )}
          </section>
        )}

        {/* TAB 2: PENDING DEPOSITS */}
        {activeTab === 'pending' && (
          <div className="p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-5 pb-4 border-b border-gray-200">
              <div>
                <h3 className="text-base font-bold text-[#D6A832] font-serif flex items-center gap-2">
                  <ArrowDownCircle className="w-4 h-4" />
                  <span>Pending Transactions</span>
                </h3>
                <p className="text-xs text-gray-500 mt-0.5">Review customer requests. Funds post only after approval. Every decision requires a reason.</p>
              </div>
              <button
                type="button"
                onClick={fetchPendingDeposits}
                disabled={approvingDepositId !== null}
                className="inline-flex items-center gap-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-gray-700 text-xs rounded-xs cursor-pointer disabled:opacity-50"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Refresh Queue</span>
              </button>
            </div>

            {pendingDeposits.length === 0 ? (
              <div className="py-12 text-center border border-gray-200 rounded-xs bg-gray-50">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="text-sm font-semibold text-gray-700">No pending transactions</p>
              </div>
            ) : (
              <div className="overflow-x-auto border border-gray-200 rounded-xs">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-[#F8F9FA] text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                      <th className="py-3 px-4">Customer</th>
                      <th className="py-3 px-4">Description</th>
                      <th className="py-3 px-4">Account</th>
                      <th className="py-3 px-4 text-right">Amount</th>
                      <th className="py-3 px-4">Date</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {pendingDeposits.map((deposit) => (
                      <tr key={deposit.id} className="hover:bg-slate-50">
                        <td className="py-3.5 px-4">
                          <div className="font-semibold text-gray-900">{(deposit as any).user_name || 'Unknown'}</div>
                          <div className="text-[11px] text-gray-500">{(deposit as any).user_email || '—'}</div>
                        </td>
                        <td className="py-3.5 px-4 text-gray-700"><div className="font-medium">{formatTransactionDescription(deposit.description)}</div><div className="mt-1 text-[10px] uppercase text-gray-500">{deposit.type}</div></td>
                        <td className="py-3.5 px-4 text-gray-600">{(deposit as any).account_name || 'Account'} · •••• {(deposit as any).account_number?.slice(-4) || '—'}</td>
                        <td className={`py-3.5 px-4 text-right font-mono font-bold ${['deposit', 'transfer_in'].includes(String(deposit.type).toLowerCase()) ? 'text-emerald-700' : 'text-slate-900'}`}>
                          {['deposit', 'transfer_in'].includes(String(deposit.type).toLowerCase()) ? '+' : '−'}{formatUSD(deposit.amount + (String(deposit.type).toLowerCase() === 'transfer_out' ? (Number((deposit as any).transfer_fee) || 0) + (Number((deposit as any).transfer_tax) || 0) : 0))}
                          {Number((deposit as any).transfer_fee) + Number((deposit as any).transfer_tax) > 0 && <span className="mt-1 block text-[10px] font-normal text-gray-500">Includes {formatUSD(Number((deposit as any).transfer_fee) || 0)} fee + {formatUSD(Number((deposit as any).transfer_tax) || 0)} tax</span>}
                        </td>
                        <td className="py-3.5 px-4 text-[11px] text-gray-600 whitespace-nowrap">{deposit.date || deposit.created_at}</td>
                        <td className="py-3.5 px-4">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-200">{deposit.status}</span>
                        </td>
                        <td className="py-3.5 px-4 text-right">
                          <div className="min-w-56 space-y-2">
                            <textarea rows={2} maxLength={500} required aria-label={`Review reason for transaction ${deposit.id}`} placeholder="Required decision reason" value={transactionReviewReasons[deposit.id] || ''} onChange={(event) => setTransactionReviewReasons((current) => ({ ...current, [deposit.id]: event.target.value }))} className="w-full rounded border border-slate-200 p-2 text-xs" />
                            <div className="flex justify-end gap-2">
                              <button type="button" onClick={() => handleReviewTransaction(deposit, 'reject')} disabled={approvingDepositId === deposit.id} className="rounded border border-rose-200 px-2 py-1.5 text-xs font-semibold text-rose-700 disabled:opacity-50">Reject</button>
                              <button type="button" onClick={() => handleReviewTransaction(deposit, 'approve')} disabled={approvingDepositId === deposit.id} className="inline-flex items-center gap-1 rounded bg-emerald-700 px-2 py-1.5 text-xs font-bold text-white disabled:opacity-50">{approvingDepositId === deposit.id ? <RefreshCw className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}Approve</button>
                            </div>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {activeTab === 'cards' && (
          <section className="p-4 sm:p-5">
            <div className="mb-5 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900">Card applications</h3>
                <p className="mt-1 text-xs text-slate-500">Review requests. Every decision requires a reason and is added to the audit log.</p>
              </div>
              <button type="button" onClick={fetchCardApplications} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Refresh applications</button>
            </div>
            {cardApplications.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center text-sm text-slate-500">No card applications yet.</div>
            ) : (
              <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                <table className="w-full min-w-[850px] text-left text-xs">
                  <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                    <tr>
                      <th className="px-4 py-3">Customer</th>
                      <th className="px-4 py-3">Requested card</th>
                      <th className="px-4 py-3">Linked account</th>
                      <th className="px-4 py-3">Request date</th>
                      <th className="px-4 py-3">Status / review</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {cardApplications.map((application) => (
                      <tr key={application.id} className="align-top">
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900">{application.customer_name || 'Customer'}</p>
                          <p className="mt-1 text-slate-500">{application.customer_email}</p>
                        </td>
                        <td className="px-4 py-4">
                          <p className="font-semibold text-slate-900">{application.product_name}</p>
                          <p className="mt-1 text-slate-500">{application.network || 'Visa'} · {application.card_type}{application.card_type === 'Credit' ? ` · Requested ${formatUSD(application.requested_limit)}` : ''}</p>
                        </td>
                        <td className="px-4 py-4 text-slate-600">{application.account_nickname || 'Checking'} · •••• {application.account_number?.slice(-4) || '—'}</td>
                        <td className="px-4 py-4 whitespace-nowrap text-slate-600">{new Date(application.created_at).toLocaleDateString()}</td>
                        <td className="w-[340px] px-4 py-4">
                          <span className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${application.status === 'Pending' ? 'bg-amber-50 text-amber-800' : application.status === 'Approved' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800'}`}>{application.status}</span>
                          {application.status === 'Pending' ? (
                            <div className="mt-2 space-y-2">
                              <textarea
                                rows={2}
                                maxLength={500}
                                aria-label={`Review reason for ${application.customer_name}`}
                                placeholder="Required approval or rejection reason"
                                value={cardReviewReasons[application.id] || ''}
                                onChange={(event) => setCardReviewReasons((current) => ({ ...current, [application.id]: event.target.value }))}
                                className="w-full rounded-lg border border-slate-200 p-2 text-xs outline-none focus:ring-2 focus:ring-teal-600"
                              />
                              <div className="flex flex-wrap gap-2">
                                <button type="button" disabled={reviewingCardId === application.id} onClick={() => handleCardDecision(application.id, 'approve')} className="rounded-lg bg-teal-700 px-3 py-2 text-xs font-semibold text-white hover:bg-teal-800 disabled:opacity-50">Approve card request</button>
                                <button type="button" disabled={reviewingCardId === application.id} onClick={() => handleCardDecision(application.id, 'reject')} className="rounded-lg border border-rose-200 px-3 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50 disabled:opacity-50">Reject</button>
                              </div>
                            </div>
                          ) : (
                            <p className="mt-2 max-w-[300px] whitespace-normal text-slate-500">{application.review_reason}</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-8">
              <div className="mb-3 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h3 className="text-base font-bold text-slate-900">Issued cards</h3>
                  <p className="mt-1 text-xs text-slate-500">Card debits are recorded against the linked in-app checking ledger.</p>
                </div>
                <button type="button" onClick={fetchIssuedCards} className="rounded-lg border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50">Refresh cards</button>
              </div>
              {cardColorError && <p role="alert" className="mb-3 rounded-lg border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">{cardColorError}</p>}
              {issuedCards.length === 0 ? (
                <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-500">No issued cards found.</div>
              ) : (
                <div className="w-full overflow-x-auto rounded-xl border border-slate-200">
                  <table className="w-full min-w-[760px] text-left text-xs">
                    <thead className="bg-slate-50 text-[11px] uppercase tracking-wide text-slate-600">
                      <tr><th className="px-4 py-3">Cardholder</th><th className="px-4 py-3">Card</th><th className="px-4 py-3">Color theme</th><th className="px-4 py-3">Linked account</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Action</th></tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {issuedCards.map((card) => {
                        const canDebit = card.card_type === 'Debit' && card.status === 'Active' && card.account_status === 'Active';
                        return <tr key={card.id}>
                          <td className="px-4 py-3"><div className="font-semibold text-slate-900">{card.customer_name}</div><div className="mt-1 text-slate-500">{card.customer_email}</div></td>
                          <td className="px-4 py-3"><div className="font-semibold text-slate-900">{card.product_name}</div><div className="mt-1 font-mono text-slate-500">{card.network || 'Visa'} · {card.masked_number || `•••• •••• •••• ${card.last4}`}</div>{card.card_type === 'Credit' && <div className="mt-1 text-slate-600">Limit: {formatUSD(card.credit_limit || 0)}</div>}</td>
                          <td className="px-4 py-3">
                            <label className="sr-only" htmlFor={`card-color-${card.id}`}>Color theme for {card.product_name}</label>
                            <select
                              id={`card-color-${card.id}`}
                              value={card.cardColor || 'emerald'}
                              disabled={savingCardColorId === card.id}
                              onChange={(event) => {
                                const selectedColor = CARD_COLOR_OPTIONS.find((color) => color === event.target.value);
                                if (selectedColor) updateCardColor(card, selectedColor);
                              }}
                              className="min-h-10 rounded-lg border border-slate-200 bg-white px-2 text-xs font-medium text-slate-700 disabled:opacity-60"
                            >
                              {CARD_COLOR_OPTIONS.map((color) => (
                                <option key={color} value={color}>{color[0].toUpperCase() + color.slice(1)}</option>
                              ))}
                            </select>
                            {savingCardColorId === card.id && <span className="ml-2 text-[10px] text-slate-500">Saving…</span>}
                          </td>
                          <td className="px-4 py-3"><div>{card.account_nickname || 'Checking'}</div><div className="mt-1 text-slate-500">•••• {card.account_number?.slice(-4) || '—'} · {formatUSD(Math.max(0, (card.account_balance || 0) - (card.held_balance || 0)))} available</div></td>
                          <td className="px-4 py-3">{card.status}</td>
                          <td className="px-4 py-3"><button type="button" disabled={!canDebit} onClick={() => { setCardToDebit(card); setCardDebitAmount(''); setCardDebitReason(''); setError(null); }} className="rounded-lg bg-rose-700 px-3 py-2 text-xs font-semibold text-white hover:bg-rose-800 disabled:cursor-not-allowed disabled:opacity-40">Debit linked account</button></td>
                        </tr>;
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}

        {/* TAB 3: AUDIT LOGS */}
        {activeTab === 'audit' && (
          <div className="p-5">
            <div className="mb-4 text-xs text-gray-500 flex items-center justify-between">
              <span>All Member Services ledger modifications are cryptographically timestamped and logged.</span>
              <span className="font-mono font-bold text-gray-700">{auditLogs.length} Events Total</span>
            </div>

            <div className="overflow-x-auto border border-gray-200 rounded-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Specialist Email</th>
                    <th className="py-3 px-4">Action</th>
                    <th className="py-3 px-4">Amount (USD)</th>
                    <th className="py-3 px-4">Audit Details & Justification</th>
                    <th className="py-3 px-4">IP Address</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-600 whitespace-nowrap text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-800 font-medium">
                        {log.admin_email}
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                            log.action.includes('CREDIT')
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                              : log.action.includes('DEBIT')
                              ? 'bg-red-50 text-red-800 border border-red-300'
                              : 'bg-emerald-50 text-emerald-800 border border-emerald-300'
                          }`}
                        >
                          {log.action.endsWith('_VERIFICATION_APPROVED')
                            ? 'ENROLLMENT_VERIFICATION_APPROVED'
                            : log.action.endsWith('_VERIFICATION_REJECTED')
                              ? 'ENROLLMENT_VERIFICATION_REJECTED'
                              : log.action}
                        </span>
                      </td>
                      <td className="py-3 px-4 font-mono font-bold text-gray-900 whitespace-nowrap">
                        {log.amount ? `${formatUSD(log.amount)} USD` : '—'}
                      </td>
                      <td className="py-3 px-4 text-gray-700 max-w-md">
                        {log.details.replace(/^(\w+) \w+ verification submission for /i, '$1 enrollment verification for ')}
                      </td>
                      <td className="py-3 px-4 font-mono text-gray-500 text-[11px]">
                        {log.ip_address || '127.0.0.1'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* TAB 3: SYSTEM TRANSACTIONS */}
        {/* TAB 4: SYSTEM TRANSACTIONS */}
        {activeTab === 'transactions' && (
          <div className="p-5">
            <div className="overflow-x-auto border border-gray-200 rounded-xs">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] text-gray-600 font-bold border-b border-gray-200 uppercase tracking-wider text-[11px]">
                    <th className="py-3 px-4">Date</th>
                    <th className="py-3 px-4">Account Number</th>
                    <th className="py-3 px-4">Description / Type</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Amount (USD)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {allTransactions.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-3 px-4 font-mono text-gray-600 whitespace-nowrap">{t.date}</td>
                      <td className="py-3 px-4 font-mono text-[#173B70] font-semibold">
                        {t.account_number || t.account_name}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{formatTransactionDescription(t.description)}</div>
                        <div className="text-[11px] text-gray-500">Category: {t.category || t.type}</div>
                      </td>
                      <td className="py-3 px-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            t.status === 'Completed'
                              ? 'bg-emerald-50 text-emerald-800'
                              : 'bg-amber-50 text-amber-800'
                          }`}
                        >
                          {t.status}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-gray-900">
                        {formatUSD(t.amount)} USD
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Balance Adjustment Modal */}
      {adjustModalOpen && selectedAccount && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4 backdrop-blur-2xs">
          <div className="bg-white border border-gray-300 rounded-xs shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="h-1.5 bg-[#D6A832]" />

            <form onSubmit={handleProcessAdjustment} className="p-6 space-y-4">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-xs font-bold text-[#D6A832] uppercase tracking-wider">
                    Member Services Ledger Adjustment
                  </span>
                  <h3 className="text-xl font-bold text-[#173B70] font-serif mt-0.5">
                    Direct Balance Adjustment
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="text-gray-400 hover:text-gray-700 text-lg leading-none p-1"
                >
                  ✕
                </button>
              </div>

              {/* Target Account Summary */}
              <div className="bg-gray-50 border border-gray-200 rounded-xs p-3.5 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-gray-500">Account Holder:</span>
                  <span className="font-bold text-gray-900">{targetAccountOwner}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Account:</span>
                  <span className="font-mono text-gray-900">
                    {selectedAccount.nickname} ({selectedAccount.account_number})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">Current Balance:</span>
                  <span className="font-mono font-bold text-sm text-[#173B70]">
                    {formatUSD(selectedAccount.balance)} USD
                  </span>
                </div>
              </div>

              {/* Account action */}
              <div>
                <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5">
                  Adjustment Operation
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setAdjustAction('credit')}
                    className={`py-2.5 px-3 rounded-xs border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      adjustAction === 'credit'
                        ? 'bg-emerald-50 border-emerald-600 text-emerald-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowUpCircle className="w-4 h-4 text-emerald-600" />
                    <span>Credit (+) Add USD</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setAdjustAction('debit')}
                    className={`py-2.5 px-3 rounded-xs border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${
                      adjustAction === 'debit'
                        ? 'bg-red-50 border-red-600 text-red-800'
                        : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'
                    }`}
                  >
                    <ArrowDownCircle className="w-4 h-4 text-red-600" />
                    <span>Debit (-) Deduct USD</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAction('hold')}
                    className={`py-2.5 px-3 rounded-xs border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${adjustAction === 'hold' ? 'bg-amber-50 border-amber-500 text-amber-900' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Lock className="w-4 h-4 text-amber-600" />
                    <span>Place payment hold</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setAdjustAction('release')}
                    className={`py-2.5 px-3 rounded-xs border text-xs font-bold flex items-center justify-center gap-2 cursor-pointer transition-colors ${adjustAction === 'release' ? 'bg-emerald-50 border-emerald-500 text-emerald-900' : 'bg-white border-gray-300 text-gray-700 hover:bg-gray-50'}`}
                  >
                    <Lock className="w-4 h-4 text-emerald-600" />
                    <span>Release hold</span>
                  </button>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label
                  htmlFor="input-adjust-amount"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                >
                  Amount to {adjustAction === 'credit' ? 'Add' : adjustAction === 'debit' ? 'Deduct' : adjustAction === 'hold' ? 'Hold' : 'Release'} (USD)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                    $
                  </span>
                  <input
                    id="input-adjust-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={adjustAmount}
                    onChange={(e) => setAdjustAmount(e.target.value)}
                    className="w-full pl-8 pr-12 py-2 text-base font-bold border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#173B70]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    USD
                  </span>
                </div>
              </div>

              {/* Reason / Regulatory Justification */}
              <div>
                <label
                  htmlFor="input-adjust-reason"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                >
                  Audit Reason & Regulatory Justification (Required)
                </label>
                <textarea
                  id="input-adjust-reason"
                  rows={2}
                  required
                  placeholder="Describe the reason for this adjustment"
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#173B70]"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 border-l-4 border-[#D6A832] text-red-800 text-xs">
                  {error}
                </div>
              )}

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setAdjustModalOpen(false)}
                  className="px-4 py-2 text-xs text-gray-600 font-semibold hover:text-gray-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-adjust-ledger"
                  type="submit"
                  disabled={submittingAdjustment}
                  className="px-5 py-2 bg-[#D6A832] hover:bg-[#AD841B] text-white text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {submittingAdjustment ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <span>{adjustAction === 'credit' ? 'Add funds' : adjustAction === 'debit' ? 'Deduct funds' : adjustAction === 'hold' ? 'Place hold' : 'Release hold'}</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {/* Dedicated Admin Fund Injection / Credit Customer Account Modal */}
      {creditModalOpen && (
        <div
          id="modal-admin-credit-user"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in"
        >
          <div className="bg-white border border-gray-300 rounded-sm shadow-2xl max-w-lg w-full overflow-hidden">
            <div className="bg-[#173B70] text-white px-6 py-4 flex items-center justify-between border-b-2 border-[#D6A832]">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-white/10 rounded-sm">
                  <ArrowUpCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="font-serif font-bold text-lg text-white leading-tight">
                    Add Funds / Credit Customer Account
                  </h3>
                  <p className="text-[11px] text-gray-200">
                    Account Funding Adjustment • Core Banking System
                  </p>
                </div>
              </div>
              <button
                onClick={() => setCreditModalOpen(false)}
                className="text-gray-300 hover:text-white p-1 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleProcessCreditUser} className="p-6 space-y-4">
              {/* Customer Selection / Account Number */}
              <div>
                <label
                  htmlFor="select-credit-customer-account"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                >
                  Customer Selection / Account Number
                </label>
                <select
                  id="select-credit-customer-account"
                  value={creditAccountId}
                  onChange={(e) => setCreditAccountId(e.target.value)}
                  className="w-full text-xs font-medium p-2.5 border border-gray-300 rounded-xs bg-white focus:ring-1 focus:ring-[#173B70] outline-hidden"
                  required
                >
                  <option value="">-- Select Customer Account --</option>
                  {users.flatMap((u) =>
                    (u.accounts || []).map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {u.full_name} ({u.email}) — {acc.nickname} ({acc.account_number}) — Balance: ${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                      </option>
                    ))
                  )}
                </select>
              </div>

              {/* Selected account details badge if chosen */}
              {(() => {
                const chosenAcc = users
                  .flatMap((u) =>
                    (u.accounts || []).map((a) => ({
                      ...a,
                      ownerName: u.full_name,
                      ownerEmail: u.email,
                    }))
                  )
                  .find((a) => a.id === creditAccountId);
                if (!chosenAcc) return null;
                return (
                  <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-xs text-xs space-y-1">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Holder:</span>
                      <span className="font-semibold text-gray-900">{chosenAcc.ownerName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Account Number:</span>
                      <span className="font-mono font-bold text-[#173B70]">
                        {chosenAcc.account_number}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Current Balance:</span>
                      <span className="font-mono font-bold text-gray-900">
                        {formatUSD(chosenAcc.balance)} USD
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Amount */}
              <div>
                <label
                  htmlFor="input-credit-amount"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                >
                  Deposit / Credit Amount ($ USD)
                </label>
                <div className="relative mb-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-gray-500">
                    $
                  </span>
                  <input
                    id="input-credit-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    className="w-full pl-8 pr-12 py-2 text-base font-bold font-mono border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#173B70]"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    USD
                  </span>
                </div>

                {/* Quick preset chips */}
                <div className="flex flex-wrap gap-1.5">
                  {[500, 1000, 2500, 5000, 10000].map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setCreditAmount(amt.toString())}
                      className="px-2.5 py-1 text-[11px] font-semibold bg-gray-100 hover:bg-gray-200 text-gray-800 rounded-xs border border-gray-200 cursor-pointer"
                    >
                      +${amt.toLocaleString()}
                    </button>
                  ))}
                </div>
              </div>

              {/* Transaction Memo / Description */}
              <div>
                <label
                  htmlFor="input-credit-memo"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1"
                >
                  Transaction Memo / Description (Required)
                </label>
                <input
                  id="input-credit-memo"
                  type="text"
                  required
                  placeholder="Describe the reason for this credit"
                  value={creditMemo}
                  onChange={(e) => setCreditMemo(e.target.value)}
                  className="w-full p-2.5 text-xs border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#173B70]"
                />
              </div>

              {error && (
                <div className="p-2.5 bg-red-50 border-l-4 border-[#D6A832] text-red-800 text-xs">
                  {error}
                </div>
              )}

              <div className="pt-3 border-t border-gray-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setCreditModalOpen(false)}
                  className="px-4 py-2 text-xs text-gray-600 font-semibold hover:text-gray-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-confirm-credit-user"
                  type="submit"
                  disabled={submittingCredit}
                  className="px-5 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-60"
                >
                  {submittingCredit ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Injecting Funds...</span>
                    </>
                  ) : (
                    <>
                      <ArrowUpCircle className="w-3.5 h-3.5" />
                      <span>Authorize & Credit Account</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
      {cardToDebit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4" role="presentation" onClick={() => setCardToDebit(null)}>
          <form onSubmit={handleCardDebit} onClick={(event) => event.stopPropagation()} className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl sm:p-6" role="dialog" aria-modal="true" aria-labelledby="card-debit-title">
            <div>
              <h2 id="card-debit-title" className="text-lg font-bold text-slate-900">Record card debit</h2>
              <p className="mt-1 text-sm text-slate-600">{cardToDebit.customer_name} · {cardToDebit.product_name} ending {cardToDebit.last4}</p>
              <p className="mt-1 text-xs text-slate-500">This updates the linked checking ledger and creates a transaction and audit entry.</p>
            </div>
            <label className="block text-sm font-medium text-slate-700">Amount (USD)
              <input type="number" min="0.01" max="10000000" step="0.01" required value={cardDebitAmount} onChange={(event) => setCardDebitAmount(event.target.value)} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 px-3 text-base" />
            </label>
            <label className="block text-sm font-medium text-slate-700">Reason
              <textarea required maxLength={500} rows={3} value={cardDebitReason} onChange={(event) => setCardDebitReason(event.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-3 text-sm" />
            </label>
            {error && <p role="alert" className="rounded-lg bg-rose-50 p-3 text-sm text-rose-800">{error}</p>}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setCardToDebit(null)} className="min-h-10 rounded-lg border border-slate-300 px-4 text-sm font-semibold text-slate-700">Cancel</button>
              <button type="submit" disabled={submittingCardDebit} className="min-h-10 rounded-lg bg-rose-700 px-4 text-sm font-semibold text-white disabled:opacity-50">{submittingCardDebit ? 'Processing…' : 'Record debit'}</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
