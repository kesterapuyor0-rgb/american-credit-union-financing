import 'dotenv/config';
import { createHash, randomBytes } from 'node:crypto';
import mongoose from 'mongoose';
import { connectDatabase } from '../server/db.js';
import { ConsentRecord } from '../server/models/ConsentRecord.js';
import { User } from '../server/models/User.js';

async function seedDevConsent(): Promise<void> {
  if (process.env.NODE_ENV !== 'development' || process.env.ENABLE_DEV_CONSENT_SEED !== 'true') {
    throw new Error('This seed is development-only. Set NODE_ENV=development and ENABLE_DEV_CONSENT_SEED=true for one run.');
  }
  const email = process.env.DEV_CONSENT_USER_EMAIL?.trim().toLowerCase();
  if (!email) throw new Error('Set DEV_CONSENT_USER_EMAIL to the account that should receive the test consent record.');

  await connectDatabase();
  const user = await User.findOne({ email }).select('_id email isApproved isBlocked').lean();
  if (!user) throw new Error(`No Apuyor account was found for ${email}. Register and approve the account first.`);
  if (!user.isApproved || user.isBlocked) throw new Error('The account must be approved and unblocked before it can use the likeness upload flow.');

  const now = new Date();
  const existing = await ConsentRecord.findOne({
    userId: user._id,
    status: 'verified',
    expiresAt: { $gt: now },
    referenceVideoPath: { $regex: '^dev-seed/' },
  }).select('_id expiresAt').lean();

  const record = existing ?? await ConsentRecord.create({
    userId: user._id,
    confirmationCodeHash: createHash('sha256').update(randomBytes(32)).digest('hex'),
    status: 'verified',
    expiresAt: new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000),
    referenceVideoPath: `dev-seed/${user._id.toString()}/consent-test.mp4`,
    forcedLabelState: true,
    verifiedAt: now,
  });

  console.log(JSON.stringify({
    message: 'Development test consent is ready. Refresh the Likeness profiles dialog.',
    user: email,
    consentRecordId: record._id.toString(),
    expiresAt: record.expiresAt,
  }, null, 2));
}

seedDevConsent()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : 'Unable to create development consent.');
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
