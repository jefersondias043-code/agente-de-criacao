'use strict';
/* ============================================================
   EDITOR VISUAL — CAMADA DE ELEMENTOS LIVRES (fundação)
   Elementos independentes (formas, badges, divisores) sobre QUALQUER modelo —
   mais liberdade criativa SEM criar novos modelos. Cada elemento pode ser
   movido, redimensionado, colorido, reordenado (camadas), bloqueado, ocultado e
   duplicado. Coordenadas em % → independem da escala (preview e export 1×/2×).
   DOM sólido (cores/bordas/raio, sem rotação) → o html2canvas exporta fiel
   (preview ≡ PNG). Os elementos vivem em `target.elements[]` (cartaz ou slide).
   ============================================================ */

const POSTER_ELEMENT_SHAPES = [
  { kind: 'rect',    label: 'Retângulo', svg: '<rect x="3" y="6" width="18" height="12" rx="1"/>' },
  { kind: 'circle',  label: 'Círculo',   svg: '<circle cx="12" cy="12" r="8"/>' },
  { kind: 'line',    label: 'Linha',     svg: '<line x1="3" y1="12" x2="21" y2="12"/>' },
  { kind: 'divider', label: 'Divisor',   svg: '<line x1="3" y1="9" x2="21" y2="9"/><line x1="3" y1="15" x2="14" y2="15"/>' },
];

// Badges prontos (comunicação rápida). bg/fg/border + ponto "ao vivo" opcional.
const POSTER_BADGE_PRESETS = [
  { text: 'URGENTE',      bg: '#E30613', fg: '#FFFFFF' },
  { text: 'ÚLTIMA HORA',  bg: '#0B1421', fg: '#FF7A00' },
  { text: 'AO VIVO',      bg: '#E30613', fg: '#FFFFFF', dot: true },
  { text: 'BREAKING NEWS', bg: '#111111', fg: '#FFFFFF' },
  { text: 'EXCLUSIVO',    bg: '#FF7A00', fg: '#16140F' },
  { text: 'ATUALIZAÇÃO',  bg: '#152133', fg: '#FFFFFF' },
  { text: 'OPINIÃO',      bg: '#FFFFFF', fg: '#16140F', border: '#16140F' },
  { text: 'ENTREVISTA',   bg: '#3A6EA5', fg: '#FFFFFF' },
  { text: 'ESPECIAL',     bg: '#6A0D14', fg: '#FFD700' },
];

let _peSelected = null;   // id do elemento selecionado no editor
let _peSafeArea = false;  // overlay de área segura (editor; nunca no export)
let _peAddTab = 'shapes'; // categoria de inserção na barra: shapes | badges | icons (r114)
let _peFocusProps = false; // rolar até "Ajustar" após adicionar/selecionar

/* Presets de canto (raio) para caixas/formas — "reto" a "pílula". */
const POSTER_CORNER_PRESETS = [
  { label: 'Reto', r: 0 }, { label: 'Suave', r: 2 }, { label: 'Médio', r: 5 },
  { label: 'Arredondado', r: 9 }, { label: 'Pílula', r: 50 },
];

/** Degradê CSS a partir de {from,to,angle}. Reusa _gradCss (poster-templates) se houver. */
function _peGrad(g) {
  g = g || {};
  if (typeof _gradCss === 'function' && g.from && g.to) return _gradCss(g);
  return `linear-gradient(${g.angle == null ? 135 : g.angle}deg, ${g.from || '#E30613'} 0%, ${g.to || '#6A0D14'} 100%)`;
}
/** Raio em px do nó (círculo = 50%; ≥50 = pílula). */
function _peRadiusCss(el) {
  if (el.type === 'circle') return '50%';
  const r = el.radius || 0;
  return r >= 50 ? '9999px' : (r * 4) + 'px';
}
/** Borda do nó (respeitando cor/estilo/espessura). '' = sem borda. */
function _peBorderCss(el, posterH) {
  if (!el.border) return '';
  const w = Math.max(1, Math.round(posterH * 0.004 * (el.borderW || 1)));
  const style = el.borderStyle || 'solid';
  return `border:${w}px ${style} ${el.border};`;
}

/** Overlay de ÁREA SEGURA (margem + centro) — guia de composição p/ redes
 *  sociais; só no editor (escondido no export via .poster-1440.exporting). */
function drawSafeArea(root) {
  const old = root.querySelector('.pe-safe'); if (old) old.remove();
  if (!_peSafeArea) return;
  const m = document.createElement('div');
  m.className = 'pe-safe';
  m.style.cssText = 'position:absolute;inset:0;z-index:65;pointer-events:none;';
  m.innerHTML =
    '<div style="position:absolute;left:6%;top:6%;right:6%;bottom:6%;border:2px dashed rgba(20,184,166,.75);border-radius:6px;"></div>' +
    '<div style="position:absolute;left:50%;top:0;bottom:0;width:0;border-left:2px dotted rgba(20,184,166,.45);"></div>' +
    '<div style="position:absolute;top:50%;left:0;right:0;height:0;border-top:2px dotted rgba(20,184,166,.45);"></div>' +
    '<div style="position:absolute;left:6%;top:6%;transform:translateY(-115%);font:700 26px \'IBM Plex Mono\',monospace;color:#0d9488;">área segura</div>';
  root.appendChild(m);
}

