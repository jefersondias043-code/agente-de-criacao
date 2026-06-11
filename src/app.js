'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

// ---------- Navegação ----------
const NAV_ITEMS = [
  { id: 'welcome',   label: 'Início',      icon: '<path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/>' },
  { id: 'generate',  label: 'Gerar',       icon: '<path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>' },
  { id: 'extract',   label: 'Extrair',     icon: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/>' },
  { id: 'posters',   label: 'Cartazes',    icon: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>' },
  { id: 'downloads', label: 'Downloads',   icon: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/>' },
  { id: 'detector',  label: 'Detector Flop', icon: '<circle cx="11" cy="11" r="7"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>' },
  { id: 'autopost',  label: 'AutoPost IA', icon: '<path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/>' },
  { id: 'replicador', label: 'Replicador', icon: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>' },
  { id: 'settings',  label: 'Configurações', icon: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>' },
];

function renderNav() {
  $('#nav').innerHTML = NAV_ITEMS.map(i => `
    <div class="nav-item ${State.currentView === i.id ? 'active' : ''}" data-view="${i.id}" role="button" tabindex="0" aria-label="${i.label}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${i.icon}</svg>
      ${i.label}
    </div>
  `).join('');
  $$('.nav-item').forEach(el => {
    el.onclick = () => goTo(el.dataset.view);
    el.onkeydown = (e) => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goTo(el.dataset.view); }
    };
  });
}

function goTo(viewId) {
  // Fecha qualquer drawer de histórico aberto (são position:fixed; não podem
  // ficar flutuando ao trocar de ferramenta — ex.: "Criar cartaz" leva aos Cartazes).
  ['g-history-drawer', 'p-history-drawer'].forEach(id => { const d = $(`#${id}`); if (d) d.classList.remove('open'); });
  ['g-history-backdrop', 'p-history-backdrop'].forEach(id => { const b = $(`#${id}`); if (b) b.classList.add('hidden'); });
  State.currentView = viewId;
  $$('.view').forEach(v => v.classList.remove('active'));
  const target = $(`#view-${viewId}`);
  if (target) target.classList.add('active');
  $$('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === viewId);
  });
  // Re-render conforme a página
  if (viewId === 'generate') renderGenerate();
  if (viewId === 'extract') renderExtract();
  if (viewId === 'posters') renderPosters();
  if (viewId === 'downloads') renderDownloads();
  if (viewId === 'detector') renderDetector();
  if (viewId === 'autopost') renderAutopost();
  if (viewId === 'replicador') renderReplicador();
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
syncGroqKey();
syncGroqModel();
renderNav();
goTo('welcome');

// Reidrata as imagens dos cartazes/carrosséis do IndexedDB (assíncrono; a view
// inicial é a 'welcome', então há tempo de sobra antes de Cartazes).
if (typeof hydratePosters === 'function') { hydratePosters(); }

console.log('%c Agente de Postagem ', 'background: #16140f; color: #b8341c; font-size: 14px; font-weight: bold; padding: 4px 8px;', 'pronto.');

