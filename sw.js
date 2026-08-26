const CACHE = 'assessment-quiz-v2';
const SHELL = [
  './',
  './index.html',
  './styles.css',
  './script.js',
  './manifest.webmanifest',
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE).then(function (cache) { return cache.addAll(SHELL); })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== CACHE; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (networkResponse) {
        if (networkResponse.ok) {
          networkResponse.clone().arrayBuffer().then(function (body) {
            const response = new Response(body, {
              status: networkResponse.status,
              statusText: networkResponse.statusText,
              headers: networkResponse.headers
            });
            caches.open(CACHE).then(function (cache) { cache.put(event.request, response); });
          });
        }
        return networkResponse;
      }).catch(function () { return cached; });
    })
  );
});
