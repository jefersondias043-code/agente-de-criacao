'use strict';
/* ============================================================
   EDITOR VISUAL — recursos profissionais
   Desfazer/Refazer (histórico da edição atual), modo Simples/Profissional
   (reduz a poluição visual), e "Melhorar Design" (IA analisa contraste,
   hierarquia, espaçamento, legibilidade e equilíbrio — SEM mudar o conteúdo).
   UI injetada dinamicamente no editor (sem alterar o markup). Aditivo e opt-in.
   ============================================================ */

/* ---------- Desfazer / Refazer ---------- */
let _histStack = [], _histIndex = -1, _histPosterId = null, _histLast = '', _histTimer = null, _histRestoring = false;

// Hook chamado por savePosters() (posters.js) após cada gravação.
function posterHistoryCapture() {
  const p = State.posters.find((x) => x.id === State.activePosterId);
  if (!p) return;
  const snap = JSON.stringify(p);
  if (_histRestoring) { _histLast = snap; return; }
  if (_histPosterId !== p.id) {   // trocou de cartaz → reinicia o histórico
    _histPosterId = p.id; _histStack = [snap]; _histIndex = 0; _histLast = snap;
    updateUndoRedoButtons(); return;
  }
  if (snap === _histLast) return;
  clearTimeout(_histTimer);
  _histTimer = setTimeout(() => {
    _histStack = _histStack.slice(0, _histIndex + 1);
    _histStack.push(snap);
    if (_histStack.length > 60) _histStack.shift();
    _histIndex = _histStack.length - 1;
    _histLast = snap;
    updateUndoRedoButtons();
  }, 250);
}
function _restoreSnapshot(snap) {
  const obj = JSON.parse(snap);
  const i = State.posters.findIndex((x) => x.id === obj.id);
  if (i < 0) return;
  _histRestoring = true;
  State.posters[i] = obj;
  _histLast = snap;
  if (typeof savePosters === 'function') savePosters();
  if (typeof renderPosters === 'function') renderPosters();
  _histRestoring = false;
  updateUndoRedoButtons();
}
function posterUndo() { if (_histIndex > 0) { _histIndex--; _restoreSnapshot(_histStack[_histIndex]); } }
function posterRedo() { if (_histIndex < _histStack.length - 1) { _histIndex++; _restoreSnapshot(_histStack[_histIndex]); } }
function updateUndoRedoButtons() {
  const u = $('#p-undo'), r = $('#p-redo');
  if (u) u.disabled = _histIndex <= 0;
  if (r) r.disabled = _histIndex >= _histStack.length - 1;
}

/* ---------- Modo único (r100) ----------
 * O editor tem UM só modo, com todos os recursos. posterIsProMode() permanece
 * por compatibilidade (sempre true); applyPosterProMode() só desfaz qualquer
 * ocultação de abas herdada de um estado antigo salvo no navegador. */
function posterIsProMode() { return true; }
function applyPosterProMode() {
  const tabs = $('#p-edit-tabs');
  if (!tabs) return;
  tabs.querySelectorAll('.pedit-tab').forEach((btn) => { btn.style.display = ''; });
}

/* ---------- "Melhorar Design" (IA) ---------- */
async function improvePosterDesign() {
  const p = State.posters.find((x) => x.id === State.activePosterId);
  if (!p) return;
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;
  if (typeof callLLM !== 'function') { toast('IA indisponível.', 'error'); return; }
  const els = Array.isArray(s.elements) ? s.elements.map((e) => e.type) : [];
  const prompt = [
    'Você é um diretor de arte experiente. Analise este cartaz/post de notícia e dê de 3 a 5 sugestões OBJETIVAS e PRÁTICAS para melhorar o DESIGN — foco em contraste, hierarquia tipográfica, espaçamento, legibilidade e equilíbrio visual.',
    'NÃO reescreva nem invente conteúdo: comente apenas a APRESENTAÇÃO visual. Responda em tópicos curtos (cada um com uma ação concreta).',
    '',
    `Modelo: ${s.template || 'manchete'} · Formato: ${s.format || '3:4'} · Tema: ${p.theme || 'do portal'}`,
    `Título: ${s.headline || '(vazio)'}`,
    `Subtítulo: ${s.subtitle || '(vazio)'}`,
    `Texto: ${(s.description || '(vazio)').slice(0, 400)}`,
    `Imagens: ${[s.image1, s.image2, s.image3, s.image4].filter(Boolean).length}`,
    `Elementos extras: ${els.length ? els.join(', ') : 'nenhum'}`,
  ].join('\n');
  toast('Analisando o design…', 'info', 2500);
  const btn = $('#p-improve'); if (btn) btn.disabled = true;
  try {
    const r = await callLLM(prompt);
    showDesignSuggestions((r && r.content) || 'Sem sugestões.');
  } catch (e) {
    toast((e && e.message) || 'Não foi possível analisar o design.', 'error', 6000);
  } finally { if (btn) btn.disabled = false; }
}

