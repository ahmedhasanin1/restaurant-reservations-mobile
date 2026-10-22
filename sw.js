/* Romantic PWA shell + Firebase Cloud Messaging background notifications. */
const CACHE_NAME = 'romantic-shell-v4';
const APP_SHELL = [
  './',
  './index.html',
  './config.js',
  './firebase-config.js',
  './manifest.webmanifest',
  './icons/romantic-192.png',
  './icons/romantic-512.png'
];

// A missing/unconfigured Firebase config must not prevent the core PWA worker from installing.
try {
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-app-compat.js');
  importScripts('https://www.gstatic.com/firebasejs/10.13.2/firebase-messaging-compat.js');
  importScripts('./firebase-config.js');
  const cfg = self.ROMANTIC_FIREBASE_CONFIG || {};
  const ready = cfg.apiKey && cfg.projectId && cfg.messagingSenderId && cfg.appId &&
    !String(cfg.apiKey).includes('PASTE_') && !String(cfg.projectId).includes('YOUR_');
  if (ready && self.firebase && firebase.messaging) {
    firebase.initializeApp({
      apiKey: cfg.apiKey,
      authDomain: cfg.authDomain,
      projectId: cfg.projectId,
      messagingSenderId: cfg.messagingSenderId,
      appId: cfg.appId,
      storageBucket: cfg.storageBucket || undefined
    });
    const messaging = firebase.messaging();
    messaging.onBackgroundMessage(function(payload) {
      const d = (payload && payload.data) || {};
      const title = d.title || 'Romantic';
      const options = {
        body: d.body || 'لديك تحديث جديد في حجوزات Romantic.',
        icon: './icons/romantic-192.png',
        badge: './icons/romantic-192.png',
        tag: d.eventId || ('romantic-' + Date.now()),
        renotify: false,
        data: { url: d.url || './', reservationId: d.reservationId || '', type: d.type || '' }
      };
      return self.registration.showNotification(title, options);
    });
  }
} catch (err) {
  // Keep the app shell working if FCM is not configured yet or its SDK is temporarily unavailable.
  console.warn('Romantic FCM worker initialization skipped:', err);
}

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key !== CACHE_NAME && (key.startsWith('romantic-shell-') || key.startsWith('restaurant-reservations-shell-'))).map(key => caches.delete(key)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const request = event.request;
  const url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== self.location.origin) return;
  event.respondWith(fetch(request).then(response => {
    if (response && response.ok) {
      const copy = response.clone();
      caches.open(CACHE_NAME).then(cache => cache.put(request, copy)).catch(() => {});
    }
    return response;
  }).catch(async () => {
    const cached = await caches.match(request);
    if (cached) return cached;
    return new Response('يتطلب نظام Romantic اتصالًا بالإنترنت. أعد الاتصال ثم حدّث الصفحة.', {status:503,headers:{'Content-Type':'text/plain; charset=utf-8'}});
  }));
});

self.addEventListener('notificationclick', event => {
  event.notification.close();
  const rawUrl = event.notification && event.notification.data && event.notification.data.url;
  const targetUrl = rawUrl || self.registration.scope;
  event.waitUntil(self.clients.matchAll({type:'window', includeUncontrolled:true}).then(clientList => {
    for (const client of clientList) {
      if (client.url && client.url.startsWith(self.registration.scope) && 'focus' in client) {
        if ('navigate' in client) client.navigate(targetUrl);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(targetUrl);
  }));
});
