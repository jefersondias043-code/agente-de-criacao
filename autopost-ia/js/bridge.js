'use strict';
/* ============================================================
   BRIDGE — integração com a plataforma Agente (opcional).

   Este app é INDEPENDENTE. Tudo aqui só é ativado quando a página
   roda EMBUTIDA (iframe) dentro da plataforma — no modo normal
   (standalone), nada deste arquivo interfere.

   Pontes (todas via postMessage, só com a janela PAI):
   1. agente:config        → recebe chave/modelo da plataforma
   2. agente:content       → recebe texto de outra ferramenta
   3. agente:content-out   → barra "Enviar para…" (renderSendBar)
   4. agente:ingest        → PDF/imagem/DOCX vão ao pai (OCR/extração)
   ============================================================ */

// Estamos dentro de um iframe? (a plataforma embute as ferramentas assim)
window.IS_EMBEDDED = (function () {
  try { return !!(window.parent && window.parent !== window); } catch (e) { return false; }
})();

(function () {
  if (!window.IS_EMBEDDED) return;

  const parentOrigin = () => (location.protocol === 'file:' ? '*' : location.origin);

  /* ---------- 1/2. Config + conteúdo vindos da plataforma ---------- */
  function applyCfg(c) {
    if (!c) return;
    window.__AGENTE_CONFIG__ = { groqKey: c.groqKey || '', groqModel: c.groqModel || '', locked: !!c.locked };
    try {
      /* Workspace bloqueado: NÃO persiste a chave (fica só em memória). */
      if (c.groqKey && !c.locked) { localStorage.setItem('groq_api_key', c.groqKey); localStorage.setItem('df_groq_key', c.groqKey); }
      if (c.groqModel) { localStorage.setItem('groq_model', c.groqModel); localStorage.setItem('df_model', c.groqModel); }
    } catch (_) {}
  }
  function applyContent(d) {
    try {
      const ta = document.getElementById('transcricaoTexto');
      if (ta) {
        ta.value = d.text || '';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
        ta.focus();
        ta.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    } catch (_) {}
  }

  /* ---------- 4. Ingestão universal: PDF/imagem/DOCX → app pai ---------- */
  const pendingIngest = {};

  function sendToParentIngest(file, targetTa, statusEl) {
    const reqId = 'ing-' + Date.now() + '-' + Math.random().toString(16).slice(2);
    pendingIngest[reqId] = { target: targetTa, status: statusEl };
    statusEl.textContent = 'Processando…';
    try { window.parent.postMessage({ type: 'agente:ingest', reqId: reqId, file: file }, parentOrigin()); }
    catch (_) { statusEl.textContent = 'Não foi possível enviar o arquivo.'; delete pendingIngest[reqId]; }
  }

  /* Segurança: só aceita comandos da janela PAI (a plataforma); ignora outras fontes. */
  window.addEventListener('message', function (e) {
    if (!e || !e.data || e.source !== window.parent) return;
    const d = e.data;
    if (d.type === 'agente:config') { applyCfg(d); return; }
    if (d.type === 'agente:content') { applyContent(d); return; }
    // Respostas da ingestão universal (agente:ingest-*)
    if (!d.reqId) return;
    const cb = pendingIngest[d.reqId];
    if (!cb) return;
    if (d.type === 'agente:ingest-progress') { cb.status.textContent = d.msg || 'Processando…'; }
    else if (d.type === 'agente:ingest-result') {
      const t = cb.target, cur = (t.value || '').trim();
      t.value = cur ? (cur + '\n\n' + (d.text || '')) : (d.text || '');
      t.dispatchEvent(new Event('input', { bubbles: true }));
      cb.status.textContent = 'Texto extraído e adicionado.';
      setTimeout(function () { cb.status.textContent = ''; }, 2500);
      delete pendingIngest[d.reqId];
    } else if (d.type === 'agente:ingest-error') {
      cb.status.textContent = d.error || 'Não foi possível processar o arquivo.';
      delete pendingIngest[d.reqId];
    }
  });

  // Pede a configuração à plataforma assim que possível.
  try { window.parent.postMessage({ type: 'agente:config-request' }, parentOrigin()); } catch (_) {}

  /* ---------- 3. Barra "Enviar para…" (usada pelo render quando embutido) ---------- */
  // Devolve o HTML da barra; o clique é resolvido por delegação (data-send-*).
  window.renderSendBar = function (registryId, text) {
    window._roteiroRegistry = window._roteiroRegistry || {};
    window._roteiroRegistry[registryId] = text || '';
    const alvos = [['cartazes', 'Cartaz'], ['carrossel', 'Carrossel'], ['generate', 'Gerar matéria'], ['replicador', 'Replicador'], ['detector', 'Detector'], ['reescrita', 'Reescrever']];
    const botoes = alvos.map(d =>
      `<button type="button" class="copy-btn" data-send-target="${d[0]}" data-send-id="${registryId}">${d[1]} →</button>`
    ).join('');
    return `<div class="send-bar"><span class="send-bar-label">Enviar para</span>${botoes}</div>`;
  };

  // Delegação do clique nos botões "Enviar para".
  document.addEventListener('click', function (e) {
    const b = e.target.closest('[data-send-target]');
    if (!b) return;
    const text = (window._roteiroRegistry || {})[b.dataset.sendId] || '';
    try { window.parent.postMessage({ type: 'agente:content-out', target: b.dataset.sendTarget, text: text }, parentOrigin()); } catch (_) {}
  });

  /* ---------- Entrada unificada (embutido): TODOS os formatos ---------- */
  // No modo embutido, o anexo aceita também PDF/imagem/DOCX — os formatos que a
  // PLATAFORMA processa (OCR/extração). Áudio/vídeo/texto seguem o fluxo nativo.
  document.addEventListener('DOMContentLoaded', function () {
    const nat = document.getElementById('transcricaoFile');
    const ta = document.getElementById('transcricaoTexto');
    const hintEl = document.querySelector('.sb-hint');
    const toolbar = document.getElementById('sbToolbar');
    if (!nat || !ta || !toolbar) return;

    // Amplia o accept do input nativo pra lista completa do ecossistema.
    nat.setAttribute('accept', '.txt,.md,.pdf,.docx,.png,.jpg,.jpeg,.bmp,.gif,.webp,.tiff,.tif,.mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.mpeg,.mpga,.webm,.mov,.3gp,text/plain,application/pdf,image/*,audio/*,video/*');
    if (hintEl) hintEl.textContent = 'ou arraste aqui · áudio, vídeo, PDF, imagem ou texto';

    // Status da ingestão (aparece na barra de ferramentas da caixa).
    const status = document.createElement('span');
    status.style.cssText = 'font-size:11px;color:var(--ink-faded);';
    toolbar.appendChild(status);

    // Intercepta a troca de arquivo ANTES do handler nativo (fase de captura):
    // mídia/texto seguem o pipeline nativo; o resto vai ao pai e o input é limpo.
    nat.addEventListener('change', function (e) {
      const f = (nat.files || [])[0];
      if (!f) return;
      const nm = (f.name || '').toLowerCase();
      const isMedia = /^audio\//.test(f.type) || /^video\//.test(f.type) ||
        /\.(mp3|wav|m4a|ogg|flac|aac|mp4|mpeg|mpga|webm|mov|3gp)$/.test(nm);
      const isTexto = ehArquivoDeTexto(f);
      if (isMedia || isTexto) return; // pipeline nativo cuida
      // PDF, imagem, DOCX… → extração/OCR/transcrição no app pai (universal).
      e.stopImmediatePropagation();
      nat.value = '';
      sendToParentIngest(f, ta, status);
      // Reflete o estado (sem arquivo) na caixa única.
      if (window._refletirEntrada) window._refletirEntrada();
    }, true);
  });

  /* ---------- Mobile (embutido): rola até o pacote NOVO ---------- */
  if (window.matchMedia) {
    const mq = window.matchMedia('(max-width: 880px)');
    const markAll = () => document.querySelectorAll('.package').forEach(p => p.setAttribute('data-agente-seen', '1'));
    const check = () => {
      const fresh = document.querySelectorAll('.package:not([data-agente-seen])');
      if (!fresh.length) return;
      fresh.forEach(p => p.setAttribute('data-agente-seen', '1'));
      if (mq.matches) { try { fresh[0].scrollIntoView({ behavior: 'smooth', block: 'start' }); } catch (_) {} }
    };
    setTimeout(function () {
      markAll(); /* pacotes restaurados do armazenamento não disparam scroll */
      try { new MutationObserver(check).observe(document.documentElement, { childList: true, subtree: true }); } catch (_) {}
    }, 800);
  }
})();