/* Biblioteca de ÍCONES por categoria (line-icons simples → exportam no html2canvas). */
const POSTER_ICON_LIBRARY = {
  'Geral': {
    estrela: '<polygon points="12 2 15 9 22 9 16.5 14 18.5 21 12 17 5.5 21 7.5 14 2 9 9 9"/>',
    local: '<path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    calendario: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    relogio: '<circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15.5 14"/>',
    alerta: '<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>',
    check: '<circle cx="12" cy="12" r="9"/><polyline points="8 12 11 15 16 9"/>',
  },
  'Política': { instituicao: '<line x1="3" y1="22" x2="21" y2="22"/><line x1="6" y1="18" x2="6" y2="11"/><line x1="10" y1="18" x2="10" y2="11"/><line x1="14" y1="18" x2="14" y2="11"/><line x1="18" y1="18" x2="18" y2="11"/><polygon points="12 2 20 7 4 7"/>', balanca: '<line x1="12" y1="3" x2="12" y2="21"/><path d="M5 7h14"/><path d="M5 7l-3 6a3 3 0 0 0 6 0z"/><path d="M19 7l-3 6a3 3 0 0 0 6 0z"/>' },
  'Segurança': { escudo: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>', sirene: '<path d="M5 11a7 7 0 0 1 14 0v6H5z"/><line x1="3" y1="21" x2="21" y2="21"/>' },
  'Economia': { cifra: '<line x1="12" y1="2" x2="12" y2="22"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>', alta: '<polyline points="3 17 9 11 13 15 21 7"/><polyline points="15 7 21 7 21 13"/>' },
  'Saúde': { coracao: '<path d="M20.8 5.6a5.5 5.5 0 0 0-7.8 0L12 6.6l-1-1a5.5 5.5 0 1 0-7.8 7.8L12 22l8.8-8.6a5.5 5.5 0 0 0 0-7.8z"/>', cruz: '<path d="M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"/>' },
  'Educação': { formatura: '<path d="M2 8l10-4 10 4-10 4z"/><path d="M6 10v6c0 1 2.7 3 6 3s6-2 6-3v-6"/>', livro: '<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/>' },
  'Esportes': { trofeu: '<path d="M8 21h8"/><path d="M12 17v4"/><path d="M7 4h10v5a5 5 0 0 1-10 0z"/><path d="M7 6H4v1a3 3 0 0 0 3 3"/><path d="M17 6h3v1a3 3 0 0 1-3 3"/>', bola: '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18"/>' },
  'Tecnologia': { chip: '<rect x="6" y="6" width="12" height="12" rx="1"/><path d="M9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>', wifi: '<path d="M5 12a10 10 0 0 1 14 0"/><path d="M8.5 15.5a5 5 0 0 1 7 0"/><line x1="12" y1="19" x2="12.01" y2="19"/>' },
};

/* ---------- Modelo ---------- */
function posterElements(t) { if (t && !Array.isArray(t.elements)) t.elements = []; return (t && t.elements) || []; }

function makePosterElement(kind, opts) {
  opts = opts || {};
  const el = {
    id: uuid(), type: kind, x: 30, y: 42, w: 40, h: 14, rotation: 0, opacity: 1,
    color: '#E30613', color2: '#FFFFFF', radius: 0, border: '', borderStyle: 'solid', borderW: 1,
    fillType: 'solid', grad: { from: '#E30613', to: '#6A0D14', angle: 135 },   // preenchimento (r113)
    locked: false, hidden: false,
  };
  if (kind === 'circle') { el.w = 20; el.h = 20; el.radius = 50; }
  else if (kind === 'line') { el.h = 0.8; el.w = 50; el.color = '#16140F'; }
  else if (kind === 'divider') { el.h = 0.8; el.w = 36; el.color = '#E30613'; }
  else if (kind === 'rect') { el.radius = 2; }
  else if (kind === 'icon') {
    el.w = 12; el.h = 12; el.color = '#E30613';
    el.svg = opts.svg || POSTER_ICON_LIBRARY.Geral.estrela;
  } else if (kind === 'text') {
    el.w = 50; el.h = 10; el.color = '#16140F';
    el.text = opts.text || 'Texto livre';
    el.align = 'left'; el.weight = 700; el.spacing = 0; el.lineHeight = 1.1;
    el.shadow = false; el.shadowColor = '#000000';
    // Cor das LETRAS (fillType/grad) + CAIXA de texto (fundo próprio) — r113
    el.textFill = 'solid';
    el.boxFill = 'none';                       // none | solid | gradient
    el.boxColor = '#0B1421';
    el.boxGrad = { from: '#0B1421', to: '#152133', angle: 135 };
    el.radius = 6;                             // cantos da caixa (quando houver fundo)
  } else if (kind === 'badge') {
    el.w = 28; el.h = 7; el.radius = 8;
    el.text = opts.text || 'URGENTE';
    el.color = opts.bg || '#E30613';
    el.color2 = opts.fg || '#FFFFFF';
    el.border = opts.border || '';
    el.dot = !!opts.dot;
  }
  return el;
}

function peTarget() {
  const p = State.posters.find((x) => x.id === State.activePosterId);
  if (!p) return null;
  return (typeof getSlide === 'function') ? getSlide(p) : p;
}
function pePersist() {
  const p = State.posters.find((x) => x.id === State.activePosterId);
  if (p) p.updatedAt = new Date().toISOString();
  if (typeof savePosters === 'function') savePosters();
}

function addPosterElement(kind, opts) {
  const t = peTarget(); if (!t) return;
  const el = makePosterElement(kind, opts);
  if (typeof nextOverlayZ === 'function') el.z = nextOverlayZ(t);   // topo da hierarquia unificada
  posterElements(t).push(el);
  _peSelected = el.id;
  _peFocusProps = true;   // adicionar rola até "Ajustar" (r114)
  pePersist();
  peRefresh();
}
/** Elemento selecionado (ou null). */
function _peSel() { const t = peTarget(); return t && posterElements(t).find((e) => e.id === _peSelected); }
/** Elemento por id (ou null). */
function _peSel2(id) { const t = peTarget(); return t && posterElements(t).find((e) => e.id === id); }
function duplicatePosterElement(id) {
  const t = peTarget(); if (!t) return;
  const els = posterElements(t); const i = els.findIndex((e) => e.id === id);
  if (i < 0) return;
  const copy = Object.assign({}, els[i], { id: uuid(), x: Math.min(88, (els[i].x || 0) + 4), y: Math.min(88, (els[i].y || 0) + 4) });
  els.splice(i + 1, 0, copy);
  _peSelected = copy.id;
  pePersist(); peRefresh();
}
function deletePosterElement(id) {
  const t = peTarget(); if (!t) return;
  const els = posterElements(t); const i = els.findIndex((e) => e.id === id);
  if (i >= 0) els.splice(i, 1);
  if (_peSelected === id) _peSelected = null;
  pePersist(); peRefresh();
}
function reorderPosterElement(id, dir) {
  const t = peTarget(); if (!t) return;
  const els = posterElements(t); const i = els.findIndex((e) => e.id === id);
  if (i < 0) return;
  const [el] = els.splice(i, 1);
  if (dir === 'front') els.push(el);
  else if (dir === 'back') els.unshift(el);
  else if (dir === 'up') els.splice(Math.min(els.length, i + 1), 0, el);
  else if (dir === 'down') els.splice(Math.max(0, i - 1), 0, el);
  else els.splice(i, 0, el);
  pePersist(); peRefresh();
}
function updatePosterElement(id, patch) {
  const t = peTarget(); if (!t) return;
  const el = posterElements(t).find((e) => e.id === id);
  if (!el) return;
  Object.assign(el, patch);
  pePersist(); peRefresh();
}

/* ---------- Render do overlay — delega ao render UNIFICADO (r116) ----------
   Mantido por compatibilidade; renderPosterOverlays (posters.js) pinta elementos
   + avatar + camadas numa única hierarquia de z-order. */
function renderPosterElements(p, fmt) {
  if (typeof renderPosterOverlays === 'function') renderPosterOverlays(p, fmt);
}

function buildElementNode(el, posterH) {
  const d = document.createElement('div');
  d.className = 'pe-el';
  d.dataset.id = el.id;
  const rot = el.rotation ? `transform:rotate(${el.rotation}deg);` : '';
  const pos = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;opacity:${el.opacity};box-sizing:border-box;${rot}`;
  const radiusPx = _peRadiusCss(el);
  const borderCss = _peBorderCss(el, posterH);
  const fillCss = (el.fillType === 'gradient') ? _peGrad(el.grad) : el.color;   // formas/badge

  if (el.type === 'badge') {
    const fs = Math.round((el.h / 100) * posterH * 0.52);
    d.style.cssText = pos + `background:${fillCss};color:${el.color2};display:flex;align-items:center;justify-content:center;gap:0.45em;border-radius:${radiusPx};` +
      `font-family:'Poppins',system-ui,sans-serif;font-weight:800;letter-spacing:0.04em;text-transform:uppercase;font-size:${fs}px;line-height:1;padding:0 0.7em;white-space:nowrap;overflow:hidden;` + borderCss;
    if (el.dot) {
      const dot = document.createElement('span');
      dot.style.cssText = `width:0.55em;height:0.55em;border-radius:50%;background:${el.color2};flex:0 0 auto;`;
      d.appendChild(dot);
    }
    d.appendChild(document.createTextNode(el.text || ''));
  } else if (el.type === 'icon') {
    d.style.cssText = pos;
    d.innerHTML = `<svg viewBox="0 0 24 24" width="100%" height="100%" fill="none" stroke="${el.color}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${el.svg || ''}</svg>`;
  } else if (el.type === 'text') {
    const fs = Math.round((el.h / 100) * posterH * 0.7);
    // Caixa de texto (fundo próprio: nenhum/cor/degradê) + cantos + borda.
    let boxBg = '';
    if (el.boxFill === 'solid') boxBg = `background:${el.boxColor || '#0B1421'};`;
    else if (el.boxFill === 'gradient') boxBg = `background:${_peGrad(el.boxGrad)};`;
    const hasBox = !!boxBg;
    const boxCss = hasBox ? `${boxBg}border-radius:${radiusPx};padding:0.35em 0.65em;${borderCss}` : (el.border ? borderCss + `border-radius:${radiusPx};` : '');
    d.style.cssText = pos + `display:flex;align-items:center;overflow:hidden;` +
      `justify-content:${el.align === 'center' ? 'center' : el.align === 'right' ? 'flex-end' : 'flex-start'};${boxCss}`;
    // LETRAS num span próprio (permite degradê nas letras sem afetar a caixa).
    const span = document.createElement('span');
    const sh = el.shadow ? `text-shadow:${Math.round(posterH * 0.004)}px ${Math.round(posterH * 0.004)}px ${Math.round(posterH * 0.006)}px ${el.shadowColor || '#000'};` : '';
    let letterCss = `display:block;max-width:100%;font-family:'Poppins',system-ui,sans-serif;font-weight:${el.weight || 700};font-size:${fs}px;` +
      `text-align:${el.align || 'left'};letter-spacing:${(el.spacing || 0) * 0.01}em;line-height:${el.lineHeight || 1.1};white-space:pre-wrap;${sh}`;
    if (el.textFill === 'gradient') {
      letterCss += `background-image:${_peGrad(el.grad)};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent;color:transparent;`;
    } else {
      letterCss += `color:${el.color};`;
    }
    span.style.cssText = letterCss;
    span.textContent = el.text || '';
    d.appendChild(span);
  } else {
    // rect / line / divider / circle
    d.style.cssText = pos + `background:${fillCss};border-radius:${radiusPx};` + borderCss;
  }
  return d;
}

