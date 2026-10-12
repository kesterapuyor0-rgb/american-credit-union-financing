import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, CheckCircle2, LoaderCircle, RefreshCw, ShieldCheck } from 'lucide-react';
import { UserWithAccounts } from '../types';
import { getAuthHeaders } from '../utils/api';
import { fetchFinnhubQuote } from '../utils/finnhub';

interface ManagedAccount {
  id: string;
  nickname: string;
  accountLast4: string;
  availableBalance: number;
}

interface ProfitOverride {
  mode: 'offset' | 'multiplier';
  value: number;
  reason: string;
}

interface ManagedPosition {
  symbol: string;
  name: string;
  assetType: string;
  quantity: number;
  averageCost: number;
  marketPrice: number;
  profitOverride: ProfitOverride | null;
}

interface ManagedPortfolio {
  user: { id: string; full_name: string; email: string };
  accounts: ManagedAccount[];
  positions: ManagedPosition[];
  profitOverride: ProfitOverride | null;
}

interface LivePosition extends ManagedPosition {
  livePrice: number;
  currentValue: number;
  profitLoss: number;
  profitLossPercent: number;
}

interface AdminInvestmentManagementViewProps {
  users: UserWithAccounts[];
  onRefreshAdminData: () => Promise<void>;
}

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function formatSignedUSD(value: number): string {
  return `${value >= 0 ? '+' : '-'}${formatUSD(Math.abs(value))}`;
}

function applyProfitOverride(value: number, override: ProfitOverride | null): number {
  if (!override) return value;
  return override.mode === 'offset' ? value + override.value : value * override.value;
}

