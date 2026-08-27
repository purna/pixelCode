self.addEventListener('install', function (event) {
  event.waitUntil(
      caches.open('assessment-quiz-v2').then(function (cache) {
        return cache.addAll([
          './',
          './index.html',
          './styles.css',
          './js/app.js',
          './js/storage.js',
          './js/helpers.js',
          './js/settings.js',
          './js/learn.js',
          './js/quiz.js',
          './js/results.js',
          './js/progress.js',
          './manifest.webmanifest'
        ]);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(keys.filter(function (k) { return k !== 'assessment-quiz-v2'; }).map(function (k) { return caches.delete(k); }));
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', function (event) {
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).catch(function () { return cached; });
    })
  );
});
