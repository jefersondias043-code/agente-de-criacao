/* ============================================================================
 * poster-templates.js — Catálogo de FORMATOS e MODELOS (templates) de cartaz.
 *
 * Filosofia: todos os modelos leem dos MESMOS campos do cartaz
 * (headline, category, subtitle, description, location, image1..4, avatar,
 *  portalSnapshot) — o auto-preenchimento e a edição manual valem para QUALQUER
 * modelo; só muda a composição visual.
 *
 * Contrato de cada modelo:
 *   render(p, fmt, portal) -> string HTML cujo nó raiz tem class="poster-1440"
 *   (gancho de exportPoster()/fitPosterPreview(); dims reais vêm de fmt.w x fmt.h).
 *   Campos opcionais de carrossel: p._idx (1-based) e p._total habilitam o
 *   numerador "01/05".
 *
 * DIREÇÃO DE ARTE (sistema PT) — "editorial contemporâneo, ousado":
 *   color-blocking decisivo, escala tipográfica dramática, layering com grafismos
 *   (numerais/aspas gigantes, blocos sólidos), grid firme e respiro ativo. Três
 *   vozes: Fraunces (serifada de display), Oswald (condensada de impacto),
 *   IBM Plex (texto/rótulo). Tudo com técnicas seguras p/ html2canvas
 *   (blocos sólidos, gradientes lineares, bordas, SVG, tipografia) — sem
 *   blend-mode/filter/background-clip:text (não exportam).
 *
 * Imagens arrastáveis: usar posterImageLayer() (mantém data-draggable /
 * data-zoomscale / object-position p/ pan + flatten do exportPoster()).
 * ==========================================================================*/

/* Formatos de publicação (largura fixa 1080; altura varia). */
const POSTER_FORMATS = {
  '3:4':  { w: 1080, h: 1440, label: 'Retrato 3:4',  hint: 'Feed (padrão)' },
  '4:5':  { w: 1080, h: 1350, label: 'Vertical 4:5', hint: 'Instagram' },
  '1:1':  { w: 1080, h: 1080, label: 'Quadrado 1:1', hint: 'Feed' },
  '9:16': { w: 1080, h: 1920, label: 'Story 9:16',   hint: 'Stories / Reels' },
};

/* Tokens de design — TEMA POR PORTAL.
 * `PT` é o tema ATIVO (mutável): `applyPortalTheme(portal)` copia para dentro dele
 * o preset do tema do portal antes de cada render, então TODOS os modelos (que leem
 * `PT.*`) se adaptam sem mudar. Os nomes antigos (ink/paper/cream/terra/serif/cond)
 * são ALIAS — modelos escuros e tipografia seguem o tema automaticamente.
 * Temas: 'municipios-bahia' (marca: navy + vermelho/laranja + símbolo M + Poppins)
 * e 'neutral' (grafite sóbrio + cinza-aço + sigla — para portais sem identidade). */
