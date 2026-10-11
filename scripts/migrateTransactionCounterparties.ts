import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { Transaction, User } from '../server/models.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

const genericName = /^(?:bank administrator|account administration|bank administration|administrator|system)$/i;
const redundantDirectDeposit = /direct deposit\s*[-:]\s*ach direct deposit/i;
const legacyTransactions = {
  $or: [
    { sender_name: genericName },
    { recipient_name: genericName },
    { description: redundantDirectDeposit },
    { transaction_type: /^ACH Direct Deposit$/i },
    { category: /^ACH Direct Deposit$/i },
  ],
};

async function migrateTransactionCounterparties(): Promise<void> {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!mongoUri) {
    throw new Error('Set MONGO_URI, MONGODB_URI, or MONGO_URL before running the transaction migration.');
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000,
  });

  let updatedCount = 0;
  let unresolvedRecipientCount = 0;
  const recipientNameCache = new Map<string, string | null>();

  try {
    const cursor = Transaction.find(legacyTransactions).lean().cursor();
    for await (const transaction of cursor) {
      const updates: Record<string, string> = {};
      const classification = `${transaction.transaction_type || ''} ${transaction.category || ''} ${transaction.description || ''}`.toLowerCase();
      const isPayroll = classification.includes('payroll')
        || classification.includes('direct deposit')
        || classification.includes('ach');

      if (genericName.test(String(transaction.sender_name || '').trim())) {
        updates.sender_name = isPayroll ? 'Gusto Payroll Inc.' : 'Treasury Disbursement';
      }

      if (genericName.test(String(transaction.recipient_name || '').trim())) {
        const userId = String(transaction.user_id || '');
        if (!recipientNameCache.has(userId)) {
          const user = userId
            ? await User.findOne({ id: userId }).select('full_name').lean<{ full_name?: string } | null>()
            : null;
          recipientNameCache.set(userId, user?.full_name?.trim() || null);
        }
        const recipientName = recipientNameCache.get(userId);
        if (recipientName) {
          updates.recipient_name = recipientName;
        } else {
          unresolvedRecipientCount += 1;
          console.error(`Could not resolve account holder for transaction ${transaction.id} (user ${userId || 'missing'}).`);
        }
      }

      if (/^ACH Direct Deposit$/i.test(String(transaction.transaction_type || '').trim())) {
        updates.transaction_type = 'Payroll Processing';
      }
      if (/^ACH Direct Deposit$/i.test(String(transaction.category || '').trim())) {
        updates.category = 'Direct Deposit';
      }
      if (redundantDirectDeposit.test(String(transaction.description || ''))) {
        updates.description = String(transaction.description).replace(
          /^(\s*)direct deposit\s*[-:]\s*ach direct deposit/i,
          '$1Direct Deposit - Payroll Processing',
        );
      }

      if (Object.keys(updates).length > 0) {
        await Transaction.updateOne({ id: transaction.id }, { $set: updates });
        updatedCount += 1;
      }
    }
  } finally {
    await mongoose.disconnect();
  }

  console.info(`Updated ${updatedCount} transaction record(s).`);
  if (unresolvedRecipientCount > 0) {
    throw new Error(`${unresolvedRecipientCount} legacy recipient name(s) could not be mapped to an account holder.`);
  }
}

migrateTransactionCounterparties().catch((error: unknown) => {
  console.error('Transaction counterparty migration failed:', error);
  process.exitCode = 1;
});
