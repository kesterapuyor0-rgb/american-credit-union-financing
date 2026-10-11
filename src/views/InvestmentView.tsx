import React, { useEffect, useMemo, useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BriefcaseBusiness, CheckCircle2, LoaderCircle, Search, X } from 'lucide-react';
import { getAuthHeaders } from '../utils/api';
import { InvestmentAsset, InvestmentAssetType } from '../../shared/investmentCatalog';

interface InvestmentPortfolio {
  totalValue: number;
  dailyChangePercent: number;
  dailyChangeValue: number;
  positions: Array<{
    symbol: string;
    name: string;
    assetType: InvestmentAssetType;
    quantity: number;
    averageCost: number;
    marketPrice: number;
    marketValue: number;
    dailyChangePercent: number;
    detail: string;
  }>;
  checkingAccount: { availableBalance: number; nickname: string } | null;
}

interface InvestmentViewProps {
  onClose: () => void;
  onPurchaseComplete: () => void;
  inline?: boolean;
}

const assetGroups: InvestmentAssetType[] = ['Equity', 'ETF', 'Mutual Fund', 'Fixed Income'];

function formatUSD(value: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);
}

function InvestmentOrderModal({
  asset,
  availableBalance,
  onClose,
  onComplete,
}: {
  asset: InvestmentAsset;
  availableBalance: number;
  onClose: () => void;
  onComplete: () => void;
}) {
  const [quantity, setQuantity] = useState('1');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [receipt, setReceipt] = useState<{
    confirmationNumber: string;
    totalCost: number;
    checkingAccountNickname: string;
  } | null>(null);
  const estimatedCost = Math.round((Number(quantity) * asset.marketPrice) * 100) / 100;
  const validQuantity = Number.isFinite(Number(quantity)) && Number(quantity) > 0;

  const submitOrder = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const response = await fetch('/api/investments/buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({ symbol: asset.symbol, quantity: Number(quantity) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Unable to submit this order.');
      setReceipt({
        confirmationNumber: data.confirmationNumber,
        totalCost: Number(data.totalCost),
        checkingAccountNickname: data.checkingAccountNickname,
      });
      onComplete();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit this order.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/65 p-4" role="presentation" onClick={() => !submitting && onClose()}>
      <section role="dialog" aria-modal="true" aria-labelledby="investment-order-title" onClick={(event) => event.stopPropagation()} className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl sm:p-6">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Investment order</p>
            <h2 id="investment-order-title" className="mt-1 text-xl font-bold text-slate-950">{receipt ? 'Trade Confirmation' : `Buy ${asset.symbol}`}</h2>
            <p className="mt-1 text-sm text-slate-600">{asset.name}</p>
          </div>
          <button type="button" onClick={onClose} disabled={submitting} aria-label="Close order" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 disabled:opacity-50"><X className="h-5 w-5" /></button>
        </div>

        {receipt ? (
          <div className="mt-5 rounded-xl border border-emerald-200 bg-emerald-50 p-4">
            <CheckCircle2 aria-hidden="true" className="h-6 w-6 text-emerald-700" />
         <p className="mt-2 font-semibold text-emerald-950">
  Order Executed Successfully
</p>
<p className="mt-1 text-sm text-emerald-900">
  {formatUSD(receipt.totalCost)} has been debited from your {receipt.checkingAccountName || 'Advantage Plus Checking'}. Order routed via Direct Market Access (DMA) and queued for settlement.
</p>
            <p className="mt-3 break-all font-mono text-xs text-emerald-800">Confirmation Number: {receipt.confirmationNumber}</p>
            <button type="button" onClick={onClose} className="mt-4 min-h-11 w-full rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900">Return to portfolio</button>
          </div>
        ) : (
          <form onSubmit={(event) => void submitOrder(event)} className="mt-5 space-y-4">
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              <span>Market price</span>
              <span className="block rounded-lg bg-slate-50 px-3 py-2.5 font-mono text-slate-950">{formatUSD(asset.marketPrice)} per unit</span>
            </label>
            <label className="block space-y-1.5 text-sm font-medium text-slate-700">
              <span>Units (fractional units supported, up to 6 decimals)</span>
              <input autoFocus type="number" min="0.000001" max="1000000" step="0.000001" required value={quantity} onChange={(event) => setQuantity(event.target.value)} className="w-full rounded-lg border border-slate-300 px-3 py-2.5 font-mono text-slate-950 focus:border-teal-700 focus:outline-none focus:ring-2 focus:ring-teal-100" />
            </label>
            <div className="rounded-xl border border-slate-200 p-3 text-sm">
              <div className="flex justify-between gap-3"><span className="text-slate-500">Estimated total</span><span className="font-semibold text-slate-950">{validQuantity ? formatUSD(estimatedCost) : '—'}</span></div>
              <div className="mt-2 flex justify-between gap-3"><span className="text-slate-500">Available checking balance</span><span className="font-semibold text-slate-950">{formatUSD(availableBalance)}</span></div>
            </div>
            {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-800">{error}</p>}
            <button type="submit" disabled={submitting || !validQuantity || estimatedCost > availableBalance} className="inline-flex min-h-12 w-full items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">
              {submitting ? <><LoaderCircle className="h-4 w-4 animate-spin" /> Submitting order…</> : `Buy · ${validQuantity ? formatUSD(estimatedCost) : ''}`}
            </button>
            <p className="text-xs leading-5 text-slate-500">This order updates your in-app ledger only; it is not sent to a brokerage.</p>
          </form>
        )}
      </section>
    </div>
  );
}

