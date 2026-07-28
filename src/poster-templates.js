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
 *   (blocos sólidos, gradientes lineares, bordas, SVG, tipografia).
 *
 * FIDELIDADE PREVIEW ≡ EXPORTAÇÃO (regra dura, coberta por
 * test/poster-export-fidelity.test.js): quem desenha o PNG é o html2canvas
 * 1.4.1, e ele NÃO pinta parte do CSS — o preview fica bonito e o arquivo
 * salvo sai diferente. É PROIBIDO nos modelos:
 *   box-shadow e text-shadow ...... viram RETÂNGULO CINZA sólido no PNG
 *   filter / backdrop-filter ...... ignorados
 *   mix-/background-blend-mode .... ignorados
 *   background-clip:text .......... ignorado
 *   conic-gradient ................ não suportado
 * Para dar profundidade, use bloco sólido deslocado, borda ou gradiente
 * linear — todos exportam idênticos ao preview.
 * clip-path só com o par `data-clip` (mesmos pontos %), que o achatamento do
 * export reproduz no canvas; sozinho, o recorte existe no preview e some.
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
 * Temas: 'municipios-bahia' (família "Portal": navy + vermelho/laranja + símbolo M + Poppins)
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
    name: 'Portal — Institucional', bg: '#0B1421', bg2: '#152133', bgDeep: '#080F18',
    accent: '#E30613', accent2: '#FF7A00', accentDeep: '#A60410', accentSoft: 'rgba(227,6,19,0.18)',
    gradSolid: 'linear-gradient(150deg,#FF7A00 0%,#E30613 52%,#A60410 100%)',
    gradDark: 'linear-gradient(155deg,#152133 0%,#0B1421 58%,#080F18 100%)',
    symbol: 'mb', display: POPPINS,
  }),
  // Versão EDITORIAL/BLOG: vermelho protagonista, fundos CLAROS (branco/cinza), grafite no texto.
  'municipios-bahia-blog': makeTheme({
    name: 'Portal — Editorial', light: true, bg: '#FFFFFF', bg2: '#F4F5F7', bgDeep: '#ECEEF2',
    accent: '#E30613', accent2: '#FF3B30', accentDeep: '#B80010', accentSoft: 'rgba(227,6,19,0.14)',
    gradSolid: 'linear-gradient(150deg,#FF3B30 0%,#E30613 50%,#B80010 100%)',
    gradDark: 'linear-gradient(155deg,#FFFFFF 0%,#F4F5F7 60%,#ECEEF2 100%)',
    symbol: 'mb', display: POPPINS,
  }),
  // Versão RUBI: VERMELHO protagonista (fundo ~60%), NAVY de apoio (painéis ~20%),
  // LARANJA acento (~10%). Mesma marca/tipografia; só muda o peso das cores.
  'municipios-bahia-rubi': makeTheme({
    name: 'Portal — Rubi', bg: '#E30613', bg2: '#0B1421', bgDeep: '#B80010',
    accent: '#FF7A00', accent2: '#FF7A00', accentDeep: '#B80010', accentSoft: 'rgba(255,122,0,0.20)',
    gradSolid: 'linear-gradient(150deg,#FF7A00 0%,#E30613 50%,#B80010 100%)',
    gradDark: 'linear-gradient(155deg,#152133 0%,#0B1421 58%,#080F18 100%)',
    symbol: 'mb', display: POPPINS,
  }),
  // Versão AURORA: LARANJA protagonista sobre fundos CLAROS (branco), navy de apoio,
  // vermelho terciário (breaking). Leve, moderna, "produto digital premium".
  'municipios-bahia-aurora': makeTheme({
    name: 'Portal — Aurora', light: true, bg: '#FFFFFF', bg2: '#F4F5F7', bgDeep: '#ECEEF2',
    accent: '#FF7A00', accent2: '#E30613', accentDeep: '#B85800', accentSoft: 'rgba(255,122,0,0.16)',
    gradSolid: 'linear-gradient(150deg,#FF7A00 0%,#E30613 100%)',
    gradDark: 'linear-gradient(155deg,#FFFFFF 0%,#FFF4EC 55%,#F4F5F7 100%)',
    symbol: 'mb', symbolBg: '#0B1421', display: POPPINS,
  }),
  // Versão SIGNATURE LIGHT: BRANCO estrutura (55%), VERMELHO identidade (20%),
  // LARANJA energia (15%), NAVY refinamento (10% — TIPOGRAFIA premium em navy).
  // Mínima, premium, sem grandes blocos de cor.
  'municipios-bahia-signature': makeTheme({
    name: 'Portal — Signature', light: true, bg: '#FFFFFF', bg2: '#F4F5F7', bgDeep: '#ECEEF2',
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
  // ===== PALETAS GENÉRICAS — servem a QUALQUER portal (usam a SIGLA, não o M).
  // Cada uma é um tema completo via makeTheme → aplica-se automaticamente a TODOS
  // os modelos (token-driven). accent2 é sempre legível sobre foto/escuro (vira
  // `redOnDark`), por isso nenhuma é quase-preta. =====
  'oceano': makeTheme({
    name: 'Oceano — Azul profundo', bg: '#0A1A2F', bg2: '#12304F', bgDeep: '#06121F',
    accent: '#00B4D8', accent2: '#48CAE4', accentDeep: '#0077B6', accentSoft: 'rgba(0,180,216,0.18)',
    gradSolid: 'linear-gradient(150deg,#48CAE4 0%,#00B4D8 52%,#0077B6 100%)',
    gradDark: 'linear-gradient(155deg,#12304F 0%,#0A1A2F 58%,#06121F 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
  'esmeralda': makeTheme({
    name: 'Esmeralda — Verde', bg: '#0C1F18', bg2: '#143A2C', bgDeep: '#07140F',
    accent: '#10B981', accent2: '#5EEAD4', accentDeep: '#047857', accentSoft: 'rgba(16,185,129,0.18)',
    gradSolid: 'linear-gradient(150deg,#34D399 0%,#10B981 52%,#047857 100%)',
    gradDark: 'linear-gradient(155deg,#143A2C 0%,#0C1F18 58%,#07140F 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
  'ametista': makeTheme({
    name: 'Ametista — Violeta', bg: '#1A0F2E', bg2: '#2C1A4A', bgDeep: '#110A1F',
    accent: '#A855F7', accent2: '#F472B6', accentDeep: '#7E22CE', accentSoft: 'rgba(168,85,247,0.18)',
    gradSolid: 'linear-gradient(150deg,#F472B6 0%,#A855F7 52%,#7E22CE 100%)',
    gradDark: 'linear-gradient(155deg,#2C1A4A 0%,#1A0F2E 58%,#110A1F 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
  // Quente CLARO — papel creme, laranja/coral protagonistas.
  'solar': makeTheme({
    name: 'Solar — Quente claro', light: true, bg: '#FFFBF5', bg2: '#FFF1DF', bgDeep: '#FBE6CE',
    accent: '#F4820B', accent2: '#FF5A3C', accentDeep: '#C25E00', accentSoft: 'rgba(244,130,11,0.16)',
    gradSolid: 'linear-gradient(150deg,#FFB02E 0%,#F4820B 50%,#E0490F 100%)',
    gradDark: 'linear-gradient(155deg,#FFFBF5 0%,#FFF1DF 60%,#FBE6CE 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
  // Editorial impresso — papel off-white, vermelho de jornal, tinta quase-preta no texto.
  'tinta': makeTheme({
    name: 'Tinta — Jornal', light: true, bg: '#FAF9F6', bg2: '#EFEDE6', bgDeep: '#E4E1D8',
    text: '#14110C', textRgb: '20,17,12',
    accent: '#C1121F', accent2: '#E0454E', accentDeep: '#8B0D16', accentSoft: 'rgba(193,18,31,0.12)',
    gradSolid: 'linear-gradient(150deg,#C1121F 0%,#8B0D16 100%)',
    gradDark: 'linear-gradient(155deg,#FAF9F6 0%,#EFEDE6 60%,#E4E1D8 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
  // ===== 2ª leva de paletas genéricas (r58b). Mesmas regras: sigla, accent2
  // legível sobre escuro, gradSolid sem topo claro demais (texto branco). =====
  'rose': makeTheme({
    name: 'Rosé — Magenta claro', light: true, bg: '#FFF7F9', bg2: '#FCE9EF', bgDeep: '#F8DCE6',
    accent: '#E11D74', accent2: '#FF6B9D', accentDeep: '#B0145A', accentSoft: 'rgba(225,29,116,0.14)',
    gradSolid: 'linear-gradient(150deg,#FF6B9D 0%,#E11D74 52%,#B0145A 100%)',
    gradDark: 'linear-gradient(155deg,#FFF7F9 0%,#FCE9EF 60%,#F8DCE6 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
  'areia': makeTheme({
    name: 'Areia — Terroso claro', light: true, bg: '#FBF7F0', bg2: '#F1E8D8', bgDeep: '#E8DBC4',
    accent: '#B5651D', accent2: '#D98E04', accentDeep: '#8A4A12', accentSoft: 'rgba(181,101,29,0.14)',
    gradSolid: 'linear-gradient(150deg,#D98E04 0%,#B5651D 52%,#8A4A12 100%)',
    gradDark: 'linear-gradient(155deg,#FBF7F0 0%,#F1E8D8 60%,#E8DBC4 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
  'indigo': makeTheme({
    name: 'Índigo — Carvão', bg: '#121214', bg2: '#1E1E24', bgDeep: '#0A0A0C',
    accent: '#6366F1', accent2: '#818CF8', accentDeep: '#4338CA', accentSoft: 'rgba(99,102,241,0.18)',
    gradSolid: 'linear-gradient(150deg,#818CF8 0%,#6366F1 52%,#4338CA 100%)',
    gradDark: 'linear-gradient(155deg,#1E1E24 0%,#121214 58%,#0A0A0C 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
  'marinho': makeTheme({
    name: 'Marinho — Navy & ouro', bg: '#0A1828', bg2: '#14243A', bgDeep: '#061018',
    accent: '#E0A53B', accent2: '#F2C879', accentDeep: '#A8761A', accentSoft: 'rgba(224,165,59,0.18)',
    gradSolid: 'linear-gradient(150deg,#E0A53B 0%,#B07E1E 55%,#8A5E12 100%)',
    gradDark: 'linear-gradient(155deg,#14243A 0%,#0A1828 58%,#061018 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
  'vinho': makeTheme({
    name: 'Vinho — Bordô', bg: '#2A0E16', bg2: '#3D1620', bgDeep: '#1C0810',
    accent: '#C84B5A', accent2: '#E8927E', accentDeep: '#8E2733', accentSoft: 'rgba(200,75,90,0.18)',
    gradSolid: 'linear-gradient(150deg,#C84B5A 0%,#8E2733 55%,#5E1822 100%)',
    gradDark: 'linear-gradient(155deg,#3D1620 0%,#2A0E16 58%,#1C0810 100%)',
    symbol: 'acronym', display: POPPINS,
  }),
};
// Tema ATIVO (mutado por applyTheme antes de cada render). Default = institucional.
let PT = Object.assign({}, PT_THEMES['municipios-bahia']);
function applyTheme(id) {
  Object.assign(PT, PT_THEMES[id] || PT_THEMES['municipios-bahia']);
}
function applyPortalTheme(portal) { applyTheme(portal && portal.theme); }

/* ===========================================================================
 * IDENTIDADE VISUAL — camada de personalização de COR por cartaz (`p.custom`).
 *
 * Filosofia: NÃO mexe em estrutura/layout/modelo/mosaico — só nas CORES. Roda
 * DEPOIS de applyTheme() em cada render: reconstrói os tokens `PT` via makeTheme()
 * a partir de poucas "seeds" (fundo, destaque, texto…), então TODO o sistema de
 * derivação (contraste, hierarquia, bordas, gradientes) se recalcula sozinho —
 * é a "aplicação inteligente". Os modelos não sabem que isso existe (leem `PT.*`).
 *
 * `p.custom = {
 *    palette,            // id de POSTER_PALETTES (base de cor) ou '' (= tema atual)
 *    colors:{bg,card,accent,accent2,text,text2,border},  // overrides opcionais (hex)
 *    autoContrast,       // recalcula claro/escuro + cor de texto a partir do fundo
 *    gradient:{from,to,angle}, useGradientAccent,         // gradiente nos destaques
 *    bg:'theme'|'solid'|'gradient'|'pattern', pattern:'dots'|'grid'|'diag'
 * }` — tudo opcional; objeto vazio/ausente = comportamento idêntico ao de antes.
 * ==========================================================================*/

/* PALETAS prontas — specs MÍNIMOS de makeTheme (bg/accent/accent2/accentDeep + light);
 * o resto (bg2, bgDeep, gradientes, accentSoft) é derivado em applyPosterCustom.
 * Servem a QUALQUER portal: a marca/tipografia do tema são preservadas (muda só cor). */
const POSTER_PALETTES = {
  'vermelho-noticia':   { label:'Vermelho Notícia',            light:false, bg:'#0B1421', accent:'#E30613', accent2:'#FF5A4D', accentDeep:'#A60410' },
  'vermelho-premium':   { label:'Vermelho Jornalístico Premium', light:true,  bg:'#FAF9F6', accent:'#C1121F', accent2:'#E0454E', accentDeep:'#8B0D16' },
  'azul-institucional': { label:'Azul Institucional',          light:false, bg:'#0A1A2F', accent:'#1D6FB8', accent2:'#4FA3E3', accentDeep:'#0E4E86' },
  'azul-editorial':     { label:'Azul Editorial',              light:true,  bg:'#F7FAFD', accent:'#1565C0', accent2:'#42A5F5', accentDeep:'#0D47A1' },
  'verde-editorial':    { label:'Verde Editorial',             light:true,  bg:'#F5FAF6', accent:'#1B8A5A', accent2:'#3FBF82', accentDeep:'#116B43' },
  'roxo-premium':       { label:'Roxo Premium',                light:false, bg:'#1A0F2E', accent:'#A855F7', accent2:'#C77DFF', accentDeep:'#7E22CE' },
  'dourado-premium':    { label:'Dourado Premium',             light:false, bg:'#10131A', accent:'#E0A53B', accent2:'#F2C879', accentDeep:'#A8761A' },
  'preto-elegante':     { label:'Preto Elegante',              light:false, bg:'#0C0C0E', accent:'#C9CDD6', accent2:'#EDEFF4', accentDeep:'#8A8F9C' },
  'cinza-corporativo':  { label:'Cinza Corporativo',           light:false, bg:'#1B1E24', accent:'#5B6B82', accent2:'#9AAAC2', accentDeep:'#3C4757' },
  'laranja-criativo':   { label:'Laranja Criativo',            light:false, bg:'#161310', accent:'#F4820B', accent2:'#FFB02E', accentDeep:'#C25E00' },
  'tons-neutros':       { label:'Tons Neutros',                light:true,  bg:'#F6F4EF', accent:'#7A7468', accent2:'#A39C8C', accentDeep:'#544F45' },
  'tons-modernos':      { label:'Tons Modernos',               light:false, bg:'#101418', accent:'#14B8C4', accent2:'#5EE6D0', accentDeep:'#0C7A86' },
  'tons-vibrantes':     { label:'Tons Vibrantes',              light:false, bg:'#15101D', accent:'#FF2E97', accent2:'#36E2FF', accentDeep:'#C71585' },
  'tons-minimalistas':  { label:'Tons Minimalistas',           light:true,  bg:'#FCFCFB', accent:'#222222', accent2:'#666666', accentDeep:'#000000' },
  'tons-premium':       { label:'Tons Premium',                light:false, bg:'#1C1322', accent:'#B08D57', accent2:'#E6C988', accentDeep:'#7C5E2E' },
  'tons-tecnologicos':  { label:'Tons Tecnológicos',           light:false, bg:'#080C14', accent:'#2D8CFF', accent2:'#27E1FF', accentDeep:'#1659C7' },
  'tons-corporativos':  { label:'Tons Corporativos',           light:true,  bg:'#F6F8FB', accent:'#26425E', accent2:'#5C7A99', accentDeep:'#16293C' },
};

/* VOZES TIPOGRÁFICAS — famílias já carregadas no index.html (Fraunces, Oswald,
 * Poppins, Plus Jakarta Sans). Cada preset define as fontes de DISPLAY (títulos),
 * SERIF (destaques serifados) e COND (rótulos condensados) que os modelos leem
 * via PT.display / PT.serif / PT.cond. O corpo (PT.sans) permanece IBM Plex por
 * legibilidade. '' ou ausente = mantém a tipografia do tema. */
const POSTER_FONTS = {
  'poppins':  { label: 'Poppins — Moderno versátil',    display: "'Poppins', system-ui, sans-serif",          serif: "'Poppins', system-ui, sans-serif",          cond: "'Oswald', system-ui, sans-serif" },
  'fraunces': { label: 'Fraunces — Editorial serifado', display: "'Fraunces', Georgia, serif",                 serif: "'Fraunces', Georgia, serif",                 cond: "'Oswald', system-ui, sans-serif" },
  'oswald':   { label: 'Oswald — Impacto condensado',   display: "'Oswald', system-ui, sans-serif",            serif: "'Fraunces', Georgia, serif",                 cond: "'Oswald', system-ui, sans-serif" },
  'jakarta':  { label: 'Jakarta — Geométrico limpo',    display: "'Plus Jakarta Sans', system-ui, sans-serif", serif: "'Plus Jakarta Sans', system-ui, sans-serif", cond: "'Oswald', system-ui, sans-serif" },
};

/* ============================================================
 * TEMAS POR FAMÍLIA DE FUNDO (r105) — o usuário mantém a cor de fundo e troca
 * só o "vestido" (títulos, destaques, grafismos). 8 fundos × 9 variações = 72
 * combinações completas, GERADAS (não mantidas à mão) e anexadas a
 * POSTER_PALETTES — o motor applyPosterCustom deriva o resto (bg2, rampas,
 * gradientes, contraste) a partir destes seeds mínimos.
 * ============================================================ */
const POSTER_BG_FAMILIES = {
  'branco':        { label: 'Fundo branco',        bg: '#FDFDFC', light: true },
  'cinza-claro':   { label: 'Fundo cinza-claro',   bg: '#EEF0F2', light: true },
  'creme':         { label: 'Fundo creme',         bg: '#F8F3E8', light: true },
  'grafite':       { label: 'Fundo grafite',       bg: '#1B1E24', light: false },
  'marinho':       { label: 'Fundo azul-marinho',  bg: '#0A1A2F', light: false },
  'preto':         { label: 'Fundo preto',         bg: '#0C0C0E', light: false },
  'verde-escuro':  { label: 'Fundo verde-escuro',  bg: '#07231A', light: false },
  'vinho-escuro':  { label: 'Fundo vinho',         bg: '#26060C', light: false },
};
const POSTER_ACCENT_SETS = {
  'vermelho': { label: 'Vermelho',  accent: '#E30613', accent2: '#FF5A4D', accentDeep: '#A60410' },
  'azul':     { label: 'Azul',      accent: '#1D6FB8', accent2: '#4FA3E3', accentDeep: '#0E4E86' },
  'verde':    { label: 'Verde',     accent: '#1B8A5A', accent2: '#3FBF82', accentDeep: '#116B43' },
  'roxo':     { label: 'Roxo',      accent: '#8B5CF6', accent2: '#C084FC', accentDeep: '#6D28D9' },
  'laranja':  { label: 'Laranja',   accent: '#F4820B', accent2: '#FFB02E', accentDeep: '#C25E00' },
  'dourado':  { label: 'Dourado',   accent: '#D4A437', accent2: '#EBC96E', accentDeep: '#A8761A' },
  'magenta':  { label: 'Magenta',   accent: '#E7338C', accent2: '#FF6FB0', accentDeep: '#B01560' },
  'ciano':    { label: 'Ciano',     accent: '#0FA3B1', accent2: '#4FD6E0', accentDeep: '#0A7681' },
  // mono depende da família (escuro sobre claro / claro sobre escuro) — ver gerador
  'mono':     { label: 'Monocromático' },
};
(function generateFamilyPalettes() {
  Object.entries(POSTER_BG_FAMILIES).forEach(([famKey, fam]) => {
    Object.entries(POSTER_ACCENT_SETS).forEach(([accKey, acc]) => {
      const spec = { label: acc.label, light: fam.light, bg: fam.bg, family: famKey };
      if (accKey === 'mono') {
        if (fam.light) { spec.accent = '#1E1E1E'; spec.accent2 = '#5C5C5C'; spec.accentDeep = '#000000'; }
        else { spec.accent = '#EDEDED'; spec.accent2 = '#B8B8B8'; spec.accentDeep = '#8F8F8F'; }
      } else {
        spec.accent = acc.accent; spec.accent2 = acc.accent2; spec.accentDeep = acc.accentDeep;
      }
      POSTER_PALETTES[`${famKey}-${accKey}`] = spec;
    });
  });
})();

/* GRADIENTES prontos (combinações harmônicas) para o construtor de gradiente. */
const POSTER_GRADIENTS = {
  'vermelho-bordo':    { label:'Vermelho → Bordô',       from:'#E30613', to:'#6A0D14' },
  'azul-roxo':         { label:'Azul → Roxo',            from:'#2D6FE0', to:'#7E22CE' },
  'azulesc-azulclaro': { label:'Azul Escuro → Azul Claro', from:'#0A2E5C', to:'#4FA3E3' },
  'preto-grafite':     { label:'Preto → Cinza Grafite',  from:'#0C0C0E', to:'#3A3F47' },
  'roxo-magenta':      { label:'Roxo → Magenta',         from:'#7E22CE', to:'#FF2E97' },
  'verde-esc-claro':   { label:'Verde Escuro → Verde Claro', from:'#0E5C3A', to:'#3FBF82' },
  'dourado-laranja':   { label:'Dourado → Laranja',      from:'#E6C988', to:'#F4820B' },
  'vermelho-preto':    { label:'Vermelho → Preto',       from:'#E30613', to:'#0C0C0E' },
};

/* --- Helpers de cor (puros; entrada hex #rgb ou #rrggbb) --- */
function _hex2rgb(h) {
  h = String(h || '').trim().replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const n = parseInt(h || '0', 16) || 0;
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
function _rgbStr(h) { return _hex2rgb(h).join(','); }
function _lum(h) {
  const c = _hex2rgb(h).map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); });
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
function _mix(a, b, t) {
  const A = _hex2rgb(a), B = _hex2rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
}
function _lighten(h, t) { return _mix(h, '#ffffff', t); }
function _darken(h, t) { return _mix(h, '#000000', t); }
function _gradCss(g) { return `linear-gradient(${g.angle == null ? 150 : g.angle}deg, ${g.from} 0%, ${g.to} 100%)`; }
function _rgba(c, a) { return `rgba(${String(c).indexOf('#') === 0 ? _rgbStr(c) : c},${a})`; }

/* ===========================================================================
 * BIBLIOTECA DE PADRÕES GRÁFICOS — catálogo amplo e categorizado.
 * Desenhados em CANVAS 2D e rasterizados numa IMAGEM única (_patternDataURL),
 * usada IGUAL no preview e no export. Motivo: html2canvas 1.4.1 NÃO renderiza
 * gradientes repeating/tiled no nó-raiz do cartaz (somavam ao preview mas SUMIAM
 * no PNG) — bitmap único é confiável. Cor/alpha derivam do TEMA por padrão
 * (adaptação automática) e podem ser sobrescritas. IDs 'dots'/'grid'/'diag' = legados.
 * ==========================================================================*/
const POSTER_PATTERN_CATS = {
  geometricos: 'Geométricos', jornalisticos: 'Jornalísticos', modernos: 'Modernos',
  premium: 'Premium', tecnologia: 'Tecnologia', esportes: 'Esportes', institucional: 'Institucional',
};
// Cada padrão: draw(ctx,w,h,P) pinta o CANVAS inteiro (base já preenchida).
// P = { c1, c2 (rgba já com alpha), s (escala) }. Rotação (ang) e posição (px,py)
// são aplicadas GLOBALMENTE em _patternDataURL (translate+rotate antes do draw).
const POSTER_PATTERNS = {
  // ---- legados (mantêm cartazes antigos) ----
  'dots': { label: 'Pontos', cat: 'geometricos', a: 0.10, draw: (x, w, h, P) => _pDT(x, w, h, P.c1, 2.6 * P.s, 26 * P.s) },
  'grid': { label: 'Grade', cat: 'geometricos', a: 0.10, draw: (x, w, h, P) => _pGR(x, w, h, P.c1, Math.max(1, 1.6 * P.s), 42 * P.s) },
  'diag': { label: 'Diagonais', cat: 'geometricos', a: 0.10, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 2.4 * P.s, 17 * P.s, 45) },
  // ---- GEOMÉTRICOS ----
  'diag-fine': { label: 'Diagonais finas', cat: 'geometricos', a: 0.11, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 1.4 * P.s, 9 * P.s, 45) },
  'horiz': { label: 'Linhas horizontais', cat: 'geometricos', a: 0.11, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 2.4 * P.s, 17 * P.s, 0) },
  'vert': { label: 'Linhas verticais', cat: 'geometricos', a: 0.11, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 2.4 * P.s, 17 * P.s, 90) },
  'cross': { label: 'Linhas cruzadas', cat: 'geometricos', a: 0.09, draw: (x, w, h, P) => { _pST(x, w, h, P.c1, 2 * P.s, 15 * P.s, 45); _pST(x, w, h, P.c1, 2 * P.s, 15 * P.s, 135); } },
  'grid-fine': { label: 'Grade fina', cat: 'geometricos', a: 0.08, draw: (x, w, h, P) => _pGR(x, w, h, P.c1, Math.max(1, 1.2 * P.s), 20 * P.s) },
  'dots-lg': { label: 'Pontos grandes', cat: 'geometricos', a: 0.11, draw: (x, w, h, P) => _pDT(x, w, h, P.c1, 5 * P.s, 44 * P.s) },
  'checker': { label: 'Xadrez', cat: 'geometricos', a: 0.11, draw: (x, w, h, P) => _pCK(x, w, h, P.c1, 50 * P.s) },
  'triangles': { label: 'Triângulos', cat: 'geometricos', a: 0.12, draw: (x, w, h, P) => { _pTRI(x, w, h, P.c1, 46 * P.s, 78 * P.s, false); _pTRI(x, w, h, P.c2, 46 * P.s, 78 * P.s, true); } },
  'diamonds': { label: 'Losangos', cat: 'geometricos', a: 0.10, draw: (x, w, h, P) => { _pST(x, w, h, P.c1, 1.6 * P.s, 24 * P.s, 45); _pST(x, w, h, P.c1, 1.6 * P.s, 24 * P.s, 135); } },
  'zigzag': { label: 'Ziguezague', cat: 'geometricos', a: 0.13, draw: (x, w, h, P) => _pCH(x, w, h, P.c1, 26 * P.s, Math.max(2, 3 * P.s), true) },
  'chevron': { label: 'Chevron', cat: 'geometricos', a: 0.12, draw: (x, w, h, P) => _pCH(x, w, h, P.c1, 30 * P.s, Math.max(2, 3.5 * P.s), false) },
  'hex': { label: 'Hexagonal', cat: 'geometricos', a: 0.10, draw: (x, w, h, P) => { _pST(x, w, h, P.c1, 1.3 * P.s, 22 * P.s, 0); _pST(x, w, h, P.c1, 1.3 * P.s, 22 * P.s, 60); _pST(x, w, h, P.c1, 1.3 * P.s, 22 * P.s, 120); } },
  'plus': { label: 'Cruzetas', cat: 'geometricos', a: 0.12, draw: (x, w, h, P) => _pPLUS(x, w, h, P.c1, 32 * P.s) },
  'rings': { label: 'Círculos concêntricos', cat: 'geometricos', a: 0.10, draw: (x, w, h, P) => _pRG(x, w, h, P.c1, 22 * P.s, Math.max(1.5, 2 * P.s), w / 2, h / 2) },
  // ---- JORNALÍSTICOS ----
  'topband': { label: 'Faixa editorial (topo)', cat: 'jornalisticos', a: 0.92, accent: true, draw: (x, w, h, P) => _pBAND(x, w, h, P.c1, 'top', 110 * P.s) },
  'sidebar': { label: 'Barra lateral', cat: 'jornalisticos', a: 0.90, accent: true, draw: (x, w, h, P) => _pBAND(x, w, h, P.c1, 'left', 64 * P.s) },
  'headline-bar': { label: 'Marcador de manchete', cat: 'jornalisticos', a: 0.95, accent: true, draw: (x, w, h, P) => { x.fillStyle = P.c1; x.fillRect(0, 120 * P.s, w, 12 * P.s); } },
  'rules': { label: 'Linhas de leitura', cat: 'jornalisticos', a: 0.09, draw: (x, w, h, P) => _pST(x, w, h, P.c1, Math.max(1, 1.2 * P.s), 36 * P.s, 0) },
  'columns': { label: 'Colunas (filetes)', cat: 'jornalisticos', a: 0.09, draw: (x, w, h, P) => _pST(x, w, h, P.c1, Math.max(1, 1.2 * P.s), 120 * P.s, 90) },
  'double-rule': { label: 'Divisores (topo e base)', cat: 'jornalisticos', a: 0.6, accent: true, draw: (x, w, h, P) => { _pBAND(x, w, h, P.c1, 'top', 5 * P.s); _pBAND(x, w, h, P.c1, 'bottom', 5 * P.s); } },
  'ticker': { label: 'Ticker (diagonais)', cat: 'jornalisticos', a: 0.16, accent: true, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 6 * P.s, 13 * P.s, 60) },
  // ---- MODERNOS ----
  'glow': { label: 'Brilho suave (canto)', cat: 'modernos', a: 0.32, accent: true, draw: (x, w, h, P) => _pGLOW(x, w, h, P.c1, w, 0, Math.max(w, h) * 0.95 * P.s) },
  'dual-glow': { label: 'Duplo brilho', cat: 'modernos', a: 0.28, accent: true, draw: (x, w, h, P) => { _pGLOW(x, w, h, P.c1, 0, 0, Math.max(w, h) * 0.8 * P.s); _pGLOW(x, w, h, P.c2, w, h, Math.max(w, h) * 0.8 * P.s); } },
  'mesh': { label: 'Malha de cor', cat: 'modernos', a: 0.24, accent: true, draw: (x, w, h, P) => { _pGLOW(x, w, h, P.c1, w * 0.15, h * 0.2, w * 0.7 * P.s); _pGLOW(x, w, h, P.c2, w * 0.85, h * 0.3, w * 0.7 * P.s); _pGLOW(x, w, h, P.c1, w * 0.5, h, w * 0.8 * P.s); } },
  'wave': { label: 'Ondas', cat: 'modernos', a: 0.12, draw: (x, w, h, P) => _pWAVE(x, w, h, P.c1, 10 * P.s, 26 * P.s, Math.max(1.5, 2 * P.s)) },
  'soft-diag': { label: 'Corte diagonal suave', cat: 'modernos', a: 0.18, accent: true, draw: (x, w, h, P) => _pLIN(x, w, h, 130, [[0, P.c1], [0.45, 'rgba(0,0,0,0)'], [0.55, 'rgba(0,0,0,0)'], [1, P.c2]]) },
  'corner': { label: 'Acento de canto', cat: 'modernos', a: 0.30, accent: true, draw: (x, w, h, P) => _pGLOW(x, w, h, P.c1, 0, h, Math.max(w, h) * 0.7 * P.s) },
  'blobs': { label: 'Formas orgânicas', cat: 'modernos', a: 0.20, accent: true, draw: (x, w, h, P) => { _pGLOW(x, w, h, P.c1, w * 0.22, h * 0.28, w * 0.34 * P.s); _pGLOW(x, w, h, P.c2, w * 0.78, h * 0.64, w * 0.3 * P.s); _pGLOW(x, w, h, P.c1, w * 0.6, h * 0.18, w * 0.26 * P.s); } },
  // ---- PREMIUM ----
  'sheen': { label: 'Brilho metálico', cat: 'premium', a: 0.14, draw: (x, w, h, P) => _pLIN(x, w, h, 105, [[0, P.c2], [0.18, P.c1], [0.3, 'rgba(0,0,0,0)'], [0.5, P.c2], [0.7, 'rgba(0,0,0,0)'], [0.84, P.c1], [1, P.c2]]) },
  'pinstripe': { label: 'Risca de giz', cat: 'premium', a: 0.08, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 1, 10 * P.s, 90) },
  'carbon': { label: 'Fibra de carbono', cat: 'premium', a: 0.16, draw: (x, w, h, P) => { _pST(x, w, h, P.c1, 1.6 * P.s, 8 * P.s, 45); _pST(x, w, h, P.c2, 1.6 * P.s, 8 * P.s, 135); } },
  'frame': { label: 'Moldura elegante', cat: 'premium', a: 0.6, accent: true, draw: (x, w, h, P) => _pFRAME(x, w, h, P.c1, 8 * P.s) },
  'damask': { label: 'Damasco', cat: 'premium', a: 0.09, draw: (x, w, h, P) => { _pDT(x, w, h, P.c1, 2.4 * P.s, 42 * P.s); x.save(); x.translate(21 * P.s, 21 * P.s); _pDT(x, w, h, P.c2, 3.4 * P.s, 42 * P.s); x.restore(); } },
  'fine-cross': { label: 'Crosshatch refinado', cat: 'premium', a: 0.06, draw: (x, w, h, P) => { _pST(x, w, h, P.c1, 1, 8 * P.s, 45); _pST(x, w, h, P.c1, 1, 8 * P.s, 135); } },
  // ---- TECNOLOGIA ----
  'circuit': { label: 'Circuito', cat: 'tecnologia', a: 0.16, accent: true, draw: (x, w, h, P) => { _pGR(x, w, h, P.c2, 1, 44 * P.s); _pDT(x, w, h, P.c1, 2.6 * P.s, 44 * P.s); } },
  'nodes': { label: 'Rede de nós', cat: 'tecnologia', a: 0.14, accent: true, draw: (x, w, h, P) => { _pST(x, w, h, P.c2, 1, 54 * P.s, 45); _pDT(x, w, h, P.c1, 3 * P.s, 54 * P.s); } },
  'hex-tech': { label: 'Grade hexagonal tech', cat: 'tecnologia', a: 0.12, accent: true, draw: (x, w, h, P) => { _pST(x, w, h, P.c1, 1.2 * P.s, 28 * P.s, 0); _pST(x, w, h, P.c1, 1.2 * P.s, 28 * P.s, 60); _pST(x, w, h, P.c2, 1.2 * P.s, 28 * P.s, 120); } },
  'datagrid': { label: 'Data grid', cat: 'tecnologia', a: 0.11, accent: true, draw: (x, w, h, P) => { _pGR(x, w, h, P.c2, 1, 30 * P.s); _pDT(x, w, h, P.c1, 2 * P.s, 30 * P.s); } },
  'scanlines': { label: 'Scanlines', cat: 'tecnologia', a: 0.11, draw: (x, w, h, P) => _pST(x, w, h, P.c1, Math.max(1, 1.4 * P.s), 5 * P.s, 0) },
  'matrix': { label: 'Colunas (matrix)', cat: 'tecnologia', a: 0.13, accent: true, draw: (x, w, h, P) => _pDT(x, w, h, P.c1, 1.8 * P.s, 16 * P.s, 11 * P.s) },
  // ---- ESPORTES ----
  'speed': { label: 'Linhas de velocidade', cat: 'esportes', a: 0.18, accent: true, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 3 * P.s, 14 * P.s, 72) },
  'bands': { label: 'Faixas dinâmicas', cat: 'esportes', a: 0.20, accent: true, draw: (x, w, h, P) => _pBANDS(x, w, h, P.c1, P.c2, 20 * P.s, 120) },
  'streaks': { label: 'Riscos de movimento', cat: 'esportes', a: 0.16, accent: true, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 2 * P.s, 26 * P.s, 100) },
  'energy-chevron': { label: 'Chevron de energia', cat: 'esportes', a: 0.17, accent: true, draw: (x, w, h, P) => _pCH(x, w, h, P.c1, 36 * P.s, Math.max(2, 3.5 * P.s), false) },
  // ---- INSTITUCIONAL ----
  'sub-dots': { label: 'Pontos discretos', cat: 'institucional', a: 0.05, draw: (x, w, h, P) => _pDT(x, w, h, P.c1, 1.8 * P.s, 28 * P.s) },
  'sub-grid': { label: 'Grade discreta', cat: 'institucional', a: 0.05, draw: (x, w, h, P) => _pGR(x, w, h, P.c1, 1, 50 * P.s) },
  'sub-diag': { label: 'Diagonais discretas', cat: 'institucional', a: 0.05, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 1, 24 * P.s, 45) },
  'wash': { label: 'Lavagem executiva', cat: 'institucional', a: 0.16, draw: (x, w, h, P) => _pGLOW(x, w, h, P.c1, w * 0.7, -h * 0.1, Math.max(w, h) * 1.2 * P.s) },
  'sub-lines': { label: 'Linhas discretas', cat: 'institucional', a: 0.05, draw: (x, w, h, P) => _pST(x, w, h, P.c1, 1, 30 * P.s, 0) },
};

/* --- Primitivas de desenho em CANVAS 2D (over-draw generoso p/ cobrir após
 * translate/rotate globais). html2canvas renderiza o BITMAP resultante de forma
 * confiável (ao contrário de gradientes repeating/tiled em CSS no nó-raiz). --- */
function _pST(ctx, w, h, c, lw, gap, deg) { gap = Math.max(2, gap); ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate((deg || 0) * Math.PI / 180); ctx.fillStyle = c; const L = Math.hypot(w, h); for (let y = -L; y < L; y += gap) ctx.fillRect(-L, y, 2 * L, lw); ctx.restore(); }
function _pGR(ctx, w, h, c, lw, gap) { gap = Math.max(3, gap); ctx.fillStyle = c; for (let x = -gap; x < w + gap; x += gap) ctx.fillRect(x, -gap, lw, h + 2 * gap); for (let y = -gap; y < h + gap; y += gap) ctx.fillRect(-gap, y, w + 2 * gap, lw); }
function _pDT(ctx, w, h, c, r, gx, gy) { gx = Math.max(4, gx); gy = gy || gx; ctx.fillStyle = c; for (let y = -gy; y < h + gy; y += gy) for (let x = -gx; x < w + gx; x += gx) { ctx.beginPath(); ctx.arc(x, y, Math.max(0.5, r), 0, 6.2832); ctx.fill(); } }
function _pCK(ctx, w, h, c, sz) { sz = Math.max(4, sz); ctx.fillStyle = c; let ry = 0; for (let y = -sz; y < h + sz; y += sz, ry++) { let rx = 0; for (let x = -sz; x < w + sz; x += sz, rx++) if ((rx + ry) % 2 === 0) ctx.fillRect(x, y, sz, sz); } }
function _pTRI(ctx, w, h, c, bw, bh, up) { bw = Math.max(6, bw); bh = Math.max(6, bh); ctx.fillStyle = c; for (let y = -bh; y < h + bh; y += bh) for (let x = -bw; x < w + bw; x += bw) { ctx.beginPath(); if (up) { ctx.moveTo(x, y); ctx.lineTo(x + bw / 2, y + bh); ctx.lineTo(x + bw, y); } else { ctx.moveTo(x, y + bh); ctx.lineTo(x + bw / 2, y); ctx.lineTo(x + bw, y + bh); } ctx.closePath(); ctx.fill(); } }
function _pRG(ctx, w, h, c, gap, lw, cx, cy) { gap = Math.max(4, gap); ctx.strokeStyle = c; ctx.lineWidth = lw; const R = Math.hypot(w, h); for (let r = gap; r < R; r += gap) { ctx.beginPath(); ctx.arc(cx, cy, r, 0, 6.2832); ctx.stroke(); } }
function _pCH(ctx, w, h, c, sz, lw, fill) { sz = Math.max(8, sz); ctx.strokeStyle = c; ctx.fillStyle = c; ctx.lineWidth = lw; for (let y = -sz; y < h + sz; y += sz) for (let x = -sz; x < w + sz; x += sz) { ctx.beginPath(); ctx.moveTo(x, y + sz * 0.68); ctx.lineTo(x + sz / 2, y + sz * 0.18); ctx.lineTo(x + sz, y + sz * 0.68); if (fill) { ctx.lineTo(x + sz, y + sz * 0.68 + lw * 1.6); ctx.lineTo(x + sz / 2, y + sz * 0.18 + lw * 1.6); ctx.lineTo(x, y + sz * 0.68 + lw * 1.6); ctx.closePath(); ctx.fill(); } else ctx.stroke(); } }
function _pPLUS(ctx, w, h, c, gap) { gap = Math.max(8, gap); ctx.strokeStyle = c; ctx.lineWidth = Math.max(1, gap * 0.07); const a = gap * 0.2; for (let y = gap / 2; y < h + gap; y += gap) for (let x = gap / 2; x < w + gap; x += gap) { ctx.beginPath(); ctx.moveTo(x - a, y); ctx.lineTo(x + a, y); ctx.moveTo(x, y - a); ctx.lineTo(x, y + a); ctx.stroke(); } }
function _pGLOW(ctx, w, h, c, fx, fy, r) { r = Math.max(20, r); const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, r); g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,0)'); ctx.fillStyle = g; ctx.fillRect(-w, -h, 3 * w, 3 * h); }
function _pLIN(ctx, w, h, deg, stops) { const rad = deg * Math.PI / 180, cx = w / 2, cy = h / 2, L = Math.hypot(w, h) / 2, dx = Math.cos(rad) * L, dy = Math.sin(rad) * L; const g = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy); stops.forEach(s => g.addColorStop(s[0], s[1])); ctx.fillStyle = g; ctx.fillRect(-w, -h, 3 * w, 3 * h); }
function _pWAVE(ctx, w, h, c, amp, gap, lw) { gap = Math.max(6, gap); ctx.strokeStyle = c; ctx.lineWidth = lw; for (let y = 0; y < h + gap; y += gap) { ctx.beginPath(); for (let x = 0; x <= w; x += 6) { const yy = y + Math.sin(x / 28) * amp; if (x === 0) ctx.moveTo(x, yy); else ctx.lineTo(x, yy); } ctx.stroke(); } }
function _pBAND(ctx, w, h, c, side, t) { ctx.fillStyle = c; if (side === 'top') ctx.fillRect(0, 0, w, t); else if (side === 'bottom') ctx.fillRect(0, h - t, w, t); else if (side === 'left') ctx.fillRect(0, 0, t, h); else ctx.fillRect(w - t, 0, t, h); }
function _pFRAME(ctx, w, h, c, t) { ctx.fillStyle = c; ctx.fillRect(0, 0, w, t); ctx.fillRect(0, h - t, w, t); ctx.fillRect(0, 0, t, h); ctx.fillRect(w - t, 0, t, h); }
function _pBANDS(ctx, w, h, c1, c2, bw, deg) { bw = Math.max(6, bw); ctx.save(); ctx.translate(w / 2, h / 2); ctx.rotate(deg * Math.PI / 180); const L = Math.hypot(w, h); let i = 0; for (let y = -L; y < L; y += bw, i++) { ctx.fillStyle = (i % 2 === 0) ? c1 : c2; ctx.fillRect(-L, y, 2 * L, bw); } ctx.restore(); }

const _patCache = new Map();   // dataURL por (id|opts|base|fmt) — evita re-desenhar no preview ao vivo
/** Rasteriza o padrão num CANVAS full-size (imagem única) → dataURL. Cor/alpha
 * derivam do tema (PT) quando não sobrescritas. PREVIEW e EXPORT usam a MESMA
 * imagem → idênticos, e o html2canvas pinta bitmap de forma confiável. */
function _patternDataURL(id, opts, baseColor, fmt) {
  opts = opts || {};
  const entry = POSTER_PATTERNS[id] || POSTER_PATTERNS['dots'];
  const a = (opts.alpha != null) ? opts.alpha : entry.a;
  const contrast = PT.light ? '#141414' : '#FFFFFF';
  const accent = PT.red || PT.terra || contrast;
  const c1 = opts.c1 || (entry.accent ? accent : contrast);
  const c2 = opts.c2 || (entry.accent ? contrast : accent);
  const P = {
    c1: _rgba(c1, a), c2: _rgba(c2, Math.max(0.03, a * (entry.accent ? 0.85 : 0.6))),
    s: (opts.scale != null) ? opts.scale : 1,
  };
  const ang = (opts.angle != null) ? opts.angle : 0;
  const px = (opts.posX != null) ? opts.posX : 0;
  const py = (opts.posY != null) ? opts.posY : 0;
  const w = fmt && fmt.w || 1080, hh = fmt && fmt.h || 1440;
  const key = [id, a, c1, c2, P.s, ang, px, py, baseColor, w, hh].join('|');
  if (_patCache.has(key)) return _patCache.get(key);
  const cv = document.createElement('canvas'); cv.width = w; cv.height = hh;
  const ctx = cv.getContext('2d');
  ctx.fillStyle = baseColor; ctx.fillRect(0, 0, w, hh);
  ctx.save();
  ctx.translate(px, py);
  if (ang) { ctx.translate(w / 2, hh / 2); ctx.rotate(ang * Math.PI / 180); ctx.translate(-w / 2, -hh / 2); }
  try { entry.draw(ctx, w, hh, P); } catch (e) { /* desenho defensivo */ }
  ctx.restore();
  const url = cv.toDataURL('image/png');
  if (_patCache.size > 32) _patCache.clear();
  _patCache.set(key, url);
  return url;
}

/* Reconstrói uma SPEC de makeTheme a partir do tema ATIVO (PT) — base quando o
 * usuário não escolheu paleta (personaliza sobre o tema atual). */
function _specFromPT() {
  return {
    light: PT.light,
    bg: PT.navy, bg2: PT.navy2, bgDeep: PT.sandDeep,
    accent: PT.red, accent2: PT.orange, accentDeep: PT.redDeep,
    accentSoft: PT.terraSoft, gradSolid: PT.gradSolid, gradDark: PT.gradDark,
    text: PT.cream, textRgb: _rgbStr(PT.cream), symbolBg: PT.symbolBg,
  };
}

/** Aplica a VOZ TIPOGRÁFICA escolhida sobre o tema (muta PT.display/serif/cond).
 *  No-op se não houver fonte custom — mantém a tipografia do tema. */
function _applyPosterFont(c) {
  const f = c && c.font && POSTER_FONTS[c.font];
  if (f) { PT.display = f.display; PT.serif = f.serif; PT.cond = f.cond; }
}

/** Aplica `p.custom` SOBRE o tema já aplicado (muta PT). No-op se vazio. */
function applyPosterCustom(c) {
  if (!c) return;
  const seeds = c.colors || {};
  const anyColor = Object.keys(seeds).some(k => seeds[k]);
  const active = c.palette || anyColor || (c.useGradientAccent && c.gradient);
  if (!active) {
    // Só a tipografia mudou (sem cor): aplica a fonte sobre o tema atual e sai.
    _applyPosterFont(c);
    return;   // demais casos "bg-only" são tratados no root, fora daqui
  }

  // 1) base: paleta escolhida OU o tema ativo
  const spec = c.palette && POSTER_PALETTES[c.palette]
    ? Object.assign({}, POSTER_PALETTES[c.palette])
    : _specFromPT();
  // preserva MARCA + TIPOGRAFIA (personalização muda só cor)
  const keep = { name: PT.name, symbol: PT.symbol, symbolBg: PT.symbolBg, display: PT.display };

  // 2) seeds do usuário
  if (seeds.bg) spec.bg = seeds.bg;
  if (seeds.accent) spec.accent = seeds.accent;
  if (seeds.accent2) spec.accent2 = seeds.accent2;
  if (seeds.text) { spec.text = seeds.text; spec.textRgb = _rgbStr(seeds.text); }

  // 3) contraste automático: claro/escuro + cor de texto a partir do FUNDO
  if (c.autoContrast !== false && (seeds.bg || c.palette)) {
    spec.light = _lum(spec.bg) > 0.55;
    if (!seeds.text) {
      spec.text = spec.light ? '#161616' : '#FFFFFF';
      spec.textRgb = spec.light ? '22,22,22' : '255,255,255';
    }
  }

  // 4) deriva rampas/gradientes ausentes (mantém harmonia)
  const lt = !!spec.light;
  if (seeds.bg || !spec.bg2) spec.bg2 = lt ? _darken(spec.bg, 0.05) : _lighten(spec.bg, 0.09);
  if (seeds.bg || !spec.bgDeep) spec.bgDeep = lt ? _darken(spec.bg, 0.10) : _darken(spec.bg, 0.34);
  if (!spec.accentDeep) spec.accentDeep = _darken(spec.accent, 0.22);
  if (!spec.accentSoft || seeds.accent) spec.accentSoft = `rgba(${_rgbStr(spec.accent)},0.18)`;
  if (!spec.gradSolid || seeds.accent || seeds.accent2)
    spec.gradSolid = `linear-gradient(150deg, ${spec.accent2 || spec.accent} 0%, ${spec.accent} 52%, ${spec.accentDeep} 100%)`;
  if (!spec.gradDark || seeds.bg)
    spec.gradDark = `linear-gradient(155deg, ${spec.bg2} 0%, ${spec.bg} 58%, ${spec.bgDeep} 100%)`;

  // 5) gradiente custom nos DESTAQUES
  if (c.useGradientAccent && c.gradient && c.gradient.from && c.gradient.to)
    spec.gradSolid = _gradCss(c.gradient);

  // 6) reconstrói TODOS os tokens (recalcula contraste/hierarquia), preserva marca/fonte
  Object.assign(PT, makeTheme(spec));
  PT.name = keep.name; PT.symbol = keep.symbol;
  if (keep.symbolBg) PT.symbolBg = keep.symbolBg;
  PT.display = keep.display; PT.serif = keep.display; PT.cond = keep.display;
  _applyPosterFont(c);   // voz tipográfica escolhida sobrescreve a fonte do tema

  // 7) overrides granulares (avançado) por cima da derivação
  if (seeds.card) { PT.navy2 = PT.paper2 = PT.sand = PT.inkPanel = PT.navySoft = seeds.card; }
  if (seeds.text2) { PT.creamMute = PT.muted = seeds.text2; }
  if (seeds.border) { PT.line = PT.creamLine = seeds.border; }
}

/** Fundo do cartaz (sólido/gradiente/padrão) aplicado ao NÓ RAIZ após o render.
 * 'theme' (ou ausente) = mantém o fundo do próprio modelo. Não toca em estrutura. */
function applyPosterRootBg(c, stageEl, fmt) {
  if (!c || !c.bg || c.bg === 'theme') return;
  const root = stageEl && (stageEl.querySelector('.poster-1440') || stageEl.firstElementChild);
  if (!root) return;
  if (c.bg === 'solid' && c.colors && c.colors.bg) root.style.background = c.colors.bg;
  else if (c.bg === 'gradient' && c.gradient && c.gradient.from && c.gradient.to) root.style.background = _gradCss(c.gradient);
  else if (c.bg === 'pattern') {
    // Padrão rasterizado em IMAGEM única (base = cor de fundo escolhida OU o fundo do
    // tema → adapta-se ao tema/paleta). Imagem única de cobertura sobrevive ao export
    // html2canvas (gradientes repeating/tiled no nó-raiz NÃO sobrevivem). PREVIEW ≡ PNG.
    const base = (c.colors && c.colors.bg) || PT.navy;
    const url = _patternDataURL(c.pattern, c.patternOpts, base, fmt || { w: 1080, h: 1440 });
    root.style.backgroundColor = base;
    root.style.backgroundImage = `url(${url})`;
    root.style.backgroundSize = '100% 100%';
    root.style.backgroundPosition = '0 0';
    root.style.backgroundRepeat = 'no-repeat';
  }
}

/* VISIBILIDADE POR ELEMENTO — conjunto OCULTO ativo (espelha o `PT` do tema).
 * `setPosterHidden(p)` é chamado junto de `applyTheme` antes de cada render;
 * `posterShow(key)` é consultado pelos helpers e modelos. O usuário oculta
 * elementos (olho no editor) SEM apagar o dado; como o export fotografa o DOM
 * já filtrado, preview ≡ PNG. Chaves: headline/subtitle/category/location/
 * personName/personRole/figure/logo/portalName/handle/tagline/header/footer/
 * counter/graphics. */
let PT_HIDDEN = new Set();
function setPosterHidden(p) {
  PT_HIDDEN = new Set(Array.isArray(p && p.hidden) ? p.hidden : []);
  ptBrandReset();
}
function posterShow(key) { return !PT_HIDDEN.has(key); }

/* MARCA 1× POR CARTAZ, "o de BAIXO vence" (r103): cada peça do perfil (nome,
 * handle, logo) aparece uma única vez — e quando o modelo a repete (cabeçalho +
 * rodapé), fica a ocorrência INFERIOR (última na ordem do fonte = visual).
 * Mecânica em DUAS PASSADAS por render (ver renderTemplateDeduped):
 *   1ª (PT_BRAND_TOTALS = null): renderiza descartando a string, só CONTA;
 *   2ª: cada gate só devolve true na última ocorrência (N === total). */
let PT_BRAND_TOTALS = null;
let PT_BRAND_N = { name: 0, handle: 0, logo: 0 };
function ptBrandReset() { PT_BRAND_N = { name: 0, handle: 0, logo: 0 }; }
function ptBrandGate(kind, eyeKey) {
  if (!posterShow(eyeKey)) return false;
  PT_BRAND_N[kind]++;
  return !PT_BRAND_TOTALS || PT_BRAND_N[kind] === PT_BRAND_TOTALS[kind];
}
function posterHandleOnce() { return ptBrandGate('handle', 'handle'); }
function posterNameOnce() { return ptBrandGate('name', 'portalName'); }

/** Renderiza um modelo com o dedupe de marca ativo (2 passadas). Deve embrulhar
 *  TODO tpl.render que vá para a tela/export (preview, export e thumbs). */
function renderTemplateDeduped(renderFn) {
  PT_BRAND_TOTALS = null;
  ptBrandReset();
  renderFn();                                   // 1ª passada: contagem
  PT_BRAND_TOTALS = { ...PT_BRAND_N };
  ptBrandReset();
  const html = renderFn();                      // 2ª passada: só a última fica
  PT_BRAND_TOTALS = null;
  return html;
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                     */
/* -------------------------------------------------------------------------- */

function num2(n) { return String(n || 0).padStart(2, '0'); }

/** Símbolo "M" (monograma do tema Portal): duas fitas formando o M — traço esquerdo
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

/** Bloco de logo: imagem do portal → símbolo "M" (tema MB) → caixa com a SIGLA.
 *  Gate 1×/cartaz (o de baixo vence) — assim o masthead do cabeçalho some POR
 *  INTEIRO quando o rodapé repete a marca. */
function posterLogoBlock(portal, size, variant) {
  if (!ptBrandGate('logo', 'logo')) return '';
  const s = size || 96;
  const r = Math.round(s * 0.2);
  if (portal && portal.logo) {
    // data-logo-cover/data-radius: o export (captureStageCanvas) "achata" a logo num
    // canvas com cover + cantos arredondados — o html2canvas 1.4.1 IGNORA object-fit
    // e ESTICARIA a logo (não-quadrada) no PNG. No preview, object-fit:cover já vale.
    return `<img src="${portal.logo}" data-logo-cover="1" data-radius="${r}" style="width:${s}px;height:${s}px;border-radius:${r}px;object-fit:cover;display:block;flex-shrink:0;" alt="" crossorigin="anonymous" />`;
  }
  // Símbolo M só nos temas "Portal" (symbol 'mb'); outros temas usam a sigla.
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
  // Caixa POSICIONADA livre (absolute) com uma imagem dentro — base do
  // picture-in-picture. O export lê este div como `container` da imagem
  // (offsetWidth/Height) e a achata num canvas, então qualquer posição/tamanho
  // sobrevive ao PNG. `css` define posição/dimensão/borda.
  const absBox = (k, css) => `<div style="position:absolute;overflow:hidden;${css}">${posterImageLayer(p, k)}</div>`;

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
    inner = buildMosaic(keys, n, mode, { cell, rowOf, colOf, frame, clipCell, absBox });
  }
  return `<div style="position:absolute;inset:0;overflow:hidden;background:${bg};">${inner}</div>`;
}

/** Monta o HTML de um mosaico para o modo dado (flex puro — html2canvas-safe). */
function buildMosaic(keys, n, mode, h) {
  const { cell, rowOf, colOf, frame, clipCell, absBox } = h;
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
    // ----- NOVAS DISPOSIÇÕES -----
    case 'pip':         // 2 imgs: uma sobre a outra (picture-in-picture)
      return absBox(keys[0], 'inset:0;') +
             absBox(keys[1], 'right:5%;bottom:5%;width:40%;height:40%;border:6px solid #fff;box-sizing:border-box;');
    case 'diag-h':      // 2 imgs: divisória diagonal HORIZONTAL (cima/baixo)
      return clipCell(keys[0], '0 0, 100 0, 100 100, 0 100') + clipCell(keys[1], '0 56, 100 44, 100 100, 0 100');
    case 'center-wide': // 3 imgs: destaque no CENTRO, apoios nas laterais
      if (n >= 3) return frame(cell(keys[1]) + cell(keys[0], 1.7) + cell(keys[2]), 'row');
      return frame(lead(1.7) + cell(keys[1]), 'row');
    case 'pinwheel':    // 4 imgs: cata-vento (colunas com pesos alternados)
      if (n >= 4) return frame(colOf(cell(keys[0], 1.4) + cell(keys[1], 1)) + colOf(cell(keys[2], 1) + cell(keys[3], 1.4)), 'row');
      return frame(allCells, 'row');
    case 'grid-bottom': // base em destaque (linha de baixo maior)
      if (n >= 4) return frame(rowOf(cell(keys[0]) + cell(keys[1]), 1) + rowOf(cell(keys[2]) + cell(keys[3]), 1.35), 'column');
      if (n === 3) return frame(rowOf(cell(keys[0]) + cell(keys[1]), 1) + cell(keys[2], 1.35), 'column');
      return frame(allCells, 'column');
    case 'bricks':      // 4 imgs: tijolos (larguras alternadas por linha)
      if (n >= 4) return frame(rowOf(cell(keys[0], 1.6) + cell(keys[1], 1)) + rowOf(cell(keys[2], 1) + cell(keys[3], 1.6)), 'column');
      return frame(allCells, 'column');
    case 'diag-cross':  // 4 imgs: quatro triângulos a partir do centro (X)
      if (n >= 4) return clipCell(keys[0], '0 0, 100 0, 50 50') + clipCell(keys[1], '100 0, 100 100, 50 50') + clipCell(keys[2], '0 100, 100 100, 50 50') + clipCell(keys[3], '0 0, 0 100, 50 50');
      return frame(allCells, 'row');
    case 'band-center': // 3 imgs: três faixas horizontais, a do meio maior
      if (n >= 3) return frame(cell(keys[0]) + cell(keys[1], 1.7) + cell(keys[2]), 'column');
      return frame(allCells, 'column');
    case 'band-top':    // faixa larga em cima + colunas embaixo
      if (n >= 4) return frame(cell(keys[0], 1.4) + rowOf(cell(keys[1]) + cell(keys[2]) + cell(keys[3]), 1), 'column');
      if (n === 3) return frame(cell(keys[0], 1.4) + rowOf(cell(keys[1]) + cell(keys[2]), 1), 'column');
      return frame(allCells, 'column');
    case 'center-pip':  // 2 imgs: inset CENTRALIZADO sobre o fundo
      return absBox(keys[0], 'inset:0;') + absBox(keys[1], 'left:24%;top:31%;width:52%;height:38%;border:6px solid #fff;box-sizing:border-box;');
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
      { v: 'diag-h', l: 'Diagonal horizontal' },
      { v: 'pip', l: 'Imagem sobre imagem' },
      { v: 'center-pip', l: 'Inset centralizado' },
      { v: 'slant', l: 'Atravessada' }
    );
  } else if (n === 3) {
    o.push(
      { v: 'feature-left', l: 'Destaque à esquerda' },
      { v: 'feature-right', l: 'Destaque à direita' },
      { v: 'center-wide', l: 'Destaque no centro' },
      { v: 'feature-top', l: 'Destaque em cima' },
      { v: 'feature-bottom', l: 'Destaque embaixo' },
      { v: 'grid-bottom', l: 'Base em destaque' },
      { v: 'band-center', l: 'Faixa central' },
      { v: 'band-top', l: 'Faixa no topo' },
      { v: 'row', l: 'Três colunas' },
      { v: 'col', l: 'Três faixas' },
      { v: 'slant', l: 'Atravessadas' }
    );
  } else if (n >= 4) {
    o.push(
      { v: 'grid', l: 'Grade 2×2' },
      { v: 'grid-top', l: 'Grade — topo em destaque' },
      { v: 'grid-bottom', l: 'Grade — base em destaque' },
      { v: 'pinwheel', l: 'Cata-vento' },
      { v: 'bricks', l: 'Tijolos' },
      { v: 'diag-cross', l: 'Cruz diagonal' },
      { v: 'band-top', l: 'Faixa no topo' },
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

/** Lockup de marca (logo + nome + handle) — cada peça respeita seu olho E o
 *  gate 1×/cartaz "o de baixo vence" (r103). Quando o modelo repete o lockup
 *  (cabeçalho + rodapé), as três peças só passam no gate na ÚLTIMA chamada —
 *  o masthead do cabeçalho colapsa para '' e o do rodapé fica completo. */
function ptMasthead(portal, opts) {
  opts = opts || {};
  const onDark = opts.onDark != null ? opts.onDark : !PT.light;
  const ink = onDark ? PT.onDark : PT.cream;
  const mut = onDark ? PT.onDarkMut : PT.creamMute;
  const logo = posterLogoBlock(portal, opts.size || 66, onDark ? 'light' : 'dark');   // '' se logo oculto/repetido
  const nameHtml = posterNameOnce() ? `<div style="font-family:${PT.serif};font-weight:800;font-size:${opts.nameSize || 29}px;letter-spacing:-0.01em;color:${ink};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.name || 'Nome do projeto')}</div>` : '';
  const handleHtml = posterHandleOnce() ? `<div style="font-family:${PT.sans};font-weight:600;font-size:18px;letter-spacing:0.04em;color:${mut};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</div>` : '';
  const text = (nameHtml || handleHtml) ? `<div style="min-width:0;line-height:1.08;">${nameHtml}${handleHtml}</div>` : '';
  if (!logo && !text) return '<span></span>';   // span vazio preserva o justify dos cabeçalhos
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
  // r102: o perfil aparece UMA vez por cartaz — ptMasthead já se auto-deduplica
  // (2ª chamada devolve span vazio); em modelos sem cabeçalho, o rodapé é o lar
  // do lockup completo.
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
        ${hasImg && posterHandleOnce() ? `<div style="position:absolute;left:22px;bottom:18px;pointer-events:none;font-family:${PT.sans};font-size:22px;font-weight:600;letter-spacing:0.02em;color:#fff;">${escapeHtml(portal.handle || '@portal')}</div>` : ''}
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
          ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
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
        ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:24px;font-weight:700;letter-spacing:0.02em;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
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
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.0;letter-spacing:0.004em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:30px;font-weight:500;line-height:1.3;color:${PT.creamMute};margin:0;max-width:92%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('footer') ? `<div style="border-top:1.5px solid rgba(245,239,227,0.3);padding-top:16px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
          ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:22px;font-weight:600;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
          ${posterNameOnce() ? `<span style="font-family:${PT.serif};font-weight:700;font-size:23px;color:rgba(245,239,227,0.9);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:55%;">${escapeHtml(portal.name || '')}</span>` : ''}
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
          ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:19px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
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
          ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
          ${posterNameOnce() ? `<span style="font-family:${PT.serif};font-style:italic;font-weight:600;font-size:22px;color:rgba(255,255,255,0.92);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50%;">${escapeHtml(portal.name || '')}</span>` : ''}
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
        ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:23px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
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
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:0.004em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
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
        ${posterShow('headline') && headline ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.04;letter-spacing:0.004em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
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
        ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:22px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
        ${p.location ? `<span style="font-family:${PT.serif};font-weight:600;font-size:22px;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50%;">${escapeHtml(p.location)}</span>` : ''}
      </div>`}
    </div>
  `;
}

/* ==========================================================================
 * MODELOS ADICIONAIS (r58) — composições novas, distintas das anteriores.
 * Mesmos campos do cartaz; token-driven (PT.*); só técnicas html2canvas-safe.
 * ==========================================================================*/

/** 11 — MOSAICO DE FOTOS: o mosaico é o PROTAGONISTA (até 4 fotos) + faixa de texto. */
function tplMosaicHero(p, fmt, portal) {
  const layer = posterPhotoMosaic(p, { two: 'row', three: 'grid', four: 'grid', gapColor: PT.ink });
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[40, 70], [80, 56], [140, 44]], 40);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;overflow:hidden;box-sizing:border-box;">
      <div style="flex:2.4;min-height:0;position:relative;overflow:hidden;">
        ${layer}
        <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to bottom, rgba(15,12,8,0.5) 0%, rgba(15,12,8,0) 24%);"></div>
        <div style="position:absolute;top:46px;left:50px;right:50px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
          ${_dfMasthChip(portal)}
          ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : (p.location ? posterLocationPill(p.location, true) : '')}
        </div>
      </div>
      ${posterShow('graphics') ? `<div style="height:8px;background:${PT.terra};flex-shrink:0;"></div>` : ''}
      <div style="flex:1;min-height:0;background:${PT.ink};padding:36px 50px;display:flex;flex-direction:column;justify-content:center;gap:16px;box-sizing:border-box;">
        ${posterKicker(p.category, { color: PT.redOnDark })}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.0;letter-spacing:0.004em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('footer') ? `<div style="border-top:1.5px solid ${PT.creamLine};padding-top:16px;display:flex;align-items:center;justify-content:space-between;gap:14px;">
          ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 48, nameSize: 22 }) : '<span></span>'}
          ${posterShow('location') && p.location ? `<span style="font-family:${PT.sans};font-size:20px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:46%;">${escapeHtml(p.location)}</span>` : ''}
        </div>` : ''}
      </div>
    </div>
  `;
}

/** 12 — REVISTA: coluna de texto (papel) à esquerda + foto à direita (split editorial). */
function tplRevistaSplit(p, fmt, portal) {
  const k0 = posterImageKeys(p)[0];
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[28, 60], [56, 48], [100, 38]], 32);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:row;overflow:hidden;box-sizing:border-box;">
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;padding:60px 46px;box-sizing:border-box;">
        ${posterShow('header') ? ptMasthead(portal, { size: 56, nameSize: 25 }) : ''}
        <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;">
          ${posterKicker(p.category)}
          ${posterShow('headline') ? `<h1 style="font-family:${PT.serif};font-weight:600;font-size:${hSize}px;line-height:1.04;letter-spacing:-0.02em;color:${PT.cream};margin:22px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
          ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.sans};font-size:25px;font-weight:400;line-height:1.5;color:${PT.muted};margin:24px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        </div>
        ${posterShow('footer') ? `<div style="flex-shrink:0;border-top:1.5px solid ${PT.creamLine};padding-top:18px;display:flex;align-items:center;justify-content:space-between;gap:12px;">
          ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:19px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
          ${p._total ? ptCounter(p, { size: 22 }) : ''}
        </div>` : ''}
      </div>
      <div style="flex:1.05;min-width:0;position:relative;overflow:hidden;background:${PT.inkPanel};">
        ${k0 ? `<div style="position:absolute;inset:0;">${posterImageLayer(p, k0)}</div>` : posterPhotoPlaceholder()}
        ${p.location ? `<div style="position:absolute;left:24px;bottom:24px;pointer-events:none;">${posterLocationPill(p.location, true)}</div>` : ''}
      </div>
    </div>
  `;
}

/** 13 — FAIXA INFERIOR (lower-third de TV): foto cheia + barra inferior com tag + título. */
function tplLowerThird(p, fmt, portal) {
  const k0 = posterImageKeys(p)[0];
  const layer = posterPhotoMosaic(p, { two: 'row', three: 'feature-left', four: 'grid', gapColor: PT.ink });
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[36, 64], [70, 52], [120, 42]], 36);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:#fff;font-family:${PT.sans};position:relative;overflow:hidden;box-sizing:border-box;">
      <div style="position:absolute;inset:0;">${k0 ? layer : posterPhotoPlaceholder()}</div>
      <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to top, rgba(11,20,33,0.92) 0%, rgba(11,20,33,0.2) 34%, rgba(11,20,33,0) 50%, rgba(11,20,33,0.45) 100%);"></div>
      <div style="position:absolute;top:48px;left:52px;right:52px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
        ${_dfMasthChip(portal)}
        ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : (p.location ? posterLocationPill(p.location, true) : '')}
      </div>
      <div style="position:absolute;left:0;right:0;bottom:54px;pointer-events:none;">
        ${posterShow('category') ? `<div style="display:inline-block;background:${PT.terra};color:#fff;font-family:${PT.cond};font-weight:800;font-size:26px;letter-spacing:0.16em;text-transform:uppercase;padding:12px 28px 12px 52px;">${escapeHtml(p.category || 'Ao vivo')}</div>` : ''}
        <div style="background:linear-gradient(to right, rgba(11,20,33,0.86) 0%, rgba(11,20,33,0.62) 100%);border-left:8px solid ${PT.terra};padding:26px 52px;">
          ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:0.004em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
          ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:27px;font-weight:500;line-height:1.3;color:rgba(255,255,255,0.95);margin:12px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
          ${posterShow('footer') && posterHandleOnce() ? `<div style="margin-top:16px;font-family:${PT.sans};font-size:21px;font-weight:700;letter-spacing:0.02em;color:rgba(255,255,255,0.9);">${escapeHtml(portal.handle || '@portal')}</div>` : ''}
        </div>
      </div>
    </div>
  `;
}

/** 14 — CORTE DIAGONAL: foto recortada em diagonal (data-clip) sobre fundo de acento. */
function tplDiagonalSplit(p, fmt, portal) {
  const k0 = posterImageKeys(p)[0];
  const headline = p.headline || 'Título principal';
  const hSize = posterPickSize(headline, [[40, 88], [85, 66], [140, 52]], 44);
  // Só a FOTO é recortada (clip-path no preview + data-clip no export). A cor de
  // acento é o FUNDO da página (clip-path em bloco sólido não exporta).
  const clip = 'polygon(0% 0%, 100% 0%, 100% 50%, 0% 72%)';
  const photo = k0
    ? `<div data-clip="0 0, 100 0, 100 50, 0 72" style="position:absolute;inset:0;overflow:hidden;clip-path:${clip};-webkit-clip-path:${clip};">${posterImageLayer(p, k0)}</div>`
    : '';
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradSolid};color:#fff;font-family:${PT.sans};position:relative;overflow:hidden;box-sizing:border-box;">
      ${photo}
      <div style="position:absolute;top:46px;left:52px;right:52px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;z-index:2;">
        ${_dfMasthChip(portal) || (posterShow('header') ? ptMasthead(portal, { onDark: true, size: 64, nameSize: 26 }) : '<span></span>')}
        ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : ''}
      </div>
      <div style="position:absolute;left:52px;right:52px;bottom:54px;z-index:2;display:flex;flex-direction:column;gap:18px;">
        ${posterShow('category') && p.category ? posterBadge(p.category, '#fff', PT.terraDeep) : ''}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.0;letter-spacing:0.004em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:30px;font-weight:500;line-height:1.3;color:rgba(255,255,255,0.95);margin:0;max-width:92%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('footer') ? `<div style="border-top:1.5px solid rgba(255,255,255,0.32);padding-top:18px;display:flex;align-items:center;justify-content:space-between;gap:14px;">
          ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:22px;font-weight:700;color:#fff;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
          ${posterShow('location') && p.location ? `<span style="font-family:${PT.serif};font-style:italic;font-weight:600;font-size:22px;color:rgba(255,255,255,0.92);overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50%;">${escapeHtml(p.location)}</span>` : ''}
        </div>` : ''}
      </div>
    </div>
  `;
}

