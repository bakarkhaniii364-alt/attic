const CACHE = 'attic-mobile-v1';

const PRECACHE = [
  '/m/',
  '/m/index.html',
  '/m/app.js',
  '/m/mobile.css',
  '/js/auth.js',
  '/js/api.js',
  '/js/socket.js',
  '/js/utils.js'
];

self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE).then(c => c.addAll(PRECACHE))
  );
  self.skipWaiting();
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);

  // Never intercept API or socket calls
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/socket') || url.hostname.includes('supabase')) return;

  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;
      return fetch(e.request).then(res => {
        // Cache successful GET responses for app shell assets
        if (e.request.method === 'GET' && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then(c => c.put(e.request, clone));
        }
        return res;
      }).catch(() => caches.match('/m/offline.html'));
    })
  );
});
