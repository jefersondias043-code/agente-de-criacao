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
  genMode: 'agp.genMode',   // 'agents' (pipeline de 3 agentes) | 'fast' (1 chamada, como antes)
  apiKeys: 'agp.apiKeys',
  apiKeysEnc: 'agp.apiKeys.enc',   // bloqueio do workspace: chaves cifradas (AES-GCM) — opcional
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
// Grava JSON com falha VISÍVEL e acionável. Antes, sob cota, a gravação falhava
// em silêncio → o State em memória divergia do persistido (o usuário achava que
// salvou). Agora distingue "armazenamento cheio" (com instrução de backup/limpeza)
// e devolve true/false para quem quiser reagir (retrocompatível: callers antigos
// ignoram o retorno).
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch (e) {
    const quota = !!e && (e.name === 'QuotaExceededError' || e.name === 'NS_ERROR_DOM_QUOTA_REACHED' ||
      e.code === 22 || e.code === 1014 || /quota|exceeded/i.test(e.message || ''));
    if (quota) {
      toast('Armazenamento cheio: esta alteração NÃO foi salva. Exporte um backup e remova itens antigos em Configurações → Dados e backup.', 'error', 9000);
    } else {
      toast('Não foi possível salvar neste navegador.', 'error');
    }
    return false;
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
  // Bloqueio do workspace: se há chaves CIFRADAS, não gravamos o padrão em claro
  // (as chaves reais só entram na memória após o desbloqueio com senha).
  const locked = !!localStorage.getItem(STORAGE_KEYS.apiKeysEnc);
  if (!savedKeys && !locked) saveJSON(STORAGE_KEYS.apiKeys, apiKeys);
  if (!savedModels) saveJSON(STORAGE_KEYS.models, models);
  return {
    provider: localStorage.getItem(STORAGE_KEYS.provider) || 'groq',
    genMode: (localStorage.getItem(STORAGE_KEYS.genMode) === 'fast') ? 'fast' : 'agents',
    apiKeys, models,
    locked,        // chaves estão cifradas em repouso?
    unlocked: !locked,  // já há chave utilizável em memória nesta sessão?
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

/** Executa fn() mantendo a TELA LIGADA (Screen Wake Lock) enquanto durar. No
 *  celular, a tela apagando suspende a aba e TRAVA processamentos longos
 *  (transcrição de vídeo/áudio, OCR) — é o que o AutoPost faz ao transcrever.
 *  Degrada sem efeito onde a API não existe; reobtém o lock ao voltar o foco. */
async function withWakeLock(fn) {
  let lock = null;
  const pedir = async () => {
    try {
      if (navigator.wakeLock && typeof navigator.wakeLock.request === 'function' &&
          window.isSecureContext && document.visibilityState === 'visible' && !lock) {
        lock = await navigator.wakeLock.request('screen');
      }
    } catch (_) { lock = null; }
  };
  const reobter = () => { if (document.visibilityState === 'visible' && !lock) pedir(); };
  await pedir();
  document.addEventListener('visibilitychange', reobter);
  try {
    return await fn();
  } finally {
    document.removeEventListener('visibilitychange', reobter);
    try { if (lock && lock.release) await lock.release(); } catch (_) {}
    lock = null;
  }
}

/** URL do HTML de uma ferramenta embutida (iframe) com CACHE-BUSTER de versão.
 *  Anexa ?v=<build> para o navegador buscar o HTML NOVO a cada release — sem
 *  isso, após uma atualização o iframe podia continuar servindo a versão antiga
 *  do cache (foi o que fez o Detector Flop aparecer "bugado" mesmo já corrigido). */
function toolFrameSrc(file) {
  let v = '';
  try { const el = document.querySelector('[data-build]'); v = (el && el.dataset && el.dataset.build) || ''; } catch (_) { /* */ }
  return v ? (file + '?v=' + encodeURIComponent(v)) : file;
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