/** 15 — PERFIL: retrato arredondado central + nome + cargo + frase + marca. */
function tplPerfilCard(p, fmt, portal) {
  const k0 = posterImageKeys(p)[0];
  const onDark = !PT.light;
  const name = p.personName || p.headline || 'Nome da pessoa';
  const role = p.personRole || '';
  const quote = p.subtitle || p.description || '';
  const qSize = posterPickSize(quote, [[80, 38], [160, 32], [260, 27]], 23);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradDark};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;align-items:center;padding:72px 64px;box-sizing:border-box;overflow:hidden;position:relative;">
      <div style="flex-shrink:0;width:100%;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { onDark, size: 58, nameSize: 24 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { onDark, size: 24 }) : ''}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;min-height:0;width:100%;">
        <div style="width:300px;height:300px;border-radius:36px;overflow:hidden;position:relative;background:${PT.inkPanel};border:4px solid ${PT.terra};flex-shrink:0;">
          ${k0 ? `<div style="position:absolute;inset:0;">${posterImageLayer(p, k0)}</div>` : posterPhotoPlaceholder()}
        </div>
        ${posterShow('category') && p.category ? `<div style="margin-top:30px;">${posterBadge(p.category, PT.terra, '#fff')}</div>` : ''}
        ${posterShow('personName') && name ? `<h1 style="font-family:${PT.serif};font-weight:800;font-size:54px;line-height:1.05;letter-spacing:-0.01em;color:${PT.cream};margin:26px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(name)}</h1>` : ''}
        ${posterShow('personRole') && role ? `<div style="font-family:${PT.sans};font-weight:600;font-size:26px;letter-spacing:0.04em;color:${PT.terra};margin-top:10px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:100%;">${escapeHtml(role)}</div>` : ''}
        ${posterShow('subtitle') && quote ? `<p style="font-family:${PT.serif};font-style:italic;font-size:${qSize}px;font-weight:500;line-height:1.4;color:${PT.creamMute};margin:28px 0 0 0;max-width:84%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(quote)}</p>` : ''}
      </div>
      ${posterShow('footer') && posterHandleOnce() ? `<div style="flex-shrink:0;width:100%;border-top:1.5px solid ${PT.creamLine};padding-top:20px;display:flex;align-items:center;justify-content:center;gap:14px;">
        ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
      </div>` : ''}
    </div>
  `;
}

/** 16 — LINHA DO TEMPO: etapas conectadas por uma linha vertical com marcadores. */
function tplTimeline(p, fmt, portal) {
  const hSize = posterPickSize(p.headline, [[36, 70], [64, 56]], 46);
  let bullets = posterBullets(p, 5);
  const empty = bullets.length === 0;
  if (empty) bullets = ['Use o campo Texto (ou gere a partir de uma matéria) para preencher as etapas.'];
  const items = bullets.map((b, i) => {
    const last = i === bullets.length - 1;
    return `
      <div style="display:flex;align-items:stretch;gap:24px;">
        <div style="flex-shrink:0;width:46px;display:flex;flex-direction:column;align-items:center;">
          <div style="width:46px;height:46px;border-radius:50%;background:${empty ? PT.line : PT.terra};color:#fff;display:flex;align-items:center;justify-content:center;font-family:${PT.cond};font-weight:800;font-size:24px;flex-shrink:0;">${empty ? '·' : num2(i + 1)}</div>
          ${!last ? `<div style="flex:1;width:4px;background:${PT.line};margin:6px 0;"></div>` : ''}
        </div>
        <div style="flex:1;min-width:0;padding-top:6px;padding-bottom:${last ? 0 : 30}px;font-family:${PT.sans};font-size:${empty ? 28 : 30}px;font-weight:500;line-height:1.34;color:${empty ? PT.muted : PT.inkSoft};overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(b)}</div>
      </div>`;
  }).join('');
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:60px 56px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
        <div style="min-width:0;">
          ${posterKicker(p.category || 'Passo a passo')}
          ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:-0.005em;margin:18px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.headline || 'Linha do tempo')}</h1>` : ''}
        </div>
        ${ptCounter(p)}
      </div>
      <div style="flex:1;display:flex;flex-direction:column;justify-content:center;min-height:0;overflow:hidden;padding:28px 0;">
        ${items}
      </div>
      ${posterMetaFooter(portal, { right: p.location || '' })}
    </div>
  `;
}

/* ==========================================================================
 * MODELOS ADICIONAIS (r58b) — utilidade municipal/jornalística.
 * ==========================================================================*/

/** 17 — EVENTO / AGENDA: bloco de DATA em destaque (campo figure) + nome + detalhes. */
function tplEvento(p, fmt, portal) {
  const headline = p.headline || 'Nome do evento';
  const hSize = posterPickSize(headline, [[36, 72], [70, 56], [120, 44]], 38);
  const date = ((p.figure && p.figure.trim()) || 'EM BREVE').toUpperCase();
  const dSize = posterPickSize(date, [[6, 116], [11, 84], [18, 60]], 46);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:60px 56px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 58, nameSize: 26 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { size: 24 }) : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:26px;">
        ${posterKicker(p.category || 'Agenda')}
        ${posterShow('figure') ? `<div style="display:inline-flex;flex-direction:column;align-items:flex-start;background:${PT.gradSolid};border-radius:20px;padding:24px 38px;align-self:flex-start;">
          <span style="font-family:${PT.sans};font-weight:700;font-size:19px;letter-spacing:0.22em;text-transform:uppercase;color:rgba(255,255,255,0.85);">Data</span>
          <span style="font-family:${PT.cond};font-weight:800;font-size:${dSize}px;line-height:0.92;letter-spacing:0.01em;color:#fff;margin-top:6px;">${escapeHtml(date)}</span>
        </div>` : ''}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.0;letter-spacing:0.004em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:30px;font-weight:500;line-height:1.32;color:${PT.inkSoft};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('location') && p.location ? `<div style="align-self:flex-start;">${posterLocationPill(p.location)}</div>` : ''}
      </div>
      ${posterMetaFooter(portal, {})}
    </div>
  `;
}

