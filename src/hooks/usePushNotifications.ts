import { useCallback, useEffect, useState } from 'react';
import { getAuthHeaders } from '../utils/api';

interface PushState {
  supported: boolean;
  configured: boolean | null;
  enabled: boolean;
  permission: NotificationPermission | 'unsupported';
  busy: boolean;
  error: string;
}

function decodeVapidKey(encodedKey: string): ArrayBuffer {
  const padding = '='.repeat((4 - encodedKey.length % 4) % 4);
  const base64 = (encodedKey + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(base64);
  const bytes = Uint8Array.from(raw, (character) => character.charCodeAt(0));
  return bytes.buffer;
}

export function usePushNotifications(userId: string) {
  const supported = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && ('serviceWorker' in navigator && 'PushManager' in window)
    && 'Notification' in window;
  const [state, setState] = useState<PushState>({
    supported,
    configured: null,
    enabled: false,
    permission: supported ? Notification.permission : 'unsupported',
    busy: false,
    error: '',
  });

  const persistSubscription = useCallback(async (subscription: PushSubscription) => {
    const response = await fetch('/api/notifications/subscribe', {
      method: 'POST',
      headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
      credentials: 'include',
      body: JSON.stringify({ subscription: subscription.toJSON() }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Unable to save push notification settings.');
  }, []);

  useEffect(() => {
    if (!supported || !userId) return;
    let cancelled = false;
    setState((current) => ({ ...current, busy: true, error: '' }));
    const initialize = async () => {
      try {
        const keyResponse = await fetch('/api/notifications/vapid-public-key', {
          headers: getAuthHeaders(),
          credentials: 'include',
        });
        const keyData = await keyResponse.json();
        if (!keyResponse.ok || typeof keyData.publicKey !== 'string' || !keyData.publicKey.trim()) {
          if (!cancelled) {
            setState((current) => ({
              ...current,
              configured: false,
              enabled: false,
              error: '',
            }));
          }
          return;
        }
        if (!cancelled) setState((current) => ({ ...current, configured: true }));

        const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
        const subscription = await registration.pushManager.getSubscription();
        if (!cancelled && subscription && Notification.permission === 'granted') {
          await persistSubscription(subscription);
          if (!cancelled) setState((current) => ({ ...current, enabled: true, permission: Notification.permission }));
        }
      } catch (error) {
        if (!cancelled) {
          console.error('Unable to initialize browser push notifications:', error);
          setState((current) => ({
            ...current,
            error: 'Push alerts are unavailable in this browser session. You can continue using your account without them.',
          }));
        }
      } finally {
        if (!cancelled) setState((current) => ({ ...current, busy: false }));
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, [persistSubscription, supported, userId]);

  const togglePush = useCallback(async () => {
    if (!supported || !userId || state.configured !== true) return;
    setState((current) => ({ ...current, busy: true, error: '' }));
    try {
      const registration = await navigator.serviceWorker.ready;
      const existingSubscription = await registration.pushManager.getSubscription();
      if (existingSubscription) {
        const response = await fetch('/api/notifications/subscribe', {
          method: 'DELETE',
          headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
          credentials: 'include',
          body: JSON.stringify({ endpoint: existingSubscription.endpoint }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Unable to turn off push alerts.');
        await existingSubscription.unsubscribe();
        setState((current) => ({ ...current, enabled: false, permission: Notification.permission }));
        return;
      }

      const keyResponse = await fetch('/api/notifications/vapid-public-key', {
        headers: getAuthHeaders(),
        credentials: 'include',
      });
      const keyData = await keyResponse.json();
      if (!keyResponse.ok || typeof keyData.publicKey !== 'string' || !keyData.publicKey.trim()) {
        setState((current) => ({ ...current, configured: false, enabled: false, error: '' }));
        return;
      }

      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        setState((current) => ({
          ...current,
          permission,
          error: permission === 'denied'
            ? 'Notifications are blocked in your browser settings. Allow them there to enable push alerts.'
            : 'Notification permission was not granted.',
        }));
        return;
      }

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: decodeVapidKey(keyData.publicKey),
      });
      await persistSubscription(subscription);
      setState((current) => ({ ...current, enabled: true, permission, error: '' }));
    } catch (error) {
      console.error('Unable to update push notification subscription:', error);
      setState((current) => ({
        ...current,
        error: error instanceof Error ? error.message : 'Unable to update push notification settings.',
      }));
    } finally {
      setState((current) => ({ ...current, busy: false }));
    }
  }, [persistSubscription, state.configured, supported, userId]);

  return { ...state, togglePush };
}
