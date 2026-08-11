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

/** Chave Groq unificada da plataforma. */
function ingestGroqKey() {
  return (State.apiKeys && State.apiKeys.groq) ? String(State.apiKeys.groq).trim() : '';
}

/** Transcreve UMA parte (≤ 25 MB) via Groq Whisper. Com retry/backoff em
 *  429/503 (respeita Retry-After) — resiliência trazida do AutoPost IA.
 *  É o "upload direto" que o orquestrador (transcribeMedia) e o pipeline de
 *  mídia grande (media-transcode.js) reaproveitam para cada parte. */
async function transcribeMediaDirect(file, onProgress) {
  const apiKey = ingestGroqKey();
  if (!apiKey) throw new Error('Configure a chave de API da Groq nas Configurações para transcrever áudio e vídeo.');
  if (file.size > WHISPER_MAX_BYTES) {
    throw new Error('Não foi possível preparar este arquivo automaticamente. Ele parece muito longo — tente um trecho menor.');
  }
  if (onProgress) onProgress('Enviando o arquivo para transcrição…');
  const form = new FormData();
  form.append('file', file, file.name || 'media');
  form.append('model', WHISPER_MODEL);
  form.append('language', 'pt');
  form.append('response_format', 'json');
  form.append('temperature', '0');
  const MAX_RETRIES = 4;
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(WHISPER_ENDPOINT, { method: 'POST', headers: { Authorization: 'Bearer ' + apiKey }, body: form });
    } catch (e) {
      throw new Error('Falha de conexão ao enviar a mídia. Verifique sua internet.');
    }
    // 429/503 → respeita Retry-After e tenta de novo com backoff exponencial.
    if ((res.status === 429 || res.status === 503) && attempt < MAX_RETRIES) {
      const retryAfter = parseFloat(res.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(1500 * Math.pow(2, attempt), 20000);
      if (onProgress) onProgress('Muitas solicitações no momento — aguardando ' + Math.round(wait / 1000) + 's…');
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (res.status === 401) throw new Error('A chave de API da Groq é inválida ou expirou.');
    if (res.status === 413) throw new Error('O arquivo ficou grande demais para transcrever.');
    if (!res.ok) throw new Error('Não foi possível concluir a transcrição. Tente novamente em instantes.');
    if (onProgress) onProgress('Processando a transcrição…');
    const data = await res.json();
    const texto = ((data && data.text) || '').trim();
    if (!texto) throw new Error('Não encontramos fala neste arquivo.');
    return texto;
  }
}

/** Transcreve áudio/vídeo. Arquivos GRANDES (acima do limite seguro) são
 *  comprimidos e divididos em partes ≤ 23 MB pelo pipeline de mídia
 *  (media-transcode.js: demux em streaming + encoder MP3 embutido) e transcritos
 *  em ordem — a MESMA capacidade do AutoPost IA, agora em toda a plataforma
 *  (Extrair, Gerar → anexar, ferramentas embutidas). Arquivos pequenos vão
 *  direto, sem custo de compressão. */
async function transcribeMedia(file, onProgress) {
  if (!ingestGroqKey()) throw new Error('Configure a chave de API da Groq nas Configurações para transcrever áudio e vídeo.');
  const safe = (typeof WHISPER_SAFE_BYTES === 'number') ? WHISPER_SAFE_BYTES : WHISPER_MAX_BYTES;
  const podeOtimizar = typeof otimizarArquivo === 'function' && typeof transcreverPartes === 'function';
  if (file.size <= safe || !podeOtimizar) {
    if (file.size > WHISPER_MAX_BYTES) {
      throw new Error('Arquivo muito grande para transcrever aqui (máximo 25 MB).');
    }
    return transcribeMediaDirect(file, onProgress);
  }
  if (onProgress) onProgress('Preparando o áudio para transcrição…');
  const { arquivos } = await otimizarArquivo(file, onProgress);
  return transcreverPartes(arquivos, onProgress);
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
    // Wake Lock: mantém a tela ligada durante a conversão (celular: a tela
    // apagando suspende a aba e trava a transcrição/OCR). Mesma abordagem do AutoPost.
    const run = () => ingestToText(file, prog.set);
    const text = (typeof withWakeLock === 'function') ? await withWakeLock(run) : await run();
    prog.done();
    if (!text) { toast('Não encontramos texto neste arquivo.', 'error'); return; }
    deliver(text);
    toast('Conteúdo adicionado.', 'success');
  } catch (e) {
    prog.done();
    toast((e && e.message) || 'Não foi possível processar o arquivo.', 'error', 6000);
  }
}

