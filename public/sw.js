/* global self, clients */

self.addEventListener('push', (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = { body: event.data?.text() || 'There is an update to your account.' };
  }

  const title = typeof payload.title === 'string' ? payload.title : 'Account update';
  const body = typeof payload.body === 'string' ? payload.body : 'There is an update to your account.';
  const url = typeof payload.url === 'string' ? payload.url : '/history';

  event.waitUntil(self.registration.showNotification(title, {
    body,
    icon: '/img/acu1.jpeg',
    badge: '/img/acu1.jpeg',
    tag: 'account-update',
    renotify: true,
    requireInteraction: true,
    silent: false,
    vibrate: [300, 100, 300, 100, 300],
    data: { url },
    actions: [{ action: 'open-history', title: 'View account history' }],
  }));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil((async () => {
    let targetUrl = new URL('/history', self.location.origin);
    try {
      const requestedUrl = new URL(event.notification.data?.url || '/history', self.location.origin);
      if (requestedUrl.origin === self.location.origin) targetUrl = requestedUrl;
    } catch {
      // Fall back to same-origin account history for malformed payload links.
    }

    const windows = await clients.matchAll({ type: 'window', includeUncontrolled: true });
    for (const client of windows) {
      if ('focus' in client) {
        await client.navigate(targetUrl.href);
        return client.focus();
      }
    }
    return clients.openWindow(targetUrl.href);
  })());
});