/** 18 — INFORME / SERVIÇO: linhas "rótulo: valor" com marcador (utilidade pública). */
function tplInforme(p, fmt, portal) {
  const headline = p.headline || 'Informe de serviço';
  const hSize = posterPickSize(headline, [[36, 64], [70, 50]], 42);
  let rows = posterBullets(p, 5);
  const empty = rows.length === 0;
  if (empty) rows = ['Use o campo Texto para listar as informações (ex.: "Horário: 8h às 17h").'];
  const items = rows.map((b) => {
    const m = b.split(/\s*[:—–]\s+/);
    const hasLabel = !empty && m.length >= 2 && m[0].length <= 28;
    const label = hasLabel ? m[0] : '';
    const val = hasLabel ? m.slice(1).join(' — ') : b;
    return `
      <div style="display:flex;align-items:flex-start;gap:20px;background:${PT.inkPanel};border-radius:12px;padding:22px 26px;border-left:6px solid ${empty ? PT.line : PT.terra};">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="${empty ? PT.muted : PT.terra}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;margin-top:4px;"><polyline points="20 6 9 17 4 12"/></svg>
        <div style="flex:1;min-width:0;">
          ${hasLabel ? `<div style="font-family:${PT.sans};font-weight:700;font-size:21px;letter-spacing:0.06em;text-transform:uppercase;color:${PT.terra};margin-bottom:3px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(label)}</div>` : ''}
          <div style="font-family:${PT.sans};font-size:27px;font-weight:500;line-height:1.3;color:${empty ? PT.muted : PT.inkSoft};overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(val)}</div>
        </div>
      </div>`;
  }).join('');
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:58px 54px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;">
        ${posterKicker(p.category || 'Informe')}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:-0.005em;margin:16px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:24px 0;">
        ${items}
      </div>
      ${posterMetaFooter(portal, { right: p.location || '' })}
    </div>
  `;
}

/** 19 — VOCÊ SABIA?: card de curiosidade/fato (interrogação fantasma + frase + explicação). */
function tplFato(p, fmt, portal) {
  const headline = p.headline || 'Você sabia disso?';
  const hSize = posterPickSize(headline, [[40, 84], [85, 62], [150, 48]], 42);
  const body = p.subtitle || p.description || '';
  const bSize = posterPickSize(body, [[120, 30], [240, 26]], 22);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradDark};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:64px 58px;box-sizing:border-box;overflow:hidden;position:relative;">
      ${posterShow('graphics') ? `<div style="position:absolute;right:-50px;bottom:-150px;font-family:${PT.serif};font-weight:900;font-size:520px;line-height:1;color:${PT.terraSoft};pointer-events:none;">?</div>` : ''}
      <div style="position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;z-index:2;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: !PT.light, size: 58, nameSize: 24 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { onDark: !PT.light, size: 24 }) : ''}
      </div>
      <div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;z-index:2;">
        <div style="margin-bottom:18px;">${posterKicker(p.category || 'Você sabia?', { color: PT.redOnDark })}</div>
        ${posterShow('headline') ? `<h1 style="font-family:${PT.serif};font-weight:700;font-size:${hSize}px;line-height:1.06;letter-spacing:-0.015em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && body ? `<p style="font-family:${PT.sans};font-size:${bSize}px;font-weight:400;line-height:1.5;color:${PT.creamMute};margin:28px 0 0 0;max-width:90%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:5;-webkit-box-orient:vertical;">${escapeHtml(body)}</p>` : ''}
      </div>
      ${posterShow('footer') ? `<div style="position:relative;z-index:2;border-top:1.5px solid ${PT.creamLine};padding-top:20px;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        ${posterHandleOnce() ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(portal.handle || '@portal')}</span>` : '<span></span>'}
        ${posterShow('location') && p.location ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;max-width:50%;">${escapeHtml(p.location)}</span>` : ''}
      </div>` : ''}
    </div>
  `;
}

/** 20 — DADO SOBRE FOTO: número/estatística gigante sobreposto a uma foto. */
function tplDadoFoto(p, fmt, portal) {
  const figure = (p.figure && p.figure.trim()) || posterFigureExtract(p.headline) || '00';
  const fSize = posterPickSize(figure, [[3, 290], [5, 220], [8, 160]], 116);
  const headline = p.headline || 'Indicador em destaque';
  const hSize = posterPickSize(headline, [[40, 54], [80, 44], [140, 36]], 32);
  const k0 = posterImageKeys(p)[0];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:#fff;font-family:${PT.sans};position:relative;overflow:hidden;box-sizing:border-box;">
      <div style="position:absolute;inset:0;">${k0 ? posterImageLayer(p, k0) : posterPhotoPlaceholder()}</div>
      <div style="position:absolute;inset:0;pointer-events:none;background:linear-gradient(to top, rgba(11,20,33,0.95) 0%, rgba(11,20,33,0.55) 34%, rgba(11,20,33,0) 60%, rgba(11,20,33,0.4) 100%);"></div>
      <div style="position:absolute;top:50px;left:54px;right:54px;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;pointer-events:none;">
        ${_dfMasthChip(portal)}
        ${p._total ? `<div style="background:rgba(15,12,8,0.44);border:1px solid rgba(245,239,227,0.22);border-radius:9px;padding:10px 14px;">${ptCounter(p, { onDark: true })}</div>` : (p.location ? posterLocationPill(p.location, true) : '')}
      </div>
      <div style="position:absolute;left:54px;right:54px;bottom:54px;pointer-events:none;display:flex;flex-direction:column;gap:8px;">
        ${posterShow('category') ? `<div style="margin-bottom:6px;">${posterKicker(p.category || 'Dados', { color: PT.redOnDark })}</div>` : ''}
        ${posterShow('figure') ? `<div style="font-family:${PT.cond};font-weight:800;font-size:${fSize}px;line-height:0.84;letter-spacing:-0.02em;color:#fff;">${escapeHtml(figure)}</div>` : ''}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.04;letter-spacing:0.004em;color:#fff;margin:6px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:27px;font-weight:500;line-height:1.3;color:rgba(255,255,255,0.92);margin:6px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>
    </div>
  `;
}

/** 21 — INDICADORES: 2–4 blocos de KPI (valor + rótulo) extraídos do texto. */
function tplKpis(p, fmt, portal) {
  const headline = p.headline || 'Indicadores';
  const hSize = posterPickSize(headline, [[36, 58], [70, 46]], 38);
  let rows = posterBullets(p, 4);
  let kpis = rows.map(b => {
    const m = b.split(/\s*[:—–]\s+/);
    if (m.length >= 2) return { v: m[0].trim(), l: m.slice(1).join(' — ').trim() };
    const mm = b.match(/^(\S+)\s+(.*)$/);
    return mm ? { v: mm[1], l: mm[2] } : { v: b, l: '' };
  }).filter(k => k.v);
  const empty = kpis.length === 0;
  if (empty) kpis = [{ v: '00', l: 'Use o campo Texto: "47% — cobertura"' }];
  kpis = kpis.slice(0, 4);
  const kpiCard = (k) => {
    const vSize = posterPickSize(k.v, [[4, 78], [7, 60], [12, 44]], 34);
    return `<div style="flex:1;min-width:0;min-height:0;background:${PT.inkPanel};border-radius:16px;padding:30px 28px;border-top:6px solid ${empty ? PT.line : PT.terra};display:flex;flex-direction:column;justify-content:center;">
        <div style="font-family:${PT.cond};font-weight:800;font-size:${vSize}px;line-height:0.9;letter-spacing:-0.01em;color:${empty ? PT.muted : PT.terra};overflow:hidden;">${escapeHtml(k.v)}</div>
        ${k.l ? `<div style="font-family:${PT.sans};font-weight:500;font-size:22px;line-height:1.28;color:${PT.inkSoft};margin-top:12px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(k.l)}</div>` : ''}
      </div>`;
  };
  const c = kpis.map(kpiCard);
  let grid;
  if (kpis.length <= 2) grid = `<div style="flex:1;display:flex;flex-direction:column;gap:18px;min-height:0;">${c.join('')}</div>`;
  else if (kpis.length === 3) grid = `<div style="flex:1;display:flex;flex-direction:row;gap:18px;min-height:0;">${c.join('')}</div>`;
  else grid = `<div style="flex:1;display:flex;flex-direction:column;gap:18px;min-height:0;">
      <div style="flex:1;display:flex;gap:18px;min-height:0;">${c[0]}${c[1]}</div>
      <div style="flex:1;display:flex;gap:18px;min-height:0;">${c[2]}${c[3]}</div>
    </div>`;
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:58px 54px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;">
        <div style="min-width:0;">
          ${posterKicker(p.category || 'Balanço')}
          ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:-0.005em;margin:16px 0 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        </div>
        ${p._total ? ptCounter(p, { size: 24 }) : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;padding:24px 0;">
        ${grid}
      </div>
      ${posterShow('subtitle') && p.subtitle ? `<div style="flex-shrink:0;font-family:${PT.sans};font-size:22px;font-weight:500;color:${PT.muted};text-align:center;padding-bottom:8px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</div>` : ''}
      ${posterMetaFooter(portal, { right: p.location || '' })}
    </div>
  `;
}

/* ==========================================================================
   MODELOS ADICIONAIS (r166) — cobrindo os usos que a biblioteca não atendia.
   O acervo era quase todo jornalístico: notícia, foto e dados. Quem precisava
   anunciar uma oferta, abrir uma vaga, publicar um comunicado ou postar uma
   frase tinha que adaptar um modelo feito para manchete — que é exatamente o
   que se pedia para não acontecer.
   Cada um traz uma COMPOSIÇÃO diferente (não só outra cor): hierarquias,
   posições, proporções de imagem e famílias tipográficas distintas, para os
   cartazes não saírem todos com a mesma cara.
   ========================================================================== */

/** PROMOÇÃO — Oferta com preço: preço é o herói, foto de apoio ao fundo. */
function tplOfertaPreco(p, fmt, portal) {
  const preco = ((p.figure && p.figure.trim()) || 'R$ 99').trim();
  const pSize = posterPickSize(preco, [[6, 168], [10, 128], [16, 96]], 74);
  const de = (p.labelA || '').trim();
  const headline = p.headline || 'Nome do produto';
  const hSize = posterPickSize(headline, [[30, 60], [60, 46]], 38);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:${PT.cream};font-family:${PT.sans};position:relative;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="position:absolute;inset:0;">${posterImageLayer(p, posterImageKeys(p)[0])}</div>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(10,10,10,0.35) 0%,rgba(10,10,10,0.82) 58%,rgba(10,10,10,0.94) 100%);"></div>
      <div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column;padding:56px 52px;box-sizing:border-box;">
        <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
          ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 56, nameSize: 25 }) : '<span></span>'}
          ${posterShow('category') ? posterBadge(p.category || 'OFERTA', PT.terra, '#fff') : ''}
        </div>
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;gap:16px;">
          ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;letter-spacing:0.004em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
          ${posterShow('figure') ? `<div style="display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap;">
            ${de ? `<span style="font-family:${PT.sans};font-size:34px;font-weight:500;color:rgba(255,255,255,0.6);text-decoration:line-through;padding-bottom:14px;">${escapeHtml(de)}</span>` : ''}
            <span style="font-family:${PT.cond};font-weight:800;font-size:${pSize}px;line-height:0.88;letter-spacing:-0.02em;color:${PT.terra};">${escapeHtml(preco)}</span>
          </div>` : ''}
          ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.sans};font-size:27px;font-weight:500;line-height:1.4;color:rgba(255,255,255,0.9);margin:0;max-width:92%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        </div>
      </div>
      ${posterShow('graphics') ? `<div style="position:relative;flex-shrink:0;height:10px;background:${PT.gradSolid};"></div>` : ''}
    </div>`;
}

/** PROMOÇÃO — Metade cor, metade foto, com selo de desconto girado. */
function tplPromoSplit(p, fmt, portal) {
  const headline = p.headline || 'Promoção da semana';
  const hSize = posterPickSize(headline, [[28, 68], [55, 54], [90, 42]], 36);
  const selo = ((p.figure && p.figure.trim()) || '50% OFF').trim();
  const sSize = posterPickSize(selo, [[7, 46], [12, 34]], 26);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};position:relative;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="flex:1 1 46%;min-height:0;position:relative;overflow:hidden;">
        <div style="position:absolute;inset:0;">${posterImageLayer(p, posterImageKeys(p)[0])}</div>
      </div>
      <div style="flex:1 1 54%;min-height:0;background:${PT.gradSolid};display:flex;flex-direction:column;justify-content:center;gap:20px;padding:48px 52px;box-sizing:border-box;position:relative;">
        ${posterShow('figure') ? `<div style="position:absolute;top:-46px;right:46px;transform:rotate(-8deg);background:${PT.paper};border:4px solid #fff;border-radius:18px;padding:14px 26px;">
          <span style="font-family:${PT.cond};font-weight:800;font-size:${sSize}px;letter-spacing:0.02em;color:#fff;">${escapeHtml(selo)}</span>
        </div>` : ''}
        ${posterShow('category') ? `<span style="font-family:${PT.sans};font-size:20px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:rgba(255,255,255,0.85);">${escapeHtml(p.category || 'Oferta')}</span>` : ''}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.04;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.sans};font-size:26px;font-weight:400;line-height:1.45;color:rgba(255,255,255,0.92);margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:16px;margin-top:6px;">
          ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 48, nameSize: 22 }) : '<span></span>'}
          ${posterShow('location') && p.location ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:600;color:rgba(255,255,255,0.9);">${escapeHtml(p.location)}</span>` : ''}
        </div>
      </div>
    </div>`;
}

/** PROMOÇÃO — Lançamento: centrado, silencioso, muito ar. Luxo/minimal. */
function tplLancamento(p, fmt, portal) {
  const headline = p.headline || 'Novo lançamento';
  const hSize = posterPickSize(headline, [[24, 96], [48, 72], [80, 54]], 44);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;align-items:center;text-align:center;padding:70px 60px;box-sizing:border-box;overflow:hidden;">
      ${posterShow('header') ? ptMasthead(portal, { size: 54, nameSize: 24 }) : '<span></span>'}
      <div style="flex:1;min-height:0;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:30px;">
        ${posterShow('category') ? `<span style="font-family:${PT.sans};font-size:19px;font-weight:700;letter-spacing:0.34em;text-transform:uppercase;color:${PT.terra};">${escapeHtml(p.category || 'Lançamento')}</span>` : ''}
        ${posterShow('graphics') ? `<span style="width:54px;height:2px;background:${PT.creamLine};display:block;"></span>` : ''}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.serif};font-weight:600;font-size:${hSize}px;line-height:1.06;letter-spacing:-0.02em;color:${PT.cream};margin:0;max-width:92%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.sans};font-size:26px;font-weight:400;line-height:1.55;color:${PT.creamMute};margin:0;max-width:76%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterImageKeys(p).length ? `<div style="width:min(62%,520px);aspect-ratio:1/1;border-radius:50%;overflow:hidden;position:relative;flex-shrink:0;">${posterImageLayer(p, posterImageKeys(p)[0])}</div>` : ''}
      </div>
      ${posterShow('figure') && p.figure ? `<div style="flex-shrink:0;font-family:${PT.cond};font-weight:700;font-size:40px;letter-spacing:0.02em;color:${PT.terra};margin-bottom:10px;">${escapeHtml(p.figure)}</div>` : ''}
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** INSTITUCIONAL — Vaga de emprego: cargo em destaque + requisitos em lista. */
function tplVaga(p, fmt, portal) {
  const cargo = p.headline || 'Nome da vaga';
  const cSize = posterPickSize(cargo, [[26, 76], [52, 58], [90, 46]], 38);
  let itens = posterBullets(p, 4);
  if (!itens.length) itens = ['Use o campo Texto para listar os requisitos.'];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;background:${PT.inkPanel};padding:44px 52px 38px;display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;">
          ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
          ${posterShow('category') ? posterBadge(p.category || 'VAGA ABERTA', PT.terra, '#fff') : ''}
        </div>
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${cSize}px;font-weight:700;line-height:1.04;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(cargo)}</h1>` : ''}
        ${posterShow('location') && p.location ? `<div style="align-self:flex-start;">${posterLocationPill(p.location)}</div>` : ''}
      </div>
      <div style="flex:1;min-height:0;padding:40px 52px;display:flex;flex-direction:column;gap:22px;box-sizing:border-box;">
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:28px;font-weight:500;line-height:1.35;color:${PT.inkSoft};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('description') ? `<ul style="list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:16px;">
          ${itens.map((it) => `<li style="display:flex;align-items:flex-start;gap:14px;">
            <span style="flex-shrink:0;width:26px;height:26px;border-radius:50%;background:${PT.terraSoft};color:${PT.terra};display:grid;place-items:center;font-size:17px;font-weight:800;margin-top:3px;">✓</span>
            <span style="font-family:${PT.sans};font-size:25px;font-weight:500;line-height:1.4;color:${PT.cream};">${escapeHtml(it)}</span>
          </li>`).join('')}
        </ul>` : ''}
      </div>
      ${posterShow('figure') && p.figure ? `<div style="flex-shrink:0;background:${PT.gradSolid};padding:26px 52px;font-family:${PT.sans};font-size:26px;font-weight:700;color:#fff;text-align:center;">${escapeHtml(p.figure)}</div>` : ''}
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** INSTITUCIONAL — Comunicado oficial: moldura sóbria, hierarquia formal. */
function tplComunicado(p, fmt, portal) {
  const headline = p.headline || 'Comunicado oficial';
  const hSize = posterPickSize(headline, [[34, 64], [70, 50], [120, 40]], 34);
  const corpo = (p.description || p.subtitle || '').trim();
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};padding:44px;box-sizing:border-box;overflow:hidden;display:flex;">
      <div style="flex:1;min-height:0;border:3px solid ${PT.creamLine};display:flex;flex-direction:column;padding:46px 46px 38px;box-sizing:border-box;">
        <div style="flex-shrink:0;display:flex;flex-direction:column;align-items:center;gap:14px;text-align:center;padding-bottom:26px;border-bottom:2px solid ${PT.creamLine};">
          ${posterShow('header') ? ptMasthead(portal, { size: 58, nameSize: 26 }) : ''}
          ${posterShow('category') ? `<span style="font-family:${PT.sans};font-size:18px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:${PT.terra};">${escapeHtml(p.category || 'Comunicado')}</span>` : ''}
        </div>
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:24px;text-align:center;padding:30px 0;">
          ${posterShow('headline') ? `<h1 style="font-family:${PT.serif};font-weight:600;font-size:${hSize}px;line-height:1.16;letter-spacing:-0.015em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
          ${posterShow('description') && corpo ? `<p style="font-family:${PT.sans};font-size:25px;font-weight:400;line-height:1.6;color:${PT.inkSoft};margin:0;max-width:88%;align-self:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;">${escapeHtml(corpo)}</p>` : ''}
        </div>
        <div style="flex-shrink:0;display:flex;align-items:center;justify-content:center;gap:18px;padding-top:22px;border-top:2px solid ${PT.creamLine};font-family:${PT.sans};font-size:21px;font-weight:600;color:${PT.creamMute};">
          ${posterShow('location') && p.location ? `<span>${escapeHtml(p.location)}</span>` : ''}
          ${posterShow('figure') && p.figure ? `<span style="color:${PT.terra};">${escapeHtml(p.figure)}</span>` : ''}
        </div>
      </div>
    </div>`;
}

