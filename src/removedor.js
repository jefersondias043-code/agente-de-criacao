'use strict';
/* ============================================================
   REMOVEDOR DE FUNDO — embed via iframe (lazy load)
   Recorte automático 100% NO NAVEGADOR: a segmentação roda localmente com
   ONNX Runtime Web + modelo U²-Netp (vendor/ort/ + models/u2netp.onnx), sem
   nenhum servidor. Funciona no celular e no computador, igual, de graça.
   O frontend (removedor.html) faz todo o resto — carregar imagem, refinar
   borda, pincel, fundo, exportar — em canvas. O recorte pronto volta ao app
   pai via postMessage 'agente:image-out' (canal de IMAGEM, tratado em
   src/handoff.js → addImageAsLayer). Aqui só carregamos e revelamos o iframe.
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
