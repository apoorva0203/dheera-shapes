// Cache every static file on install so the app is fully offline after the
// first load. Bump CACHE_VERSION whenever any of these files change so the
// old cache is discarded on the next visit.
const CACHE_VERSION = 'shapes-v6';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './shapes.js',
  './interact.min.js',
  './manifest.json',
  './icon.svg',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll(ASSETS)),
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k)),
      ),
    ),
  );
  self.clients.claim();
});

// Cache-first for all same-origin GETs. Falls back to network only if the
// asset was never cached; the game is fully static so this is enough.
self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== location.origin) return;
  event.respondWith(
    caches.match(req).then((hit) => hit || fetch(req).then((resp) => {
      const copy = resp.clone();
      caches.open(CACHE_VERSION).then((cache) => cache.put(req, copy));
      return resp;
    })),
  );
});
