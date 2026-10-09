export interface User {
  id: string;
  email: string;
  full_name: string;
  role: 'user' | 'admin';
  phone: string;
  isRestricted?: boolean;
  restrictionReason?: string;
  address?: string;
  profilePicture?: string;
  created_at?: string;
}

export interface BankAccount {
  id: string;
  user_id: string;
  account_number: string;
  account_type: 'Checking' | 'Savings' | 'Credit Card';
  nickname: string;
  balance: number;
  held_balance?: number;
  currency: string;
  routing_number: string;
  credit_limit?: number;
  status: 'Active' | 'Locked' | 'Closed';
  display_number: string;
  masked_number: string;
  available_balance?: number;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  type: 'deposit' | 'withdrawal' | 'transfer_in' | 'transfer_out' | 'payment' | 'admin_adjustment' | 'admin_credit' | 'admin_debit' | 'admin_hold' | 'admin_release' | 'card_debit' | 'card_credit';
  amount: number;
  transfer_fee?: number;
  transfer_tax?: number;
  currency: string;
  description: string;
  recipient_name?: string;
  recipient_account?: string;
  status: string;
  category?: string;
  date: string;
  created_at: number;
  account_name?: string;
  account_number?: string;
}

export interface BankCard {
  id: string;
  user_id: string;
  account_id: string;
  card_type: 'Debit' | 'Credit';
  network: 'Visa' | 'Mastercard';
  product_name: string;
  last4: string;
  masked_number?: string;
  linked_account_name?: string;
  linked_account_number?: string;
  linked_account_available?: number;
  currency?: string;
  status: 'Active' | 'Locked';
  credit_limit: number;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  account_nickname?: string;
  account_number?: string;
  account_balance?: number;
  held_balance?: number;
  account_currency?: string;
  account_status?: string;
}

export interface CardApplication {
  id: string;
  user_id: string;
  account_id: string;
  card_type: 'Debit' | 'Credit';
  network: 'Visa' | 'Mastercard';
  product_name: string;
  requested_limit: number;
  status: 'Pending' | 'Approved' | 'Rejected';
  created_at: string;
  review_reason?: string;
  reviewed_by?: string;
  customer_name?: string;
  customer_email?: string;
  account_number?: string;
}

export interface UserSummary {
  totalDepositBalanceUSD: number;
  totalCreditBalanceUSD: number;
  totalCreditLimitUSD: number;
  pendingTransactionsCount: number;
  accountsCount: number;
}

export interface AuditLog {
  id: string;
  admin_id: string;
  admin_email: string;
  action: string;
  target_user_id?: string;
  target_account_id?: string;
  amount?: number;
  details: string;
  ip_address?: string;
  created_at: string;
  target_user_name?: string;
  target_account_number?: string;
}

export interface AdminOverviewData {
  totalUsers: number;
  totalAccounts: number;
  totalDepositsUSD: number;
  totalTransactions: number;
  pendingTransactions: number;
  totalAuditLogs: number;
  systemStatus: string;
  databaseEngine: string;
}

export interface UserWithAccounts extends User {
  accounts: BankAccount[];
  totalBalanceUSD: number;
}
