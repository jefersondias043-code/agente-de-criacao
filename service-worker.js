const CACHE = 'agp-v207';
const URLS = [
  './',
  './index.html',
  './styles.css',
  './design-system.css',
  './detector-flop.html',
  './detector-flop.tailwind.css',
  './detector-remixicon.css',
  './detector-remixicon.woff2',
  './autopost-ia.html',
  './replicador.html',
  './removedor.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-maskable-192.png',
  './icon-maskable-512.png',
  './vendor/lamejs.js',
  // scripts:start — gerado de scripts/scripts.manifest.mjs (npm run sync:manifest)
  './src/catalogs.js',
  './src/core.js',
  './src/clear-field.js',
  './src/crypto.js',
  './src/storage.js',
  './src/apikey-sync.js',
  './src/lock.js',
  './src/llm.js',
  './src/agents.js',
  './src/generate.js',
  './src/narrativa.js',
  './src/extract.js',
  './src/posters.js',
  './src/poster-templates.js',
  './src/carousels.js',
  './src/poster-elements.js',
  './src/poster-typeset.js',
  './src/poster-editor-pro.js',
  './src/history.js',
  './src/settings.js',
  './src/detector.js',
  './src/autopost.js',
  './src/replicador.js',
  './src/removedor.js',
  './src/handoff.js',
  './src/media-transcode.js',
  './src/ingest.js',
  './src/app.js',
  // scripts:end
];

self.addEventListener('install', (e) => {
  // RESILIENTE: cacheia cada URL individualmente (allSettled). Antes usávamos
  // addAll(), que rejeita se UM único arquivo falhar (ex.: um asset novo que o
  // Pages ainda não publicou, ou uma rede instável) — e aí a instalação inteira
  // falhava, o SW novo NÃO ativava e o usuário ficava preso na versão antiga.
  // Agora um asset ausente não impede a atualização: o essencial é cacheado e o
  // resto o network-first busca sob demanda.
  e.waitUntil(
    caches.open(CACHE)
      .then((c) => Promise.allSettled(URLS.map((u) => c.add(u))))
      .then(() => self.skipWaiting())
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
//
// EXCEÇÃO cache-first para /vendor/ e /models/: são binários GRANDES e IMUTÁVEIS
// (o motor de IA ~11 MB e o modelo de recorte ~4,6 MB do Removedor de Fundo).
// Com network-first eles seriam rebaixados a cada abertura — o que quebraria a
// promessa de "baixa uma vez e fica salvo". Servimos do cache quando presentes;
// senão busca na rede e guarda. Para atualizá-los, sobe a versão do CACHE (o
// activate limpa os caches antigos).
function isImmutableAsset(url) {
  const p = new URL(url).pathname;
  return p.indexOf('/vendor/') !== -1 || p.indexOf('/models/') !== -1;
}
self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const sameOrigin = new URL(req.url).origin === self.location.origin;
  if (sameOrigin && isImmutableAsset(req.url)) {
    // cache-first (imutável): evita rebaixar megabytes a cada uso
    e.respondWith(
      caches.match(req).then((cached) => cached || fetch(req).then((res) => {
        if (res && res.status === 200) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(req, clone));
        }
        return res;
      }))
    );
  } else if (sameOrigin) {
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