const POPPINS = "'Poppins', system-ui, sans-serif";
function makeTheme(s) {
  const light = !!s.light;                       // tema de FUNDO CLARO?
  // texto primário sobre a PÁGINA (tema pode customizar — ex.: navy premium)
  const txt = s.text || (light ? '#1E1E1E' : '#FFFFFF');
  const trgb = s.textRgb || (light ? '30,30,30' : '255,255,255');
  const txtMut = light ? `rgba(${trgb},0.62)` : `rgba(${trgb},0.66)`;
  const txtSoft = `rgba(${trgb},0.80)`;
  const txtFaint = light ? `rgba(${trgb},0.42)` : `rgba(${trgb},0.40)`;
  const hair = light ? `rgba(${trgb},0.12)` : `rgba(${trgb},0.16)`;
  return {
    name: s.name, symbol: s.symbol, light,
    navy: s.bg, navy2: s.bg2, navySoft: s.bg2,
    red: s.accent, orange: s.accent2, redDeep: s.accentDeep, white: '#FFFFFF',
    grad: `linear-gradient(120deg,${s.accent} 0%,${s.accent2} 100%)`,
    gradSolid: s.gradSolid, gradDark: s.gradDark,
    // fundos (página = bg; cards/painéis = bg2)
    paper: s.bg, paper2: s.bg2, sand: s.bg2, sandDeep: s.bgDeep || s.bg,
    ink: s.bg, inkPanel: s.bg2, inkSoft: txtSoft,
    // texto/linhas sobre a PÁGINA (grafite no claro; branco no escuro)
    cream: txt, creamMute: txtMut, creamLine: hair,
    muted: txtMut, faint: txtFaint, line: hair,
    // texto/elementos sobre SUPERFÍCIE ESCURA (foto, chip escuro, bloco vermelho) — SEMPRE branco
    onDark: '#FFFFFF', onDarkMut: 'rgba(255,255,255,0.72)', onDarkLine: 'rgba(255,255,255,0.22)',
    // moldura do símbolo M — sempre ESCURA (o traço branco do M sumiria no claro); tema pode definir
    symbolBg: s.symbolBg || (light ? '#1E1E1E' : s.bg2),
    terra: s.accent, terraDeep: s.accentDeep, terraSoft: s.accentSoft, redOnDark: s.accent2,
    display: s.display || POPPINS, serif: s.display || POPPINS, cond: s.display || POPPINS,
    sans: "'IBM Plex Sans', system-ui, sans-serif",
  };
}
const PT_THEMES = {
  'municipios-bahia': makeTheme({
    name: 'Municípios Bahia — Institucional', bg: '#0B1421', bg2: '#152133', bgDeep: '#080F18',
    accent: '#E30613', accent2: '#FF7A00', accentDeep: '#A60410', accentSoft: 'rgba(227,6,19,0.18)',
    gradSolid: 'linear-gradient(150deg,#FF7A00 0%,#E30613 52%,#A60410 100%)',
    gradDark: 'linear-gradient(155deg,#152133 0%,#0B1421 58%,#080F18 100%)',
    symbol: 'mb', display: POPPINS,
  }),
  // Versão EDITORIAL/BLOG: vermelho protagonista, fundos CLAROS (branco/cinza), grafite no texto.
  'municipios-bahia-blog': makeTheme({
    name: 'Municípios Bahia — Editorial', light: true, bg: '#FFFFFF', bg2: '#F4F5F7', bgDeep: '#ECEEF2',
    accent: '#E30613', accent2: '#FF3B30', accentDeep: '#B80010', accentSoft: 'rgba(227,6,19,0.14)',
    gradSolid: 'linear-gradient(150deg,#FF3B30 0%,#E30613 50%,#B80010 100%)',
    gradDark: 'linear-gradient(155deg,#FFFFFF 0%,#F4F5F7 60%,#ECEEF2 100%)',
    symbol: 'mb', display: POPPINS,
  }),
  // Versão RUBI: VERMELHO protagonista (fundo ~60%), NAVY de apoio (painéis ~20%),
  // LARANJA acento (~10%). Mesma marca/tipografia; só muda o peso das cores.
  'municipios-bahia-rubi': makeTheme({
    name: 'Municípios Bahia — Rubi', bg: '#E30613', bg2: '#0B1421', bgDeep: '#B80010',
    accent: '#FF7A00', accent2: '#FF7A00', accentDeep: '#B80010', accentSoft: 'rgba(255,122,0,0.20)',
    gradSolid: 'linear-gradient(150deg,#FF7A00 0%,#E30613 50%,#B80010 100%)',
    gradDark: 'linear-gradient(155deg,#152133 0%,#0B1421 58%,#080F18 100%)',
    symbol: 'mb', display: POPPINS,
  }),
  // Versão AURORA: LARANJA protagonista sobre fundos CLAROS (branco), navy de apoio,
  // vermelho terciário (breaking). Leve, moderna, "produto digital premium".
  'municipios-bahia-aurora': makeTheme({
    name: 'Municípios Bahia — Aurora', light: true, bg: '#FFFFFF', bg2: '#F4F5F7', bgDeep: '#ECEEF2',
    accent: '#FF7A00', accent2: '#E30613', accentDeep: '#B85800', accentSoft: 'rgba(255,122,0,0.16)',
    gradSolid: 'linear-gradient(150deg,#FF7A00 0%,#E30613 100%)',
    gradDark: 'linear-gradient(155deg,#FFFFFF 0%,#FFF4EC 55%,#F4F5F7 100%)',
    symbol: 'mb', symbolBg: '#0B1421', display: POPPINS,
  }),
  // Versão SIGNATURE LIGHT: BRANCO estrutura (55%), VERMELHO identidade (20%),
  // LARANJA energia (15%), NAVY refinamento (10% — TIPOGRAFIA premium em navy).
  // Mínima, premium, sem grandes blocos de cor.
  'municipios-bahia-signature': makeTheme({
    name: 'Municípios Bahia — Signature', light: true, bg: '#FFFFFF', bg2: '#F4F5F7', bgDeep: '#ECEEF2',
    text: '#0B1421', textRgb: '11,20,33',
    accent: '#E30613', accent2: '#FF7A00', accentDeep: '#B80010', accentSoft: 'rgba(227,6,19,0.12)',
    gradSolid: 'linear-gradient(150deg,#E30613 0%,#FF7A00 100%)',
    gradDark: 'linear-gradient(155deg,#FFFFFF 0%,#FBFBFC 55%,#F4F5F7 100%)',
    symbol: 'mb', symbolBg: '#0B1421', display: POPPINS,
  }),
  'neutral': makeTheme({
    name: 'Neutro', bg: '#171A21', bg2: '#232833', bgDeep: '#10131A',
    accent: '#8A97AC', accent2: '#C9D2DF', accentDeep: '#5A6577', accentSoft: 'rgba(138,151,172,0.18)',
    gradSolid: 'linear-gradient(150deg,#3A4252 0%,#262B36 60%,#1A1E26 100%)',
    gradDark: 'linear-gradient(155deg,#232833 0%,#171A21 58%,#10131A 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
};
// Tema ATIVO (mutado por applyTheme antes de cada render). Default = institucional.
let PT = Object.assign({}, PT_THEMES['municipios-bahia']);
function applyTheme(id) {
  Object.assign(PT, PT_THEMES[id] || PT_THEMES['municipios-bahia']);
}
function applyPortalTheme(portal) { applyTheme(portal && portal.theme); }

/* VISIBILIDADE POR ELEMENTO — conjunto OCULTO ativo (espelha o `PT` do tema).
 * `setPosterHidden(p)` é chamado junto de `applyTheme` antes de cada render;
 * `posterShow(key)` é consultado pelos helpers e modelos. O usuário oculta
 * elementos (olho no editor) SEM apagar o dado; como o export fotografa o DOM
 * já filtrado, preview ≡ PNG. Chaves: headline/subtitle/category/location/
 * personName/personRole/figure/logo/portalName/handle/tagline/header/footer/
 * counter/graphics. */
let PT_HIDDEN = new Set();
function setPosterHidden(p) { PT_HIDDEN = new Set(Array.isArray(p && p.hidden) ? p.hidden : []); }
function posterShow(key) { return !PT_HIDDEN.has(key); }

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function num2(n) { return String(n || 0).padStart(2, '0'); }

/** Símbolo "M" da marca Municípios Bahia: duas fitas formando o M — traço esquerdo
 * com gradiente vermelho→laranja, traço direito branco. Gerado como PNG em CANVAS
 * (NÃO svg inline — o html2canvas TRAVA ao serializar SVG com gradiente) e embutido
 * como <img> data-url (cacheado por variante). opts: size, onSquare, squareFill. */
const _mbCache = {};
function _mbRoundRect(x, X, Y, W, H, r) {
  if (x.roundRect) { x.beginPath(); x.roundRect(X, Y, W, H, r); return; }
  x.beginPath(); x.moveTo(X + r, Y); x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r); x.arcTo(X, Y + H, X, Y, r); x.arcTo(X, Y, X + W, Y, r); x.closePath();
}
function _mbDataUrl(onSquare, squareFill) {
  const N = 220, c = document.createElement('canvas'); c.width = c.height = N;
  const x = c.getContext('2d');
  if (onSquare) { x.fillStyle = squareFill || PT.navy2; _mbRoundRect(x, 6, 6, N - 12, N - 12, N * 0.22); x.fill(); }
  x.lineWidth = N * 0.135; x.lineCap = 'round'; x.lineJoin = 'round';
  // M CANÔNICO: vermelho→laranja fixos (a logomarca é idêntica em TODOS os temas).
  const grad = x.createLinearGradient(0.2 * N, 0.1 * N, 0.5 * N, 0.9 * N);
  grad.addColorStop(0, '#E30613'); grad.addColorStop(1, '#FF7A00');
  x.strokeStyle = grad;
  x.beginPath(); x.moveTo(0.23 * N, 0.78 * N); x.lineTo(0.32 * N, 0.26 * N); x.lineTo(0.50 * N, 0.53 * N); x.stroke();
  x.strokeStyle = '#FFFFFF';
  x.beginPath(); x.moveTo(0.50 * N, 0.53 * N); x.lineTo(0.68 * N, 0.26 * N); x.lineTo(0.77 * N, 0.78 * N); x.stroke();
  return c.toDataURL('image/png');
}
function MB_SYMBOL(opts) {
  opts = opts || {};
  const s = opts.size || 96;
  const onSquare = opts.onSquare !== false;
  const fill = opts.squareFill || PT.navy2;
  const key = (onSquare ? '1' : '0') + fill;   // traços fixos; varia só a moldura
  try { if (!_mbCache[key]) _mbCache[key] = _mbDataUrl(onSquare, fill); } catch (e) { return ''; }
  return `<img src="${_mbCache[key]}" width="${s}" height="${s}" style="width:${s}px;height:${s}px;display:block;flex-shrink:0;" alt="" />`;
}

/** Bloco de logo: imagem do portal → símbolo "M" (tema MB) → caixa com a SIGLA. */
function posterLogoBlock(portal, size, variant) {
  if (!posterShow('logo')) return '';
  const s = size || 96;
  const r = Math.round(s * 0.2);
  if (portal && portal.logo) {
    // data-logo-cover/data-radius: o export (captureStageCanvas) "achata" a logo num
    // canvas com cover + cantos arredondados — o html2canvas 1.4.1 IGNORA object-fit
    // e ESTICARIA a logo (não-quadrada) no PNG. No preview, object-fit:cover já vale.
    return `<img src="${portal.logo}" data-logo-cover="1" data-radius="${r}" style="width:${s}px;height:${s}px;border-radius:${r}px;object-fit:cover;display:block;flex-shrink:0;" alt="" crossorigin="anonymous" />`;
  }
  // Símbolo M só no tema Municípios Bahia; outros temas usam a sigla.
  if (PT.symbol === 'mb') {
    return MB_SYMBOL({ size: s, onSquare: variant !== 'plain', squareFill: variant === 'terra' ? PT.red : PT.symbolBg, radius: Math.round(s * 0.22) });
  }
  const fs = Math.round(s * 0.4);
  return `<div style="width:${s}px;height:${s}px;border-radius:${r}px;background:${PT.navy2};color:${PT.cream};display:flex;align-items:center;justify-content:center;font-family:${PT.display};font-weight:800;font-size:${fs}px;line-height:1;letter-spacing:-0.02em;flex-shrink:0;">${escapeHtml((portal && portal.acronym) || 'MB')}</div>`;
}

/** Camada de imagem arrastável (zoom + pan), compatível com pan/export. */
function posterImageLayer(p, key) {
  const src = p[key];
  if (!src) return '';
  const px = p[key + 'PosX'] ?? 50;
  const py = p[key + 'PosY'] ?? 50;
  const sc = p[key + 'Scale'] ?? 1;
  // Pan+zoom via transform (translate+scale) no wrapper — aplicado por
  // applyImageTransform() após o load (precisa do tamanho natural). object-position
  // fica fixo no centro: o enquadramento todo vem do transform, garantindo ganho
  // uniforme e bordas alcançáveis em qualquer formato/template.
  return `<div data-zoomscale="${sc}" style="width:100%;height:100%;transform:translate(0px,0px) scale(${sc});transform-origin:center center;display:flex;align-items:center;justify-content:center;">
      <img src="${src}" data-draggable="${key}" data-posx="${px}" data-posy="${py}" data-scale="${sc}" style="width:100%;height:100%;object-fit:cover;object-position:50% 50%;cursor:grab;display:block;user-select:none;-webkit-user-drag:none;touch-action:none;" alt="" crossorigin="anonymous" />
    </div>`;
}

/** Placeholder de foto (sem imagem) — escuro e intencional. */
function posterPhotoPlaceholder() {
  return `<div style="width:100%;height:100%;background:linear-gradient(150deg,#152133 0%,#0B1421 100%);display:flex;align-items:center;justify-content:center;color:rgba(255,255,255,0.4);font-family:${PT.sans};font-size:22px;font-weight:500;letter-spacing:0.06em;">
      <div style="text-align:center;">
        <svg width="74" height="74" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" style="margin-bottom:14px;"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        <div>adicione a imagem de destaque</div>
      </div>
    </div>`;
}

/** Chaves de imagem ATIVAS de um cartaz/slide: image1..4 que têm conteúdo E não
 * estão desativadas (p.imagesOff). O usuário liga/desliga imagens sem apagá-las
 * (toggle nas miniaturas) → modelos e mosaico usam só as ativas. */
function posterImageKeys(p) {
  const off = Array.isArray(p && p.imagesOff) ? p.imagesOff : [];
  return ['image1', 'image2', 'image3', 'image4'].filter(k => p[k] && !off.includes(k));
}

/**
 * Mosaico inteligente de 1–4 imagens (cada uma arrastável via posterImageLayer).
 * Preenche o container POSICIONADO onde for usado (retorna position:absolute;inset:0).
 * Adapta a composição à quantidade de imagens ATIVAS (posterImageKeys):
 *   1 → única; 2 → opt.two ('row'|'col'); 3 → opt.three ('left'|'top'|'stack'); 4 → grade 2×2.
 * opt.gapColor = cor das junções entre fotos; opt.gap = espessura (px).
 */
function posterPhotoMosaic(p, opt) {
  opt = opt || {};
  const g = ((opt.gap != null) ? opt.gap : 5) + 'px';
  const bg = opt.gapColor || PT.ink;
  const keys = posterImageKeys(p);
  const n = keys.length;
  const cell = (k, flex) => `<div style="flex:${flex || 1};position:relative;overflow:hidden;min-width:0;min-height:0;">${posterImageLayer(p, k)}</div>`;
  const rowOf = (cells, flex) => `<div style="flex:${flex || 1};display:flex;flex-direction:row;gap:${g};min-width:0;min-height:0;">${cells}</div>`;
  const colOf = (cells, flex) => `<div style="flex:${flex || 1};display:flex;flex-direction:column;gap:${g};min-width:0;min-height:0;">${cells}</div>`;
  const frame = (cells, dir) => `<div style="width:100%;height:100%;display:flex;flex-direction:${dir};gap:${g};background:${bg};">${cells}</div>`;
  // Célula DIAGONAL: recortada por polígono. `clip-path` recorta o visual E o
  // hit-testing no preview (pan por imagem segue funcionando); `data-clip` (mesmos
  // pontos %) é lido pelo flatten do export p/ recortar o canvas (diagonal no PNG).
  const clipCell = (k, pts) => {
    const css = pts.split(',').map(s => { const a = s.trim().split(/\s+/); return `${a[0]}% ${a[1]}%`; }).join(', ');
    return `<div data-clip="${pts}" style="position:absolute;inset:0;overflow:hidden;clip-path:polygon(${css});-webkit-clip-path:polygon(${css});">${posterImageLayer(p, k)}</div>`;
  };

  let inner;
  if (n === 0) {
    inner = opt.noPlaceholder ? '' : posterPhotoPlaceholder();
  } else if (n === 1) {
    inner = posterImageLayer(p, keys[0]);
  } else {
    // Modo escolhido pelo usuário (p.mosaic) ou 'auto' (default do template via opt).
    let mode = (p.mosaic && p.mosaic !== 'auto') ? p.mosaic : '';
    if (!mode) {
      mode = (n === 2 ? opt.two : n === 3 ? opt.three : opt.four) || '';
      const compat = { left: 'feature-left', top: 'feature-top', stack: 'col' };
      if (compat[mode]) mode = compat[mode];
      if (!mode) mode = (n === 2 ? 'row' : n === 3 ? 'feature-left' : 'grid');
    }
    inner = buildMosaic(keys, n, mode, { cell, rowOf, colOf, frame, clipCell });
  }
  return `<div style="position:absolute;inset:0;overflow:hidden;background:${bg};">${inner}</div>`;
}

/** Monta o HTML de um mosaico para o modo dado (flex puro — html2canvas-safe). */
function buildMosaic(keys, n, mode, h) {
  const { cell, rowOf, colOf, frame, clipCell } = h;
  const lead = (flex) => cell(keys[0], flex);
  const last = (flex) => cell(keys[n - 1], flex);
  const restCol = () => colOf(keys.slice(1).map(k => cell(k)).join(''));
  const restRow = () => rowOf(keys.slice(1).map(k => cell(k)).join(''));
  const headCol = () => colOf(keys.slice(0, n - 1).map(k => cell(k)).join(''));
  const headRow = () => rowOf(keys.slice(0, n - 1).map(k => cell(k)).join(''));
  const allCells = keys.map(k => cell(k)).join('');
  switch (mode) {
    case 'row': return frame(allCells, 'row');
    case 'col': return frame(allCells, 'column');
    case 'row-wide': return frame(lead(1.7) + (n === 2 ? cell(keys[1]) : restCol()), 'row');
    case 'col-wide': return frame(lead(1.7) + (n === 2 ? cell(keys[1]) : restRow()), 'column');
    case 'feature-left': return frame(lead(1.5) + (n === 2 ? cell(keys[1]) : restCol()), 'row');
    case 'feature-right': return frame((n === 2 ? cell(keys[0]) : headCol()) + last(1.5), 'row');
    case 'feature-top': return frame(lead(1.5) + (n === 2 ? cell(keys[1]) : restRow()), 'column');
    case 'feature-bottom': return frame((n === 2 ? cell(keys[0]) : headRow()) + last(1.5), 'column');
    // ----- DIAGONAIS (células sobrepostas com clip-path; sem `frame`) -----
    // A 1ª imagem é o FUNDO (polígono = retângulo cheio, contínuo atrás), a 2ª
    // recobre um triângulo por cima → divisória "/" ou "\" sem fio na costura.
    case 'diag':      return clipCell(keys[0], '0 0, 100 0, 100 100, 0 100') + clipCell(keys[1], '100 0, 100 100, 0 100');
    case 'diag-back': return clipCell(keys[0], '0 0, 100 0, 100 100, 0 100') + clipCell(keys[1], '0 0, 100 100, 0 100');
    case 'slant':     return slantColumns(keys, n, clipCell);
    case 'grid-top':
      if (n >= 4) return frame(rowOf(cell(keys[0]) + cell(keys[1]), 1.35) + rowOf(cell(keys[2]) + cell(keys[3]), 1), 'column');
      if (n === 3) return frame(rowOf(cell(keys[0]) + cell(keys[1]), 1.35) + cell(keys[2], 1), 'column');
      return frame(allCells, 'row');
    case 'grid':
    default:
      if (n >= 4) return frame(rowOf(cell(keys[0]) + cell(keys[1])) + rowOf(cell(keys[2]) + cell(keys[3])), 'column');
      if (n === 3) return frame(lead(1.5) + rowOf(cell(keys[1]) + cell(keys[2])), 'column');
      return frame(allCells, 'row');
  }
}

/** "Fotos atravessadas": N colunas em paralelogramo com divisórias inclinadas.
 * Topo da fronteira interna desloca +sl%, base −sl% (bordas externas em 0/100).
 * Cada coluna estende a borda direita em `ov`% por baixo da próxima (pintada por
 * cima) p/ não deixar fio do fundo aparecer no antialiasing da costura. */
function slantColumns(keys, n, clipCell, sl) {
  sl = (sl == null) ? 9 : sl;
  const ov = 1.2;
  const bTop = j => (j <= 0) ? 0 : (j >= n) ? 100 : (j / n * 100 + sl);
  const bBot = j => (j <= 0) ? 0 : (j >= n) ? 100 : (j / n * 100 - sl);
  let out = '';
  for (let i = 0; i < n; i++) {
    const last = (i === n - 1);
    const rt = last ? bTop(i + 1) : bTop(i + 1) + ov;
    const rb = last ? bBot(i + 1) : bBot(i + 1) + ov;
    out += clipCell(keys[i], `${bTop(i)} 0, ${rt} 0, ${rb} 100, ${bBot(i)} 100`);
  }
  return out;
}

/** Opções de disposição do mosaico p/ um dado nº de imagens (editor). */
function mosaicOptionsFor(n) {
  const o = [{ v: 'auto', l: 'Automático' }];
  if (n === 2) {
    o.push(
      { v: 'row', l: 'Lado a lado' },
      { v: 'col', l: 'Empilhadas' },
      { v: 'row-wide', l: 'Destaque + apoio (horizontal)' },
      { v: 'col-wide', l: 'Destaque + apoio (vertical)' },
      { v: 'diag', l: 'Diagonal /' },
      { v: 'diag-back', l: 'Diagonal \\' },
      { v: 'slant', l: 'Atravessada' }
    );
  } else if (n === 3) {
    o.push(
      { v: 'feature-left', l: 'Destaque à esquerda' },
      { v: 'feature-right', l: 'Destaque à direita' },
      { v: 'feature-top', l: 'Destaque em cima' },
      { v: 'feature-bottom', l: 'Destaque embaixo' },
      { v: 'row', l: 'Três colunas' },
      { v: 'col', l: 'Três faixas' },
      { v: 'slant', l: 'Atravessadas' }
    );
  } else if (n >= 4) {
    o.push(
      { v: 'grid', l: 'Grade 2×2' },
      { v: 'grid-top', l: 'Grade — topo em destaque' },
      { v: 'feature-left', l: 'Destaque + 3 (lado)' },
      { v: 'feature-top', l: 'Destaque + 3 (abaixo)' },
      { v: 'row', l: 'Quatro colunas' },
      { v: 'col', l: 'Quatro faixas' },
      { v: 'slant', l: 'Atravessadas' }
    );
  }
  return o;
}

/** Kicker (eyebrow): traço de acento + rótulo caixa-alta espaçada. */
function posterKicker(text, opts) {
  opts = opts || {};
  if (!posterShow('category')) return '';
  const t = (text || '').toString().trim().toUpperCase();
  if (!t) return '';
  const color = opts.color || PT.terra;
  const size = opts.size || 23;
  return `<div style="display:flex;align-items:center;gap:14px;min-width:0;">
      <span style="width:${opts.rule || 40}px;height:4px;background:${color};display:inline-block;flex-shrink:0;"></span>
      <span style="font-family:${PT.sans};font-weight:700;font-size:${size}px;letter-spacing:0.26em;text-transform:uppercase;color:${color};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(t)}</span>
    </div>`;
}

/** Lockup de marca (logo + nome + handle) — cada parte respeita seu olho. */
function ptMasthead(portal, opts) {
  opts = opts || {};
  const onDark = opts.onDark != null ? opts.onDark : !PT.light;
  const ink = onDark ? PT.onDark : PT.cream;
  const mut = onDark ? PT.onDarkMut : PT.creamMute;
  const logo = posterLogoBlock(portal, opts.size || 66, onDark ? 'light' : 'dark');   // '' se logo oculto
  const nameHtml = posterShow('portalName') ? `<div style="font-family:${PT.serif};font-weight:800;font-size:${opts.nameSize || 29}px;letter-spacing:-0.01em;color:${ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.name || 'Nome do projeto')}</div>` : '';
  const handleHtml = posterShow('handle') ? `<div style="font-family:${PT.sans};font-weight:600;font-size:18px;letter-spacing:0.04em;color:${mut};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</div>` : '';
  const text = (nameHtml || handleHtml) ? `<div style="min-width:0;line-height:1.08;">${nameHtml}${handleHtml}</div>` : '';
  if (!logo && !text) return '';
  return `<div style="display:flex;align-items:center;gap:16px;min-width:0;">${logo}${text}</div>`;
}

/** Numerador de carrossel "01/05" (só quando p._total). */
function ptCounter(p, opts) {
  if (!p || !p._total || !posterShow('counter')) return '';
  opts = opts || {};
  const onDark = opts.onDark != null ? opts.onDark : !PT.light;
  const strong = opts.color || PT.terra;
  const dim = onDark ? PT.onDarkMut : PT.creamMute;
  return `<div style="font-family:${PT.cond};font-weight:700;font-size:${opts.size || 26}px;letter-spacing:0.1em;color:${dim};white-space:nowrap;">
      <span style="color:${strong};">${num2(p._idx)}</span><span style="opacity:.55;"> / ${num2(p._total)}</span>
    </div>`;
}

/** Badge de categoria (chip). */
function posterBadge(text, bg, fg) {
  return `<span style="display:inline-block;background:${bg};color:${fg};font-family:${PT.sans};font-size:22px;font-weight:700;letter-spacing:0.14em;text-transform:uppercase;border-radius:6px;padding:9px 18px;max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;box-sizing:border-box;">${escapeHtml(text || 'CATEGORIA')}</span>`;
}

/** Pílula de localização (com pin). onDark = sobre foto/escuro. */
function posterLocationPill(loc, onDark) {
  if (!posterShow('location')) return '';
  onDark = (onDark != null ? onDark : !PT.light);
  const bg = onDark ? 'rgba(255,255,255,0.08)' : '#ffffff';
  const fg = onDark ? PT.onDark : PT.cream;
  const border = onDark ? '1px solid rgba(255,255,255,0.20)' : `1px solid ${PT.line}`;
  // SEM box-shadow: o html2canvas 1.4.1 renderiza box-shadow como preenchimento
  // preto translúcido SÓLIDO (acinzenta o elemento no PNG). A borda define a pílula.
  return `<div style="display:inline-flex;align-items:center;gap:9px;background:${bg};color:${fg};border:${border};padding:11px 18px;border-radius:6px;font-family:${PT.sans};font-size:21px;font-weight:600;letter-spacing:0.02em;max-width:100%;overflow:hidden;">
      <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="${PT.orange}" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(loc || 'Localização')}</span>
    </div>`;
}

/** Rodapé-assinatura: hairline + lockup + meta opcional à direita. */
function posterMetaFooter(portal, opts) {
  if (!posterShow('footer')) return '';
  opts = opts || {};
  const onDark = opts.onDark != null ? opts.onDark : !PT.light;
  const mut = onDark ? PT.onDarkMut : PT.creamMute;
  const line = onDark ? PT.onDarkLine : PT.creamLine;
  const right = opts.right
    ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:600;letter-spacing:0.02em;color:${mut};text-align:right;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:44%;">${escapeHtml(opts.right)}</span>`
    : '';
  return `<div style="border-top:1.5px solid ${line};padding-top:22px;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-shrink:0;">
      ${ptMasthead(portal, { onDark, size: opts.logoSize || 52, nameSize: 25 })}
      ${right}
    </div>`;
}

/** Escolhe tamanho de fonte por faixa de comprimento. */
function posterPickSize(text, table, fallback) {
  const len = (text || '').length;
  for (const row of table) { if (len <= row[0]) return row[1]; }
  return fallback;
}

/** Quebra description/subtitle em itens de lista (tópicos). */
function posterBullets(p, max) {
  const raw = (p.description || p.subtitle || '').trim();
  if (!raw) return [];
  const items = /\n/.test(raw) ? raw.split(/\n+/) : raw.split(/(?<=[.!?])\s+/);
  return items
    .map(s => s.replace(/^\s*(?:[-–—*•·]|\d+[.)])\s*/, '').trim())
    .filter(Boolean)
    .slice(0, max || 5);
}

