import { randomUUID } from 'crypto';
import { ClientSession } from 'mongoose';
import { Notification } from './models.js';

export type NotificationLink = 'home' | 'transfer' | 'grants' | 'history' | 'security';

interface CreateNotificationInput {
  userId: string;
  title: string;
  message: string;
  type: string;
  category: string;
  link: NotificationLink;
}

export async function createNotification(
  input: CreateNotificationInput,
  session?: ClientSession,
): Promise<void> {
  const notification = {
    id: `notification_${randomUUID()}`,
    ...input,
    isRead: false,
    createdAt: new Date(),
  };
  if (session) {
    await Notification.create([notification], { session });
    return;
  }
  await Notification.create(notification);
}
