import React, { useMemo, useState, ChangeEvent, useEffect } from 'react';
import { User, BankAccount, Transaction, BankCard, CardApplication } from '../types';
import { AddFundsModal } from '../components/AddFundsModal';
import { getAuthHeaders } from '../utils/api';
import { formatTransactionDescription } from '../utils/transactionFormatting';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleEllipsis,
  CreditCard,
  Eye,
  EyeOff,
  Plus,
} from 'lucide-react';

function getLocalGreeting(): { text: string } {
  const hour = new Date().getHours();
  return {
    text: hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening',
  };
}

export interface DashboardHomeViewProps {
  user: User;
  token?: string;
  accounts: BankAccount[];
  transactions: Transaction[];
  onRefresh: () => void;
  onNavigateToTransfer: (fromAccountId?: string) => void;
  onNavigateToTab: (tab: string) => void;
  onProfilePictureChange: (profilePicture: string) => void;
  showCardsOnly?: boolean;
}

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
  user,
  token,
  accounts,
  transactions,
  onRefresh,
  onNavigateToTransfer,
  onNavigateToTab,
  onProfilePictureChange,
  showCardsOnly = false,
}) => {
  const [activeAccountId, setActiveAccountId] = useState('');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [uploadingPicture, setUploadingPicture] = useState(false);
  const [pictureMessage, setPictureMessage] = useState('');
  const [depositOpen, setDepositOpen] = useState(false);
  const [receiveCopied, setReceiveCopied] = useState(false);
  const [cards, setCards] = useState<BankCard[]>([]);
  const [cardApplications, setCardApplications] = useState<CardApplication[]>([]);
  const [applyForCard, setApplyForCard] = useState(false);
  const [cardType, setCardType] = useState<'Debit' | 'Credit'>('Debit');
  const [cardNetwork, setCardNetwork] = useState<'Visa' | 'Mastercard'>('Visa');
  const [cardAccountId, setCardAccountId] = useState('');
  const [requestedLimit, setRequestedLimit] = useState('1000');
  const [submittingCard, setSubmittingCard] = useState(false);
  const [cardMessage, setCardMessage] = useState('');
  const [greeting, setGreeting] = useState(() => getLocalGreeting());

  const checkingAndSavings = accounts.filter((account) =>
    account.account_type === 'Checking' || account.account_type === 'Savings'
  );
  const defaultAccount = checkingAndSavings.find((account) => account.account_type === 'Checking') || checkingAndSavings[0] || accounts[0];
  const activeAccount = accounts.find((account) => account.id === activeAccountId) || defaultAccount;
  const legacyCards = accounts.filter((account) => account.account_type === 'Credit Card');
  const recentTransactions = useMemo(() => transactions.slice(0, 3), [transactions]);

  useEffect(() => {
    const refreshGreeting = () => setGreeting(getLocalGreeting());
    refreshGreeting();
    const timer = window.setInterval(refreshGreeting, 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const loadCards = async () => {
      try {
        const [cardsResponse, applicationsResponse] = await Promise.all([
          fetch('/api/user/cards', { headers: getAuthHeaders(), credentials: 'include' }),
          fetch('/api/user/card-applications', { headers: getAuthHeaders(), credentials: 'include' }),
        ]);
        if (!cardsResponse.ok || !applicationsResponse.ok) throw new Error('Unable to load card information.');
        const [cardsData, applicationsData] = await Promise.all([cardsResponse.json(), applicationsResponse.json()]);
        setCards(Array.isArray(cardsData.cards) ? cardsData.cards.filter((card: BankCard) => card.status === 'Active') : []);
        setCardApplications(Array.isArray(applicationsData.applications) ? applicationsData.applications : []);
      } catch (error) {
        setCardMessage(error instanceof Error ? error.message : 'Unable to load card information.');
      }
    };
    void loadCards();
    const refreshTimer = window.setInterval(() => void loadCards(), 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [user.id]);

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(amount);

  const handleImageUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPictureMessage('Choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setPictureMessage('Choose an image smaller than 5 MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result !== 'string') return;
      setUploadingPicture(true);
      setPictureMessage('');
      try {
        const response = await fetch('/api/user/profile-picture', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
          credentials: 'include',
          body: JSON.stringify({ profilePicture: reader.result }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not update your photo.');
        const picture = data.user?.profilePicture || '';
        onProfilePictureChange(picture);
        setPictureMessage('Photo updated.');
      } catch (error) {
        setPictureMessage(error instanceof Error ? error.message : 'Could not update your photo.');
      } finally {
        setUploadingPicture(false);
      }
    };
    reader.onerror = () => setPictureMessage('Could not read this image.');
    reader.readAsDataURL(file);
  };

  const handleReceive = async () => {
    if (!activeAccount?.account_number) return;
    try {
      await navigator.clipboard.writeText(activeAccount.account_number);
      setReceiveCopied(true);
      window.setTimeout(() => setReceiveCopied(false), 1800);
    } catch {
      setPictureMessage('Account number: ' + activeAccount.account_number);
    }
  };

  const handleCardApplication = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!cardAccountId) {
      setCardMessage('Choose an active checking account to link to the card.');
      return;
    }
    setSubmittingCard(true);
    setCardMessage('');
    try {
      const response = await fetch('/api/user/card-applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          cardType,
          network: cardNetwork,
          accountId: cardAccountId,
          requestedLimit: cardType === 'Credit' ? Number(requestedLimit) : 0,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to submit your card application.');
      setCardMessage('Application submitted. You can track its review status below.');
      setApplyForCard(false);
      const applicationsResponse = await fetch('/api/user/card-applications', { headers: getAuthHeaders(), credentials: 'include' });
      if (applicationsResponse.ok) {
        const applicationsData = await applicationsResponse.json();
        setCardApplications(Array.isArray(applicationsData.applications) ? applicationsData.applications : []);
      }
    } catch (error) {
      setCardMessage(error instanceof Error ? error.message : 'Unable to submit your card application.');
    } finally {
      setSubmittingCard(false);
    }
  };

  return (
    <div className="mx-auto w-full max-w-5xl space-y-7 pb-6">
      {!showCardsOnly && <>
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0">
            <div className="h-12 w-12 overflow-hidden rounded-full bg-emerald-50 text-teal-800 ring-2 ring-[#D6A84F] flex items-center justify-center text-lg font-semibold">
              {user.profilePicture ? (
                <img src={user.profilePicture} alt={`${user.full_name} profile`} className="h-full w-full object-cover" />
              ) : (user.full_name?.charAt(0).toUpperCase() || 'U')}
            </div>
            <label className="absolute -bottom-1 -right-1 grid h-6 w-6 cursor-pointer place-items-center rounded-full border border-white bg-teal-800 text-white shadow-sm" title="Change profile photo">
              <Plus className="h-3.5 w-3.5" />
              <input type="file" accept="image/*" onChange={handleImageUpload} disabled={uploadingPicture} className="sr-only" />
            </label>
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-500">{greeting.text} 👋</p>
            <h1 className="truncate text-lg font-semibold text-slate-900">{user.full_name}</h1>
            {pictureMessage && <p role="status" className="truncate text-xs text-slate-500">{uploadingPicture ? 'Uploading photo…' : pictureMessage}</p>}
          </div>
        </div>
      </header>

      <section aria-label="Primary account" className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-white to-emerald-50 p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-slate-500">{activeAccount?.nickname || 'Primary Account'}</p>
            <p className="mt-1 text-sm tracking-wider text-slate-600">
              {activeAccount?.account_number ? `••••  ••••  ${activeAccount.account_number.slice(-4)}` : 'Account unavailable'}
            </p>
          </div>
          {checkingAndSavings.length > 1 && (
            <select
              aria-label="Switch account"
              value={activeAccount?.id || ''}
              onChange={(event) => setActiveAccountId(event.target.value)}
              className="max-w-full rounded-xl border border-teal-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none focus:ring-2 focus:ring-teal-600"
            >
              {checkingAndSavings.map((account) => (
                <option key={account.id} value={account.id}>{account.account_type} · {account.nickname}</option>
              ))}
            </select>
          )}
        </div>
        <div className="mt-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Available Balance</span>
            <button type="button" aria-label={balanceVisible ? 'Hide balance' : 'Show balance'} onClick={() => setBalanceVisible((visible) => !visible)} className="rounded p-1 text-slate-600 hover:bg-slate-100">
              {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 break-all text-3xl font-bold tracking-tight text-teal-950 sm:text-4xl">
            {balanceVisible ? formatMoney(activeAccount?.available_balance ?? activeAccount?.balance ?? 0) : '••••••'}
          </p>
        </div>
      </section>

      <section aria-label="Quick actions" className="grid grid-cols-2 gap-3 sm:grid-cols-4 sm:gap-5">
        <button type="button" onClick={() => setDepositOpen(true)} className="flex flex-col items-center gap-2 text-center text-xs font-medium text-slate-700">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-white shadow-sm"><Plus className="h-5 w-5" /></span>
          Top Up
        </button>
        <button type="button" onClick={() => onNavigateToTransfer(activeAccount?.id)} className="flex flex-col items-center gap-2 text-center text-xs font-medium text-slate-700">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-white shadow-sm"><ArrowUpRight className="h-5 w-5" /></span>
          Send
        </button>
        <button type="button" onClick={handleReceive} className="flex flex-col items-center gap-2 text-center text-xs font-medium text-slate-700">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-white shadow-sm">{receiveCopied ? <Check className="h-5 w-5" /> : <ArrowDownLeft className="h-5 w-5" />}</span>
          {receiveCopied ? 'Copied' : 'Receive'}
        </button>
        <button type="button" onClick={() => onNavigateToTab('profile')} className="flex flex-col items-center gap-2 text-center text-xs font-medium text-slate-700">
          <span className="grid h-14 w-14 place-items-center rounded-full border border-slate-200 bg-white shadow-sm"><CircleEllipsis className="h-5 w-5" /></span>
          More
        </button>
      </section>
      </>}

      <section id="active-cards" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">Your Active Cards</h2>
          <button type="button" onClick={() => setApplyForCard((open) => !open)} className="inline-flex items-center gap-1 text-sm font-medium text-teal-700 hover:text-teal-900">
            {applyForCard ? 'Close' : 'Apply for a card'} <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        {applyForCard && (
          <form onSubmit={handleCardApplication} className="grid gap-3 rounded-2xl border border-teal-100 bg-white p-4 sm:grid-cols-2 sm:p-5">
            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Card type</span>
              <select value={cardType} onChange={(event) => setCardType(event.target.value as 'Debit' | 'Credit')} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <option value="Debit">Everyday Debit Card</option>
                <option value="Credit">Rewards Credit Card</option>
              </select>
            </label>
            <fieldset className="space-y-1">
              <legend className="text-xs font-medium text-slate-700">Card network</legend>
              <div className="grid grid-cols-2 gap-2">
                {(['Visa', 'Mastercard'] as const).map((network) => (
                  <label key={network} className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 text-sm font-semibold transition ${cardNetwork === network ? 'border-teal-700 bg-teal-50 text-teal-900 ring-1 ring-teal-700' : 'border-slate-200 bg-white text-slate-700'}`}>
                    <input type="radio" name="cardNetwork" value={network} checked={cardNetwork === network} onChange={() => setCardNetwork(network)} className="accent-teal-700" />
                    {network}
                  </label>
                ))}
              </div>
            </fieldset>
            <label className="space-y-1 text-xs font-medium text-slate-700">
              <span>Link to checking account</span>
              <select value={cardAccountId} onChange={(event) => setCardAccountId(event.target.value)} required className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <option value="">Choose an account</option>
                {accounts.filter((account) => account.account_type === 'Checking' && account.status === 'Active').map((account) => (
                  <option key={account.id} value={account.id}>{account.nickname} · •••• {account.account_number.slice(-4)}</option>
                ))}
              </select>
            </label>
            {cardType === 'Credit' && (
              <label className="space-y-1 text-xs font-medium text-slate-700 sm:col-span-2">
                <span>Requested credit limit (USD)</span>
                <input type="number" min="0" max="50000" step="100" value={requestedLimit} onChange={(event) => setRequestedLimit(event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2.5 text-sm sm:max-w-xs" />
              </label>
            )}
            <div className="flex flex-col gap-3 sm:col-span-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs leading-5 text-slate-500">Approved cards appear here for active management.</p>
              <button type="submit" disabled={submittingCard} className="shrink-0 rounded-lg bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800 disabled:opacity-50">
                {submittingCard ? 'Submitting…' : 'Submit application'}
              </button>
            </div>
          </form>
        )}
        {(cards.length > 0 || legacyCards.length > 0) ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {cards.map((card) => (
              <article key={card.id} className={`relative isolate min-h-52 overflow-hidden rounded-2xl p-5 text-white shadow-lg ${card.network === 'Mastercard' ? 'bg-gradient-to-br from-zinc-700 via-zinc-900 to-black' : 'bg-gradient-to-br from-sky-700 via-blue-900 to-slate-950'}`}>
                <div aria-hidden="true" className="absolute -right-12 -top-16 -z-10 h-56 w-56 rounded-full border border-white/10" />
                <div aria-hidden="true" className="absolute -right-4 -top-8 -z-10 h-40 w-40 rounded-full border border-white/10" />
                <div className="flex items-start justify-between gap-3">
                  <div>
x                    <p className="text-[10px] font-semibold uppercase tracking-[0.2em] tet-white/60"> REWARDS CARD</p>
                    <p className="mt-1 text-sm font-semibold">{card.product_name}</p>
                  </div>
                  <span className="rounded-md border border-white/25 bg-white/10 px-2 py-1 text-xs font-bold tracking-wide">{card.network || 'Visa'}</span>
                </div>
                <div className="mt-6 flex items-center gap-2">
                  <div aria-hidden="true" className="grid h-8 w-10 grid-cols-2 gap-px overflow-hidden rounded-md border border-amber-200/40 bg-amber-200/80 p-1">
                    <span className="rounded-sm border border-amber-900/20" /><span className="rounded-sm border border-amber-900/20" /><span className="rounded-sm border border-amber-900/20" /><span className="rounded-sm border border-amber-900/20" />
                  </div>
                  <CreditCard aria-hidden="true" className="h-5 w-5 text-white/60" />
                </div>
                <p className="mt-4 font-mono text-base tracking-[0.16em] sm:text-lg">{card.masked_number || `•••• •••• •••• ${card.last4}`}</p>
                <div className="mt-4 flex flex-col gap-3 border-t border-white/15 pt-3 sm:flex-row sm:items-end sm:justify-between">
                  <div><p className="text-[9px] uppercase tracking-widest text-white/55">Cardholder</p><p className="mt-0.5 text-xs font-semibold uppercase tracking-wide">{user.full_name}</p></div>
                  <div className="text-left sm:text-right"><p className="text-[9px] uppercase tracking-widest text-white/55">{card.card_type === 'Credit' ? 'Approved limit' : 'Linked account available'}</p><p className="mt-0.5 text-sm font-bold">{formatMoney(card.card_type === 'Credit' ? card.credit_limit : (card.linked_account_available || 0))}</p></div>
                </div>
                <p className="mt-3 text-[10px] font-medium text-white/70">Visual Sercure card view · No payment credentials or purchase capability</p>
              </article>
            ))}
            {legacyCards.map((card) => (
              <article key={card.id} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <CreditCard className="h-5 w-5 text-slate-600" />
                  <span className="text-xs text-slate-500">{card.status}</span>
                </div>
                <p className="mt-5 font-medium text-slate-900">{card.nickname}</p>
                <p className="mt-1 text-sm text-slate-500">•••• {card.account_number.slice(-4)}</p>
                <p className="mt-3 text-lg font-semibold text-slate-900">{formatMoney(card.balance)}</p>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-slate-300 bg-white/70 px-5 py-8 text-center">
            <CreditCard className="mx-auto h-7 w-7 text-slate-400" />
            <p className="mt-3 font-medium text-slate-800">No active cards yet</p>
            <p className="mt-1 text-sm text-slate-500">Your cards will appear here when available.</p>
          </div>
        )}
        {cardApplications.length > 0 && (
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-800">Application status</h3>
            {cardApplications.map((application) => (
              <div key={application.id} className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className="text-sm font-medium text-slate-800">{application.product_name}</p>
                  {application.review_reason && <p className="mt-1 text-xs text-slate-500">{application.review_reason}</p>}
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${application.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : application.status === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{application.status}</span>
              </div>
            ))}
          </div>
        )}
        {cardMessage && <p role="status" className="text-xs text-slate-600">{cardMessage}</p>}
      </section>

      {!showCardsOnly && recentTransactions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <button type="button" onClick={() => onNavigateToTab('history')} className="text-sm font-medium text-slate-600 hover:text-slate-900">See all</button>
          </div>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-4">
            {recentTransactions.map((transaction) => (
              <div key={transaction.id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-slate-900">{formatTransactionDescription(transaction.description)}</p>
                  <p className="text-xs text-slate-500">{transaction.date}</p>
                </div>
                <p className="shrink-0 text-sm font-semibold text-slate-800">{formatMoney(transaction.amount + (transaction.type === 'transfer_out' ? (transaction.transfer_fee || 0) + (transaction.transfer_tax || 0) : 0))}</p>
              </div>
            ))}
          </div>
        </section>
      )}

      <AddFundsModal isOpen={depositOpen} onClose={() => setDepositOpen(false)} accounts={accounts} token={token} onSuccess={() => { onRefresh(); }} />
    </div>
  );
};

export const CardsManagementView: React.FC<Omit<DashboardHomeViewProps, 'showCardsOnly'>> = (props) => (
  <DashboardHomeView {...props} showCardsOnly />
);
