'use strict';
/* ============================================================
   EXTRACT — texto a partir de IMAGEM (OCR), PDF e DOCX.

   No app INDEPENDENTE não há plataforma-mãe pra fazer o OCR/extração
   (a versão embutida delega ao app pai via postMessage). Então este
   módulo traz a capacidade pro próprio app: as bibliotecas pesadas
   (Tesseract/pdf.js/mammoth) são carregadas SOB DEMANDA, do mesmo CDN
   e com o MESMO integrity (SRI) da plataforma — nada é baixado até o
   usuário anexar uma imagem/PDF/DOCX, mantendo o app leve pro caso
   comum (áudio/texto).

   MOBILE (iPhone): fotos são reduzidas a no máx. 3000 px antes do OCR
   (evita estouro de memória com imagens de 12 MP) e HEIC não decodável
   dá erro claro (o próprio seletor do iOS costuma converter pra JPEG).
   ============================================================ */

// Bibliotecas de CDN (URL + SRI idênticos aos da plataforma index.html).
const CDN_LIBS = {
  tesseract: {
    url: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.0.4/dist/tesseract.min.js',
    integrity: 'sha384-Ptw8HCYAWF6vIop6WuGxfSCiDCIzUWqjrHYfx8Vd0S4CMBaicAdBh2y+Ufle664A',
    pronto: () => typeof Tesseract !== 'undefined'
  },
  pdfjs: {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js',
    integrity: 'sha384-/1qUCSGwTur9vjf/z9lmu/eCUYbpOTgSjmpbMQZ1/CtX2v/WcAIKqRv+U1DUCG6e',
    pronto: () => typeof pdfjsLib !== 'undefined',
    // O worker (mesma versão) evita o modo "fake worker" na thread principal.
    apos: () => { try { pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; } catch (_) {} }
  },
  mammoth: {
    url: 'https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.6.0/mammoth.browser.min.js',
    integrity: 'sha384-nFoSjZIoH3CCp8W639jJyQkuPHinJ2NHe7on1xvlUA7SuGfJAfvMldrsoAVm6ECz',
    pronto: () => typeof mammoth !== 'undefined'
  }
};

const _libsCarregando = {};

// Carrega uma lib de CDN uma única vez (cacheia a Promise). Reaproveita se já
// estiver presente (ex.: a plataforma pode tê-la carregado antes, no embutido).
function carregarLib(nome) {
  const def = CDN_LIBS[nome];
  if (def.pronto()) { if (def.apos) def.apos(); return Promise.resolve(); }
  if (_libsCarregando[nome]) return _libsCarregando[nome];
  _libsCarregando[nome] = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = def.url;
    s.integrity = def.integrity;
    s.crossOrigin = 'anonymous';
    s.referrerPolicy = 'no-referrer';
    s.onload = () => {
      try { if (def.apos) def.apos(); } catch (_) {}
      if (def.pronto()) resolve();
      else { delete _libsCarregando[nome]; reject(new Error('O recurso necessário não carregou. Recarregue a página e tente de novo.')); }
    };
    s.onerror = () => { delete _libsCarregando[nome]; s.remove(); reject(new Error('Não foi possível baixar o recurso de extração. Verifique sua conexão com a internet e tente de novo.')); };
    document.head.appendChild(s);
  });
  return _libsCarregando[nome];
}