function showDesignSuggestions(text) {
  let back = $('#p-improve-modal');
  if (!back) {
    back = document.createElement('div');
    back.id = 'p-improve-modal';
    back.style.cssText = 'position:fixed;inset:0;z-index:200;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:1.5rem;';
    document.body.appendChild(back);
  }
  back.innerHTML = `<div style="background:var(--paper,#fff);max-width:520px;width:100%;max-height:80vh;overflow:auto;border-radius:14px;padding:1.4rem 1.5rem;box-shadow:0 24px 60px rgba(0,0,0,.3);">
    <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:.6rem;">
      <strong style="font-size:1.05rem;">Sugestões de design</strong>
      <button id="p-improve-close" class="btn btn-ghost btn-sm">✕</button>
    </div>
    <div style="font-size:.92rem;line-height:1.5;white-space:pre-wrap;color:var(--ink,#16140f);">${escapeHtml(text)}</div>
    <div class="text-xs text-mute mt-2">A IA sugere melhorias de apresentação — o conteúdo não foi alterado.</div>
  </div>`;
  back.style.display = 'flex';
  const close = () => { back.style.display = 'none'; };
  $('#p-improve-close').onclick = close;
  back.onclick = (e) => { if (e.target === back) close(); };
}

/* ---------- Injeção da UI (idempotente) ---------- */
function setupPosterProUI() {
  // 1) Undo/Redo + Melhorar Design na barra de ações do editor.
  const actions = document.querySelector('#p-content .poster-actions');
  if (actions && !$('#p-undo')) {
    const mk = (id, label, title) => { const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'btn btn-ghost btn-sm'; b.title = title; b.textContent = label; return b; };
    // Botões de ícone dedicados (setas de girar) — leem-se na hora como desfazer/refazer.
    const mkIcon = (id, svg, title) => { const b = document.createElement('button'); b.id = id; b.type = 'button'; b.className = 'btn btn-ghost btn-sm btn-icon pe-histbtn'; b.title = title; b.setAttribute('aria-label', title); b.innerHTML = svg; return b; };
    const UNDO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>';
    const REDO_SVG = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/></svg>';
    const undo = mkIcon('p-undo', UNDO_SVG, 'Desfazer (Ctrl+Z)');
    const redo = mkIcon('p-redo', REDO_SVG, 'Refazer (Ctrl+Y)');
    const improve = mk('p-improve', '✨ Melhorar', 'A IA sugere melhorias de design');
    undo.onclick = posterUndo; redo.onclick = posterRedo; improve.onclick = improvePosterDesign;
    actions.insertBefore(redo, actions.firstChild);
    actions.insertBefore(undo, actions.firstChild);
    actions.appendChild(improve);
  }
  // 2) Modo único (r100): não existe mais toggle Simples/Profissional. Remove
  //    o botão remanescente de sessões antigas, se houver.
  const oldTog = $('#p-mode-toggle');
  if (oldTog) oldTog.remove();
  // 3) Atalhos de teclado (uma vez).
  if (!setupPosterProUI._keys) {
    setupPosterProUI._keys = true;
    document.addEventListener('keydown', (e) => {
      if (State.currentView !== 'posters') return;
      const tag = (e.target.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); e.shiftKey ? posterRedo() : posterUndo(); }
      else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); posterRedo(); }
    });
  }
  // 4) Favoritos + componentes: injetados na sub-área "Favoritos" da aba Estilo (r111).
  const favHost = $('#p-sub-favorites') || document.querySelector('.pedit-panel[data-pgroup="colors"]');
  if (favHost && !$('#p-pro-extra')) {
    const box = document.createElement('div');
    box.id = 'p-pro-extra';
    favHost.appendChild(box);
  }
  renderProExtra();
  applyPosterProMode();
  // Semeia o histórico com o estado LIMPO do cartaz ao abrir o editor (antes de
  // qualquer edição) — garante que o Desfazer tenha um ponto de retorno correto.
  posterHistoryCapture();
  updateUndoRedoButtons();
}

// "Composição (1 clique)" removida (r109) — redundante com os Temas unificados.
function _proActive() { return State.posters.find((x) => x.id === State.activePosterId); }