/** SOCIAL — Frase motivacional: só tipografia, sem foto, muito respiro. */
function tplFrase(p, fmt, portal) {
  const frase = p.headline || p.subtitle || 'A frase que você quer destacar';
  const fSize = posterPickSize(frase, [[40, 92], [80, 70], [140, 54]], 42);
  const autor = (p.personName || p.labelA || '').trim();
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradSolid};color:#fff;font-family:${PT.sans};display:flex;flex-direction:column;padding:64px 58px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 54, nameSize: 24 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { onDark: true, size: 24 }) : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:26px;">
        ${posterShow('graphics') ? `<span style="font-family:${PT.serif};font-size:150px;line-height:0.6;color:rgba(255,255,255,0.28);">&ldquo;</span>` : ''}
        ${posterShow('headline') ? `<blockquote style="font-family:${PT.serif};font-weight:600;font-size:${fSize}px;line-height:1.16;letter-spacing:-0.02em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:6;-webkit-box-orient:vertical;">${escapeHtml(frase)}</blockquote>` : ''}
        ${autor ? `<div style="display:flex;align-items:center;gap:16px;">
          <span style="width:52px;height:3px;background:rgba(255,255,255,0.7);display:inline-block;flex-shrink:0;"></span>
          <span style="font-family:${PT.sans};font-size:26px;font-weight:700;letter-spacing:0.04em;color:rgba(255,255,255,0.94);">${escapeHtml(autor)}</span>
        </div>` : ''}
      </div>
      ${posterShow('subtitle') && p.subtitle && p.subtitle !== frase ? `<p style="flex-shrink:0;font-family:${PT.sans};font-size:24px;font-weight:400;line-height:1.45;color:rgba(255,255,255,0.85);margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
    </div>`;
}

