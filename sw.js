const CACHE_NAME = 'civichelp-v8';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './src/css/base.css',
  './src/css/components.css',
  './src/css/layout.css',
  './src/js/config.js',
  './src/js/data.js',
  './src/js/api.js',
  './src/js/core.js',
  './src/js/main.js',
  './src/js/mock/mock-data.js',
  './src/js/views/home.js',
  './src/js/views/map.js',
  './src/js/views/updates.js',
  './src/js/views/help.js',
  './src/js/views/more.js',
  './assets/icon.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;
  const url = new URL(event.request.url);
  const isSameOrigin = url.origin === self.location.origin;
  const isAppAsset = /\/src\//.test(url.pathname) || /\/css\//.test(url.pathname) || url.pathname.endsWith('/index.html') || url.pathname.endsWith('/');
  if (!isSameOrigin) return;
  if (url.pathname.startsWith('/api/')) {
    event.respondWith(fetch(event.request));
    return;
  }

  if (isAppAsset) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
          }
          return response;
        })
        .catch(() => caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || caches.match('./index.html')))
    );
    return;
  }

  event.respondWith(
    caches.match(event.request, { ignoreSearch: true }).then((cached) => cached || fetch(event.request))
  );
});