/** A seleção `_peSelected` pode apontar p/ um ELEMENTO, o AVATAR ('__avatar') ou
 *  uma CAMADA (id). Valida contra todos os overlays do alvo. */
function _peIsValidSelection(t, id) {
  if (!id || !t) return false;
  if (id === '__avatar') return !!t.avatar;
  if (Array.isArray(t.elements) && t.elements.some((e) => e.id === id)) return true;
  if (Array.isArray(t.layers) && t.layers.some((l) => l.id === id)) return true;
  return false;
}

/** Aplica o estado de seleção ao DOM: caixa dos ELEMENTOS + classe `pe-ov-sel`
 *  nos overlays avatar/camada (que mostram/escondem seu chrome via CSS). */
function _peApplySelection() {
  const stage = $('#p-stage');
  const root = stage && stage.querySelector('.poster-1440');
  if (!root) return;
  drawSelection(root, peTarget());   // caixa do elemento selecionado (ou remove)
  root.querySelectorAll('[data-pt="avatar-overlay"], [data-pt="layer"]').forEach((box) => {
    const id = box.dataset.lid || (box.getAttribute('data-pt') === 'avatar-overlay' ? '__avatar' : null);
    box.classList.toggle('pe-ov-sel', id != null && id === _peSelected);
  });
  if (typeof syncLayerListSelection === 'function') syncLayerListSelection();
}

/** Seleciona um overlay (elemento/avatar/camada) SEM re-render pesado — atualiza só
 *  o DOM da seleção e o painel (destaque na lista de camadas). */
function _peSelectOverlay(id) {
  _peSelected = id;
  _peApplySelection();
  if (typeof renderPosterElementsPanel === 'function') renderPosterElementsPanel();
}

/** Duplo-clique: abre a ferramenta de edição do objeto (troca a aba do editor). */
function _peOpenEditorFor(kind, id) {
  _peSelected = id;
  const group = (kind === 'element') ? 'elements' : 'images';
  const tab = document.querySelector(`#p-edit-tabs .pedit-tab[data-pgroup="${group}"]`);
  if (tab) tab.click();
  if (kind === 'element') _peFocusProps = true;
  if (typeof renderPosterElementsPanel === 'function') renderPosterElementsPanel();
  _peApplySelection();
}

/* ---------- Edição (interações: selecionar, arrastar, redimensionar) ---------- */
// Chamado após CADA render (renderPosterOverlays) — reata as interações dos
// elementos e (re)desenha a seleção. Assim os objetos ficam editáveis em QUALQUER
// aba. NÃO desenha nada visível no export (as classes some via .exporting).
function setupPosterElementEditing() {
  const stage = $('#p-stage');
  const root = stage && stage.querySelector('.poster-1440');
  if (!root) return;
  const t = peTarget();

  // Valida a seleção contra TODOS os overlays (elemento/avatar/camada).
  if (_peSelected && !_peIsValidSelection(t, _peSelected)) _peSelected = null;

  // Reata mover nos elementos livres (nós diretos do root, sem wrapper .pe-layer).
  root.querySelectorAll('.pe-el').forEach((node) => {
    const el = t && posterElements(t).find((e) => e.id === node.dataset.id);
    if (!el) return;
    node.style.pointerEvents = el.locked ? 'none' : 'auto';
    node.style.cursor = 'move';
    node.onpointerdown = (ev) => startMove(ev, root, el, node);
    node.ondblclick = (ev) => { ev.stopPropagation(); _peOpenEditorFor('element', el.id); };
  });

  // Clicar em ÁREA VAZIA do cartaz deseleciona (some os controles). Anexado 1× por
  // root (o root é recriado a cada render do template → o flag reinicia sozinho).
  if (!root._peDeselectWired) {
    root._peDeselectWired = true;
    root.addEventListener('pointerdown', (ev) => {
      if (ev.target.closest('.pe-el') || ev.target.closest('[data-pt="avatar-overlay"]') ||
          ev.target.closest('[data-pt="layer"]') || ev.target.closest('.pe-ui-layer') ||
          ev.target.closest('.pe-del-badge') || ev.target.closest('.pe-layer-handle')) return;
      if (_peSelected) { _peSelected = null; _peApplySelection(); if (typeof renderPosterElementsPanel === 'function') renderPosterElementsPanel(); }
    });
  }

  _peApplySelection();   // caixa do elemento + classes dos overlays
  drawSafeArea(root);
}

