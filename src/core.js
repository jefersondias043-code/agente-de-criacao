'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

/* ============================================================
   BIBLIOTECAS EXTERNAS (CDN) — carregamento resiliente
   Quatro recursos dependem de bibliotecas de CDN: exportar imagem
   (html2canvas), ler PDF (pdf.js), ler DOCX (mammoth) e OCR (Tesseract).
   Se o CDN estiver bloqueado (rede corporativa, bloqueador, queda, primeiro
   acesso offline), a tag <script> do index falha em silêncio e o código
   estourava um ReferenceError cru: o botão simplesmente não fazia nada e o
   usuário não recebia explicação nenhuma.
   `ensureLib` resolve isso: confere se a biblioteca está presente, tenta
   recarregá-la UMA vez (a rede pode ter voltado) com o mesmo SRI do index —
   sem afrouxar a proteção contra CDN comprometido — e devolve se deu certo,
   para quem chamou avisar direito em vez de morrer calado.
   ============================================================ */
const EXTERNAL_LIBS = {
  html2canvas: { global: 'html2canvas', label: 'exportação de imagens',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js',
    sri: 'sha384-ZZ1pncU3bQe8y31yfZdMFdSpttDoPmOZg2wguVK9almUodir1PghgT0eY7Mrty8H' },
  pdfjsLib: { global: 'pdfjsLib', label: 'leitura de PDF',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    sri: 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e' },
  mammoth: { global: 'mammoth', label: 'leitura de DOCX',
    url: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    sri: 'sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz' },
  Tesseract: { global: 'Tesseract', label: 'reconhecimento de texto em imagem',
    url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js',
    sri: 'sha384-Ptw8HCYAWF6vIop6WuGxfSCiDCIzUWqjrHYfx8Vd0S4CMBaicAdBh2y+Ufle664A' },
};
const _libLoads = {};
function libReady(key) {
  const spec = EXTERNAL_LIBS[key];
  return !!(spec && typeof window !== 'undefined' && typeof window[spec.global] !== 'undefined');
}
/** true se a biblioteca está pronta para uso (recarregando-a se preciso). */
function ensureLib(key) {
  const spec = EXTERNAL_LIBS[key];
  if (!spec) return Promise.resolve(false);
  if (libReady(key)) return Promise.resolve(true);
  if (typeof document === 'undefined') return Promise.resolve(false);
  if (!_libLoads[key]) {
    _libLoads[key] = new Promise((resolve) => {
      const s = document.createElement('script');
      // setAttribute (não a propriedade): o reflexo de `integrity` para o
      // atributo não é universal, e sem o atributo o navegador NÃO valida o
      // hash — a recarga perderia a proteção contra CDN comprometido.
      s.setAttribute('src', spec.url);
      s.setAttribute('integrity', spec.sri);
      s.setAttribute('crossorigin', 'anonymous');
      s.setAttribute('referrerpolicy', 'no-referrer');
      s.async = true;
      s.onload = () => resolve(libReady(key));
      s.onerror = () => { _libLoads[key] = null; resolve(false); };   // permite nova tentativa depois
      document.head.appendChild(s);
    });
  }
  return _libLoads[key];
}
/** Mensagem única para quando a biblioteca não pôde ser carregada. */
function libUnavailableMsg(key) {
  const spec = EXTERNAL_LIBS[key];
  return 'Recurso de ' + ((spec && spec.label) || key) + ' indisponível: não foi possível '
    + 'carregar um componente externo. Verifique a conexão e tente de novo.';
}

// Configurar PDF.js worker (com fallback para sem worker)
function configurePdfWorker() {
  if (typeof pdfjsLib === 'undefined' || !pdfjsLib.GlobalWorkerOptions) return;
  // Usa o worker do CDN. Em file://, o browser pode bloquear; nesse caso
  // o pdf.js faz fallback automático para fake worker (mais lento, mas funciona).
  pdfjsLib.GlobalWorkerOptions.workerSrc =
    'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
}
configurePdfWorker();

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
  posterPanelH: 'agp.posterPanelH',   // altura (px) do painel de edição no mobile — divisor arrastável preview↔edição
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
    // Todos os perfis começam LIMPOS, prontos pro usuário preencher.
    portals = [
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '', theme: 'neutral' },
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '', theme: 'neutral' },
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '', theme: 'neutral' },
      { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '', theme: 'neutral' },
    ];
  }
  let changed = false;
  // Migração: limpa o perfil-semente de desenvolvimento "Municípios Bahia" do
  // Perfil 1 — SÓ se estiver intocado (todos os campos iguais à semente antiga).
  // Se o usuário mexeu em qualquer campo, respeita e não apaga nada.
  if (portals[0] && !portals[0].logo &&
      portals[0].name === 'Municípios Bahia' && portals[0].acronym === 'MB' &&
      portals[0].handle === '@municipiosbahia' && portals[0].tagline === 'Notícias que conectam.' &&
      portals[0].location === 'Salvador, BA') {
    portals[0] = { name: '', acronym: '', logo: null, handle: '', tagline: '', location: '', theme: 'neutral' };
    changed = true;
  }
  // Migração de TEMA: perfis sem tema definido → neutro (não sobrescreve a
  // escolha já salva pelo usuário).
  portals.forEach((p) => { if (p && !p.theme) { p.theme = 'neutral'; changed = true; } });
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

