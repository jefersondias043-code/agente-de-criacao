'use strict';
/* ============================================================
   VIDEOGRAB — embed via iframe (lazy load)
   Baixa vídeos do Instagram/TikTok/YouTube sem marca d'água. O frontend
   (videograb.html, tema claro baked) conversa com o servidor de extração em
   videograb-server/ (npm start → http://localhost:3000). A ponte de
   transcrição (vídeo → Whisper do app pai → texto p/ outra ferramenta) vive
   baked no próprio HTML, para funcionar também em file://.
   Aqui só carregamos e revelamos o iframe. (Molde: src/replicador.js)
   ============================================================ */
function renderVideograb() {
  const f = $('#videograbFrame');
  if (!f) return;
  if (!f.dataset.loaded) {
    f.addEventListener('load', () => {
      f.dataset.ready = '1';
      requestAnimationFrame(() => f.classList.add('themed'));
    });
    f.src = (typeof toolFrameSrc === 'function') ? toolFrameSrc('videograb.html') : 'videograb.html';
    f.dataset.loaded = '1';
  }
}