// ---------- classificação de tipo ----------
function ehArquivoImagem(f) {
  if (!f) return false;
  if (/^image\//i.test(f.type || '')) return true;
  return /\.(png|jpe?g|bmp|gif|webp|tiff?|heic|heif)$/i.test(f.name || '');
}
function ehArquivoPdf(f) {
  if (!f) return false;
  return (f.type || '') === 'application/pdf' || /\.pdf$/i.test(f.name || '');
}
function ehArquivoDocx(f) {
  if (!f) return false;
  return /wordprocessingml/i.test(f.type || '') || /\.docx$/i.test(f.name || '');
}
// Arquivo cujo TEXTO extraímos aqui (imagem/PDF/DOCX). Texto puro (.txt) segue
// o caminho de leitura direta do audio.js; áudio/vídeo, o de transcrição.
function arquivoEhExtraivel(f) {
  return ehArquivoImagem(f) || ehArquivoPdf(f) || ehArquivoDocx(f);
}

// Rótulo + ícone amigáveis por tipo (usados no chip de anexo e nas mensagens).
function tipoArquivoInfo(f) {
  if (typeof ehArquivoDeTexto === 'function' && ehArquivoDeTexto(f)) return { rotulo: 'texto', icone: '📄' };
  if (ehArquivoImagem(f)) return { rotulo: 'imagem', icone: '🖼️' };
  if (ehArquivoPdf(f)) return { rotulo: 'PDF', icone: '📄' };
  if (ehArquivoDocx(f)) return { rotulo: 'documento', icone: '📝' };
  if (/^audio\//i.test(f.type || '')) return { rotulo: 'áudio', icone: '🎵' };
  if (/^video\//i.test(f.type || '')) return { rotulo: 'vídeo', icone: '🎬' };
  return { rotulo: f.type || 'arquivo', icone: '📎' };
}

// Limites generosos por tipo (evita travar o navegador; uso legítimo passa folgado).
const EXTRACT_MAX_BYTES = { image: 25 * 1024 * 1024, pdf: 80 * 1024 * 1024, docx: 25 * 1024 * 1024 };

// ---------- imagem → texto (OCR com pré-processamento) ----------
// Maior lado do canvas de trabalho. Reduzir a imagem economiza memória no
// celular; 2600 px preserva nitidez de texto de sobra para o OCR.
const OCR_MAX_DIM = 2600;

// Desenha a imagem num canvas, reduzida a no máx. maxDim no maior lado (só se maior).
function _canvasEscalado(img, maxDim) {
  const w0 = img.naturalWidth || img.width, h0 = img.naturalHeight || img.height;
  const maxLado = Math.max(w0, h0) || 1;
  const escala = maxLado > maxDim ? maxDim / maxLado : 1;
  const w = Math.max(1, Math.round(w0 * escala));
  const h = Math.max(1, Math.round(h0 * escala));
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  c.getContext('2d', { willReadFrequently: true }).drawImage(img, 0, 0, w, h);
  return c;
}

// Pré-processa para OCR e devolve um NOVO canvas binário (preto/branco):
//   1) escala de cinza (luminância);
//   2) realce de contraste (alonga entre os percentis 2% e 98% — robusto a outliers);
//   3) LIMIAR ADAPTATIVO (Bradley, média local via imagem integral) — cada pixel
//      é comparado à média da vizinhança, então iluminação irregular e fundo
//      complexo (o ponto fraco do limiar global do Tesseract) deixam de atrapalhar.
function _preprocessarParaOCR(base) {
  const w = base.width, h = base.height, n = w * h;
  const d = base.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, w, h).data;

  // 1) cinza + histograma
  const g = new Float32Array(n);
  const hist = new Uint32Array(256);
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const y = (d[p] * 0.299 + d[p + 1] * 0.587 + d[p + 2] * 0.114) | 0;
    g[i] = y; hist[y]++;
  }

  // 2) contraste por percentis 2%/98%
  let lo = 0, hi = 255, acc = 0; const clip = n * 0.02;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= clip) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= clip) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < n; i++) {
    let v = (g[i] - lo) * 255 / range;
    g[i] = v < 0 ? 0 : (v > 255 ? 255 : v);
  }

  // 3) limiar adaptativo (imagem integral → média local em O(1) por pixel)
  const W1 = w + 1;
  const integ = new Float64Array(W1 * (h + 1));
  for (let y = 0; y < h; y++) {
    let soma = 0;
    for (let x = 0; x < w; x++) {
      soma += g[y * w + x];
      integ[(y + 1) * W1 + (x + 1)] = integ[y * W1 + (x + 1)] + soma;
    }
  }
  const S = Math.max(8, (Math.min(w, h) / 16) | 0); // meia-janela ∝ tamanho
  const T = 0.15;                                     // margem sob a média local
  const oc = document.createElement('canvas');
  oc.width = w; oc.height = h;
  const octx = oc.getContext('2d');
  const outImg = octx.createImageData(w, h);
  const od = outImg.data;
  for (let y = 0; y < h; y++) {
    const y1 = y - S < 0 ? 0 : y - S, y2 = y + S >= h ? h - 1 : y + S;
    for (let x = 0; x < w; x++) {
      const x1 = x - S < 0 ? 0 : x - S, x2 = x + S >= w ? w - 1 : x + S;
      const conta = (x2 - x1 + 1) * (y2 - y1 + 1);
      const soma = integ[(y2 + 1) * W1 + (x2 + 1)] - integ[y1 * W1 + (x2 + 1)] - integ[(y2 + 1) * W1 + x1] + integ[y1 * W1 + x1];
      // texto (escuro) quando o pixel fica abaixo da média local * (1 - T)
      const preto = g[y * w + x] * conta <= soma * (1 - T);
      const p = (y * w + x) * 4;
      const val = preto ? 0 : 255;
      od[p] = od[p + 1] = od[p + 2] = val; od[p + 3] = 255;
    }
  }
  octx.putImageData(outImg, 0, 0);
  return oc;
}

