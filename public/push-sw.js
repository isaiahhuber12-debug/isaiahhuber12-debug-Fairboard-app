/* global self */

self.addEventListener('push', (event) => {
  if (!event.data) return;

  let payload;
  try {
    payload = event.data.json();
  } catch {
    payload = { title: 'RallyHub Announcement', body: event.data.text() };
  }

  const title =
    typeof payload.title === 'string' && payload.title.trim()
      ? payload.title.trim()
      : 'RallyHub Announcement';
  const body = typeof payload.body === 'string' ? payload.body : '';
  const tag = typeof payload.tag === 'string' && payload.tag ? payload.tag : undefined;
  const url = typeof payload.url === 'string' && payload.url ? payload.url : '/?tab=alerts';

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag,
      renotify: Boolean(tag),
      vibrate: [180, 80, 180],
      data: {
        url,
        groupId: payload.groupId || null,
        notificationId: payload.notificationId || null,
      },
    })
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const notifData = event.notification.data || {};
  const targetUrl =
    typeof notifData.url === 'string' && notifData.url ? notifData.url : '/?tab=alerts';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          client.postMessage({
            type: 'RALLYHUB_NOTIFICATION_CLICK',
            groupId: notifData.groupId || null,
            notificationId: notifData.notificationId || null,
          });
          return;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