/** Extrai um "número de destaque" (R$, %, milhares, ordinal) de um texto, para o
 * modelo Números & dados quando o usuário não preencheu o campo dedicado. */
function posterFigureExtract(text) {
  const t = (text || '').toString();
  const m = t.match(/(R\$\s?)?\d[\d.,]*\s?(%|mil|milh(?:ões|ão)|bilh(?:ões|ão)|bi|mi)?/i);
  return m ? m[0].trim() : '';
}

/* -------------------------------------------------------------------------- */
/* Modelos                                                                     */
/* -------------------------------------------------------------------------- */

/** Foto em destaque — CAPA: foto full-bleed + bloco editorial sólido embaixo. */
function tplDestaqueFoto(p, fmt, portal) {
  const layer = posterPhotoMosaic(p, { two: 'row', three: 'left', gapColor: PT.ink });
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[42, 86], [85, 70], [150, 56]], 46);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:${PT.cream};font-family:${PT.sans};position:relative;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;">

      <!-- Zona foto -->
      <div style="flex:1.95;min-height:0;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;">${layer}</div>
        <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom, rgba(15,12,8,0.6) 0%, rgba(15,12,8,0) 30%, rgba(15,12,8,0) 70%, rgba(15,12,8,0.4) 100%);"></div>
        <div style="position:absolute;top:48px;left:52px;right:52px;display:flex;align-items:center;justify-content:space-between;gap:18px;pointer-events:none;">
          ${posterShow('header') ? `<div style="background:rgba(15,12,8,0.42);border:1px solid rgba(245,239,227,0.22);border-radius:11px;padding:9px 16px 9px 9px;">${ptMasthead(portal, { onDark: true, size: 68, nameSize: 28 })}</div>` : '<span></span>'}
          ${p._total ? `<div style="background:rgba(15,12,8,0.42);border:1px solid rgba(245,239,227,0.22);border-radius:8px;padding:9px 14px;">${ptCounter(p, { onDark: true })}</div>` : (p.location ? posterLocationPill(p.location, true) : '')}
        </div>
      </div>

      <!-- Seam de acento -->
      ${posterShow('graphics') ? `<div style="height:8px;background:${PT.terra};flex-shrink:0;"></div>` : ''}

      <!-- Bloco editorial -->
      <div style="flex:1;min-height:0;background:${PT.ink};padding:38px 52px 40px;display:flex;flex-direction:column;justify-content:center;gap:18px;box-sizing:border-box;">
        ${posterKicker(p.category, { color: PT.redOnDark })}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.0;letter-spacing:0.004em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:30px;font-weight:500;line-height:1.3;color:${PT.creamMute};margin:0;max-width:94%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('location') && p.location && !p._total ? `<div style="font-family:${PT.sans};font-size:20px;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;color:${PT.creamMute};">${escapeHtml(p.location)}</div>` : ''}
      </div>
    </div>
  `;
}

/** Manchete — FRONT PAGE: nameplate sólido + manchete dominante + faixa de mídia. */
function tplManchete2(p, fmt, portal) {
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[34, 110], [60, 86], [95, 68], [140, 56]], 48);
  // Slogan/tagline no canto direito do masthead — fonte responsiva (encolhe p/
  // frases longas) + até 4 linhas, para o texto caber INTEIRO naquele espaço.
  const tagSize = posterPickSize(portal.tagline, [[36, 18], [70, 16], [110, 14]], 12);
  const imgs = [p.image1, p.image2, p.image3, p.image4];
  const count = imgs.filter(Boolean).length;
  const hasImg = count > 0;
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};position:relative;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;">

      <!-- Masthead neutro (sobre o papel): marca em destaque, sem bloco escuro -->
      <div style="flex-shrink:0;padding:46px 52px 0;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:28px;">
          ${posterShow('header') ? ptMasthead(portal, { size: 108, nameSize: 42 }) : '<span></span>'}
          ${p._total
            ? `<div style="flex-shrink:0;">${ptCounter(p, { size: 28 })}</div>`
            : (posterShow('tagline') && portal.tagline ? `<div style="flex-shrink:0;max-width:360px;text-align:right;font-family:${PT.sans};font-weight:700;font-size:${tagSize}px;letter-spacing:0.1em;text-transform:uppercase;color:${PT.muted};line-height:1.32;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(portal.tagline)}</div>` : '')}
        </div>
        ${posterShow('graphics') ? `<div style="margin-top:26px;height:3px;background:${PT.line};position:relative;">
          <div style="position:absolute;left:0;top:0;width:118px;height:100%;background:${PT.terra};"></div>
        </div>` : ''}
      </div>

      <!-- Conteúdo -->
      <div style="flex-shrink:0;padding:34px 52px 30px;">
        ${posterKicker(p.category)}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:0.98;letter-spacing:-0.005em;color:${PT.cream};margin:22px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:32px;font-weight:500;line-height:1.3;color:${PT.inkSoft};margin:22px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>

      <!-- Faixa de mídia -->
      <div style="flex:1;min-height:0;position:relative;margin:8px 52px 52px;border-radius:4px;overflow:hidden;background:${PT.paper2};">
        ${hasImg ? posterPhotoMosaic(p, { two: 'row', three: 'row', four: 'row', gapColor: PT.ink }) : ''}
        ${hasImg ? `<div style="position:absolute;left:0;right:0;bottom:0;height:120px;background:linear-gradient(to top, rgba(15,12,8,0.72), rgba(15,12,8,0));pointer-events:none;"></div>` : ''}
        ${p.location ? `<div style="position:absolute;top:18px;left:18px;pointer-events:none;">${posterLocationPill(p.location, hasImg)}</div>` : ''}
        ${hasImg && posterShow('handle') ? `<div style="position:absolute;left:22px;bottom:18px;pointer-events:none;font-family:${PT.sans};font-size:22px;font-weight:600;letter-spacing:0.02em;color:#fff;">${escapeHtml(portal.handle || '@portal')}</div>` : ''}
      </div>
    </div>
  `;
}

/** Citação — STATEMENT: peça escura, aspa gigante de acento, frase dominante. */
function tplCitacao(p, fmt, portal) {
  const quote = p.headline || 'A frase em destaque aparece aqui.';
  const qSize = posterPickSize(quote, [[55, 90], [110, 72], [200, 56]], 46);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradDark};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:72px 70px;box-sizing:border-box;position:relative;overflow:hidden;">
      ${posterShow('graphics') ? `<div style="position:absolute;right:-44px;bottom:-160px;font-family:${PT.serif};font-weight:900;font-size:520px;line-height:1;color:rgba(227,6,19,0.13);pointer-events:none;">&rdquo;</div>` : ''}

      <div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:18px;flex-shrink:0;z-index:2;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 76 }) : '<span></span>'}
        ${ptCounter(p, { onDark: true })}
      </div>

      <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;z-index:2;">
        ${posterShow('graphics') ? `<div style="font-family:${PT.serif};font-weight:900;font-size:150px;line-height:1;height:94px;overflow:hidden;color:${PT.terra};margin-bottom:14px;">&ldquo;</div>` : ''}
        ${posterShow('headline') ? `<blockquote style="font-family:${PT.serif};font-style:italic;font-weight:600;font-size:${qSize}px;line-height:1.13;letter-spacing:-0.015em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;">${escapeHtml(quote)}</blockquote>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<div style="margin-top:40px;display:flex;align-items:center;gap:18px;"><span style="width:60px;height:4px;background:${PT.terra};display:inline-block;flex-shrink:0;"></span><span style="font-family:${PT.sans};font-size:29px;font-weight:700;letter-spacing:0.02em;color:${PT.cream};overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</span></div>` : ''}
      </div>

      ${posterShow('footer') ? `<div style="position:relative;z-index:2;">
        ${p.category ? `<div style="margin-bottom:18px;">${posterKicker(p.category, { color: PT.redOnDark })}</div>` : ''}
        <div style="border-top:1.5px solid ${PT.creamLine};padding-top:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
          ${posterShow('handle') ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
          ${posterShow('location') && p.location ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:46%;">${escapeHtml(p.location)}</span>` : ''}
        </div>
      </div>` : ''}
    </div>
  `;
}

