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
  const f = $('#replicadorFrame');
  if (!f) return;
  if (!f.dataset.loaded) {
    f.addEventListener('load', () => {
      f.dataset.ready = '1';
      if (typeof injectConfigInto === 'function') injectConfigInto(f);
      if (typeof deliverPendingContent === 'function') deliverPendingContent();
      requestAnimationFrame(() => f.classList.add('themed'));
    });
    f.src = (typeof toolFrameSrc === 'function') ? toolFrameSrc('replicador.html') : 'replicador.html';
    f.dataset.loaded = '1';
  }
}
