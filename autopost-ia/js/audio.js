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
//
// STREAMING de ponta a ponta: a fonte (demux.js) entrega o áudio em segmentos
// de ~48 s já em 16 kHz mono — MP4/MOV/M4A via extração AAC→ADTS por faixa de
// bytes (ESSENCIAL no iPhone: o Safari não decodifica áudio de contêiner de
// vídeo, e o arquivo nunca é carregado inteiro na memória), MP3 via fatias de
// bytes, e demais formatos via decodificação completa (fallback). Cada
// segmento vai direto ao encoder; as PARTES são cortadas pelo TAMANHO SEGURO
// real (não pela estimativa), então nunca estouram o limite da API.
async function otimizarArquivo(arquivo, onProgress) {
  if (!arquivo) throw new Error('Nenhum arquivo selecionado.');
  if (arquivo.size <= WHISPER_SAFE_BYTES) {
    return { arquivos: [arquivo], otimizado: false, de: arquivo.size, para: arquivo.size };
  }

  if (typeof lamejs === 'undefined' || !lamejs.Mp3Encoder) {
    throw new Error('O compactador de áudio (embutido) não carregou. Recarregue a página e tente de novo.');
  }

  if (onProgress) onProgress('Lendo o áudio…');
  let fonte;
  try {
    fonte = await abrirFonteAudio(arquivo);
  } catch (e) {
    throw new Error('Não foi possível abrir este arquivo neste aparelho. Pode ser um formato incompatível — tente MP3, M4A, WAV, MP4 ou MOV — ou um arquivo longo demais para a memória do dispositivo (nesse caso, tente um trecho menor ou envie pelo computador).');
  }

  try {
    const plano = planejarPartes(fonte.dur);
    // Corte REAL das partes: pela duração que cabe em 23 MB no bitrate escolhido
    // (independe da estimativa de duração — MP3 sem Xing, por exemplo).
    const segPorParteSeguro = Math.floor((WHISPER_SAFE_BYTES * 8) / (plano.kbps * 1000));
    const baseNome = ((arquivo.name || 'audio').replace(/\.[^.]+$/, '')) || 'audio';

    const arquivos = [];
    let enc = null, pedacos = [], durParte = 0, durProcessada = 0;

    const fecharParte = () => {
      if (!enc) return;
      const fim = enc.flush();
      if (fim && fim.length) pedacos.push(new Uint8Array(fim));
      const saida = new File(pedacos, `${baseNome}.mp3`, { type: 'audio/mpeg' });
      if (saida.size > WHISPER_MAX_BYTES) {
        throw new Error('Não foi possível compactar este conteúdo o suficiente. Tente dividi-lo em partes menores.');
      }
      arquivos.push(saida);
      enc = null; pedacos = []; durParte = 0;
    };

    for (let i = 0; i < fonte.nSegs; i++) {
      const f32 = await fonte.segmento(i);
      const durSeg = f32.length / 16000;
      if (enc && durParte + durSeg > segPorParteSeguro) fecharParte();
      if (!enc) enc = new lamejs.Mp3Encoder(1, 16000, plano.kbps);

      const i16 = fatiaParaInt16(f32);
      const BLOCO = 1152 * 100;
      for (let k = 0; k < i16.length; k += BLOCO) {
        const buf = enc.encodeBuffer(i16.subarray(k, Math.min(i16.length, k + BLOCO)));
        if (buf.length) pedacos.push(new Uint8Array(buf));
      }
      durParte += durSeg; durProcessada += durSeg;
      if (onProgress) {
        const pct = Math.min(100, Math.round(((i + 1) / fonte.nSegs) * 100));
        onProgress('Preparando o arquivo… ' + pct + '%' +
          (plano.partes > 1 ? ' · será enviado em ~' + plano.partes + ' partes' : ''));
      }
      await new Promise(r => setTimeout(r, 0)); // cede o controle pra UI respirar
    }
    fecharParte();

    if (!arquivos.length || !durProcessada) {
      throw new Error('Não encontramos áudio aproveitável neste arquivo.');
    }
    // Nomeia as partes quando houver mais de uma (a transcrição mostra "parte i de N").
    if (arquivos.length > 1) {
      arquivos.forEach((f, i2) => {
        arquivos[i2] = new File([f], `${baseNome}.parte${i2 + 1}.mp3`, { type: 'audio/mpeg' });
      });
    }

    const totalSaida = arquivos.reduce((acc, f) => acc + f.size, 0);
    return { arquivos, otimizado: true, de: arquivo.size, para: totalSaida };
  } finally {
    try { fonte.fechar(); } catch (_) {}
  }
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
