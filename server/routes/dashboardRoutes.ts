import { Router, Response } from 'express';
import { Account, BankCard, Transaction } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { AuthenticatedRequest, requireApprovedUser } from '../auth.js';
import { maskedCardNumber, numericCardLastFour } from '../cardNumber.js';
import { formatCryptoAmount } from '../cryptoRates.js';

const router = Router();
router.use(requireDatabase);

router.get('/summary', requireApprovedUser, async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const userId = req.user!.id;
    const [accounts, issuedCards, recentRows, pendingTransactionsCount] = await Promise.all([
      Account.find({ user_id: userId })
        .select('id user_id account_number account_type nickname balance held_balance currency routing_number credit_limit status created_at')
        .sort({ account_type: 1, created_at: 1 }).lean<any[]>(),
      BankCard.find({ user_id: userId, status: 'Active' }).sort({ created_at: -1 })
        .select('id user_id account_id card_type network cardColor product_name last4 masked_number status credit_limit created_at')
        .lean<any[]>(),
      Transaction.find({ user_id: userId })
        .select('id user_id account_id type amount amount_usd transfer_fee transfer_tax currency description status category date created_at')
        .sort({ date: -1, created_at: -1 }).limit(3).lean<any[]>(),
      Transaction.countDocuments({ user_id: userId, status: /^pending$/i }),
    ]);

    const accountIds = [...new Set([
      ...issuedCards.map((card) => card.account_id),
      ...recentRows.map((row) => row.account_id),
    ])];
    const linkedAccounts = accountIds.length
      ? await Account.find({ id: { $in: accountIds }, user_id: userId })
        .select('id nickname balance held_balance currency')
        .lean<any[]>()
      : [];
    const accountById = new Map(linkedAccounts.map((account) => [account.id, account]));
    const formattedAccounts = accounts.map((account) => ({
      ...account,
      display_number: `...${String(account.account_number || '').slice(-4)}`,
      masked_number: `Account ending in ${String(account.account_number || '').slice(-4)}`,
      available_balance: Math.max(0, account.balance - (account.held_balance || 0)),
    }));

    const cards = issuedCards.map((card) => {
      const account = accountById.get(card.account_id);
      return {
        ...card,
        last4: numericCardLastFour(card.last4),
        network: card.network || 'Visa',
        cardColor: card.cardColor || 'emerald',
        masked_number: maskedCardNumber(card.network || 'Visa', card.last4),
        linked_account_name: account?.nickname || '',
        linked_account_available: account ? Math.max(0, account.balance - (account.held_balance || 0)) : 0,
        currency: account?.currency || 'USD',
      };
    });
    const recentTransactions = recentRows.map((row) => ({
      ...row,
      formatted_amount: row.amount_usd !== undefined && row.currency !== 'USD'
        ? formatCryptoAmount(Number(row.amount) || 0, row.currency)
        : new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: row.currency || 'USD',
        }).format(Math.abs(Number(row.amount) || 0)),
      account_name: accountById.get(row.account_id)?.nickname,
      account_number: accountById.get(row.account_id)?.account_number,
    }));

    const primaryAccount = formattedAccounts.find((account) =>
      account.account_type === 'Checking' || account.account_type === 'Savings'
    ) || formattedAccounts[0];
    const totalDepositBalanceUSD = formattedAccounts
      .filter((account) => account.account_type !== 'Credit Card')
      .reduce((total, account) => total + account.available_balance, 0);
    const creditAccounts = formattedAccounts.filter((account) => account.account_type === 'Credit Card');
    const summary = {
      totalDepositBalanceUSD,
      totalCreditBalanceUSD: creditAccounts.reduce((total, account) => total + account.balance, 0),
      totalCreditLimitUSD: creditAccounts.reduce((total, account) => total + (account.credit_limit || 0), 0),
      pendingTransactionsCount,
      accountsCount: formattedAccounts.length,
    };

    res.set('Cache-Control', 'private, no-store');
    res.json({
      accounts: formattedAccounts,
      availableBalance: primaryAccount?.available_balance || 0,
      accountNumber: primaryAccount?.display_number || '',
      cardsSummary: { activeCount: cards.length, cards },
      recentTransactions,
      summary,
    });
  } catch (err) {
    console.error('Error fetching lightweight dashboard summary:', err);
    res.status(500).json({ error: errorMessage(err, 'Failed to retrieve dashboard summary.') });
  }
});

export default router;
