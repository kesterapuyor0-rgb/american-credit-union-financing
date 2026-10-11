import { Router, Response } from 'express';
import { Notification, User } from '../models.js';
import { errorMessage, requireDatabase } from '../db.js';
import { AuthenticatedRequest, requireApprovedUser } from '../auth.js';
import { getVapidPublicKey } from '../webPush.js';

const router = Router();
router.use(requireDatabase, requireApprovedUser);

const ALLOWED_PUSH_HOSTS = [
  'fcm.googleapis.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
];

function isAllowedPushEndpoint(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try {
    const endpoint = new URL(value);
    return endpoint.protocol === 'https:'
      && !endpoint.username
      && !endpoint.password
      && (!endpoint.port || endpoint.port === '443')
      && (ALLOWED_PUSH_HOSTS.includes(endpoint.hostname)
        || endpoint.hostname.endsWith('.notify.windows.com'));
  } catch {
    return false;
  }
}

router.get('/vapid-public-key', (_req: AuthenticatedRequest, res: Response): void => {
  try {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ publicKey: getVapidPublicKey() });
  } catch (error) {
    console.error('Web Push VAPID configuration is unavailable:', error);
    res.status(503).json({ error: 'Push notifications are temporarily unavailable.' });
  }
});

router.post('/subscribe', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const subscription = req.body?.subscription;
  if (!subscription || !isAllowedPushEndpoint(subscription.endpoint)
    || typeof subscription.keys?.p256dh !== 'string'
    || !/^[A-Za-z0-9_-]{32,256}={0,2}$/.test(subscription.keys.p256dh)
    || typeof subscription.keys?.auth !== 'string'
    || !/^[A-Za-z0-9_-]{16,256}={0,2}$/.test(subscription.keys.auth)
    || (subscription.expirationTime !== null && subscription.expirationTime !== undefined
      && (!Number.isFinite(subscription.expirationTime) || subscription.expirationTime < 0))) {
    res.status(400).json({ error: 'A valid browser push subscription is required.' });
    return;
  }

  try {
    getVapidPublicKey();
    const member = await User.findOne({ id: req.user!.id }).select('role isAdmin').lean<any>();
    if (!member || member.role === 'admin' || member.isAdmin === true) {
      res.status(403).json({ error: 'Push notifications are available to member accounts only.' });
      return;
    }
    const storedSubscription = {
      endpoint: subscription.endpoint,
      expirationTime: subscription.expirationTime ?? null,
      keys: {
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
      },
    };
    await User.updateMany(
      { id: { $ne: req.user!.id } },
      { $pull: { pushSubscriptions: { endpoint: storedSubscription.endpoint } } },
    );
    await User.updateOne(
      { id: req.user!.id },
      { $pull: { pushSubscriptions: { endpoint: storedSubscription.endpoint } } },
    );
    await User.updateOne(
      { id: req.user!.id },
      { $push: { pushSubscriptions: { $each: [storedSubscription], $slice: -10 } } },
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Push subscription save failed:', error);
    res.status(500).json({ error: errorMessage(error, 'Unable to save push subscription.') });
  }
});

router.delete('/subscribe', async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  const endpoint = req.body?.endpoint;
  if (!isAllowedPushEndpoint(endpoint)) {
    res.status(400).json({ error: 'A valid browser push endpoint is required.' });
    return;
  }
  try {
    await User.updateOne(
      { id: req.user!.id },
      { $pull: { pushSubscriptions: { endpoint } } },
    );
    res.json({ success: true });
  } catch (error) {
    console.error('Push subscription removal failed:', error);
    res.status(500).json({ error: errorMessage(error, 'Unable to remove push subscription.') });
  }
});

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
