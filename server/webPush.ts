import webpush, { PushSubscription } from 'web-push';
import { User } from './models.js';

export interface PushNotificationPayload {
  title: string;
  body: string;
  url?: string;
}

interface StoredPushSubscription {
  endpoint: string;
  expirationTime?: number | null;
  keys: { p256dh: string; auth: string };
}

let configuredVapidFingerprint = '';

function getVapidConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const subject = process.env.VAPID_SUBJECT?.trim();
  if (!publicKey || !privateKey || !subject) {
    throw new Error('VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, and VAPID_SUBJECT must be configured to enable Web Push.');
  }
  if (!subject.startsWith('mailto:') && !subject.startsWith('https://')) {
    throw new Error('VAPID_SUBJECT must be a mailto: or https: URI.');
  }
  return { publicKey, privateKey, subject };
}

function configureWebPush(): string {
  const { publicKey, privateKey, subject } = getVapidConfig();
  const fingerprint = `${publicKey}:${privateKey}:${subject}`;
  if (configuredVapidFingerprint !== fingerprint) {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    configuredVapidFingerprint = fingerprint;
  }
  return publicKey;
}

export function getVapidPublicKey(): string {
  return configureWebPush();
}

export async function sendPushNotification(
  userId: string,
  payload: PushNotificationPayload,
): Promise<void> {
  try {
    const user = await User.findOne({ id: userId }).select('+pushSubscriptions').lean<any>();
    const subscriptions: StoredPushSubscription[] = user?.pushSubscriptions || [];
    if (!subscriptions.length) return;
    configureWebPush();

    const message = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || '/history',
    });

    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await webpush.sendNotification(subscription as PushSubscription, message, {
          TTL: 60,
          urgency: 'high',
          timeout: 5000,
        });
      } catch (error) {
        const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
          ? Number(error.statusCode)
          : 0;
        if (statusCode === 404 || statusCode === 410) {
          try {
            await User.updateOne(
              { id: userId },
              { $pull: { pushSubscriptions: { endpoint: subscription.endpoint } } },
            );
          } catch (cleanupError) {
            console.error('Unable to remove expired Web Push subscription:', cleanupError);
          }
          return;
        }
        console.error('Web Push delivery failed:', {
          userId,
          statusCode: statusCode || undefined,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }));
  } catch (error) {
    console.error('Unable to send Web Push notification:', error);
  }
}
