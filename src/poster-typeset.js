'use strict';
/* ============================================================
   COMPOSIÇÃO TIPOGRÁFICA DOS CARTAZES (r165)

   O PROBLEMA
   Os modelos escolhiam o tamanho da fonte por CONTAGEM DE CARACTERES
   (`posterPickSize`, tabelas de faixas) e escondiam o excesso com
   `-webkit-line-clamp`. Isso falha de três formas visíveis:
     1. Contar caractere não é medir largura. "MMM" e "iii" têm o mesmo
        comprimento e larguras muito diferentes — títulos com palavras longas
        estouravam onde outros do mesmo tamanho cabiam.
     2. A tabela é uma escada: 42 caracteres → 86px, 43 → 70px. Um caractere a
        mais derrubava a fonte 16px de uma vez.
     3. A MESMA tabela valia para 1080×1440, 1080×1080 e 1080×1920, que têm
        áreas de título completamente diferentes.
   E quando não cabia, o `line-clamp` simplesmente CORTAVA o texto.

   A SOLUÇÃO
   Medir de verdade, no próprio navegador, depois que o modelo já está montado:
   o preview é DOM real em escala 1:1 do cartaz (1080px), então `scrollHeight`
   e `clientWidth` dão a medida exata para qualquer fonte, tema ou modelo — sem
   precisar ensinar nada a cada um dos 20 modelos.

   Duas etapas por campo:
     · AJUSTE — busca binária pelo maior corpo de fonte em que o texto cabe
       inteiro (sem corte pelo clamp e sem estourar o cartaz).
     · EQUILÍBRIO — com o tamanho definido, redistribui as palavras entre as
       linhas para que fiquem parecidas em largura, evitando a última linha
       órfã com uma palavra solta (o "pouco harmonioso" clássico). As quebras
       viram <br> de verdade, então o PNG exportado sai idêntico ao preview
       (o html2canvas não entende `text-wrap: balance`).

   UM CONTROLE SÓ
   `fitHeadline` / `fitSubtitle` (0–100) regulam a PRESENÇA do texto dentro da
   área que ele tem. O teto é sempre o tamanho que cabe — mexer no controle
   nunca faz o texto estourar; só decide o quanto ele ocupa do espaço.
   ============================================================ */

/** Presença padrão quando o cartaz ainda não tem preferência salva.
 *  Perto do teto (fica com presença), mas deixando um respiro. */
const TS_DEFAULT_FIT = 72;
/** Fração do tamanho máximo em que o controle no ZERO deixa o texto. */
const TS_MIN_RATIO = 0.6;

/** Presença (0–100) → fração do tamanho que cabe.
 *  `isFinite` e não `typeof number`: um NaN salvo (dado corrompido, migração
 *  malfeita) passaria pelo typeof e viraria `font-size: NaNpx` — o texto
 *  simplesmente sumiria do cartaz. Qualquer valor inválido cai no padrão. */
function tsPresence(fit) {
  const n = (typeof fit === 'number' && isFinite(fit)) ? fit : TS_DEFAULT_FIT;
  const v = Math.max(0, Math.min(100, n));
  return TS_MIN_RATIO + (1 - TS_MIN_RATIO) * (v / 100);
}

/** Texto de um nó, com as quebras que nós mesmos inserimos desfeitas. */
function tsPlainText(node) {
  return (node.textContent || '').replace(/\s+/g, ' ').trim();
}

/** Acha, dentro do cartaz, o nó que RENDERIZA exatamente este texto.
 *  Procura o mais profundo (o <h1> em si, não o contêiner que o embrulha) —
 *  assim funciona nos 20 modelos sem marcação especial em cada um.
 *  `[data-fit]` continua valendo como indicação explícita, se um modelo novo
 *  quiser apontar o nó diretamente. */
function tsFindNode(root, text, kind) {
  if (!root || !text) return null;
  const marcado = root.querySelector('[data-fit="' + kind + '"]');
  if (marcado) return marcado;
  const alvo = String(text).replace(/\s+/g, ' ').trim();
  if (!alvo) return null;
  let melhor = null;
  root.querySelectorAll('h1, h2, h3, p, blockquote, span, div').forEach((el) => {
    if (tsPlainText(el) !== alvo) return;
    // o mais profundo vence (o nó que de fato desenha o texto)
    if (!melhor || melhor.contains(el)) melhor = el;
  });
  return melhor;
}

