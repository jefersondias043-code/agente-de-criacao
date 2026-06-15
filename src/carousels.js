/* ============================================================================
 * carousels.js — Carrosséis (sequências de slides) para os Cartazes.
 *
 * Um carrossel é um CARTAZ com `slides[]` (+ `slideIndex`). Cada slide é um
 * mini-cartaz com os MESMOS campos (template/format/headline/category/...),
 * então reaproveita TODO o catálogo de modelos e o editor. Cartaz SEM `slides`
 * = peça única, comportamento atual 100% intacto (retrocompatível).
 *
 * Filosofia preservada: preenchimento automático (split inteligente a partir de
 * matérias/conteúdos de outras ferramentas), organização automática, e edição
 * manual total (navegar, adicionar, remover, reordenar, ajustar cada slide).
 * ==========================================================================*/

const SLIDE_IMG_KEYS = ['image1', 'image2', 'image3', 'image4'];
let _carouselDragSrc = null; // índice de origem ao arrastar miniaturas de slide

/** É carrossel? (tem ao menos 1 slide) */
function posterIsCarousel(p) {
  return !!(p && Array.isArray(p.slides) && p.slides.length > 0);
}

/** Alvo de edição: o slide ativo (carrossel) ou o próprio cartaz (peça única). */
function getSlide(p) {
  if (!posterIsCarousel(p)) return p;
  let i = p.slideIndex || 0;
  if (i < 0) i = 0;
  if (i >= p.slides.length) i = p.slides.length - 1;
  p.slideIndex = i;
  return p.slides[i];
}

/** Cria um slide com todos os campos (defaults + overrides). */
function makeSlide(overrides) {
  const base = {
    template: 'manchete', format: '3:4',
    headline: '', category: '', location: '', subtitle: '', description: '', footer: '',
    avatar: null,
  };
  for (const k of SLIDE_IMG_KEYS) { base[k] = null; base[k + 'PosX'] = 50; base[k + 'PosY'] = 50; base[k + 'Scale'] = 1; }
  return Object.assign(base, overrides || {});
}

/** Extrai os campos "de slide" de um cartaz/slide existente. */
function pickSlideFields(src) {
  const o = {
    template: src.template || 'manchete', format: src.format || '3:4',
    headline: src.headline || '', category: src.category || '', location: src.location || '',
    subtitle: src.subtitle || '', description: src.description || '', footer: src.footer || '',
    avatar: src.avatar || null,
  };
  for (const k of SLIDE_IMG_KEYS) {
    o[k] = src[k] || null;
    o[k + 'PosX'] = src[k + 'PosX'] ?? 50;
    o[k + 'PosY'] = src[k + 'PosY'] ?? 50;
    o[k + 'Scale'] = src[k + 'Scale'] ?? 1;
  }
  return o;
}

/** Título/categoria para exibir na lista (1º slide quando carrossel). */
function posterDisplayTitle(p) {
  if (posterIsCarousel(p)) return p.slides[0].headline || p.headline || 'Carrossel';
  return p.headline || '';
}
function posterDisplayCategory(p) {
  if (posterIsCarousel(p)) return p.slides[0].category || p.category || 'GERAL';
  return p.category || 'GERAL';
}

/* -------------------------------------------------------------------------- */
/* Auto-organização de conteúdo em slides                                      */
/* -------------------------------------------------------------------------- */

