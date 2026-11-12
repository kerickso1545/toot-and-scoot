/* Toot and Scoot service worker — makes the installed game work with no
   internet at all.

   The whole game is ~1 MB of static files with no fetch() calls and no
   backend, so everything is precached on install. Nothing here is needed to
   PLAY on a dev machine — js/main.js only registers this worker on https, so
   `play.py` live-reload is never fighting a cache.

   STRATEGY: network-first for same-origin GETs, falling back to the cache.
   It started out cache-first, which was wrong for a game under active
   development: the Shield would have pinned the first build it ever saw and
   no deploy would have reached it again (the browser only re-checks sw.js
   itself, not the files it cached). Network-first costs a round trip when
   online and still plays fully offline, which is the right trade while Otto
   and Kevin are iterating. Revisit if cold start on the TV feels slow.

   WHEN YOU ADD OR RENAME A GAME FILE: add it to ASSETS and bump CACHE. */

var CACHE = 'toot-and-scoot-v2';

var ASSETS = [
  './',
  './index.html',
  './toot-and-scoot.html',
  './manifest.webmanifest',
  './css/style.css',
  './vendor/three.r128.min.js',
  './js/constants.js',
  './js/theme.js',
  './js/audio.js',
  './js/meshes.js',
  './js/world.js',
  './js/fx.js',
  './js/input.js',
  './js/ui.js',
  './js/help.js',
  './js/main.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png'
];

self.addEventListener('install', function (e) {
  e.waitUntil(
    caches.open(CACHE).then(function (c) {
      // addAll is atomic: one bad URL throws away the whole install, which
      // is what we want — a half-cached game that fails offline is worse
      // than no offline at all.
      return c.addAll(ASSETS);
    }).then(function () {
      return self.skipWaiting();
    })
  );
});

self.addEventListener('activate', function (e) {
  e.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.map(function (k) {
        return k === CACHE ? null : caches.delete(k);
      }));
    }).then(function () {
      return self.clients.claim();
    })
  );
});

self.addEventListener('fetch', function (e) {
  var req = e.request;
  if (req.method !== 'GET') return;

  // Network-first: always prefer a fresh copy, fall back to the cache when
  // the network is gone (or slow to fail). Every success refreshes the cache,
  // so the offline copy tracks the latest build the device has seen.
  e.respondWith(
    fetch(req).then(function (res) {
      if (res && res.status === 200 && res.type === 'basic') {
        var copy = res.clone();
        caches.open(CACHE).then(function (c) { c.put(req, copy); });
      }
      return res;
    }).catch(function () {
      return caches.match(req).then(function (hit) {
        if (hit) return hit;
        // Offline and uncached: a navigation still gets the game shell so the
        // player never sees a browser error page.
        if (req.mode === 'navigate') return caches.match('./toot-and-scoot.html');
        throw new Error('offline and not cached: ' + req.url);
      });
    })
  );
});