function drawSelection(root, t) {
  const oldUi = root.querySelector('.pe-ui-layer'); if (oldUi) oldUi.remove();
  if (!_peSelected) return;
  const el = t && posterElements(t).find((e) => e.id === _peSelected);
  if (!el || el.hidden) return;

  const ui = document.createElement('div');
  ui.className = 'pe-ui-layer';
  ui.style.cssText = 'position:absolute;inset:0;z-index:70;pointer-events:none;';

  // Caixa de seleção que GIRA junto com o elemento (handles e alça de rotação
  // são filhos → acompanham a rotação automaticamente).
  const box = document.createElement('div');
  box.className = 'pe-sel';
  box.style.cssText = `position:absolute;left:${el.x}%;top:${el.y}%;width:${el.w}%;height:${el.h}%;` +
    `${el.rotation ? `transform:rotate(${el.rotation}deg);` : ''}outline:2px dashed var(--accent,#E30613);outline-offset:1px;pointer-events:none;`;

  if (!el.locked) {
    [['nw', 0, 0], ['ne', 1, 0], ['sw', 0, 1], ['se', 1, 1]].forEach(([corner, hx, hy]) => {
      const h = document.createElement('div');
      h.className = 'pe-handle';
      h.style.cssText = `position:absolute;left:calc(${hx * 100}% - 7px);top:calc(${hy * 100}% - 7px);width:14px;height:14px;border-radius:50%;background:#fff;border:2px solid var(--accent,#E30613);pointer-events:auto;cursor:${(hx === hy) ? 'nwse' : 'nesw'}-resize;`;
      h.onpointerdown = (ev) => startResize(ev, root, el, corner);
      box.appendChild(h);
    });
    const rh = document.createElement('div');
    rh.className = 'pe-rotate';
    rh.style.cssText = 'position:absolute;left:calc(50% - 8px);top:-26px;width:16px;height:16px;border-radius:50%;background:#fff;border:2px solid var(--accent,#E30613);pointer-events:auto;cursor:grab;display:flex;align-items:center;justify-content:center;color:var(--accent,#E30613);';
    rh.innerHTML = '<svg viewBox="0 0 24 24" width="10" height="10" fill="none" stroke="currentColor" stroke-width="3"><path d="M21 12a9 9 0 1 1-3-6.7"/><polyline points="21 3 21 9 15 9"/></svg>';
    rh.onpointerdown = (ev) => startRotate(ev, root, el);
    box.appendChild(rh);
  }
  // Botão X VAZADO (excluir) sobre o elemento selecionado — só aparece p/ o
  // selecionado (é filho da caixa de seleção, redesenhada a cada seleção). r116.
  const del = document.createElement('button');
  del.className = 'pe-delbtn';
  del.type = 'button';
  del.setAttribute('aria-label', 'Excluir elemento');
  del.style.cssText = 'position:absolute;right:-18px;top:-46px;width:38px;height:38px;border:none;background:none;pointer-events:auto;cursor:pointer;padding:0;';
  del.innerHTML = '<svg viewBox="0 0 24 24" width="38" height="38" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" style="filter:drop-shadow(0 1px 2px rgba(0,0,0,.9));"><line x1="6" y1="6" x2="18" y2="18"/><line x1="18" y1="6" x2="6" y2="18"/></svg>';
  del.onpointerdown = (ev) => { ev.preventDefault(); ev.stopPropagation(); };
  del.onclick = (ev) => { ev.stopPropagation(); deletePosterElement(el.id); };
  box.appendChild(del);
  ui.appendChild(box);
  root.appendChild(ui);
}

