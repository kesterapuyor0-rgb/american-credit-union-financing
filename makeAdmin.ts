import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { User } from './server/models.js';
import { connectDatabase } from './server/db.js';

dotenv.config({ path: '.env.local' });
dotenv.config();

async function promoteLocalAccount(): Promise<void> {
  if (process.env.RUN_ADMIN_ROLE_MIGRATION_ONCE !== 'true') {
    throw new Error('Set RUN_ADMIN_ROLE_MIGRATION_ONCE=true to run this one-time migration.');
  }

  try {
    await connectDatabase();
    const testDb = mongoose.connection.useDb('test');
    const TestUser = testDb.models.User || testDb.model('User', User.schema, 'users');
    const result = await TestUser.updateOne(
      { email: /^apuyork@gmail\.com$/i, role: { $ne: 'admin' } },
      { $set: { role: 'admin' } }
    );

    if (result.matchedCount !== 1) {
      const existingUser = await TestUser.exists({ email: /^apuyork@gmail\.com$/i, role: 'admin' });
      if (!existingUser) throw new Error('Target user was not found in test.users.');
    }
    console.info(result.modifiedCount === 1 ? 'User role migration completed.' : 'User already has the admin role.');
  } finally {
    await mongoose.disconnect();
  }
}

promoteLocalAccount().catch((error: unknown) => {
  console.error('Admin role migration failed:', error instanceof Error ? error.message : 'Unknown error.');
  process.exitCode = 1;
});
