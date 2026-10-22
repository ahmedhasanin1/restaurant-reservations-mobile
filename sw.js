const CACHE_NAME = 'romantic-v5';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/romantic-192.png', './icons/romantic-512.png'];

// Firebase Messaging uses the same service worker that already supports the PWA.
// If Firebase settings are missing, the ordinary reservation app/service worker still installs.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.12.4/firebase-messaging-compat.js');
  importScripts('./firebase-config.js?v=1');
  const cfg = self.ROMANTIC_FIREBASE_CONFIG;
  const requiredKeys = ['apiKey', 'authDomain', 'projectId', 'messagingSenderId', 'appId', 'vapidKey'];
  const validConfig = cfg && requiredKeys.every(k => cfg[k] && String(cfg[k]).indexOf('PASTE_') < 0);
  if (validConfig && typeof firebase !== 'undefined') {
    if (!firebase.apps.length) firebase.initializeApp(cfg);
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage(payload => {
      const n = payload && payload.notification ? payload.notification : {};
      const d = payload && payload.data ? payload.data : {};
      const title = n.title || d.title || 'Romantic — إشعار حجز';
      const options = {
        body: n.body || d.body || 'يوجد تحديث على حجوزات المطعم.',
        icon: './icons/romantic-192.png',
        badge: './icons/romantic-192.png',
        data: { url: d.url || './' },
        tag: d.reservationId ? 'romantic-' + d.reservationId : 'romantic-notification'
      };
      return self.registration.showNotification(title, options);
    });
  }
} catch (error) {
  // Missing/unavailable Firebase configuration should never break the booking PWA.
  console.warn('Romantic Firebase push is not initialized:', error);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k.startsWith('romantic-') && k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname.endsWith('/config.js') || url.pathname.endsWith('/firebase-config.js') || url.pathname.endsWith('/index.html') || event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => {
      if (response && response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, copy)); }
      return response;
    }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => {
    if (response && response.ok) { const copy = response.clone(); caches.open(CACHE_NAME).then(c => c.put(event.request, copy)); }
    return response;
  })));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || self.registration.scope, self.registration.scope).href;
  event.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clientList => {
    for (const client of clientList) {
      if (client.url.startsWith(self.location.origin) && 'focus' in client) {
        if ('navigate' in client && client.url !== target) client.navigate(target);
        return client.focus();
      }
    }
    return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
  }));
});
