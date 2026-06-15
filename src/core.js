'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

// Configurar PDF.js worker (com fallback para sem worker)
if (typeof pdfjsLib !== 'undefined') {
  // Usa o worker do CDN. Em file://, o browser pode bloquear; nesse caso
  // o pdf.js faz fallback automático para fake worker (mais lento, mas funciona).
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}

// ---------- Storage ----------
const STORAGE_KEYS = {
  apiKey: 'agp.apiKey',
  model: 'agp.model',
  provider: 'agp.provider',
  apiKeys: 'agp.apiKeys',
  models: 'agp.models',
  portal: 'agp.portal',
  portals: 'agp.portals',
  generations: 'agp.generations',
  extractions: 'agp.extractions',
  posters: 'agp.posters',
  posterPresets: 'agp.posterPresets',
};

function loadJSON(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (e) {
    toast('Não foi possível salvar — o armazenamento do navegador pode estar cheio.', 'error');
  }
}

// ---------- Estado ----------
function loadPortals() {
  // Migração: se agp.portal existir, migra para agp.portals[0]
  const oldPortal = loadJSON(STORAGE_KEYS.portal, null);
  let portals = loadJSON(STORAGE_KEYS.portals, null);
  if (oldPortal && !portals) {
    portals = [
      { ...oldPortal },
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '' },
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '' },
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '' },
    ];
    try { localStorage.removeItem(STORAGE_KEYS.portal); } catch {}
  }
  if (!portals) {
    portals = [
      { name: 'Municípios Bahia', acronym: 'MB', logo: null, handle: '@municipiosbahia', tagline: 'Notícias que conectam.', location: 'Salvador, BA', theme: 'municipios-bahia' },
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '', theme: 'neutral' },
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '', theme: 'neutral' },
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '', theme: 'neutral' },
    ];
  }
  // Migração de TEMA: Portal 1 = Municípios Bahia; demais = neutro (só se ainda não
  // definido — não sobrescreve nome/handle/logo já salvos pelo usuário).
  let changed = false;
  portals.forEach((p, i) => { if (p && !p.theme) { p.theme = (i === 0) ? 'municipios-bahia' : 'neutral'; changed = true; } });
  if (changed || (oldPortal && portals)) saveJSON(STORAGE_KEYS.portals, portals);
  return portals;
}
const State = (() => {
  const savedKeys = loadJSON(STORAGE_KEYS.apiKeys, null);
  const savedModels = loadJSON(STORAGE_KEYS.models, null);
  const oldKey = localStorage.getItem(STORAGE_KEYS.apiKey);
  const oldModel = localStorage.getItem(STORAGE_KEYS.model);
  // Migrate old single-provider state to multi-provider
  const apiKeys = savedKeys || (oldKey ? { groq: oldKey, openai: '', anthropic: '' } : { groq: '', openai: '', anthropic: '' });
  const models = savedModels || (oldModel ? { groq: oldModel, openai: 'gpt-5.4', anthropic: 'claude-sonnet-4-6' } : { groq: 'llama-3.3-70b-versatile', openai: 'gpt-5.4', anthropic: 'claude-sonnet-4-6' });
  if (!savedKeys) saveJSON(STORAGE_KEYS.apiKeys, apiKeys);
  if (!savedModels) saveJSON(STORAGE_KEYS.models, models);
  return {
    provider: localStorage.getItem(STORAGE_KEYS.provider) || 'groq',
    apiKeys, models,
    // backwards compat — kept for legacy safety
    apiKey: oldKey || apiKeys.groq || '',
    model: oldModel || models.groq || 'llama-3.3-70b-versatile',
    activePortalIndex: 0,
    portals: loadPortals(),
    generations: loadJSON(STORAGE_KEYS.generations, []),
    extractions: loadJSON(STORAGE_KEYS.extractions, []),
    posters: loadJSON(STORAGE_KEYS.posters, []),
    posterPresets: loadJSON(STORAGE_KEYS.posterPresets, []),   // presets de identidade visual (nome + custom)
    currentView: 'welcome',
    activeExtractionId: null,
    activePosterId: null,
    selectedFiles: [],
  };
})();

function uuid() {
  // Aleatoriedade criptográfica quando disponível (sem previsibilidade nem
  // risco de colisão do Math.random); fallback mantém compatibilidade.
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}
// ---------- UI helpers ----------
function $(sel) { return document.querySelector(sel); }
function $$(sel) { return document.querySelectorAll(sel); }

function toast(message, kind = 'info', timeout = 3500) {
  const stack = $('#toast-stack');
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  // textContent: mensagens podem ecoar conteúdo externo (ex.: erro vindo da
  // API ou nome de arquivo) — nunca interpretar como HTML.
  const msgEl = document.createElement('div');
  msgEl.className = 'flex-1';
  msgEl.textContent = String(message ?? '');
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('style', 'background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7;');
  closeBtn.textContent = '×';
  closeBtn.onclick = () => t.remove();
  t.appendChild(msgEl);
  t.appendChild(closeBtn);
  stack.appendChild(t);
  if (timeout) setTimeout(() => t.remove(), timeout);
}

function formatBytes(b) {
  if (b == null) return '—';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b/1024).toFixed(1)} KB`;
  return `${(b/(1024*1024)).toFixed(1)} MB`;
}
function formatDate(iso) {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}
function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}
function truncate(s, n) {
  s = String(s ?? '');
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}


/* ===== Abas mobile (formulário ↔ resultado) =====
   Padrão compartilhado pelas ferramentas de 2 colunas (Gerar, Extrair):
   em telas estreitas, a CSS .mtabs mostra uma área por vez; estas funções
   trocam a aba ativa (inclusive programaticamente, ao concluir uma ação). */
function setMtab(hostSel, tab) {
  const host = $(hostSel);
  if (!host) return;
  host.dataset.mtab = tab;
  host.querySelectorAll('.mtabs button').forEach(b =>
    b.classList.toggle('active', b.dataset.mtab === tab));
}
function wireMtabs(hostSel) {
  const host = $(hostSel);
  if (!host) return;
  host.querySelectorAll('.mtabs button').forEach(b => {
    b.onclick = () => setMtab(hostSel, b.dataset.mtab);
  });
}