// OCR de UM canvas; devolve { text, conf } (conf = confiança média do Tesseract).
async function _ocrCanvas(canvas, onProgress) {
  const { data } = await Tesseract.recognize(canvas, 'por', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress('Reconhecendo o texto da imagem… ' + Math.round((m.progress || 0) * 100) + '%');
      } else if (m.status && onProgress && /load|initiali|download/i.test(m.status)) {
        onProgress('Preparando o reconhecimento de texto…');
      }
    }
  });
  return { text: (data && data.text || '').trim(), conf: (data && data.confidence) || 0 };
}

// Resultado fraco? (pouco texto ou baixa confiança → vale tentar o outro caminho)
function _ocrFraco(r) {
  return !r.text || r.text.replace(/\s+/g, '').length < 12 || r.conf < 55;
}
// Escolhe o melhor entre dois resultados: mais texto reconhecido; empate → maior confiança.
function _melhorOcr(a, b) {
  const la = a.text.replace(/\s+/g, '').length, lb = b.text.replace(/\s+/g, '').length;
  if (Math.abs(la - lb) > 8) return la >= lb ? a : b;
  return a.conf >= b.conf ? a : b;
}

async function extrairImagem(file, onProgress) {
  await carregarLib('tesseract');
  if (onProgress) onProgress('Preparando a imagem…');

  let img, url;
  try {
    url = URL.createObjectURL(file);
    img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('decode'));
      im.src = url;
    });
    if (!(img.naturalWidth || img.width)) throw new Error('decode');
  } catch (e) {
    if (url) URL.revokeObjectURL(url);
    throw new Error('Não foi possível abrir esta imagem neste aparelho. No iPhone, escolha a foto pela galeria (que a converte automaticamente) ou use um arquivo PNG/JPG.');
  }

  try {
    const base = _canvasEscalado(img, OCR_MAX_DIM);        // colorido (fallback)
    await new Promise(r => setTimeout(r, 0));               // deixa a UI pintar o status
    const proc = _preprocessarParaOCR(base);               // cinza + contraste + limiar

    // 1ª tentativa: imagem tratada (melhor em fundo complexo/iluminação irregular).
    const r1 = await _ocrCanvas(proc, onProgress);
    let melhor = r1;

    // Fallback: se o tratamento não ajudou (raro, ex.: texto claro sobre escuro),
    // tenta a imagem original e fica com o melhor dos dois — nunca piora.
    if (_ocrFraco(r1)) {
      if (onProgress) onProgress('Refinando o reconhecimento…');
      const r2 = await _ocrCanvas(base, onProgress);
      melhor = _melhorOcr(r1, r2);
    }
    return (melhor.text || '').trim();
  } finally {
    if (url) URL.revokeObjectURL(url);
  }
}

// ---------- PDF → texto ----------
async function extrairPdf(file, onProgress) {
  await carregarLib('pdfjs');
  if (onProgress) onProgress('Extraindo o texto do PDF…');
  const ab = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: ab }).promise;
  const paginas = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    if (onProgress) onProgress('Extraindo o texto do PDF… página ' + i + '/' + pdf.numPages);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    paginas.push(content.items.map(it => it.str).join(' '));
  }
  return paginas.join('\n\n').trim();
}

// ---------- DOCX → texto ----------
async function extrairDocx(file, onProgress) {
  await carregarLib('mammoth');
  if (onProgress) onProgress('Extraindo o texto do documento…');
  const ab = await file.arrayBuffer();
  const r = await mammoth.extractRawText({ arrayBuffer: ab });
  return (r && r.value || '').trim();
}

// ---------- roteador ----------
async function extrairTextoArquivo(file, onProgress) {
  let cap = null;
  if (ehArquivoImagem(file)) cap = EXTRACT_MAX_BYTES.image;
  else if (ehArquivoPdf(file)) cap = EXTRACT_MAX_BYTES.pdf;
  else if (ehArquivoDocx(file)) cap = EXTRACT_MAX_BYTES.docx;
  if (cap && file.size > cap) {
    throw new Error('Arquivo muito grande para extrair o texto aqui. Tente um arquivo menor.');
  }
  if (ehArquivoImagem(file)) return extrairImagem(file, onProgress);
  if (ehArquivoPdf(file)) return extrairPdf(file, onProgress);
  if (ehArquivoDocx(file)) return extrairDocx(file, onProgress);
  throw new Error('Formato não suportado para extração de texto.');
}
