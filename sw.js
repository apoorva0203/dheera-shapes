// Cache every static file on install so the app is fully offline after the
// first load. Bump CACHE_VERSION whenever any of these files change so the
// old cache is discarded on the next visit.
const CACHE_VERSION = 'shapes-v24';
const ASSETS = [
  './',
  './index.html',
  './stats.html',
  './style.css',
  './stats-page.css',
  './app.js',
  './shapes.js',
  './stats.js',
  './stats-page.js',
  './interact.min.js',
  './manifest.json',
  './icon.svg',
  './emoji/apple.svg',
  './emoji/avocado.svg',
  './emoji/banana.svg',
  './emoji/bear.svg',
  './emoji/broccoli.svg',
  './emoji/butterfly.svg',
  './emoji/carrot.svg',
  './emoji/cat.svg',
  './emoji/cherries.svg',
  './emoji/corn.svg',
  './emoji/cow.svg',
  './emoji/cucumber.svg',
  './emoji/dog.svg',
  './emoji/eggplant.svg',
  './emoji/elephant.svg',
  './emoji/fish.svg',
  './emoji/fox.svg',
  './emoji/frog.svg',
  './emoji/grapes.svg',
  './emoji/horse.svg',
  './emoji/lion.svg',
  './emoji/monkey.svg',
  './emoji/mushroom.svg',
  './emoji/orange.svg',
  './emoji/owl.svg',
  './emoji/panda.svg',
  './emoji/peach.svg',
  './emoji/pear.svg',
  './emoji/penguin.svg',
  './emoji/pig.svg',
  './emoji/pineapple.svg',
  './emoji/potato.svg',
  './emoji/rabbit.svg',
  './emoji/strawberry.svg',
  './emoji/tiger.svg',
  './emoji/tomato.svg',
  './emoji/turtle.svg',
  './emoji/watermelon.svg',
  './emoji/whale.svg',
  "./audio/apple.m4a",
  "./audio/arrow.m4a",
  "./audio/avocado.m4a",
  "./audio/banana.m4a",
  "./audio/bear.m4a",
  "./audio/broccoli.m4a",
  "./audio/butterfly.m4a",
  "./audio/carrot.m4a",
  "./audio/cat.m4a",
  "./audio/cherries.m4a",
  "./audio/chevron.m4a",
  "./audio/circle.m4a",
  "./audio/cloud.m4a",
  "./audio/corn.m4a",
  "./audio/cow.m4a",
  "./audio/cross.m4a",
  "./audio/cucumber.m4a",
  "./audio/diamond.m4a",
  "./audio/dog.m4a",
  "./audio/eggplant.m4a",
  "./audio/elephant.m4a",
  "./audio/fish.m4a",
  "./audio/flower.m4a",
  "./audio/fox.m4a",
  "./audio/frog.m4a",
  "./audio/grapes.m4a",
  "./audio/half-circle.m4a",
  "./audio/heart.m4a",
  "./audio/hexagon.m4a",
  "./audio/horse.m4a",
  "./audio/kite.m4a",
  "./audio/lightning.m4a",
  "./audio/lion.m4a",
  "./audio/monkey.m4a",
  "./audio/moon.m4a",
  "./audio/mushroom.m4a",
  "./audio/orange.m4a",
  "./audio/oval.m4a",
  "./audio/owl.m4a",
  "./audio/panda.m4a",
  "./audio/parallelogram.m4a",
  "./audio/peach.m4a",
  "./audio/pear.m4a",
  "./audio/penguin.m4a",
  "./audio/pentagon.m4a",
  "./audio/pig.m4a",
  "./audio/pineapple.m4a",
  "./audio/plus.m4a",
  "./audio/potato.m4a",
  "./audio/rabbit.m4a",
  "./audio/ring.m4a",
  "./audio/square.m4a",
  "./audio/star.m4a",
  "./audio/strawberry.m4a",
  "./audio/sun.m4a",
  "./audio/tiger.m4a",
  "./audio/tomato.m4a",
  "./audio/trapezoid.m4a",
  "./audio/triangle.m4a",
  "./audio/turtle.m4a",
  "./audio/watermelon.m4a",
  "./audio/well-done.m4a",
  "./audio/whale.m4a",
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
