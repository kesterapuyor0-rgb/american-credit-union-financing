import { Router, Response } from 'express';
import { Notification } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { AuthenticatedRequest, requireApprovedUser } from '../auth.js';

const router = Router();
router.use(requireDatabase, requireApprovedUser);

router.get('/', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const notifications = await Notification.find({ userId: req.user!.id })
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();
    res.json({ notifications });
  } catch (err) {
    console.error('Notification list retrieval failed:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to load notifications.') });
  }
});

router.patch('/read-all', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const result = await Notification.updateMany(
      { userId: req.user!.id, isRead: false },
      { $set: { isRead: true } },
    );
    res.json({ success: true, modifiedCount: result.modifiedCount });
  } catch (err) {
    console.error('Mark-all-read operation failed:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to update notifications.') });
  }
});

router.patch('/:id/read', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const notification = await Notification.findOneAndUpdate(
      { id: req.params.id, userId: req.user!.id },
      { $set: { isRead: true } },
      { new: true },
    ).lean();
    if (!notification) {
      res.status(404).json({ error: 'Notification not found.' });
      return;
    }
    res.json({ notification });
  } catch (err) {
    console.error('Mark-read operation failed:', err);
    res.status(500).json({ error: errorMessage(err, 'Unable to update notification.') });
  }
});

export default router;
