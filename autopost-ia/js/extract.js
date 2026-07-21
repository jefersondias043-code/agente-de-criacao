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

// ---------- imagem → texto (OCR) ----------
// Reduz a imagem a no máx. 3000 px no maior lado (só se maior) antes do OCR.
async function _prepararImagem(file) {
  const MAX = 3000;
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((res, rej) => {
      const im = new Image();
      im.onload = () => res(im);
      im.onerror = () => rej(new Error('decode'));
      im.src = url;
    });
    const maxDim = Math.max(img.naturalWidth || 0, img.naturalHeight || 0);
    if (!maxDim) throw new Error('decode');
    if (maxDim <= MAX) return file; // já é pequena o bastante
    const escala = MAX / maxDim;
    const w = Math.round(img.naturalWidth * escala);
    const h = Math.round(img.naturalHeight * escala);
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    return await new Promise(res => { canvas.toBlob(b => res(b || file), 'image/png'); });
  } catch (e) {
    throw new Error('Não foi possível abrir esta imagem neste aparelho. No iPhone, escolha a foto pela galeria (que a converte automaticamente) ou use um arquivo PNG/JPG.');
  } finally {
    URL.revokeObjectURL(url);
  }
}

async function extrairImagem(file, onProgress) {
  await carregarLib('tesseract');
  if (onProgress) onProgress('Reconhecendo o texto da imagem… 0%');
  const fonte = await _prepararImagem(file);
  const { data } = await Tesseract.recognize(fonte, 'por', {
    logger: (m) => {
      if (m.status === 'recognizing text' && onProgress) {
        onProgress('Reconhecendo o texto da imagem… ' + Math.round((m.progress || 0) * 100) + '%');
      } else if (m.status && onProgress && /load|initiali|download/i.test(m.status)) {
        onProgress('Preparando o reconhecimento de texto…');
      }
    }
  });
  return (data && data.text || '').trim();
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
