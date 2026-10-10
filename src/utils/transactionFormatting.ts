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
    transaction.recipient_name,
  ];
  const sender = candidates.find((candidate) => !isGenericSender(candidate));
  if (sender) return sender.trim();

  const typeAndDescription = `${transaction.transaction_type || ''} ${transaction.category || ''} ${transaction.description}`.toLowerCase();
  if (typeAndDescription.includes('payroll') || typeAndDescription.includes('direct deposit')) {
    return 'Gusto Payroll Services';
  }
  return 'ACH Direct Deposit';
};

/** Normalizes legacy administrator adjustment labels for transaction displays. */
export const formatTransactionDescription = (description: string): string =>
  description.replace(/^Admin\s+(debit|credit)\b/i, (_match, direction: string) =>
    `Bank ${direction[0].toUpperCase()}${direction.slice(1).toLowerCase()}`,
  );
