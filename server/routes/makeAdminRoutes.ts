import { timingSafeEqual } from 'crypto';
import { Router, Request, Response } from 'express';
import { User } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';

const router = Router();

router.post('/make-admin', requireDatabase, async (req: Request, res: Response): Promise<void> => {
  const expectedSecret = process.env.ADMIN_ROLE_BOOTSTRAP_SECRET || '';
  const suppliedSecret = req.get('x-admin-bootstrap-secret') || '';

  if (expectedSecret.length < 32) {
    res.status(503).json({ error: 'Admin bootstrap is not configured.' });
    return;
  }

  const expectedBytes = Buffer.from(expectedSecret, 'utf8');
  const suppliedBytes = Buffer.from(suppliedSecret, 'utf8');
  if (expectedBytes.length !== suppliedBytes.length || !timingSafeEqual(expectedBytes, suppliedBytes)) {
    res.status(401).json({ error: 'Unauthorized.' });
    return;
  }

  try {
    const result = await User.updateOne(
      { email: /^apuyork@gmail\.com$/i, role: { $ne: 'admin' } },
      { $set: { role: 'admin' } }
    );

    if (result.matchedCount === 0) {
      const existingUser = await User.findOne({ email: /^apuyork@gmail\.com$/i }).select('id role').lean<any>();
      if (!existingUser) {
        res.status(404).json({ error: 'Target user not found.' });
        return;
      }
      res.json({ success: true, role: 'admin', message: 'The account already has the admin role.' });
      return;
    }

    res.json({ success: true, role: 'admin', message: 'The account role was updated.' });
  } catch (error) {
    console.error('Admin role bootstrap failed:', errorMessage(error, 'Unknown error'));
    res.status(500).json({ error: 'Unable to update the account role.' });
  }
});

export default router;
