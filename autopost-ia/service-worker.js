/* AutoPost IA — service worker (PWA).
   Estratégia: cache-first para os arquivos do app (carrega instantâneo e
   funciona offline na interface); as chamadas de API (Groq) NUNCA são
   interceptadas — vão sempre à rede. Suba a versão ao publicar mudanças. */
const CACHE = 'autopost-v7';
const URLS = [
  './',
  './index.html',
  './css/app.css',
  './js/vendor/lamejs.js',
  './js/core.js',
  './js/bridge.js',
  './js/config.js',
  './js/api.js',
  './js/demux.js',
  './js/audio.js',
  './js/extract.js',
  './js/package.js',
  './js/analysis.js',
  './js/history.js',
  './js/render.js',
  './js/app.js',
  './manifest.webmanifest',
  './icon-192.png',
  './icon-512.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(URLS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  // Só o próprio app (mesma origem). APIs e fontes externas seguem direto à rede.
  if (url.origin !== location.origin) return;
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request, { ignoreSearch: true }).then((hit) => hit || fetch(e.request))
  );
});
