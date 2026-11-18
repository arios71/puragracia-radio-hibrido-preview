const CACHE_NAME = 'pgr-hybrid-preview-v19';
const APP_BASE = self.registration.scope;
const STATIC_PATHS = [
  './', './index.html', './css/styles.css', './js/radio.js',
  './js/menu.js', './js/nowplaying.js', './js/schedule.js',
  './js/sermones.js', './js/articles.js', './data/articles.json', './manifest.json', './assets/icons/logo-32.png',
  './assets/icons/logo-192.png', './assets/icons/logo-512.png',
  './assets/icons/icon-maskable-512.png', './assets/icons/apple-touch-icon.png',
  './assets/icons/whatsapp.png'
];
const STATIC_ASSETS = STATIC_PATHS.map(path => new URL(path, APP_BASE).href);
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS)));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
  )).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.hostname.includes('streamtheworld.com') ||
      /\.(mp3|aac|m3u8)(?:$|\?)/i.test(url.pathname)) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(fetch(event.request).catch(() => caches.match(new URL('index.html', APP_BASE))));
    return;
  }
  if (url.origin !== self.location.origin || !url.href.startsWith(APP_BASE)) return;
  event.respondWith(caches.match(event.request).then(cached =>
    cached || fetch(event.request).then(response => {
      if (event.request.method === 'GET' && response.ok) {
        const copy = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
      }
      return response;
    })
  ));
});
