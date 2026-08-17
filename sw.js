const CACHE = 'finance-v3';
const APP_SHELL = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png'];

self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(APP_SHELL)));
});

self.addEventListener('activate', event => {
  event.waitUntil(Promise.all([
    clients.claim(),
    caches.keys().then(keys => Promise.all(
      keys.filter(key => key.startsWith('finance-') && key !== CACHE).map(key => caches.delete(key))
    ))
  ]));
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  event.respondWith((async () => {
    const cached = await caches.match(event.request);
    if (cached) {
      fetch(event.request).then(response => {
        if (response.ok && response.type === 'basic') {
          const clone = response.clone();
          caches.open(CACHE).then(cache => cache.put(event.request, clone)).catch(() => {});
        }
      }).catch(() => {});
      return cached;
    }
    try {
      const response = await fetch(event.request);
      if (response.ok && response.type === 'basic') {
        const clone = response.clone();
        caches.open(CACHE).then(cache => cache.put(event.request, clone)).catch(() => {});
      }
      return response;
    } catch (error) {
      if (event.request.mode === 'navigate') {
        const shell = await caches.match('./index.html');
        if (shell) return shell;
      }
      return new Response('', { status: 503, statusText: 'Offline' });
    }
  })());
});
