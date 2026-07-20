const CACHE = 'agp-v122';
const URLS = [
  './',
  './index.html',
  './styles.css',
  './detector-flop.html',
  './autopost-ia.html',
  './replicador.html',
  './videograb.html',
  './removedor.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  // scripts:start — gerado de scripts/scripts.manifest.mjs (npm run sync:manifest)
  './src/server-config.js',
  './src/catalogs.js',
  './src/core.js',
  './src/crypto.js',
  './src/storage.js',
  './src/apikey-sync.js',
  './src/lock.js',
  './src/llm.js',
  './src/generate.js',
  './src/extract.js',
  './src/posters.js',
  './src/poster-templates.js',
  './src/carousels.js',
  './src/poster-elements.js',
  './src/poster-editor-pro.js',
  './src/videograb.js',
  './src/history.js',
  './src/settings.js',
  './src/detector.js',
  './src/autopost.js',
  './src/replicador.js',
  './src/removedor.js',
  './src/handoff.js',
  './src/ingest.js',
  './src/app.js',
  // scripts:end
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(URLS)).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((ks) => Promise.all(ks.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()) // assume o controle das abas abertas já nesta ativação
  );
});

// Estratégia NETWORK-FIRST para arquivos do próprio app (mesma origem): online
// sempre busca a versão mais recente (evita rodar código obsoleto do cache) e,
// se a rede falhar (offline), cai para o cache. CDNs externos ficam cache-first
// (bibliotecas versionadas, raramente mudam).
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  if (sameOrigin) {
    e.respondWith(
      fetch(req)
        .then((res) => {
          if (res && res.status === 200) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(req, clone));
          }
          return res;
        })
        .catch(() => caches.match(req))
    );
  } else {
    e.respondWith(caches.match(req).then((cached) => cached || fetch(req)));
  }
});
