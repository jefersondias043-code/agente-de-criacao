'use strict';
/* ============================================================
   REMOVEDOR DE FUNDO — embed via iframe (lazy load)
   Recorte automático com IA (servidor removedor-server/, porta 7000). O
   frontend (removedor.html, tema claro baked, canvas + fetch) faz toda a
   edição fina no navegador; o servidor só devolve a máscara de segmentação.
   O recorte pronto volta ao app pai via postMessage 'agente:image-out'
   (canal de IMAGEM, tratado em src/handoff.js → addImageAsLayer).
   Aqui só carregamos e revelamos o iframe. (Molde: src/videograb.js)
   ============================================================ */
function renderRemovedor() {
  const f = $('#removedorFrame');
  if (!f) return;
  if (!f.dataset.loaded) {
    f.addEventListener('load', () => {
      f.dataset.ready = '1';
      requestAnimationFrame(() => f.classList.add('themed'));
    });
    f.src = (typeof toolFrameSrc === 'function') ? toolFrameSrc('removedor.html') : 'removedor.html';
    f.dataset.loaded = '1';
  }
}
