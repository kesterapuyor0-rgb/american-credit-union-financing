import * as cron from 'node-cron';
import mongoose from 'mongoose';
import { Account, Transaction } from './models.js';
import { connectDatabase, errorMessage } from './db.js';

let interestJob: ReturnType<typeof cron.schedule> | null = null;

function utcDateKey(date: Date): string {
  return date.toISOString().slice(0, 10);
}

export async function accrueSavingsInterest(date = new Date()): Promise<number> {
  const dateKey = utcDateKey(date);
  const cursor = Account.find({
    account_type: 'Savings',
    status: 'Active',
    currency: 'USD',
    interest_rate: { $gt: 0 },
  }).select('id user_id account_number balance interest_rate last_interest_accrual_date').lean<any[]>().cursor();

  let accruedAccounts = 0;
  const now = new Date();
  const effectiveDate = date.getTime() > now.getTime() ? now : date;
  const effectiveDateKey = utcDateKey(effectiveDate);
  for await (const account of cursor) {
    const session = await mongoose.startSession();
    let processed = false;
    try {
      await session.withTransaction(async () => {
        const lastAccruedDate = String(account.last_interest_accrual_date || '');
        if (lastAccruedDate && lastAccruedDate >= effectiveDateKey) return;
        const lastAccruedTime = lastAccruedDate
          ? Date.parse(`${lastAccruedDate}T00:00:00.000Z`)
          : NaN;
        const accrualDate = Number.isFinite(lastAccruedTime)
          ? new Date(Math.min(lastAccruedTime + 24 * 60 * 60 * 1000, effectiveDate.getTime()))
          : effectiveDate;
        const accrualDateKey = utcDateKey(accrualDate);
        const current = await Account.findOne({
          id: account.id,
          user_id: account.user_id,
          account_type: 'Savings',
          status: 'Active',
          currency: 'USD',
          last_interest_accrual_date: { $ne: accrualDateKey },
        }).session(session).lean<any>();
        if (!current) return;

        const balance = Number(current.balance);
        const rate = Number(current.interest_rate);
        if (!Number.isFinite(balance) || balance <= 0 || !Number.isFinite(rate) || rate <= 0) {
          const marked = await Account.updateOne(
            { id: current.id, last_interest_accrual_date: { $ne: accrualDateKey } },
            { $set: { last_interest_accrual_date: accrualDateKey } },
            { session },
          );
          processed = marked.modifiedCount === 1;
          return;
        }

      const interest = Math.round((balance * rate / 365) * 100) / 100;
      const increments: Record<string, number> = {};
      if (interest > 0) {
        increments.balance = interest;
        increments.accrued_interest = interest;
      }
      const updated = await Account.findOneAndUpdate({
        id: current.id,
        user_id: current.user_id,
        account_type: 'Savings',
        status: 'Active',
        currency: 'USD',
        balance: current.balance,
        last_interest_accrual_date: { $ne: accrualDateKey },
      }, {
        ...(Object.keys(increments).length > 0 ? { $inc: increments } : {}),
        $set: { last_interest_accrual_date: accrualDateKey },
      }, { new: true, session }).lean<any>();
      if (!updated) return;
      processed = true;

      if (interest > 0) {
        const transactionDate = utcDateKey(accrualDate);
        const transactionId = `tx_interest_${current.id}_${transactionDate}`;
        await Transaction.create([{
          id: transactionId,
          user_id: current.user_id,
          account_id: current.id,
          type: 'deposit',
          amount: interest,
          currency: 'USD',
          description: 'Daily Savings Interest',
          sender_name: 'Savings Interest',
          reference_id: transactionId,
          transaction_type: 'Interest Credit',
          status: 'Completed',
          category: 'Interest',
          date: transactionDate,
          created_at: accrualDate.getTime(),
        }], { session });
      }
      });
      if (processed) accruedAccounts += 1;
    } catch (error) {
      console.error(`Savings interest accrual failed for account ${account.id} on ${dateKey}:`, errorMessage(error, 'Unknown error.'));
      throw error;
    } finally {
      await session.endSession();
    }
  }
  return accruedAccounts;
}

export function startSavingsInterestCron(): void {
  if (interestJob) return;
  interestJob = cron.schedule('5 0 * * *', () => {
    void connectDatabase()
      .then(() => accrueSavingsInterest())
      .then((count) => console.info(`Savings interest accrual complete: ${count} account(s) processed.`))
      .catch((error: unknown) => console.error('Savings interest cron run failed:', errorMessage(error, 'Unknown error.')));
  }, { timezone: 'UTC' });
}