/** SOCIAL — Antes e depois: duas fotos com rótulos, divisor central. */
function tplAntesDepois(p, fmt, portal) {
  const keys = posterImageKeys(p);
  const headline = p.headline || 'Antes e depois';
  const hSize = posterPickSize(headline, [[28, 56], [55, 44]], 34);
  const rotA = (p.labelA || 'ANTES').toUpperCase();
  const rotB = (p.labelB || 'DEPOIS').toUpperCase();
  const painel = (rot, key, cor) => `
    <div style="flex:1;min-height:0;position:relative;overflow:hidden;">
      ${key ? posterImageLayer(p, key) : posterPhotoPlaceholder()}
      <div style="position:absolute;left:0;right:0;bottom:0;padding:18px 24px;background:linear-gradient(180deg,rgba(0,0,0,0) 0%,rgba(0,0,0,0.72) 100%);">
        <span style="display:inline-block;background:${cor};color:#fff;font-family:${PT.sans};font-size:21px;font-weight:800;letter-spacing:0.16em;padding:8px 18px;border-radius:6px;">${escapeHtml(rot)}</span>
      </div>
    </div>`;
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:36px 44px 24px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
        ${posterShow('category') ? posterBadge(p.category || 'COMPARATIVO', PT.terra, '#fff') : ''}
      </div>
      ${posterShow('headline') ? `<h1 style="flex-shrink:0;font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.06;color:${PT.cream};margin:0;padding:0 44px 22px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      <div style="flex:1;min-height:0;display:flex;gap:6px;">
        ${painel(rotA, keys[0], PT.inkPanel)}
        ${painel(rotB, keys[1], PT.terra)}
      </div>
      ${posterShow('subtitle') && p.subtitle ? `<p style="flex-shrink:0;font-family:${PT.sans};font-size:24px;font-weight:400;line-height:1.4;color:${PT.creamMute};margin:0;padding:22px 44px;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** SOCIAL — Passo a passo: etapas numeradas em cartões. */
function tplPassoAPasso(p, fmt, portal) {
  const headline = p.headline || 'Passo a passo';
  const hSize = posterPickSize(headline, [[28, 62], [55, 48]], 38);
  let passos = posterBullets(p, 4);
  if (!passos.length) passos = ['Use o campo Texto: cada frase vira um passo.'];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:52px 48px;box-sizing:border-box;overflow:hidden;gap:26px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { size: 24 }) : ''}
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;gap:12px;">
        ${posterShow('category') ? posterKicker(p.category || 'Tutorial') : ''}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.04;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      </div>
      ${posterShow('description') ? `<div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;justify-content:center;">
        ${passos.map((t, i) => `<div style="display:flex;align-items:center;gap:20px;background:${PT.inkPanel};border-radius:16px;padding:20px 24px;">
          <span style="flex-shrink:0;width:52px;height:52px;border-radius:14px;background:${PT.gradSolid};color:#fff;display:grid;place-items:center;font-family:${PT.cond};font-size:30px;font-weight:800;">${i + 1}</span>
          <span style="font-family:${PT.sans};font-size:25px;font-weight:500;line-height:1.36;color:${PT.cream};overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(t)}</span>
        </div>`).join('')}
      </div>` : ''}
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** SOCIAL — Enquete: pergunta + duas alternativas confrontadas. */
function tplEnquete(p, fmt, portal) {
  const pergunta = p.headline || 'Qual você prefere?';
  const qSize = posterPickSize(pergunta, [[34, 66], [66, 52], [110, 42]], 34);
  const a = (p.labelA || 'Opção A').trim();
  const b = (p.labelB || 'Opção B').trim();
  const opcao = (txt, bg, cor) => `
    <div style="flex:1;min-height:0;background:${bg};display:flex;align-items:center;justify-content:center;padding:32px 26px;box-sizing:border-box;">
      <span style="font-family:${PT.cond};text-transform:uppercase;font-size:${posterPickSize(txt, [[12, 54], [24, 40]], 30)}px;font-weight:700;line-height:1.08;color:${cor};text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(txt)}</span>
    </div>`;
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:44px 48px 20px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
        ${posterShow('category') ? posterBadge(p.category || 'ENQUETE', PT.terra, '#fff') : ''}
      </div>
      <div style="flex-shrink:0;padding:0 48px 30px;">
        ${posterShow('headline') ? `<h1 style="font-family:${PT.serif};font-weight:600;font-size:${qSize}px;line-height:1.14;letter-spacing:-0.015em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(pergunta)}</h1>` : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;">
        ${opcao(a, PT.inkPanel, PT.cream)}
        ${posterShow('graphics') ? `<div style="flex-shrink:0;height:0;position:relative;"><span style="position:absolute;left:50%;top:50%;transform:translate(-50%,-50%);background:${PT.paper};border:3px solid ${PT.terra};color:${PT.terra};font-family:${PT.cond};font-size:26px;font-weight:800;padding:10px 22px;border-radius:999px;z-index:2;">OU</span></div>` : ''}
        ${opcao(b, PT.gradSolid, '#fff')}
      </div>
      ${posterShow('subtitle') && p.subtitle ? `<p style="flex-shrink:0;font-family:${PT.sans};font-size:23px;font-weight:500;line-height:1.4;color:${PT.creamMute};margin:0;padding:24px 48px;text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
    </div>`;
}

/** FOTO — Capa de revista: foto sangrando, marca por cima, chamadas laterais. */
function tplCapaRevista(p, fmt, portal) {
  const headline = p.headline || 'A grande reportagem';
  const hSize = posterPickSize(headline, [[26, 92], [52, 70], [90, 54]], 42);
  const chamadas = posterBullets(p, 3);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:#fff;font-family:${PT.sans};position:relative;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="position:absolute;inset:0;">${posterImageLayer(p, posterImageKeys(p)[0])}</div>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(8,8,8,0.72) 0%,rgba(8,8,8,0.18) 34%,rgba(8,8,8,0.16) 58%,rgba(8,8,8,0.88) 100%);"></div>
      <div style="position:relative;flex-shrink:0;padding:44px 48px 0;text-align:center;">
        ${posterShow('header') ? `<div style="display:flex;justify-content:center;">${ptMasthead(portal, { onDark: true, size: 74, nameSize: 42 })}</div>` : ''}
        ${posterShow('graphics') ? `<div style="height:3px;background:rgba(255,255,255,0.5);margin-top:18px;"></div>` : ''}
      </div>
      <div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;padding:0 48px 46px;gap:18px;">
        ${posterShow('category') ? `<span style="align-self:flex-start;font-family:${PT.sans};font-size:19px;font-weight:800;letter-spacing:0.26em;text-transform:uppercase;color:${PT.terra};background:#fff;padding:8px 16px;border-radius:4px;">${escapeHtml(p.category || 'Especial')}</span>` : ''}
        ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:800;line-height:0.96;letter-spacing:-0.01em;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.serif};font-style:italic;font-size:28px;font-weight:500;line-height:1.32;color:rgba(255,255,255,0.94);margin:0;max-width:88%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('description') && chamadas.length ? `<div style="display:flex;flex-direction:column;gap:9px;margin-top:6px;">
          ${chamadas.map((c) => `<div style="display:flex;align-items:center;gap:12px;">
            <span style="flex-shrink:0;width:9px;height:9px;background:${PT.terra};transform:rotate(45deg);"></span>
            <span style="font-family:${PT.sans};font-size:23px;font-weight:600;color:rgba(255,255,255,0.92);overflow:hidden;display:-webkit-box;-webkit-line-clamp:1;-webkit-box-orient:vertical;">${escapeHtml(c)}</span>
          </div>`).join('')}
        </div>` : ''}
      </div>
    </div>`;
}

/** CONTEÚDO — Cartaz tipográfico: a palavra é a imagem. Sem foto. */
function tplTipografico(p, fmt, portal) {
  const headline = p.headline || 'Palavra';
  const hSize = posterPickSize(headline, [[12, 210], [22, 150], [40, 108], [70, 78]], 56);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};position:relative;display:flex;flex-direction:column;padding:56px 50px;box-sizing:border-box;overflow:hidden;">
      <!-- A categoria na vertical fica FORA do fluxo: em writing-mode a altura do
           span é o comprimento do texto e, como item flex, empurrava o rodapé
           para fora do cartaz. -->
      ${posterShow('category') ? `<span style="position:absolute;top:56px;right:50px;font-family:${PT.sans};font-size:19px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:${PT.terra};writing-mode:vertical-rl;max-height:38%;overflow:hidden;">${escapeHtml(p.category || 'Ensaio')}</span>` : ''}
      <div style="flex-shrink:0;display:flex;align-items:flex-start;padding-right:44px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
      </div>
      <div style="flex:1 1 0;min-height:0;overflow:hidden;display:flex;align-items:center;">
        ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:800;line-height:0.86;letter-spacing:-0.03em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      </div>
      <div style="flex-shrink:0;display:flex;align-items:flex-end;justify-content:space-between;gap:26px;border-top:3px solid ${PT.cream};padding-top:22px;">
        ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.sans};font-size:26px;font-weight:500;line-height:1.4;color:${PT.inkSoft};margin:0;max-width:70%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : '<span></span>'}
        ${posterShow('figure') && p.figure ? `<span style="font-family:${PT.cond};font-size:64px;font-weight:800;line-height:0.9;color:${PT.terra};">${escapeHtml(p.figure)}</span>` : ''}
      </div>
    </div>`;
}

/** CONTEÚDO — Blocos de cor: composição geométrica, foto num quadrante. */
function tplBlocosCor(p, fmt, portal) {
  const headline = p.headline || 'Composição em blocos';
  const hSize = posterPickSize(headline, [[26, 62], [52, 48], [90, 38]], 32);
  const key = posterImageKeys(p)[0];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;padding:38px 42px 26px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 50, nameSize: 23 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { size: 23 }) : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:10px;padding:0 42px 38px;box-sizing:border-box;">
        <div style="flex:1 1 42%;min-height:0;display:flex;gap:10px;">
          <div style="flex:1.4;min-width:0;background:${PT.gradSolid};border-radius:18px;display:flex;align-items:flex-end;padding:28px;box-sizing:border-box;">
            ${posterShow('headline') ? `<h1 style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
          </div>
          <div style="flex:1;min-width:0;border-radius:18px;overflow:hidden;position:relative;background:${PT.inkPanel};">
            ${key ? posterImageLayer(p, key) : posterPhotoPlaceholder()}
          </div>
        </div>
        <div style="flex:1 1 26%;min-height:0;display:flex;gap:10px;">
          <div style="flex:1;min-width:0;background:${PT.inkPanel};border-radius:18px;display:flex;flex-direction:column;justify-content:center;padding:26px;box-sizing:border-box;gap:10px;">
            ${posterShow('category') ? `<span style="font-family:${PT.sans};font-size:18px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${PT.terra};">${escapeHtml(p.category || 'Destaque')}</span>` : ''}
            ${posterShow('subtitle') && p.subtitle ? `<p style="font-family:${PT.sans};font-size:24px;font-weight:500;line-height:1.4;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
          </div>
          ${posterShow('figure') && p.figure ? `<div style="flex:0 0 34%;background:${PT.cream};border-radius:18px;display:grid;place-items:center;padding:20px;box-sizing:border-box;">
            <span style="font-family:${PT.cond};font-size:${posterPickSize(p.figure, [[5, 76], [9, 54]], 38)}px;font-weight:800;line-height:0.9;color:${PT.paper};text-align:center;">${escapeHtml(p.figure)}</span>
          </div>` : ''}
        </div>
      </div>
    </div>`;
}

/** EVENTO — Foto de fundo + bloco de data destacado. Anúncio "de cartaz". */
function tplEventoFoto(p, fmt, portal) {
  const headline = p.headline || 'Nome do evento';
  const hSize = posterPickSize(headline, [[28, 82], [56, 62], [96, 48]], 40);
  const data = ((p.figure && p.figure.trim()) || 'EM BREVE').toUpperCase();
  const dSize = posterPickSize(data, [[6, 96], [12, 68], [20, 50]], 40);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:#fff;font-family:${PT.sans};position:relative;overflow:hidden;display:flex;flex-direction:column;box-sizing:border-box;">
      <div style="position:absolute;inset:0;">${posterImageLayer(p, posterImageKeys(p)[0]) || posterPhotoPlaceholder()}</div>
      <div style="position:absolute;inset:0;background:linear-gradient(180deg,rgba(6,8,12,0.62) 0%,rgba(6,8,12,0.24) 40%,rgba(6,8,12,0.9) 100%);"></div>
      <div style="position:relative;flex-shrink:0;display:flex;align-items:flex-start;justify-content:space-between;gap:18px;padding:44px 48px 0;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 54, nameSize: 24 }) : '<span></span>'}
        ${posterShow('category') ? posterBadge(p.category || 'AGENDA', PT.terra, '#fff') : ''}
      </div>
      <div style="position:relative;flex:1;min-height:0;display:flex;flex-direction:column;justify-content:flex-end;gap:22px;padding:0 48px 46px;">
        ${posterShow('figure') ? `<div style="align-self:flex-start;display:flex;align-items:stretch;border-radius:16px;overflow:hidden;">
          <span style="background:${PT.terra};width:12px;flex-shrink:0;"></span>
          <span style="background:rgba(255,255,255,0.96);color:${PT.ink};font-family:${PT.cond};font-weight:800;font-size:${dSize}px;line-height:0.94;letter-spacing:0.01em;padding:18px 30px;">${escapeHtml(data)}</span>
        </div>` : ''}
        ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:800;line-height:0.98;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="font-family:${PT.sans};font-size:27px;font-weight:500;line-height:1.4;color:rgba(255,255,255,0.92);margin:0;max-width:90%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('location') && p.location ? `<div style="align-self:flex-start;">${posterLocationPill(p.location, true)}</div>` : ''}
      </div>
    </div>`;
}

/** EVENTO — Contagem regressiva: o número é o cartaz. */
function tplContagem(p, fmt, portal) {
  const n = ((p.figure && p.figure.trim()) || '10').trim();
  const nSize = posterPickSize(n, [[2, 400], [3, 300], [5, 210]], 140);
  const headline = p.headline || 'Faltam poucos dias';
  const hSize = posterPickSize(headline, [[28, 62], [56, 48], [95, 38]], 32);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradSolid};color:#fff;font-family:${PT.sans};display:flex;flex-direction:column;padding:56px 50px;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 52, nameSize: 24 }) : '<span></span>'}
        ${posterShow('category') ? `<span style="font-family:${PT.sans};font-size:19px;font-weight:800;letter-spacing:0.26em;text-transform:uppercase;color:rgba(255,255,255,0.9);">${escapeHtml(p.category || 'Contagem')}</span>` : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:6px;">
        ${posterShow('figure') ? `<span style="font-family:${PT.cond};font-weight:800;font-size:${nSize}px;line-height:0.8;letter-spacing:-0.04em;color:#fff;">${escapeHtml(n)}</span>` : ''}
        ${posterShow('figure') && p.labelA ? `<span style="font-family:${PT.sans};font-size:30px;font-weight:700;letter-spacing:0.3em;text-transform:uppercase;color:rgba(255,255,255,0.88);margin-top:14px;">${escapeHtml(p.labelA)}</span>` : ''}
        ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.serif};font-weight:600;font-size:${hSize}px;line-height:1.16;color:#fff;margin:26px 0 0;max-width:88%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="font-family:${PT.sans};font-size:25px;font-weight:400;line-height:1.5;color:rgba(255,255,255,0.86);margin:12px 0 0;max-width:76%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>
      ${posterShow('location') && p.location ? `<div style="flex-shrink:0;display:flex;justify-content:center;">${posterLocationPill(p.location, true)}</div>` : ''}
    </div>`;
}

/** EVENTO — Programação: grade "horário → atração" (cada linha do Texto é um item). */
function tplProgramacao(p, fmt, portal) {
  const headline = p.headline || 'Programação';
  const hSize = posterPickSize(headline, [[24, 66], [48, 52], [80, 42]], 34);
  let linhas = posterBullets(p, 6);
  if (!linhas.length) linhas = ['09h — Use o campo Texto: uma linha por atração.'];
  // "09h — Abertura" / "09h: Abertura" → dois campos; sem separador, só o título.
  const parse = (t) => {
    const m = String(t).match(/^\s*([^—–\-:]{1,14}?)\s*[—–\-:]\s*(.+)$/);
    return m ? { h: m[1].trim(), t: m[2].trim() } : { h: '', t: String(t).trim() };
  };
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:52px 48px;box-sizing:border-box;overflow:hidden;gap:24px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
        ${posterShow('figure') && p.figure ? `<span style="font-family:${PT.cond};font-size:34px;font-weight:800;color:${PT.terra};white-space:nowrap;">${escapeHtml(p.figure)}</span>` : ''}
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;gap:12px;">
        ${posterKicker(p.category || 'Agenda')}
        ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      </div>
      ${posterShow('description') ? `<div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;">
        ${linhas.map((l) => { const it = parse(l); return `<div style="display:flex;align-items:baseline;gap:20px;padding:16px 0;border-bottom:1.5px solid ${PT.creamLine};">
          <span style="flex:0 0 auto;min-width:118px;font-family:${PT.cond};font-size:32px;font-weight:800;letter-spacing:0.01em;color:${PT.terra};">${escapeHtml(it.h || '•')}</span>
          <span style="flex:1;min-width:0;font-family:${PT.sans};font-size:26px;font-weight:600;line-height:1.32;color:${PT.cream};overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(it.t)}</span>
        </div>`; }).join('')}
      </div>` : ''}
      ${posterShow('location') && p.location ? `<div style="flex-shrink:0;align-self:flex-start;">${posterLocationPill(p.location)}</div>` : ''}
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** EVENTO — Convite: moldura dupla, serifada, centrada. Formal/cerimonial. */
function tplConvite(p, fmt, portal) {
  const headline = p.headline || 'Você está convidado';
  const hSize = posterPickSize(headline, [[26, 78], [52, 58], [90, 46]], 36);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};padding:40px;box-sizing:border-box;overflow:hidden;display:flex;">
      <div style="flex:1;min-height:0;border:2px solid ${PT.terra};padding:10px;box-sizing:border-box;display:flex;">
        <div style="flex:1;min-height:0;border:1px solid ${PT.creamLine};display:flex;flex-direction:column;align-items:center;text-align:center;padding:50px 48px 40px;box-sizing:border-box;gap:22px;">
          ${posterShow('header') ? ptMasthead(portal, { size: 56, nameSize: 25 }) : ''}
          ${posterShow('category') ? `<span style="font-family:${PT.sans};font-size:18px;font-weight:700;letter-spacing:0.36em;text-transform:uppercase;color:${PT.terra};">${escapeHtml(p.category || 'Convite')}</span>` : ''}
          <div style="flex:1;min-height:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:24px;width:100%;">
            ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.serif};font-weight:600;font-size:${hSize}px;line-height:1.1;letter-spacing:-0.02em;color:${PT.cream};margin:0;max-width:94%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
            ${posterShow('graphics') ? `<span style="display:block;width:72px;height:1.5px;background:${PT.terra};"></span>` : ''}
            ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="font-family:${PT.sans};font-size:25px;font-weight:400;line-height:1.6;color:${PT.inkSoft};margin:0;max-width:82%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
          </div>
          ${posterShow('figure') && p.figure ? `<span style="font-family:${PT.cond};font-size:46px;font-weight:800;letter-spacing:0.04em;color:${PT.terra};">${escapeHtml(p.figure)}</span>` : ''}
          ${posterShow('location') && p.location ? posterLocationPill(p.location) : ''}
        </div>
      </div>
    </div>`;
}

