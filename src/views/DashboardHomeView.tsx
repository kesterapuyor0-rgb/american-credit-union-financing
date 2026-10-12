import React, { useMemo, useState, useEffect, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { User, BankAccount, Transaction, BankCard, BankCardDetails, CardApplication } from '../types';
import { getAuthHeaders } from '../utils/api';
import { formatTransactionDescription } from '../utils/transactionFormatting';
import { PushNotificationBanner } from '../components/PushNotificationBanner';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Check,
  ChevronRight,
  CircleEllipsis,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  LockKeyhole,
  SlidersHorizontal,
  Snowflake,
  HandCoins,
  BriefcaseBusiness,
  X,
} from 'lucide-react';

function getLocalGreeting(): string {
  const hour = new Date().getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

const CARD_COLOR_CLASSES: Record<NonNullable<BankCard['cardColor']>, string> = {
  emerald: 'bg-gradient-to-br from-emerald-700 via-emerald-900 to-slate-950',
  navy: 'bg-gradient-to-br from-blue-700 via-blue-900 to-slate-950',
  crimson: 'bg-gradient-to-br from-rose-700 via-rose-900 to-slate-950',
  gold: 'bg-gradient-to-br from-amber-700 via-yellow-800 to-amber-950',
};

export interface DashboardHomeViewProps {
  user: User;
  accounts: BankAccount[];
  cards: BankCard[];
  transactions: Transaction[];
  dashboardLoading: boolean;
  dashboardError?: string;
  onRefresh: () => void;
  onNavigateToTransfer: (fromAccountId?: string) => void;
  onNavigateToTab: (tab: string) => void;
  onNavigateToAccountTransactions: (accountId: string) => void;
  showCardsOnly?: boolean;
}

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
  user,
  accounts,
  cards,
  transactions,
  dashboardLoading,
  dashboardError = '',
  onRefresh,
  onNavigateToTransfer,
  onNavigateToTab,
  onNavigateToAccountTransactions,
  showCardsOnly = false,
}) => {
  const [accountFilter, setAccountFilter] = useState<'All Accounts' | 'Checking' | 'Savings' | 'Investments'>('All Accounts');
  const [balanceVisible, setBalanceVisible] = useState(true);
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [investmentSummary, setInvestmentSummary] = useState<{
    totalValue: number;
    dailyChangePercent: number;
    dailyChangeValue: number;
    unrealizedProfitLoss: number;
    unrealizedProfitLossPercent: number;
    adminProfitOffset: number;
    positions: Array<{
      symbol: string;
      name: string;
      quantity: number;
      averageCost: number;
      marketPrice: number;
      marketValue: number;
    }>;
  } | null>(null);
  const [investmentSummaryLoading, setInvestmentSummaryLoading] = useState(true);
  const [investmentSummaryError, setInvestmentSummaryError] = useState('');
  const [cryptoVaultLoading, setCryptoVaultLoading] = useState(false);
  const [cryptoVaultError, setCryptoVaultError] = useState('');
  const [cryptoCopyError, setCryptoCopyError] = useState('');
  const [cryptoWallets, setCryptoWallets] = useState<{ bitcoin: string; usdtTrc20: string; usdtErc20: string }>({
    bitcoin: '',
    usdtTrc20: '',
    usdtErc20: '',
  });
  const [selectedCryptoNetwork, setSelectedCryptoNetwork] = useState<'BTC' | 'TRC-20' | 'ERC-20'>('BTC');
  const [copiedCryptoNetwork, setCopiedCryptoNetwork] = useState('');
  const [cardApplications, setCardApplications] = useState<CardApplication[]>([]);
  const [applyForCard, setApplyForCard] = useState(false);
  const [cardType, setCardType] = useState<'Debit' | 'Credit'>('Debit');
  const [cardNetwork, setCardNetwork] = useState<'Visa' | 'Mastercard'>('Visa');
  const [cardAccountId, setCardAccountId] = useState('');
  const [requestedLimit, setRequestedLimit] = useState('1000');
  const [submittingCard, setSubmittingCard] = useState(false);
  const [cardMessage, setCardMessage] = useState('');
  const [activeCardIndex, setActiveCardIndex] = useState(0);
  const [cardAction, setCardAction] = useState<'details' | 'limits' | null>(null);
  const [cardActionBusy, setCardActionBusy] = useState(false);
  const [revealedCardDetails, setRevealedCardDetails] = useState<BankCardDetails | null>(null);
  const [cardDetailsRevealed, setCardDetailsRevealed] = useState(false);
  const [revealingCardDetails, setRevealingCardDetails] = useState(false);
  const [cardDetailsError, setCardDetailsError] = useState('');
  const carouselRef = useRef<HTMLDivElement>(null);
  const [greeting, setGreeting] = useState(() => getLocalGreeting());

  const checkingAndSavings = accounts.filter((account) =>
    account.status === 'Active'
    && (account.account_type === 'Checking' || account.account_type === 'Savings')
  );
  const orderedCheckingAndSavings = [...checkingAndSavings].sort((left, right) => {
    if (left.account_type === right.account_type) return 0;
    return left.account_type === 'Checking' ? -1 : 1;
  });
  const defaultAccount = checkingAndSavings.find((account) => account.account_type === 'Checking') || checkingAndSavings[0] || accounts[0];
  const primaryCheckingAccount = checkingAndSavings.find((account) => account.account_type === 'Checking') || defaultAccount;
  const totalAccountBalance = checkingAndSavings.reduce(
    (total, account) => total + Math.max(0, account.available_balance ?? account.balance - (account.held_balance || 0)),
    0,
  );
  const totalNetWorth = totalAccountBalance
    + (investmentSummary?.totalValue || 0)
    + (investmentSummary?.adminProfitOffset || 0);
  const visibleAccounts = accountFilter === 'All Accounts'
    ? orderedCheckingAndSavings
    : accountFilter === 'Investments'
      ? []
      : orderedCheckingAndSavings.filter((account) => account.account_type === accountFilter);
  const legacyCards = accounts.filter((account) => account.account_type === 'Credit Card' && account.status === 'Active');
  const carouselItems = [
    ...cards.map((card) => ({ kind: 'issued' as const, card })),
    ...legacyCards.map((account) => ({ kind: 'legacy' as const, account })),
  ];
  const selectedCarouselItem = carouselItems[activeCardIndex] || null;
  const recentTransactions = useMemo(() => transactions.slice(0, 3), [transactions]);

  useEffect(() => {
    setActiveCardIndex((index) => Math.min(index, Math.max(0, carouselItems.length - 1)));
  }, [cards.length, legacyCards.length]);

  const freezeSelectedCard = async () => {
    if (selectedCarouselItem?.kind !== 'issued') return;
    const nextStatus = selectedCarouselItem.card.status === 'Locked' ? 'Active' : 'Locked';
    const actionLabel = nextStatus === 'Locked' ? 'freeze' : 'unfreeze';
    if (!window.confirm(`Are you sure you want to ${actionLabel} this ${selectedCarouselItem.card.card_type.toLowerCase()} card ending in ${selectedCarouselItem.card.last4}?`)) return;

    setCardActionBusy(true);
    setCardMessage('');
    try {
      const response = await fetch(`/api/user/cards/${encodeURIComponent(selectedCarouselItem.card.id)}/status`, {
        method: 'PATCH',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ status: nextStatus }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || `Unable to ${actionLabel} this card.`);
      setCardMessage(`Card ending in ${selectedCarouselItem.card.last4} ${nextStatus === 'Locked' ? 'frozen' : 'unfrozen'}.`);
      onRefresh();
    } catch (error) {
      setCardMessage(error instanceof Error ? error.message : `Unable to ${actionLabel} this card.`);
    } finally {
      setCardActionBusy(false);
    }
  };

  const revealSelectedCardDetails = async () => {
    if (selectedCarouselItem?.kind !== 'issued' || selectedCarouselItem.card.cardDetailsUnlocked !== true) return;
    if (revealedCardDetails) {
      setCardDetailsRevealed((revealed) => !revealed);
      return;
    }
    setRevealingCardDetails(true);
    setCardDetailsError('');
    try {
      const response = await fetch(`/api/user/cards/${encodeURIComponent(selectedCarouselItem.card.id)}/details`, {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to retrieve card details.');
      setRevealedCardDetails(data as BankCardDetails);
      setCardDetailsRevealed(true);
    } catch (error) {
      setCardDetailsError(error instanceof Error ? error.message : 'Unable to retrieve card details.');
    } finally {
      setRevealingCardDetails(false);
    }
  };

  const openCardDetails = () => {
    setRevealedCardDetails(null);
    setCardDetailsRevealed(false);
    setCardDetailsError('');
    setCardAction('details');
  };

  const closeCardAction = () => {
    setCardAction(null);
    setRevealedCardDetails(null);
    setCardDetailsRevealed(false);
    setCardDetailsError('');
  };

  const scrollToCard = (index: number) => {
    const container = carouselRef.current;
    const card = container?.children.item(index) as HTMLElement | null;
    if (!container || !card) return;
    setActiveCardIndex(index);
    const cardRect = card.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    container.scrollTo({
      left: container.scrollLeft + cardRect.left - containerRect.left - (container.clientWidth - card.clientWidth) / 2,
      behavior: 'smooth',
    });
  };

  useEffect(() => {
    const refreshGreeting = () => setGreeting(getLocalGreeting());
    refreshGreeting();
    const timer = window.setInterval(refreshGreeting, 60_000);
    document.addEventListener('visibilitychange', refreshGreeting);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshGreeting);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    const loadCardApplications = async () => {
      try {
        const response = await fetch('/api/user/card-applications', { headers: getAuthHeaders(), credentials: 'include' });
        if (!response.ok) throw new Error('Unable to load card application information.');
        const data = await response.json();
        if (!cancelled) setCardApplications(Array.isArray(data.applications) ? data.applications : []);
      } catch (error) {
        console.error('Unable to load card application information:', error);
      }
    };
    const timer = window.setTimeout(() => void loadCardApplications(), 1000);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [user.id]);

  useEffect(() => {
    if (showCardsOnly || !receiveModalOpen) return;
    let cancelled = false;
    const loadCryptoWallets = async () => {
      setCryptoVaultLoading(true);
      setCryptoVaultError('');
      try {
        const response = await fetch('/api/user/wallets', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load your assigned crypto deposit addresses.');
        if (!cancelled) {
          setCryptoWallets({
            bitcoin: data.user?.btcAddress || '',
            usdtTrc20: data.user?.usdtTrc20Address || '',
            usdtErc20: data.user?.usdtErc20Address || '',
          });
        }
      } catch (error) {
        if (!cancelled) setCryptoVaultError(error instanceof Error ? error.message : 'Unable to load your assigned crypto deposit addresses.');
      } finally {
        if (!cancelled) setCryptoVaultLoading(false);
      }
    };
    void loadCryptoWallets();
    return () => { cancelled = true; };
  }, [receiveModalOpen, showCardsOnly, user.id]);

  useEffect(() => {
    if (showCardsOnly) return;
    let cancelled = false;
    const loadInvestmentSummary = async () => {
      setInvestmentSummaryLoading(true);
      setInvestmentSummaryError('');
      try {
        const response = await fetch('/api/investments/portfolio', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to load your investment portfolio.');
        if (!cancelled) {
          setInvestmentSummary({
            totalValue: Number(data.totalValue) || 0,
            dailyChangePercent: Number(data.dailyChangePercent) || 0,
            dailyChangeValue: Number(data.dailyChangeValue) || 0,
            unrealizedProfitLoss: Number(data.unrealizedProfitLoss) || 0,
            unrealizedProfitLossPercent: Number(data.unrealizedProfitLossPercent) || 0,
            adminProfitOffset: Number(data.adminProfitOffset) || 0,
            positions: Array.isArray(data.positions) ? data.positions : [],
          });
        }
      } catch (error) {
        if (!cancelled) setInvestmentSummaryError(error instanceof Error ? error.message : 'Unable to load your investment portfolio.');
      } finally {
        if (!cancelled) setInvestmentSummaryLoading(false);
      }
    };
    void loadInvestmentSummary();
    return () => { cancelled = true; };
  }, [showCardsOnly, user.id]);

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(amount);

  const handleReceive = () => {
    setCryptoVaultError('');
    setCryptoCopyError('');
    setCryptoWallets({ bitcoin: '', usdtTrc20: '', usdtErc20: '' });
    setCryptoVaultLoading(true);
    setReceiveModalOpen(true);
  };

  const selectedCryptoAddress = selectedCryptoNetwork === 'BTC'
    ? cryptoWallets.bitcoin
    : selectedCryptoNetwork === 'TRC-20' ? cryptoWallets.usdtTrc20 : cryptoWallets.usdtErc20;

  const copyCryptoAddress = async () => {
    const address = selectedCryptoAddress;
    if (!address) return;
    setCryptoCopyError('');
    try {
      await navigator.clipboard.writeText(address);
      setCopiedCryptoNetwork(selectedCryptoNetwork);
      window.setTimeout(() => setCopiedCryptoNetwork(''), 1800);
    } catch {
      setCryptoCopyError('Clipboard access is unavailable. Select and copy the address manually.');
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
    <div className="mx-auto w-full min-w-0 max-w-full space-y-7 pb-6 sm:max-w-5xl">
      {!showCardsOnly && <>
      <header className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
        <div className="flex min-w-0 items-center gap-3">
          <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full border-2 border-amber-400 bg-emerald-50 text-teal-800 flex items-center justify-center text-lg font-semibold">
              {user.profilePicture ? (
                <img src={user.profilePicture} alt={`${user.full_name} profile`} className="h-full w-full object-cover" />
              ) : (user.full_name?.charAt(0).toUpperCase() || 'U')}
          </div>
          <div className="min-w-0">
            <p className="text-sm text-slate-500">{greeting} 👋</p>
            <h1 className="truncate text-lg font-semibold text-slate-900">{user.full_name}</h1>
          </div>
        </div>
      </header>

      <PushNotificationBanner userId={user.id} />

      {dashboardLoading ? (
        <section aria-label="Loading total account balance" className="rounded-3xl border border-teal-100 bg-white p-5 shadow-sm sm:p-7" aria-busy="true">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1 space-y-2">
              <div className="h-4 w-32 animate-pulse rounded bg-slate-200" />
              <div className="h-4 w-28 animate-pulse rounded bg-slate-100" />
            </div>
            <div className="h-10 w-28 animate-pulse rounded-xl bg-slate-100" />
          </div>
          <div className="mt-8 space-y-2">
            <div className="h-4 w-36 animate-pulse rounded bg-slate-100" />
            <div className="h-10 w-48 animate-pulse rounded bg-slate-200 sm:h-11" />
          </div>
        </section>
      ) : (
      <section aria-label="Total account balance" className="rounded-3xl border border-teal-100 bg-gradient-to-br from-white via-white to-emerald-50 p-5 shadow-sm sm:p-7">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Total Net Worth</p>
            <p className="mt-1 text-sm text-slate-600">Checking, savings, and investments</p>
          </div>
        </div>
        <div className="mt-8">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Combined balances</span>
            <button type="button" aria-label={balanceVisible ? 'Hide balance' : 'Show balance'} onClick={() => setBalanceVisible((visible) => !visible)} className="rounded p-1 text-slate-600 hover:bg-slate-100">
              {balanceVisible ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            </button>
          </div>
          <p className="mt-1 break-all text-3xl font-bold tracking-tight text-teal-950 sm:text-4xl">
            {!balanceVisible
              ? '••••••'
              : investmentSummaryLoading || investmentSummaryError
                ? '—'
                : formatMoney(totalNetWorth)}
          </p>
          {investmentSummaryError && <p role="status" className="mt-2 text-xs text-amber-800">Investment valuation is unavailable; combined total is not shown.</p>}
        </div>
        <p className="mt-5 inline-flex max-w-full flex-wrap items-center rounded-full border border-slate-200 bg-white/70 px-3 py-1.5 text-[10px] font-medium leading-4 text-slate-500 sm:text-xs">
          Investment products are Not FDIC Insured <span aria-hidden="true" className="mx-1.5 text-slate-300">•</span>
          No Bank Guarantee <span aria-hidden="true" className="mx-1.5 text-slate-300">•</span>
          May Lose Value
        </p>
      </section>
      )}
      <section aria-label="Quick actions" className="grid grid-cols-5 gap-2">
        <button type="button" onClick={handleReceive} className="flex min-w-0 flex-col items-center gap-2 text-center text-xs font-medium text-slate-700">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm sm:h-14 sm:w-14"><ArrowDownLeft className="h-5 w-5" /></span>
          <span className="leading-tight">Receive</span>
        </button>
        <button type="button" onClick={() => onNavigateToTransfer(primaryCheckingAccount?.id)} className="flex min-w-0 flex-col items-center gap-2 text-center text-xs font-medium text-slate-700">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm sm:h-14 sm:w-14"><ArrowUpRight className="h-5 w-5" /></span>
          <span className="leading-tight">Transfer</span>
        </button>
        <button type="button" onClick={() => onNavigateToTab('investments')} className="flex min-w-0 flex-col items-center gap-2 text-center text-xs font-medium text-teal-800">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-teal-200 bg-white text-teal-800 shadow-sm sm:h-14 sm:w-14"><BriefcaseBusiness className="h-5 w-5" /></span>
          <span className="leading-tight">Invest</span>
        </button>
        <button type="button" onClick={() => onNavigateToTab('grants')} className="flex min-w-0 flex-col items-center gap-2 text-center text-xs font-medium text-teal-800">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm sm:h-14 sm:w-14"><HandCoins className="h-5 w-5" /></span>
          <span className="leading-tight">Grants</span>
        </button>
        <button type="button" onClick={() => onNavigateToTab('profile')} className="flex min-w-0 flex-col items-center gap-2 text-center text-xs font-medium text-slate-700">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm sm:h-14 sm:w-14"><CircleEllipsis className="h-5 w-5" /></span>
          <span className="leading-tight">More</span>
        </button>
      </section>
      <section aria-label="Accounts and investments" className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">My Accounts</h2>
            <p className="text-sm text-slate-500">View all your active accounts and balances.</p>
          </div>
        </div>
        <div className="grid w-full grid-cols-4 gap-1 rounded-xl bg-slate-100 p-1" role="group" aria-label="Filter accounts">
          {(['All Accounts', 'Checking', 'Savings', 'Investments'] as const).map((filter) => (
            <button
              key={filter}
              type="button"
              aria-pressed={accountFilter === filter}
              onClick={() => filter === 'Investments' ? onNavigateToTab('investments') : setAccountFilter(filter)}
              className={`min-h-10 min-w-0 truncate rounded-lg px-1 py-2 text-[11px] font-medium leading-tight transition-colors sm:px-3 sm:text-sm sm:font-semibold ${accountFilter === filter ? 'bg-teal-800 text-white shadow-sm' : 'text-slate-600 hover:bg-white hover:text-slate-900'}`}
            >
              {filter}
            </button>
          ))}
        </div>
        {dashboardLoading ? (
          <div className="space-y-3" aria-label="Loading accounts" aria-busy="true">
            {[0, 1].map((item) => (
              <div key={item} className="min-h-48 animate-pulse rounded-2xl border border-slate-200 bg-white p-5">
                <div className="h-4 w-28 rounded bg-slate-200" />
                <div className="mt-3 h-3 w-40 rounded bg-slate-100" />
                <div className="mt-8 h-8 w-36 rounded bg-slate-200" />
                <div className="mt-6 h-10 rounded-lg bg-slate-100" />
              </div>
            ))}
          </div>
        ) : accountFilter === 'Investments' ? null : visibleAccounts.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
            {visibleAccounts.map((account) => {
              const available = Math.max(0, account.available_balance ?? account.balance - (account.held_balance || 0));
              const apy = Math.max(0, Number(account.interest_rate) || 0) * 100;
              return (
                <button
                  key={account.id}
                  type="button"
                  onClick={() => onNavigateToAccountTransactions(account.id)}
                  aria-label={`${account.nickname}, available balance ${balanceVisible ? formatMoney(available) : 'hidden'}. View account activity.`}
                  className="flex min-h-[72px] w-full items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 text-left transition-colors last:border-b-0 hover:bg-slate-50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-teal-700 sm:px-4"
                >
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="truncate text-sm font-semibold text-slate-900">{account.nickname}</span>
                      {account.account_type === 'Savings' && (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-800">
                          {apy.toFixed(2)}% APY
                        </span>
                      )}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-slate-500">•••• {account.account_number.slice(-4)}</span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2">
                    <span className="text-right text-sm font-bold tabular-nums text-slate-950">
                      {balanceVisible ? formatMoney(available) : '••••••'}
                      <span className="block text-[10px] font-normal text-slate-500">Available</span>
                    </span>
                    <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400" />
                  </span>
                </button>
              );
            })}
          </div>
        ) : accountFilter === 'Investments' ? null : (
          accountFilter === 'Savings' ? (
            <div className="rounded-2xl border border-dashed border-emerald-300 bg-white px-4 py-7 text-center">
              <p className="font-semibold text-slate-900">Open a Savings Account</p>
              <p className="mt-1 text-sm text-slate-500">Your Advantage Savings account earns 1.50% APY. No opening balance is required.</p>
              <button type="button" onClick={() => void onRefresh()} className="mt-4 min-h-11 rounded-lg bg-teal-800 px-5 text-sm font-semibold text-white hover:bg-teal-900">
                Open Savings Account
              </button>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-7 text-center text-sm text-slate-500">
              No active {accountFilter === 'All Accounts' ? 'checking or savings' : accountFilter.toLowerCase()} accounts are available.
            </div>
          )
        )}
        {(accountFilter === 'All Accounts' || accountFilter === 'Investments') && (
          <button
            type="button"
            onClick={() => onNavigateToTab('investments')}
            aria-label={`Investment Portfolio, ${investmentSummaryLoading ? 'loading value' : investmentSummaryError ? 'value unavailable' : balanceVisible ? formatMoney(investmentSummary?.totalValue || 0) : 'value hidden'}. Open portfolio details.`}
            className="flex min-h-[72px] w-full items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-left shadow-sm transition-colors hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 sm:px-4"
          >
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-semibold text-slate-900">Investment Portfolio</span>
              <span className="mt-0.5 block truncate text-xs text-slate-500">
                {investmentSummaryError
                  ? 'Portfolio summary unavailable'
                  : investmentSummaryLoading
                  ? 'Loading daily P/L…'
                  : `Daily P/L: ${(investmentSummary?.dailyChangeValue || 0) > 0 ? '+' : ''}${formatMoney(investmentSummary?.dailyChangeValue || 0)} (${(investmentSummary?.dailyChangePercent || 0).toFixed(2)}%)`}
              </span>
              {!investmentSummaryError && !investmentSummaryLoading && (
                <span className={`mt-0.5 block truncate text-xs font-semibold ${(investmentSummary?.unrealizedProfitLoss || 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
                  Unrealized P/L: {(investmentSummary?.unrealizedProfitLoss || 0) > 0 ? '+' : ''}{formatMoney(investmentSummary?.unrealizedProfitLoss || 0)} ({(investmentSummary?.unrealizedProfitLossPercent || 0) > 0 ? '+' : ''}{(investmentSummary?.unrealizedProfitLossPercent || 0).toFixed(2)}%)
                </span>
              )}
              {!investmentSummaryError && !investmentSummaryLoading && (investmentSummary?.adminProfitOffset || 0) !== 0 && (
                <span className="block truncate text-[11px] text-amber-800">
                  Includes administrative P/L valuation adjustment: {(investmentSummary?.adminProfitOffset || 0) > 0 ? '+' : ''}{formatMoney(investmentSummary?.adminProfitOffset || 0)}.
                </span>
              )}
              <span className="block truncate text-[10px] leading-4 text-slate-500">Not FDIC insured · No bank guarantee · May lose value</span>
            </span>
            <span className="flex shrink-0 items-center gap-2">
              <span className="text-right text-sm font-bold tabular-nums text-slate-950">
                {investmentSummaryLoading || investmentSummaryError ? '—' : balanceVisible ? formatMoney(investmentSummary?.totalValue || 0) : '••••••'}
                <span className="block text-[10px] font-normal text-slate-500">Portfolio value</span>
              </span>
              <ChevronRight aria-hidden="true" className="h-4 w-4 text-slate-400" />
            </span>
          </button>
        )}
        {(accountFilter === 'All Accounts' || accountFilter === 'Investments') && investmentSummaryError && (
          <p role="status" className="text-xs text-amber-800">{investmentSummaryError}</p>
        )}
      </section>
      {dashboardError && !dashboardLoading && (
        <p role="status" className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{dashboardError}</p>
      )}

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
        {dashboardLoading ? (
          <div className="flex snap-x snap-mandatory gap-4 overflow-hidden pb-4" aria-label="Loading active cards" aria-busy="true">
            <div className="aspect-[1.586/1] w-[88%] max-w-md shrink-0 snap-center animate-pulse rounded-2xl bg-slate-200" />
          </div>
        ) : carouselItems.length > 0 ? (
          <>
          <div
            ref={carouselRef}
            onScroll={(event) => {
              const container = event.currentTarget;
              const children = Array.from(container.children) as HTMLElement[];
              const containerCenter = container.getBoundingClientRect().left + container.clientWidth / 2;
              const nearestIndex = children.reduce((nearest, child, index) => {
                const childCenter = child.getBoundingClientRect().left + child.clientWidth / 2;
                const nearestCenter = children[nearest].getBoundingClientRect().left + children[nearest].clientWidth / 2;
                return Math.abs(childCenter - containerCenter) < Math.abs(nearestCenter - containerCenter)
                  ? index
                  : nearest;
              }, 0);
              setActiveCardIndex(nearestIndex);
            }}
            className="flex snap-x snap-mandatory gap-4 overflow-x-auto pb-4"
            aria-label="Your cards"
          >
            {carouselItems.map((item) => item.kind === 'issued' ? (
              <article key={item.card.id} className={`relative isolate flex aspect-[1.586/1] w-[88%] max-w-md shrink-0 snap-center flex-col justify-between gap-2 overflow-hidden rounded-2xl p-3.5 text-white shadow-lg sm:p-4 ${CARD_COLOR_CLASSES[item.card.cardColor || 'emerald']}`}>
                <div aria-hidden="true" className="absolute -right-12 -top-16 -z-10 h-56 w-56 rounded-full border border-white/10" />
                <div aria-hidden="true" className="absolute -right-4 -top-8 -z-10 h-40 w-40 rounded-full border border-white/10" />
                <div className="relative flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">{item.card.card_type} CARD</p>
                    <p className="mt-0.5 break-words text-xs font-semibold leading-tight sm:text-sm">{item.card.product_name}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-bold tracking-wide sm:text-xs">{item.card.network || 'Visa'}</span>
                </div>
                <div className="relative flex items-center gap-2">
                  <div aria-hidden="true" className="grid h-8 w-10 grid-cols-2 gap-px overflow-hidden rounded-md border border-amber-200/40 bg-amber-200/80 p-1">
                    <span className="rounded-sm border border-amber-900/20" /><span className="rounded-sm border border-amber-900/20" /><span className="rounded-sm border border-amber-900/20" /><span className="rounded-sm border border-amber-900/20" />
                  </div>
                  <CreditCard aria-hidden="true" className="h-5 w-5 text-white/60" />
                  <span className={`ml-auto rounded-full px-2 py-1 text-[9px] font-bold uppercase tracking-wide ${item.card.status === 'Locked' ? 'bg-rose-500/20 text-rose-100' : 'bg-white/10 text-white/80'}`}>{item.card.status === 'Locked' ? 'Frozen' : 'Active'}</span>
                </div>
                <p className="relative break-words font-mono text-sm leading-tight tracking-[0.12em] sm:text-base sm:tracking-[0.16em]">{item.card.masked_number || `•••• •••• •••• ${item.card.last4}`}</p>
                <div className="relative grid grid-cols-2 gap-2 border-t border-white/20 pt-2">
                  <div className="min-w-0"><p className="text-[8px] uppercase tracking-wider text-white/65">Cardholder</p><p className="mt-0.5 break-words text-[10px] font-semibold uppercase leading-tight tracking-wide sm:text-xs">{user.full_name}</p></div>
                  <div className="min-w-0 text-right"><p className="text-[8px] uppercase leading-tight tracking-wider text-white/65">{item.card.card_type === 'Credit' ? 'Credit Limit' : 'Available Balance'}</p><p className="mt-0.5 break-words text-xs font-bold leading-tight tabular-nums sm:text-sm">{formatMoney(item.card.card_type === 'Credit' ? item.card.credit_limit : (item.card.linked_account_available || 0))}</p></div>
                </div>
              </article>
            ) : (
              <article key={item.account.id} className="flex aspect-[1.586/1] w-[88%] max-w-md shrink-0 snap-center flex-col justify-between overflow-hidden rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                <div className="flex items-center justify-between">
                  <CreditCard className="h-5 w-5 text-slate-600" />
                  <span className="rounded-full bg-slate-100 px-2 py-1 text-xs text-slate-600">{item.account.status}</span>
                </div>
                <div>
                  <p className="break-words font-medium leading-tight text-slate-900">{item.account.nickname}</p>
                  <p className="mt-1 text-sm text-slate-500">•••• {item.account.account_number.slice(-4)}</p>
                </div>
                <p className="break-words text-base font-semibold leading-tight tabular-nums text-slate-900 sm:text-lg">{formatMoney(item.account.balance)}</p>
              </article>
            ))}
          </div>
          <div className="flex justify-center gap-2" aria-label="Choose active card">
            {carouselItems.map((item, index) => (
              <button
                key={item.kind === 'issued' ? item.card.id : item.account.id}
                type="button"
                onClick={() => scrollToCard(index)}
                aria-label={`Show card ${index + 1} of ${carouselItems.length}`}
                aria-current={activeCardIndex === index ? 'true' : undefined}
                className={`h-2.5 rounded-full transition-all ${activeCardIndex === index ? 'w-6 bg-teal-700' : 'w-2.5 bg-slate-300 hover:bg-slate-400'}`}
              />
            ))}
          </div>
          <div className="grid grid-cols-3 gap-2">
            <button type="button" onClick={() => void freezeSelectedCard()} disabled={cardActionBusy || selectedCarouselItem?.kind !== 'issued'} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:border-rose-200 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-50 sm:gap-2 sm:text-sm">
              {selectedCarouselItem?.kind === 'issued' && selectedCarouselItem.card.status === 'Locked' ? <LockKeyhole className="h-4 w-4 shrink-0" /> : <Snowflake className="h-4 w-4 shrink-0" />}
              <span>{cardActionBusy ? 'Updating…' : selectedCarouselItem?.kind === 'issued' && selectedCarouselItem.card.status === 'Locked' ? 'Unfreeze' : 'Freeze Card'}</span>
            </button>
            <button type="button" onClick={openCardDetails} disabled={!selectedCarouselItem} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:gap-2 sm:text-sm">
              <Eye className="h-4 w-4 shrink-0" /><span className="text-center leading-tight">Show Details<br /><span className="font-normal">(CVV)</span></span>
            </button>
            <button type="button" onClick={() => setCardAction('limits')} disabled={!selectedCarouselItem} className="flex min-h-11 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50 sm:gap-2 sm:text-sm">
              <SlidersHorizontal className="h-4 w-4 shrink-0" /><span>Manage Limits</span>
            </button>
          </div>
          </>
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
                  {application.review_reason?.trim().toLowerCase() !== application.status.trim().toLowerCase()
                    && application.review_reason
                    && <p className="mt-1 text-xs text-slate-500">{application.review_reason}</p>}
                </div>
                <span className={`w-fit rounded-full px-2.5 py-1 text-xs font-medium ${application.status === 'Approved' ? 'bg-emerald-50 text-emerald-700' : application.status === 'Rejected' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-800'}`}>{application.status}</span>
              </div>
            ))}
          </div>
        )}
        {cardMessage && <p role="status" className="text-xs text-slate-600">{cardMessage}</p>}
        {cardAction && selectedCarouselItem && (
          <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/50 p-4" onMouseDown={(event) => {
            if (event.target === event.currentTarget) closeCardAction();
          }}>
            <section role="dialog" aria-modal="true" aria-labelledby="card-action-title" className="w-full max-w-md space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Card ending in {selectedCarouselItem.kind === 'issued' ? selectedCarouselItem.card.last4 : selectedCarouselItem.account.account_number.slice(-4)}</p>
                  <h3 id="card-action-title" className="mt-1 text-lg font-semibold text-slate-950">{cardAction === 'details' ? 'Card details' : 'Manage card limits'}</h3>
                </div>
                <button type="button" onClick={closeCardAction} aria-label="Close dialog" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X className="h-5 w-5" /></button>
              </div>
              {cardAction === 'details' ? (
                <>
                  <dl className="divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                    <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">Cardholder</dt><dd className="text-right font-medium text-slate-900">{user.full_name}</dd></div>
                    <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">Card number</dt><dd className="font-mono font-medium text-slate-900">{cardDetailsRevealed && revealedCardDetails ? revealedCardDetails.cardNumber : selectedCarouselItem.kind === 'issued' ? selectedCarouselItem.card.masked_number || `•••• •••• •••• ${selectedCarouselItem.card.last4}` : `•••• ${selectedCarouselItem.account.account_number.slice(-4)}`}</dd></div>
                    {selectedCarouselItem.kind === 'issued' && (
                      <>
                        <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">Type / network</dt><dd className="text-right font-medium text-slate-900">{selectedCarouselItem.card.card_type} · {selectedCarouselItem.card.network}</dd></div>
                        <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">Status</dt><dd className="font-medium text-slate-900">{selectedCarouselItem.card.status === 'Locked' ? 'Frozen' : 'Active'}</dd></div>
                      </>
                    )}
                    {revealedCardDetails && cardDetailsRevealed && (
                      <>
                        <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">Expiry date</dt><dd className="font-mono font-medium text-slate-900">{revealedCardDetails.expiryDate}</dd></div>
                        <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">CVV</dt><dd className="font-mono font-medium text-slate-900">{revealedCardDetails.cvv}</dd></div>
                      </>
                    )}
                  </dl>
                  {selectedCarouselItem.kind !== 'issued' || selectedCarouselItem.card.cardDetailsUnlocked !== true ? (
                    <p className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm leading-5 text-amber-900">For your security, full card numbers, expiration dates, and CVVs are hidden. Please contact customer support to request authorization to unlock these details.</p>
                  ) : (
                    <div className="space-y-2">
                      <button
                        type="button"
                        onClick={() => void revealSelectedCardDetails()}
                        disabled={revealingCardDetails}
                        className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {revealingCardDetails ? 'Retrieving details…' : cardDetailsRevealed ? '[ Hide Details & CVV ]' : '[ Reveal Details & CVV ]'}
                      </button>
                      {cardDetailsError && <p role="alert" className="text-sm text-rose-700">{cardDetailsError}</p>}
                    </div>
                  )}
                </>
              ) : (
                <>
                  <p className="text-sm leading-5 text-slate-600">
                    {selectedCarouselItem.kind === 'issued' && selectedCarouselItem.card.card_type === 'Credit'
                      ? `Your current credit limit is ${formatMoney(selectedCarouselItem.card.credit_limit)}. Limit changes require Member Services review.`
                      : 'This card does not have a self-service spending-limit setting. Contact Member Services for assistance.'}
                  </p>
                  <a
                    href={`mailto:americancreditunion.financing@gmail.com?subject=${encodeURIComponent('Card limit request')}&body=${encodeURIComponent(`Hello Member Services,\n\nI would like assistance with the limit for the card ending in ${selectedCarouselItem.kind === 'issued' ? selectedCarouselItem.card.last4 : selectedCarouselItem.account.account_number.slice(-4)}.\n\nName: ${user.full_name}\n`)}`}
                    className="inline-flex min-h-11 w-full items-center justify-center rounded-xl bg-teal-700 px-4 text-sm font-semibold text-white hover:bg-teal-800"
                  >
                    Contact Member Services
                  </a>
                </>
              )}
            </section>
          </div>
        )}
      </section>

      {!showCardsOnly && (recentTransactions.length > 0 || dashboardLoading) && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <button type="button" onClick={() => onNavigateToTab('history')} className="text-sm font-medium text-slate-600 hover:text-slate-900">See all</button>
          </div>
          {dashboardLoading ? (
            <div className="space-y-4 rounded-2xl border border-slate-200 bg-white px-3 py-4 sm:px-4" aria-label="Loading recent activity" aria-busy="true">
              {[0, 1, 2].map((item) => (
                <div key={item} className="flex items-center gap-3">
                  <div className="h-8 w-8 animate-pulse rounded-full bg-slate-100" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-2/3 animate-pulse rounded bg-slate-200" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-slate-100" />
                  </div>
                  <div className="h-4 w-20 animate-pulse rounded bg-slate-100" />
                </div>
              ))}
            </div>
          ) : <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-3 sm:px-4">
            {recentTransactions.map((transaction) => {
              const category = transaction.category?.toLowerCase() || '';
              const description = formatTransactionDescription(transaction.description).toLowerCase();
              const isGrant = category.includes('grant')
                || transaction.id.startsWith('tx_grant_')
                || description.includes('grant');
              const isIncoming = isGrant || [
                'deposit',
                'transfer_in',
                'admin_credit',
                'admin_release',
                'card_credit',
              ].includes(transaction.type)
                || (transaction.type === 'admin_adjustment' && transaction.amount > 0);
              const isInvestmentAdjustment = transaction.type === 'investment_adjustment';
              const amount = Math.abs(transaction.amount)
                + (!isIncoming && transaction.type === 'transfer_out'
                  ? (transaction.transfer_fee || 0) + (transaction.transfer_tax || 0)
                  : 0);
              const AmountIcon = isInvestmentAdjustment ? ArrowLeftRight : isIncoming ? ArrowDownLeft : ArrowUpRight;
              return (
                <div key={transaction.id} className="flex min-w-0 items-center gap-3 py-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${isInvestmentAdjustment ? 'bg-teal-50 text-teal-700' : isIncoming ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    <AmountIcon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{formatTransactionDescription(transaction.description)}</p>
                    <p className="truncate text-xs text-slate-500">{transaction.date}</p>
                  </div>
                  <p className={`shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums ${isInvestmentAdjustment ? 'text-teal-800' : isIncoming ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {isInvestmentAdjustment
                      ? `P/L ${transaction.amount > 0 ? '+' : transaction.amount < 0 ? '−' : ''}${formatMoney(amount)}`
                      : `${isIncoming ? '+' : '−'}${transaction.formatted_amount && transaction.currency !== 'USD'
                        ? `${transaction.formatted_amount} · ${formatMoney(transaction.amount_usd ?? 0)} USD`
                        : formatMoney(transaction.amount_usd ?? amount)}`}
                  </p>
                </div>
              );
            })}
          </div>}
        </section>
      )}

      {receiveModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onClick={() => setReceiveModalOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="crypto-receive-title" onClick={(event) => event.stopPropagation()} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Crypto deposit</p>
                <h2 id="crypto-receive-title" className="mt-1 text-xl font-bold text-slate-900">Receive cryptocurrency</h2>
                <p className="mt-1 text-sm text-slate-600">Choose an asset to view your assigned deposit address.</p>
              </div>
              <button type="button" onClick={() => setReceiveModalOpen(false)} aria-label="Close crypto deposit details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X aria-hidden="true" className="h-5 w-5" /></button>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2" role="group" aria-label="Choose cryptocurrency">
              <button
                type="button"
                aria-pressed={selectedCryptoNetwork === 'BTC'}
                onClick={() => { setSelectedCryptoNetwork('BTC'); setCryptoCopyError(''); }}
                className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold ${selectedCryptoNetwork === 'BTC' ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Bitcoin (BTC)
              </button>
              <button
                type="button"
                aria-pressed={selectedCryptoNetwork !== 'BTC'}
                onClick={() => {
                  const assignedNetwork = cryptoWallets.usdtTrc20
                    ? 'TRC-20'
                    : cryptoWallets.usdtErc20 ? 'ERC-20' : 'TRC-20';
                  setSelectedCryptoNetwork(assignedNetwork);
                  setCryptoCopyError('');
                }}
                className={`min-h-11 rounded-lg border px-3 py-2 text-sm font-semibold ${selectedCryptoNetwork !== 'BTC' ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
              >
                Tether (USDT)
              </button>
            </div>

            {selectedCryptoNetwork !== 'BTC' && (
              <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="Choose USDT network">
                {(['TRC-20', 'ERC-20'] as const).map((network) => (
                  <button
                    key={network}
                    type="button"
                    aria-pressed={selectedCryptoNetwork === network}
                    onClick={() => { setSelectedCryptoNetwork(network); setCryptoCopyError(''); }}
                    className={`min-h-10 rounded-lg border px-3 py-2 text-sm font-medium ${selectedCryptoNetwork === network ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
                  >
                    {network}
                  </button>
                ))}
              </div>
            )}
            <div className="mt-4 rounded-xl border border-slate-200 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-900">
                  {selectedCryptoNetwork === 'BTC' ? 'Bitcoin deposit address' : `USDT deposit address`}
                </h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                  {selectedCryptoNetwork === 'BTC' ? 'Bitcoin Mainnet' : selectedCryptoNetwork}
                </span>
              </div>

              {cryptoVaultLoading ? (
                <p role="status" className="mt-3 text-sm text-slate-600">Loading your assigned deposit address…</p>
              ) : cryptoVaultError ? (
                <p role="alert" className="mt-3 break-words text-sm text-rose-700">{cryptoVaultError}</p>
              ) : selectedCryptoAddress ? (
                <>
                  <p className="mt-3 break-all rounded-lg bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-900">{selectedCryptoAddress}</p>
                  <button type="button" onClick={() => void copyCryptoAddress()} className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900">
                    {copiedCryptoNetwork === selectedCryptoNetwork ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                    {copiedCryptoNetwork === selectedCryptoNetwork ? 'Address copied' : 'Copy Address'}
                  </button>
                  {cryptoCopyError && <p role="alert" className="mt-2 text-xs text-rose-700">{cryptoCopyError}</p>}
                </>
              ) : (
                <p role="status" className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  Digital vault address provisioning is in progress. Please contact Member Services for details.
                </p>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">
                Only send {selectedCryptoNetwork === 'BTC' ? 'BTC on Bitcoin Mainnet' : `USDT on ${selectedCryptoNetwork}`} to this address. Sending another asset or using a different network may result in permanent loss.
              </p>
            </div>

            {selectedCryptoAddress && (
              <div className="mx-auto mt-4 grid aspect-square w-44 place-items-center rounded-xl border border-slate-200 bg-white p-3" aria-label={`${selectedCryptoNetwork} deposit QR code`}>
                <QRCodeSVG
                  value={selectedCryptoAddress}
                  size={160}
                  bgColor="#ffffff"
                  fgColor="#0f172a"
                  level="M"
                  includeMargin
                  title={`${selectedCryptoNetwork} wallet address QR code`}
                />
              </div>
            )}
          </section>
        </div>
      )}

    </div>
  );
};

export const CardsManagementView: React.FC<Omit<DashboardHomeViewProps, 'showCardsOnly'>> = (props) => (
  <DashboardHomeView {...props} showCardsOnly />
);
