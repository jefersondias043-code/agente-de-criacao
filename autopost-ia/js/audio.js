'use strict';
/* ============================================================
   ÁUDIO — leitura de arquivos, otimização automática (100% no
   navegador) e transcrição via Groq Whisper (pt-BR).

   Se o arquivo passa de 25 MB, extraímos/comprimimos o áudio pra
   16 kHz mono (MP3) ANTES de enviar, usando Web Audio + lamejs
   (encoder MP3 puro-JS em js/vendor/). SEM servidor, SEM CDN,
   SEM worker, SEM wasm → funciona até abrindo por file://.
   A Groq já reamostra pra 16 kHz mono no servidor, então isto é
   só REDUÇÃO DE TAMANHO, sem perda extra.
   ============================================================ */

const GROQ_WHISPER_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_WHISPER_MODEL = "whisper-large-v3";
const WHISPER_MAX_BYTES = 25 * 1024 * 1024; // limite do free tier da Groq
const WHISPER_SAFE_BYTES = 23 * 1024 * 1024; // alvo com margem sob o limite de 25 MB

// Lê o arquivo como ArrayBuffer, com fallback FileReader p/ navegadores móveis antigos.
function lerArrayBuffer(arquivo) {
  if (arquivo.arrayBuffer) return arquivo.arrayBuffer();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(fr.result);
    fr.onerror = () => reject(fr.error || new Error('Falha ao ler o arquivo.'));
    fr.readAsArrayBuffer(arquivo);
  });
}

// O arquivo é de TEXTO? (tipo text/* ou extensão .txt/.md/.markdown/.text)
function ehArquivoDeTexto(arquivo) {
  if (!arquivo) return false;
  if (/^text\//i.test(arquivo.type || '')) return true;
  return /\.(txt|md|markdown|text)$/i.test(arquivo.name || '');
}

// Lê o arquivo como texto (UTF-8), com fallback FileReader p/ navegadores sem Blob.text().
function lerTextoArquivo(arquivo) {
  if (arquivo.text) return arquivo.text();
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(String(fr.result || ''));
    fr.onerror = () => reject(fr.error || new Error('Falha ao ler o arquivo de texto.'));
    fr.readAsText(arquivo, 'utf-8');
  });
}

// Decodifica o arquivo (áudio nativo OU a faixa de áudio de vídeos que o navegador saiba decodificar).
async function decodificarAudio(arquivo) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Seu navegador não suporta Web Audio (AudioContext).');
  // IMPORTANTE p/ mobile (iOS Safari / Chrome Android): criar e retomar o AudioContext ainda
  // dentro do gesto do usuário — ANTES de qualquer await — senão ele fica "suspended" e falha.
  const ctx = new AC();
  try {
    if (ctx.state === 'suspended' && ctx.resume) { try { await ctx.resume(); } catch (_) {} }
    const ab = await lerArrayBuffer(arquivo);
    return await new Promise((resolve, reject) => {
      // forma com callbacks (compat. ampla) + também resolve se vier Promise (navegadores modernos)
      let p;
      try { p = ctx.decodeAudioData(ab, resolve, reject); } catch (e) { reject(e); return; }
      if (p && typeof p.then === 'function') p.then(resolve, reject);
    });
  } finally {
    if (ctx.close) { try { ctx.close(); } catch (_) {} }
  }
}

// Reamostra um AudioBuffer pra 16 kHz MONO e devolve um Float32Array (PCM).
async function paraMono16k(audioBuf) {
  const TAXA = 16000;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) throw new Error('Seu navegador não suporta OfflineAudioContext.');
  const frames = Math.max(1, Math.ceil(audioBuf.duration * TAXA));
  const off = new OAC(1, frames, TAXA);
  const src = off.createBufferSource();
  src.buffer = audioBuf;
  src.connect(off.destination); // 1 canal no destino → downmix automático pra mono
  src.start(0);
  const rendered = await off.startRendering();
  return rendered.getChannelData(0); // Float32 @ 16 kHz mono
}

