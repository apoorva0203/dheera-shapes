// Cache every static file on install so the app is fully offline after the
// first load. Bump CACHE_VERSION whenever any of these files change so the
// old cache is discarded on the next visit.
const CACHE_VERSION = 'shapes-v9';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './shapes.js',
  './interact.min.js',
  './manifest.json',
  './icon.svg',
  "./audio/airplane.m4a",
  "./audio/anchor.m4a",
  "./audio/apple.m4a",
  "./audio/arrow.m4a",
  "./audio/baby.m4a",
  "./audio/backpack.m4a",
  "./audio/ball.m4a",
  "./audio/balloon.m4a",
  "./audio/baseball.m4a",
  "./audio/basketball.m4a",
  "./audio/beach.m4a",
  "./audio/bell.m4a",
  "./audio/bike.m4a",
  "./audio/boat.m4a",
  "./audio/book.m4a",
  "./audio/bunny.m4a",
  "./audio/bus.m4a",
  "./audio/cactus.m4a",
  "./audio/cake.m4a",
  "./audio/camera.m4a",
  "./audio/car.m4a",
  "./audio/castle.m4a",
  "./audio/chair.m4a",
  "./audio/chevron.m4a",
  "./audio/circle.m4a",
  "./audio/cloud.m4a",
  "./audio/controller.m4a",
  "./audio/cookie.m4a",
  "./audio/couch.m4a",
  "./audio/cross.m4a",
  "./audio/crown.m4a",
  "./audio/cup.m4a",
  "./audio/diamond.m4a",
  "./audio/dice.m4a",
  "./audio/egg.m4a",
  "./audio/envelope.m4a",
  "./audio/fish.m4a",
  "./audio/flag.m4a",
  "./audio/flower.m4a",
  "./audio/food.m4a",
  "./audio/football.m4a",
  "./audio/forest.m4a",
  "./audio/half-circle.m4a",
  "./audio/headphones.m4a",
  "./audio/heart.m4a",
  "./audio/hexagon.m4a",
  "./audio/hiker.m4a",
  "./audio/house.m4a",
  "./audio/ice-cream.m4a",
  "./audio/key.m4a",
  "./audio/kite.m4a",
  "./audio/leaf.m4a",
  "./audio/light-bulb.m4a",
  "./audio/lightning.m4a",
  "./audio/microphone.m4a",
  "./audio/moon.m4a",
  "./audio/mountain.m4a",
  "./audio/music-note.m4a",
  "./audio/oval.m4a",
  "./audio/palette.m4a",
  "./audio/parallelogram.m4a",
  "./audio/park.m4a",
  "./audio/party.m4a",
  "./audio/paw.m4a",
  "./audio/pencil.m4a",
  "./audio/pentagon.m4a",
  "./audio/piano.m4a",
  "./audio/pizza.m4a",
  "./audio/plant.m4a",
  "./audio/plus.m4a",
  "./audio/pool.m4a",
  "./audio/present.m4a",
  "./audio/ring.m4a",
  "./audio/rocket.m4a",
  "./audio/sailboat.m4a",
  "./audio/school.m4a",
  "./audio/scooter.m4a",
  "./audio/snowflake.m4a",
  "./audio/spa.m4a",
  "./audio/square.m4a",
  "./audio/star.m4a",
  "./audio/suitcase.m4a",
  "./audio/sun.m4a",
  "./audio/teddy-bear.m4a",
  "./audio/tennis.m4a",
  "./audio/trapezoid.m4a",
  "./audio/tree.m4a",
  "./audio/triangle.m4a",
  "./audio/umbrella.m4a",
  "./audio/volleyball.m4a",
  "./audio/watch.m4a",
  "./audio/water-drop.m4a",
  "./audio/watermelon.m4a",
  "./audio/well-done.m4a",
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
