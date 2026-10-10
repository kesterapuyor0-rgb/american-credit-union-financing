import React, { useState } from 'react';
import { BankAccount, Transaction } from '../types';
import {
  X,
  Landmark,
  ArrowDownCircle,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  ShieldCheck,
  Building2,
  DollarSign,
  ArrowRight,
  Clock
} from 'lucide-react';
import { safeParseResponse, getStoredAuthToken } from '../utils/api';

interface AddFundsModalProps {
  isOpen: boolean;
  onClose: () => void;
  accounts: BankAccount[];
  token?: string;
  onSuccess: (newBalance: number, tx: Transaction, message: string) => void;
}

const POPULAR_INSTITUTIONS = [
  'JPMorgan Chase',
  'Wells Fargo',
  'Citibank',
  'Capital One',
  'U.S. Bank',
  'PNC Bank',
];

const PRESET_AMOUNTS = [100, 250, 500, 1000, 2500, 5000];

export const AddFundsModal: React.FC<AddFundsModalProps> = ({
  isOpen,
  onClose,
  accounts,
  token,
  onSuccess,
}) => {
  const eligibleAccounts = accounts.filter(
    (acc) => acc.account_type === 'Checking' || acc.account_type === 'Savings'
  );
  const defaultTargetId = eligibleAccounts[0]?.id || accounts[0]?.id || '';

  const [institutionName, setInstitutionName] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [targetAccountId, setTargetAccountId] = useState(defaultTargetId);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successInfo, setSuccessInfo] = useState<{
    message: string;
    newBalance: number;
    transaction: any;
  } | null>(null);

  if (!isOpen) return null;

  const handleSelectInstitution = (name: string) => {
    setInstitutionName(name);
    if (name === 'JPMorgan Chase') setRoutingNumber('021000021');
    else if (name === 'Wells Fargo') setRoutingNumber('121000247');
    else if (name === 'Citibank') setRoutingNumber('021000089');
    else if (name === 'Capital One') setRoutingNumber('051405515');
    else if (name === 'U.S. Bank') setRoutingNumber('091000022');
    else if (name === 'PNC Bank') setRoutingNumber('043000096');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      setError('Please enter a valid deposit amount greater than $0.00 USD.');
      return;
    }

    if (!institutionName.trim()) {
      setError('Please provide the external institution name.');
      return;
    }

    if (!accountNumber.trim() || accountNumber.trim().length < 4) {
      setError('Please enter a valid external account number (at least 4 digits).');
      return;
    }

    if (!routingNumber.trim() || routingNumber.trim().length !== 9) {
      setError('External routing number must be exactly 9 digits (ABA format).');
      return;
    }

    const authToken = token || getStoredAuthToken();
    if (!authToken) {
      setError('Your online banking session has expired. Please sign in again to authorize an external deposit.');
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/accounts/deposit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authToken}`,
        },
        credentials: 'include',
        body: JSON.stringify({
          institutionName: institutionName.trim(),
          accountNumber: accountNumber.trim(),
          routingNumber: routingNumber.trim(),
          amount: parsedAmount,
          targetAccountId: targetAccountId || defaultTargetId,
          token: authToken,
        }),
      });

      const parseResult = await safeParseResponse(res);
      const responseData = parseResult.data || {};

      if (!res.ok) {
        throw new Error(responseData?.error || responseData?.message || parseResult.error || 'Failed to process external deposit.');
      }

      // Store success info but DO NOT redirect - just show the success UI
      setSuccessInfo({
        message: responseData.message || `Deposit of $${parsedAmount.toFixed(2)} USD submitted! Processing via ACH.`,
        newBalance: responseData.newBalance || 0,
        transaction: responseData.transaction,
      });

      // Call onSuccess callback if provided but don't close the modal
      if (onSuccess) {
        onSuccess(responseData.newBalance || 0, responseData.transaction, responseData.message);
      }
    } catch (err: any) {
      console.error('Error submitting external deposit:', err);
      setError(err.message || 'Unable to connect to deposit gateway. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleResetAndClose = () => {
    setSuccessInfo(null);
    setError(null);
    setAmount('');
    setAccountNumber('');
    onClose();
  };

  const selectedTargetAccount = accounts.find((a) => a.id === targetAccountId) || accounts[0];

  return (
    <div
      id="modal-add-funds"
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto overscroll-contain bg-black/60 p-2 pt-[max(0.5rem,env(safe-area-inset-top))] pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-xs animate-in fade-in duration-200"
    >
      <div className="flex max-h-[calc(100dvh-1rem)] w-full max-w-lg flex-col overflow-hidden rounded-sm border border-gray-300 bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex shrink-0 items-center justify-between border-b-2 border-[#D6A832] bg-[#173B70] px-3 py-2.5 text-white sm:px-5">
          <div className="flex items-center space-x-2">
            <div className="rounded-sm bg-white/10 p-1">
              <Landmark className="h-4 w-4 text-white" />
            </div>
            <div>
              <h3 className="font-serif text-base font-bold leading-tight text-white">
                Add Funds from External Account
              </h3>
              <p className="text-[10px] text-gray-200">
              Deposit request   · Secure processing
              </p>
            </div>
          </div>
          <button
            onClick={handleResetAndClose}
            className="text-gray-300 hover:text-white p-1 rounded-sm hover:bg-white/10 transition-colors cursor-pointer"
            aria-label="Close modal"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="min-h-0 overflow-y-auto overscroll-contain p-3 sm:p-5">
          {successInfo ? (
            /* Success confirmation - PENDING APPROVAL */
            <div className="text-center py-4 space-y-4">
              <div className="w-14 h-14 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center mx-auto ring-8 ring-amber-50 animate-pulse">
                <Clock className="w-8 h-8" />
              </div>

              <div className="space-y-1">
                <h4 className="text-lg font-bold text-[#173B70] font-serif">
                  Deposit Submitted Successfully
                </h4>
                <p className="text-sm font-semibold text-amber-700 bg-amber-50 inline-block px-3 py-1 rounded-full">
                  Status: PENDING
                </p>
                <p className="text-xs text-gray-600 max-w-md mx-auto pt-1">
                  Your deposit request is pending review. Funds will be added to your account balance only if it is approved.
                </p>
              </div>

              <div className="bg-amber-50/50 border border-amber-200 rounded-sm p-4 text-xs space-y-2 text-left">
                <div className="flex justify-between">
                  <span className="text-gray-600">Source Institution:</span>
                  <span className="font-semibold text-gray-800">{institutionName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Credited To:</span>
                  <span className="font-semibold text-[#173B70]">
                    {selectedTargetAccount?.nickname} ({selectedTargetAccount?.account_number})
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Deposit Amount:</span>
                  <span className="font-bold text-amber-700 font-mono">
                    +${parseFloat(amount || '0').toLocaleString('en-US', { minimumFractionDigits: 2 })} USD
                  </span>
                </div>
                <div className="flex justify-between border-t border-amber-200 pt-2">
                  <span className="text-gray-600">Current Status:</span>
                  <span className="font-bold text-amber-600 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    PENDING
                  </span>
                </div>
              </div>

              <div className="bg-emerald-50 border border-emerald-200 rounded-sm p-3 flex items-start gap-2 text-[11px] text-emerald-900">
                <ShieldCheck className="w-4 h-4 text-[#173B70] shrink-0 mt-0.5" />
                <span>You can track this request in your transaction activity. Member Services must review it before the account balance changes.</span>
              </div>

              <div className="pt-2">
                <button
                  id="btn-add-funds-done"
                  type="button"
                  onClick={handleResetAndClose}
                  className="w-full py-2.5 bg-[#173B70] hover:bg-[#245B9E] text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-xs transition-colors cursor-pointer"
                >
                  Done & Return to Dashboard
                </button>
              </div>
            </div>
          ) : (
            /* Deposit Form */
            <form onSubmit={handleSubmit} className="space-y-2.5">
              {/* Target account */}
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Deposit Into Account
                </label>
                <select
                  id="select-deposit-target-account"
                  value={targetAccountId}
                  onChange={(e) => setTargetAccountId(e.target.value)}
                  className="w-full rounded-sm border border-gray-300 bg-white p-2 text-xs font-semibold focus:border-transparent focus:ring-2 focus:ring-[#173B70] outline-hidden"
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.nickname} — {acc.account_number} (${acc.balance.toLocaleString('en-US', { minimumFractionDigits: 2 })} USD)
                    </option>
                  ))}
                </select>
              </div>

              {/* External Institution Selection */}
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  External Institution Name
                </label>
                <div className="mb-1.5 flex flex-nowrap gap-1 overflow-x-auto pb-1 whitespace-nowrap">
                  {POPULAR_INSTITUTIONS.map((inst) => (
                    <button
                      key={inst}
                      type="button"
                      onClick={() => handleSelectInstitution(inst)}
                      className={`shrink-0 rounded-xs border px-2 py-0.5 text-[10px] font-medium transition-colors cursor-pointer ${
                        institutionName === inst
                          ? 'bg-[#173B70] text-white border-[#173B70]'
                          : 'bg-gray-50 hover:bg-gray-100 text-gray-700 border-gray-200'
                      }`}
                    >
                      {inst}
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <Building2 className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                  <input
                    id="input-external-institution-name"
                    type="text"
                    required
                    placeholder="Enter financial institution name"
                    value={institutionName}
                    onChange={(e) => setInstitutionName(e.target.value)}
                    className="w-full rounded-sm border border-gray-300 py-1.5 pl-9 pr-3 text-xs focus:border-transparent focus:ring-2 focus:ring-[#173B70] outline-hidden"
                  />
                </div>
              </div>

              {/* External Routing Number & Account Number */}
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    External Routing Number
                  </label>
                  <input
                    id="input-external-routing-number"
                    type="text"
                    required
                    maxLength={9}
                    placeholder="Enter 9-digit ABA routing number"
                    value={routingNumber}
                    onChange={(e) => setRoutingNumber(e.target.value.replace(/\D/g, '').slice(0, 9))}
                    className="w-full rounded-sm border border-gray-300 p-1.5 font-mono text-xs font-medium focus:border-transparent focus:ring-2 focus:ring-[#173B70] outline-hidden"
                  />
                  <span className="text-[9px] leading-3 text-gray-500">9-digit ABA code</span>
                </div>

                <div>
                  <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                    External Account Number
                  </label>
                  <input
                    id="input-external-account-number"
                    type="text"
                    required
                    placeholder="Enter account number"
                    value={accountNumber}
                    onChange={(e) => setAccountNumber(e.target.value.replace(/\s/g, ''))}
                    className="w-full rounded-sm border border-gray-300 p-1.5 font-mono text-xs font-medium focus:border-transparent focus:ring-2 focus:ring-[#173B70] outline-hidden"
                  />
                  <span className="text-[9px] leading-3 text-gray-500">Checking or Savings account</span>
                </div>
              </div>

              {/* Deposit Amount ($) */}
              <div>
                <label className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-gray-700">
                  Deposit Amount ($ USD)
                </label>
                <div className="relative mb-1.5">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-600">
                    $
                  </span>
                  <input
                    id="input-deposit-amount"
                    type="number"
                    step="0.01"
                    min="0.01"
                    required
                    placeholder="0.00"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-sm border border-gray-300 py-1.5 pl-8 pr-12 text-sm font-mono font-bold focus:border-transparent focus:ring-2 focus:ring-[#173B70] outline-hidden"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                    USD
                  </span>
                </div>

                {/* Quick amount chips */}
                <div className="grid grid-cols-3 gap-1">
                  {PRESET_AMOUNTS.map((amt) => (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => setAmount(amt.toString())}
                      className="min-h-7 rounded-xs border border-gray-200 bg-gray-100 px-1 py-0.5 text-[10px] font-semibold text-gray-700 hover:bg-gray-200 cursor-pointer"
                    >
                      +${amt}
                    </button>
                  ))}
                </div>
              </div>

              {/* Security & Verification Notice */}
              <div className="flex items-start gap-1.5 rounded-sm border border-emerald-200 bg-emerald-50/70 p-2 text-[10px] leading-4 text-emerald-900">
                <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#173B70]" />
                <span>
                  <strong>Instant Availability:</strong> External funds transferred via ACH are verified instantaneously in testing sandbox mode and credited directly to your ledger balance.
                </span>
              </div>

              {/* Error display */}
              {error && (
                <div className="flex items-center gap-2 border-l-4 border-[#D6A832] bg-red-50 p-2 text-xs text-red-800">
                  <AlertCircle className="w-4 h-4 text-[#D6A832] shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {/* Form Action Buttons */}
              <div className="-mx-3 -mb-3 sticky bottom-0 flex items-center justify-end gap-2 border-t border-gray-200 bg-white/95 px-3 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] backdrop-blur-sm sm:-mx-5 sm:-mb-5 sm:px-5">
                <button
                  type="button"
                  onClick={handleResetAndClose}
                  className="min-h-10 px-3 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  id="btn-submit-external-deposit"
                  type="submit"
                  disabled={submitting}
                  className="min-h-10 px-4 py-2 bg-[#D6A832] hover:bg-[#AD841B] text-white font-bold text-xs uppercase tracking-wider rounded-sm shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {submitting ? (
                    <>
                      <RefreshCw className="w-4 h-4 animate-spin" />
                      <span>Processing Deposit...</span>
                    </>
                  ) : (
                    <>
                      <ArrowDownCircle className="w-4 h-4" />
                      <span>Authorize & Deposit Funds</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