// Otimiza o arquivo se passar do limite seguro. Retorna { arquivo, otimizado, de, para }.
async function otimizarArquivo(arquivo, onProgress) {
  if (!arquivo) throw new Error('Nenhum arquivo selecionado.');
  if (arquivo.size <= WHISPER_SAFE_BYTES) return { arquivo, otimizado: false, de: arquivo.size, para: arquivo.size };

  if (typeof lamejs === 'undefined' || !lamejs.Mp3Encoder) {
    throw new Error('O compactador de áudio (embutido) não carregou. Recarregue a página e tente de novo.');
  }

  // 1) decodifica (áudio, ou a faixa de áudio de um vídeo suportado pelo navegador)
  if (onProgress) onProgress('Lendo o áudio…');
  let audioBuf;
  try {
    audioBuf = await decodificarAudio(arquivo);
  } catch (e) {
    throw new Error('Não foi possível abrir este arquivo. Tente um formato comum de áudio (MP3, M4A, WAV) ou de vídeo (MP4, MOV, WebM).');
  }
  const dur = audioBuf.duration || 0;

  // 2) reamostra p/ 16 kHz mono
  if (onProgress) onProgress('Preparando o áudio…');
  const f32 = await paraMono16k(audioBuf);
  audioBuf = null; // libera o PCM grande
  const n = f32.length;

  // 3) Float32 [-1,1] -> Int16
  const i16 = new Int16Array(n);
  for (let i = 0; i < n; i++) { const s = f32[i] < -1 ? -1 : (f32[i] > 1 ? 1 : f32[i]); i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF; }

  // 4) bitrate alvo pra caber em WHISPER_SAFE_BYTES (16..64 kbps; sem duração → 48)
  const segundos = dur || (n / 16000);
  let kbps = segundos ? Math.floor((WHISPER_SAFE_BYTES * 8) / (segundos * 1000)) : 48;
  kbps = Math.max(16, Math.min(64, kbps));

  // 5) encoda MP3 em blocos, cedendo o controle pra UI não travar + progresso
  if (onProgress) onProgress('Preparando o arquivo…');
  const enc = new lamejs.Mp3Encoder(1, 16000, kbps);
  const BLOCO = 1152 * 100; // ~115k amostras por passo
  const partes = [];
  let passo = 0;
  for (let i = 0; i < n; i += BLOCO) {
    const buf = enc.encodeBuffer(i16.subarray(i, Math.min(n, i + BLOCO)));
    if (buf.length) partes.push(new Uint8Array(buf));
    if (onProgress) onProgress('Preparando o arquivo… ' + Math.min(100, Math.round(((i + BLOCO) / n) * 100)) + '%');
    if ((++passo % 4) === 0) await new Promise(r => setTimeout(r, 0)); // cede o controle pra UI respirar
  }
  const fim = enc.flush();
  if (fim && fim.length) partes.push(new Uint8Array(fim));

  const baseNome = ((arquivo.name || 'audio').replace(/\.[^.]+$/, '')) || 'audio';
  const saida = new File(partes, baseNome + '.mp3', { type: 'audio/mpeg' });

  if (saida.size > WHISPER_MAX_BYTES) {
    throw new Error('Este conteúdo é muito longo para transcrever de uma vez. Tente dividi-lo em partes menores.');
  }
  return { arquivo: saida, otimizado: true, de: arquivo.size, para: saida.size };
}

// Transcreve um arquivo de áudio/vídeo enviando-o à API de transcrição da Groq
// (Whisper large v3, OpenAI-compatível). Lê o arquivo DIRETO — sem microfone e
// sem tocar o áudio. Precisa de internet e consome cota da Groq.
//   • acurácia alta (~98%), pt-BR nativo;
//   • limite de ~25 MB por arquivo (free tier da Groq);
//   • aceita áudio (MP3, WAV, M4A, FLAC, OGG…) e vídeo com trilha (MP4, WebM…).
// onProgress(msg) é um callback opcional pra atualizar o status na tela.
async function transcreverMedia(arquivo, onProgress) {
  if (!arquivo) throw new Error('Nenhum arquivo selecionado.');
  if (arquivo.size > WHISPER_MAX_BYTES) {
    throw new Error('Não foi possível preparar este arquivo automaticamente. Ele parece muito longo — tente dividi-lo em partes menores.');
  }

  const apiKey = await getGroqKey();
  if (!apiKey) throw new Error('Configure sua chave da API Groq (botão ⚙ no topo) para transcrever.');

  if (onProgress) onProgress('Enviando o arquivo para transcrição…');

  // multipart/form-data — NÃO definimos Content-Type à mão (o browser põe o boundary).
  const form = new FormData();
  form.append('file', arquivo, arquivo.name || 'audio');
  form.append('model', GROQ_WHISPER_MODEL);
  form.append('language', 'pt');
  form.append('response_format', 'json');
  form.append('temperature', '0');

  const MAX_RETRIES = 4;
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(GROQ_WHISPER_ENDPOINT, {
        method: 'POST',
        headers: { 'Authorization': 'Bearer ' + apiKey },
        body: form
      });
    } catch (netErr) {
      throw new Error('Falha de conexão ao enviar o áudio. Verifique sua internet e tente novamente.');
    }

    // 429 (limite de taxa) / 503: respeita Retry-After e tenta de novo com backoff.
    if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
      const retryAfter = parseFloat(response.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(1500 * Math.pow(2, attempt), 20000);
      if (onProgress) onProgress('Muitas solicitações no momento — aguardando ' + Math.round(wait / 1000) + 's…');
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!response.ok) {
      await response.text();
      if (response.status === 401) throw new Error('Chave da API inválida ou expirada. Confira a chave no botão ⚙ e tente de novo.');
      if (response.status === 413) throw new Error('O arquivo ficou grande demais para transcrever. Tente dividi-lo em partes menores.');
      throw new Error('Não foi possível concluir a transcrição agora. Tente novamente em instantes.');
    }

    if (onProgress) onProgress('Processando a transcrição…');
    const data = await response.json();
    const texto = ((data && data.text) || '').trim();
    if (!texto) throw new Error('Não encontramos fala neste arquivo. Verifique se há áudio audível e tente outro.');
    return texto;
  }
}
