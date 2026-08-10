'use strict';
/* ============================================================
   BOTÃO LIMPAR (×) — mesma regra do app principal.

   Vale para o que existe no HTML e para o que a interface cria
   depois (a caixa de revisão da transcrição, os campos do
   pacote no modo edição). Por isso a regra é do TIPO de campo,
   com um observador para o que aparecer em seguida.

   O clique dispara `input` e `change`: o app reage a eles para
   contar caracteres e habilitar botões — sem isso o campo
   ficaria vazio na tela e cheio na memória.
   ============================================================ */
const CLEAR_SELETOR = 'textarea, input[type="text"], input[type="search"], input[type="url"], input[type="password"]';

function clearFieldWire(el) {
  if (!el || el.__clearWired || el.disabled || el.readOnly) return;
  if (el.closest('[data-no-clear]') || el.closest('[hidden]')) return;
  el.__clearWired = true;

  const host = document.createElement('span');
  host.className = 'clearable' + (el.tagName === 'INPUT' ? ' clearable-inline' : '');
  el.parentNode.insertBefore(host, el);
  host.appendChild(el);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'field-clear';
  btn.tabIndex = -1;
  btn.setAttribute('aria-label', 'Limpar o campo');
  btn.title = 'Limpar';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  host.appendChild(btn);

  const sync = () => host.classList.toggle('has-value', !!String(el.value || '').length);
  btn.onclick = (e) => {
    e.preventDefault();
    if (!String(el.value || '').length) return;
    el.value = '';
    // Foco antes dos eventos: quem escuta pode redesenhar o bloco.
    try { el.focus(); } catch (_) {}
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    sync();
  };
  el.addEventListener('input', sync);
  el.addEventListener('change', sync);
  sync();
}

function clearFieldWireAll(raiz) {
  const alvo = raiz || document;
  if (!alvo || !alvo.querySelectorAll) return;
  [...alvo.querySelectorAll(CLEAR_SELETOR)].forEach(clearFieldWire);
}

function clearFieldInit() {
  clearFieldWireAll(document);
  if (typeof MutationObserver === 'undefined' || !document.body) return;
  new MutationObserver((ms) => {
    for (const m of ms) {
      for (const no of m.addedNodes) {
        if (!no || no.nodeType !== 1) continue;
        if (no.matches && no.matches(CLEAR_SELETOR)) clearFieldWire(no);
        else clearFieldWireAll(no);
      }
    }
  }).observe(document.body, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', clearFieldInit);
else clearFieldInit();