export const AdminInvestmentManagementView: React.FC<AdminInvestmentManagementViewProps> = ({
  users,
  onRefreshAdminData,
}) => {
  const customerUsers = useMemo(
    () => users.filter((user) => user.role.toLowerCase() !== 'admin' && user.isAdmin !== true),
    [users],
  );
  const [selectedUserId, setSelectedUserId] = useState('');
  const [managedPortfolio, setManagedPortfolio] = useState<ManagedPortfolio | null>(null);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [cashAction, setCashAction] = useState<'credit' | 'debit'>('credit');
  const [cashAmount, setCashAmount] = useState('');
  const [cashReason, setCashReason] = useState('');
  const [scope, setScope] = useState<'portfolio' | 'holding'>('portfolio');
  const [symbol, setSymbol] = useState('');
  const [overrideAction, setOverrideAction] = useState<'set' | 'top_up' | 'deduct'>('set');
  const [overrideMode, setOverrideMode] = useState<'offset' | 'multiplier'>('offset');
  const [overrideValue, setOverrideValue] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    if (!customerUsers.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(customerUsers[0]?.id || '');
    }
  }, [customerUsers, selectedUserId]);

  const loadManagedPortfolio = async (userId: string, signal?: AbortSignal) => {
    const response = await fetch(`/api/admin/investment-management/${encodeURIComponent(userId)}`, {
      headers: getAuthHeaders(),
      credentials: 'include',
      signal,
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to load customer portfolio.');
    setManagedPortfolio(data);
    setSelectedAccountId((current) =>
      data.accounts.some((account: ManagedAccount) => account.id === current)
        ? current
        : data.accounts[0]?.id || '',
    );
    setSymbol((current) =>
      data.positions.some((position: ManagedPosition) => position.symbol === current)
        ? current
        : data.positions[0]?.symbol || '',
    );
  };

  useEffect(() => {
    if (!selectedUserId) {
      setManagedPortfolio(null);
      return;
    }
    const controller = new AbortController();
    setLoading(true);
    setError('');
    void loadManagedPortfolio(selectedUserId, controller.signal)
      .catch((loadError) => {
        if (!controller.signal.aborted) {
          setManagedPortfolio(null);
          setError(loadError instanceof Error ? loadError.message : 'Unable to load customer portfolio.');
        }
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [selectedUserId]);

  const positionSymbols = (managedPortfolio?.positions || []).map((position) => position.symbol).join(',');
  useEffect(() => {
    if (!selectedUserId || !positionSymbols) {
      setLivePrices({});
      return;
    }
    let cancelled = false;
    let refreshing = false;
    const symbols = positionSymbols.split(',');
    const refreshPrices = async () => {
      if (refreshing) return;
      refreshing = true;
      try {
        const quotes = await Promise.all(symbols.map(async (assetSymbol) => {
          try {
            const quote = await fetchFinnhubQuote(assetSymbol);
            return [assetSymbol, quote.c] as const;
          } catch (quoteError) {
            console.warn(`Unable to refresh ${assetSymbol} in admin portfolio; retaining its catalog price.`, quoteError);
            return [assetSymbol, null] as const;
          }
        }));
        if (!cancelled) {
          setLivePrices((current) => {
            const next = { ...current };
            for (const [assetSymbol, price] of quotes) {
              if (price !== null) next[assetSymbol] = price;
            }
            return next;
          });
        }
      } finally {
        refreshing = false;
      }
    };
    void refreshPrices();
    const intervalId = window.setInterval(() => void refreshPrices(), 20_000);
    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, [positionSymbols, selectedUserId]);

  const livePositions = useMemo<LivePosition[]>(() => (managedPortfolio?.positions || []).map((position) => {
    const livePrice = livePrices[position.symbol] ?? position.marketPrice;
    const currentValue = position.quantity * livePrice;
    const costBasis = position.quantity * position.averageCost;
    const profitLoss = applyProfitOverride(currentValue - costBasis, position.profitOverride);
    return {
      ...position,
      livePrice,
      currentValue,
      profitLoss,
      profitLossPercent: costBasis > 0 ? (profitLoss / costBasis) * 100 : 0,
    };
  }), [livePrices, managedPortfolio]);
  const cashBalance = (managedPortfolio?.accounts || []).reduce((sum, account) => sum + account.availableBalance, 0);
  const holdingsValue = livePositions.reduce((sum, position) => sum + position.currentValue, 0);
  const holdingsProfitLoss = livePositions.reduce((sum, position) => sum + position.profitLoss, 0);
  const totalProfitLoss = applyProfitOverride(holdingsProfitLoss, managedPortfolio?.profitOverride || null);
  const baseHoldingsProfitLoss = livePositions.reduce(
    (sum, position) => sum + position.currentValue - position.quantity * position.averageCost,
    0,
  );
  const adminProfitOffset = totalProfitLoss - baseHoldingsProfitLoss;
  const totalAccountValue = cashBalance + holdingsValue + adminProfitOffset;
  const totalCostBasis = livePositions.reduce((sum, position) => sum + position.quantity * position.averageCost, 0);
  const totalProfitLossPercent = totalCostBasis > 0 ? (totalProfitLoss / totalCostBasis) * 100 : 0;
  const selectedPosition = livePositions.find((position) => position.symbol === symbol);
  const activeOverride = scope === 'portfolio'
    ? managedPortfolio?.profitOverride || null
    : selectedPosition?.profitOverride || null;

  const refreshAfterAction = async () => {
    try {
      if (selectedUserId) await loadManagedPortfolio(selectedUserId);
      await onRefreshAdminData();
      return '';
    } catch (refreshError) {
      console.error('Admin adjustment succeeded but refreshing the customer portfolio failed:', refreshError);
      return refreshError instanceof Error ? refreshError.message : 'Unable to refresh the customer portfolio.';
    }
  };

  const processCashAdjustment = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!managedPortfolio) return;
    const amount = Number(cashAmount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 10000000 || Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-8) {
      setError('Enter an amount greater than $0.00 and no more than $10,000,000.00, with at most 2 decimal places.');
      return;
    }
    if (!cashReason.trim() || cashReason.trim().length > 500) {
      setError('Enter a reason of 1 to 500 characters.');
      return;
    }
    const account = managedPortfolio.accounts.find((item) => item.id === selectedAccountId);
    if (!account) {
      setError('Select an active USD checking account.');
      return;
    }
    if (cashAction === 'debit' && amount > account.availableBalance) {
      setError('The deduction cannot exceed this account’s available balance.');
      return;
    }
    const actionName = cashAction === 'credit' ? 'credit' : 'debit';
    if (!window.confirm(`${cashAction === 'credit' ? 'Credit' : 'Deduct'} ${formatUSD(amount)} ${cashAction === 'credit' ? 'to' : 'from'} ${managedPortfolio.user.full_name}’s ${account.nickname}? This will update the cash ledger and create a transaction receipt.`)) return;

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch('/api/admin/balance-adjustment', {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({ accountId: account.id, action: actionName, amount, reason: cashReason.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to adjust the customer cash balance.');
      setCashAmount('');
      setCashReason('');
      const refreshError = await refreshAfterAction();
      setSuccess('Admin Action Executed · Cash adjustment posted and transaction receipt recorded.');
      if (refreshError) setError(`The adjustment was saved, but the portfolio could not be refreshed: ${refreshError}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to adjust the customer cash balance.');
    } finally {
      setSubmitting(false);
    }
  };

  const saveProfitOverride = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!managedPortfolio) return;
    const value = Number(overrideValue);
    const effectiveMode = overrideAction === 'set' ? overrideMode : 'offset';
    if (!Number.isFinite(value)
      || (effectiveMode === 'offset' && (Math.abs(value) > 10000000 || Math.abs(value * 100 - Math.round(value * 100)) > 1e-8))
      || (effectiveMode === 'multiplier' && (value < 0 || value > 100 || Math.abs(value * 10000 - Math.round(value * 10000)) > 1e-8))
      || (overrideAction !== 'set' && value <= 0)) {
      setError(effectiveMode === 'offset'
        ? overrideAction === 'set'
          ? 'Enter a dollar offset within ±$10,000,000.00, with at most 2 decimal places.'
          : 'Enter an adjustment greater than $0.00 and no more than $10,000,000.00, with at most 2 decimal places.'
        : 'Enter a multiplier between 0 and 100, with at most 4 decimal places.');
      return;
    }
    if (!overrideReason.trim() || overrideReason.trim().length > 500) {
      setError('Enter a reason of 1 to 500 characters.');
      return;
    }
    if (scope === 'holding' && !selectedPosition) {
      setError('Select a holding before applying a holding-level override.');
      return;
    }
    const target = scope === 'portfolio' ? 'total portfolio P/L' : `${selectedPosition?.name} (${symbol}) P/L`;
    const effect = overrideAction === 'top_up'
      ? `a ${formatUSD(value)} P/L top-up`
      : overrideAction === 'deduct'
        ? `a ${formatUSD(value)} P/L deduction`
        : effectiveMode === 'offset' ? `a ${formatSignedUSD(value)} offset` : `a ${value}× multiplier`;
    if (!window.confirm(`Apply ${effect} to ${target} for ${managedPortfolio.user.full_name}? This changes the displayed profit/loss only; it does not change cash, units, or market prices. A receipt and audit record will be created.`)) return;

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/investment-management/${encodeURIComponent(selectedUserId)}/profit-override`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          action: overrideAction,
          scope,
          symbol: scope === 'holding' ? symbol : undefined,
          mode: effectiveMode,
          value,
          reason: overrideReason.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to apply the profit/loss override.');
      setOverrideValue('');
      setOverrideReason('');
      const refreshError = await refreshAfterAction();
      setSuccess(`Admin Action Executed · ${target} override saved and receipt ${data.transactionId} recorded.`);
      if (refreshError) setError(`The override was saved, but the portfolio could not be refreshed: ${refreshError}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to apply the profit/loss override.');
    } finally {
      setSubmitting(false);
    }
  };

  const clearProfitOverride = async () => {
    if (!managedPortfolio || !activeOverride) return;
    const target = scope === 'portfolio' ? 'total portfolio P/L' : `${selectedPosition?.name} (${symbol}) P/L`;
    if (!window.confirm(`Clear the ${target} override for ${managedPortfolio.user.full_name}? This will restore the unadjusted P/L calculation and create an audit receipt.`)) return;
    const reason = window.prompt('Enter a reason for clearing this P/L override.', 'Administrative override cleared');
    if (reason === null) return;
    if (!reason.trim() || reason.trim().length > 500) {
      setError('Enter a reason of 1 to 500 characters.');
      return;
    }

    setSubmitting(true);
    setError('');
    setSuccess('');
    try {
      const response = await fetch(`/api/admin/investment-management/${encodeURIComponent(selectedUserId)}/profit-override`, {
        method: 'POST',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        credentials: 'include',
        body: JSON.stringify({
          action: 'clear',
          scope,
          symbol: scope === 'holding' ? symbol : undefined,
          reason: reason.trim(),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to clear the profit/loss override.');
      const refreshError = await refreshAfterAction();
      setSuccess(`Admin Action Executed · ${target} override cleared and receipt ${data.transactionId} recorded.`);
      if (refreshError) setError(`The override was cleared, but the portfolio could not be refreshed: ${refreshError}`);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to clear the profit/loss override.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="space-y-5 p-4 sm:p-5">
      <header className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Administration · Finance Controls</p>
          <h2 className="mt-1 text-lg font-bold text-slate-950">Customer cash & investment management</h2>
          <p className="mt-1 text-sm text-slate-600">Adjust cash through the ledger and manage clearly disclosed, display-only P/L overrides.</p>
        </div>
        <label className="block w-full space-y-1 text-xs font-semibold text-slate-600 sm:max-w-sm">
          <span>Select customer</span>
          <select value={selectedUserId} onChange={(event) => setSelectedUserId(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-900">
            {customerUsers.length === 0 && <option value="">No customers available</option>}
            {customerUsers.map((user) => (
              <option key={user.id} value={user.id}>{user.full_name} · {user.email}</option>
            ))}
          </select>
        </label>
      </header>

      {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{error}</p>}
      {success && <p role="status" className="flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-900"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />{success}</p>}

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white p-10 text-sm text-slate-600"><LoaderCircle className="h-4 w-4 animate-spin" />Loading customer portfolio…</div>
      ) : managedPortfolio ? (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="font-semibold text-slate-950">{managedPortfolio.user.full_name}</h3>
                <p className="mt-0.5 text-sm text-slate-600">{managedPortfolio.user.email}</p>
              </div>
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900"><ShieldCheck className="h-3.5 w-3.5" />Authorized admin controls</span>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Cash balance · active USD checking</p><p className="mt-1 text-xl font-bold text-slate-950">{formatUSD(cashBalance)}</p></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Live holdings value</p><p className="mt-1 text-xl font-bold text-slate-950">{formatUSD(holdingsValue)}</p></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Unrealized profit / loss</p><p className={`mt-1 flex items-center gap-1 text-xl font-bold ${totalProfitLoss < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{totalProfitLoss < 0 ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}{formatSignedUSD(totalProfitLoss)}</p><p className="text-xs text-slate-600">{totalProfitLossPercent > 0 ? '+' : ''}{totalProfitLossPercent.toFixed(2)}%</p></div>
              <div className="rounded-lg border border-slate-200 bg-slate-50 p-3"><p className="text-xs font-semibold uppercase text-slate-500">Total account value</p><p className="mt-1 text-xl font-bold text-slate-950">{formatUSD(totalAccountValue)}</p><p className="text-xs text-slate-600">Cash + live holdings + admin P/L offset</p></div>
            </div>
            {(managedPortfolio.profitOverride || livePositions.some((position) => position.profitOverride)) && (
              <p className="mt-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-900">One or more administrative P/L adjustments are active. They affect reported profit/loss and account valuation, not the cash ledger, holdings, or market prices.</p>
            )}
          </section>

          <div className="grid gap-5 xl:grid-cols-2">
            <form onSubmit={(event) => void processCashAdjustment(event)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div><h3 className="font-semibold text-slate-950">Cash balance adjustment</h3><p className="mt-1 text-xs leading-5 text-slate-600">Uses the existing account ledger and creates a member transaction receipt and admin audit log.</p></div>
              <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Checking account</span><select required value={selectedAccountId} onChange={(event) => setSelectedAccountId(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">{managedPortfolio.accounts.map((account) => <option key={account.id} value={account.id}>{account.nickname} · •••• {account.accountLast4} · available {formatUSD(account.availableBalance)}</option>)}</select></label>
              {!managedPortfolio.accounts.length && <p role="status" className="text-sm text-amber-800">This customer has no active USD checking account available for adjustment.</p>}
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Action</span><select value={cashAction} onChange={(event) => setCashAction(event.target.value as 'credit' | 'debit')} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="credit">Credit / top-up</option><option value="debit">Debit / deduction</option></select></label>
                <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Amount (USD)</span><input type="number" min="0.01" max="10000000" step="0.01" required value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono" placeholder="5000.00" /></label>
              </div>
              <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Reason / transaction note</span><input required maxLength={500} value={cashReason} onChange={(event) => setCashReason(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 px-3" placeholder="Wire Deposit Credited" /></label>
              <button type="submit" disabled={submitting || !managedPortfolio.accounts.length} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{cashAction === 'credit' ? 'Confirm cash credit' : 'Confirm cash deduction'}</button>
            </form>

            <form onSubmit={(event) => void saveProfitOverride(event)} className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div><h3 className="font-semibold text-slate-950">Profit / loss adjustment</h3><p className="mt-1 text-xs leading-5 text-slate-600">Create or set an offset, top up or deduct from it, or apply a multiplier. The persisted adjustment updates reported P/L and account valuation only; it never changes the cash ledger, market prices, or unit ownership.</p></div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Apply to</span><select value={scope} onChange={(event) => setScope(event.target.value as 'portfolio' | 'holding')} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="portfolio">Total portfolio P/L</option><option value="holding">Specific holding P/L</option></select></label>
                {scope === 'holding' && <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Holding</span><select required value={symbol} onChange={(event) => setSymbol(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3">{livePositions.map((position) => <option key={position.symbol} value={position.symbol}>{position.name} ({position.symbol})</option>)}</select></label>}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Adjustment action</span><select value={overrideAction} onChange={(event) => setOverrideAction(event.target.value as 'set' | 'top_up' | 'deduct')} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="set">Create / set adjustment</option><option value="top_up">Top up profit offset</option><option value="deduct">Deduct from profit offset</option></select></label>
                {overrideAction === 'set' && <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Override type</span><select value={overrideMode} onChange={(event) => setOverrideMode(event.target.value as 'offset' | 'multiplier')} className="min-h-11 w-full rounded-lg border border-slate-300 bg-white px-3"><option value="offset">Dollar offset</option><option value="multiplier">Direct multiplier</option></select></label>}
                <label className="block space-y-1 text-sm font-medium text-slate-700"><span>{overrideAction === 'top_up' ? 'Top-up amount (USD)' : overrideAction === 'deduct' ? 'Deduction amount (USD)' : overrideMode === 'offset' ? 'Profit / loss offset (USD)' : 'Multiplier (0–100×)'}</span><input type="number" min={overrideAction === 'set' && overrideMode === 'offset' ? -10000000 : 0} max={10000000} step={overrideAction === 'set' && overrideMode === 'multiplier' ? '0.0001' : '0.01'} required value={overrideValue} onChange={(event) => setOverrideValue(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 px-3 font-mono" placeholder={overrideAction === 'top_up' ? '500.00' : overrideAction === 'deduct' ? '100.00' : overrideMode === 'offset' ? '250.00 or -100.00' : '1.25'} /></label>
              </div>
              <label className="block space-y-1 text-sm font-medium text-slate-700"><span>Reason / audit note</span><input required maxLength={500} value={overrideReason} onChange={(event) => setOverrideReason(event.target.value)} className="min-h-11 w-full rounded-lg border border-slate-300 px-3" placeholder="Administrative reporting adjustment" /></label>
              <div className="flex flex-wrap gap-2">
                <button type="submit" disabled={submitting || (scope === 'holding' && !selectedPosition)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#173B70] px-4 text-sm font-semibold text-white hover:bg-[#245B9E] disabled:cursor-not-allowed disabled:opacity-50">{submitting ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}{overrideAction === 'top_up' ? 'Confirm profit top-up' : overrideAction === 'deduct' ? 'Confirm profit deduction' : 'Apply P/L adjustment'}</button>
                {activeOverride && <button type="button" disabled={submitting} onClick={() => void clearProfitOverride()} className="min-h-11 rounded-lg border border-rose-300 px-4 text-sm font-semibold text-rose-800 hover:bg-rose-50 disabled:opacity-50">Clear current override</button>}
              </div>
              {activeOverride && <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">Current: {activeOverride.mode === 'offset' ? `${formatSignedUSD(activeOverride.value)} offset` : `${activeOverride.value}× multiplier`} · {activeOverride.reason}</p>}
            </form>
          </div>

          <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between gap-3"><h3 className="font-semibold text-slate-950">Portfolio holdings</h3><button type="button" onClick={() => { setLoading(true); void loadManagedPortfolio(selectedUserId).catch((loadError) => setError(loadError instanceof Error ? loadError.message : 'Unable to refresh the customer portfolio.')).finally(() => setLoading(false)); }} disabled={loading} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-slate-300 px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"><RefreshCw className="h-3.5 w-3.5" />Refresh</button></div>
            {!livePositions.length ? <p className="mt-3 rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">No investment holdings for this customer.</p> : (
              <div className="mt-3 divide-y divide-slate-100">
                {livePositions.map((position) => (
                  <div key={position.symbol} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div><p className="font-semibold text-slate-900">{position.name} <span className="font-mono text-xs text-slate-500">{position.symbol}</span></p><p className="mt-1 text-xs text-slate-600">{position.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })} units · live {formatUSD(position.livePrice)} · cost basis {formatUSD(position.averageCost)}</p></div>
                    <div className="text-right"><p className="font-semibold text-slate-950">{formatUSD(position.currentValue)}</p><p className={`mt-1 text-xs font-semibold ${position.profitLoss < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{formatSignedUSD(position.profitLoss)} ({position.profitLossPercent > 0 ? '+' : ''}{position.profitLossPercent.toFixed(2)}%)</p>{position.profitOverride && <p className="mt-1 text-[11px] font-semibold text-amber-800">Admin P/L override · display-only</p>}</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      ) : !error ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">Select a customer to review their portfolio.</div>
      ) : null}
    </section>
  );
};
