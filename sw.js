const CACHE_NAME = 'romantic-v4';
const APP_SHELL = ['./', './index.html', './manifest.webmanifest', './icons/romantic-192.png', './icons/romantic-512.png'];
self.addEventListener('install', event => { event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)).then(() => self.skipWaiting())); });
self.addEventListener('activate', event => { event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))).then(() => self.clients.claim())); });
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET') return;
  if (url.pathname.endsWith('/config.js') || url.pathname.endsWith('/index.html') || event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request, { cache: 'no-store' }).then(response => { if (response && response.ok) { const copy=response.clone(); caches.open(CACHE_NAME).then(c=>c.put(event.request, copy)); } return response; }).catch(() => caches.match(event.request).then(cached => cached || caches.match('./index.html'))));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached => cached || fetch(event.request).then(response => { if (response && response.ok) { const copy=response.clone(); caches.open(CACHE_NAME).then(c=>c.put(event.request, copy)); } return response; })));
});