/** Tópicos / lista — INDEX: numerais serifados gigantes + filetes. */
function tplTopicos(p, fmt, portal) {
  const hSize = posterPickSize(p.headline, [[36, 76], [64, 60]], 50);
  let bullets = posterBullets(p, 6);
  const empty = bullets.length === 0;
  if (empty) bullets = ['Use o campo Texto (ou gere a partir de uma matéria) para preencher os tópicos.'];
  const items = bullets.map((b, i) => `
        <div style="display:flex;align-items:flex-start;gap:26px;padding:${i === 0 ? '0 0 24px' : '24px 0'};${i > 0 ? `border-top:1.5px solid ${PT.line};` : ''}">
          <div style="flex-shrink:0;min-width:64px;font-family:${PT.serif};font-weight:900;font-size:58px;line-height:0.82;color:${empty ? PT.faint : PT.terra};">${empty ? '·' : num2(i + 1)}</div>
          <div style="flex:1;min-width:0;font-family:${PT.sans};font-size:${empty ? 28 : 34}px;font-weight:500;line-height:1.3;color:${empty ? PT.muted : PT.inkSoft};padding-top:6px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(b)}</div>
        </div>`).join('');
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:60px 58px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
        <div style="min-width:0;">
          ${posterKicker(p.category)}
          ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:-0.005em;margin:18px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.headline || 'Título da lista')}</h1>` : ''}
        </div>
        ${ptCounter(p)}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;overflow:hidden;padding:24px 0;">
        ${items}
      </div>
      ${posterMetaFooter(portal, { right: p.location || '' })}
    </div>
  `;
}