/* ---------------------------------------------------------------------------
 * ANEXAR COM GESTO — a diferença entre transcrever e falhar no celular.
 *
 * Comprimir mídia grande usa Web Audio. No iOS (e às vezes no Chrome Android) o
 * AudioContext só sai de "suspended" a partir de um gesto do usuário, e o evento
 * `change` de um <input type=file> não conta como gesto para esse fim. Sem o
 * gesto, `decodeAudioData` simplesmente nunca resolve: o usuário vê "Lendo o
 * áudio…" por 45 segundos e recebe o erro de formato incompatível — que é uma
 * mensagem enganosa, porque o formato estava certo o tempo todo.
 *
 * Daí o cartão com o botão "Transcrever": o TOQUE nele é o gesto que destrava o
 * áudio. Arquivo pequeno, PDF, imagem e texto não passam por Web Audio e
 * continuam convertendo direto, sem clique a mais.
 *
 * Isto vivia duplicado na Gerar e na Narrativa, e as duas ferramentas escritas
 * depois (Causos e Julgador) foram copiadas da fiação que NÃO tinha o cartão —
 * e herdaram a falha. Uma implementação só é o que impede a próxima cópia de
 * herdar de novo.
 * ------------------------------------------------------------------------- */

/** Precisa de gesto? Só mídia acima do limite seguro passa pelo compressor. */
function ingestEhMidiaGrande(f) {
  if (!f || ingestKind(f) !== 'media') return false;
  const safe = (typeof WHISPER_SAFE_BYTES === 'number') ? WHISPER_SAFE_BYTES : 23 * 1024 * 1024;
  return f.size > safe;
}

/**
 * Roteia um arquivo anexado: mídia grande → cartão com botão (gesto); o resto
 * → conversão automática.
 *
 * @param {File} file
 * @param {(texto: string) => void} entregar  o que fazer com o texto extraído
 * @param {string} pendingSel  seletor do container do cartão; sem ele (ou sem o
 *        elemento na tela) a conversão é direta — degradar assim é melhor do
 *        que não anexar nada, e no desktop funciona igual.
 */
function ingestAnexar(file, entregar, pendingSel) {
  if (!file) return;
  const pending = pendingSel ? document.querySelector(pendingSel) : null;
  const converter = () => ingestFileNative(file, entregar);

  if (!ingestEhMidiaGrande(file) || !pending) { converter(); return; }

  pending.innerHTML = `
    <div class="attach-card">
      <div class="attach-card-info">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>
        <div style="min-width:0;">
          <div class="attach-card-name">${escapeHtml(file.name)}</div>
          <div class="attach-card-meta">${formatBytes(file.size)} · vídeo/áudio grande — será comprimido e transcrito</div>
        </div>
      </div>
      <div class="flex gap-1">
        <button type="button" class="btn btn-accent btn-sm" data-attach-go>Transcrever</button>
        <button type="button" class="btn btn-ghost btn-sm" data-attach-cancel title="Remover">✕</button>
      </div>
    </div>`;
  const go = pending.querySelector('[data-attach-go]');
  const cancel = pending.querySelector('[data-attach-cancel]');
  if (go) go.onclick = () => { pending.innerHTML = ''; converter(); };
  if (cancel) cancel.onclick = () => { pending.innerHTML = ''; };
}

/**
 * Liga um par botão+input de anexo a um campo de texto. Devolve o texto
 * extraído acrescentado ao que já estava lá.
 *
 * @param {object} opts  { botao, input, campo, pendente, separador }
 */
function ingestLigarAnexo(opts) {
  const o = opts || {};
  const btn = document.querySelector(o.botao);
  const inp = document.querySelector(o.input);
  const campo = document.querySelector(o.campo);
  if (!btn || !inp || !campo) return;
  inp.accept = INGEST_ACCEPT;
  btn.onclick = () => inp.click();

  const entregar = (texto) => {
    const cur = (campo.value || '').trim();
    const juncao = (o.separador && cur) ? o.separador : '\n\n';
    campo.value = cur ? (cur + juncao + texto) : texto;
    campo.dispatchEvent(new Event('input', { bubbles: true }));
  };

  inp.onchange = () => {
    const f = inp.files && inp.files[0];
    if (f) ingestAnexar(f, o.organizar ? organizarEEntregar(entregar) : entregar, o.pendente);
    inp.value = '';
  };
}

/* ORGANIZAR ANTES DE ENTREGAR.
 *
 * O que sai de um áudio é fala corrida: sem pontuação, sem quebra de fala,
 * número em algarismo, nome próprio em minúscula. Assim atrapalha duas vezes —
 * a pessoa não relê, e a IA que vai trabalhar em cima gasta atenção decifrando.
 *
 * A etapa vive em `transcricao.js`, e ela é MELHORIA, NÃO REQUISITO: sem chave,
 * sem IA, com erro de rede ou com uma organização que não passou na conferência,
 * o que entra no campo é o texto cru. Perder o anexo por causa de um enfeite
 * seria trocar o certo pelo bonito. */
function organizarEEntregar(entregar) {
  return async (texto) => {
    if (typeof runLimpezaTranscricao !== 'function' || !transcricaoVale(texto)) {
      entregar(texto);
      return;
    }
    const prog = ingestProgressToast();
    try {
      const r = await runLimpezaTranscricao({ texto, onProgress: prog.set });
      prog.done();
      entregar(r.texto || texto);
      if (r.limpou && r.descartes.length) {
        toast(`Texto organizado — ${r.descartes.length} de ${r.partes} trechos ficaram como vieram.`, 'info', 6000);
      } else if (r.limpou) {
        toast('Texto organizado: pontuação, falas separadas e números por extenso.', 'success', 5000);
      }
    } catch (_) {
      prog.done();
      entregar(texto);
    }
  };
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
