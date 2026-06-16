const CACHE = 'finance-v2';

self.addEventListener('install', e => {
  console.log('[SW] install');
  self.skipWaiting();
  e.waitUntil(
    caches.open(CACHE).then(cache => {
      return cache.addAll(['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png']).catch(err => {
        console.log('[SW] cache addAll failed:', err);
      });
    })
  );
});

self.addEventListener('activate', e => {
  console.log('[SW] activate');
  e.waitUntil(
    Promise.all([
      clients.claim(),
      caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
    ])
  );
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(cached => {
      const fetched = fetch(e.request).then(res => {
        if (res.ok && res.type === 'basic') {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      });
      return cached || fetched;
    })
  );
});
