'use strict';
/* ============================================================
   CORE — utilitários compartilhados por todos os módulos.
   Scripts clássicos em escopo global (funciona inclusive em file://).
   ============================================================ */

// Atalho usado em todo o app pra document.getElementById.
const $ = id => document.getElementById(id);

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Data/hora legível em pt-BR.
function fmtData(iso) {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('pt-BR') + ' ' + d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  } catch (_) { return ''; }
}

// Classes de cor por faixa de nota (0–100) e por critério (0–10).
function scoreClass(score) {
  if (score >= 80) return 'pass';
  if (score >= 60) return 'warn';
  return 'fail';
}
function critClass(score) {
  if (score >= 7) return 'pass';
  if (score >= 5) return 'warn';
  return 'fail';
}

// Remove # do começo se vier, espaços, e força minúsculas.
function sanitizeHashtag(tag) {
  return String(tag || '')
    .replace(/^#+/, '')
    .replace(/\s+/g, '')
    .toLowerCase();
}

const TIPO_LABEL = {
  'ampla':    'Ampla',
  'assunto':  'Assunto',
  'nicho':    'Nicho',
  'intencao': 'Intenção'
};

// Formata o texto do roteiro/transcrição: destaca tags [GANCHO], [DESENVOLVIMENTO], etc.
function formatRoteiro(texto) {
  const segments = texto.split(/\[([A-ZÇÃÕÉÊÍÓÚ\s]+)\]/g).filter(s => s.trim());
  if (segments.length < 2) {
    return `<div>${escapeHtml(texto).replace(/\n/g, '<br>')}</div>`;
  }
  let html = '';
  for (let i = 0; i < segments.length; i += 2) {
    const label = segments[i].trim();
    const content = (segments[i + 1] || '').trim();
    if (content) {
      html += `<span class="seg"><span class="seg-label">${escapeHtml(label)}</span>${escapeHtml(content).replace(/\n/g, '<br>')}</span>`;
    }
  }
  return html;
}

// Lista de passos do andamento (transcrição → geração → revisão → ajuste).
function renderPipeline(steps) {
  return `<div class="pipeline">${steps.map(s => `
    <div class="pipeline-step ${s.state}">
      <div class="dot"></div>
      <div>
        <div class="label">${escapeHtml(s.label)}</div>
        ${s.desc ? `<div class="desc">${escapeHtml(s.desc)}</div>` : ''}
      </div>
    </div>`).join('')}</div>`;
}

// Fallback de cópia usando textarea temporário (ambientes sem clipboard API).
function fallbackCopy(text, showFeedback) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.top = '-9999px';
  ta.style.left = '-9999px';
  document.body.appendChild(ta);
  ta.focus();
  ta.select();
  try {
    const ok = document.execCommand('copy');
    showFeedback(ok ? 'Copiado ✓' : 'Erro ✗', ok ? 'var(--pass)' : 'var(--fail)');
  } catch (err) {
    showFeedback('Erro ✗', 'var(--fail)');
  }
  document.body.removeChild(ta);
}

// Mensagem transitória no rodapé (feedback de ações: compartilhar, regenerar…).
function toast(msg, tipo) {
  let host = document.getElementById('toastHost');
  if (!host) { host = document.createElement('div'); host.id = 'toastHost'; document.body.appendChild(host); }
  const el = document.createElement('div');
  el.className = 'toast' + (tipo === 'error' ? ' error' : '');
  el.textContent = msg;
  host.appendChild(el);
  // setTimeout (não rAF): dispara mesmo com a aba em segundo plano.
  setTimeout(() => el.classList.add('show'), 10);
  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => { try { el.remove(); } catch (_) {} }, 300);
  }, tipo === 'error' ? 4200 : 2600);
}