/** CITAÇÃO — Depoimento: avatar, estrelas, fala e assinatura. Prova social. */
function tplDepoimento(p, fmt, portal) {
  const fala = p.subtitle || p.headline || 'O que disseram sobre o trabalho.';
  const fSize = posterPickSize(fala, [[70, 44], [130, 36], [220, 30]], 25);
  const nome = (p.personName || p.labelA || '').trim();
  const cargo = (p.personRole || p.labelB || '').trim();
  const estrelas = Math.max(1, Math.min(5, parseInt(p.figure, 10) || 5));
  const key = posterImageKeys(p)[0];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:56px 50px;box-sizing:border-box;overflow:hidden;gap:26px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { size: 24 }) : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:26px;background:${PT.inkPanel};border-radius:26px;padding:44px 40px;box-sizing:border-box;">
        ${posterShow('figure') ? `<div style="display:flex;gap:8px;flex-shrink:0;">${Array.from({ length: estrelas }, () => `<span style="color:${PT.terra};font-size:36px;line-height:1;">★</span>`).join('')}</div>` : ''}
        ${posterShow('headline') && p.headline && p.headline !== fala ? `<h1 data-fit="headline" style="font-family:${PT.cond};text-transform:uppercase;font-size:${posterPickSize(p.headline, [[24, 50], [48, 40]], 32)}px;font-weight:700;line-height:1.06;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.headline)}</h1>` : ''}
        <blockquote data-fit="subtitle" style="font-family:${PT.serif};font-weight:500;font-size:${fSize}px;line-height:1.4;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;">${escapeHtml(fala)}</blockquote>
        ${(nome || cargo || key) ? `<div style="flex-shrink:0;display:flex;align-items:center;gap:18px;padding-top:22px;border-top:1.5px solid ${PT.creamLine};">
          ${key ? `<div style="flex-shrink:0;width:84px;height:84px;border-radius:50%;overflow:hidden;position:relative;border:3px solid ${PT.terra};">${posterImageLayer(p, key)}</div>` : ''}
          <div style="min-width:0;">
            ${posterShow('personName') && nome ? `<div style="font-family:${PT.serif};font-weight:800;font-size:30px;line-height:1.1;color:${PT.cream};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(nome)}</div>` : ''}
            ${posterShow('personRole') && cargo ? `<div style="font-family:${PT.sans};font-weight:600;font-size:21px;letter-spacing:0.03em;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(cargo)}</div>` : ''}
          </div>
        </div>` : ''}
      </div>
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** CITAÇÃO — Faixa de foto vertical à esquerda + citação editorial à direita. */
function tplCitacaoLateral(p, fmt, portal) {
  const frase = p.headline || 'A frase em destaque';
  const fSize = posterPickSize(frase, [[46, 62], [90, 48], [150, 38]], 30);
  const key = posterImageKeys(p)[0];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;box-sizing:border-box;overflow:hidden;">
      <div style="flex:0 0 34%;min-width:0;position:relative;overflow:hidden;background:${PT.inkPanel};">
        ${key ? posterImageLayer(p, key) : posterPhotoPlaceholder()}
        ${posterShow('graphics') ? `<div style="position:absolute;inset:0;background:linear-gradient(90deg,rgba(0,0,0,0.2) 0%,rgba(0,0,0,0) 70%);"></div>` : ''}
      </div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;padding:52px 46px;box-sizing:border-box;gap:22px;">
        <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:14px;">
          ${posterShow('header') ? ptMasthead(portal, { size: 48, nameSize: 22 }) : '<span></span>'}
          ${p._total ? ptCounter(p, { size: 22 }) : ''}
        </div>
        <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:20px;">
          ${posterShow('category') ? posterKicker(p.category || 'Entrevista', { rule: 32, size: 20 }) : ''}
          ${posterShow('graphics') ? `<span style="font-family:${PT.serif};font-size:120px;line-height:0.5;color:${PT.terraSoft};">&ldquo;</span>` : ''}
          ${posterShow('headline') ? `<blockquote data-fit="headline" style="font-family:${PT.serif};font-weight:600;font-size:${fSize}px;line-height:1.2;letter-spacing:-0.018em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:7;-webkit-box-orient:vertical;">${escapeHtml(frase)}</blockquote>` : ''}
          ${posterShow('personName') && p.personName ? `<div style="display:flex;align-items:center;gap:14px;">
            <span style="width:40px;height:3px;background:${PT.terra};display:inline-block;flex-shrink:0;"></span>
            <div style="min-width:0;">
              <div style="font-family:${PT.sans};font-size:25px;font-weight:800;color:${PT.cream};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.personName)}</div>
              ${posterShow('personRole') && p.personRole ? `<div style="font-family:${PT.sans};font-size:20px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.personRole)}</div>` : ''}
            </div>
          </div>` : ''}
        </div>
        ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="flex-shrink:0;font-family:${PT.sans};font-size:23px;font-weight:400;line-height:1.45;color:${PT.inkSoft};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>
    </div>`;
}

