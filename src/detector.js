'use strict';
/* ============================================================
   DETECTOR FLOP — embed via iframe (lazy load)
   O tema claro + a ocultação da config + a ponte de configuração agora vivem
   DENTRO de detector-flop.html (baked), para funcionar também em file://
   (onde o navegador bloqueia o app pai de "injetar" CSS/JS no iframe).
   Aqui só carregamos, mandamos a config (postMessage) e revelamos o iframe.
   ============================================================ */
function renderDetector() {
  mountToolFrame('#detectorFrame', 'detector-flop.html', 'Detector Flop');
}
