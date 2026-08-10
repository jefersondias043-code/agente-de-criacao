'use strict';
/* ============================================================================
 * BOTÃO LIMPAR (×) NOS CAMPOS DE CONTEÚDO
 *
 * Começar um conteúdo novo exigia apagar o anterior à mão. O × devolve o campo
 * vazio num toque.
 *
 * POR QUE UM MECANISMO ÚNICO, E NÃO UM BOTÃO POR CAMPO: a plataforma tem campos
 * escritos no HTML e campos criados em tempo de execução (a lista de elenco da
 * Narrativa, os campos de texto do editor de cartaz, o editor do pacote). Uma
 * marcação por campo cobriria só os primeiros e envelheceria — cada campo novo
 * nasceria sem o botão, e ninguém lembraria. Aqui a regra é do TIPO de campo,
 * não do campo: um observador pega o que aparecer depois.
 *
 * O que o clique faz, além de esvaziar: dispara `input` e `change`. Metade da
 * plataforma reage a esses eventos — contador de caracteres, autosave do
 * rascunho, diagnóstico da Narrativa, estado do cartaz. Sem eles o campo
 * ficaria vazio na tela e cheio na memória.
 * ========================================================================== */

/* Campos de CONTEÚDO. Ficam de fora: senha (limpar não é o gesto esperado),
 * arquivo e campos somente-leitura. */
const CLEAR_SELETOR = 'textarea, input[type="text"], input[type="search"], input[type="url"], input[type="tel"], input[type="email"]';

function clearFieldElegivel(el) {
  if (!el || el.__clearWired) return false;
  if (el.disabled || el.readOnly) return false;
  // Opt-out explícito, no próprio campo ou num ancestral (uma tela inteira).
  if (el.closest('[data-no-clear]')) return false;
  // Campo fora da vista não precisa de botão — e o botão nem seria clicável.
  if (el.closest('[hidden]')) return false;
  return true;
}

/** Envolve o campo e injeta o botão. O invólucro é `display:block` e não muda
 *  o fluxo: nenhum seletor do CSS depende de o campo ser filho direto de
 *  `.field` (conferido antes de escolher esta abordagem). */
function clearFieldWire(el) {
  if (!clearFieldElegivel(el)) return;
  el.__clearWired = true;

  const host = document.createElement('span');
  host.className = 'clearable';
  if (el.tagName === 'INPUT') host.classList.add('clearable-inline');
  el.parentNode.insertBefore(host, el);
  host.appendChild(el);

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'field-clear';
  btn.tabIndex = -1;                       // o campo já está na ordem de tabulação
  btn.setAttribute('aria-label', 'Limpar o campo');
  btn.title = 'Limpar';
  btn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
  host.appendChild(btn);

  const sincronizar = () => host.classList.toggle('has-value', !!String(el.value || '').length);
  btn.onclick = (e) => {
    e.preventDefault();
    if (!String(el.value || '').length) return;
    el.value = '';
    // O foco volta ANTES dos eventos: quem escuta `input` (contador, autosave,
    // diagnóstico) pode redesenhar o bloco, e um foco pedido depois disso se
    // perde no meio do caminho.
    try { el.focus(); } catch (_) { /* campo pode ter saído da tela */ }
    el.dispatchEvent(new Event('input', { bubbles: true }));
    el.dispatchEvent(new Event('change', { bubbles: true }));
    sincronizar();
  };
  el.addEventListener('input', sincronizar);
  el.addEventListener('change', sincronizar);
  sincronizar();
  return btn;
}

/** Liga em tudo que já está na página (ou dentro de `raiz`). */
function clearFieldWireAll(raiz) {
  const alvo = raiz || document;
  if (!alvo || !alvo.querySelectorAll) return 0;
  const campos = [...alvo.querySelectorAll(CLEAR_SELETOR)];
  let n = 0;
  campos.forEach((el) => { if (clearFieldWire(el)) n++; });
  return n;
}

/* Campos criados depois — e a plataforma cria muitos. Sem o observador, o botão
 * existiria só nos campos escritos à mão no HTML. */
let _clearObserver = null;
function clearFieldObservar() {
  if (_clearObserver || typeof MutationObserver === 'undefined' || !document.body) return;
  _clearObserver = new MutationObserver((mutacoes) => {
    for (const m of mutacoes) {
      for (const no of m.addedNodes) {
        if (!no || no.nodeType !== 1) continue;
        if (no.matches && no.matches(CLEAR_SELETOR)) clearFieldWire(no);
        else clearFieldWireAll(no);
      }
    }
  });
  _clearObserver.observe(document.body, { childList: true, subtree: true });
}

function clearFieldInit() {
  clearFieldWireAll(document);
  clearFieldObservar();
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', clearFieldInit);
  else clearFieldInit();
}
