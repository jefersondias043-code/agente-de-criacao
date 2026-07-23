'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

// ---------- Navegação ----------
const NAV_ITEMS = [
  { id: 'welcome',   label: 'Início',      icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { id: 'generate',  label: 'Gerar',       icon: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>' },
  { id: 'extract',   label: 'Extrair',     icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  { id: 'posters',   label: 'Cartazes',    icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
  { id: 'detector',  label: 'Detector Flop', icon: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
  { id: 'autopost',  label: 'AutoPost IA', icon: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>' },
  { id: 'replicador', label: 'Replicador', icon: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' },
  { id: 'removedor', label: 'Removedor de Fundo', icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><path d="M3 3l18 18"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 8 18"/>' },
  { id: 'settings',  label: 'Configurações', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
];

// Shell mobile (≤880px): barra inferior com TODOS os apps, acessíveis direto.
// Se não couberem, a barra ROLA na horizontal (sem botão "Mais"/sheet). No
// desktop, o trilho lateral mostra tudo.
// Cria (uma vez) a tab bar mobile. Elementos com [data-view] recebem .nav-item —
// assim o goTo() sincroniza o estado ativo em todos os shells.
function renderMobileNav() {
  if ($('#m-tabbar')) return;
  const item = (i) => `
    <div class="nav-item" data-view="${i.id}" role="button" tabindex="0" aria-label="${i.label}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i.icon}</svg>
      ${i.label}
    </div>`;
  const bar = document.createElement('nav');
  bar.id = 'm-tabbar';
  bar.className = 'm-tabbar';
  bar.setAttribute('aria-label', 'Navegação principal');
  bar.innerHTML = NAV_ITEMS.map(item).join('');
  document.body.appendChild(bar);
}

// Rola a barra inferior pra deixar o app ATIVO visível (quando ela transborda).
function scrollMobileNavToActive() {
  const bar = $('#m-tabbar');
  if (!bar) return;
  const act = bar.querySelector('.nav-item.active');
  if (act && act.scrollIntoView) {
    try { act.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (_) { /* */ }
  }
}

function renderNav() {
  $('#nav').innerHTML = NAV_ITEMS.map(i => `
    <div class="nav-item ${State.currentView === i.id ? 'active' : ''}" data-view="${i.id}" role="button" tabindex="0" aria-label="${i.label}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i.icon}</svg>
      ${i.label}
    </div>
  `).join('');
  renderMobileNav();
  $$('.nav-item[data-view]').forEach(el => {
    el.onclick = () => goTo(el.dataset.view);
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(el.dataset.view); }
    };
  });
}

// ---------- Home (Início) — rail de "Continuar de onde parou" ----------
// Read-only sobre o State; some se não houver trabalho recente. Preserva os
// [data-go] estáticos (handler global). Aditivo — não altera nenhuma lógica.
function renderHome() {
  const rail = $('#home-recent'); const wrap = $('#home-recent-wrap');
  if (!rail || !wrap) return;
  const items = [];
  try {
    (State.generations || []).forEach(g => items.push({
      kind: 'gen', label: 'Matéria', id: g.id, ts: +new Date(g.createdAt || 0),
      title: String(g.content || 'Matéria').replace(/\s+/g, ' ').trim().slice(0, 80), img: null,
    }));
  } catch (_) {}
  try {
    (State.extractions || []).forEach(e => items.push({
      kind: 'ext', label: 'Extração', id: e.id, ts: +new Date(e.createdAt || 0),
      title: e.title || (e.files && e.files[0] && e.files[0].name) || 'Extração', img: null,
    }));
  } catch (_) {}
  try {
    (State.posters || []).forEach(p => items.push({
      kind: 'pos', label: (p.slides && p.slides.length) ? 'Carrossel' : 'Cartaz', id: p.id,
      ts: +new Date(p.updatedAt || p.createdAt || 0), title: p.headline || 'Cartaz',
      img: (typeof p.image1 === 'string' && p.image1.slice(0, 5) === 'data:') ? p.image1 : null,
    }));
  } catch (_) {}
  items.sort((a, b) => b.ts - a.ts);
  const top = items.slice(0, 10);
  if (!top.length) { wrap.classList.add('hidden'); return; }
  wrap.classList.remove('hidden');
  const icon = {
    gen: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9.9 15.5A2 2 0 0 0 8.5 14L2.4 12.5a.5.5 0 0 1 0-1L8.5 10A2 2 0 0 0 9.9 8.5L11.5 2.4a.5.5 0 0 1 1 0L14 8.5A2 2 0 0 0 15.5 10l6.1 1.5a.5.5 0 0 1 0 1L15.5 14a2 2 0 0 0-1.4 1.4l-1.6 6.1a.5.5 0 0 1-1 0z"/></svg>',
    ext: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>',
    pos: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>',
  };
  rail.innerHTML = top.map(it => `
    <div class="recent-card" data-kind="${it.kind}" data-id="${escapeHtml(it.id)}" role="button" tabindex="0">
      <div class="recent-thumb">${it.img ? `<img src="${escapeHtml(it.img)}" alt="">` : (icon[it.kind] || '')}</div>
      <div class="recent-kind">${it.label}</div>
      <div class="recent-title">${escapeHtml(it.title)}</div>
      <div class="recent-time">${it.ts ? formatDate(new Date(it.ts).toISOString()) : ''}</div>
    </div>`).join('');
  rail.querySelectorAll('.recent-card').forEach(el => {
    const open = () => openRecent(el.dataset.kind, el.dataset.id);
    el.onclick = open;
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } };
  });
}

function openRecent(kind, id) {
  if (kind === 'gen') {
    const g = (State.generations || []).find(x => x.id === id);
    goTo('generate');
    if (g && typeof renderGenerationResult === 'function') renderGenerationResult(g);
  } else if (kind === 'ext') {
    State.activeExtractionId = id;
    goTo('extract');
    if (typeof renderExtractionDetail === 'function') renderExtractionDetail();
    if (typeof setMtab === 'function') setMtab('#view-extract', 'b');
  } else if (kind === 'pos') {
    if (typeof openPosterEditor === 'function') openPosterEditor(id);
    else { State.activePosterId = id; goTo('posters'); }
  }
}

function goTo(viewId) {
  // Fecha qualquer drawer de histórico aberto (são position:fixed; não podem
  // ficar flutuando ao trocar de ferramenta — ex.: "Criar cartaz" leva aos Cartazes).
  ['g-history-drawer', 'p-history-drawer'].forEach(id => { const d = $(`#${id}`); if (d) d.classList.remove('open'); });
  ['g-history-backdrop', 'p-history-backdrop'].forEach(id => { const b = $(`#${id}`); if (b) b.classList.add('hidden'); });
  // Sai do modo focado do editor de cartazes ao navegar; renderPosters()
  // reativa quando a view de destino é 'posters' com editor aberto.
  document.body.classList.remove('pe-full');
  State.currentView = viewId;
  $$('.view').forEach(v => v.classList.remove('active'));
  const target = $(`#view-${viewId}`);
  if (target) target.classList.add('active');
  $$('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewId);
  });
  scrollMobileNavToActive();   // mantém o app ativo à vista na barra que rola
  // Re-render conforme a página
  if (viewId === 'welcome' && typeof renderHome === 'function') renderHome();
  if (viewId === 'generate') renderGenerate();
  if (viewId === 'extract') renderExtract();
  if (viewId === 'posters') renderPosters();
  if (viewId === 'detector') renderDetector();
  if (viewId === 'autopost') renderAutopost();
  if (viewId === 'replicador') renderReplicador();
  if (viewId === 'removedor') renderRemovedor();
  if (viewId === 'settings') renderSettings();
  // Rola o container .main (única fonte de scroll vertical) para o topo
  const main = document.querySelector('.main');
  if (main) main.scrollTo({ top: 0, behavior: 'auto' });
}

document.addEventListener('click', (e) => {
  const goEl = e.target.closest('[data-go]');
  if (goEl) {
    e.preventDefault();
    goTo(goEl.dataset.go);
  }
});

// Atalhos de teclado: ativar [data-go] com Enter/Space; Ctrl/Cmd+Enter dispara CTAs
document.addEventListener('keydown', (e) => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('[data-go][role="button"]')) {
    e.preventDefault();
    goTo(e.target.dataset.go);
    return;
  }
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
    if (State.currentView === 'generate') {
      const b = $('#g-submit'); if (b && !b.disabled) { e.preventDefault(); b.click(); }
    } else if (State.currentView === 'extract') {
      const b = $('#e-submit'); if (b && !b.disabled) { e.preventDefault(); b.click(); }
    }
  }
});
// ---------- Verificação de integridade do boot ----------
// Os módulos são scripts globais carregados em ordem (index.html). Se algum
// falhar/faltar, antes a app quebrava em SILÊNCIO (função undefined). Aqui
// detectamos cedo e mostramos um erro claro em vez de uma tela quebrada.
(function assertBootIntegrity() {
  var missing = [];
  if (typeof State === 'undefined') missing.push('State');
  ['goTo', 'renderNav', 'renderGenerate', 'renderExtract', 'renderPosters',
   'renderSettings', 'callLLM', 'runContentPipeline', 'syncGroqKey', 'hydratePosters'].forEach(function (n) {
    if (typeof window[n] !== 'function') missing.push(n);
  });
  if (missing.length) {
    try {
      document.body.innerHTML =
        '<div style="max-width:640px;margin:15vh auto;padding:2rem;font-family:system-ui,sans-serif;text-align:center;color:#16140f;">' +
        '<h1 style="font-size:1.25rem;">Não foi possível iniciar</h1>' +
        '<p style="color:#6b6b6b;">Alguns módulos não carregaram: <code>' + missing.join(', ') + '</code>.</p>' +
        '<p style="color:#6b6b6b;">Recarregue com <b>Ctrl+F5</b>. Se persistir, limpe o cache do navegador.</p>' +
        '</div>';
    } catch (_) { /* */ }
    throw new Error('Boot abortado — módulos ausentes: ' + missing.join(', '));
  }
})();

syncGroqKey();
syncGroqModel();
renderNav();
goTo('welcome');

// Reidrata as imagens dos cartazes/carrosséis do IndexedDB (assíncrono; a view
// inicial é a 'welcome', então há tempo de sobra antes de Cartazes).
if (typeof hydratePosters === 'function') { hydratePosters(); }

// Carrega os históricos de matérias/extrações do IndexedDB (arquitetura escalável
// — limite = capacidade do dispositivo). Migra do localStorage antigo na 1ª vez.
// Render síncrono usa o array em memória; as views de histórico não são a inicial.
if (typeof hydrateHistories === 'function') { hydrateHistories(); }

console.log('%c Agente de Postagem ', 'background: #16140f; color: #b8341c; font-size: 14px; font-weight: bold; padding: 4px 8px;', 'pronto.');

