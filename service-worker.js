const CACHE_NAME = 'seeker-chronicles-v9';
const APP_SHELL = [
  './',
  './index.html',
  './styles.css',
  './mobile.css',
  './app.js',
  './local-meta.js',
  './sync.js',
  './manifest.webmanifest',
  './assets/fantasy-header.svg',
  './assets/fantasy-card-1.svg',
  './assets/fantasy-card-2.svg',
  './assets/fantasy-card-3.svg',
  './assets/fantasy-card-4.svg'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
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
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
