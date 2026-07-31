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

/** Máximo de slides de CORPO no carrossel automático. Um carrossel de 40 telas
 *  não se publica em rede nenhuma, então o teto existe de propósito — o que não
 *  pode é o texto que sobra sumir sem o usuário saber. */
const CAROUSEL_MAX_BODY_SLIDES = 10;

/**
 * ESTRUTURA PADRÃO do carrossel automático (usuário pode editar tudo depois):
 *   • 1º slide  → "Foto em destaque" (capa, destaque visual)
 *   • intermediários → "Texto / parágrafo" (corpo COMPLETO, agrupado por orçamento)
 *   • último slide → "Cor sólida" (encerramento / CTA)
 * Formato inicial padrão = 1:1 (quadrado) em todos os slides.
 *
 * O array devolvido carrega `slidesOmitidos` (não-enumerável): quantos grupos de
 * corpo o teto deixou de fora, para quem chamou poder avisar.
 */
function splitIntoSlides(art, portal, fmt) {
  fmt = fmt || '1:1';
  const title = (art.title || '').trim();
  const subtitle = (art.subtitle || '').trim();
  const category = (art.category || 'RESUMO');
  const location = (art.location || '');
  const slides = [];

  // 1) CAPA — Foto em destaque (o usuário adiciona a imagem; sem ela mostra placeholder)
  slides.push(makeSlide({ template: 'destaque-foto', format: fmt, headline: title || 'Título', subtitle, category, location }));

  // 2) INTERMEDIÁRIOS — Texto/parágrafo: corpo COMPLETO (mesma regra do cartaz)
  const paras = (art.bodyParagraphs && art.bodyParagraphs.length) ? art.bodyParagraphs.slice() : (art.body ? [art.body] : []);
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
  // Teto de slides de corpo: um carrossel de 40 telas não se publica. O teto é
  // decisão de desenho e fica — mas o que sobra NÃO pode desaparecer calado.
  // Matéria de 60 parágrafos perdia 2/3 do texto sem uma linha de aviso; quem
  // exportava só descobria contando os slides. `slidesOmitidos` leva o número
  // para quem chamou avisar o usuário (ver createCarouselFromGeneration).
  const limited = groups.slice(0, CAROUSEL_MAX_BODY_SLIDES);
  const omitidos = groups.length - limited.length;
  limited.forEach(g => slides.push(makeSlide({ template: 'texto', format: fmt, category, headline: '', description: g })));
  if (!limited.length && subtitle) {
    slides.push(makeSlide({ template: 'texto', format: fmt, category, headline: '', description: subtitle }));
  }

  // 3) FECHAMENTO — Cor sólida (encerramento / CTA)
  slides.push(makeSlide({
    template: 'cor-solida', format: fmt, category: '',
    headline: (portal && portal.name) || 'Acompanhe',
    subtitle: art.cta || ('Siga ' + ((portal && portal.handle) || '@portal') + ' para mais.'),
  }));

  // Propriedade NÃO-ENUMERÁVEL: o array de slides é serializado para o
  // IndexedDB e percorrido em vários lugares; um índice extra visível viraria
  // slide fantasma. Assim o dado viaja até quem avisa e desaparece do JSON.
  Object.defineProperty(slides, 'slidesOmitidos', { value: omitidos, enumerable: false });
  return slides;
}