/** Minimalista — STATEMENT: tipografia serifada enorme + bloco de acento. */
function tplMinimalista(p, fmt, portal) {
  const headline = p.headline || 'Uma ideia em poucas palavras';
  const hSize = posterPickSize(headline, [[26, 150], [52, 118], [90, 88], [140, 66]], 54);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;justify-content:space-between;padding:80px 70px;box-sizing:border-box;position:relative;overflow:hidden;">
      ${posterShow('graphics') ? `<div style="position:absolute;top:0;right:0;width:360px;height:360px;background:${PT.sand};border-bottom-left-radius:360px;"></div>` : ''}

      <div style="position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        ${posterKicker(p.category || 'Destaque')}
        ${ptCounter(p)}
      </div>

      <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;">
        ${posterShow('graphics') ? `<div style="width:84px;height:8px;background:${PT.terra};margin-bottom:34px;flex-shrink:0;"></div>` : ''}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.serif};font-weight:600;font-size:${hSize}px;line-height:1.02;letter-spacing:-0.03em;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.sans};font-size:32px;font-weight:400;line-height:1.45;color:${PT.muted};margin:36px 0 0 0;max-width:88%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>

      <div style="position:relative;">${posterMetaFooter(portal, { right: p.location || '' })}</div>
    </div>
  `;
}

/** Texto / parágrafo — EDITORIAL: numeral/heading forte + corpo confortável. */
function tplTexto(p, fmt, portal) {
  const body = (p.description || p.subtitle || 'Texto do slide.').trim();
  const bodySize = posterPickSize(body, [[170, 46], [340, 40], [560, 34]], 29);
  const heading = p.headline || (p._total ? '' : '');
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:64px 58px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:flex-start;justify-content:space-between;gap:20px;">
        <div style="min-width:0;flex:1;">
          ${posterKicker(p.category || 'Conteúdo')}
          ${posterShow('headline') && heading ? `<h2 style="font-family:${PT.cond};text-transform:uppercase;font-size:54px;font-weight:700;line-height:1.02;letter-spacing:-0.005em;margin:16px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(heading)}</h2>` : ''}
        </div>
        ${posterShow('counter') && p._total ? `<div style="font-family:${PT.serif};font-weight:900;font-size:90px;line-height:0.8;color:${PT.terra};flex-shrink:0;">${num2(p._idx)}</div>` : ''}
      </div>

      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;padding:24px 0;">
        <div style="display:flex;gap:28px;align-items:stretch;">
          ${posterShow('graphics') ? `<span style="width:5px;flex-shrink:0;background:${PT.terra};border-radius:3px;"></span>` : ''}
          <p style="flex:1;min-width:0;font-family:${PT.sans};font-size:${bodySize}px;font-weight:400;line-height:1.55;color:${PT.inkSoft};margin:0;white-space:pre-wrap;overflow:hidden;display:-webkit-box;-webkit-line-clamp:15;-webkit-box-orient:vertical;">${escapeHtml(body)}</p>
        </div>
      </div>

      ${posterMetaFooter(portal, { right: (p._total ? '' : p.location) || '' })}
    </div>
  `;
}

/** Cor sólida — BOLD: fundo de acento + numeral/seta gigante + CTA. */
function tplCorSolida(p, fmt, portal) {
  const headline = p.headline || 'Mensagem principal';
  const hSize = posterPickSize(headline, [[40, 112], [90, 84], [150, 64]], 52);
  const ghost = p._total ? num2(p._idx) : '';
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradSolid};color:#fff;font-family:${PT.sans};display:flex;flex-direction:column;justify-content:space-between;padding:72px 66px;box-sizing:border-box;position:relative;overflow:hidden;">
      ${posterShow('graphics') ? (ghost ? `<div style="position:absolute;right:-30px;bottom:-90px;font-family:${PT.serif};font-weight:900;font-size:560px;line-height:0.8;color:rgba(255,255,255,0.1);pointer-events:none;">${ghost}</div>` : `<div style="position:absolute;bottom:-200px;left:-150px;width:540px;height:540px;border-radius:50%;border:3px solid rgba(255,255,255,0.14);"></div>`) : ''}

      <div style="position:relative;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-shrink:0;z-index:2;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 78 }) : '<span></span>'}
        ${posterShow('category') && p.category ? posterBadge(p.category, '#fff', PT.terraDeep) : ''}
      </div>

      <div style="position:relative;flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;z-index:2;">
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:0.98;letter-spacing:0.004em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:32px;font-weight:500;line-height:1.34;color:rgba(255,255,255,0.95);margin:30px 0 0 0;max-width:90%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>

      ${posterShow('footer') ? `<div style="position:relative;z-index:2;border-top:1.5px solid rgba(255,255,255,0.3);padding-top:22px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0;">
        ${posterShow('handle') ? `<span style="font-family:${PT.sans};font-size:24px;font-weight:700;letter-spacing:0.02em;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
        <span style="font-family:${PT.serif};font-style:italic;font-weight:600;font-size:24px;color:rgba(255,255,255,0.92);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${escapeHtml(p.location || portal.name || '')}</span>
      </div>` : ''}
    </div>
  `;
}

/* -------------------------------------------------------------------------- */
/* Modelos "Foto em destaque" ADICIONAIS — independentes; a imagem é            */
/* protagonista em cada um, com composição/identidade própria. O modelo        */
/* original (destaque-foto / tplDestaqueFoto) permanece INTACTO.                */
/* IMPORTANTE: overlays sobre a imagem usam pointer-events:none para o          */
/* pan/zoom (setupImagePanning) continuar funcionando.                          */
/* -------------------------------------------------------------------------- */

/** Chip de marca legível sobre foto. */
function _dfMasthChip(portal) {
  if (!posterShow('header')) return '';
  const m = ptMasthead(portal, { onDark: true, size: 64, nameSize: 26 });
  if (!m) return '';
  return `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:11px;padding:9px 16px 9px 9px;">${m}</div>`;
}

/** Foto em destaque 2 — IMERSIVO: foto full-bleed + texto sobre gradiente + moldura. */
function tplDestaqueFoto2(p, fmt, portal) {
  const layer = posterPhotoMosaic(p, { two: 'row', three: 'left', gapColor: PT.ink });
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[42, 88], [85, 70], [150, 56]], 46);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:${PT.cream};font-family:${PT.sans};position:relative;overflow:hidden;box-sizing:border-box;">
      <div style="position:absolute;inset:0;">${layer}</div>
      <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to top, rgba(15,12,8,0.94) 0%, rgba(15,12,8,0.45) 32%, rgba(15,12,8,0) 56%, rgba(15,12,8,0.42) 100%);"></div>
      ${posterShow('graphics') ? `<div style="position:absolute;inset:30px;pointer-events:none;border:1.5px solid rgba(245,239,227,0.32);"></div>` : ''}

      <div style="position:absolute;top:52px;left:54px;right:54px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
        ${_dfMasthChip(portal) || '<span></span>'}
        ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : (p.location ? posterLocationPill(p.location, true) : '')}
      </div>

      <div style="position:absolute;left:54px;right:54px;bottom:54px;pointer-events:none;display:flex;flex-direction:column;gap:18px;">
        ${posterKicker(p.category, { color: PT.redOnDark })}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.0;letter-spacing:0.004em;color:#fff;margin:0;text-shadow:0 2px 24px rgba(0,0,0,0.55);overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:30px;font-weight:500;line-height:1.3;color:${PT.creamMute};margin:0;max-width:92%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('footer') ? `<div style="border-top:1.5px solid rgba(245,239,227,0.3);padding-top:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
          ${posterShow('handle') ? `<span style="font-family:${PT.sans};font-size:22px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
          ${posterShow('portalName') ? `<span style="font-family:${PT.serif};font-weight:700;font-size:23px;color:rgba(245,239,227,0.9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${escapeHtml(portal.name || '')}</span>` : ''}
        </div>` : ''}
      </div>
    </div>
  `;
}

