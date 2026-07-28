'use strict';
/* ============================================================
   AUTOPOST IA — embed via iframe (lazy load)
   O tema claro + a ponte de configuração agora vivem DENTRO de
   autopost-ia.html (baked), para funcionar também em file:// (onde o
   navegador bloqueia o app pai de "injetar" CSS/JS no iframe).
   Aqui só carregamos, mandamos a config (postMessage) e revelamos o iframe.
   ============================================================ */
function renderAutopost() {
  mountToolFrame('#autopostFrame', 'autopost-ia.html', 'AutoPost IA');
}