/** Altura de uma linha do nó, em px. */
function tsLineHeight(node) {
  const cs = getComputedStyle(node);
  const lh = parseFloat(cs.lineHeight);
  if (isFinite(lh) && lh > 0) return lh;
  const fs = parseFloat(cs.fontSize) || 16;
  return fs * 1.2;
}

/** Quantas linhas o clamp do modelo permite (0 = sem limite). */
function tsMaxLines(node) {
  const cs = getComputedStyle(node);
  const n = parseInt(cs.webkitLineClamp || cs.lineClamp, 10);
  return isFinite(n) && n > 0 ? n : 0;
}

/** Conta as LINHAS realmente desenhadas. Medir por scrollHeight não serve aqui:
 *  com `-webkit-line-clamp` dentro de contêiner flex, o clientHeight é a altura
 *  que o flex distribuiu, não a do texto — a conta dava sempre "não cabe".
 *  Cada retângulo devolvido por um Range sobre o texto é uma linha de verdade,
 *  independentemente de clamp, flex ou tema. */
function tsCountLines(node) {
  try {
    const r = document.createRange();
    r.selectNodeContents(node);
    const rects = Array.from(r.getClientRects()).filter((x) => x.width > 0.5 && x.height > 0.5);
    if (!rects.length) return node.textContent.trim() ? 1 : 0;
    // agrupa por topo (tolerância de meia linha) — spans na mesma linha contam 1
    const tops = [];
    rects.forEach((x) => {
      if (!tops.some((t) => Math.abs(t - x.top) < Math.max(4, x.height * 0.5))) tops.push(x.top);
    });
    return tops.length;
  } catch (_) {
    const lh = tsLineHeight(node);
    return Math.max(1, Math.round(node.scrollHeight / lh));
  }
}

/** Quanto o cartaz transborda hoje (px). Alguns modelos já nascem com um
 *  transbordo mínimo por conta de elementos decorativos, então o critério é
 *  NÃO PIORAR o que já existia — e não "transbordo zero", que reprovaria tudo. */
function tsRootOverflow(root) {
  if (!root) return 0;
  return Math.max(0, root.scrollHeight - root.clientHeight) + Math.max(0, root.scrollWidth - root.clientWidth);
}

/** O texto cabe? Cabe quando não passa do número de linhas que o modelo
 *  reservou (o `-webkit-line-clamp` É o contrato de espaço do desenho), nenhuma
 *  palavra estoura a largura, e o cartaz não transborda mais do que já
 *  transbordava antes do ajuste. */
function tsFits(node, root, maxLinhas, transbordoBase) {
  if (node.scrollWidth > node.clientWidth + 1) return false;      // palavra maior que a caixa
  if (maxLinhas > 0 && tsCountLines(node) > maxLinhas) return false;
  if (root && tsRootOverflow(root) > (transbordoBase || 0) + 1) return false;
  return true;
}

/** Mede a largura de um trecho com a fonte EXATA do nó (canvas, sem reflow). */
let _tsCanvas = null;
function tsMeasurer(node) {
  if (!_tsCanvas) _tsCanvas = document.createElement('canvas');
  const ctx = _tsCanvas.getContext('2d');
  const cs = getComputedStyle(node);
  ctx.font = [cs.fontStyle, cs.fontVariant, cs.fontWeight, cs.fontSize + '/' + cs.lineHeight, cs.fontFamily].join(' ');
  const espacamento = parseFloat(cs.letterSpacing) || 0;
  const maiuscula = cs.textTransform === 'uppercase';
  return (s) => {
    const t = maiuscula ? s.toUpperCase() : s;
    return ctx.measureText(t).width + espacamento * t.length;
  };
}

