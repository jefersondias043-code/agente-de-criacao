'use strict';
/* ============================================================
   REPLICADOR — embed via iframe (lazy load)
   App externo maduro incorporado como ferramenta nativa. O tema claro da
   plataforma + as pontes (config/conteúdo/saída/ingest) vivem DENTRO de
   replicador.html (baked), para funcionar também em file:// (onde o navegador
   bloqueia o app pai de "injetar" CSS/JS no iframe).
   Aqui só carregamos, mandamos a config (postMessage), entregamos conteúdo
   pendente e revelamos o iframe. (Molde: src/autopost.js)
   ============================================================ */
function renderReplicador() {
  mountToolFrame('#replicadorFrame', 'replicador.html', 'Replicador');
}