// Rótulos cuja LINHA inteira deve ser descartada do corpo (metadados).
const BODY_DROP_RE = /^[\*#>\-•\s]*(hashtags?|tags?|legenda|cr[eé]ditos?|fonte|imagem|foto)\s*[:\-—]/i;
// Rótulos cujo PREFIXO é removido, mantendo o valor (estrutura da matéria).
const BODY_LABEL_RE = /^[\*#>\-•\s]*(t[íi]tulo|subt[íi]tulo|lead|corpo|descri[çc][ãa]o|se[çc][ãa]o|intert[íi]tulo)\s*[:\-—]\s*/i;

/**
 * Extrai os PARÁGRAFOS do corpo COMPLETO da matéria (não só o lead):
 * remove linhas de metadados, tira prefixos de rótulo, e descarta as linhas
 * que são o próprio título/subtítulo (já exibidos na capa).
 */
function extractBodyParagraphs(content, struct) {
  const title = (struct.title || '').trim();
  const subtitle = (struct.subtitle || '').trim();
  const out = [];
  for (const raw of (content || '').split('\n')) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    if (BODY_DROP_RE.test(trimmed)) continue;
    const line = trimmed.replace(BODY_LABEL_RE, '').replace(/^[\*#>\-•\s]+/, '').trim();
    if (line.length < 2) continue;
    if (line === title || line === subtitle) continue;
    out.push(line);
  }
  return out;
}

/**
 * ESTRUTURA PADRÃO do carrossel automático (usuário pode editar tudo depois):
 *   • 1º slide  → "Foto em destaque" (capa, destaque visual)
 *   • intermediários → "Texto / parágrafo" (corpo COMPLETO, agrupado por orçamento)
 *   • último slide → "Cor sólida" (encerramento / CTA)
 * Formato inicial padrão = 1:1 (quadrado) em todos os slides.
 */
function splitIntoSlides(content, struct, parsed, portal, fmt) {
  fmt = fmt || '1:1';
  const title = (struct.title || parsed.headline || '').trim();
  const subtitle = (struct.subtitle || parsed.subtitle || '').trim();
  const category = (parsed.category || 'RESUMO');
  const location = (parsed.location || '');
  const slides = [];

  // 1) CAPA — Foto em destaque (o usuário adiciona a imagem; sem ela mostra placeholder)
  slides.push(makeSlide({ template: 'destaque-foto', format: fmt, headline: title || 'Título', subtitle, category, location }));

  // 2) INTERMEDIÁRIOS — Texto/parágrafo: corpo COMPLETO agrupado por orçamento de chars
  const paras = extractBodyParagraphs(content || struct.description || '', struct);
  const MAX = 520;
  const groups = [];
  let cur = '';
  const flush = () => { if (cur.trim()) groups.push(cur.trim()); cur = ''; };
  for (const para of paras) {
    if (para.length > MAX) {
      flush();
      const sentences = para.split(/(?<=[.!?])\s+/);
      let buf = '';
      for (const sen of sentences) {
        if (buf && (buf + ' ' + sen).length > MAX) { groups.push(buf.trim()); buf = sen; }
        else buf = buf ? buf + ' ' + sen : sen;
      }
      if (buf.trim()) groups.push(buf.trim());
    } else if (cur && (cur + '\n\n' + para).length > MAX) {
      flush(); cur = para;
    } else {
      cur = cur ? cur + '\n\n' + para : para;
    }
  }
  flush();
  const limited = groups.slice(0, 10); // teto de slides de corpo
  limited.forEach(g => slides.push(makeSlide({ template: 'texto', format: fmt, category, headline: '', description: g })));
  if (!limited.length && subtitle) {
    slides.push(makeSlide({ template: 'texto', format: fmt, category, headline: '', description: subtitle }));
  }

  // 3) FECHAMENTO — Cor sólida (encerramento / CTA)
  slides.push(makeSlide({
    template: 'cor-solida', format: fmt, category: '',
    headline: (portal && portal.name) || 'Acompanhe',
    subtitle: 'Siga ' + ((portal && portal.handle) || '@portal') + ' para mais.',
  }));

  return slides;
}

/** Cria um CARROSSEL a partir de uma geração/conteúdo (mesmo fluxo do cartaz). */
function createCarouselFromGeneration(g) {
  const parsed = parseFromText(g.content);
  const struct = parseGenerationStructure(g.content);
  const portal = State.portals[State.activePortalIndex] || State.portals[0] || {};
  const slides = splitIntoSlides(g.content, struct, parsed, portal, '1:1');

  const poster = Object.assign(makeSlide({
    template: 'destaque-foto', format: '1:1',
    headline: struct.title || parsed.headline || '',
    category: parsed.category || 'GERAL',
    location: parsed.location || '',
    subtitle: struct.subtitle || parsed.subtitle || '',
    description: struct.description || '',
    footer: parsed.footer || '',
  }), {
    id: uuid(),
    generationId: g.id,
    slides,
    slideIndex: 0,
    portalSnapshot: { ...portal },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });

  State.posters.unshift(poster);
  saveJSON(STORAGE_KEYS.posters, State.posters);
  State.activePosterId = poster.id;
  toast('Carrossel criado.', 'success');
  goTo('posters');
}

/* -------------------------------------------------------------------------- */
/* Edição manual de slides                                                     */
/* -------------------------------------------------------------------------- */

function persistPosters() { saveJSON(STORAGE_KEYS.posters, State.posters); }

/** Converte a peça única atual num carrossel (slide 0 = conteúdo atual). */
function convertToCarousel(p) {
  if (posterIsCarousel(p)) return;
  p.slides = [makeSlide(pickSlideFields(p))];
  p.slideIndex = 0;
  p.updatedAt = new Date().toISOString();
  persistPosters();
  renderPostersList();
  renderPosterEditor();
  toast('Agora é um carrossel. Adicione mais slides.', 'success');
}

function switchSlide(p, i) {
  if (!posterIsCarousel(p)) return;
  p.slideIndex = Math.max(0, Math.min(i, p.slides.length - 1));
  persistPosters();
  renderPosterEditor();
}

function addSlide(p, duplicate) {
  if (!posterIsCarousel(p)) return;
  const cur = getSlide(p);
  const novo = duplicate ? makeSlide(pickSlideFields(cur)) : makeSlide({ template: cur.template || 'texto', format: cur.format || '3:4', category: cur.category || '' });
  const at = (p.slideIndex || 0) + 1;
  p.slides.splice(at, 0, novo);
  p.slideIndex = at;
  p.updatedAt = new Date().toISOString();
  persistPosters();
  renderPostersList();
  renderPosterEditor();
  toast(duplicate ? 'Slide duplicado.' : 'Slide adicionado.', 'success');
}

function removeSlide(p) {
  if (!posterIsCarousel(p) || p.slides.length <= 1) return;
  if (!confirm('Remover este slide?')) return;
  p.slides.splice(p.slideIndex || 0, 1);
  p.slideIndex = Math.max(0, Math.min(p.slideIndex || 0, p.slides.length - 1));
  p.updatedAt = new Date().toISOString();
  persistPosters();
  renderPostersList();
  renderPosterEditor();
  toast('Slide removido.', 'success');
}

function moveSlide(p, dir) {
  if (!posterIsCarousel(p)) return;
  const i = p.slideIndex || 0;
  const j = i + dir;
  if (j < 0 || j >= p.slides.length) return;
  const tmp = p.slides[i]; p.slides[i] = p.slides[j]; p.slides[j] = tmp;
  p.slideIndex = j;
  p.updatedAt = new Date().toISOString();
  persistPosters();
  renderPostersList();
  renderPosterEditor();
}

/** Reordena: tira o slide `from` e insere na posição `to` (drag-and-drop). */
function reorderSlides(p, from, to) {
  if (!posterIsCarousel(p)) return;
  if (from == null || Number.isNaN(from) || from === to) return;
  if (from < 0 || to < 0 || from >= p.slides.length || to >= p.slides.length) return;
  const [moved] = p.slides.splice(from, 1);
  p.slides.splice(to, 0, moved);
  p.slideIndex = to;
  p.updatedAt = new Date().toISOString();
  persistPosters();
  renderPostersList();
  renderPosterEditor();
}

/* -------------------------------------------------------------------------- */
/* UI — barra de slides (renderizada no #p-carousel-bar do editor)             */
/* -------------------------------------------------------------------------- */

function renderCarouselBar(p) {
  const bar = $('#p-carousel-bar');
  if (!bar) return;

  if (!posterIsCarousel(p)) {
    bar.innerHTML = `
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;padding:.5rem .7rem;background:#f4f1ea;border:1px solid #e5e0d5;border-radius:.6rem;">
        <span style="font-size:.8rem;color:#6a6356;">Peça única</span>
        <button class="btn btn-sm" id="p-make-carousel" type="button" style="margin-left:auto;">▤ Transformar em carrossel</button>
      </div>`;
    const mk = $('#p-make-carousel');
    if (mk) mk.onclick = () => convertToCarousel(p);
    return;
  }

  const i = p.slideIndex || 0;
  const n = p.slides.length;
  const THUMB_W = 72;
  const reg = (typeof POSTER_TEMPLATES !== 'undefined') ? POSTER_TEMPLATES : null;
  const portal = { ...(p.portalSnapshot || {}), ...(State.portals[State.activePortalIndex] || State.portals[0] || {}) };
  if (typeof applyTheme === 'function') applyTheme(p.theme || portal.theme);   // tema do carrossel nos thumbs
  if (typeof applyPosterCustom === 'function') applyPosterCustom(p.custom);     // identidade visual nos thumbs
  const chips = p.slides.map((sl, idx) => {
    const active = idx === i;
    const fmt = (typeof POSTER_FORMATS !== 'undefined' && POSTER_FORMATS[sl.format]) || { w: 1080, h: 1440 };
    const tpl = reg && (reg[sl.template] || reg.manchete);
    let inner = '';
    if (typeof setPosterHidden === 'function') setPosterHidden(sl);   // elementos ocultos por SLIDE
    try { inner = tpl ? tpl.render({ ...sl, portalSnapshot: p.portalSnapshot, _idx: idx + 1, _total: p.slides.length }, fmt, portal) : ''; } catch (e) { inner = ''; }
    const th = Math.round(THUMB_W * fmt.h / fmt.w);
    const scale = THUMB_W / fmt.w;
    return `<div class="p-slide-chip" data-si="${idx}" draggable="true" title="Slide ${idx + 1} — clique p/ editar, arraste p/ reordenar" style="position:relative;width:${THUMB_W}px;height:${th}px;flex-shrink:0;border-radius:6px;overflow:hidden;cursor:grab;background:#fff;border:2px solid ${active ? '#16140f' : '#d8d2c6'};box-shadow:${active ? '0 0 0 2px rgba(22,20,15,.18)' : 'none'};">
        <div style="width:${fmt.w}px;height:${fmt.h}px;transform:scale(${scale});transform-origin:top left;pointer-events:none;">${inner}</div>
        <span style="position:absolute;top:2px;left:2px;min-width:16px;height:16px;padding:0 3px;border-radius:4px;background:rgba(22,20,15,.82);color:#fff;font-size:10px;font-weight:700;line-height:16px;text-align:center;">${idx + 1}</span>
      </div>`;
  }).join('');

  bar.innerHTML = `
    <div style="display:flex;flex-direction:column;gap:.5rem;padding:.55rem .7rem;background:#f4f1ea;border:1px solid #e5e0d5;border-radius:.6rem;">
      <div style="display:flex;align-items:center;gap:.5rem;flex-wrap:wrap;">
        <strong style="font-size:.82rem;">▤ Carrossel</strong>
        <span style="font-size:.78rem;color:#6a6356;">Slide ${i + 1} de ${n}</span>
        <div style="margin-left:auto;display:flex;gap:.3rem;">
          <button type="button" class="btn btn-sm" id="p-slide-prev" title="Slide anterior" ${i <= 0 ? 'disabled' : ''}>‹</button>
          <button type="button" class="btn btn-sm" id="p-slide-next" title="Próximo slide" ${i >= n - 1 ? 'disabled' : ''}>›</button>
        </div>
      </div>
      <div id="p-slide-chips" style="display:flex;gap:.4rem;flex-wrap:wrap;align-items:flex-start;">${chips}</div>
      <div style="display:flex;gap:.3rem;flex-wrap:wrap;align-items:center;">
        <button type="button" class="btn btn-sm" id="p-slide-add" title="Adicionar slide">＋ Slide</button>
        <button type="button" class="btn btn-sm" id="p-slide-dup" title="Duplicar este slide">⧉ Duplicar</button>
        <button type="button" class="btn btn-sm" id="p-slide-left" title="Mover para a esquerda" ${i <= 0 ? 'disabled' : ''}>◀</button>
        <button type="button" class="btn btn-sm" id="p-slide-right" title="Mover para a direita" ${i >= n - 1 ? 'disabled' : ''}>▶</button>
        <button type="button" class="btn btn-sm btn-danger" id="p-slide-del" title="Remover slide" style="margin-left:auto;" ${n <= 1 ? 'disabled' : ''}>🗑</button>
      </div>
    </div>`;

  bar.querySelectorAll('.p-slide-chip').forEach(el => {
    const idx = parseInt(el.dataset.si, 10);
    el.onclick = () => switchSlide(p, idx);
    el.ondragstart = (e) => {
      _carouselDragSrc = idx;
      if (e.dataTransfer) { e.dataTransfer.effectAllowed = 'move'; try { e.dataTransfer.setData('text/plain', String(idx)); } catch (_) { /* noop */ } }
      el.style.opacity = '0.45';
    };
    el.ondragend = () => { el.style.opacity = ''; _carouselDragSrc = null; };
    el.ondragover = (e) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = 'move'; el.style.outline = '2px dashed #b8341c'; el.style.outlineOffset = '1px'; };
    el.ondragleave = () => { el.style.outline = ''; };
    el.ondrop = (e) => {
      e.preventDefault(); el.style.outline = '';
      let from = _carouselDragSrc;
      if ((from == null || Number.isNaN(from)) && e.dataTransfer) from = parseInt(e.dataTransfer.getData('text/plain'), 10);
      reorderSlides(p, from, idx);
    };
  });
  const on = (id, fn) => { const el = $(`#${id}`); if (el) el.onclick = fn; };
  on('p-slide-prev', () => switchSlide(p, (p.slideIndex || 0) - 1));
  on('p-slide-next', () => switchSlide(p, (p.slideIndex || 0) + 1));
  on('p-slide-add', () => addSlide(p, false));
  on('p-slide-dup', () => addSlide(p, true));
  on('p-slide-left', () => moveSlide(p, -1));
  on('p-slide-right', () => moveSlide(p, 1));
  on('p-slide-del', () => removeSlide(p));
}

/* -------------------------------------------------------------------------- */
/* Exportação em sequência (carrossel-01.png, -02.png, …)                      */
/* -------------------------------------------------------------------------- */

async function waitForStageImages() {
  const imgs = [...document.querySelectorAll('#p-stage img')];
  await Promise.all(imgs.map(img => (img.complete && img.naturalWidth)
    ? Promise.resolve()
    : new Promise(res => { img.onload = res; img.onerror = res; })));
}

/* --- ZIP método "store" (sem compressão/dependências): PNG já é comprimido --- */
function _crc32(buf) {
  if (!_crc32.t) {
    const t = _crc32.t = new Uint32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
  }
  const t = _crc32.t;
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) crc = t[(crc ^ buf[i]) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function _zipStore(files) {
  const u16 = (n) => [n & 0xFF, (n >>> 8) & 0xFF];
  const u32 = (n) => [n & 0xFF, (n >>> 8) & 0xFF, (n >>> 16) & 0xFF, (n >>> 24) & 0xFF];
  const enc = new TextEncoder();
  const parts = [];
  const central = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const crc = _crc32(f.data);
    const size = f.data.length;
    const local = new Uint8Array([].concat(
      u32(0x04034b50), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size), u16(name.length), u16(0)
    ));
    parts.push(local, name, f.data);
    central.push(new Uint8Array([].concat(
      u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(0), u16(0),
      u32(crc), u32(size), u32(size),
      u16(name.length), u16(0), u16(0), u16(0), u16(0), u32(0), u32(offset)
    )), name);
    offset += local.length + name.length + size;
  }
  const cdStart = offset;
  let cdSize = 0;
  for (const c of central) cdSize += c.length;
  const eocd = new Uint8Array([].concat(
    u32(0x06054b50), u16(0), u16(0), u16(files.length), u16(files.length),
    u32(cdSize), u32(cdStart), u16(0)
  ));
  const all = [...parts, ...central, eocd];
  let total = 0;
  for (const a of all) total += a.length;
  const out = new Uint8Array(total);
  let pos = 0;
  for (const a of all) { out.set(a, pos); pos += a.length; }
  return out;
}

function _canvasToBytes(canvas) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('toBlob falhou')); return; }
      try { resolve(new Uint8Array(await blob.arrayBuffer())); } catch (e) { reject(e); }
    }, 'image/png');
  });
}