/** Foto em destaque 3 — SPLIT VERTICAL: foto em coluna + painel de texto escuro. */
function tplDestaqueFoto3(p, fmt, portal) {
  const layer = posterPhotoMosaic(p, { two: 'col', three: 'stack', gapColor: PT.ink });
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[30, 54], [60, 44], [110, 38]], 32);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};font-family:${PT.sans};display:flex;flex-direction:row;overflow:hidden;box-sizing:border-box;">
      <div style="width:64%;height:100%;flex-shrink:0;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;">${layer}</div>
        ${p.location ? `<div style="position:absolute;top:30px;left:30px;pointer-events:none;">${posterLocationPill(p.location, true)}</div>` : ''}
      </div>
      <div style="flex:1;min-width:0;height:100%;background:${PT.ink};color:${PT.cream};display:flex;flex-direction:column;padding:48px 42px;box-sizing:border-box;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 56, nameSize: 24 }) : ''}
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;">
          ${posterKicker(p.category, { color: PT.redOnDark })}
          ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.04;letter-spacing:0.004em;color:${PT.cream};margin:20px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
          ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:25px;font-weight:500;line-height:1.32;color:${PT.creamMute};margin:24px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        </div>
        ${posterShow('footer') ? `<div style="flex-shrink:0;border-top:1.5px solid ${PT.creamLine};padding-top:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          ${posterShow('handle') ? `<span style="font-family:${PT.sans};font-size:19px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
          ${p._total ? ptCounter(p, { onDark: true, size: 22 }) : ''}
        </div>` : ''}
      </div>
    </div>
  `;
}

/** Foto em destaque 4 — PRINT EMOLDURADO: foto como moldura sobre papel + texto abaixo. */
function tplDestaqueFoto4(p, fmt, portal) {
  const layer = posterPhotoMosaic(p, { two: 'row', three: 'left', gapColor: '#ffffff' });
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[42, 78], [85, 62], [150, 50]], 42);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:54px 54px 50px;box-sizing:border-box;overflow:hidden;">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;flex-shrink:0;">
        ${posterShow('header') ? ptMasthead(portal, { size: 64, nameSize: 30 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { size: 26 }) : ''}
      </div>
      <div style="flex:1;min-height:0;margin:30px 0;position:relative;">
        <div style="position:absolute;inset:0;overflow:hidden;background:#000;">${layer}</div>
        ${posterShow('graphics') ? `<div style="position:absolute;inset:0;pointer-events:none;border:9px solid #fff;box-sizing:border-box;"></div>` : ''}
        ${p.location ? `<div style="position:absolute;left:24px;bottom:24px;pointer-events:none;">${posterLocationPill(p.location, true)}</div>` : ''}
      </div>
      <div style="flex-shrink:0;">
        <div style="margin-bottom:16px;">${posterKicker(p.category)}</div>
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:-0.005em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:27px;font-weight:500;line-height:1.3;color:${PT.inkSoft};margin:14px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>
    </div>
  `;
}

/** Foto em destaque 5 — FAIXA DE IMPACTO: foto full-bleed + faixa de acento com a manchete. */
function tplDestaqueFoto5(p, fmt, portal) {
  const layer = posterPhotoMosaic(p, { two: 'row', three: 'left', gapColor: PT.ink });
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[42, 76], [85, 62], [150, 50]], 44);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:#fff;font-family:${PT.sans};display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;">

      <!-- Zona da foto (protagonista — não é coberta pela faixa) -->
      <div style="flex:2.3;min-height:0;position:relative;overflow:hidden;">
        ${layer}
        <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom, rgba(15,12,8,0.55) 0%, rgba(15,12,8,0) 24%);"></div>
        <div style="position:absolute;top:50px;left:54px;right:54px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
          ${_dfMasthChip(portal)}
          ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : (p.location ? posterLocationPill(p.location, true) : '')}
        </div>
        ${posterShow('category') ? `<div style="position:absolute;left:54px;bottom:0;pointer-events:none;background:${PT.terra};color:#fff;font-family:${PT.sans};font-weight:700;font-size:22px;letter-spacing:0.16em;text-transform:uppercase;padding:11px 22px;">${escapeHtml(p.category || 'Destaque')}</div>` : ''}
      </div>

      <!-- Faixa de impacto (texto) — separada, não sobrepõe a foto -->
      <div style="flex:1;min-height:0;background:${PT.terra};padding:30px 54px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;">
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:0.004em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:27px;font-weight:500;line-height:1.3;color:rgba(255,255,255,0.96);margin:14px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('footer') ? `<div style="margin-top:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;">
          ${posterShow('handle') ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
          ${posterShow('portalName') ? `<span style="font-family:${PT.serif};font-style:italic;font-weight:600;font-size:22px;color:rgba(255,255,255,0.92);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50%;">${escapeHtml(portal.name || '')}</span>` : ''}
        </div>` : ''}
      </div>
    </div>
  `;
}

/* ==========================================================================
 * BIBLIOTECA PRINCIPAL — 10 modelos (premium, consistentes, token-driven).
 * Todos leem os MESMOS campos do cartaz; campos dedicados opcionais
 * (personName, personRole, figure, labelA, labelB) têm fallback. Overlays
 * sobre foto usam pointer-events:none (pan/zoom continua). Só técnicas
 * html2canvas-safe (blocos sólidos, gradiente linear, bordas, texto, M canvas).
 * ==========================================================================*/

/** 01 — HEADLINE PREMIUM: foto dominante + card flutuante elegante embaixo. */
function tplHeadlinePremium(p, fmt, portal) {
  const layer = posterPhotoMosaic(p, { two: 'row', three: 'feature-left', four: 'grid', gapColor: PT.ink });
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[40, 74], [80, 58], [140, 46]], 40);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:${PT.cream};font-family:${PT.sans};position:relative;overflow:hidden;box-sizing:border-box;">
      <div style="position:absolute;inset:0;">${layer}</div>
      <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom, rgba(11,20,33,0.5) 0%, rgba(11,20,33,0) 26%);"></div>
      <div style="position:absolute;top:50px;left:54px;right:54px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
        ${_dfMasthChip(portal)}
        ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : (p.location ? posterLocationPill(p.location, true) : '')}
      </div>
      <div style="position:absolute;left:46px;right:46px;bottom:46px;background:${PT.ink};border-radius:22px;border:1px solid ${PT.line};padding:42px 46px;box-sizing:border-box;display:flex;flex-direction:column;gap:18px;">
        ${posterKicker(p.category)}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:0.004em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:27px;font-weight:500;line-height:1.3;color:${PT.creamMute};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('footer') && (posterShow('header') || (posterShow('location') && p.location)) ? `<div style="border-top:1.5px solid ${PT.creamLine};padding-top:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;">
          ${posterShow('header') ? ptMasthead(portal, { size: 50, nameSize: 24 }) : '<span></span>'}
          ${posterShow('location') && p.location ? `<span style="font-family:${PT.sans};font-size:20px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:46%;">${escapeHtml(p.location)}</span>` : ''}
        </div>` : ''}
      </div>
    </div>
  `;
}

/** 02 — BREAKING ALERT: faixa institucional + selo URGENTE + título curto + foto. */
function tplBreakingAlert(p, fmt, portal) {
  const headline = p.headline || 'Notícia urgente';
  const hSize = posterPickSize(headline, [[28, 106], [55, 84], [90, 66]], 52);
  const k0 = posterImageKeys(p)[0];
  const hasImg = !!k0;
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradSolid};color:#fff;font-family:${PT.sans};display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;position:relative;">
      <div style="flex-shrink:0;padding:48px 56px 0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 70, nameSize: 28 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { onDark: true, color: '#fff' }) : ''}
      </div>
      <div style="flex-shrink:0;padding:32px 56px 0;display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
        ${posterShow('graphics') ? `<span style="display:inline-flex;align-items:center;gap:12px;background:#fff;color:${PT.terraDeep};font-family:${PT.cond};font-weight:800;font-size:30px;letter-spacing:0.18em;text-transform:uppercase;padding:12px 24px;border-radius:8px;">
          <span style="width:16px;height:16px;border-radius:50%;background:${PT.orange};display:inline-block;"></span>URGENTE
        </span>` : ''}
        ${posterShow('category') && p.category ? `<span style="font-family:${PT.sans};font-weight:700;font-size:22px;letter-spacing:0.16em;text-transform:uppercase;color:rgba(255,255,255,0.9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.category)}</span>` : ''}
      </div>
      <div style="flex:1;min-height:0;padding:28px 56px;display:flex;flex-direction:column;justify-content:center;">
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:0.98;letter-spacing:0.004em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:30px;font-weight:500;line-height:1.3;color:rgba(255,255,255,0.95);margin:24px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>
      ${hasImg ? `<div style="flex:0 0 36%;min-height:0;position:relative;overflow:hidden;border-top:6px solid ${PT.orange};">
        <div style="position:absolute;inset:0;">${posterImageLayer(p, k0)}</div>
        ${p.location ? `<div style="position:absolute;left:24px;bottom:20px;pointer-events:none;">${posterLocationPill(p.location, true)}</div>` : ''}
      </div>` : `<div style="flex-shrink:0;border-top:1.5px solid rgba(255,255,255,0.3);margin:0 56px;padding:22px 0 40px;display:flex;align-items:center;justify-content:space-between;gap:14px;">
        <span style="font-family:${PT.sans};font-size:23px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>
        ${p.location ? `<span style="font-family:${PT.serif};font-style:italic;font-size:23px;color:rgba(255,255,255,0.92);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${escapeHtml(p.location)}</span>` : ''}
      </div>`}
    </div>
  `;
}