function toast(message, kind = 'info', timeout = 3500, action) {
  const stack = $('#toast-stack');
  const t = document.createElement('div');
  t.className = `toast ${kind}`;
  // textContent: mensagens podem ecoar conteúdo externo (ex.: erro vindo da
  // API ou nome de arquivo) — nunca interpretar como HTML.
  const msgEl = document.createElement('div');
  msgEl.className = 'flex-1';
  msgEl.textContent = String(message ?? '');
  t.appendChild(msgEl);
  // Ação opcional (ex.: "Desfazer") — botão de texto discreto antes do ×.
  if (action && action.label && typeof action.onClick === 'function') {
    const act = document.createElement('button');
    act.className = 'toast-action';
    act.textContent = action.label;
    act.onclick = () => { t.remove(); try { action.onClick(); } catch (_) { /* */ } };
    t.appendChild(act);
  }
  const closeBtn = document.createElement('button');
  closeBtn.setAttribute('style', 'background: none; border: none; color: inherit; cursor: pointer; opacity: 0.7;');
  closeBtn.textContent = '×';
  closeBtn.onclick = () => t.remove();
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

/** Converte uma data URL (base64) em Blob. O Blob resultante é lastreado por um
 *  ArrayBuffer "solto" (não preso a um canvas) — importante no iPhone, onde a
 *  folha de compartilhamento às vezes recusa um Blob vindo direto do canvas. */
function _dataUrlToBlob(durl) {
  const s = String(durl);
  const comma = s.indexOf(',');
  const head = s.slice(0, comma);
  const mime = (head.match(/data:([^;]+)/) || [])[1] || 'image/png';
  const bin = atob(s.slice(comma + 1));
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

/** Converte um <canvas> em Blob (Promise). Prefere toBlob (não materializa um
 *  base64 gigante que no iPhone estoura memória). Se o toBlob devolver null
 *  (ex.: limite de memória do iOS em canvas grandes) ou não existir (iOS antigo),
 *  cai no toDataURL. */
function canvasToBlob(canvas, type, quality) {
  type = type || 'image/png';
  return new Promise((resolve, reject) => {
    const viaDataUrl = () => {
      try {
        if (canvas && typeof canvas.toDataURL === 'function') { resolve(_dataUrlToBlob(canvas.toDataURL(type, quality))); return true; }
      } catch (_) { /* */ }
      return false;
    };
    if (!canvas || typeof canvas.toBlob !== 'function') {
      if (!viaDataUrl()) reject(new Error('canvas inválido'));
      return;
    }
    canvas.toBlob((b) => {
      if (b) { resolve(b); return; }
      if (!viaDataUrl()) reject(new Error('toBlob falhou')); // último recurso
    }, type, quality);
  });
}

/** Salva/entrega imagens no dispositivo de um jeito que FUNCIONE no iPhone.
 *
 *  O bug que isto corrige: no iOS Safari o atributo `<a download>` é IGNORADO —
 *  o clique não gera arquivo nenhum e NADA chega à galeria de Fotos, mas o app
 *  ainda mostrava "exportado com sucesso". O caminho correto no iOS é a Web
 *  Share API com ARQUIVOS: abre a folha de compartilhamento onde o usuário toca
 *  "Salvar Imagem" (vai direto pra galeria) ou envia pro Instagram/WhatsApp.
 *
 *  Estratégia: 1) se o navegador sabe compartilhar arquivos (canShare) → share;
 *  2) senão (desktop) → download clássico. Importante: precisa ser chamado
 *  DENTRO do gesto do usuário (clique) — o iOS exige ativação recente pro share.
 *
 *  @param {Array<{name:string, blob:Blob}>} items imagens a salvar
 *  @param {string} [shareTitle] título da folha de compartilhamento
 *  @param {object} [deps] injeção p/ testes: { nav, doc, urlApi, File }
 *  @returns {Promise<'shared'|'downloaded'|'canceled'>}
 */
async function saveImagesToDevice(items, shareTitle, deps) {
  deps = deps || {};
  const nav = deps.nav || (typeof navigator !== 'undefined' ? navigator : null);
  const doc = deps.doc || (typeof document !== 'undefined' ? document : null);
  const urlApi = deps.urlApi || (typeof URL !== 'undefined' ? URL : null);
  const FileCtor = deps.File || (typeof File !== 'undefined' ? File : null);

  const BlobCtor = deps.Blob || (typeof Blob !== 'undefined' ? Blob : null);

  const raw = (items || []).filter((it) => it && it.blob);
  if (!raw.length) throw new Error('nada para salvar');

  // Normaliza cada Blob reconstruindo-o a partir de um ArrayBuffer "solto".
  // No iPhone, um Blob vindo DIRETO de canvas.toBlob costuma ser recusado pela
  // folha de compartilhamento (o cartaz não salvava, embora o carrossel — que
  // já passava pelos bytes — salvasse). Refazer o Blob desprende-o do canvas e
  // o torna compartilhável. Degrada sem quebrar se não der pra ler os bytes.
  const list = [];
  for (const it of raw) {
    let blob = it.blob;
    if (BlobCtor && typeof blob.arrayBuffer === 'function') {
      try { blob = new BlobCtor([await blob.arrayBuffer()], { type: blob.type || 'image/png' }); } catch (_) { blob = it.blob; }
    }
    list.push({ name: it.name, blob });
  }

  // 1) Web Share API com arquivos (iOS/Android modernos) — o único jeito de
  //    mandar imagem pra galeria de Fotos no iPhone a partir do navegador.
  if (nav && typeof nav.canShare === 'function' && typeof nav.share === 'function' && FileCtor) {
    try {
      const files = list.map((it) => new FileCtor([it.blob], it.name, { type: it.blob.type || 'image/png' }));
      if (nav.canShare({ files })) {
        await nav.share({ files, title: shareTitle || undefined });
        return 'shared';
      }
    } catch (err) {
      // Usuário fechou a folha de compartilhamento → não é erro, e NÃO baixa
      // uma cópia duplicada por baixo. Qualquer outro erro (ex.: ativação de
      // gesto perdida) cai no download abaixo como melhor esforço.
      if (err && err.name === 'AbortError') return 'canceled';
    }
  }

  // 2) Fallback: download clássico (desktop; no iOS vai pra Arquivos/Downloads).
  if (!doc || !urlApi || typeof urlApi.createObjectURL !== 'function') {
    throw new Error('sem suporte a exportação neste navegador');
  }
  for (const it of list) {
    const url = urlApi.createObjectURL(it.blob);
    const link = doc.createElement('a');
    link.download = it.name;
    link.href = url;
    if (doc.body && doc.body.appendChild) doc.body.appendChild(link);
    link.click();
    if (link.remove) link.remove();
    setTimeout(() => { try { urlApi.revokeObjectURL(url); } catch (_) { /* */ } }, 8000);
    if (list.length > 1) await new Promise((r) => setTimeout(r, 300)); // espaça downloads múltiplos
  }
  return 'downloaded';
}

/** Painel de exportação: mostra a PRÉ-VISUALIZAÇÃO do que foi gerado e um botão
 *  de salvar/compartilhar.
 *
 *  Por que existe (e não um share automático): no iPhone a Web Share API só
 *  funciona se o share() for disparado por um gesto RECENTE do usuário. Como
 *  gerar a imagem (html2canvas) leva alguns segundos, ao chamar share() logo
 *  depois o iOS já revogou a ativação do toque e o compartilhamento falha em
 *  silêncio — foi por isso que "parou de exportar" cartaz e carrossel. Aqui o
 *  usuário vê o resultado e toca em "Salvar" numa AÇÃO NOVA → o share sempre
 *  vale. Também é mais profissional: confere antes de publicar.
 *
 *  @param {Array<{name:string, blob:Blob}>} items imagens geradas
 *  @param {{title?:string, subtitle?:string}} [opts]
 *  @param {object} [deps] injeção p/ testes: { nav, urlApi, doc, File, save, toast }
 *  @returns {HTMLElement|null} o backdrop criado (ou null se nada a exportar)
 */
function presentExport(items, opts, deps) {
  opts = opts || {}; deps = deps || {};
  const nav = deps.nav || (typeof navigator !== 'undefined' ? navigator : null);
  const urlApi = deps.urlApi || (typeof URL !== 'undefined' ? URL : null);
  const doc = deps.doc || (typeof document !== 'undefined' ? document : null);
  const FileCtor = deps.File || (typeof File !== 'undefined' ? File : null);
  const save = deps.save || (typeof saveImagesToDevice === 'function' ? saveImagesToDevice : null);
  const notify = deps.toast || (typeof toast === 'function' ? toast : function () {});
  const esc = (typeof escapeHtml === 'function') ? escapeHtml : (s) => String(s == null ? '' : s);

  const list = (items || []).filter((it) => it && it.blob);
  if (!list.length) { notify('Nada para exportar.', 'error'); return null; }
  if (!doc || !urlApi) { if (save) save(list, opts.title); return null; }

  const multi = list.length > 1;
  // Compartilhamento de arquivos disponível? (iPhone/Android modernos)
  let canShareFiles = false;
  try {
    if (nav && typeof nav.canShare === 'function' && FileCtor) {
      canShareFiles = nav.canShare({ files: list.map((it) => new FileCtor([it.blob], it.name, { type: it.blob.type || 'image/png' })) });
    }
  } catch (_) { canShareFiles = false; }

  const urls = list.map((it) => { try { return urlApi.createObjectURL(it.blob); } catch (_) { return ''; } });
  const primaryLabel = canShareFiles ? (multi ? 'Salvar / compartilhar' : 'Salvar na galeria') : 'Baixar';
  const hint = canShareFiles
    ? 'Na janela do sistema, toque em “Salvar Imagem” (vai pra galeria) ou escolha um app pra postar.'
    : 'A imagem vai para a pasta de downloads.';

  const backdrop = doc.createElement('div');
  backdrop.className = 'xport-backdrop';
  backdrop.innerHTML =
    `<div class="xport-card" role="dialog" aria-modal="true">
      <div class="xport-head">
        <div>
          <div class="xport-title">${esc(opts.title || (multi ? 'Carrossel pronto' : 'Cartaz pronto'))}</div>
          ${opts.subtitle ? `<div class="xport-sub">${esc(opts.subtitle)}</div>` : ''}
        </div>
        <button class="xport-close" aria-label="Fechar" type="button">&times;</button>
      </div>
      <div class="xport-preview${multi ? ' multi' : ''}">
        ${urls.map((u, i) => `<img src="${u}" alt="Prévia ${i + 1}" draggable="false" />`).join('')}
      </div>
      <div class="xport-actions"><button class="xport-save" type="button">${esc(primaryLabel)}</button></div>
      <div class="xport-hint">${esc(hint)}</div>
    </div>`;

  let closed = false;
  const cleanup = () => {
    if (closed) return; closed = true;
    urls.forEach((u) => { try { if (u) urlApi.revokeObjectURL(u); } catch (_) { /* */ } });
    if (doc.removeEventListener) doc.removeEventListener('keydown', onKey);
    if (backdrop.remove) backdrop.remove();
  };
  const onKey = (e) => { if (e.key === 'Escape') cleanup(); };

  const closeBtn = backdrop.querySelector('.xport-close');
  if (closeBtn) closeBtn.onclick = cleanup;
  backdrop.onclick = (e) => { if (e.target === backdrop) cleanup(); };
  if (doc.addEventListener) doc.addEventListener('keydown', onKey);

  const saveBtn = backdrop.querySelector('.xport-save');
  if (saveBtn) saveBtn.onclick = async () => {
    if (!save) { cleanup(); return; }
    saveBtn.disabled = true;
    const prev = saveBtn.textContent;
    saveBtn.textContent = 'Preparando…';
    try {
      const how = await save(list, opts.title || 'Exportação');
      if (how === 'canceled') { saveBtn.disabled = false; saveBtn.textContent = prev; return; } // deixa tentar de novo
      notify(how === 'downloaded' ? 'Baixado.' : 'Pronto!', 'success');
      cleanup();
    } catch (err) {
      saveBtn.disabled = false; saveBtn.textContent = prev;
      notify('Não foi possível salvar: ' + ((err && err.message) || err), 'error');
    }
  };

  if (doc.body && doc.body.appendChild) doc.body.appendChild(backdrop);
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => backdrop.classList.add('open'));
  else backdrop.classList.add('open');
  return backdrop;
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