/** Distribui as palavras em `n` linhas deixando-as o mais parecidas possível
 *  em largura. Programação dinâmica minimizando a soma dos quadrados da sobra
 *  de cada linha — é o mesmo critério do "balanced ragged" clássico e evita
 *  tanto a linha órfã quanto a linha muito mais curta no meio.
 *  Devolve null se alguma linha não couber na largura disponível. */
function tsBalance(palavras, n, medir, largura) {
  const N = palavras.length;
  if (n <= 1 || N <= 1 || n >= N) return null;
  // largura acumulada: w[i][j] = largura da linha com palavras i..j-1
  const espaco = medir(' ');
  const larg = [];
  for (let i = 0; i < N; i++) {
    larg[i] = [];
    let soma = 0;
    for (let j = i; j < N; j++) {
      soma += medir(palavras[j]) + (j > i ? espaco : 0);
      larg[i][j] = soma;
    }
  }
  const INF = Infinity;
  // custo[k][i] = melhor custo para distribuir palavras i.. em k linhas
  const custo = [];
  const corte = [];
  for (let k = 0; k <= n; k++) { custo[k] = new Array(N + 1).fill(INF); corte[k] = new Array(N + 1).fill(-1); }
  custo[0][N] = 0;
  for (let k = 1; k <= n; k++) {
    for (let i = N - 1; i >= 0; i--) {
      for (let j = i; j < N; j++) {
        const w = larg[i][j];
        if (w > largura) break;                       // linha não cabe: para de crescer
        const resto = custo[k - 1][j + 1];
        if (resto === INF) continue;
        const sobra = largura - w;
        const c = resto + sobra * sobra;
        if (c < custo[k][i]) { custo[k][i] = c; corte[k][i] = j + 1; }
      }
    }
  }
  if (custo[n][0] === INF) return null;
  const linhas = [];
  let i = 0;
  for (let k = n; k >= 1; k--) {
    const j = corte[k][i];
    if (j < 0) return null;
    linhas.push(palavras.slice(i, j).join(' '));
    i = j;
  }
  return i === N ? linhas : null;
}

/** Aplica quebras equilibradas ao nó (as quebras viram <br>, para o PNG
 *  exportado sair igual ao preview). */
function tsApplyBalance(node, root, maxLinhas, transbordoBase) {
  const texto = tsPlainText(node);
  const palavras = texto.split(' ').filter(Boolean);
  if (palavras.length < 3) return;                     // nada a equilibrar
  const linhasAtuais = tsCountLines(node);
  if (linhasAtuais < 2 || linhasAtuais >= palavras.length) return;
  const medir = tsMeasurer(node);
  const largura = node.clientWidth;
  if (!largura) return;
  const linhas = tsBalance(palavras, linhasAtuais, medir, largura);
  if (!linhas || linhas.length !== linhasAtuais) return;
  const antes = node.innerHTML;
  // Espaço ANTES do <br>: sem ele o textContent junta as palavras da virada
  //  ("a<br>b" vira "ab") — o nó deixava de ser reconhecível no próximo passe e
  //  leitores de tela liam palavras grudadas. O espaço em fim de linha é
  //  colapsado na renderização, então não muda nada visualmente.
  node.innerHTML = linhas.map((l) => escapeHtml(l)).join(' <br>');
  // Segurança: se equilibrar fez o texto passar a não caber (medida do canvas
  // divergindo do layout real, ligaduras, hifenização), desfaz.
  if (!tsFits(node, root, maxLinhas, transbordoBase)) node.innerHTML = antes;
}

/* Quantas linhas cada campo suporta ANTES de deixar de funcionar como tal.
   O `-webkit-line-clamp` do modelo é um limite de segurança (chega a 6-7), não
   um alvo estético: uma manchete em 6 linhas para de ler como manchete. Sem
   este teto, "maximizar o corpo" empurrava títulos curtos para 5 linhas
   enormes — tecnicamente dentro do clamp, visualmente errado. */
const TS_LINHAS_MAX = { headline: 3, subtitle: 4 };

/** Ajusta UM campo: acha o maior corpo que cabe, aplica a presença escolhida
 *  e equilibra as quebras. Devolve o tamanho aplicado (px) ou null. */