/** 03 — FACE TO NEWS: retrato dominante + título + nome + cargo + categoria. */
function tplFaceToNews(p, fmt, portal) {
  const headline = p.headline || 'Título da notícia';
  const hSize = posterPickSize(headline, [[40, 66], [80, 54], [140, 44]], 38);
  const name = p.personName || '';
  const role = p.personRole || '';
  const k0 = posterImageKeys(p)[0];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:#fff;font-family:${PT.sans};position:relative;overflow:hidden;box-sizing:border-box;">
      <div style="position:absolute;inset:0;">${k0 ? posterImageLayer(p, k0) : posterPhotoPlaceholder()}</div>
      <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to top, rgba(11,20,33,0.95) 0%, rgba(11,20,33,0.5) 30%, rgba(11,20,33,0) 52%, rgba(11,20,33,0.4) 100%);"></div>
      <div style="position:absolute;top:50px;left:54px;right:54px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
        ${_dfMasthChip(portal)}
        ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : ''}
      </div>
      <div style="position:absolute;left:54px;right:54px;bottom:54px;pointer-events:none;display:flex;flex-direction:column;gap:16px;">
        ${posterKicker(p.category, { color: PT.redOnDark })}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:0.004em;color:#fff;margin:0;text-shadow:0 2px 24px rgba(0,0,0,0.5);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${(posterShow('personName') && name) || (posterShow('personRole') && role) ? `<div style="display:flex;align-items:center;gap:16px;margin-top:4px;">
          <span style="width:6px;height:${(posterShow('personRole') && role) ? 56 : 34}px;background:${PT.terra};display:inline-block;flex-shrink:0;border-radius:3px;"></span>
          <div style="min-width:0;">
            ${posterShow('personName') && name ? `<div style="font-family:${PT.serif};font-weight:800;font-size:34px;line-height:1.06;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(name)}</div>` : ''}
            ${posterShow('personRole') && role ? `<div style="font-family:${PT.sans};font-weight:600;font-size:22px;letter-spacing:0.04em;color:rgba(255,255,255,0.8);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(role)}</div>` : ''}
          </div>
        </div>` : ''}
      </div>
    </div>
  `;
}

/** 04 — QUOTE IMPACT: retrato + aspas gigantes + frase + nome + cargo + logo. */
function tplQuoteImpact(p, fmt, portal) {
  const quote = p.headline || 'A frase em destaque aparece aqui.';
  const qSize = posterPickSize(quote, [[60, 58], [120, 46], [200, 38]], 32);
  const name = p.personName || p.subtitle || '';
  const role = p.personRole || '';
  const k0 = posterImageKeys(p)[0];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradDark};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;position:relative;">
      <div style="flex:1.05;min-height:0;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;">${k0 ? posterImageLayer(p, k0) : posterPhotoPlaceholder()}</div>
        <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom, rgba(0,0,0,0.4) 0%, rgba(0,0,0,0) 24%);"></div>
        <div style="position:absolute;top:46px;left:50px;right:50px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
          ${_dfMasthChip(portal)}
          ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : ''}
        </div>
      </div>
      <div style="flex:1.25;min-height:0;position:relative;padding:46px 56px 50px;display:flex;flex-direction:column;justify-content:center;box-sizing:border-box;">
        ${posterShow('graphics') ? `<div style="position:absolute;right:30px;bottom:-70px;font-family:${PT.serif};font-weight:900;font-size:360px;line-height:1;color:rgba(227,6,19,0.12);pointer-events:none;">&rdquo;</div>` : ''}
        ${posterShow('graphics') ? `<div style="position:relative;font-family:${PT.serif};font-weight:900;font-size:120px;line-height:1;height:72px;overflow:hidden;color:${PT.terra};margin-bottom:10px;">&ldquo;</div>` : ''}
        ${posterShow('headline') ? `<blockquote style="position:relative;font-family:${PT.serif};font-style:italic;font-weight:600;font-size:${qSize}px;line-height:1.16;letter-spacing:-0.01em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;">${escapeHtml(quote)}</blockquote>` : ''}
        <div style="position:relative;margin-top:30px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
          ${(posterShow('personName') && name) || (posterShow('personRole') && role) ? `<div style="display:flex;align-items:center;gap:14px;min-width:0;">
            <span style="width:50px;height:4px;background:${PT.terra};display:inline-block;flex-shrink:0;"></span>
            <div style="min-width:0;">
              ${posterShow('personName') && name ? `<div style="font-family:${PT.sans};font-weight:700;font-size:26px;color:${PT.cream};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(name)}</div>` : ''}
              ${posterShow('personRole') && role ? `<div style="font-family:${PT.sans};font-weight:600;font-size:19px;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(role)}</div>` : ''}
            </div>
          </div>` : `<span></span>`}
          ${posterLogoBlock(portal, 56, PT.light ? 'dark' : 'light') || '<span></span>'}
        </div>
      </div>
    </div>
  `;
}

/** 05 — PHOTO STORY: foto praticamente dominante + texto mínimo + marca discreta. */
function tplPhotoStory(p, fmt, portal) {
  const layer = posterPhotoMosaic(p, { two: 'row', three: 'feature-left', four: 'grid', gapColor: PT.ink });
  const headline = p.headline || '';
  const hSize = posterPickSize(headline, [[36, 62], [70, 50], [120, 42]], 36);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:#fff;font-family:${PT.sans};position:relative;overflow:hidden;box-sizing:border-box;">
      <div style="position:absolute;inset:0;">${layer}</div>
      <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to top, rgba(11,20,33,0.9) 0%, rgba(11,20,33,0) 38%);"></div>
      <div style="position:absolute;top:48px;left:50px;right:50px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
        ${posterShow('category') && p.category ? posterBadge(p.category, PT.terra, '#fff') : '<span></span>'}
        ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : (p.location ? posterLocationPill(p.location, true) : '')}
      </div>
      <div style="position:absolute;left:50px;right:50px;bottom:50px;pointer-events:none;display:flex;flex-direction:column;gap:18px;">
        ${posterShow('headline') && headline ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.04;letter-spacing:0.004em;color:#fff;margin:0;text-shadow:0 2px 22px rgba(0,0,0,0.5);overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 48, nameSize: 22 }) : ''}
      </div>
    </div>
  `;
}

/** 06 — NUMBERS & DATA: número gigante + indicador + mini-gráfico + título + resumo. */
function tplNumbersData(p, fmt, portal) {
  const figure = (p.figure && p.figure.trim()) || posterFigureExtract(p.headline) || '00';
  const headline = p.headline || 'Indicador em destaque';
  const hSize = posterPickSize(headline, [[40, 52], [80, 42], [140, 34]], 30);
  const fSize = posterPickSize(figure, [[2, 260], [4, 210], [6, 160], [10, 116]], 84);
  const summary = p.subtitle || '';
  const bars = [34, 52, 46, 70, 62, 92];
  const chart = bars.map((h, i) => `<div style="flex:1;height:${h}%;background:${i === bars.length - 1 ? PT.terra : PT.line};border-radius:5px 5px 0 0;"></div>`).join('');
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:60px 58px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterKicker(p.category || 'Dados')}
        ${p._total ? ptCounter(p, { size: 24 }) : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;">
        ${posterShow('figure') ? `<div style="display:flex;align-items:flex-start;gap:20px;">
          <div style="font-family:${PT.cond};font-weight:800;font-size:${fSize}px;line-height:0.84;letter-spacing:-0.02em;color:${PT.terra};">${escapeHtml(figure)}</div>
          <div style="display:flex;align-items:center;gap:8px;background:${PT.terraSoft};color:${PT.terra};border-radius:9px;padding:9px 15px;margin-top:14px;font-family:${PT.sans};font-weight:800;font-size:26px;line-height:1;">▲</div>
        </div>` : ''}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.04;letter-spacing:-0.005em;color:${PT.cream};margin:28px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && summary ? `<p style="font-family:${PT.sans};font-size:26px;font-weight:400;line-height:1.45;color:${PT.muted};margin:18px 0 0 0;max-width:92%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(summary)}</p>` : ''}
        ${posterShow('graphics') ? `<div style="display:flex;align-items:flex-end;gap:12px;height:128px;margin-top:34px;">${chart}</div>` : ''}
      </div>
      ${posterMetaFooter(portal, { right: p.location || '' })}
    </div>
  `;
}

/** 07 — COMPARISON: dois blocos + título central + rótulos comparativos. */
function tplComparison(p, fmt, portal) {
  const headline = p.headline || 'Comparação';
  const hSize = posterPickSize(headline, [[30, 46], [60, 38], [110, 30]], 26);
  const labelA = p.labelA || 'Antes';
  const labelB = p.labelB || 'Depois';
  const keys = posterImageKeys(p);   // as 2 primeiras imagens ATIVAS (ou bloco de cor)
  const half = (key, label, accent) => `
    <div style="flex:1;min-height:0;position:relative;overflow:hidden;">
      ${p[key] ? `<div style="position:absolute;inset:0;">${posterImageLayer(p, key)}</div>` : `<div style="position:absolute;inset:0;background:${accent};"></div>`}
      <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom, rgba(0,0,0,0.45) 0%, rgba(0,0,0,0) 38%);"></div>
      <div style="position:absolute;top:26px;left:28px;pointer-events:none;"><span style="display:inline-block;background:${accent};color:#fff;font-family:${PT.cond};font-weight:800;font-size:28px;letter-spacing:0.12em;text-transform:uppercase;padding:10px 20px;border-radius:7px;">${escapeHtml(label)}</span></div>
    </div>`;
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;">
      <div style="flex-shrink:0;background:${PT.ink};padding:30px 50px 22px;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 54, nameSize: 24 }) : '<span></span>'}
        ${posterKicker(p.category || 'Comparativo')}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;position:relative;">
        ${half(keys[0], labelA, PT.terra)}
        <div style="height:6px;background:${PT.terra};flex-shrink:0;"></div>
        ${half(keys[1], labelB, PT.redOnDark)}
        ${posterShow('headline') ? `<div style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);pointer-events:none;max-width:84%;">
          <div style="background:${PT.ink};border:2px solid ${PT.terra};border-radius:12px;padding:18px 28px;">
            <div style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.06;letter-spacing:0.004em;color:${PT.cream};text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</div>
          </div>
        </div>` : ''}
      </div>
      ${posterShow('subtitle') && (p.subtitle || p.location) ? `<div style="flex-shrink:0;background:${PT.ink};padding:18px 50px;text-align:center;font-family:${PT.sans};font-size:22px;font-weight:500;color:${PT.muted};overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle || p.location)}</div>` : ''}
    </div>
  `;
}

/** 08 — TOPIC CARD: título + imagem de apoio + blocos organizados + categoria. */
function tplTopicCard(p, fmt, portal) {
  const headline = p.headline || 'Tópico explicado';
  const hSize = posterPickSize(headline, [[36, 62], [70, 48], [120, 40]], 34);
  let bullets = posterBullets(p, 4);
  const empty = bullets.length === 0;
  if (empty) bullets = ['Use o campo Texto (ou gere a partir de uma matéria) para listar os pontos.'];
  const cards = bullets.map((b, i) => `
    <div style="display:flex;align-items:flex-start;gap:18px;background:${PT.inkPanel};border-radius:14px;padding:22px 24px;border-left:6px solid ${PT.terra};">
      <div style="flex-shrink:0;width:42px;height:42px;border-radius:9px;background:${empty ? PT.line : PT.terra};color:#fff;display:flex;align-items:center;justify-content:center;font-family:${PT.cond};font-weight:800;font-size:25px;">${empty ? '·' : num2(i + 1)}</div>
      <div style="flex:1;min-width:0;font-family:${PT.sans};font-size:26px;font-weight:500;line-height:1.32;color:${empty ? PT.muted : PT.inkSoft};padding-top:4px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(b)}</div>
    </div>`).join('');
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:56px 54px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:flex-start;justify-content:space-between;gap:24px;">
        <div style="min-width:0;flex:1;">
          ${posterKicker(p.category || 'Entenda')}
          ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:-0.005em;margin:18px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        </div>
        ${(() => { const k = posterImageKeys(p)[0]; return k ? `<div style="flex-shrink:0;width:196px;height:196px;border-radius:16px;overflow:hidden;position:relative;background:${PT.inkPanel};"><div style="position:absolute;inset:0;">${posterImageLayer(p, k)}</div></div>` : ''; })()}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:24px 0;">
        ${cards}
      </div>
      ${posterMetaFooter(portal, { right: p.location || '' })}
    </div>
  `;
}