/** Cria um CARROSSEL a partir de uma geração/conteúdo (mesma regra do cartaz). */
function createCarouselFromGeneration(g) {
  // Pipeline traz campos estruturados; gerações antigas reparseiam o texto plano.
  const art = (g.article && typeof artFromPipeline === 'function' && artFromPipeline(g)) || parseArticle(g.content);
  const portal = State.portals[State.activePortalIndex] || State.portals[0] || {};
  const slides = splitIntoSlides(art, portal, '1:1');

  const poster = Object.assign(makeSlide({
    template: 'destaque-foto', format: '1:1',
    headline: art.title || '',
    category: art.category || 'GERAL',
    location: art.location || '',
    subtitle: art.subtitle || '',
    description: art.body || '',                   // corpo completo também no topo
    footer: art.cta || '',
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
  savePosters();   // usa o offload de imagens (Blob) — consistente com o cartaz
  State.activePosterId = poster.id;
  _peOpen = true;  // handoff (matéria → carrossel) abre direto o editor
  // Matéria comprida não cabe em 10 slides de corpo. O texto completo continua
  // no campo "Texto longo" da peça, então nada se perde do projeto — mas o
  // usuário precisa saber que os slides não trazem a matéria inteira.
  const omitidos = slides.slidesOmitidos || 0;
  if (omitidos > 0) {
    toast(`Carrossel criado com ${CAROUSEL_MAX_BODY_SLIDES} slides de texto — a matéria é longa e ` +
      `${omitidos} bloco${omitidos > 1 ? 's' : ''} de texto ${omitidos > 1 ? 'ficaram' : 'ficou'} de fora. ` +
      'O texto completo está em "Texto longo", na aba Texto.', 'info', 9000);
  } else {
    toast('Carrossel criado.', 'success');
  }
  goTo('posters');
}

/* -------------------------------------------------------------------------- */
/* Edição manual de slides                                                     */
/* -------------------------------------------------------------------------- */

// Persiste pelo MESMO caminho escalável dos cartazes: índice leve + imagens (Blob)
// no IndexedDB (limite = dispositivo). Antes gravava State.posters inteiro — com
// imagens base64 inline — direto no localStorage (~5 MB), o que enchia rápido.
function persistPosters() { if (typeof savePosters === 'function') savePosters(); }

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

  // O botão "Transformar em carrossel" (menu ⋯) só aparece na peça única (r112).
  const toCar = $('#et-to-carousel');
  if (toCar) toCar.classList.toggle('hidden', posterIsCarousel(p));

  if (!posterIsCarousel(p)) {
    // Peça única: sem barra na área de edição (r112). A ação "Transformar em
    // carrossel" mora no menu ⋯ (#et-to-carousel). #p-carousel-bar:empty some via CSS.
    bar.innerHTML = '';
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
    try {
      const draw = () => tpl.render({ ...sl, portalSnapshot: p.portalSnapshot, _idx: idx + 1, _total: p.slides.length }, fmt, portal);
      inner = tpl ? (typeof renderTemplateDeduped === 'function' ? renderTemplateDeduped(draw) : draw()) : '';
    } catch (e) { inner = ''; }
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

function _canvasToBytes(canvas, mime, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob(async (blob) => {
      if (!blob) { reject(new Error('toBlob falhou')); return; }
      try { resolve(new Uint8Array(await blob.arrayBuffer())); } catch (e) { reject(e); }
    }, mime || 'image/png', quality);
  });
}

async function exportCarousel(p, mode, scale, fileType) {
  if (!posterIsCarousel(p)) return exportPoster(p, scale, fileType);
  mode = mode || 'zip';
  const jpg = fileType === 'jpg' || fileType === 'jpeg';
  const mime = jpg ? 'image/jpeg' : 'image/png';
  const ext = jpg ? 'jpg' : 'png';
  const slides = p.slides;
  // Progresso: um ÚNICO toast que se atualiza por slide (não spamma a pilha).
  const progEl = document.createElement('div');
  progEl.className = 'toast info';
  const progMsg = document.createElement('div');
  progMsg.className = 'flex-1';
  progEl.appendChild(progMsg);
  const stack = document.querySelector('#toast-stack');
  if (stack) stack.appendChild(progEl);
  const setProg = (i) => { progMsg.textContent = `Gerando carrossel… slide ${i}/${slides.length}`; };
  setProg(0);
  const prevIndex = p.slideIndex || 0;
  const files = [];
  const naoCapturados = [];   // slides que o html2canvas não conseguiu desenhar
  // Cobre a prévia durante TODO o loop — sem isso o palco pisca a cada slide
  // (troca de slide + zoom da captura). (ref-count: as capturas internas somam.)
  if (typeof showStageCaptureCover === 'function') showStageCaptureCover();
  try {
    for (let idx = 0; idx < slides.length; idx++) {
      const slide = slides[idx];
      setProg(idx + 1);
      const fmt = (typeof POSTER_FORMATS !== 'undefined' && POSTER_FORMATS[slide.format]) || posterActiveFormat();
      renderPosterTemplate({ ...slide, theme: p.theme, custom: p.custom, portalSnapshot: p.portalSnapshot, _idx: idx + 1, _total: slides.length });
      // espera layout + imagens decodificarem antes de capturar
      await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));
      await waitForStageImages();
      const canvas = await captureStageCanvas(fmt, scale);
      if (canvas) files.push({ name: `carrossel-${String(idx + 1).padStart(2, '0')}.${ext}`, data: await _canvasToBytes(canvas, mime, jpg ? 0.92 : undefined) });
      else naoCapturados.push(idx + 1);
    }
    if (!files.length) { toast(libReady('html2canvas') ? 'Não foi possível exportar o carrossel.' : libUnavailableMsg('html2canvas'), 'error', 6000); return; }
    // Um slide que não captura era simplesmente PULADO: o usuário recebia um
    // carrossel de 10 imagens quando pediu 11 e nada dizia qual faltou. Se o
    // conjunto saiu incompleto, ele precisa saber ANTES de publicar.
    if (naoCapturados.length) {
      toast(`Atenção: ${naoCapturados.length} de ${slides.length} slides não foram gerados ` +
        `(slide ${naoCapturados.join(', ')}). O arquivo saiu incompleto — reabra o carrossel e exporte de novo.`,
      'error', 9000);
    }
    const base = (slides[0].headline || 'carrossel').slice(0, 40).replace(/[^a-z0-9]/gi, '-').toLowerCase() || 'export';

    if (mode === 'images') {
      // Opção 1 — imagens separadas. Mostra a PRÉVIA de todos os slides + botão
      // salvar/compartilhar. No iPhone o botão dispara a folha "Salvar Imagem"
      // (galeria, todos de uma vez); no desktop baixa cada um. O salvamento
      // precisa ser uma ação nova do usuário (o iOS bloqueia share automático
      // logo após gerar os slides).
      const imgs = files.map((f) => ({ name: f.name, blob: new Blob([f.data], { type: mime }) }));
      if (progEl && progEl.parentNode) progEl.remove(); // fecha o progresso antes da prévia
      if (typeof presentExport === 'function') {
        presentExport(imgs, { title: 'Carrossel pronto', subtitle: `${files.length} imagens — confira e salve na galeria.` });
      } else if (typeof saveImagesToDevice === 'function') {
        await saveImagesToDevice(imgs, 'Carrossel');
      }
    } else {
      // Opção 2 — empacotar todos os PNGs num único .zip
      const zip = _zipStore(files);
      const url = URL.createObjectURL(new Blob([zip], { type: 'application/zip' }));
      const link = document.createElement('a');
      link.download = `carrossel-${base}.zip`;
      link.href = url;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
      toast(`Carrossel baixado (${files.length} imagens no .zip).`, 'success');
    }
  } catch (err) {
    toast('Não foi possível exportar o carrossel: ' + err.message, 'error');
  } finally {
    if (progEl && progEl.parentNode) progEl.remove();
    // restaura o slide ativo no preview
    p.slideIndex = prevIndex;
    renderPosterTemplate({ ...getSlide(p), theme: p.theme, custom: p.custom, portalSnapshot: p.portalSnapshot, _idx: (p.slideIndex || 0) + 1, _total: p.slides.length });
    fitPosterPreview();
    if (typeof hideStageCaptureCover === 'function') hideStageCaptureCover(true); // solta a cobertura só depois de restaurar o preview
  }
}
