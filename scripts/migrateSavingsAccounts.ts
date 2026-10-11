import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { randomInt, randomUUID } from 'crypto';
import { Account } from '../server/models.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function reserveAccountNumber(): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    const accountNumber = `48${randomInt(0, 100_000_000).toString().padStart(8, '0')}`;
    if (!(await Account.exists({ account_number: accountNumber }))) return accountNumber;
  }
  throw new Error('Unable to reserve a unique savings account number after 50 attempts.');
}

async function migrateSavingsAccounts(): Promise<void> {
  const mongoUri = process.env.MONGO_URI || process.env.MONGODB_URI || process.env.MONGO_URL;
  if (!mongoUri) {
    throw new Error('Set MONGO_URI, MONGODB_URI, or MONGO_URL before running the savings-account migration.');
  }

  await mongoose.connect(mongoUri, {
    serverSelectionTimeoutMS: Number(process.env.MONGO_SERVER_SELECTION_TIMEOUT_MS) || 10000,
  });

  let provisionedCount = 0;
  try {
    const userIds = await Account.distinct('user_id', { account_type: 'Checking', status: 'Active' });
    for (const userId of userIds) {
      const existingSavings = await Account.findOne({ user_id: userId, account_type: 'Savings' })
        .select('id interest_rate accrued_interest last_interest_accrual_date')
        .lean<any>();
      if (existingSavings) {
        const defaults: Record<string, unknown> = {};
        if (existingSavings.interest_rate === undefined) defaults.interest_rate = 0.015;
        if (existingSavings.accrued_interest === undefined) defaults.accrued_interest = 0;
        if (existingSavings.last_interest_accrual_date === undefined) defaults.last_interest_accrual_date = '';
        if (Object.keys(defaults).length > 0) {
          await Account.updateOne({ id: existingSavings.id }, { $set: defaults });
        }
        continue;
      }

      const checking = await Account.findOne({ user_id: userId, account_type: 'Checking', status: 'Active' })
        .select('routing_number currency')
        .lean<{ routing_number?: string; currency?: string } | null>();
      if (!checking) continue;

      await Account.create({
        id: `acc_${randomUUID()}`,
        user_id: userId,
        account_number: await reserveAccountNumber(),
        account_type: 'Savings',
        nickname: 'Member Savings',
        balance: 0,
        held_balance: 0,
        currency: checking.currency || 'USD',
        routing_number: checking.routing_number || '026009593',
        interest_rate: 0.015,
        accrued_interest: 0,
        last_interest_accrual_date: '',
        status: 'Active',
        created_at: new Date().toISOString(),
      });
      provisionedCount += 1;
    }
  } finally {
    await mongoose.disconnect();
  }

  console.info(`Provisioned ${provisionedCount} savings account(s).`);
}

migrateSavingsAccounts().catch((error: unknown) => {
  console.error('Savings-account migration failed:', error);
  process.exitCode = 1;
});