/** 09 — NEWS CAROUSEL COVER: título dominante + foto + identidade + continuidade. */
function tplCarouselCover(p, fmt, portal) {
  const layer = posterPhotoMosaic(p, { two: 'row', three: 'feature-left', gapColor: PT.ink });
  const headline = p.headline || 'Título do carrossel';
  const hSize = posterPickSize(headline, [[34, 90], [64, 72], [110, 56]], 46);
  const total = p._total || 0;
  const dots = total ? Array.from({ length: Math.min(total, 8) }, (_, i) => `<span style="width:${i === 0 ? 28 : 12}px;height:12px;border-radius:6px;background:${i === 0 ? '#fff' : 'rgba(255,255,255,0.45)'};display:inline-block;"></span>`).join('') : '';
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:#fff;font-family:${PT.sans};position:relative;overflow:hidden;box-sizing:border-box;display:flex;flex-direction:column;">
      <div style="flex:1.2;min-height:0;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;">${layer}</div>
        <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom, rgba(11,20,33,0.5) 0%, rgba(11,20,33,0) 30%);"></div>
        <div style="position:absolute;top:48px;left:54px;right:54px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
          ${_dfMasthChip(portal)}
          ${p.location ? posterLocationPill(p.location, true) : ''}
        </div>
      </div>
      <div style="flex:1;min-height:0;background:${PT.gradSolid};padding:42px 54px;display:flex;flex-direction:column;box-sizing:border-box;position:relative;overflow:hidden;">
        ${PT.symbol === 'mb' && posterShow('graphics') ? `<div style="position:absolute;right:-46px;top:-46px;opacity:0.16;pointer-events:none;">${MB_SYMBOL({ size: 280, onSquare: false })}</div>` : ''}
        <div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;">
          ${posterKicker(p.category, { color: '#fff' })}
          ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.0;letter-spacing:0.004em;color:#fff;margin:18px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        </div>
        ${posterShow('graphics') ? `<div style="position:relative;padding-top:24px;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-shrink:0;">
          <div style="display:flex;align-items:center;gap:10px;">${dots}</div>
          <div style="display:flex;align-items:center;gap:10px;font-family:${PT.sans};font-weight:700;font-size:22px;letter-spacing:0.14em;text-transform:uppercase;color:#fff;">Arraste <span style="font-size:28px;line-height:1;">→</span></div>
        </div>` : ''}
      </div>
    </div>
  `;
}

/** 10 — EDITORIAL SIGNATURE: espaço negativo + título grande + gradiente + M gráfico. */
function tplEditorialSignature(p, fmt, portal) {
  const headline = p.headline || 'Assinatura editorial';
  const hSize = posterPickSize(headline, [[28, 112], [56, 84], [96, 64]], 50);
  const k0 = posterImageKeys(p)[0];
  const hasImg = !!k0;
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:64px 60px;box-sizing:border-box;overflow:hidden;position:relative;">
      ${posterShow('graphics') ? `<div style="position:absolute;left:0;top:0;bottom:0;width:14px;background:${PT.gradSolid};"></div>` : ''}
      ${PT.symbol === 'mb' && posterShow('graphics') ? `<div style="position:absolute;right:-30px;bottom:-30px;opacity:${PT.light ? 0.08 : 0.12};pointer-events:none;">${MB_SYMBOL({ size: 360, onSquare: false })}</div>` : ''}
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;position:relative;z-index:2;">
        ${posterShow('header') ? ptMasthead(portal, { size: 64, nameSize: 28 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { size: 26 }) : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;position:relative;z-index:2;">
        ${posterKicker(p.category)}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.serif};font-weight:600;font-size:${hSize}px;line-height:1.02;letter-spacing:-0.025em;color:${PT.cream};margin:26px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.sans};font-size:28px;font-weight:400;line-height:1.5;color:${PT.muted};margin:30px 0 0 0;max-width:80%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>
      ${hasImg ? `<div style="flex:0 0 30%;min-height:0;position:relative;overflow:hidden;border-radius:16px;z-index:2;">
        <div style="position:absolute;inset:0;">${posterImageLayer(p, k0)}</div>
        ${p.location ? `<div style="position:absolute;left:22px;bottom:18px;pointer-events:none;">${posterLocationPill(p.location, true)}</div>` : ''}
      </div>` : `<div style="flex-shrink:0;border-top:1.5px solid ${PT.creamLine};padding-top:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;position:relative;z-index:2;">
        <span style="font-family:${PT.sans};font-size:22px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>
        ${p.location ? `<span style="font-family:${PT.serif};font-weight:600;font-size:22px;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50%;">${escapeHtml(p.location)}</span>` : ''}
      </div>`}
    </div>
  `;
}

/* -------------------------------------------------------------------------- */
/* Registro de modelos (a ordem define a aparição no seletor do editor).       */
/* manchete delega a tplManchete() (definido em posters.js) via wrapper.       */
/* -------------------------------------------------------------------------- */
// LISTA ÚNICA (sem categorias). A ordem define a aparição no seletor. IDs são
// estáveis (cartazes salvos dependem deles); só os LABELS são nomes próprios.
const POSTER_TEMPLATES = {
  manchete:             { label: 'Manchete',             usesImages: true,  render: (p, fmt, portal) => tplManchete(p, fmt, portal) },
  'headline-premium':   { label: 'Manchete premium',     usesImages: true,  render: tplHeadlinePremium },
  'breaking-alert':     { label: 'Plantão urgente',      usesImages: true,  render: tplBreakingAlert },
  'destaque-foto':      { label: 'Capa fotográfica',     usesImages: true,  render: tplDestaqueFoto },
  'destaque-foto-2':    { label: 'Foto imersiva',        usesImages: true,  render: tplDestaqueFoto2 },
  'destaque-foto-3':    { label: 'Foto com painel',      usesImages: true,  render: tplDestaqueFoto3 },
  'destaque-foto-4':    { label: 'Foto emoldurada',      usesImages: true,  render: tplDestaqueFoto4 },
  'destaque-foto-5':    { label: 'Foto com faixa',       usesImages: true,  render: tplDestaqueFoto5 },
  'photo-story':        { label: 'Photo story',          usesImages: true,  render: tplPhotoStory },
  'face-to-news':       { label: 'Rosto na notícia',     usesImages: true,  render: tplFaceToNews },
  'quote-impact':       { label: 'Citação com foto',     usesImages: true,  render: tplQuoteImpact },
  citacao:              { label: 'Citação',              usesImages: false, render: tplCitacao },
  'numbers-data':       { label: 'Números e dados',      usesImages: false, render: tplNumbersData },
  comparison:           { label: 'Comparação',           usesImages: true,  render: tplComparison },
  'topic-card':         { label: 'Card de tópico',       usesImages: true,  render: tplTopicCard },
  topicos:              { label: 'Lista de tópicos',     usesImages: false, render: tplTopicos },
  'carousel-cover':     { label: 'Capa de carrossel',    usesImages: true,  render: tplCarouselCover },
  'editorial-signature':{ label: 'Assinatura editorial', usesImages: true,  render: tplEditorialSignature },
  minimalista:          { label: 'Minimalista',          usesImages: false, render: tplMinimalista },
  texto:                { label: 'Texto / parágrafo',    usesImages: false, render: tplTexto },
  'cor-solida':         { label: 'Cor sólida',           usesImages: false, render: tplCorSolida },
};