async function exportCarousel(p, mode) {
  if (!posterIsCarousel(p)) return exportPoster(p);
  mode = mode || 'zip';
  const slides = p.slides;
  toast(`Gerando carrossel (${slides.length} slides)…`, 'info');
  const prevIndex = p.slideIndex || 0;
  const files = [];
  try {
    for (let idx = 0; idx < slides.length; idx++) {
      const slide = slides[idx];
      const fmt = (typeof POSTER_FORMATS !== 'undefined' && POSTER_FORMATS[slide.format]) || posterActiveFormat();
      renderPosterTemplate({ ...slide, theme: p.theme, custom: p.custom, portalSnapshot: p.portalSnapshot, _idx: idx + 1, _total: slides.length });
      // espera layout + imagens decodificarem antes de capturar
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await waitForStageImages();
      const canvas = await captureStageCanvas(fmt);
      if (canvas) files.push({ name: `carrossel-${String(idx + 1).padStart(2, '0')}.png`, data: await _canvasToBytes(canvas) });
    }
    if (!files.length) { toast('Não foi possível exportar o carrossel.', 'error'); return; }
    const base = (slides[0].headline || 'carrossel').slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'export';

    if (mode === 'images') {
      // Opção 1 — baixar cada slide como imagem separada
      for (const f of files) {
        const url = URL.createObjectURL(new Blob([f.data], { type: 'image/png' }));
        const link = document.createElement('a');
        link.download = f.name;
        link.href = url;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        await new Promise(r => setTimeout(r, 300)); // espaça os downloads
      }
      toast(`Carrossel exportado (${files.length} imagens).`, 'success');
    } else {
      // Opção 2 — empacotar todos os PNGs num único .zip
      const zip = _zipStore(files);
      const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.download = `carrossel-${base}.zip`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(`Carrossel exportado (${files.length} imagens no .zip).`, 'success');
    }
  } catch (err) {
    toast('Não foi possível exportar o carrossel: ' + err.message, 'error');
  } finally {
    // restaura o slide ativo no preview
    p.slideIndex = prevIndex;
    renderPosterTemplate({ ...getSlide(p), theme: p.theme, custom: p.custom, portalSnapshot: p.portalSnapshot, _idx: (p.slideIndex || 0) + 1, _total: p.slides.length });
    fitPosterPreview();
  }
}
