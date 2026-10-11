import type { Transaction } from '../types';

const GENERIC_SENDER_LABELS = new Set([
  'bank administrator',
  'account administration',
  'bank administration',
  'administrator',
  'system',
]);

const isGenericSender = (value?: string): boolean => {
  const normalized = value?.trim().toLowerCase();
  return !normalized || GENERIC_SENDER_LABELS.has(normalized);
};

export const getTransactionSenderName = (transaction: Transaction): string => {
  const candidates = [
    transaction.sender_name,
    transaction.senderName,
    transaction.counterparty,
    ...(['deposit', 'transfer_in'].includes(transaction.type) ? [transaction.recipient_name] : []),
  ];
  const sender = candidates.find((candidate) => !isGenericSender(candidate));
  if (sender) return sender.trim();

  const typeAndDescription = `${transaction.transaction_type || ''} ${transaction.category || ''} ${transaction.description}`.toLowerCase();
  if (typeAndDescription.includes('payroll') || typeAndDescription.includes('direct deposit') || typeAndDescription.includes('ach')) {
    return 'Gusto Payroll Inc.';
  }
  return 'Treasury Disbursement';
};

export const getTransactionModalTitle = (transaction: Transaction): string => {
  const metadata = `${transaction.transaction_type || ''} ${transaction.category || ''} ${transaction.description}`.toLowerCase();
  const category = metadata.includes('grant')
    ? 'Grant Disbursement'
    : metadata.includes('direct deposit') || metadata.includes('payroll') || metadata.includes('ach')
      ? 'Direct Deposit'
      : metadata.includes('wire')
        ? 'Wire Transfer'
        : metadata.includes('other credit')
          ? 'Account Credit'
          : transaction.category?.trim() || transaction.transaction_type?.trim() || 'Account Credit';
  return `${category} - ${getTransactionSenderName(transaction)}`;
};

/** Normalizes legacy administrator adjustment labels for transaction displays. */
export const formatTransactionDescription = (description: string): string =>
  description.replace(/^Admin\s+(debit|credit)\b/i, (_match, direction: string) =>
    `Bank ${direction[0].toUpperCase()}${direction.slice(1).toLowerCase()}`,
  );
