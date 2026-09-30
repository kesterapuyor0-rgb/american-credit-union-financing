import { Router } from 'express';
import mongoose from 'mongoose';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { User } from '../models/User.js';
import { LikenessProfile, likenessStatuses } from '../models/LikenessProfile.js';

const router = Router();
router.use(requireAuth, requireAdmin);

router.get('/users/pending', async (_req, res) => {
  try {
    const users = await User.find({ approvalStatus: 'pending', isApproved: false })
      .select('username email role isApproved approvalStatus createdAt').sort({ createdAt: 1 }).lean();
    res.json({ users: users.map(({ _id, ...user }) => ({ id: _id.toString(), ...user })) });
  } catch {
    res.status(500).json({ error: 'Unable to fetch pending users.' });
  }
});

router.patch('/users/:id/review', async (req, res) => {
  const { id } = req.params;
  const decision = req.body?.decision;
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: 'Invalid user id.' });
    return;
  }
  if (decision !== 'approve' && decision !== 'reject') {
    res.status(400).json({ error: 'decision must be approve or reject.' });
    return;
  }
  try {
    const user = await User.findOneAndUpdate(
      { _id: id, approvalStatus: 'pending' },
      { $set: { isApproved: decision === 'approve', approvalStatus: decision === 'approve' ? 'approved' : 'rejected' } },
      { new: true, runValidators: true },
    ).select('username email role isApproved approvalStatus');
    if (!user) {
      res.status(404).json({ error: 'Pending user not found.' });
      return;
    }
    res.json({ user });
  } catch {
    res.status(500).json({ error: 'Unable to review user.' });
  }
});

router.get('/likeness/pending', async (_req, res) => {
  try {
    const profiles = await LikenessProfile.find({ status: 'pending', expiresAt: { $gt: new Date() } })
      .select('-confirmationCodeHash').sort({ createdAt: 1 }).lean();
    res.json({ profiles });
  } catch {
    res.status(500).json({ error: 'Unable to fetch pending likeness profiles.' });
  }
});

router.put('/likeness/:id', async (req, res) => {
  const { id } = req.params;
  const { status, forcedLabelState } = req.body ?? {};
  if (!mongoose.isValidObjectId(id)) {
    res.status(400).json({ error: 'Invalid likeness profile id.' });
    return;
  }
  if ((status === undefined && forcedLabelState === undefined) ||
      (status !== undefined && !likenessStatuses.includes(status)) ||
      (forcedLabelState !== undefined && typeof forcedLabelState !== 'boolean')) {
    res.status(400).json({ error: 'Provide a valid status and/or boolean forcedLabelState.' });
    return;
  }
  const update: Record<string, unknown> = {};
  if (status !== undefined) {
    update.status = status;
    if (status === 'verified') update.verifiedAt = new Date();
    if (status === 'revoked') update.revokedAt = new Date();
    if (status === 'pending' || status === 'rejected') {
      update.verifiedAt = null;
      update.revokedAt = null;
    }
  }
  if (forcedLabelState !== undefined) update.forcedLabelState = forcedLabelState;
  try {
    const profile = await LikenessProfile.findByIdAndUpdate(id, { $set: update }, { new: true, runValidators: true })
      .select('-confirmationCodeHash');
    if (!profile) {
      res.status(404).json({ error: 'Likeness profile not found.' });
      return;
    }
    res.json({ profile });
  } catch {
    res.status(500).json({ error: 'Unable to update likeness profile.' });
  }
});

export default router;
