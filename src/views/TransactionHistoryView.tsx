import React, { useMemo, useState } from 'react';
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock3, Download, FileText, Filter, RefreshCw, Search, X } from 'lucide-react';
import { Transaction, User } from '../types';
import { formatTransactionDescription } from '../utils/transactionFormatting';

interface TransactionHistoryViewProps {
  user: User;
  transactions: Transaction[];
  loading: boolean;
  onRefresh: () => void;
  onNavigateToTransfer: (fromAccountId?: string) => void;
}

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

  const filteredTransactions = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return transactions.filter((transaction) => {
      const status = transaction.status?.toLowerCase() || 'completed';
      const matchesStatus = statusFilter === 'all' || status === statusFilter;
      const searchableText = [
        formatTransactionDescription(transaction.description),
        transaction.recipient_name,
        transaction.account_name,
        transaction.amount.toString(),
      ].filter(Boolean).join(' ').toLowerCase();
      return matchesStatus && (!query || searchableText.includes(query));
    });
  }, [transactions, searchQuery, statusFilter]);

  const formatMoney = (amount: number) => new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD', minimumFractionDigits: 2,
  }).format(Math.abs(amount));

  const exportCSV = () => {
    const escapeCSV = (value: string | number | undefined) => `"${String(value ?? '').replace(/"/g, '""')}"`;
    const rows = [
      ['Date', 'Description', 'Account', 'Status', 'Amount (USD)', 'Transfer fee (USD)', 'Tax (USD)', 'Total debit (USD)'],
      ...filteredTransactions.map((transaction) => [
        transaction.date,
        formatTransactionDescription(transaction.description),
        transaction.account_name || transaction.account_number || '',
        transaction.status,
        transaction.amount,
        transaction.type === 'transfer_out' ? transaction.transfer_fee || 0 : 0,
        transaction.type === 'transfer_out' ? transaction.transfer_tax || 0 : 0,
        transaction.amount + (transaction.type === 'transfer_out' ? (transaction.transfer_fee || 0) + (transaction.transfer_tax || 0) : 0),
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
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Date</th>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Description</th>
                  <th scope="col" className="px-4 py-3 font-semibold sm:px-5">Status</th>
                  <th scope="col" className="px-4 py-3 text-right font-semibold sm:px-5">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredTransactions.map((transaction) => {
                  const positive = ['deposit', 'transfer_in', 'admin_credit', 'admin_release'].includes(transaction.type) || (transaction.type === 'admin_adjustment' && transaction.amount > 0);
                  const pending = transaction.status?.toLowerCase() === 'pending';
                  const transferFee = transaction.type === 'transfer_out' ? transaction.transfer_fee || 0 : 0;
                  const transferTax = transaction.type === 'transfer_out' ? transaction.transfer_tax || 0 : 0;
                  const totalDebit = transaction.amount + transferFee + transferTax;
                  return (
                    <tr key={transaction.id} onClick={() => setSelectedTransaction(transaction)} className="cursor-pointer hover:bg-emerald-50/50">
                      <td className="whitespace-nowrap px-4 py-4 text-slate-600 sm:px-5">{transaction.date}</td>
                      <td className="px-4 py-4 sm:px-5">
                        <div className="font-medium text-slate-900">{formatTransactionDescription(transaction.description)}</div>
                        <div className="mt-0.5 text-xs text-slate-500">{transaction.account_name || transaction.account_number || 'Account activity'}{transaction.recipient_name ? ` · ${transaction.recipient_name}` : ''}</div>
                      </td>
                      <td className="whitespace-nowrap px-4 py-4 sm:px-5">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium ${pending ? 'bg-amber-50 text-amber-800' : transaction.status?.toLowerCase() === 'held' ? 'bg-orange-50 text-orange-800' : 'bg-emerald-50 text-emerald-800'}`}>
                          {pending ? <Clock3 aria-hidden="true" className="h-3.5 w-3.5" /> : <CheckCircle2 aria-hidden="true" className="h-3.5 w-3.5" />}
                          {transaction.status || 'Completed'}
                        </span>
                      </td>
                      <td className={`whitespace-nowrap px-4 py-4 text-right font-semibold sm:px-5 ${positive ? 'text-emerald-700' : 'text-slate-900'}`}>
                        <span className="inline-flex items-center justify-end gap-1">
                          {positive ? <ArrowDownLeft aria-hidden="true" className="h-4 w-4" /> : <ArrowUpRight aria-hidden="true" className="h-4 w-4" />}
                          {positive ? '+' : '−'}{formatMoney(totalDebit)}
                        </span>
                        {transferFee + transferTax > 0 && <span className="mt-1 block text-xs font-normal text-slate-500">Includes {formatMoney(transferFee)} fee + {formatMoney(transferTax)} tax</span>}
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
          <section role="dialog" aria-modal="true" aria-labelledby="transaction-detail-heading" className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-700">Transaction details</p>
                <h2 id="transaction-detail-heading" className="mt-1 text-lg font-semibold text-teal-900">{formatTransactionDescription(selectedTransaction.description)}</h2>
              </div>
              <button type="button" onClick={() => setSelectedTransaction(null)} aria-label="Close transaction details" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><X aria-hidden="true" className="h-5 w-5" /></button>
            </div>
            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Transfer amount</dt><dd className="font-semibold text-slate-900">{formatMoney(selectedTransaction.amount)} {selectedTransaction.currency || 'USD'}</dd></div>
              {selectedTransaction.type === 'transfer_out' && (selectedTransaction.transfer_fee || 0) > 0 && <div className="flex justify-between gap-3"><dt className="text-slate-500">Transfer fee</dt><dd className="font-medium text-slate-900">{formatMoney(selectedTransaction.transfer_fee || 0)} {selectedTransaction.currency || 'USD'}</dd></div>}
              {selectedTransaction.type === 'transfer_out' && (selectedTransaction.transfer_tax || 0) > 0 && <div className="flex justify-between gap-3"><dt className="text-slate-500">Tax</dt><dd className="font-medium text-slate-900">{formatMoney(selectedTransaction.transfer_tax || 0)} {selectedTransaction.currency || 'USD'}</dd></div>}
              {selectedTransaction.type === 'transfer_out' && <div className="flex justify-between gap-3 border-t border-slate-100 pt-3"><dt className="text-slate-500">Total debit</dt><dd className="font-semibold text-slate-900">{formatMoney(selectedTransaction.amount + (selectedTransaction.transfer_fee || 0) + (selectedTransaction.transfer_tax || 0))} {selectedTransaction.currency || 'USD'}</dd></div>}
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Status</dt><dd className="font-medium text-slate-900">{selectedTransaction.status || 'Completed'}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Date</dt><dd className="font-medium text-slate-900">{selectedTransaction.date}</dd></div>
              <div className="flex justify-between gap-3"><dt className="text-slate-500">Reference</dt><dd className="break-all text-right font-mono text-xs text-slate-700">{selectedTransaction.id}</dd></div>
              {selectedTransaction.recipient_name && <div className="flex justify-between gap-3"><dt className="text-slate-500">Recipient</dt><dd className="text-right font-medium text-slate-900">{selectedTransaction.recipient_name}</dd></div>}
            </dl>
            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setSelectedTransaction(null)} className="min-h-10 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">Close</button>
              <button type="button" onClick={() => { setSelectedTransaction(null); onNavigateToTransfer(selectedTransaction.account_id); }} className="min-h-10 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900">Make a transfer</button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
};