/* ---------- Favoritos (salvar/reaplicar tema+paleta+formato) ---------- */
function posterFavorites() { return (typeof loadJSON === 'function') ? loadJSON('agp.posterFavorites', []) : []; }
function saveCurrentLook() {
  const p = _proActive(); if (!p) return;
  const name = prompt('Nome do favorito (tema, cores e formato atuais):'); if (!name) return;
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;
  const favs = posterFavorites();
  favs.unshift({ id: uuid(), name: name.slice(0, 40), theme: p.theme || '', custom: p.custom || null, format: s.format || '3:4' });
  saveJSON('agp.posterFavorites', favs.slice(0, 30));
  renderProExtra(); toast('Favorito salvo.', 'success');
}
function applyFavorite(id) {
  const f = posterFavorites().find((x) => x.id === id); const p = _proActive(); if (!f || !p) return;
  p.theme = f.theme; p.custom = f.custom;
  const s = (typeof getSlide === 'function') ? getSlide(p) : p; s.format = f.format;
  if (typeof posterIsCarousel === 'function' && posterIsCarousel(p)) { p.format = f.format; p.slides.forEach((sl) => { sl.format = f.format; }); }
  p.updatedAt = new Date().toISOString();
  savePosters();
  if (typeof renderPosters === 'function') renderPosters();
  toast('Favorito aplicado.', 'success');
}
function deleteFavorite(id) { saveJSON('agp.posterFavorites', posterFavorites().filter((x) => x.id !== id)); renderProExtra(); }

/* ---------- Banco de componentes (salvar/reusar conjuntos de elementos) ---------- */
function posterComponents() { return (typeof loadJSON === 'function') ? loadJSON('agp.posterComponents', []) : []; }
function saveCurrentComponent() {
  const p = _proActive(); if (!p) return;
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;
  const els = Array.isArray(s.elements) ? s.elements : [];
  if (!els.length) { toast('Adicione elementos primeiro (aba Elementos).', 'error'); return; }
  const name = prompt('Nome do componente (salva os elementos atuais):'); if (!name) return;
  const comps = posterComponents();
  comps.unshift({ id: uuid(), name: name.slice(0, 40), elements: JSON.parse(JSON.stringify(els)) });
  saveJSON('agp.posterComponents', comps.slice(0, 30));
  renderProExtra(); toast('Componente salvo.', 'success');
}
function insertComponent(id) {
  const c = posterComponents().find((x) => x.id === id); const p = _proActive(); if (!c || !p) return;
  const s = (typeof getSlide === 'function') ? getSlide(p) : p;
  if (!Array.isArray(s.elements)) s.elements = [];
  (c.elements || []).forEach((e) => s.elements.push(Object.assign(JSON.parse(JSON.stringify(e)), { id: uuid() })));
  p.updatedAt = new Date().toISOString();
  savePosters();
  if (typeof renderPosters === 'function') renderPosters();
  toast('Componente inserido.', 'success');
}
function deleteComponent(id) { saveJSON('agp.posterComponents', posterComponents().filter((x) => x.id !== id)); renderProExtra(); }

function renderProExtra() {
  const host = $('#p-pro-extra'); if (!host) return;
  const favs = posterFavorites();
  const favList = favs.length ? favs.map((f) =>
    `<div class="flex items-center gap-1" style="font-size:.8rem;"><span class="pro-fav-apply" data-id="${f.id}" style="flex:1;cursor:pointer;">★ ${escapeHtml(f.name)}</span><button type="button" class="pe-ic pro-fav-del" data-id="${f.id}" title="Excluir">🗑</button></div>`).join('') : '<div class="input-helper">Nenhum favorito ainda.</div>';
  const comps = posterComponents();
  const compList = comps.length ? comps.map((c) =>
    `<div class="flex items-center gap-1" style="font-size:.8rem;"><span class="pro-comp-ins" data-id="${c.id}" style="flex:1;cursor:pointer;">⧉ ${escapeHtml(c.name)} (${(c.elements || []).length})</span><button type="button" class="pe-ic pro-comp-del" data-id="${c.id}" title="Excluir">🗑</button></div>`).join('') : '<div class="input-helper">Nenhum componente salvo.</div>';

  host.innerHTML = `
    <div class="label-row"><span class="label" style="font-size:.72rem;">Favoritos</span><button type="button" class="btn btn-ghost btn-sm pro-fav-save">+ Salvar look</button></div>
    <div style="display:flex;flex-direction:column;gap:.1rem;margin:.2rem 0 .55rem;">${favList}</div>
    <div class="label-row"><span class="label" style="font-size:.72rem;">Componentes</span><button type="button" class="btn btn-ghost btn-sm pro-comp-save">+ Salvar elementos</button></div>
    <div style="display:flex;flex-direction:column;gap:.1rem;margin-top:.2rem;">${compList}</div>
  `;
  const fs = host.querySelector('.pro-fav-save'); if (fs) fs.onclick = saveCurrentLook;
  host.querySelectorAll('.pro-fav-apply').forEach((b) => { b.onclick = () => applyFavorite(b.dataset.id); });
  host.querySelectorAll('.pro-fav-del').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); deleteFavorite(b.dataset.id); }; });
  const cs = host.querySelector('.pro-comp-save'); if (cs) cs.onclick = saveCurrentComponent;
  host.querySelectorAll('.pro-comp-ins').forEach((b) => { b.onclick = () => insertComponent(b.dataset.id); });
  host.querySelectorAll('.pro-comp-del').forEach((b) => { b.onclick = (e) => { e.stopPropagation(); deleteComponent(b.dataset.id); }; });
}
