'use strict';
/* ============================================================
   AUTOPOST IA — embed via iframe (lazy load)
   O tema claro + a ponte de configuração agora vivem DENTRO de
   autopost-ia.html (baked), para funcionar também em file:// (onde o
   navegador bloqueia o app pai de "injetar" CSS/JS no iframe).
   Aqui só carregamos, mandamos a config (postMessage) e revelamos o iframe.
   ============================================================ */
function renderAutopost() {
  const f = $('#autopostFrame');
  if (!f) return;
  if (!f.dataset.loaded) {
    f.addEventListener('load', () => {
      f.dataset.ready = '1';
      if (typeof injectConfigInto === 'function') injectConfigInto(f);
      if (typeof deliverPendingContent === 'function') deliverPendingContent();
      requestAnimationFrame(() => f.classList.add('themed'));
    });
    f.src = 'autopost-ia.html';
    f.dataset.loaded = '1';
  }
}
