'use strict';
/* ============================================================
   ÁUDIO — leitura de arquivos, otimização automática (100% no
   navegador) e transcrição via Groq Whisper (pt-BR).

   Se o arquivo passa de 25 MB, extraímos/comprimimos o áudio pra
   16 kHz mono (MP3) ANTES de enviar, usando Web Audio + lamejs
   (encoder MP3 puro-JS em js/vendor/). SEM servidor, SEM CDN,
   SEM worker, SEM wasm → funciona até abrindo por file://.

   COMPATÍVEL COM CELULAR (reescrito): a 1ª versão renderizava o
   arquivo INTEIRO num único OfflineAudioContext e mantinha todas
   as cópias (PCM completo + mono 16k + Int16) na memória ao mesmo
   tempo — funcionava no computador, mas estourava os limites dos
   navegadores móveis (iOS rejeita OfflineAudioContext gigantes e
   o pico de memória matava a aba). Agora:
     · a renderização é por FATIAS de ~40 s (um OfflineAudioContext
       pequeno por fatia; pico de memória da etapa: ~3 MB);
     · cada fatia é convertida e entregue ao encoder MP3 na hora,
       nada além da fatia atual fica vivo;
     · qualidade tem PISO de 32 kbps — quando o áudio é longo
       demais pra caber em um único arquivo de 23 MB, ele é
       DIVIDIDO automaticamente em partes (cada parte é um MP3
       independente) e a transcrição junta os textos na ordem →
       duração ilimitada sem degradar a qualidade;
     · referências grandes são liberadas assim que deixam de ser
       necessárias (o navegador recolhe a memória entre etapas).
   A Groq já reamostra pra 16 kHz mono no servidor, então isto é
   só REDUÇÃO DE TAMANHO, sem perda extra na transcrição.
   ============================================================ */

const GROQ_WHISPER_ENDPOINT = "https://api.groq.com/openai/v1/audio/transcriptions";
const GROQ_WHISPER_MODEL = "whisper-large-v3";
const WHISPER_MAX_BYTES = 25 * 1024 * 1024;  // limite do free tier da Groq
const WHISPER_SAFE_BYTES = 23 * 1024 * 1024; // alvo com margem sob o limite de 25 MB

// Qualidade do MP3 de voz: entre 32 (piso — nunca degradamos além disso;
// abaixo passa a comprometer a transcrição) e 64 kbps (teto — acima não
// melhora o Whisper e só aumenta o upload).
const KBPS_PISO = 32;
const KBPS_TETO = 64;

// Tamanho da fatia de renderização (segundos). 40 s @ 16 kHz mono ≈ 2,5 MB
// de PCM por vez — folgado até para celulares antigos.
const FATIA_SEG = 40;

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
    let ab = await lerArrayBuffer(arquivo);
    return await new Promise((resolve, reject) => {
      // forma com callbacks (compat. ampla) + também resolve se vier Promise (navegadores modernos)
      let p;
      try { p = ctx.decodeAudioData(ab, resolve, reject); } catch (e) { reject(e); return; }
      if (p && typeof p.then === 'function') p.then(resolve, reject);
      ab = null; // o decoder já recebeu os bytes; libera a referência
    });
  } finally {
    if (ctx.close) { try { ctx.close(); } catch (_) {} }
  }
}

// Plano de compressão/divisão a partir da duração REAL do áudio (função pura,
// verificável isolada): quantas partes e a que bitrate, respeitando o piso de
// qualidade. 1 parte sempre que couber; N partes para durações muito longas.
function planejarPartes(durSeg) {
  const dur = Math.max(1, Number(durSeg) || 1);
  // Bitrate que faria caber TUDO em um único arquivo seguro (23 MB).
  let kbps = Math.floor((WHISPER_SAFE_BYTES * 8) / (dur * 1000));
  if (kbps >= KBPS_PISO) {
    return { partes: 1, kbps: Math.min(KBPS_TETO, kbps), segPorParte: dur };
  }
  // Não cabe com qualidade digna → divide no piso de qualidade.
  const segMax = Math.floor((WHISPER_SAFE_BYTES * 8) / (KBPS_PISO * 1000)); // ~5750 s/parte
  const partes = Math.ceil(dur / segMax);
  return { partes, kbps: KBPS_PISO, segPorParte: dur / partes };
}

// Renderiza UMA fatia do áudio decodificado em 16 kHz MONO (Float32).
// Cada fatia usa um OfflineAudioContext PEQUENO e independente — compatível
// com os limites do iOS e com memória de pico mínima.
async function renderizarFatia16k(audioBuf, offsetSeg, durSeg) {
  const TAXA = 16000;
  const OAC = window.OfflineAudioContext || window.webkitOfflineAudioContext;
  if (!OAC) throw new Error('Seu navegador não suporta OfflineAudioContext.');
  const frames = Math.max(1, Math.ceil(durSeg * TAXA));
  const off = new OAC(1, frames, TAXA);
  const src = off.createBufferSource();
  src.buffer = audioBuf;
  src.connect(off.destination);        // 1 canal no destino → downmix automático pra mono
  src.start(0, offsetSeg, durSeg);     // offset/duração em segundos DO BUFFER (resample automático)
  const rendered = await off.startRendering();
  return rendered.getChannelData(0);   // Float32 @ 16 kHz mono (só a fatia)
}

// Float32 [-1,1] → Int16 (da fatia atual apenas).
function fatiaParaInt16(f32) {
  const n = f32.length;
  const i16 = new Int16Array(n);
  for (let i = 0; i < n; i++) {
    const s = f32[i] < -1 ? -1 : (f32[i] > 1 ? 1 : f32[i]);
    i16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF;
  }
  return i16;
}