function startRotate(ev, root, el) {
  ev.preventDefault(); ev.stopPropagation();
  const r = root.getBoundingClientRect();
  const cx = r.left + ((el.x + el.w / 2) / 100) * r.width;
  const cy = r.top + ((el.y + el.h / 2) / 100) * r.height;
  const move = (e) => {
    let ang = Math.round(Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI + 90);
    if (ang < 0) ang += 360;
    if (Math.abs(ang % 15) < 4 || Math.abs((ang % 15) - 15) < 4) ang = Math.round(ang / 15) * 15; // snap 15°
    el.rotation = ang % 360;
    const node = root.querySelector(`.pe-el[data-id="${el.id}"]`);
    if (node) node.style.transform = `rotate(${el.rotation}deg)`;
    const box = root.querySelector('.pe-sel');
    if (box) box.style.transform = `rotate(${el.rotation}deg)`;
  };
  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    pePersist();
    if (typeof renderPosterElementsPanel === 'function') renderPosterElementsPanel();
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function clientToPct(ev, root) {
  const r = root.getBoundingClientRect();
  return { x: ((ev.clientX - r.left) / r.width) * 100, y: ((ev.clientY - r.top) / r.height) * 100 };
}
const peClamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// Guias inteligentes: alvos de alinhamento = centro/terços/bordas do cartaz +
// bordas/centro dos OUTROS elementos. Snap quando a aresta cai a < ~1.2%.
const PE_SNAP = 1.2;
function peSnapAxis(val, targets) {
  let best = null, bestD = PE_SNAP;
  for (const t of targets) { const d = Math.abs(val - t); if (d < bestD) { bestD = d; best = t; } }
  return best;
}
function applySnapGuides(root, el, nx, ny) {
  const t = peTarget();
  const others = (t ? posterElements(t) : []).filter((e) => e.id !== el.id && !e.hidden);
  const xT = [0, 33.333, 50, 66.667, 100];
  const yT = [0, 33.333, 50, 66.667, 100];
  others.forEach((o) => { xT.push(o.x, o.x + o.w / 2, o.x + o.w); yT.push(o.y, o.y + o.h / 2, o.y + o.h); });
  const guides = [];
  // X: tenta encaixar esquerda, centro ou direita do elemento
  const exEdges = [['l', nx], ['c', nx + el.w / 2], ['r', nx + el.w]];
  for (const [side, v] of exEdges) {
    const s = peSnapAxis(v, xT);
    if (s != null) { nx = side === 'l' ? s : side === 'c' ? s - el.w / 2 : s - el.w; guides.push(['v', s]); break; }
  }
  const eyEdges = [['t', ny], ['c', ny + el.h / 2], ['b', ny + el.h]];
  for (const [side, v] of eyEdges) {
    const s = peSnapAxis(v, yT);
    if (s != null) { ny = side === 't' ? s : side === 'c' ? s - el.h / 2 : s - el.h; guides.push(['h', s]); break; }
  }
  drawGuides(root, guides);
  return { x: peClamp(nx, 0, Math.max(0, 100 - el.w)), y: peClamp(ny, 0, Math.max(0, 100 - el.h)) };
}
function drawGuides(root, guides) {
  clearGuides(root);
  if (!guides.length) return;
  const layer = document.createElement('div');
  layer.className = 'pe-guides';
  layer.style.cssText = 'position:absolute;inset:0;z-index:80;pointer-events:none;';
  guides.forEach(([dir, at]) => {
    const g = document.createElement('div');
    g.style.cssText = dir === 'v'
      ? `position:absolute;left:${at}%;top:0;bottom:0;width:0;border-left:1px dashed #14b8a6;`
      : `position:absolute;top:${at}%;left:0;right:0;height:0;border-top:1px dashed #14b8a6;`;
    layer.appendChild(g);
  });
  root.appendChild(layer);
}
function clearGuides(root) { const g = root.querySelector('.pe-guides'); if (g) g.remove(); }

function startMove(ev, root, el, node) {
  ev.preventDefault(); ev.stopPropagation();
  _peSelected = el.id;
  // selecionar no canvas mostra "Ajustar" (seção contextual; r114 — sem trocar de barra)
  const start = clientToPct(ev, root);
  const ox = el.x, oy = el.y;
  node.setPointerCapture && node.setPointerCapture(ev.pointerId);
  const move = (e) => {
    const cur = clientToPct(e, root);
    const nx = ox + (cur.x - start.x), ny = oy + (cur.y - start.y);
    const snapped = applySnapGuides(root, el, peClamp(nx, 0, Math.max(0, 100 - el.w)), peClamp(ny, 0, Math.max(0, 100 - el.h)));
    el.x = snapped.x; el.y = snapped.y;
    node.style.left = el.x + '%'; node.style.top = el.y + '%';
    syncSelectionBox(root, el);
  };
  const up = () => {
    node.onpointermove = null; node.onpointerup = null;
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    clearGuides(root);
    pePersist();
    if (typeof renderPosterElementsPanel === 'function') renderPosterElementsPanel();
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

/** Reconstrói o nó do elemento no overlay a partir do objeto (recalcula fonte de
 *  texto/badge, degradês, cantos etc.) e reata os handlers de mover. */
function _peRebuildNode(root, el) {
  const node = root.querySelector(`.pe-el[data-id="${el.id}"]`);
  if (!node) return;
  const fmt = (typeof posterActiveFormat === 'function') ? posterActiveFormat() : { h: 1440 };
  const fresh = buildElementNode(el, fmt.h);
  fresh.style.pointerEvents = el.locked ? 'none' : 'auto';
  fresh.style.cursor = 'move';
  fresh.onpointerdown = (ev) => startMove(ev, root, el, fresh);
  node.replaceWith(fresh);
}

function startResize(ev, root, el, corner) {
  ev.preventDefault(); ev.stopPropagation();
  const start = clientToPct(ev, root);
  const o = { x: el.x, y: el.y, w: el.w, h: el.h };
  const move = (e) => {
    const cur = clientToPct(e, root);
    const dx = cur.x - start.x, dy = cur.y - start.y;
    if (corner === 'se') { el.w = peClamp(o.w + dx, 2, 100 - o.x); el.h = peClamp(o.h + dy, 0.5, 100 - o.y); }
    else if (corner === 'ne') { el.w = peClamp(o.w + dx, 2, 100 - o.x); el.h = peClamp(o.h - dy, 0.5, o.y + o.h); el.y = o.y + o.h - el.h; }
    else if (corner === 'sw') { el.w = peClamp(o.w - dx, 2, o.x + o.w); el.x = o.x + o.w - el.w; el.h = peClamp(o.h + dy, 0.5, 100 - o.y); }
    else if (corner === 'nw') { el.w = peClamp(o.w - dx, 2, o.x + o.w); el.x = o.x + o.w - el.w; el.h = peClamp(o.h - dy, 0.5, o.y + o.h); el.y = o.y + o.h - el.h; }
    // FIX (r115): reconstrói o nó → a fonte do TEXTO/badge acompanha a caixa
    // (antes só o badge recalculava; o texto ficava cortado ao encolher).
    _peRebuildNode(root, el);
    syncSelectionBox(root, el);
  };
  const up = () => {
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    pePersist();
    drawSelection(root, peTarget());
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
}

function syncSelectionBox(root, el) {
  // Handles e alça são FILHOS da caixa (posicionados em %), então acompanham
  // sozinhos; basta atualizar a caixa.
  const box = root.querySelector('.pe-sel');
  if (box) {
    box.style.left = el.x + '%'; box.style.top = el.y + '%';
    box.style.width = el.w + '%'; box.style.height = el.h + '%';
    box.style.transform = el.rotation ? `rotate(${el.rotation}deg)` : '';
  }
}

/** Edição AO VIVO de um campo do elemento selecionado: reconstrói SÓ o nó no
 *  overlay (não o painel) — assim sliders/inputs não perdem o foco/arraste. */
function peStyleLive(patch) {
  const t = peTarget(); if (!t || !_peSelected) return;
  const el = posterElements(t).find((e) => e.id === _peSelected); if (!el) return;
  Object.assign(el, patch);
  const stage = $('#p-stage'); const root = stage && stage.querySelector('.poster-1440');
  if (root && root.querySelector(`.pe-el[data-id="${el.id}"]`)) {
    _peRebuildNode(root, el);
    syncSelectionBox(root, el);
  }
  pePersist();
}

/** Refresh LEVE: re-renderiza só o overlay + seleção + painel (NÃO toca no
 *  template → não perde edições de texto não salvas nem re-lê todos os campos). */
function peRefresh() {
  const t = peTarget();
  const fmt = (typeof posterActiveFormat === 'function') ? posterActiveFormat() : { h: 1440 };
  if (typeof renderPosterOverlays === 'function') renderPosterOverlays(t, fmt);   // (chama setupPosterElementEditing)
  else { renderPosterElements(t, fmt); setupPosterElementEditing(); }
  renderPosterElementsPanel();
}

/* ---------- Painel do editor (aba "Elementos") — reformulação profissional (r113)
   Sub-navegação: Adicionar · Camadas · Ajustar (propriedades do selecionado). ---- */

/** Segmento (pílula) — opts: [[valor, rótulo], ...]. */
function _peSeg(cls, val, opts) {
  return `<div class="pe-seg ${cls}">` + opts.map(([v, l]) =>
    `<button type="button" data-v="${v}" class="${String(val) === String(v) ? 'active' : ''}">${l}</button>`).join('') + '</div>';
}
/** Bloco de degradê (De/Até/Ângulo) com prefixo (grad|boxGrad). */
function _peGradBlock(prefix, g) {
  g = g || {};
  return `<div class="pe-grad" data-prefix="${prefix}">
      <label class="pe-mini">De<input type="color" class="pe-g-from" value="${g.from || '#E30613'}"></label>
      <label class="pe-mini">Até<input type="color" class="pe-g-to" value="${g.to || '#6A0D14'}"></label>
      <label class="pe-mini pe-mini-flex">Ângulo<input type="range" class="pe-g-angle" min="0" max="360" value="${g.angle == null ? 135 : g.angle}"></label>
    </div>`;
}
/** Seletor de cantos (raio) — bolinhas com o raio visível. */
function _peCornerRow(r) {
  return '<div class="pe-corners">' + POSTER_CORNER_PRESETS.map((c) => {
    const rad = c.r >= 50 ? '11px' : Math.min(11, c.r * 1.3) + 'px';
    return `<button type="button" class="pe-corner ${(+r || 0) === c.r ? 'active' : ''}" data-r="${c.r}" title="${c.label}"><span style="border-radius:${rad};"></span></button>`;
  }).join('') + '</div>';
}
/** Grupo de propriedade com título. */
function _peGroup(title, body) {
  return `<div class="pe-group"><div class="pe-group-title">${title}</div>${body}</div>`;
}
/** Controles de preenchimento (sólido/degradê) reutilizáveis. `fillKey` = campo do
 *  tipo (fillType|textFill), `colorKey` = campo de cor sólida, `gradPrefix` = objeto de degradê. */
function _peFillControls(el, fillKey, colorKey, gradPrefix) {
  const ft = el[fillKey] || 'solid';
  return _peSeg('pe-fill-seg', ft, [['solid', 'Cor'], ['gradient', 'Degradê']])
    .replace('pe-fill-seg', `pe-fill-seg" data-fillkey="${fillKey}`)
    + (ft === 'gradient'
      ? _peGradBlock(gradPrefix, el[gradPrefix])
      : `<label class="pe-colorrow"><input type="color" class="pe-solid-color" data-colorkey="${colorKey}" value="${el[colorKey] || '#E30613'}"><span>Cor</span></label>`);
}

function renderPosterElementsPanel() {
  const host = $('#p-elements-ui');
  if (!host) return;
  const t = peTarget();
  const els = t ? posterElements(t) : [];
  const sel = els.find((e) => e.id === _peSelected);
  const addTab = _peAddTab;

  /* ----- ÁREAS DE INSERÇÃO (barra: Formas e Textos · Etiquetas Prontas · Ícones) ----- */
  const addDefs = [
    { kind: 'text', label: 'Texto', svg: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>' },
  ].concat(POSTER_ELEMENT_SHAPES);
  const addTiles = addDefs.map((s) =>
    `<button type="button" class="pe-tile pe-add" data-kind="${s.kind}">
       <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${s.svg}</svg><span>${escapeHtml(s.label)}</span></button>`).join('');
  const badgeBtns = POSTER_BADGE_PRESETS.map((b, i) =>
    `<button type="button" class="pe-add-badge" data-badge="${i}" style="background:${b.bg};color:${b.fg};${b.border ? `border:1px solid ${b.border};` : 'border:none;'}">${escapeHtml(b.text)}</button>`).join('');
  // Ícones: grade CONTÍNUA e compacta (sem títulos de categoria; ordem = categorias em sequência).
  const iconHtml = Object.keys(POSTER_ICON_LIBRARY).map((cat) =>
    Object.keys(POSTER_ICON_LIBRARY[cat]).map((name) =>
      `<button type="button" class="pe-add-icon" data-cat="${cat}" data-icon="${name}" title="${escapeHtml(name)}">
         <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${POSTER_ICON_LIBRARY[cat][name]}</svg></button>`).join('')).join('');
  const addArea = addTab === 'badges' ? `<div class="pe-badges">${badgeBtns}</div>`
    : addTab === 'icons' ? `<div class="pe-icongrid">${iconHtml}</div>`
    : `<div class="pe-tiles">${addTiles}</div>`;

  /* ----- CAMADAS ----- */
  const typeIco = {
    rect: '<rect x="4" y="7" width="16" height="10" rx="1"/>', circle: '<circle cx="12" cy="12" r="7"/>',
    line: '<line x1="4" y1="12" x2="20" y2="12"/>', divider: '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="13" y2="15"/>',
    icon: '<polygon points="12 3 14 9 20 9 15 13 17 20 12 16 7 20 9 13 4 9 10 9"/>',
    text: '<polyline points="4 7 4 4 20 4 20 7"/><line x1="9" y1="20" x2="15" y2="20"/><line x1="12" y1="4" x2="12" y2="20"/>',
    badge: '<rect x="3" y="7" width="18" height="10" rx="3"/>',
  };
  typeIco.avatar = '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>';
  typeIco.layer = '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/>';
  // HIERARQUIA UNIFICADA (r116): elementos + avatar + camadas de imagem, do TOPO
  // (frente) p/ baixo. Reordenar aqui muda a ordem de QUALQUER objeto entre si.
  const overlays = (typeof collectOverlays === 'function' && t) ? collectOverlays(t).slice().reverse() : els.slice().reverse().map((e) => ({ kind: 'element', id: e.id, ref: e }));
  const layerRows = overlays.map((it) => {
    const e = it.ref;
    let ico, label, extra = '';
    if (it.kind === 'element') {
      ico = typeIco[e.type] || '';
      label = (e.type === 'badge') ? (e.text || 'Etiqueta') : (e.type === 'text') ? (e.text || 'Texto')
        : ({ rect: 'Retângulo', circle: 'Círculo', line: 'Linha', divider: 'Divisor', icon: 'Ícone' }[e.type] || e.type);
      extra = `<button type="button" class="pe-ic" data-ovhide="${e.id}" title="Mostrar/ocultar">${e.hidden ? '🚫' : '👁'}</button>
        <button type="button" class="pe-ic" data-ovlock="${e.id}" title="Bloquear">${e.locked ? '🔒' : '🔓'}</button>`;
    } else if (it.kind === 'avatar') { ico = typeIco.avatar; label = 'Avatar'; }
    else { ico = typeIco.layer; label = 'Imagem'; }
    const active = it.id === _peSelected;
    const dim = (it.kind === 'element' && e.hidden) ? ' style="opacity:.45;"' : '';
    return `<div class="pe-layer-row${active ? ' active' : ''}" data-ovid="${it.id}">
      <span class="pe-layer-ico"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">${ico}</svg></span>
      <span class="pe-ovpick" data-ovid="${it.id}"${dim}>${escapeHtml(truncate(label, 20))}</span>
      ${extra}
      <button type="button" class="pe-ic" data-ovup="${it.id}" title="Para frente">▲</button>
      <button type="button" class="pe-ic" data-ovdown="${it.id}" title="Para trás">▼</button>
      <button type="button" class="pe-ic" data-ovdel="${it.id}" data-ovkind="${it.kind}" title="Excluir">🗑</button>
    </div>`;
  }).join('');
  const layersList = overlays.length ? `<div class="pe-layers">${layerRows}</div>`
    : '<div class="pe-empty">Nenhum objeto no cartaz ainda.</div>';

  /* ----- AJUSTAR (propriedades do selecionado) ----- */
  let propsPane = '';
  if (sel) {
    const isText = sel.type === 'text';
    const isShape = sel.type === 'rect' || sel.type === 'circle' || sel.type === 'line' || sel.type === 'divider';
    const isBadge = sel.type === 'badge';
    const isIcon = sel.type === 'icon';
    const canCorner = sel.type === 'rect' || isBadge || (isText && sel.boxFill !== 'none');
    const wopt = (v, l) => `<option value="${v}"${(sel.weight || 700) == v ? ' selected' : ''}>${l}</option>`;

    const transform = _peGroup('Transformar',
      `<label class="pe-slider">Opacidade<input type="range" class="pe-opacity" min="10" max="100" value="${Math.round((sel.opacity || 1) * 100)}"></label>
       <label class="pe-slider">Rotação<input type="range" class="pe-rot" min="0" max="359" value="${Math.round(sel.rotation || 0)}"></label>`);

    let content = '';
    if (isText) {
      content += _peGroup('Texto',
        `<textarea class="textarea pe-text" rows="2" maxlength="200" placeholder="Digite o texto">${escapeHtml(sel.text || '')}</textarea>
         <div class="pe-inline">
           ${_peSeg('pe-align-seg', sel.align || 'left', [['left', '⬅'], ['center', '≡'], ['right', '➡']])}
           <label class="pe-inline-lbl">Peso <select class="select pe-weight">${wopt(400, 'Normal')}${wopt(700, 'Negrito')}${wopt(900, 'Black')}</select></label>
         </div>
         <label class="pe-slider">Espaçamento<input type="range" class="pe-spacing" min="-5" max="30" value="${sel.spacing || 0}"></label>
         <label class="pe-slider">Entrelinha<input type="range" class="pe-lh" min="90" max="180" value="${Math.round((sel.lineHeight || 1.1) * 100)}"></label>
         <label class="pe-check"><input type="checkbox" class="pe-shadow" ${sel.shadow ? 'checked' : ''}> Sombra <input type="color" class="pe-shadow-color" value="${sel.shadowColor || '#000000'}"></label>`);
      content += _peGroup('Cor do texto', _peFillControls(sel, 'textFill', 'color', 'grad'));
      content += _peGroup('Caixa de texto',
        _peSeg('pe-boxfill-seg', sel.boxFill || 'none', [['none', 'Nenhum'], ['solid', 'Cor'], ['gradient', 'Degradê']])
        + (sel.boxFill === 'solid' ? `<label class="pe-colorrow"><input type="color" class="pe-boxcolor" value="${sel.boxColor || '#0B1421'}"><span>Fundo</span></label>` : '')
        + (sel.boxFill === 'gradient' ? _peGradBlock('boxGrad', sel.boxGrad) : ''));
    } else if (isBadge) {
      content += _peGroup('Preenchimento', _peFillControls(sel, 'fillType', 'color', 'grad'));
      content += _peGroup('Texto da etiqueta',
        `<input class="input pe-text" value="${escapeHtml(sel.text || '')}" maxlength="28" placeholder="Texto">
         <label class="pe-colorrow"><input type="color" class="pe-color2" value="${sel.color2 || '#FFFFFF'}"><span>Cor do texto</span></label>`);
    } else if (isIcon) {
      content += _peGroup('Cor', `<label class="pe-colorrow"><input type="color" class="pe-color" value="${sel.color}"><span>Traço</span></label>`);
    } else if (isShape) {
      content += _peGroup('Preenchimento', _peFillControls(sel, 'fillType', 'color', 'grad'));
    }

    if (canCorner || (sel.type !== 'icon' && sel.type !== 'line' && sel.type !== 'divider')) {
      const borderBody =
        `<label class="pe-check"><input type="checkbox" class="pe-border-on" ${sel.border ? 'checked' : ''}> Borda <input type="color" class="pe-border-color" value="${sel.border || '#16140F'}"></label>`
        + (sel.border ? `<div class="pe-inline">
            ${_peSeg('pe-border-style-seg', sel.borderStyle || 'solid', [['solid', 'Sólida'], ['dashed', 'Tracejada']])}
            ${_peSeg('pe-border-w-seg', sel.borderW || 1, [['1', 'Fina'], ['2', 'Média'], ['3', 'Grossa']])}
          </div>` : '');
      content += _peGroup('Cantos & borda',
        (canCorner ? `<div class="pe-cornerwrap">${_peCornerRow(sel.radius)}</div>` : '') + borderBody);
    }

    const actions = `<div class="pe-actions">
        <button type="button" class="pe-actbtn pe-act" data-act="dup">⧉ Duplicar</button>
        <button type="button" class="pe-actbtn pe-act" data-act="front">↑ Frente</button>
        <button type="button" class="pe-actbtn pe-act" data-act="back">↓ Trás</button>
        <button type="button" class="pe-actbtn danger pe-act" data-act="del-sel">🗑 Excluir</button>
      </div>`;
    propsPane = transform + content + actions;
  }

  host.innerHTML = `
    <div class="pe-subnav" id="pe-subnav">
      <button type="button" data-peadd="shapes" class="${addTab === 'shapes' ? 'active' : ''}">Formas e Textos</button>
      <button type="button" data-peadd="badges" class="${addTab === 'badges' ? 'active' : ''}">Etiquetas Prontas</button>
      <button type="button" data-peadd="icons" class="${addTab === 'icons' ? 'active' : ''}">Ícones</button>
    </div>
    <div class="pe-pane" id="pe-addarea">${addArea}</div>
    ${sel ? `<div class="pe-section" id="pe-props"><div class="pe-section-head">Ajustar elemento</div>${propsPane}</div>` : ''}
    ${overlays.length ? `<div class="pe-section"><div class="pe-section-head">Camadas · ${overlays.length}</div>${layersList}</div>` : ''}
    <label class="pe-safe-row"><input type="checkbox" class="pe-safe-toggle" ${_peSafeArea ? 'checked' : ''}> Mostrar área segura (guias)</label>`;

  wirePosterElementsPanel(host);

  // Rola até "Ajustar" após adicionar/selecionar (foco no que o usuário vai editar).
  if (_peFocusProps) {
    _peFocusProps = false;
    const pp = host.querySelector('#pe-props');
    if (pp) requestAnimationFrame(() => { try { pp.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch (_) {} });
  }
}

function wirePosterElementsPanel(host) {
  // Barra de categorias de inserção (Formas e Textos · Etiquetas Prontas · Ícones)
  host.querySelectorAll('#pe-subnav button[data-peadd]').forEach((b) => {
    b.onclick = () => { _peAddTab = b.dataset.peadd; renderPosterElementsPanel(); };
  });
  // Adicionar
  host.querySelectorAll('.pe-add').forEach((b) => { b.onclick = () => addPosterElement(b.dataset.kind); });
  host.querySelectorAll('.pe-add-badge').forEach((b) => { b.onclick = () => addPosterElement('badge', POSTER_BADGE_PRESETS[+b.dataset.badge]); });
  host.querySelectorAll('.pe-add-icon').forEach((b) => { b.onclick = () => addPosterElement('icon', { svg: POSTER_ICON_LIBRARY[b.dataset.cat][b.dataset.icon] }); });
  const safeBtn = host.querySelector('.pe-safe-toggle');
  if (safeBtn) safeBtn.onchange = () => { _peSafeArea = safeBtn.checked; setupPosterElementEditing(); };
  // Camadas UNIFICADAS (elementos + avatar + imagens)
  host.querySelectorAll('.pe-ovpick').forEach((b) => {
    b.onclick = () => {
      const id = b.dataset.ovid;
      _peSelected = id;
      const isEl = peTarget() && posterElements(peTarget()).some((x) => x.id === id);
      if (isEl) _peFocusProps = true;
      if (typeof _peApplySelection === 'function') _peApplySelection();
      renderPosterElementsPanel();
    };
  });
  host.querySelectorAll('[data-ovup]').forEach((b) => { b.onclick = () => { if (typeof reorderOverlay === 'function') reorderOverlay(b.dataset.ovup, 'up'); }; });
  host.querySelectorAll('[data-ovdown]').forEach((b) => { b.onclick = () => { if (typeof reorderOverlay === 'function') reorderOverlay(b.dataset.ovdown, 'down'); }; });
  host.querySelectorAll('[data-ovhide]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const el = _peSel2(b.dataset.ovhide); if (el) updatePosterElement(b.dataset.ovhide, { hidden: !el.hidden }); }; });
  host.querySelectorAll('[data-ovlock]').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); const el = _peSel2(b.dataset.ovlock); if (el) updatePosterElement(b.dataset.ovlock, { locked: !el.locked }); }; });
  host.querySelectorAll('[data-ovdel]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.ovdel, kind = b.dataset.ovkind;
      if (kind === 'element') deletePosterElement(id);
      else if (kind === 'avatar') { if (typeof _clearAvatar === 'function') _clearAvatar(); }
      else if (kind === 'layer') { if (typeof _deleteLayer === 'function') _deleteLayer(id); }
    };
  });
  // (legado) — controles de camada antigos, mantidos por segurança
  host.querySelectorAll('.pe-pick').forEach((b) => { b.onclick = () => { _peSelected = b.dataset.id; _peFocusProps = true; peRefresh(); }; });
  host.querySelectorAll('.pe-ic[data-act]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.id; const act = b.dataset.act;
      const t = peTarget(); const el = t && posterElements(t).find((x) => x.id === id);
      if (act === 'hide' && el) updatePosterElement(id, { hidden: !el.hidden });
      else if (act === 'lock' && el) updatePosterElement(id, { locked: !el.locked });
      else if (act === 'up') reorderPosterElement(id, 'up');
      else if (act === 'down') reorderPosterElement(id, 'down');
      else if (act === 'del') deletePosterElement(id);
    };
  });
  // Ações do selecionado
  host.querySelectorAll('.pe-act').forEach((b) => {
    b.onclick = () => {
      if (!_peSelected) return;
      const act = b.dataset.act;
      if (act === 'dup') duplicatePosterElement(_peSelected);
      else if (act === 'front') reorderPosterElement(_peSelected, 'front');
      else if (act === 'back') reorderPosterElement(_peSelected, 'back');
      else if (act === 'del-sel') deletePosterElement(_peSelected);
    };
  });

  // ----- Controles AO VIVO (peStyleLive: não reconstrói o painel) -----
  const live = (sel, fn) => { const el = host.querySelector(sel); if (el) el.oninput = () => fn(el); };
  live('.pe-color', (el) => peStyleLive({ color: el.value }));
  live('.pe-color2', (el) => peStyleLive({ color2: el.value }));
  live('.pe-opacity', (el) => peStyleLive({ opacity: (+el.value) / 100 }));
  live('.pe-rot', (el) => peStyleLive({ rotation: +el.value }));
  live('.pe-text', (el) => peStyleLive({ text: el.value }));
  live('.pe-spacing', (el) => peStyleLive({ spacing: +el.value }));
  live('.pe-lh', (el) => peStyleLive({ lineHeight: (+el.value) / 100 }));
  live('.pe-boxcolor', (el) => peStyleLive({ boxColor: el.value }));
  const weightEl = host.querySelector('.pe-weight');
  if (weightEl) weightEl.onchange = () => peStyleLive({ weight: +weightEl.value });
  const shadowEl = host.querySelector('.pe-shadow');
  if (shadowEl) shadowEl.onchange = () => peStyleLive({ shadow: shadowEl.checked });
  const shadowColorEl = host.querySelector('.pe-shadow-color');
  if (shadowColorEl) shadowColorEl.oninput = () => peStyleLive({ shadow: true, shadowColor: shadowColorEl.value });

  // Cor sólida genérica (preenchimento) → grava no campo indicado (data-colorkey).
  host.querySelectorAll('.pe-solid-color').forEach((el) => { el.oninput = () => peStyleLive({ [el.dataset.colorkey]: el.value }); });

  // Degradês (grad | boxGrad) — atualiza o objeto inteiro ao vivo.
  host.querySelectorAll('.pe-grad').forEach((block) => {
    const prefix = block.dataset.prefix;
    const from = block.querySelector('.pe-g-from');
    const to = block.querySelector('.pe-g-to');
    const ang = block.querySelector('.pe-g-angle');
    const upd = () => {
      const e = _peSel(); if (!e) return;
      const g = Object.assign({ from: '#E30613', to: '#6A0D14', angle: 135 }, e[prefix] || {});
      if (from) g.from = from.value;
      if (to) g.to = to.value;
      if (ang) g.angle = +ang.value;
      peStyleLive({ [prefix]: g });
    };
    [from, to, ang].forEach((i) => { if (i) i.oninput = upd; });
  });

  // ----- Segmentos e alternâncias (reconstroem o painel p/ mostrar controles certos) -----
  host.querySelectorAll('.pe-align-seg button').forEach((b) => { b.onclick = () => peStyleLive({ align: b.dataset.v }); });
  host.querySelectorAll('.pe-fill-seg').forEach((seg) => {
    const key = seg.dataset.fillkey;
    seg.querySelectorAll('button').forEach((b) => { b.onclick = () => updatePosterElement(_peSelected, { [key]: b.dataset.v }); });
  });
  host.querySelectorAll('.pe-boxfill-seg button').forEach((b) => { b.onclick = () => updatePosterElement(_peSelected, { boxFill: b.dataset.v }); });
  host.querySelectorAll('.pe-border-style-seg button').forEach((b) => { b.onclick = () => updatePosterElement(_peSelected, { borderStyle: b.dataset.v }); });
  host.querySelectorAll('.pe-border-w-seg button').forEach((b) => { b.onclick = () => updatePosterElement(_peSelected, { borderW: +b.dataset.v }); });
  host.querySelectorAll('.pe-corner').forEach((b) => { b.onclick = () => updatePosterElement(_peSelected, { radius: +b.dataset.r }); });
  const borderOn = host.querySelector('.pe-border-on');
  if (borderOn) borderOn.onchange = () => {
    const e = _peSel(); if (!e) return;
    updatePosterElement(_peSelected, { border: borderOn.checked ? (e.border || '#16140F') : '' });
  };
  const borderColor = host.querySelector('.pe-border-color');
  if (borderColor) borderColor.oninput = () => peStyleLive({ border: borderColor.value });
}