export const InvestmentView: React.FC<InvestmentViewProps> = ({ onClose, onPurchaseComplete, inline = false }) => {
  const [assets, setAssets] = useState<InvestmentAsset[]>([]);
  const [portfolio, setPortfolio] = useState<InvestmentPortfolio | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<InvestmentAsset | null>(null);
  const [category, setCategory] = useState<InvestmentAssetType | 'All'>('All');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      setLoadError('');
      try {
        const [catalogResponse, portfolioResponse] = await Promise.all([
          fetch('/api/investments/catalog', { headers: getAuthHeaders(), credentials: 'include' }),
          fetch('/api/investments/portfolio', { headers: getAuthHeaders(), credentials: 'include' }),
        ]);
        const [catalogData, portfolioData] = await Promise.all([catalogResponse.json(), portfolioResponse.json()]);
        if (!catalogResponse.ok) throw new Error(catalogData.error || 'Unable to load investment assets.');
        if (!portfolioResponse.ok) throw new Error(portfolioData.error || 'Unable to load your portfolio.');
        if (!cancelled) {
          setAssets(Array.isArray(catalogData.assets) ? catalogData.assets : []);
          setPortfolio(portfolioData);
        }
      } catch (error) {
        if (!cancelled) setLoadError(error instanceof Error ? error.message : 'Unable to load the market asset catalog.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  const filteredAssets = useMemo(() => assets.filter((asset) => {
    const matchesCategory = category === 'All' || asset.assetType === category;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || `${asset.name} ${asset.symbol} ${asset.detail}`.toLowerCase().includes(term);
    return matchesCategory && matchesSearch;
  }), [assets, category, search]);

  const closeOrder = () => setSelectedAsset(null);
  const completeOrder = () => {
    onPurchaseComplete();
    void fetch('/api/investments/portfolio', { headers: getAuthHeaders(), credentials: 'include' })
      .then(async (response) => {
        const data = await response.json();
        if (response.ok) setPortfolio(data);
      })
      .catch((error) => console.error('Unable to refresh the investment portfolio:', error));
  };

  return (
    <div className={inline ? 'overflow-y-auto rounded-2xl bg-slate-100' : 'fixed inset-0 z-[80] overflow-y-auto bg-slate-100'}>
      <div className={`mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-8 ${inline ? '' : 'min-h-full'}`}>
        <header className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
          <div className="flex items-start gap-3">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-800"><BriefcaseBusiness className="h-5 w-5" /></span>
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider text-teal-800">Investment Portfolio</p>
              <h1 className="mt-1 text-xl font-bold text-slate-950 sm:text-2xl">Explore investments</h1>
              <p className="mt-1 text-sm text-slate-600">Browse equities, ETFs, mutual funds, and fixed-income investments.</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={inline ? 'Back to all accounts' : 'Close investment portfolio'} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">
            {inline ? <span className="px-2 text-sm font-semibold">Back</span> : <X className="h-5 w-5" />}
          </button>
        </header>

        <section aria-label="Portfolio summary" className="mt-4 grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Portfolio Value</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{loading ? 'Loading…' : formatUSD(portfolio?.totalValue || 0)}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Daily P/L</p>
            <p className={`mt-2 flex items-center gap-1 text-2xl font-bold ${(portfolio?.dailyChangePercent || 0) < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>
              {(portfolio?.dailyChangePercent || 0) < 0 ? <ArrowDownRight className="h-5 w-5" /> : <ArrowUpRight className="h-5 w-5" />}
              {portfolio?.dailyChangePercent ? `${portfolio.dailyChangePercent > 0 ? '+' : ''}${portfolio.dailyChangePercent.toFixed(2)}%` : '0.00%'}
            </p>
            <p className="mt-1 text-xs text-slate-500">{formatUSD(portfolio?.dailyChangeValue || 0)} daily change</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Available Cash</p>
            <p className="mt-2 text-2xl font-bold text-slate-950">{loading ? 'Loading…' : formatUSD(portfolio?.checkingAccount?.availableBalance || 0)}</p>
            <p className="mt-1 text-xs text-slate-500">Available checking balance</p>
          </div>
        </section>

        {portfolio?.positions?.length ? (
          <section aria-label="Portfolio holdings" className="mt-4 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
            <h2 className="font-semibold text-slate-950">Your Holdings</h2>
            <div className="mt-3 divide-y divide-slate-100">
              {portfolio.positions.map((position) => (
                <div key={position.symbol} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div><p className="font-semibold text-slate-900">{position.name} <span className="font-mono text-xs text-slate-500">{position.symbol}</span></p><p className="mt-0.5 text-xs text-slate-500">{position.quantity.toLocaleString('en-US', { maximumFractionDigits: 6 })} units · average cost {formatUSD(position.averageCost)}</p></div>
                  <p className="font-semibold tabular-nums text-slate-900">{formatUSD(position.marketValue)}</p>
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <a href="#investment-catalog" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-700 focus-visible:ring-offset-2">
          Browse Stocks / Trade
        </a>

        <section id="investment-catalog" className="mt-5 scroll-mt-4">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div><h2 className="text-lg font-bold text-slate-950">Market Asset Catalog</h2></div>
            <label className="relative block sm:w-64">
              <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search assets" className="min-h-11 w-full rounded-lg border border-slate-300 bg-white pl-9 pr-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-100" />
            </label>
          </div>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            {(['All', ...assetGroups] as const).map((group) => (
              <button key={group} type="button" onClick={() => setCategory(group)} aria-pressed={category === group} className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold ${category === group ? 'border-teal-800 bg-teal-800 text-white' : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-50'}`}>{group}</button>
            ))}
          </div>
          {loadError && <p role="alert" className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">{loadError}</p>}
          {loading ? (
            <div className="mt-4 grid gap-3 sm:grid-cols-2" aria-label="Loading catalog" aria-busy="true">{[0, 1, 2, 3].map((item) => <div key={item} className="h-40 animate-pulse rounded-xl border border-slate-200 bg-white" />)}</div>
          ) : (
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              {filteredAssets.map((asset) => (
                <article key={asset.symbol} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0"><p className="text-xs font-semibold uppercase tracking-wide text-teal-800">{asset.assetType}</p><h3 className="mt-1 font-semibold text-slate-950">{asset.name}</h3><p className="mt-0.5 font-mono text-sm text-slate-500">{asset.symbol}</p></div>
                    <p className="shrink-0 text-right font-mono font-semibold text-slate-950">{formatUSD(asset.marketPrice)}</p>
                  </div>
                  <p className="mt-3 min-h-10 text-xs leading-5 text-slate-500">{asset.detail}</p>
                  <div className="mt-3 flex items-center justify-between gap-3 border-t border-slate-100 pt-3">
                    <span className={`text-xs font-semibold ${asset.dailyChangePercent < 0 ? 'text-rose-700' : 'text-emerald-700'}`}>{asset.dailyChangePercent > 0 ? '+' : ''}{asset.dailyChangePercent.toFixed(2)}%</span>
                    <button type="button" disabled={!portfolio?.checkingAccount} onClick={() => setSelectedAsset(asset)} className="min-h-10 rounded-lg bg-teal-800 px-4 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">Buy</button>
                  </div>
                </article>
              ))}
              {filteredAssets.length === 0 && <p className="rounded-xl border border-dashed border-slate-300 bg-white p-6 text-center text-sm text-slate-500 sm:col-span-2">No assets match your search.</p>}
            </div>
          )}
        </section>

        <footer className="mt-6 border-t border-slate-200 py-4 text-xs leading-5 text-slate-500">
        Investment products are not FDIC insured • No bank guarantee • May lose value.
        </footer>
      </div>

      {selectedAsset && (
        <InvestmentOrderModal
          asset={selectedAsset}
          availableBalance={portfolio?.checkingAccount?.availableBalance || 0}
          onClose={closeOrder}
          onComplete={completeOrder}
        />
      )}
    </div>
  );
};
