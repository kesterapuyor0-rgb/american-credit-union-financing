import React, { KeyboardEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDownLeft,
  ArrowLeftRight,
  ArrowUpRight,
  Banknote,
  CheckCircle2,
  Clock3,
  Download,
  FileText,
  Filter,
  Gift,
  RefreshCw,
  Search,
  Wallet,
  X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Transaction, User } from '../types';
import { formatTransactionDescription } from '../utils/transactionFormatting';

interface TransactionHistoryViewProps {
  user: User;
  transactions: Transaction[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateToTransfer: (fromAccountId?: string) => void;
}

interface TransactionPresentation {
  title: string;
  typeLabel: string;
  subtitle: string;
  isIncoming: boolean;
  amountClassName: string;
  Icon: LucideIcon;
  iconClassName: string;
}

const getTransactionPresentation = (transaction: Transaction): TransactionPresentation => {
  const description = formatTransactionDescription(transaction.description);
  const normalizedDescription = description.toLowerCase();
  const normalizedCategory = transaction.category?.toLowerCase() || '';
  const isGrant = normalizedCategory.includes('grant')
    || transaction.id.startsWith('tx_grant_')
    || normalizedDescription.includes('grant');
  const isFee = normalizedCategory.includes('fee')
    || normalizedCategory.includes('tax')
    || /\b(fee|tax)\b/.test(normalizedDescription);
  const isTransferOut = transaction.type === 'transfer_out';
  const isIncoming = !isFee && (
    ['deposit', 'transfer_in', 'admin_credit', 'admin_release', 'card_credit'].includes(transaction.type)
    || (transaction.type === 'admin_adjustment' && transaction.amount > 0)
  );

  if (isGrant) {
    return {
      title: 'Community & Business Micro-Grant Award',
      typeLabel: 'Grant Credit',
      subtitle: 'Member Services Grant Disbursement',
      isIncoming: true,
      amountClassName: 'font-bold text-emerald-700',
      Icon: Gift,
      iconClassName: 'bg-emerald-50 text-emerald-700',
    };
  }
  if (isTransferOut) {
    return {
      title: `Domestic Wire Transfer Out to ${transaction.recipient_name?.trim() || 'Recipient'}`,
      typeLabel: 'Transfer Out',
      subtitle: transaction.category || 'Wire Transfer',
      isIncoming: false,
      amountClassName: 'font-semibold text-slate-900',
      Icon: ArrowUpRight,
      iconClassName: 'bg-slate-100 text-slate-700',
    };
  }
  if (isFee) {
    const isTax = normalizedCategory.includes('tax') || /\btax\b/.test(normalizedDescription);
    return {
      title: isTax ? 'Service Tax' : 'Wire Processing Fee',
      typeLabel: isTax ? 'Tax' : 'Fee',
      subtitle: transaction.category || 'Account charge',
      isIncoming: false,
      amountClassName: 'font-semibold text-slate-500',
      Icon: Banknote,
      iconClassName: 'bg-slate-100 text-slate-600',
    };
  }
  if (isIncoming) {
    const source = transaction.recipient_name?.trim()
      || description.replace(/^direct deposit\s*[-:]\s*/i, '').trim()
      || 'Account';
    return {
      title: `Direct Deposit - ${source}`,
      typeLabel: 'Direct Deposit',
      subtitle: transaction.category || 'Incoming funds',
      isIncoming: true,
      amountClassName: 'font-semibold text-emerald-700',
      Icon: Wallet,
      iconClassName: 'bg-emerald-50 text-emerald-700',
    };
  }
  return {
    title: description,
    typeLabel: transaction.category || 'Debit',
    subtitle: transaction.category || 'Account activity',
    isIncoming: false,
    amountClassName: 'font-semibold text-slate-900',
    Icon: ArrowLeftRight,
    iconClassName: 'bg-slate-100 text-slate-700',
  };
};

const getStatusPresentation = (status: string) => {
  const normalized = status.toUpperCase().replace(/[_-]+/g, ' ').trim();
  if (normalized.includes('REVIEW')) {
    return { label: 'Under Review', className: 'bg-blue-50 text-blue-800', Icon: RefreshCw };
  }
  if (normalized === 'PENDING' || normalized === 'PROCESSING') {
    return { label: normalized === 'PROCESSING' ? 'Processing' : 'Pending', className: 'bg-amber-50 text-amber-800', Icon: Clock3 };
  }
  if (normalized === 'HELD') {
    return { label: 'Held', className: 'bg-orange-50 text-orange-800', Icon: Clock3 };
  }
  return { label: status || 'Completed', className: 'bg-emerald-50 text-emerald-800', Icon: CheckCircle2 };
};

const formatTransactionDate = (date: string) => {
  const parsedDate = new Date(date);
  return Number.isNaN(parsedDate.getTime()) ? date : parsedDate.toISOString().slice(0, 10);
};

const formatTransactionDateTime = (transaction: Transaction) => {
  const timestamp = Number(transaction.created_at);
  const parsedDate = Number.isFinite(timestamp) && timestamp > 0
    ? new Date(timestamp)
    : new Date(transaction.date);
  return Number.isNaN(parsedDate.getTime())
    ? transaction.date
    : parsedDate.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' });
};

export const TransactionHistoryView: React.FC<TransactionHistoryViewProps> = ({
  user,
  transactions,
  loading,
  onRefresh,
  onNavigateToTransfer,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedTransaction, setSelectedTransaction] = useState<Transaction | null>(null);
  const onRefreshRef = useRef(onRefresh);
  const refreshingRef = useRef(false);

  useEffect(() => {
    onRefreshRef.current = onRefresh;
  }, [onRefresh]);

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return [...transactions].sort((left, right) => {
      const byDate = new Date(right.date).getTime() - new Date(left.date).getTime();
      return byDate || right.created_at - left.created_at;
    }).filter((transaction) => {
      const status = transaction.status?.toLowerCase().replace(/[_-]+/g, ' ') || 'completed';
      const matchesStatus = statusFilter === 'all'
        || (statusFilter === 'pending' && (status === 'pending' || status === 'processing'))
        || (statusFilter === 'under review' && status.includes('review'))
        || (statusFilter === 'held' && status === 'held')
        || (statusFilter === 'completed' && !['pending', 'processing', 'held'].includes(status) && !status.includes('review'));
      const searchableText = [
        formatTransactionDescription(transaction.description),
        transaction.recipient_name,
        transaction.account_name,
        transaction.category,
        transaction.amount.toString(),
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!query || searchableText.includes(query));
    });
  }, [transactions, searchQuery, statusFilter]);

  useEffect(() => {
    const refreshTransactions = async () => {
      if (refreshingRef.current || document.visibilityState === 'hidden') return;
      refreshingRef.current = true;
      try {
        await onRefreshRef.current();
      } catch (refreshError) {
        console.error('Transaction history refresh failed:', refreshError);
      } finally {
        refreshingRef.current = false;
      }
    };
    void refreshTransactions();
    const intervalId = window.setInterval(() => void refreshTransactions(), 20_000);
    document.addEventListener('visibilitychange', refreshTransactions);
    return () => {
      window.clearInterval(intervalId);
      document.removeEventListener('visibilitychange', refreshTransactions);
    };
  }, []);

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(Math.abs(amount));
  const selectedTransactionIsWire = selectedTransaction?.type === 'transfer_out';
  const selectedPresentation = selectedTransaction ? getTransactionPresentation(selectedTransaction) : null;
  const receiptRecipientName = selectedTransaction?.recipient_name?.trim() || 'Recipient';
  const receiptFee = selectedTransaction?.transfer_fee || 0;
  const receiptTax = selectedTransaction?.transfer_tax || 0;

  const openTransactionFromKeyboard = (event: KeyboardEvent<HTMLTableRowElement>, transaction: Transaction) => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      setSelectedTransaction(transaction);
    }
  };

  const exportCSV = () => {
    const escapeCSV = (value: string | number | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Date', 'Description', 'Type', 'Category', 'Account', 'Status', 'Signed amount (USD)', 'Transfer fee (USD)', 'Tax (USD)', 'Total debit / credit (USD)'],
      ...filteredTransactions.map((transaction) => [
        formatTransactionDate(transaction.date),
        getTransactionPresentation(transaction).title,
        getTransactionPresentation(transaction).typeLabel,
        transaction.category || '',
        transaction.account_name || transaction.account_number || '',
        transaction.status,
        (getTransactionPresentation(transaction).isIncoming ? 1 : -1) * transaction.amount,
        transaction.type === 'transfer_out' ? transaction.transfer_fee || 0 : 0,
        transaction.type === 'transfer_out' ? transaction.transfer_tax || 0 : 0,
        (getTransactionPresentation(transaction).isIncoming ? 1 : -1) * (
          getTransactionPresentation(transaction).isIncoming
            ? transaction.amount
            : transaction.amount + (transaction.type === 'transfer_out' ? (transaction.transfer_fee || 0) + (transaction.transfer_tax || 0) : 0)
        ),
      ]),
    ];
    const csv = rows.map((row) => row.map(escapeCSV).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `account_activity_${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section aria-labelledby="transaction-history-heading" className="mx-auto w-full max-w-5xl space-y-5">
      <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Account activity</p>
          <h1 id="transaction-history-heading" className="mt-1 text-2xl font-bold tracking-tight text-teal-900">Transaction History</h1>
          <p className="mt-1 text-sm text-slate-600">Activity for {user.full_name}</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onRefresh} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <RefreshCw aria-hidden="true" className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button type="button" onClick={exportCSV} disabled={filteredTransactions.length === 0} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-800 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50">
            <Download aria-hidden="true" className="h-4 w-4" /> Export CSV
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-white p-3 sm:grid-cols-[minmax(0,1fr)_220px] sm:p-4">
        <label className="relative block">
          <span className="sr-only">Search transactions</span>
          <Search aria-hidden="true" className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search description, recipient, or amount"
            className="min-h-11 w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-teal-700 focus:ring-2 focus:ring-teal-700/15"
          />
        </label>
        <label className="flex min-h-11 items-center gap-2 rounded-lg border border-slate-200 px-3 focus-within:border-teal-700">
          <Filter aria-hidden="true" className="h-4 w-4 shrink-0 text-slate-500" />
          <span className="sr-only">Filter by status</span>
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="w-full bg-transparent text-sm text-slate-700 outline-none">
            <option value="all">All statuses</option>
            <option value="completed">Completed</option>
            <option value="pending">Pending</option>
            <option value="under review">Under Review</option>
            <option value="held">Held</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex flex-col gap-1 border-b border-slate-100 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <h2 className="font-semibold text-slate-900">All transactions</h2>
          <span className="text-xs text-slate-500">Showing {filteredTransactions.length} of {transactions.length}</span>
        </div>
        {filteredTransactions.length === 0 ? (
          <div className="px-5 py-12 text-center">
            <FileText aria-hidden="true" className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 font-medium text-slate-800">No transactions found</p>
            <p className="mt-1 text-sm text-slate-500">Try changing your search or status filter.</p>
          </div>
        ) : (
          <div className="w-full overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Transaction details</th>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Type</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-5">Amount</th>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((transaction) => {
                  const presentation = getTransactionPresentation(transaction);
                  const statusPresentation = getStatusPresentation(transaction.status);
                  const { Icon } = presentation;
                  const { Icon: StatusIcon } = statusPresentation;
                  return (
                    <tr
                      key={transaction.id}
                      tabIndex={0}
                      aria-label={`View transaction ${presentation.title}`}
                      onClick={() => setSelectedTransaction(transaction)}
                      onKeyDown={(event) => openTransactionFromKeyboard(event, transaction)}
                      className="cursor-pointer hover:bg-emerald-50/50 focus:bg-emerald-50/50 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-teal-700"
                    >
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600 sm:px-5">{formatTransactionDate(transaction.date)}</td>
                      <td className="px-4 py-4 sm:px-5">
                        <div className="font-medium text-slate-900">{presentation.title}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{presentation.subtitle} · {transaction.account_name || transaction.account_number || 'Account activity'}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-5">
                        <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-current/10 px-2.5 py-1 text-xs font-semibold ${presentation.iconClassName}`}>
                          <Icon aria-hidden="true" className="h-3.5 w-3.5" /> {presentation.typeLabel}
                        </span>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-4 text-right sm:px-5 ${presentation.amountClassName}`}>
                        <span className="inline-flex items-center justify-end gap-1">
                          {presentation.isIncoming ? <ArrowDownLeft aria-hidden="true" className="h-4 w-4" /> : <ArrowUpRight aria-hidden="true" className="h-4 w-4" />}
                          {presentation.isIncoming ? '+' : '−'}{formatMoney(transaction.amount)}
                        </span>
                        {transaction.type === 'transfer_out' && ((transaction.transfer_fee || 0) + (transaction.transfer_tax || 0) > 0) && (
                          <span className="mt-1 block text-xs font-normal text-slate-500">Plus {formatMoney((transaction.transfer_fee || 0) + (transaction.transfer_tax || 0))} in fees/tax</span>
                        )}
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${statusPresentation.className}`}>
                          <StatusIcon aria-hidden="true" className={`h-3.5 w-3.5 ${statusPresentation.label === 'Under Review' ? 'animate-spin' : ''}`} />
                          {statusPresentation.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedTransaction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/45 p-4" role="presentation" onClick={() => setSelectedTransaction(null)}>
          <section id="transaction-receipt" role="dialog" aria-modal="true" aria-labelledby="transaction-detail-heading" className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <style>{'@media print { body * { visibility: hidden !important; } #transaction-receipt, #transaction-receipt * { visibility: visible !important; } #transaction-receipt { position: fixed; inset: 0; width: 100%; max-width: none; max-height: none; overflow: visible; border: 0; box-shadow: none; } .transaction-receipt-actions { display: none !important; } }'}</style>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Transaction details</p>
                <h2 id="transaction-detail-heading" className="mt-1 text-lg font-semibold text-teal-900">
                  {selectedPresentation?.title}
                </h2>
              </div>
              <button type="button" onClick={() => setSelectedTransaction(null)} aria-label="Close transaction details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X aria-hidden="true" className="h-5 w-5" /></button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Transaction reference</dt><dd className="break-all text-right font-mono text-xs text-slate-700">{selectedTransaction.id}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Full description</dt><dd className="max-w-[65%] text-right font-medium text-slate-900">{formatTransactionDescription(selectedTransaction.description)}</dd></div>
              {(selectedTransaction.recipient_name || selectedTransactionIsWire) && <div className="flex justify-between gap-3"><dt className="text-slate-500">{selectedTransactionIsWire ? 'Recipient' : 'Recipient / sender'}</dt><dd className="text-right font-medium text-slate-900">{selectedTransaction.recipient_name || receiptRecipientName}</dd></div>}
              {selectedTransaction.recipient_account && <div className="flex justify-between gap-3"><dt className="text-slate-500">Counterparty account</dt><dd className="text-right font-medium text-slate-900">{selectedTransaction.recipient_account}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Transaction date &amp; time</dt><dd className="text-right font-medium text-slate-900">{formatTransactionDateTime(selectedTransaction)}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd><span className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold ${getStatusPresentation(selectedTransaction.status).className}`}>{getStatusPresentation(selectedTransaction.status).label}</span></dd></div>
              <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="text-slate-500">Principal amount</dt><dd className={`font-semibold ${selectedPresentation?.isIncoming ? 'text-emerald-700' : 'text-slate-900'}`}>{selectedPresentation?.isIncoming ? '+' : '−'}{formatMoney(selectedTransaction.amount)} {selectedTransaction.currency || 'USD'}</dd></div>
              {selectedTransactionIsWire && <>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Transfer fee</dt><dd className="font-medium text-slate-900">{formatMoney(receiptFee)} {selectedTransaction.currency || 'USD'}</dd></div>
                <div className="flex justify-between gap-3"><dt className="text-slate-500">Tax</dt><dd className="font-medium text-slate-900">{formatMoney(receiptTax)} {selectedTransaction.currency || 'USD'}</dd></div>
              </>}
              <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="text-slate-500">Total {selectedPresentation?.isIncoming ? 'credit' : 'debit'}</dt><dd className={`font-semibold ${selectedPresentation?.isIncoming ? 'text-emerald-700' : 'text-slate-900'}`}>{selectedPresentation?.isIncoming ? '+' : '−'}{formatMoney(selectedPresentation?.isIncoming ? selectedTransaction.amount : selectedTransaction.amount + receiptFee + receiptTax)} {selectedTransaction.currency || 'USD'}</dd></div>
            </dl>
            <div className="transaction-receipt-actions mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSelectedTransaction(null)} className="min-h-10 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
              {selectedTransaction.type === 'transfer_out' && <button type="button" onClick={() => { setSelectedTransaction(null); onNavigateToTransfer(selectedTransaction.account_id); }} className="min-h-10 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Make a transfer</button>}
              <button type="button" onClick={() => window.print()} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900"><Download aria-hidden="true" className="h-4 w-4" /> Print / Save as PDF</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
};