function tsTypesetNode(node, root, fit, kind) {
  if (!node) return null;
  const cs = getComputedStyle(node);
  const base = parseFloat(cs.fontSize);
  if (!isFinite(base) || base <= 0) return null;

  // Desfaz quebras de um ajuste anterior antes de medir de novo.
  const texto = tsPlainText(node);
  if (node.querySelector('br')) node.textContent = texto;

  const clamp = tsMaxLines(node);
  const transbordoBase = tsRootOverflow(root);
  // Alvo de linhas: o menor entre o limite de segurança do modelo e o que o
  // campo comporta esteticamente.
  const tetoLinhas = TS_LINHAS_MAX[kind] || 3;
  const maxLinhas = clamp > 0 ? Math.min(clamp, tetoLinhas) : tetoLinhas;
  // Crescimento MODESTO: o tamanho do modelo é a intenção de desenho: só
  // ganha um pouco de presença quando o texto é curto. Encolher, sim, pode ir
  // fundo — é o que impede o corte.
  const teto = Math.round(base * 1.35);
  const piso = Math.max(12, Math.round(base * 0.42));

  const cabeCom = (px, limite) => {
    node.style.fontSize = px + 'px';
    return tsFits(node, root, limite, transbordoBase);
  };
  const buscar = (limite) => {
    if (!cabeCom(piso, limite)) return null;
    let lo = piso, hi = teto, achado = piso;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (cabeCom(mid, limite)) { achado = mid; lo = mid + 1; } else { hi = mid - 1; }
    }
    return achado;
  };

  // Busca com o alvo estético; se nem no piso couber (texto muito longo para a
  // área), relaxa até o limite do modelo — texto miúdo é melhor que texto
  // cortado, e o clamp continua de rede.
  let melhor = buscar(maxLinhas);
  if (melhor === null && clamp > maxLinhas) melhor = buscar(clamp);
  if (melhor === null) {
    // Última hipótese: UMA PALAVRA que não cabe na largura nem no corpo mínimo
    // (nomes técnicos, "anticonstitucionalissimamente", URLs). Encolher mais
    // só deixaria ilegível — a saída correta é deixar a palavra quebrar, em
    // vez de vazar para fora do cartaz.
    node.style.overflowWrap = 'anywhere';
    node.style.wordBreak = 'break-word';
    node.style.hyphens = 'auto';
    melhor = buscar(clamp > 0 ? clamp : maxLinhas);
    if (melhor === null) melhor = piso;
  }

  const alvo = Math.max(piso, Math.round(melhor * tsPresence(fit)));
  node.style.fontSize = alvo + 'px';
  // Encolher normalmente só ajuda, mas o rearranjo de linhas pode surpreender;
  // se não couber, volta ao tamanho comprovado.
  if (!tsFits(node, root, maxLinhas, transbordoBase) && melhor !== alvo) node.style.fontSize = melhor + 'px';

  if (maxLinhas !== 1) tsApplyBalance(node, root, maxLinhas, transbordoBase);
  return parseFloat(node.style.fontSize);
}

/** Passe de composição do cartaz inteiro. Chamado logo após o modelo ser
 *  montado no palco, antes de escalar o preview. */
function typesetPoster(p, stageEl) {
  const stage = stageEl || (typeof $ === 'function' ? $('#p-stage') : null);
  const root = stage && stage.querySelector('.poster-1440');
  if (!root || !p) return;
  const alvos = [
    { kind: 'headline', texto: p.headline, fit: p.fitHeadline },
    { kind: 'subtitle', texto: p.subtitle, fit: p.fitSubtitle },
  ];
  alvos.forEach(({ kind, texto, fit }) => {
    if (!texto) return;
    const node = tsFindNode(root, texto, kind);
    if (node) tsTypesetNode(node, root, fit, kind);
  });
}

/* As fontes de display chegam depois da primeira pintura (webfont). Medir antes
   delas assentarem dá um resultado e, depois, outro — então recompomos uma vez
   quando terminarem de carregar. */
if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
  document.fonts.ready.then(() => {
    if (typeof _refreshPosterPreview === 'function') _refreshPosterPreview();
  }).catch(() => { /* */ });
}
