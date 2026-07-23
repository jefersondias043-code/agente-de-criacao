'use strict';
/* ============================================================
   VIDEOGRAB — embed via iframe (lazy load)
   Ferramenta de HANDOFF, sem servidor: funciona 100% no navegador (GitHub
   Pages) e no celular. O usuário cola o link do vídeo e o app abre um baixador
   web independente (cobalt.tools) já com o link copiado, onde o download é
   concluído. Baixar de Instagram/TikTok/YouTube direto do navegador é
   impossível (CORS + as plataformas bloqueiam) — por isso o handoff.
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
