import React, { useState } from 'react';
import { BankAccount, User } from '../types';
import { getStoredAuthToken } from '../utils/api';
import {
  ArrowLeftRight,
  ShieldCheck,
  Lock,
  CheckCircle2,
  AlertCircle,
  Clock,
  ArrowRight,
  DollarSign,
  UserCheck,
  Send,
  Building2,
  RefreshCw,
  Printer
} from 'lucide-react';

interface TransferViewProps {
  user: User;
  token?: string;
  accounts: BankAccount[];
  initialFromAccountId?: string;
  onTransferComplete: () => void;
  onCancel: () => void;
}

export const TransferView: React.FC<TransferViewProps> = ({
  user,
  token,
  accounts,
  initialFromAccountId,
  onTransferComplete,
  onCancel,
}) => {
  // Step 1: Details | Step 2: Review & 2FA | Step 3: Success Confirmation
  const [step, setStep] = useState<'details' | '2fa' | 'success'>('details');

  // Transfer Form State
  const [transferType, setTransferType] = useState<'internal' | 'external' | 'zelle'>('internal');
  const [sourceAccountId, setSourceAccountId] = useState<string>(
    initialFromAccountId || accounts[0]?.id || ''
  );
  const [destinationAccountId, setDestinationAccountId] = useState<string>(
    accounts[1]?.id || ''
  );
  const [recipientName, setRecipientName] = useState('');
  const [recipientAccount, setRecipientAccount] = useState('');
  const [recipientRouting, setRecipientRouting] = useState('026009593');
  const [amount, setAmount] = useState<string>('');
  const [memo, setMemo] = useState<string>('');
  const [channel, setChannel] = useState<'sms' | 'email'>('sms');

  // 2FA Verification State
  const [verificationId, setVerificationId] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [maskedContact, setMaskedContact] = useState('');
  const [simulatedOtp, setSimulatedOtp] = useState('');
  const [completedTxId, setCompletedTxId] = useState('');
  const [newSourceBalance, setNewSourceBalance] = useState<number | null>(null);

  // Status
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedSourceAccount = accounts.find((a) => a.id === sourceAccountId);
  const getAvailableBalance = (account: BankAccount) => Math.max(0, account.available_balance ?? account.balance - (account.held_balance || 0));

  const formatUSD = (val: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(val);
  };

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    const numAmount = parseFloat(amount);
    if (isNaN(numAmount) || numAmount <= 0) {
      setError('Please enter a valid amount greater than $0.00 USD.');
      return;
    }

    if (!selectedSourceAccount) {
      setError('Please select a valid funding account.');
      return;
    }

    if (numAmount > getAvailableBalance(selectedSourceAccount)) {
      setError(
        `Insufficient funds. The available balance in ${selectedSourceAccount.nickname} is ${formatUSD(
          getAvailableBalance(selectedSourceAccount)
        )} USD.`
      );
      return;
    }

    if (transferType === 'internal' && sourceAccountId === destinationAccountId) {
      setError('Source and destination accounts must be different.');
      return;
    }

    if (transferType !== 'internal' && !recipientName.trim()) {
      setError('Please provide the recipient name.');
      return;
    }

    setLoading(true);

    try {
      const activeToken = token || getStoredAuthToken();
      const res = await fetch('/api/transfers/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          sourceAccountId,
          transferType,
          destinationAccountId: transferType === 'internal' ? destinationAccountId : null,
          recipientName:
            transferType === 'internal'
              ? accounts.find((a) => a.id === destinationAccountId)?.nickname
              : recipientName,
          recipientAccount,
          recipientRouting,
          amount: numAmount,
          memo: memo.trim() || 'Online Transfer',
          channel,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to initiate transfer authorization.');
      }

      setVerificationId(data.verificationId);
      setMaskedContact(data.maskedContact);
      setSimulatedOtp(data.simulatedOtp);
      setStep('2fa');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!otpCode || otpCode.trim().length !== 6) {
      setError('Please enter the 6-digit authorization code.');
      return;
    }

    setLoading(true);

    try {
      const activeToken = token || getStoredAuthToken();
      const res = await fetch('/api/transfers/confirm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeToken ? { Authorization: `Bearer ${activeToken}` } : {}),
        },
        credentials: 'include',
        body: JSON.stringify({
          verificationId,
          code: otpCode.trim(),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Authorization failed.');
      }

      setCompletedTxId(data.transactionId);
      setNewSourceBalance(null);
      setStep('success');
      onTransferComplete();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fillQuickRecipient = (name: string, targetAccount: string) => {
    setRecipientName(name);
    setRecipientAccount(targetAccount);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-2xl">
      {/* Step Indicator Header */}
      <div className="mb-6 flex flex-col items-start gap-3 border-b border-gray-200 pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-xs font-bold text-[#C9932E] uppercase tracking-wider mb-0.5">
            Secure transfer verification
          </div>
          <h1 className="text-2xl font-bold text-[#0F766E] font-serif">
            Pay & Transfer Funds
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold text-gray-500 sm:gap-2 sm:text-xs">
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              step === 'details' ? 'bg-[#0F766E] text-white' : 'bg-emerald-100 text-emerald-800'
            }`}
          >
            1
          </span>
          <span>Details</span>
          <span>→</span>
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              step === '2fa' ? 'bg-[#C9932E] text-white' : step === 'success' ? 'bg-emerald-100 text-emerald-800' : 'bg-gray-200 text-gray-600'
            }`}
          >
            2
          </span>
          <span>Verify</span>
          <span>→</span>
          <span
            className={`w-6 h-6 rounded-full flex items-center justify-center ${
              step === 'success' ? 'bg-emerald-600 text-white' : 'bg-gray-200 text-gray-600'
            }`}
          >
            3
          </span>
          <span>Receipt</span>
        </div>
      </div>

      {error && (
        <div className="mb-6 p-3.5 bg-red-50 border-l-4 border-[#C9932E] text-red-800 text-xs flex items-start gap-2.5">
          <AlertCircle className="w-4 h-4 text-[#C9932E] flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Transaction Warning:</div>
            <div>{error}</div>
          </div>
        </div>
      )}

      {/* STEP 1: TRANSFER DETAILS FORM */}
      {step === 'details' && (
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          <div className="h-1.5 bg-[#0F766E]" />

          <form onSubmit={handleInitiate} className="space-y-5 p-4 sm:p-6">
            {/* Transfer Type Selector */}
            <div>
              <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-2">
                Transfer Method
              </label>
              <div className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-3 sm:text-xs">
                <button
                  type="button"
                  onClick={() => setTransferType('internal')}
                  className={`flex min-h-12 items-center gap-3 p-3 border rounded-sm font-semibold text-left transition-colors cursor-pointer sm:min-h-0 sm:flex-col sm:gap-0 sm:text-center ${
                    transferType === 'internal'
                      ? 'border-[#0F766E] bg-blue-50/60 text-[#0F766E]'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Building2 className="w-4 h-4 shrink-0 text-[#0F766E] sm:mx-auto sm:mb-1" />
                  Between My Accounts
                </button>

                <button
                  type="button"
                  onClick={() => setTransferType('zelle')}
                  className={`flex min-h-12 items-center gap-3 p-3 border rounded-xs font-semibold text-left transition-colors cursor-pointer sm:min-h-0 sm:flex-col sm:gap-0 sm:text-center ${
                    transferType === 'zelle'
                      ? 'border-[#0F766E] bg-blue-50/60 text-[#0F766E]'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <Send className="w-4 h-4 shrink-0 text-[#0F766E] sm:mx-auto sm:mb-1" />
                  Send to saved recipient
                </button>

                <button
                  type="button"
                  onClick={() => setTransferType('external')}
                  className={`flex min-h-12 items-center gap-3 p-3 border rounded-xs font-semibold text-left transition-colors cursor-pointer sm:min-h-0 sm:flex-col sm:gap-0 sm:text-center ${
                    transferType === 'external'
                      ? 'border-[#0F766E] bg-blue-50/60 text-[#0F766E]'
                      : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  <DollarSign className="w-4 h-4 shrink-0 text-[#0F766E] sm:mx-auto sm:mb-1" />
                  Domestic Wire / Bank
                </button>
              </div>
            </div>

            {/* From Account */}
            <div>
              <label
                htmlFor="select-source-account"
                className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
              >
                Transfer From (Source Account)
              </label>
              <select
                id="select-source-account"
                value={sourceAccountId}
                onChange={(e) => setSourceAccountId(e.target.value)}
                className="min-h-12 w-full min-w-0 p-3 text-base border border-gray-300 rounded-xs bg-white text-gray-900 focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] outline-hidden"
              >
                {accounts.map((acc) => (
                  <option key={acc.id} value={acc.id}>
                    {acc.nickname} · {acc.display_number} — {formatUSD(getAvailableBalance(acc))} available
                  </option>
                ))}
              </select>
            </div>

            {/* Destination Selection */}
            {transferType === 'internal' ? (
              <div>
                <label
                  htmlFor="select-dest-account"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                >
                  Transfer To (Destination Account)
                </label>
                <select
                  id="select-dest-account"
                  value={destinationAccountId}
                  onChange={(e) => setDestinationAccountId(e.target.value)}
                className="min-h-12 w-full min-w-0 p-3 text-base border border-gray-300 rounded-xs bg-white text-gray-900 focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] outline-hidden"
                >
                  {accounts
                    .filter((a) => a.id !== sourceAccountId)
                    .map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.nickname} · {acc.display_number} — Current: {formatUSD(acc.balance)}
                      </option>
                    ))}
                </select>
              </div>
            ) : (
              <div className="space-y-3 p-3.5 bg-gray-50 border border-gray-200 rounded-xs text-xs">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <span className="font-bold text-gray-700">Recipient Information</span>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => fillQuickRecipient('Sarah Jenkins', 's.jenkins@email.com')}
                      className="min-h-9 text-[10px] bg-white border border-gray-300 px-2 py-1 rounded text-[#0F766E] hover:bg-gray-100"
                    >
                      + Sarah J. (saved recipient)
                    </button>
                    <button
                      type="button"
                      onClick={() => fillQuickRecipient('Austin Real Estate Escrow', '9840291048')}
                      className="min-h-9 text-[10px] bg-white border border-gray-300 px-2 py-1 rounded text-[#0F766E] hover:bg-gray-100"
                    >
                      + Escrow (Wire)
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-gray-600 mb-1">
                    Recipient Full Name
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Sarah Jenkins"
                    value={recipientName}
                    onChange={(e) => setRecipientName(e.target.value)}
                    className="min-h-11 w-full min-w-0 p-3 text-base bg-white border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#0F766E]"
                  />
                </div>

                <div>
                  <label className="block font-medium text-gray-600 mb-1">
                    {transferType === 'zelle'
                      ? 'Recipient Email or Mobile Phone'
                      : 'Recipient Account Number'}
                  </label>
                  <input
                    type="text"
                    required
                    placeholder={
                      transferType === 'zelle' ? 'name@domain.com or (555) 000-0000' : '9-12 digit account number'
                    }
                    value={recipientAccount}
                    onChange={(e) => setRecipientAccount(e.target.value)}
                    className="min-h-11 w-full min-w-0 p-3 text-base bg-white border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#0F766E]"
                  />
                </div>

                {transferType === 'external' && (
                  <div>
                    <label className="block font-medium text-gray-600 mb-1">
                      Routing Number (ABA)
                    </label>
                    <input
                      type="text"
                      value={recipientRouting}
                      onChange={(e) => setRecipientRouting(e.target.value)}
                      className="min-h-11 w-full min-w-0 p-3 text-base bg-white border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#0F766E]"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Amount in USD */}
            <div>
              <label
                htmlFor="input-transfer-amount"
                className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
              >
                Transfer Amount (USD)
              </label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold text-base">
                  $
                </span>
                <input
                  id="input-transfer-amount"
                  type="number"
                  step="0.01"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full pl-8 pr-16 py-2.5 text-base font-bold text-gray-900 border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#0F766E] focus:border-[#0F766E] outline-hidden"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">
                  USD
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                {[50, 100, 250, 500, 1000].map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setAmount(preset.toString())}
                    className="min-h-9 px-3 py-1 text-[11px] bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xs transition-colors cursor-pointer"
                  >
                    ${preset}
                  </button>
                ))}
              </div>
            </div>

            {/* Memo */}
            <div>
              <label
                htmlFor="input-transfer-memo"
                className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
              >
                Memo / Note (Optional)
              </label>
              <input
                id="input-transfer-memo"
                type="text"
                maxLength={60}
                placeholder="e.g. Monthly rent or savings goal"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                className="min-h-11 w-full min-w-0 p-3 text-base border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#0F766E] outline-hidden"
              />
            </div>

            {/* Delivery Channel for Security Code */}
            <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xs text-xs">
              <span className="font-bold text-[#0F766E] block mb-1">
                Security Verification Preference:
              </span>
              <div className="flex flex-col gap-2 text-gray-700 sm:flex-row sm:gap-4">
                <label className="flex min-h-9 items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    checked={channel === 'sms'}
                    onChange={() => setChannel('sms')}
                    className="text-[#0F766E]"
                  />
                  <span>Text Message (SMS)</span>
                </label>
                <label className="flex min-h-9 items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="channel"
                    checked={channel === 'email'}
                    onChange={() => setChannel('email')}
                    className="text-[#0F766E]"
                  />
                  <span>Email Authorization</span>
                </label>
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col-reverse gap-2 pt-3 border-t border-gray-200 sm:flex-row sm:items-center sm:justify-between">
              <button
                type="button"
                onClick={onCancel}
                className="min-h-11 w-full px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer sm:w-auto"
              >
                Cancel
              </button>

              <button
                id="btn-submit-transfer-init"
                type="submit"
                disabled={loading}
                className="min-h-11 w-full justify-center px-6 py-2.5 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-75 sm:w-auto"
              >
                {loading ? (
                  <RefreshCw className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <span>Review & Authorize</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* STEP 2: REVIEW & TWO-STEP VERIFICATION */}
      {step === '2fa' && (
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          <div className="h-1.5 bg-[#C9932E]" />

          <div className="p-4 sm:p-6">
            <div className="flex items-center gap-2 text-xs font-bold text-[#C9932E] uppercase tracking-wider mb-1">
              <ShieldCheck className="w-4 h-4" />
              <span>Prototype confirmation step</span>
            </div>
            <h2 className="text-xl font-bold text-[#0F766E] font-serif mb-1">
              Confirm & Submit Transfer
            </h2>
            <p className="text-xs text-gray-500 mb-5">
              Review your transaction details and enter the one-time authorization code dispatched to {maskedContact}.
            </p>

            {/* Transfer Summary Table */}
            <div className="bg-gray-50 border border-gray-200 rounded-sm p-4 mb-5 text-xs space-y-2.5">
              <div className="flex flex-col gap-1 pb-2 border-b border-gray-200 sm:flex-row sm:items-start sm:justify-between">
                <span className="text-gray-500">Transfer Amount:</span>
                <span className="break-words font-mono font-bold text-base text-[#0F766E] sm:text-right">
                  {formatUSD(parseFloat(amount))} USD
                </span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-gray-500">From Account:</span>
                <span className="break-words font-semibold text-gray-900 sm:text-right">
                  {selectedSourceAccount?.nickname} ({selectedSourceAccount?.display_number})
                </span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-gray-500">To Recipient:</span>
                <span className="break-words font-semibold text-gray-900 sm:text-right">
                  {transferType === 'internal'
                    ? accounts.find((a) => a.id === destinationAccountId)?.nickname
                    : recipientName}
                </span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-gray-500">Transfer Fee:</span>
                <span className="font-bold text-emerald-700">$0.00 USD (Complimentary)</span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-gray-500">Execution Speed:</span>
                <span className="font-medium text-gray-700">Immediate</span>
              </div>
            </div>

            {/* Simulated Notification Box for testing in sandbox */}
            {simulatedOtp && (
              <div className="mb-5 p-3.5 bg-emerald-50 border border-emerald-300 rounded-xs text-xs">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-800 flex items-center gap-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    Security Code Sent ({channel.toUpperCase()}):
                  </span>
                  <button
                    type="button"
                    onClick={() => setOtpCode(simulatedOtp)}
                    className="text-[11px] font-bold text-emerald-700 underline hover:text-emerald-900 cursor-pointer"
                  >
                    Auto-fill Code
                  </button>
                </div>
                <div className="mt-1.5 flex items-baseline gap-2">
                  <span className="text-emerald-700">One-Time Code:</span>
                  <span className="text-base font-mono font-bold tracking-widest text-[#0F766E] bg-white px-2.5 py-0.5 rounded border border-emerald-200">
                    {simulatedOtp}
                  </span>
                </div>
              </div>
            )}

            <form onSubmit={handleConfirmTransfer} className="space-y-4">
              <div>
                <label
                  htmlFor="input-transfer-otp"
                  className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1.5"
                >
                  Enter 6-Digit Transfer Authorization Code
                </label>
                <input
                  id="input-transfer-otp"
                  type="text"
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                  required
                  placeholder="123456"
                  autoFocus
                  className="w-full text-center text-xl font-mono tracking-widest px-3.5 py-2.5 border border-gray-300 rounded-xs focus:ring-1 focus:ring-[#C9932E] focus:border-[#C9932E] outline-hidden transition-colors"
                />
              </div>

              <div className="flex flex-col-reverse gap-2 pt-3 border-t border-gray-200 sm:flex-row sm:items-center sm:justify-between">
                <button
                  type="button"
                  onClick={() => setStep('details')}
                  className="min-h-11 w-full px-4 py-2 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer sm:w-auto"
                >
                  Back to Details
                </button>

                <button
                  id="btn-confirm-transfer-otp"
                  type="submit"
                  disabled={loading || otpCode.length !== 6}
                  className="min-h-11 w-full justify-center px-6 py-2.5 bg-[#C9932E] hover:bg-[#A8761B] text-white text-xs font-bold uppercase tracking-wider rounded-xs shadow-xs transition-colors flex items-center gap-2 cursor-pointer disabled:opacity-60 sm:w-auto"
                >
                  {loading ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Lock className="w-4 h-4" />
                      <span>Verify & Submit for Review</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* STEP 3: SUCCESS CONFIRMATION RECEIPT */}
      {step === 'success' && (
        <div className="bg-white border border-gray-200 rounded-sm shadow-sm overflow-hidden">
          <div className="h-1.5 bg-emerald-600" />

          <div className="p-6 sm:p-8 text-center">
            <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-emerald-600" />
            </div>

            <h2 className="text-2xl font-bold text-[#0F766E] font-serif">
              Transfer Submitted for Review
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Your transfer request is pending bank/admin approval. The amount is reserved now and will post only after approval.
            </p>

            <div className="mt-6 max-w-md mx-auto bg-gray-50 border border-gray-200 rounded-sm p-4 text-xs text-left space-y-2.5">
              <div className="flex flex-col gap-1 pb-2 border-b border-gray-200 sm:flex-row sm:items-start sm:justify-between">
                <span className="text-gray-500">Amount Requested:</span>
                <span className="break-words font-mono font-bold text-base text-gray-900 sm:text-right">
                  {formatUSD(parseFloat(amount))} USD
                </span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-gray-500">Transaction ID:</span>
                <span className="break-all font-mono text-gray-700 sm:text-right">{completedTxId}</span>
              </div>
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-gray-500">Funding Account:</span>
                <span className="break-words font-semibold text-gray-900 sm:text-right">
                  {selectedSourceAccount?.nickname} ({selectedSourceAccount?.display_number})
                </span>
              </div>
              {newSourceBalance !== null && (
                <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                  <span className="text-gray-500">New Available Balance:</span>
                  <span className="font-mono font-bold text-emerald-700">
                    {formatUSD(newSourceBalance)} USD
                  </span>
                </div>
              )}
              <div className="flex flex-col gap-1 sm:flex-row sm:justify-between">
                <span className="text-gray-500">Status:</span>
                <span className="font-bold text-amber-700">Pending bank/admin approval</span>
              </div>
            </div>

            <div className="mt-8 flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-center sm:gap-3">
              <button
                type="button"
                onClick={() => {
                  setStep('details');
                  setAmount('');
                  setMemo('');
                  setOtpCode('');
                }}
                className="min-h-11 w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-semibold rounded-sm transition-colors cursor-pointer sm:w-auto"
              >
                Make Another Transfer
              </button>

              <button
                type="button"
                onClick={onCancel}
                className="min-h-11 w-full px-5 py-2 bg-[#0F766E] hover:bg-[#115E59] text-white text-xs font-bold uppercase tracking-wider rounded-sm shadow-sm transition-colors cursor-pointer sm:w-auto"
              >
                Return to Accounts Overview
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
