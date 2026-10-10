import React, { useMemo, useState, ChangeEvent, useEffect } from 'react';
import { User, BankAccount, Transaction, BankCard, CardApplication } from '../types';
import { getAuthHeaders } from '../utils/api';
import { formatTransactionDescription } from '../utils/transactionFormatting';
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  Check,
  ChevronRight,
  CircleEllipsis,
  Copy,
  CreditCard,
  Eye,
  EyeOff,
  HandCoins,
  Landmark,
  Plus,
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
  transactions: Transaction[];
  onRefresh: () => void;
  onNavigateToTransfer: (fromAccountId?: string) => void;
  onNavigateToTab: (tab: string) => void;
  onProfilePictureChange: (profilePicture: string) => void;
  showCardsOnly?: boolean;
}

export const DashboardHomeView: React.FC<DashboardHomeViewProps> = ({
  user,
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
  const [receiveModalOpen, setReceiveModalOpen] = useState(false);
  const [receiveAccountId, setReceiveAccountId] = useState('');
  const [receiveCopyState, setReceiveCopyState] = useState<'idle' | 'copied' | 'shared' | 'error'>('idle');
  const [cryptoVaultLoading, setCryptoVaultLoading] = useState(false);
  const [cryptoVaultError, setCryptoVaultError] = useState('');
  const [cryptoWallets, setCryptoWallets] = useState<{ bitcoin: string; usdt: string; usdtNetwork: string }>({
    bitcoin: '',
    usdt: '',
    usdtNetwork: '',
  });
  const [selectedCryptoNetwork, setSelectedCryptoNetwork] = useState<'BTC' | 'TRC-20' | 'ERC-20'>('BTC');
  const [copiedCryptoNetwork, setCopiedCryptoNetwork] = useState('');
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
  const receiveAccounts = checkingAndSavings.filter((account) => account.status === 'Active');
  const receiveAccount = receiveAccounts.find((account) => account.id === receiveAccountId)
    || receiveAccounts.find((account) => account.id === activeAccount?.id)
    || receiveAccounts.find((account) => account.account_type === 'Checking')
    || receiveAccounts[0];
  const legacyCards = accounts.filter((account) => account.account_type === 'Credit Card');
  const recentTransactions = useMemo(() => transactions.slice(0, 3), [transactions]);

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
        console.error('Unable to refresh card information:', error);
      }
    };
    void loadCards();
    const refreshTimer = window.setInterval(() => void loadCards(), 30_000);
    return () => window.clearInterval(refreshTimer);
  }, [user.id]);

  useEffect(() => {
    if (showCardsOnly) return;
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
            bitcoin: data.wallets?.bitcoin || '',
            usdt: data.wallets?.usdt || '',
            usdtNetwork: data.wallets?.usdtNetwork || '',
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
  }, [showCardsOnly, user.id]);

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

  const handleReceive = () => {
    setReceiveAccountId(receiveAccount?.id || '');
    setReceiveCopyState('idle');
    setReceiveModalOpen(true);
  };

  const getBankDepositDetails = () => {
    if (!receiveAccount) return '';
    return [
      'American Credit Union Financing — Direct Deposit Instructions',
      `Account type: ${receiveAccount.account_type}`,
      `Account name: ${receiveAccount.nickname}`,
      `Routing number: ${receiveAccount.routing_number}`,
      `Account number: ${receiveAccount.account_number}`,
      'Deposit method: ACH (U.S. domestic transfers)',
    ].join('\n');
  };

  const copyBankDepositDetails = async () => {
    if (!receiveAccount) return;
    const details = getBankDepositDetails();
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Direct deposit instructions', text: details });
        setReceiveCopyState('shared');
      } else {
        await navigator.clipboard.writeText(details);
        setReceiveCopyState('copied');
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setReceiveCopyState('idle');
        return;
      }
      try {
        await navigator.clipboard.writeText(details);
        setReceiveCopyState('copied');
      } catch {
        setReceiveCopyState('error');
      }
    }
  };

  const selectedCryptoAddress = selectedCryptoNetwork === 'BTC'
    ? cryptoWallets.bitcoin
    : cryptoWallets.usdtNetwork === selectedCryptoNetwork ? cryptoWallets.usdt : '';
  const copyCryptoAddress = async () => {
    const address = selectedCryptoAddress;
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopiedCryptoNetwork(selectedCryptoNetwork);
      window.setTimeout(() => setCopiedCryptoNetwork(''), 1800);
    } catch {
      setCryptoVaultError('Clipboard access is unavailable. Select and copy the address manually.');
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
          <div className="relative h-12 w-12 shrink-0">
            <div className="h-12 w-12 overflow-hidden rounded-full bg-emerald-50 text-teal-800 ring-2 ring-[#E5B841] flex items-center justify-center text-lg font-semibold">
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
            <p className="text-sm text-slate-500">{greeting} 👋</p>
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

      <section aria-label="Quick actions" className="grid grid-cols-4 gap-2">
        <button type="button" onClick={handleReceive} className="flex min-w-0 flex-col items-center gap-2 text-center text-xs font-medium text-slate-700">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm sm:h-14 sm:w-14"><ArrowDownLeft className="h-5 w-5" /></span>
          <span className="leading-tight">Receive</span>
        </button>
        <button type="button" onClick={() => onNavigateToTransfer(activeAccount?.id)} className="flex min-w-0 flex-col items-center gap-2 text-center text-xs font-medium text-slate-700">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-slate-200 bg-white shadow-sm sm:h-14 sm:w-14"><ArrowUpRight className="h-5 w-5" /></span>
          <span className="leading-tight">Transfer</span>
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

      <section aria-labelledby="crypto-vault-heading" className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Digital assets</p>
            <h2 id="crypto-vault-heading" className="mt-1 text-lg font-semibold text-slate-900">Crypto Vault</h2>
            <p className="mt-1 text-sm text-slate-600">View your assigned crypto deposit address. Digital assets are separate from your checking and savings balances.</p>
          </div>
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-slate-100 px-3 py-1.5 text-xs font-semibold text-slate-700">
            <Banknote aria-hidden="true" className="h-4 w-4" /> Deposit addresses
          </span>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2" role="group" aria-label="Select crypto network">
          {(['BTC', 'TRC-20', 'ERC-20'] as const).map((network) => (
            <button
              key={network}
              type="button"
              aria-pressed={selectedCryptoNetwork === network}
              onClick={() => { setSelectedCryptoNetwork(network); setCryptoVaultError(''); }}
              className={`min-h-11 rounded-lg border px-2 py-2 text-xs font-semibold sm:text-sm ${selectedCryptoNetwork === network ? 'border-teal-700 bg-teal-50 text-teal-900' : 'border-slate-200 bg-white text-slate-600 hover:bg-slate-50'}`}
            >
              {network === 'BTC' ? 'BTC Mainnet' : `USDT ${network}`}
            </button>
          ))}
        </div>

        {cryptoVaultLoading ? (
          <p role="status" className="mt-4 rounded-lg bg-slate-50 p-4 text-sm text-slate-600">Loading assigned deposit addresses…</p>
        ) : cryptoVaultError ? (
          <p role="alert" className="mt-4 break-words rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{cryptoVaultError}</p>
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-[minmax(0,1fr)_9rem] sm:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="font-semibold text-slate-800">{selectedCryptoNetwork === 'BTC' ? 'Bitcoin (BTC)' : `Tether (USDT) · ${selectedCryptoNetwork}`}</h3>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-600">{selectedCryptoNetwork === 'BTC' ? 'Bitcoin Mainnet' : selectedCryptoNetwork}</span>
              </div>
              {selectedCryptoAddress ? (
                <>
                  <p className="mt-3 break-all rounded-lg border border-slate-200 bg-slate-50 p-3 font-mono text-xs leading-5 text-slate-900">{selectedCryptoAddress}</p>
                  <button type="button" onClick={() => void copyCryptoAddress()} className="mt-2 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 sm:w-auto">
                    {copiedCryptoNetwork === selectedCryptoNetwork ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                    {copiedCryptoNetwork === selectedCryptoNetwork ? 'Address copied' : 'Copy address'}
                  </button>
                </>
              ) : (
                <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  {selectedCryptoNetwork === 'BTC'
                    ? 'A Bitcoin deposit address has not been assigned. Contact Member Services before sending funds.'
                    : cryptoWallets.usdt
                      ? `Your USDT address is assigned to ${cryptoWallets.usdtNetwork}. No address is assigned for ${selectedCryptoNetwork}; select the assigned network.`
                      : `A USDT ${selectedCryptoNetwork} address has not been assigned. Contact Member Services before sending funds.`}
                </p>
              )}
              <p className="mt-3 text-xs leading-5 text-slate-500">Only send {selectedCryptoNetwork === 'BTC' ? 'BTC on Bitcoin Mainnet' : `USDT on ${selectedCryptoNetwork}`} to a matching address. Sending another asset or using a different network may result in permanent loss.</p>
            </div>
            <div className="grid aspect-square w-36 place-items-center justify-self-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center text-xs text-slate-500 sm:w-36" aria-label="QR code placeholder">
              <div className="px-3">
                <Landmark aria-hidden="true" className="mx-auto mb-2 h-8 w-8 text-slate-400" />
                QR code placeholder
              </div>
            </div>
          </div>
        )}
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
          <div className="grid justify-items-center gap-4 sm:grid-cols-2">
            {cards.map((card) => (
              <article key={card.id} className={`relative isolate flex aspect-[1.586/1] w-full max-w-md flex-col justify-between gap-2 overflow-hidden rounded-2xl p-3.5 text-white shadow-lg sm:p-4 ${CARD_COLOR_CLASSES[card.cardColor || 'emerald']}`}>
                <div aria-hidden="true" className="absolute -right-12 -top-16 -z-10 h-56 w-56 rounded-full border border-white/10" />
                <div aria-hidden="true" className="absolute -right-4 -top-8 -z-10 h-40 w-40 rounded-full border border-white/10" />
                <div className="relative flex min-w-0 items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-white/70">{card.card_type} CARD</p>
                    <p className="mt-0.5 truncate text-xs font-semibold sm:text-sm">{card.product_name}</p>
                  </div>
                  <span className="shrink-0 rounded-md border border-white/25 bg-white/10 px-2 py-1 text-[10px] font-bold tracking-wide sm:text-xs">{card.network || 'Visa'}</span>
                </div>
                <div className="relative flex items-center gap-2">
                  <div aria-hidden="true" className="grid h-8 w-10 grid-cols-2 gap-px overflow-hidden rounded-md border border-amber-200/40 bg-amber-200/80 p-1">
                    <span className="rounded-sm border border-amber-900/20" /><span className="rounded-sm border border-amber-900/20" /><span className="rounded-sm border border-amber-900/20" /><span className="rounded-sm border border-amber-900/20" />
                  </div>
                  <CreditCard aria-hidden="true" className="h-5 w-5 text-white/60" />
                </div>
                <p className="relative truncate font-mono text-sm tracking-[0.12em] sm:text-base sm:tracking-[0.16em]">{card.masked_number || `•••• •••• •••• ${card.last4}`}</p>
                <div className="relative grid grid-cols-2 gap-2 border-t border-white/20 pt-2">
                  <div className="min-w-0"><p className="text-[8px] uppercase tracking-wider text-white/65">Cardholder</p><p className="mt-0.5 truncate text-[10px] font-semibold uppercase tracking-wide sm:text-xs">{user.full_name}</p></div>
                  <div className="min-w-0 text-right"><p className="truncate text-[8px] uppercase tracking-wider text-white/65">{card.card_type === 'Credit' ? 'Approved limit' : 'Linked account available'}</p><p className="mt-0.5 text-xs font-bold sm:text-sm">{formatMoney(card.card_type === 'Credit' ? card.credit_limit : (card.linked_account_available || 0))}</p></div>
                </div>
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
      </section>

      {!showCardsOnly && recentTransactions.length > 0 && (
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-slate-900">Recent Activity</h2>
            <button type="button" onClick={() => onNavigateToTab('history')} className="text-sm font-medium text-slate-600 hover:text-slate-900">See all</button>
          </div>
          <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white px-3 sm:px-4">
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
              const amount = Math.abs(transaction.amount)
                + (!isIncoming && transaction.type === 'transfer_out'
                  ? (transaction.transfer_fee || 0) + (transaction.transfer_tax || 0)
                  : 0);
              const AmountIcon = isIncoming ? ArrowDownLeft : ArrowUpRight;
              return (
                <div key={transaction.id} className="flex min-w-0 items-center gap-3 py-3">
                  <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${isIncoming ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-600'}`}>
                    <AmountIcon aria-hidden="true" className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{formatTransactionDescription(transaction.description)}</p>
                    <p className="truncate text-xs text-slate-500">{transaction.date}</p>
                  </div>
                  <p className={`shrink-0 whitespace-nowrap text-right text-sm font-bold tabular-nums ${isIncoming ? 'text-emerald-700' : 'text-slate-900'}`}>
                    {isIncoming ? '+' : '−'}{formatMoney(amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {receiveModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 p-4" role="presentation" onClick={() => setReceiveModalOpen(false)}>
          <section role="dialog" aria-modal="true" aria-labelledby="bank-receive-title" onClick={(event) => event.stopPropagation()} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-4 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Bank deposit details</p>
                <h2 id="bank-receive-title" className="mt-1 text-xl font-bold text-slate-900">Receive a bank deposit</h2>
                <p className="mt-1 text-sm text-slate-600">Share these instructions with the person or institution sending your domestic ACH deposit.</p>
              </div>
              <button type="button" onClick={() => setReceiveModalOpen(false)} aria-label="Close bank deposit details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X aria-hidden="true" className="h-5 w-5" /></button>
            </div>

            {receiveAccounts.length > 1 && (
              <label className="mt-5 block text-sm font-medium text-slate-700">
                Deposit to
                <select value={receiveAccount?.id || ''} onChange={(event) => { setReceiveAccountId(event.target.value); setReceiveCopyState('idle'); }} className="mt-1 min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm">
                  {receiveAccounts.map((account) => (
                    <option key={account.id} value={account.id}>{account.account_type} · {account.nickname} · ending {account.account_number.slice(-4)}</option>
                  ))}
                </select>
              </label>
            )}

            {receiveAccount ? (
              <>
                <dl className="mt-4 divide-y divide-slate-100 rounded-xl border border-slate-200 px-4">
                  <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">Account type</dt><dd className="font-semibold text-slate-900">{receiveAccount.account_type} · {receiveAccount.nickname}</dd></div>
                  <div className="flex items-start justify-between gap-3 py-3 text-sm"><dt className="shrink-0 text-slate-500">Routing number</dt><dd className="break-all text-right font-mono font-semibold text-slate-900">{receiveAccount.routing_number}</dd></div>
                  <div className="flex items-start justify-between gap-3 py-3 text-sm"><dt className="shrink-0 text-slate-500">Account number</dt><dd className="break-all text-right font-mono font-semibold text-slate-900">{receiveAccount.account_number}</dd></div>
                  <div className="flex justify-between gap-3 py-3 text-sm"><dt className="text-slate-500">Deposit method</dt><dd className="text-right font-medium text-slate-900">ACH · Domestic U.S.</dd></div>
                </dl>
                <div className="mt-4 rounded-lg bg-blue-50 p-3 text-xs leading-5 text-blue-900">
                  Provide the routing and account numbers above to your payroll provider or bank. Use the account type shown if the sender requests it. For incoming wire instructions or international transfers, contact Member Services for the applicable details.
                </div>
                <button type="button" onClick={() => void copyBankDepositDetails()} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900">
                  {receiveCopyState === 'copied' || receiveCopyState === 'shared' ? <Check aria-hidden="true" className="h-4 w-4" /> : <Copy aria-hidden="true" className="h-4 w-4" />}
                  {receiveCopyState === 'copied' ? 'Deposit details copied' : receiveCopyState === 'shared' ? 'Deposit details shared' : navigator.share ? 'Share deposit details' : 'Copy deposit details'}
                </button>
                {receiveCopyState === 'error' && <p role="alert" className="mt-2 text-xs text-rose-700">Clipboard access is unavailable. You can copy the account details above manually.</p>}
              </>
            ) : (
              <p role="status" className="mt-5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">No active checking or savings account is available for deposits.</p>
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