/** PROMOÇÃO — Cupom: bilhete destacável com código em evidência. */
function tplCupom(p, fmt, portal) {
  const codigo = ((p.figure && p.figure.trim()) || 'CUPOM10').toUpperCase();
  const cSize = posterPickSize(codigo, [[8, 82], [14, 60], [22, 44]], 34);
  const headline = p.headline || 'Desconto exclusivo';
  const hSize = posterPickSize(headline, [[26, 66], [52, 52], [90, 40]], 34);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradSolid};color:#fff;font-family:${PT.sans};display:flex;flex-direction:column;padding:48px 44px;box-sizing:border-box;overflow:hidden;gap:22px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 52, nameSize: 24 }) : '<span></span>'}
        ${posterShow('category') ? posterBadge(p.category || 'CUPOM', 'rgba(255,255,255,0.18)', '#fff') : ''}
      </div>
      <div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:14px;">
        ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:800;line-height:1.0;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="font-family:${PT.sans};font-size:25px;font-weight:500;line-height:1.45;color:rgba(255,255,255,0.9);margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
        ${posterShow('figure') ? `<div style="margin-top:14px;background:#fff;border-radius:20px;padding:30px 26px;text-align:center;">
          <div style="font-family:${PT.sans};font-size:19px;font-weight:700;letter-spacing:0.28em;text-transform:uppercase;color:${PT.terra};">Use o código</div>
          <div style="margin-top:12px;padding:16px 10px;border:3px dashed ${PT.terra};border-radius:14px;font-family:${PT.cond};font-weight:800;font-size:${cSize}px;line-height:1;letter-spacing:0.08em;color:${PT.ink};word-break:break-all;">${escapeHtml(codigo)}</div>
          ${p.labelA ? `<div style="margin-top:14px;font-family:${PT.sans};font-size:21px;font-weight:600;color:${PT.inkSoft};">${escapeHtml(p.labelA)}</div>` : ''}
        </div>` : ''}
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        ${posterShow('location') && p.location ? posterLocationPill(p.location, true) : '<span></span>'}
        ${posterShow('handle') && portal.handle ? `<span style="font-family:${PT.sans};font-size:22px;font-weight:700;color:rgba(255,255,255,0.9);">${escapeHtml(portal.handle)}</span>` : ''}
      </div>
    </div>`;
}

/** PROMOÇÃO — Catálogo: até 3 produtos em grade, com rótulos de preço. */
function tplCatalogo(p, fmt, portal) {
  const headline = p.headline || 'Novidades da semana';
  const hSize = posterPickSize(headline, [[26, 58], [52, 46], [88, 36]], 30);
  const keys = posterImageKeys(p).slice(0, 3);
  const nomes = posterBullets(p, 3);
  const precos = String(p.figure || '').split(/[|;]/).map((s) => s.trim()).filter(Boolean);
  const n = Math.max(keys.length, nomes.length, 1);
  const cel = (i) => `
    <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:10px;">
      <div style="flex:1;min-height:0;border-radius:16px;overflow:hidden;position:relative;background:${PT.inkPanel};">
        ${keys[i] ? posterImageLayer(p, keys[i]) : posterPhotoPlaceholder()}
        ${precos[i] ? `<span style="position:absolute;left:10px;bottom:10px;background:${PT.terra};color:#fff;font-family:${PT.cond};font-size:30px;font-weight:800;padding:7px 14px;border-radius:8px;">${escapeHtml(precos[i])}</span>` : ''}
      </div>
      ${nomes[i] ? `<span style="flex-shrink:0;font-family:${PT.sans};font-size:22px;font-weight:700;line-height:1.28;color:${PT.cream};text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(nomes[i])}</span>` : ''}
    </div>`;
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:48px 42px;box-sizing:border-box;overflow:hidden;gap:22px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
        ${posterShow('category') ? posterBadge(p.category || 'CATÁLOGO', PT.terra, '#fff') : ''}
      </div>
      ${posterShow('headline') ? `<h1 data-fit="headline" style="flex-shrink:0;font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.04;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      <div style="flex:1;min-height:0;display:flex;gap:12px;">
        ${Array.from({ length: n }, (_, i) => cel(i)).join('')}
      </div>
      ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="flex-shrink:0;font-family:${PT.sans};font-size:24px;font-weight:500;line-height:1.4;color:${PT.inkSoft};margin:0;text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** DADOS — Ranking: lista numerada com barra proporcional (posição = peso). */
function tplRanking(p, fmt, portal) {
  const headline = p.headline || 'Os mais procurados';
  const hSize = posterPickSize(headline, [[26, 62], [52, 48], [88, 38]], 32);
  let itens = posterBullets(p, 5);
  if (!itens.length) itens = ['Use o campo Texto: uma linha por colocação.'];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:52px 46px;box-sizing:border-box;overflow:hidden;gap:24px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
        ${posterShow('figure') && p.figure ? `<span style="font-family:${PT.cond};font-size:32px;font-weight:800;color:${PT.terra};white-space:nowrap;">${escapeHtml(p.figure)}</span>` : ''}
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;gap:12px;">
        ${posterKicker(p.category || 'Ranking')}
        ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.02;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      </div>
      ${posterShow('description') ? `<div style="flex:1;min-height:0;display:flex;flex-direction:column;gap:14px;justify-content:center;">
        ${itens.map((t, i) => `<div style="display:flex;align-items:center;gap:18px;">
          <span style="flex-shrink:0;width:56px;font-family:${PT.cond};font-size:${i === 0 ? 60 : 46}px;font-weight:800;line-height:0.9;color:${i === 0 ? PT.terra : PT.creamMute};text-align:right;">${i + 1}</span>
          <div style="flex:1;min-width:0;">
            <div style="font-family:${PT.sans};font-size:25px;font-weight:700;line-height:1.28;color:${PT.cream};overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(t)}</div>
            <div style="margin-top:8px;height:10px;border-radius:999px;background:${PT.inkPanel};overflow:hidden;">
              <span style="display:block;height:100%;width:${Math.round(100 - i * (60 / Math.max(1, itens.length)))}%;border-radius:999px;background:${i === 0 ? PT.gradSolid : PT.terra};${i ? 'opacity:0.72;' : ''}"></span>
            </div>
          </div>
        </div>`).join('')}
      </div>` : ''}
      ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="flex-shrink:0;font-family:${PT.sans};font-size:23px;font-weight:400;line-height:1.45;color:${PT.inkSoft};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** DADOS — Barras verticais: "Rótulo 42" por linha vira uma coluna do gráfico. */
function tplBarras(p, fmt, portal) {
  const headline = p.headline || 'Evolução dos números';
  const hSize = posterPickSize(headline, [[26, 60], [52, 46], [88, 36]], 30);
  const brutos = posterBullets(p, 5);
  // "Rótulo 42" / "Rótulo: 42%" → {rot, val}; sem número, distribui em degrau.
  const dados = brutos.map((t, i) => {
    // exige DÍGITO no valor: "…texto." não pode virar o número "." da coluna
    const m = String(t).match(/^(.*?)[\s:—–-]*(\d[\d.,]*)\s*%?\s*$/);
    const val = m ? parseFloat(String(m[2]).replace(/\./g, '').replace(',', '.')) : NaN;
    return { rot: (m && m[1].trim()) || String(t).trim(), val: isFinite(val) ? val : (brutos.length - i) * 10, txt: m ? m[2] : '' };
  });
  const lista = dados.length ? dados : [{ rot: 'Use o campo Texto: "Rótulo 42" por linha', val: 100, txt: '' }];
  const max = Math.max(...lista.map((d) => d.val), 1);
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:52px 46px;box-sizing:border-box;overflow:hidden;gap:22px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { size: 24 }) : ''}
      </div>
      <div style="flex-shrink:0;display:flex;flex-direction:column;gap:12px;">
        ${posterKicker(p.category || 'Dados')}
        ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.03;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      </div>
      ${posterShow('description') ? `<div style="flex:1;min-height:0;display:flex;align-items:flex-end;gap:14px;border-bottom:3px solid ${PT.cream};padding-bottom:0;">
        ${lista.map((d, i) => `<div style="flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;gap:10px;">
          <span style="flex-shrink:0;font-family:${PT.cond};font-size:26px;font-weight:800;color:${i === 0 ? PT.terra : PT.creamMute};">${escapeHtml(d.txt || String(Math.round(d.val)))}</span>
          <span style="width:100%;height:${Math.max(6, Math.round((d.val / max) * 78))}%;border-radius:10px 10px 0 0;background:${i === 0 ? PT.gradSolid : PT.inkPanel};display:block;"></span>
        </div>`).join('')}
      </div>
      <div style="flex-shrink:0;display:flex;gap:14px;">
        ${lista.map((d) => `<span style="flex:1;min-width:0;font-family:${PT.sans};font-size:20px;font-weight:600;line-height:1.24;color:${PT.inkSoft};text-align:center;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(d.rot)}</span>`).join('')}
      </div>` : ''}
      ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="flex-shrink:0;font-family:${PT.sans};font-size:23px;font-weight:400;line-height:1.45;color:${PT.inkSoft};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** NOTÍCIA — Tarja vertical: categoria girada na lateral, foto sangrando. */
function tplMancheteTarja(p, fmt, portal) {
  const headline = p.headline || 'A manchete principal';
  const hSize = posterPickSize(headline, [[28, 76], [56, 58], [96, 46]], 38);
  const key = posterImageKeys(p)[0];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.ink};color:#fff;font-family:${PT.sans};display:flex;box-sizing:border-box;overflow:hidden;">
      <div style="flex:0 0 96px;background:${PT.gradSolid};display:flex;flex-direction:column;align-items:center;justify-content:space-between;padding:34px 0;box-sizing:border-box;">
        ${posterShow('category') ? `<span style="writing-mode:vertical-rl;transform:rotate(180deg);font-family:${PT.sans};font-size:24px;font-weight:800;letter-spacing:0.3em;text-transform:uppercase;color:#fff;white-space:nowrap;overflow:hidden;">${escapeHtml(p.category || 'Notícia')}</span>` : '<span></span>'}
        ${posterShow('graphics') ? `<span style="width:34px;height:3px;background:rgba(255,255,255,0.8);display:block;"></span>` : ''}
      </div>
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;position:relative;">
        <div style="flex:1 1 56%;min-height:0;position:relative;overflow:hidden;">
          ${key ? posterImageLayer(p, key) : posterPhotoPlaceholder()}
        </div>
        <div style="flex:1 1 44%;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:16px;padding:36px 42px;box-sizing:border-box;background:${PT.ink};">
          ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:800;line-height:0.99;letter-spacing:0.004em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:4;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
          ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="font-family:${PT.serif};font-style:italic;font-size:27px;font-weight:500;line-height:1.34;color:${PT.inkSoft};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
          <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:16px;padding-top:16px;border-top:1.5px solid ${PT.creamLine};">
            ${posterShow('header') ? ptMasthead(portal, { size: 48, nameSize: 23 }) : '<span></span>'}
            ${posterShow('location') && p.location ? `<span style="font-family:${PT.sans};font-size:21px;font-weight:600;color:${PT.creamMute};overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(p.location)}</span>` : ''}
          </div>
        </div>
      </div>
    </div>`;
}

/** NOTÍCIA — Resumo do dia: chamada principal + manchetes numeradas. */
function tplResumoDia(p, fmt, portal) {
  const headline = p.headline || 'O resumo do dia';
  const hSize = posterPickSize(headline, [[24, 68], [48, 54], [82, 42]], 34);
  let manchetes = posterBullets(p, 4);
  if (!manchetes.length) manchetes = ['Use o campo Texto: uma manchete por linha.'];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;box-sizing:border-box;overflow:hidden;">
      <div style="flex-shrink:0;background:${PT.gradSolid};padding:42px 46px 34px;display:flex;flex-direction:column;gap:16px;">
        <div style="display:flex;align-items:center;justify-content:space-between;gap:18px;">
          ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 52, nameSize: 24 }) : '<span></span>'}
          ${posterShow('figure') && p.figure ? `<span style="font-family:${PT.cond};font-size:30px;font-weight:800;color:#fff;white-space:nowrap;">${escapeHtml(p.figure)}</span>` : ''}
        </div>
        ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:800;line-height:1.0;color:#fff;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="font-family:${PT.sans};font-size:24px;font-weight:500;line-height:1.4;color:rgba(255,255,255,0.9);margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>
      ${posterShow('description') ? `<div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;padding:20px 46px;box-sizing:border-box;">
        ${manchetes.map((t, i) => `<div style="display:flex;align-items:flex-start;gap:20px;padding:20px 0;${i ? `border-top:1.5px solid ${PT.creamLine};` : ''}">
          <span style="flex-shrink:0;font-family:${PT.cond};font-size:40px;font-weight:800;line-height:1;color:${PT.terra};min-width:52px;">${num2(i + 1)}</span>
          <span style="flex:1;min-width:0;font-family:${PT.serif};font-size:28px;font-weight:600;line-height:1.28;color:${PT.cream};overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(t)}</span>
        </div>`).join('')}
      </div>` : ''}
      <div style="flex-shrink:0;padding:0 46px 40px;">${posterMetaFooter(portal, { right: posterShow('location') ? p.location : '' })}</div>
    </div>`;
}

