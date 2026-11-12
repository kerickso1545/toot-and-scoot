/* Toot and Scoot service worker — makes the installed game work with no
   internet at all.

   The whole game is ~870 KB of static files with no fetch() calls and no
   backend, so the strategy is the simplest one that works: precache
   everything on install, then serve cache-first forever. Nothing here is
   needed to PLAY on a dev machine — js/main.js only registers this worker
   on https, so `play.py` live-reload is never fighting a cache.

   WHEN YOU ADD OR RENAME A GAME FILE: add it to ASSETS and bump CACHE.
   The version bump is what evicts the old cache on the next load. */

var CACHE = 'toot-and-scoot-v1';

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

  e.respondWith(
    caches.match(req).then(function (hit) {
      if (hit) return hit;
      return fetch(req).then(function (res) {
        // Cache same-origin successes we didn't know about up front (e.g. a
        // file added without bumping ASSETS). Opaque cross-origin responses
        // are left alone — there are none today by design.
        if (res && res.status === 200 && res.type === 'basic') {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(req, copy); });
        }
        return res;
      }).catch(function () {
        // Offline and uncached: a navigation still gets the game shell so
        // the player never sees a browser error page.
        if (req.mode === 'navigate') return caches.match('./toot-and-scoot.html');
        throw new Error('offline and not cached: ' + req.url);
      });
    })
  );
});
