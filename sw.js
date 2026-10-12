const CACHE = 'mot-a-mot-v3';
const ASSETS = ['./', './index.html', './styles.css?v=2', './app.js?v=2', './manifest.webmanifest', './icon.svg'];
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(ASSETS)));
});
self.addEventListener('activate', (event) => event.waitUntil(
  caches.keys()
    .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
    .then(() => self.clients.claim())
));
self.addEventListener('fetch', (event) => event.respondWith(caches.match(event.request).then((cached) => cached || fetch(event.request))));