/** INSTITUCIONAL — Expediente: horários de atendimento em linhas legíveis. */
function tplExpediente(p, fmt, portal) {
  const headline = p.headline || 'Horário de atendimento';
  const hSize = posterPickSize(headline, [[26, 62], [52, 48], [88, 38]], 32);
  let linhas = posterBullets(p, 5);
  if (!linhas.length) linhas = ['Segunda a sexta — 8h às 17h'];
  const parse = (t) => {
    const m = String(t).match(/^\s*(.+?)\s*[—–:]\s*(.+)$/);
    return m ? { a: m[1].trim(), b: m[2].trim() } : { a: String(t).trim(), b: '' };
  };
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:54px 48px;box-sizing:border-box;overflow:hidden;gap:24px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 54, nameSize: 25 }) : '<span></span>'}
        ${posterShow('category') ? posterBadge(p.category || 'ATENDIMENTO', PT.terra, '#fff') : ''}
      </div>
      ${posterShow('headline') ? `<h1 data-fit="headline" style="flex-shrink:0;font-family:${PT.cond};text-transform:uppercase;font-size:${hSize}px;font-weight:700;line-height:1.03;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      ${posterShow('description') ? `<div style="flex:1;min-height:0;display:flex;flex-direction:column;justify-content:center;gap:12px;">
        ${linhas.map((l) => { const it = parse(l); return `<div style="display:flex;align-items:center;justify-content:space-between;gap:18px;background:${PT.inkPanel};border-radius:14px;padding:20px 24px;">
          <span style="flex:1;min-width:0;font-family:${PT.sans};font-size:25px;font-weight:600;line-height:1.3;color:${PT.cream};overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(it.a)}</span>
          ${it.b ? `<span style="flex:0 1 auto;max-width:48%;font-family:${PT.cond};font-size:32px;font-weight:800;letter-spacing:0.01em;color:${PT.terra};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(it.b)}</span>` : ''}
        </div>`; }).join('')}
      </div>` : ''}
      ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="flex-shrink:0;font-family:${PT.sans};font-size:24px;font-weight:400;line-height:1.45;color:${PT.inkSoft};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      ${posterShow('location') && p.location ? `<div style="flex-shrink:0;align-self:flex-start;">${posterLocationPill(p.location)}</div>` : ''}
      ${posterMetaFooter(portal, {})}
    </div>`;
}

/** INSTITUCIONAL — Homenagem: retrato circular sobre painel, tom celebrativo. */
function tplHomenagem(p, fmt, portal) {
  const headline = p.headline || 'Parabéns';
  const hSize = posterPickSize(headline, [[18, 92], [38, 68], [70, 52]], 40);
  const key = posterImageKeys(p)[0];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.gradSolid};color:#fff;font-family:${PT.sans};display:flex;flex-direction:column;align-items:center;text-align:center;padding:52px 48px;box-sizing:border-box;overflow:hidden;gap:22px;">
      <div style="flex-shrink:0;width:100%;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { onDark: true, size: 52, nameSize: 24 }) : '<span></span>'}
        ${posterShow('figure') && p.figure ? `<span style="font-family:${PT.cond};font-size:34px;font-weight:800;color:#fff;white-space:nowrap;">${escapeHtml(p.figure)}</span>` : ''}
      </div>
      <div style="flex:1;min-height:0;width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:22px;">
        ${key ? `<div style="width:min(56%,440px);aspect-ratio:1/1;border-radius:50%;overflow:hidden;position:relative;flex-shrink:0;border:6px solid rgba(255,255,255,0.9);">${posterImageLayer(p, key)}</div>` : ''}
        ${posterShow('category') ? `<span style="font-family:${PT.sans};font-size:19px;font-weight:800;letter-spacing:0.32em;text-transform:uppercase;color:rgba(255,255,255,0.9);">${escapeHtml(p.category || 'Homenagem')}</span>` : ''}
        ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.serif};font-weight:700;font-size:${hSize}px;line-height:1.08;letter-spacing:-0.02em;color:#fff;margin:0;max-width:92%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
        ${posterShow('personName') && p.personName ? `<div style="font-family:${PT.sans};font-size:27px;font-weight:700;letter-spacing:0.04em;color:rgba(255,255,255,0.95);">${escapeHtml(p.personName)}${posterShow('personRole') && p.personRole ? `<span style="display:block;font-size:21px;font-weight:500;color:rgba(255,255,255,0.78);margin-top:4px;">${escapeHtml(p.personRole)}</span>` : ''}</div>` : ''}
        ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="font-family:${PT.sans};font-size:25px;font-weight:400;line-height:1.5;color:rgba(255,255,255,0.9);margin:0;max-width:80%;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      </div>
      ${posterShow('location') && p.location ? posterLocationPill(p.location, true) : ''}
    </div>`;
}

/** FOTO — Polaroid: foto com margem larga e legenda manuscrita embaixo. */
function tplPolaroid(p, fmt, portal) {
  const headline = p.headline || 'Um instante';
  const hSize = posterPickSize(headline, [[24, 54], [46, 42], [80, 34]], 28);
  const key = posterImageKeys(p)[0];
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.inkPanel};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:44px 42px;box-sizing:border-box;overflow:hidden;gap:20px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;">
        ${posterShow('header') ? ptMasthead(portal, { size: 50, nameSize: 23 }) : '<span></span>'}
        ${p._total ? ptCounter(p, { size: 23 }) : ''}
      </div>
      <div style="flex:1;min-height:0;position:relative;display:flex;align-items:center;justify-content:center;">
        <!-- Sombra desenhada como BLOCO SÓLIDO deslocado, não box-shadow: o
             html2canvas não pinta box-shadow (vira mancha cinza no PNG) e o
             cartaz salvo deixava de bater com o preview. Assim é idêntico nos
             dois, e a sombra dura combina com a estética de foto impressa. -->
        <div style="position:absolute;left:0;top:0;width:100%;height:100%;background:rgba(0,0,0,0.34);border-radius:4px;transform:rotate(-1.4deg) translate(14px,18px);"></div>
        <div style="position:relative;width:100%;height:100%;min-height:0;background:#fdfdfb;border-radius:4px;padding:22px 22px 0;box-sizing:border-box;display:flex;flex-direction:column;transform:rotate(-1.4deg);">
          <div style="flex:1;min-height:0;position:relative;overflow:hidden;background:#111;">
            ${key ? posterImageLayer(p, key) : posterPhotoPlaceholder()}
          </div>
          <div style="flex-shrink:0;padding:22px 6px 26px;text-align:center;">
            ${posterShow('headline') ? `<h1 data-fit="headline" style="font-family:${PT.serif};font-style:italic;font-weight:600;font-size:${hSize}px;line-height:1.2;color:#1a1a1a;margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
            ${posterShow('subtitle') && p.subtitle ? `<p data-fit="subtitle" style="font-family:${PT.sans};font-size:21px;font-weight:500;line-height:1.4;color:#5b5b5b;margin:10px 0 0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
          </div>
        </div>
      </div>
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:16px;">
        ${posterShow('location') && p.location ? posterLocationPill(p.location, true) : '<span></span>'}
        ${posterShow('category') ? `<span style="font-family:${PT.sans};font-size:20px;font-weight:700;letter-spacing:0.2em;text-transform:uppercase;color:${PT.terra};">${escapeHtml(p.category || 'Registro')}</span>` : ''}
      </div>
    </div>`;
}

/** CONTEÚDO — Editorial em duas colunas com capitular. Leitura longa. */
function tplDuasColunas(p, fmt, portal) {
  const headline = p.headline || 'O título do ensaio';
  const hSize = posterPickSize(headline, [[26, 64], [52, 50], [88, 40]], 32);
  const corpo = (p.description || p.subtitle || '').trim();
  const cap = corpo ? corpo.charAt(0) : '';
  // As colunas precisam de parágrafos REAIS: um bloco único de texto com um
  // float de capitular dentro delas quebra a composição.
  const paras = corpo ? corpo.split(/\n+/).map((t) => t.trim()).filter(Boolean) : [];
  // Texto curto não enche duas colunas nem sustenta capitular: uma coluna com
  // corpo maior lê melhor do que uma segunda coluna vazia com um "O" solto.
  const longo = corpo.length >= 260;
  return `
    <div class="poster-1440" style="width:${fmt.w}px;height:${fmt.h}px;background:${PT.paper};color:${PT.cream};font-family:${PT.sans};display:flex;flex-direction:column;padding:52px 46px;box-sizing:border-box;overflow:hidden;gap:22px;">
      <div style="flex-shrink:0;display:flex;align-items:center;justify-content:space-between;gap:18px;padding-bottom:20px;border-bottom:3px solid ${PT.cream};">
        ${posterShow('header') ? ptMasthead(portal, { size: 52, nameSize: 24 }) : '<span></span>'}
        ${posterShow('category') ? `<span style="font-family:${PT.sans};font-size:19px;font-weight:700;letter-spacing:0.24em;text-transform:uppercase;color:${PT.terra};">${escapeHtml(p.category || 'Ensaio')}</span>` : ''}
      </div>
      ${posterShow('headline') ? `<h1 data-fit="headline" style="flex-shrink:0;font-family:${PT.serif};font-weight:700;font-size:${hSize}px;line-height:1.1;letter-spacing:-0.02em;color:${PT.cream};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;">${escapeHtml(headline)}</h1>` : ''}
      ${posterShow('subtitle') && p.subtitle && p.subtitle !== corpo ? `<p data-fit="subtitle" style="flex-shrink:0;font-family:${PT.serif};font-style:italic;font-size:27px;font-weight:500;line-height:1.34;color:${PT.inkSoft};margin:0;overflow:hidden;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;">${escapeHtml(p.subtitle)}</p>` : ''}
      ${posterShow('description') && corpo ? `<div style="flex:1 1 0;min-height:0;${longo ? `column-count:2;column-gap:34px;column-rule:1px solid ${PT.creamLine};` : ''}font-family:${PT.sans};font-size:${longo ? 23 : 27}px;font-weight:400;line-height:1.62;color:${PT.cream};overflow:hidden;">
        ${paras.map((t, i) => `<p style="margin:0 0 0.9em;">${i === 0 && longo ? `<span style="float:left;font-family:${PT.serif};font-weight:800;font-size:88px;line-height:0.76;padding:4px 12px 0 0;color:${PT.terra};">${escapeHtml(cap)}</span>${escapeHtml(t.slice(1))}` : escapeHtml(t)}</p>`).join('')}
      </div>` : '<div style="flex:1;min-height:0;"></div>'}
      ${posterMetaFooter(portal, { right: posterShow('figure') ? p.figure : '' })}
    </div>`;
}

/* -------------------------------------------------------------------------- */
/* Registro de modelos (a ordem define a aparição no seletor do editor).       */
/* manchete delega a tplManchete() (definido em posters.js) via wrapper.       */
/* -------------------------------------------------------------------------- */
/* Categorias da biblioteca: dão navegação ao seletor (antes era uma lista
   corrida de 32 itens) e agrupam os modelos por FINALIDADE, não por estilo —
   é assim que o usuário procura ("preciso anunciar uma vaga", não "preciso de
   um layout com painel lateral"). A ordem aqui é a ordem das abas.
   IDs são estáveis (cartazes salvos dependem deles); só os LABELS são nomes
   próprios. A ordem do registro é a ordem dentro de cada aba. */
const POSTER_CATEGORIES = [
  { id: 'todos',         label: 'Todos' },
  { id: 'noticia',       label: 'Notícia' },
  { id: 'foto',          label: 'Foto' },
  { id: 'citacao',       label: 'Citação' },
  { id: 'dados',         label: 'Dados' },
  { id: 'conteudo',      label: 'Conteúdo' },
  { id: 'promo',         label: 'Promoção' },
  { id: 'evento',        label: 'Evento' },
  { id: 'institucional', label: 'Institucional' },
  { id: 'social',        label: 'Social' },
];

const POSTER_TEMPLATES = {
  manchete:              { label: 'Manchete',             cat: 'noticia',       usesImages: true,  render: (p, fmt, portal) => tplManchete(p, fmt, portal) },
  'headline-premium':    { label: 'Manchete premium',     cat: 'noticia',       usesImages: true,  render: tplHeadlinePremium },
  'breaking-alert':      { label: 'Plantão urgente',      cat: 'noticia',       usesImages: true,  render: tplBreakingAlert },
  'destaque-foto':       { label: 'Capa fotográfica',     cat: 'foto',          usesImages: true,  render: tplDestaqueFoto },
  'destaque-foto-2':     { label: 'Foto imersiva',        cat: 'foto',          usesImages: true,  render: tplDestaqueFoto2 },
  'destaque-foto-3':     { label: 'Foto com painel',      cat: 'foto',          usesImages: true,  render: tplDestaqueFoto3 },
  'destaque-foto-4':     { label: 'Foto emoldurada',      cat: 'foto',          usesImages: true,  render: tplDestaqueFoto4 },
  'destaque-foto-5':     { label: 'Foto com faixa',       cat: 'foto',          usesImages: true,  render: tplDestaqueFoto5 },
  'photo-story':         { label: 'Photo story',          cat: 'foto',          usesImages: true,  render: tplPhotoStory },
  'face-to-news':        { label: 'Rosto na notícia',     cat: 'foto',          usesImages: true,  render: tplFaceToNews },
  'quote-impact':        { label: 'Citação com foto',     cat: 'citacao',       usesImages: true,  render: tplQuoteImpact },
  citacao:               { label: 'Citação',              cat: 'citacao',       usesImages: false, render: tplCitacao },
  'numbers-data':        { label: 'Números e dados',      cat: 'dados',         usesImages: false, render: tplNumbersData },
  comparison:            { label: 'Comparação',           cat: 'dados',         usesImages: true,  render: tplComparison },
  'topic-card':          { label: 'Card de tópico',       cat: 'conteudo',      usesImages: true,  render: tplTopicCard },
  topicos:               { label: 'Lista de tópicos',     cat: 'conteudo',      usesImages: false, render: tplTopicos },
  'carousel-cover':      { label: 'Capa de carrossel',    cat: 'social',        usesImages: true,  render: tplCarouselCover },
  'editorial-signature': { label: 'Assinatura editorial', cat: 'noticia',       usesImages: true,  render: tplEditorialSignature },
  minimalista:           { label: 'Minimalista',          cat: 'conteudo',      usesImages: false, render: tplMinimalista },
  texto:                 { label: 'Texto / parágrafo',    cat: 'conteudo',      usesImages: false, render: tplTexto },
  'cor-solida':          { label: 'Cor sólida',           cat: 'conteudo',      usesImages: false, render: tplCorSolida },
  // --- Modelos adicionais (r58) ---
  'mosaic-hero':         { label: 'Mosaico de fotos',     cat: 'foto',          usesImages: true,  render: tplMosaicHero },
  'revista-split':       { label: 'Revista',              cat: 'foto',          usesImages: true,  render: tplRevistaSplit },
  'lower-third':         { label: 'Faixa inferior',       cat: 'foto',          usesImages: true,  render: tplLowerThird },
  'diagonal-split':      { label: 'Corte diagonal',       cat: 'foto',          usesImages: true,  render: tplDiagonalSplit },
  'perfil-card':         { label: 'Perfil',               cat: 'institucional', usesImages: true,  render: tplPerfilCard },
  timeline:              { label: 'Linha do tempo',       cat: 'dados',         usesImages: false, render: tplTimeline },
  // --- Modelos adicionais (r58b) ---
  evento:                { label: 'Evento / agenda',      cat: 'evento',        usesImages: false, render: tplEvento },
  informe:               { label: 'Informe / serviço',    cat: 'institucional', usesImages: false, render: tplInforme },
  fato:                  { label: 'Você sabia?',          cat: 'conteudo',      usesImages: false, render: tplFato },
  'dado-foto':           { label: 'Dado sobre foto',      cat: 'dados',         usesImages: true,  render: tplDadoFoto },
  kpis:                  { label: 'Indicadores',          cat: 'dados',         usesImages: false, render: tplKpis },

  // --- Ampliação da biblioteca (r166): os usos que faltavam ---
  'oferta-preco':        { label: 'Oferta com preço',     cat: 'promo',         usesImages: true,  render: tplOfertaPreco },
  'promo-split':         { label: 'Promoção dividida',    cat: 'promo',         usesImages: true,  render: tplPromoSplit },
  lancamento:            { label: 'Lançamento',           cat: 'promo',         usesImages: true,  render: tplLancamento },
  vaga:                  { label: 'Vaga de emprego',      cat: 'institucional', usesImages: false, render: tplVaga },
  comunicado:            { label: 'Comunicado oficial',   cat: 'institucional', usesImages: false, render: tplComunicado },
  frase:                 { label: 'Frase de impacto',     cat: 'social',        usesImages: false, render: tplFrase },
  'antes-depois':        { label: 'Antes e depois',       cat: 'social',        usesImages: true,  render: tplAntesDepois },
  'passo-a-passo':       { label: 'Passo a passo',        cat: 'social',        usesImages: false, render: tplPassoAPasso },
  enquete:               { label: 'Enquete',              cat: 'social',        usesImages: false, render: tplEnquete },
  'capa-revista':        { label: 'Capa de revista',      cat: 'foto',          usesImages: true,  render: tplCapaRevista },
  tipografico:           { label: 'Tipográfico',          cat: 'conteudo',      usesImages: false, render: tplTipografico },
  'blocos-cor':          { label: 'Blocos de cor',        cat: 'conteudo',      usesImages: true,  render: tplBlocosCor },
  // --- Ampliação da biblioteca (r166): categorias antes rasas ---
  'evento-foto':         { label: 'Evento com foto',      cat: 'evento',        usesImages: true,  render: tplEventoFoto },
  contagem:              { label: 'Contagem regressiva',  cat: 'evento',        usesImages: false, render: tplContagem },
  programacao:           { label: 'Programação',          cat: 'evento',        usesImages: false, render: tplProgramacao },
  convite:               { label: 'Convite',              cat: 'evento',        usesImages: false, render: tplConvite },
  depoimento:            { label: 'Depoimento',           cat: 'citacao',       usesImages: true,  render: tplDepoimento },
  'citacao-lateral':     { label: 'Citação lateral',      cat: 'citacao',       usesImages: true,  render: tplCitacaoLateral },
  cupom:                 { label: 'Cupom de desconto',    cat: 'promo',         usesImages: false, render: tplCupom },
  catalogo:              { label: 'Catálogo',             cat: 'promo',         usesImages: true,  render: tplCatalogo },
  ranking:               { label: 'Ranking',              cat: 'dados',         usesImages: false, render: tplRanking },
  barras:                { label: 'Gráfico de barras',    cat: 'dados',         usesImages: false, render: tplBarras },
  'manchete-tarja':      { label: 'Manchete com tarja',   cat: 'noticia',       usesImages: true,  render: tplMancheteTarja },
  'resumo-dia':          { label: 'Resumo do dia',        cat: 'noticia',       usesImages: false, render: tplResumoDia },
  expediente:            { label: 'Expediente',           cat: 'institucional', usesImages: false, render: tplExpediente },
  homenagem:             { label: 'Homenagem',            cat: 'institucional', usesImages: true,  render: tplHomenagem },
  polaroid:              { label: 'Polaroid',             cat: 'foto',          usesImages: true,  render: tplPolaroid },
  'duas-colunas':        { label: 'Duas colunas',         cat: 'conteudo',      usesImages: false, render: tplDuasColunas },
};
