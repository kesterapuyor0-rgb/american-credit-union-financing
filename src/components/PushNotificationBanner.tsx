import React from 'react';
import { Bell, BellOff } from 'lucide-react';
import { usePushNotifications } from '../hooks/usePushNotifications';

interface PushNotificationBannerProps {
  userId: string;
}

export const PushNotificationBanner: React.FC<PushNotificationBannerProps> = ({ userId }) => {
  const { supported, configured, enabled, permission, busy, error, togglePush } = usePushNotifications(userId);
  const browserSupportsPush = typeof window !== 'undefined'
    && typeof navigator !== 'undefined'
    && ('serviceWorker' in navigator && 'PushManager' in window);
  if (!browserSupportsPush || !supported || configured !== true) return null;

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-teal-100 bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-teal-50 text-teal-800">
          {enabled ? <Bell aria-hidden="true" className="h-5 w-5" /> : <BellOff aria-hidden="true" className="h-5 w-5" />}
        </span>
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-slate-900">
            {enabled ? 'Mobile account alerts are on' : 'Get mobile account alerts'}
          </h2>
          <p className="mt-1 text-xs leading-5 text-slate-600">
            Receive an alert when a credit posts, a grant is disbursed, or your deposit wallets change. Sound and vibration depend on your device settings.
          </p>
          {permission === 'denied' && !enabled && (
            <p className="mt-1 text-xs text-amber-800">Notifications are blocked by your browser. Change its site notification settings to enable alerts.</p>
          )}
          {error && <p role="alert" className="mt-1 text-xs text-rose-700">{error}</p>}
        </div>
      </div>
      <button
        type="button"
        onClick={() => void togglePush()}
        disabled={busy || (permission === 'denied' && !enabled)}
        className="min-h-10 shrink-0 rounded-lg bg-teal-800 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-900 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? 'Updating…' : enabled ? 'Turn off alerts' : 'Enable push alerts'}
      </button>
    </section>
  );
};
