'use strict';
/* ============================================================
   ENTRADA UNIVERSAL — qualquer formato vira TEXTO
   Capacidade compartilhada por toda a plataforma. Roteia o arquivo para o
   conversor certo (todos já existentes no ecossistema):
     texto/TXT → leitura direta
     PDF       → extractPdf (pdf.js)
     DOCX      → extractDocx (mammoth)
     imagem    → extractImage (OCR Tesseract)
     áudio/vídeo → transcribeMedia (Groq Whisper, mesma API do AutoPost)
   Ferramentas embutidas (Detector) enviam o ARQUIVO ao app pai via postMessage
   (funciona em file://), que converte e devolve o texto.
   ============================================================ */

// Formatos aceitos por qualquer campo de entrada de conteúdo da plataforma.
const INGEST_ACCEPT = '.txt,.pdf,.docx,.png,.jpg,.jpeg,.bmp,.gif,.webp,.tiff,.tif,' +
  '.mp3,.wav,.m4a,.ogg,.flac,.aac,.mp4,.mpeg,.mpga,.webm,.mov,.3gp,' +
  'text/plain,application/pdf,image/*,audio/*,video/*';

const WHISPER_ENDPOINT = 'https://api.groq.com/openai/v1/audio/transcriptions';
const WHISPER_MODEL = 'whisper-large-v3';
const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // limite do free tier da Groq

/** Classifica o arquivo por extensão/MIME. */
function ingestKind(file) {
  const name = (file.name || '').toLowerCase();
  const mime = (file.type || '').toLowerCase();
  if (mime === 'text/plain' || name.endsWith('.txt')) return 'text';
  if (mime === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (mime.includes('wordprocessingml') || name.endsWith('.docx')) return 'docx';
  if (mime.startsWith('image/') || /\.(png|jpe?g|bmp|gif|webp|tiff?)$/.test(name)) return 'image';
  if (mime.startsWith('audio/') || mime.startsWith('video/') ||
      /\.(mp3|wav|m4a|ogg|flac|aac|mp4|mpe?g|mpga|webm|mov|3gp)$/.test(name)) return 'media';
  return 'other';
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result || '').trim());
    r.onerror = () => reject(new Error('Não foi possível ler o arquivo de texto.'));
    r.readAsText(file);
  });
}

/** Transcreve áudio/vídeo via Groq Whisper (mesma API do AutoPost), usando a
 *  chave Groq unificada da plataforma. */
async function transcribeMedia(file, onProgress) {
  const apiKey = (State.apiKeys && State.apiKeys.groq) ? String(State.apiKeys.groq).trim() : '';
  if (!apiKey) throw new Error('Configure a chave de API da Groq nas Configurações para transcrever áudio e vídeo.');
  if (file.size > WHISPER_MAX_BYTES) {
    throw new Error('Arquivo muito grande para transcrever aqui (máximo 25 MB). Use o AutoPost IA, que divide arquivos grandes.');
  }
  if (onProgress) onProgress('Transcrevendo a mídia…');
  const form = new FormData();
  form.append('file', file, file.name || 'media');
  form.append('model', WHISPER_MODEL);
  form.append('language', 'pt');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  let res;
  try {
    res = await fetch(WHISPER_ENDPOINT, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: form });
  } catch (e) {
    throw new Error('Falha de conexão ao enviar a mídia. Verifique sua internet.');
  }
  if (res.status === 401) throw new Error('A chave de API da Groq é inválida ou expirou.');
  if (res.status === 413) throw new Error('O arquivo ficou grande demais para transcrever.');
  if (res.status === 429) throw new Error('Limite de requisições da Groq excedido. Tente novamente em alguns instantes.');
  if (!res.ok) throw new Error('Não foi possível concluir a transcrição. Tente novamente em instantes.');
  const data = await res.json();
  const texto = ((data && data.text) || '').trim();
  if (!texto) throw new Error('Não encontramos fala neste arquivo.');
  return texto;
}

// Limites de tamanho por tipo: arquivos além disso travam o navegador (OCR/
// parse roda na própria aba). Limites generosos — uso legítimo passa folgado.
const INGEST_MAX_BYTES = {
  text: 20 * 1024 * 1024,
  pdf: 60 * 1024 * 1024,
  docx: 25 * 1024 * 1024,
  image: 25 * 1024 * 1024,
};

/** Converte um arquivo em texto pelo conversor adequado. onProgress(mensagem). */
async function ingestToText(file, onProgress) {
  const kind = ingestKind(file);
  const cap = INGEST_MAX_BYTES[kind];
  if (cap && file.size > cap) {
    throw new Error(`Arquivo muito grande (${formatBytes(file.size)}) — o limite para este tipo é ${formatBytes(cap)}.`);
  }
  switch (kind) {
    case 'text': if (onProgress) onProgress('Lendo o texto…'); return readTextFile(file);
    case 'pdf': if (onProgress) onProgress('Extraindo o texto do PDF…'); return extractPdf(file);
    case 'docx': if (onProgress) onProgress('Extraindo o texto do documento…'); return extractDocx(file);
    case 'image': return extractImage(file, (pct) => { if (onProgress) onProgress('Reconhecendo o texto da imagem… ' + pct + '%'); });
    case 'media': return transcribeMedia(file, onProgress);
    default: throw new Error('Formato não suportado: ' + (file.name || 'arquivo') + '.');
  }
}

/** Toast de progresso persistente (atualizável) para ingestão nativa. */
function ingestProgressToast() {
  const stack = $('#toast-stack');
  const t = document.createElement('div');
  t.className = 'toast info';
  t.innerHTML = '<div class="flex-1"><span class="spinner" style="width:12px;height:12px;margin-right:8px;vertical-align:middle;"></span><span class="ing-msg">Processando…</span></div>';
  stack.appendChild(t);
  return {
    set: (m) => { const s = t.querySelector('.ing-msg'); if (s) s.textContent = m; },
    done: () => t.remove(),
  };
}

/** Ingestão nativa: converte o arquivo e entrega o texto via deliver(text). */
async function ingestFileNative(file, deliver) {
  if (!file) return;
  const prog = ingestProgressToast();
  try {
    const text = await ingestToText(file, prog.set);
    prog.done();
    if (!text) { toast('Não encontramos texto neste arquivo.', 'error'); return; }
    deliver(text);
    toast('Conteúdo adicionado.', 'success');
  } catch (e) {
    prog.done();
    toast((e && e.message) || 'Não foi possível processar o arquivo.', 'error', 6000);
  }
}

// Serviço de ingestão para as ferramentas EMBUTIDAS: recebe um File por
// postMessage, converte no app pai e devolve o texto (com progresso).
// SEGURANÇA: só processa arquivos enviados pelos iframes das nossas ferramentas.
if (typeof window !== 'undefined') {
  window.addEventListener('message', function (e) {
    const d = e.data;
    if (!d || d.type !== 'agente:ingest' || !d.file) return;
    if (typeof isToolFrameSource === 'function' && !isToolFrameSource(e)) return;
    const src = e.source;
    const reqId = d.reqId;
    const post = (m) => {
      try { src && src.postMessage(Object.assign({ reqId }, m), typeof toolTargetOrigin === 'function' ? toolTargetOrigin() : '*'); }
      catch (_) { /* */ }
    };
    ingestToText(d.file, (msg) => post({ type: 'agente:ingest-progress', msg }))
      .then((text) => post({ type: 'agente:ingest-result', text: text || '' }))
      .catch((err) => post({ type: 'agente:ingest-error', error: (err && err.message) || 'Não foi possível processar o arquivo.' }));
  });
}