// Otimiza o arquivo se passar do limite seguro.
// Retorna { arquivos: [File, …], otimizado, de, para }. Quando o áudio é longo
// demais pra um único MP3 de 23 MB com qualidade digna, `arquivos` traz VÁRIAS
// partes (cada uma um MP3 independente) — transcreverPartes() junta os textos.
async function otimizarArquivo(arquivo, onProgress) {
  if (!arquivo) throw new Error('Nenhum arquivo selecionado.');
  if (arquivo.size <= WHISPER_SAFE_BYTES) {
    return { arquivos: [arquivo], otimizado: false, de: arquivo.size, para: arquivo.size };
  }

  if (typeof lamejs === 'undefined' || !lamejs.Mp3Encoder) {
    throw new Error('O compactador de áudio (embutido) não carregou. Recarregue a página e tente de novo.');
  }

  // 1) decodifica (áudio, ou a faixa de áudio de um vídeo suportado pelo navegador)
  if (onProgress) onProgress('Lendo o áudio…');
  let audioBuf;
  try {
    audioBuf = await decodificarAudio(arquivo);
  } catch (e) {
    throw new Error('Não foi possível abrir este arquivo neste aparelho. Pode ser um formato incompatível — tente MP3, M4A, WAV, MP4, MOV ou WebM — ou um vídeo longo demais para a memória do dispositivo (nesse caso, tente um trecho menor ou envie pelo computador).');
  }

  // Duração REAL vem do próprio buffer (sempre disponível, ao contrário dos
  // metadados do contêiner, que às vezes faltam).
  const durTotal = audioBuf.length / audioBuf.sampleRate;
  const plano = planejarPartes(durTotal);

  // 2) renderiza em FATIAS e entrega direto ao encoder MP3 (nada acumula além
  //    da fatia atual). Cada PARTE tem seu próprio encoder + flush → cada
  //    arquivo de saída é um MP3 completo e válido.
  const baseNome = ((arquivo.name || 'audio').replace(/\.[^.]+$/, '')) || 'audio';
  const arquivos = [];
  let segProcessados = 0;

  for (let p = 0; p < plano.partes; p++) {
    const inicio = p * plano.segPorParte;
    const fim = Math.min(durTotal, (p + 1) * plano.segPorParte);
    const enc = new lamejs.Mp3Encoder(1, 16000, plano.kbps);
    const pedacos = [];

    for (let off = inicio; off < fim; off += FATIA_SEG) {
      const durFatia = Math.min(FATIA_SEG, fim - off);
      const f32 = await renderizarFatia16k(audioBuf, off, durFatia);
      const i16 = fatiaParaInt16(f32);
      // alimenta o encoder em blocos (múltiplos do frame do MP3)
      const BLOCO = 1152 * 100;
      for (let i = 0; i < i16.length; i += BLOCO) {
        const buf = enc.encodeBuffer(i16.subarray(i, Math.min(i16.length, i + BLOCO)));
        if (buf.length) pedacos.push(new Uint8Array(buf));
      }
      segProcessados += durFatia;
      if (onProgress) {
        const pct = Math.min(100, Math.round((segProcessados / durTotal) * 100));
        onProgress('Preparando o arquivo… ' + pct + '%' +
          (plano.partes > 1 ? ' · será enviado em ' + plano.partes + ' partes' : ''));
      }
      await new Promise(r => setTimeout(r, 0)); // cede o controle pra UI respirar
    }

    const fimEnc = enc.flush();
    if (fimEnc && fimEnc.length) pedacos.push(new Uint8Array(fimEnc));
    const nome = plano.partes > 1 ? `${baseNome}.parte${p + 1}.mp3` : `${baseNome}.mp3`;
    const saida = new File(pedacos, nome, { type: 'audio/mpeg' });
    if (saida.size > WHISPER_MAX_BYTES) {
      // Salvaguarda (não deve ocorrer com a margem de 23 MB): melhor um erro
      // claro do que um 413 da API.
      throw new Error('Não foi possível compactar este conteúdo o suficiente. Tente dividi-lo em partes menores.');
    }
    arquivos.push(saida);
  }

  audioBuf = null; // libera o PCM decodificado (a maior alocação do processo)

  const totalSaida = arquivos.reduce((acc, f) => acc + f.size, 0);
  return { arquivos, otimizado: true, de: arquivo.size, para: totalSaida };
}

// Transcreve UM arquivo de áudio/vídeo (≤ 25 MB) enviando-o à API de
// transcrição da Groq (Whisper large v3, OpenAI-compatível). Lê o arquivo
// DIRETO — sem microfone e sem tocar o áudio. Precisa de internet.
//   • acurácia alta (~98%), pt-BR nativo;
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

// Transcreve a LISTA de arquivos preparada por otimizarArquivo (1..N partes),
// em sequência, e devolve o texto completo na ordem. Com várias partes, o
// progresso indica "parte i de N".
async function transcreverPartes(arquivos, onProgress) {
  const lista = Array.isArray(arquivos) ? arquivos : [arquivos];
  const textos = [];
  for (let i = 0; i < lista.length; i++) {
    const prefixo = lista.length > 1 ? `Parte ${i + 1} de ${lista.length} · ` : '';
    const texto = await transcreverMedia(lista[i], (msg) => {
      if (onProgress) onProgress(prefixo + msg);
    });
    textos.push(texto);
  }
  return textos.join('\n\n');
}
