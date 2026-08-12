'use strict';
/* ============================================================================
 * media-transcode.js — TRANSCRIÇÃO DE MÍDIA GRANDE (paridade com o AutoPost IA).
 *
 * Portado do AutoPost IA (removido no r227) para a PLATAFORMA-MÃE, de modo que
 * QUALQUER campo de entrada da plataforma (Extrair, Gerar → anexar, ferramentas
 * embutidas via ingest) aceite áudio/vídeo ACIMA do limite de 25 MB da API:
 *
 *   arquivo grande → abrirFonteAudio() lê o áudio em STREAMING (nunca inteiro na
 *   memória): MP4/MOV/M4A via demux AAC→ADTS por faixa de bytes (essencial no
 *   iPhone, que não decodifica trilha de vídeo), MP3 por fatias, demais formatos
 *   por decodificação completa → cada segmento vira 16 kHz mono → encoder MP3
 *   (lamejs, embutido) → 1..N partes de ≤ 23 MB → transcritas em ordem e unidas.
 *
 * Reutiliza da plataforma (definidos em ingest.js): WHISPER_MAX_BYTES e
 * transcribeMediaDirect() (upload de UMA parte à Groq Whisper). Aqui só ficam a
 * COMPRESSÃO/DIVISÃO e o DEMUX. Sem servidor, sem worker, sem wasm — funciona
 * inclusive por file://.
 * ============================================================================ */

// Alvo com margem sob o limite de 25 MB da Groq (definido em ingest.js).
const WHISPER_SAFE_BYTES = 23 * 1024 * 1024;

/* Teto para o caminho que abre o arquivo INTEIRO na memória (o fallback de
 * `abrirFonteAudio`). Um vídeo de celular decodificado em PCM ocupa muitas vezes
 * o tamanho do arquivo; 120 MB de entrada já passa de 1 GB de áudio cru, que
 * nenhum celular segura. Acima disso, recusar com instrução é melhor do que
 * tentar e derrubar a aba. */
const FALLBACK_MAX_BYTES = 120 * 1024 * 1024;


// Qualidade do MP3 de voz (piso 32 = nunca degrada além disso; teto 64 = acima
// não melhora o Whisper e só aumenta o upload).
const KBPS_PISO = 32;
const KBPS_TETO = 64;
// Tamanho da fatia de renderização (s). 40 s @ 16 kHz mono ≈ 2,5 MB de PCM.
const FATIA_SEG = 40;

// Corre uma promessa com TETO DE TEMPO — converte qualquer travamento (ex.: áudio
// suspenso no iOS que nunca resolve) num erro claro, em vez de spinner infinito.
function _comTimeout(promise, ms, msg) {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(msg || 'Tempo esgotado.')), ms);
    promise.then((v) => { clearTimeout(t); resolve(v); }, (e) => { clearTimeout(t); reject(e); });
  });
}

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
    // Teto de tempo: se abrir/decodificar travar (áudio suspenso no iOS), falha
    // com mensagem clara em vez de ficar preso em "Lendo o áudio…".
    fonte = await _comTimeout(abrirFonteAudio(arquivo), 45000, 'timeout');
  } catch (e) {
    /* A MENSAGEM VEM DE BAIXO quando existe uma. A versão anterior trocava
     * qualquer erro por um texto com quatro causas possíveis — "formato
     * incompatível ou arquivo longo demais" —, e quem recebia isso não tinha
     * como saber qual das quatro era a sua. O genérico ficou só para o que
     * realmente não tem causa conhecida. */
    const real = (e && e.message) || '';
    if (real && real !== 'timeout') throw new Error(real);
    throw new Error(real === 'timeout'
      ? 'A leitura deste arquivo passou de 45 segundos e foi interrompida. Em geral é um arquivo grande demais para este aparelho — tente um trecho menor, converta para MP3/M4A, ou envie pelo computador.'
      : 'Não foi possível abrir este arquivo neste aparelho. Pode ser um formato incompatível — tente MP3, M4A, WAV, MP4 ou MOV — ou um arquivo longo demais para a memória do dispositivo (nesse caso, tente um trecho menor ou envie pelo computador).');
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
      // Cada segmento (~48 s) decodifica em poucos segundos; teto generoso de 60 s
      // evita spinner infinito se a decodificação de áudio travar no aparelho.
      const f32 = await _comTimeout(fonte.segmento(i), 60000,
        'A conversão do áudio travou neste aparelho. Tente um trecho menor ou converta para MP3/M4A antes de enviar.');
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

// ============================================================
// DEMUX — fontes de áudio em streaming (portado de demux.js)
// ============================================================

const SEG_DUR = 48;          // segundos por segmento de decodificação
const PREROLL_FRAMES = 2;    // quadros AAC extras p/ aquecer o decoder (aparados depois)
const MP3_SLICE = 1.5 * 1024 * 1024; // fatia de bytes por segmento de MP3

// Taxas de amostragem do índice ADTS/ASC (ISO 14496-3).
const AAC_TAXAS = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];

// ---------- leitura de bytes por faixa (sem carregar o arquivo inteiro) ----------
function _lerFaixaBytes(arquivo, inicio, fim) {
  const blob = arquivo.slice(inicio, fim);
  if (blob.arrayBuffer) return blob.arrayBuffer().then(ab => new Uint8Array(ab));
  return new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload = () => resolve(new Uint8Array(fr.result));
    fr.onerror = () => reject(fr.error || new Error('Falha ao ler o arquivo.'));
    fr.readAsArrayBuffer(blob);
  });
}

// decodeAudioData com contexto compartilhado (forma dual: callbacks + Promise).
function _decodeComCtx(ctx, ab) {
  return new Promise((resolve, reject) => {
    let p;
    try { p = ctx.decodeAudioData(ab, resolve, reject); } catch (e) { reject(e); return; }
    if (p && typeof p.then === 'function') p.then(resolve, reject);
  });
}

// ============================================================
// PARSER ISOBMFF (MP4 / MOV / M4A)
// ============================================================

function _u32(dv, o) { return dv.getUint32(o); }
function _u64(dv, o) { return dv.getUint32(o) * 4294967296 + dv.getUint32(o + 4); }
function _tipo(bytes, o) { return String.fromCharCode(bytes[o], bytes[o + 1], bytes[o + 2], bytes[o + 3]); }

// Lista boxes filhos no intervalo [ini, fim) de um buffer em memória.
function _boxesEm(bytes, dv, ini, fim) {
  const lista = [];
  let p = ini;
  while (p + 8 <= fim) {
    let size = _u32(dv, p);
    const tipo = _tipo(bytes, p + 4);
    let corpo = p + 8;
    if (size === 1) { size = _u64(dv, p + 8); corpo = p + 16; }
    else if (size === 0) { size = fim - p; }
    if (size < 8 || p + size > fim) break; // caixa corrompida → para
    lista.push({ tipo, ini: corpo, fim: p + size });
    p += size;
  }
  return lista;
}
function _acharBox(bytes, dv, ini, fim, tipo) {
  return _boxesEm(bytes, dv, ini, fim).find(b => b.tipo === tipo) || null;
}

// Leitor de bits (pro AudioSpecificConfig do esds).
function _lerASC(bytes) {
  let bitPos = 0;
  const bits = (n) => {
    let v = 0;
    for (let i = 0; i < n; i++) {
      v = (v << 1) | ((bytes[bitPos >> 3] >> (7 - (bitPos & 7))) & 1);
      bitPos++;
    }
    return v;
  };
  let aot = bits(5);
  if (aot === 31) aot = 32 + bits(6);
  let sfi = bits(4);
  let freq = sfi === 15 ? bits(24) : (AAC_TAXAS[sfi] || 44100);
  const chan = bits(4);
  if (sfi === 15) { // taxa explícita → mapeia pro índice mais próximo (ADTS exige índice)
    let melhor = 4;
    for (let i = 0; i < AAC_TAXAS.length; i++) if (Math.abs(AAC_TAXAS[i] - freq) < Math.abs(AAC_TAXAS[melhor] - freq)) melhor = i;
    sfi = melhor; freq = AAC_TAXAS[melhor];
  }
  return { aot, sfi, freq, chan };
}

// Descritores do esds (tamanho em base-128 com continuação 0x80).
function _lerEsds(bytes, ini, fim) {
  let p = ini + 4; // pula version/flags
  const lerLen = () => { let len = 0, b; do { b = bytes[p++]; len = (len << 7) | (b & 0x7F); } while (b & 0x80 && p < fim); return len; };
  if (bytes[p] !== 0x03) return null;           // ES_Descriptor
  p++; lerLen();
  p += 2;                                        // ES_ID
  const flags = bytes[p++];
  if (flags & 0x80) p += 2;                      // streamDependence
  if (flags & 0x40) p += 1 + bytes[p];           // URL
  if (flags & 0x20) p += 2;                      // OCRstream
  if (bytes[p] !== 0x04) return null;           // DecoderConfigDescriptor
  p++; lerLen();
  p += 13;                                       // objectType(1)+stream(1)+buffer(3)+maxBr(4)+avgBr(4)
  if (bytes[p] !== 0x05) return null;           // DecoderSpecificInfo = AudioSpecificConfig
  p++; const ascLen = lerLen();
  return _lerASC(bytes.subarray(p, p + ascLen));
}

// Cabeçalho ADTS (7 bytes, sem CRC) pra 1 quadro AAC de rawLen bytes.
function _adts(profile, sfi, chan, rawLen) {
  const len = rawLen + 7;
  return [
    0xFF, 0xF1,
    ((profile & 3) << 6) | ((sfi & 15) << 2) | ((chan >> 2) & 1),
    ((chan & 3) << 6) | ((len >> 11) & 3),
    (len >> 3) & 0xFF,
    ((len & 7) << 5) | 0x1F,
    0xFC
  ];
}

// Analisa o contêiner e devolve a tabela de amostras da trilha de áudio AAC.
async function _analisarIsobmff(arquivo) {
  // 1) Varre as boxes de topo lendo SÓ cabeçalhos, até achar o moov (metadados).
  let pos = 0, moovBytes = null;
  while (pos + 8 <= arquivo.size) {
    const cab = await _lerFaixaBytes(arquivo, pos, Math.min(arquivo.size, pos + 16));
    const dvc = new DataView(cab.buffer);
    let size = _u32(dvc, 0);
    const tipo = _tipo(cab, 4);
    if (size === 1) size = _u64(dvc, 8);
    else if (size === 0) size = arquivo.size - pos;
    if (size < 8) throw new Error('isobmff: box inválida');
    if (tipo === 'moov') {
      if (size > 64 * 1024 * 1024) throw new Error('isobmff: moov grande demais');
      moovBytes = await _lerFaixaBytes(arquivo, pos, pos + size);
      break;
    }
    pos += size;
  }
  if (!moovBytes) throw new Error('isobmff: sem moov');
  const dv = new DataView(moovBytes.buffer);
  const moov = _acharBox(moovBytes, dv, 0, moovBytes.length, 'moov');
  if (!moov) throw new Error('isobmff: moov não parseia');

  /* 2) Acha a trilha de ÁUDIO (hdlr == 'soun') com tabelas completas.
   *
   * O LAÇO ANOTA POR QUE DESISTIU DE CADA TRILHA. Ele desiste em cinco pontos
   * diferentes e todos terminavam na mesma frase — "sem trilha de áudio AAC" —,
   * que não distingue "este arquivo não tem áudio" de "tem áudio, mas as
   * tabelas estão nos fragmentos" ou "o áudio não é AAC". São problemas
   * diferentes, com soluções diferentes, e quem recebe a mensagem é justamente
   * quem poderia dizer qual é. */
  const recusas = [];
  let trilhas = 0;
  for (const trak of _boxesEm(moovBytes, dv, moov.ini, moov.fim).filter(b => b.tipo === 'trak')) {
    trilhas++;
    const mdia = _acharBox(moovBytes, dv, trak.ini, trak.fim, 'mdia');
    if (!mdia) { recusas.push('trilha sem mdia'); continue; }
    const hdlr = _acharBox(moovBytes, dv, mdia.ini, mdia.fim, 'hdlr');
    if (!hdlr) { recusas.push('trilha sem hdlr'); continue; }
    const tipoTrilha = _tipo(moovBytes, hdlr.ini + 8);
    if (tipoTrilha !== 'soun') { recusas.push(`trilha de ${tipoTrilha}`); continue; }
    const minf = _acharBox(moovBytes, dv, mdia.ini, mdia.fim, 'minf');
    const stbl = minf && _acharBox(moovBytes, dv, minf.ini, minf.fim, 'stbl');
    if (!stbl) { recusas.push('trilha de áudio sem stbl'); continue; }
    const caixa = {};
    for (const t of ['stsd', 'stts', 'stsc', 'stsz', 'stco', 'co64']) {
      caixa[t] = _acharBox(moovBytes, dv, stbl.ini, stbl.fim, t);
    }
    if (!caixa.stsd || !caixa.stts || !caixa.stsc || !caixa.stsz || !(caixa.stco || caixa.co64)) {
      const faltando = ['stsd', 'stts', 'stsc', 'stsz'].filter((t) => !caixa[t])
        .concat(!(caixa.stco || caixa.co64) ? ['stco/co64'] : []);
      // Tabela vazia no moov é a assinatura do MP4 FRAGMENTADO: as amostras
      // vivem nos moof, e este leitor não os percorre.
      recusas.push(`trilha de áudio sem ${faltando.join('/')} (MP4 fragmentado?)`);
      continue;
    }

    // stsd → entrada mp4a; o esds pode vir direto OU dentro de 'wave' (MOV) →
    // varredura tolerante pelo fourcc dentro da entrada.
    const sdIni = caixa.stsd.ini + 8; // ver/flags + entry_count
    const formato = _tipo(moovBytes, sdIni + 4);
    if (formato !== 'mp4a' && formato !== 'enca') {
      // Áudio que não é AAC: Opus, MP3, PCM, AC-3. O leitor em partes só sabe
      // AAC — dizer QUAL é permite decidir o que fazer em vez de adivinhar.
      recusas.push(`áudio em "${formato}", que não é AAC`);
      continue;
    }
    let asc = null;
    for (let p = sdIni + 8; p < caixa.stsd.fim - 8; p++) {
      if (_tipo(moovBytes, p) === 'esds') { asc = _lerEsds(moovBytes, p + 4, caixa.stsd.fim); break; }
    }
    // Fallback sem esds: campos da própria entrada mp4a (assume AAC-LC).
    const canaisMp4a = dv.getUint16(sdIni + 24) || 2;
    const taxaMp4a = dv.getUint16(sdIni + 32) || 44100; // parte inteira do 16.16
    if (!asc) {
      let sfi = AAC_TAXAS.indexOf(taxaMp4a); if (sfi < 0) sfi = 4;
      asc = { aot: 2, sfi, freq: AAC_TAXAS[sfi], chan: canaisMp4a };
    }
    if (!asc.chan) asc.chan = canaisMp4a;
    const profile = (asc.aot >= 1 && asc.aot <= 4) ? asc.aot - 1 : 1; // fora de LC/Main → trata como LC

    // stts → duração total (na timescale da mídia).
    const mdhd = _acharBox(moovBytes, dv, mdia.ini, mdia.fim, 'mdhd');
    const mdhdVer = moovBytes[mdhd.ini];
    const timescale = mdhdVer === 1 ? _u32(dv, mdhd.ini + 20) : _u32(dv, mdhd.ini + 12);
    let nStts = _u32(dv, caixa.stts.ini + 4), durMedia = 0, totalAmostras = 0;
    for (let i = 0; i < nStts; i++) {
      const c = _u32(dv, caixa.stts.ini + 8 + i * 8);
      const d = _u32(dv, caixa.stts.ini + 12 + i * 8);
      totalAmostras += c; durMedia += c * d;
    }
    if (!totalAmostras) throw new Error('isobmff: sem amostras (MP4 fragmentado?)');

    // stsz → tamanhos.
    const szFixo = _u32(dv, caixa.stsz.ini + 4);
    const nAmostras = _u32(dv, caixa.stsz.ini + 8);
    const tamanhos = new Uint32Array(nAmostras);
    for (let i = 0; i < nAmostras; i++) tamanhos[i] = szFixo || _u32(dv, caixa.stsz.ini + 12 + i * 4);

    // stsc expandido + stco/co64 → offset absoluto de cada amostra.
    const co = caixa.stco || caixa.co64, co64 = !caixa.stco;
    const nChunks = _u32(dv, co.ini + 4);
    const chunkOff = (i) => co64 ? _u64(dv, co.ini + 8 + i * 8) : _u32(dv, co.ini + 8 + i * 4);
    const nStsc = _u32(dv, caixa.stsc.ini + 4);
    const stscEnt = [];
    for (let i = 0; i < nStsc; i++) {
      stscEnt.push({
        first: _u32(dv, caixa.stsc.ini + 8 + i * 12),
        porChunk: _u32(dv, caixa.stsc.ini + 12 + i * 12)
      });
    }
    const offsets = new Float64Array(nAmostras);
    let s = 0;
    for (let c = 0; c < nChunks && s < nAmostras; c++) {
      let porChunk = stscEnt[0].porChunk;
      for (const e of stscEnt) { if (c + 1 >= e.first) porChunk = e.porChunk; else break; }
      let off = chunkOff(c);
      for (let k = 0; k < porChunk && s < nAmostras; k++, s++) {
        offsets[s] = off; off += tamanhos[s];
      }
    }

    return {
      profile, sfi: asc.sfi, chan: Math.min(asc.chan || 2, 7),
      taxaAAC: asc.freq,
      offsets, tamanhos, nAmostras,
      dur: durMedia / (timescale || asc.freq)
    };
  }
  /* Nenhuma trilha serviu. A frase diz o que foi encontrado, e não só o que
   * faltou — é a diferença entre um relato que fecha o diagnóstico e um relato
   * que só reabre a investigação. */
  if (!trilhas) throw new Error('isobmff: o arquivo não tem nenhuma trilha (moov vazio)');
  /* NENHUMA TRILHA DE SOM é caso à parte, e é o mais importante de separar: não
   * adianta tentar decodificar o arquivo inteiro depois, porque não há áudio
   * nenhum ali. Medido: um vídeo com som declara duas trilhas e o parser conta
   * as duas — então "só trilha de vídeo" quer dizer que o arquivo foi exportado
   * sem áudio, não que o leitor deixou de enxergar. */
  const erro = new Error(`isobmff: nenhuma trilha de áudio AAC utilizável em ${trilhas} trilha(s) — ${recusas.join('; ')}`);
  erro.semAudio = !recusas.some((r) => !r.startsWith('trilha de ') || r.includes('áudio'));
  throw erro;
}

// Fonte ISOBMFF: segmentos de ~48 s extraídos por faixa de bytes → ADTS → decode.
async function _fonteIsobmff(arquivo, ctx) {
  const t = await _analisarIsobmff(arquivo);
  const framesPorSeg = Math.max(1, Math.ceil(SEG_DUR * t.taxaAAC / 1024));
  const nSegs = Math.max(1, Math.ceil(t.nAmostras / framesPorSeg));
  return {
    dur: t.dur, nSegs, origem: 'isobmff',
    async segmento(i) {
      const ini = Math.max(0, i * framesPorSeg - (i > 0 ? PREROLL_FRAMES : 0));
      const fim = Math.min(t.nAmostras, (i + 1) * framesPorSeg);
      // Junta faixas de bytes contíguas (amostras vizinhas quase sempre são).
      const faixas = [];
      for (let s = ini; s < fim; s++) {
        const o = t.offsets[s], z = t.tamanhos[s];
        const ult = faixas[faixas.length - 1];
        if (ult && ult.fim === o) ult.fim = o + z;
        else faixas.push({ ini: o, fim: o + z });
      }
      const blocos = await Promise.all(faixas.map(f => _lerFaixaBytes(arquivo, f.ini, f.fim)));
      // Monta o fluxo ADTS (cabeçalho de 7 bytes + quadro cru, por amostra).
      let totalLen = 0;
      for (let s = ini; s < fim; s++) totalLen += 7 + t.tamanhos[s];
      const adts = new Uint8Array(totalLen);
      let w = 0, bloco = 0, dentro = 0;
      for (let s = ini; s < fim; s++) {
        const z = t.tamanhos[s];
        adts.set(_adts(t.profile, t.sfi, t.chan, z), w); w += 7;
        // copia z bytes da sequência de blocos (respeitando fronteiras)
        let falta = z;
        while (falta > 0) {
          const disp = blocos[bloco].length - dentro;
          const usa = Math.min(falta, disp);
          adts.set(blocos[bloco].subarray(dentro, dentro + usa), w);
          w += usa; dentro += usa; falta -= usa;
          if (dentro >= blocos[bloco].length) { bloco++; dentro = 0; }
        }
      }
      const buf = await _decodeComCtx(ctx, adts.buffer);
      const trimSec = i > 0 ? (PREROLL_FRAMES * 1024) / t.taxaAAC : 0;
      const durUtil = Math.max(0.01, buf.duration - trimSec);
      return renderizarFatia16k(buf, trimSec, durUtil);
    },
    fechar() { /* nada além do ctx compartilhado */ }
  };
}

// ============================================================
// FONTE MP3 (fatias de bytes; o decoder ressincroniza sozinho)
// ============================================================

function _ehMp3(arquivo, cab) {
  if (/audio\/mpeg/i.test(arquivo.type || '') || /\.mp3$/i.test(arquivo.name || '')) return true;
  if (!cab) return false;
  if (cab[0] === 0x49 && cab[1] === 0x44 && cab[2] === 0x33) return true;          // ID3
  return cab[0] === 0xFF && (cab[1] & 0xE0) === 0xE0;                              // sync
}

async function _fonteMp3(arquivo, ctx) {
  // Estima a duração: Xing/Info (VBR) ou bitrate do 1º quadro (CBR).
  const cab = await _lerFaixaBytes(arquivo, 0, Math.min(arquivo.size, 256 * 1024));
  let ini = 0;
  if (cab[0] === 0x49 && cab[1] === 0x44 && cab[2] === 0x33) {
    ini = 10 + ((cab[6] & 0x7F) << 21 | (cab[7] & 0x7F) << 14 | (cab[8] & 0x7F) << 7 | (cab[9] & 0x7F));
  }
  let dur = 0;
  const TAXAS = { 3: [44100, 48000, 32000], 2: [22050, 24000, 16000], 0: [11025, 12000, 8000] };
  const KBPS_V1L3 = [0, 32, 40, 48, 56, 64, 80, 96, 112, 128, 160, 192, 224, 256, 320];
  const KBPS_V2L3 = [0, 8, 16, 24, 32, 40, 48, 56, 64, 80, 96, 112, 128, 144, 160];
  for (let p = ini; p < cab.length - 4; p++) {
    if (cab[p] !== 0xFF || (cab[p + 1] & 0xE0) !== 0xE0) continue;
    const ver = (cab[p + 1] >> 3) & 3;             // 3=MPEG1, 2=MPEG2, 0=MPEG2.5
    const camada = (cab[p + 1] >> 1) & 3;          // 1 = Layer III
    if (camada !== 1 || !TAXAS[ver]) continue;
    const taxa = TAXAS[ver][(cab[p + 2] >> 2) & 3];
    if (!taxa) continue;
    const kbps = (ver === 3 ? KBPS_V1L3 : KBPS_V2L3)[(cab[p + 2] >> 4) & 15];
    // Xing/Info dentro do 1º quadro?
    let achouXing = false;
    for (let q = p + 4; q < Math.min(p + 200, cab.length - 8); q++) {
      const tag = String.fromCharCode(cab[q], cab[q + 1], cab[q + 2], cab[q + 3]);
      if (tag === 'Xing' || tag === 'Info') {
        const flags = _u32(new DataView(cab.buffer, cab.byteOffset), q + 4);
        if (flags & 1) {
          const frames = _u32(new DataView(cab.buffer, cab.byteOffset), q + 8);
          dur = frames * (ver === 3 ? 1152 : 576) / taxa;
          achouXing = true;
        }
        break;
      }
    }
    if (!achouXing && kbps) dur = ((arquivo.size - ini) * 8) / (kbps * 1000);
    break;
  }
  if (!dur) dur = ((arquivo.size - ini) * 8) / (128 * 1000); // último recurso: assume 128 kbps
  const nSegs = Math.max(1, Math.ceil((arquivo.size - ini) / MP3_SLICE));
  return {
    dur, nSegs, origem: 'mp3',
    async segmento(i) {
      const a = ini + i * MP3_SLICE;
      const b = Math.min(arquivo.size, a + MP3_SLICE);
      const bytes = await _lerFaixaBytes(arquivo, a, b);
      const buf = await _decodeComCtx(ctx, bytes.buffer);
      return renderizarFatia16k(buf, 0, buf.duration);
    },
    fechar() { /* nada */ }
  };
}

// ============================================================
// FONTE COMPLETA (fallback: decodifica o arquivo inteiro — WAV/OGG/
// WebM etc.; comportamento anterior, adequado a computadores)
// ============================================================

async function _fonteCompleta(arquivo) {
  const buf = await decodificarAudio(arquivo);
  const dur = buf.length / buf.sampleRate;
  const nSegs = Math.max(1, Math.ceil(dur / SEG_DUR));
  let vivo = buf;
  return {
    dur, nSegs, origem: 'completa',
    segmento(i) {
      const off = i * SEG_DUR;
      return renderizarFatia16k(vivo, off, Math.min(SEG_DUR, dur - off));
    },
    fechar() { vivo = null; }
  };
}

// ============================================================
// SELEÇÃO DA FONTE
// ============================================================

async function abrirFonteAudio(arquivo) {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) throw new Error('Seu navegador não suporta Web Audio (AudioContext).');
  // Contexto compartilhado dos decodes por segmento — criado AINDA no gesto do
  // usuário (importante no iOS) e fechado junto com a fonte.
  const ctx = new AC();
  if (ctx.state === 'suspended' && ctx.resume) { try { await ctx.resume(); } catch (_) {} }
  const embrulhar = (fonte) => {
    const fecharOrig = fonte.fechar;
    fonte.fechar = () => { try { fecharOrig(); } catch (_) {} try { if (ctx.close) ctx.close(); } catch (_) {} };
    return fonte;
  };

  const cab = await _lerFaixaBytes(arquivo, 0, Math.min(arquivo.size, 16));
  const ehIsobmff = cab.length >= 12 && _tipo(cab, 4) === 'ftyp';

  /* POR QUE O STREAMING NÃO SERVIU. Estes dois `catch` engoliam o motivo, e o
   * chamador acabava exibindo uma mensagem genérica com quatro causas
   * possíveis — inútil para quem precisa resolver e inútil para quem precisa
   * consertar. O motivo agora sobe junto. */
  const porques = [];
  if (ehIsobmff) {
    try { return embrulhar(await _fonteIsobmff(arquivo, ctx)); }
    catch (e) {
      /* Arquivo SEM FAIXA DE ÁUDIO: parar aqui. Cair no fallback seria pedir ao
       * navegador que decodifique um áudio que não existe — ele falha, e a
       * pessoa recebe "falha ao decodificar" sobre um vídeo mudo, que é uma
       * resposta verdadeira e completamente inútil. */
      if (e && e.semAudio) {
        try { if (ctx.close) ctx.close(); } catch (_) {}
        throw new Error('Este vídeo não tem faixa de áudio — não há fala para transcrever. Confira se ele foi exportado com som, ou envie o arquivo de áudio separado.');
      }
      porques.push((e && e.message) || 'MP4 não pôde ser lido em partes');
    }
  }
  if (_ehMp3(arquivo, cab)) {
    try { return embrulhar(await _fonteMp3(arquivo, ctx)); }
    catch (e) { porques.push((e && e.message) || 'MP3 não pôde ser lido em partes'); }
  }
  try { if (ctx.close) ctx.close(); } catch (_) {} // fallback usa contexto próprio

  /* O FALLBACK CARREGA O ARQUIVO INTEIRO na memória para decodificar de uma vez.
   * Num arquivo de trezentos megas isso derruba a aba do celular — e era esse o
   * fim de linha do relato: streaming recusa o arquivo, o fallback tenta abrir
   * tudo, o aparelho não aguenta, e a pessoa recebe "formato incompatível" sobre
   * um formato perfeitamente compatível.
   *
   * Melhor recusar ANTES, dizendo o que aconteceu e o que fazer, do que tentar
   * e morrer sem explicação. O teto é generoso: o que passa por aqui já não
   * cabia em nenhuma memória de celular. */
  if (arquivo.size > FALLBACK_MAX_BYTES) {
    const causa = porques.length ? ` (${porques[0]})` : '';
    throw new Error(
      `Este arquivo tem ${(arquivo.size / 1024 / 1024).toFixed(0)} MB e o áudio dele não pôde ser lido em partes${causa}. ` +
      'Para abrir de uma vez só, ele não cabe na memória do aparelho. ' +
      'Converta para MP3 ou M4A antes de enviar, ou mande um trecho menor.');
  }

  try {
    return await _fonteCompleta(arquivo);
  } catch (e) {
    const causa = porques.length ? ` Antes disso, a leitura em partes falhou: ${porques[0]}.` : '';
    throw new Error(`${(e && e.message) || 'Falha ao decodificar o áudio.'}${causa}`);
  }
}


// Transcreve a LISTA de partes preparada por otimizarArquivo (1..N), em sequência,
// e devolve o texto completo na ordem. Reaproveita transcribeMediaDirect (ingest.js).
async function transcreverPartes(arquivos, onProgress) {
  const lista = Array.isArray(arquivos) ? arquivos : [arquivos];
  const textos = [];
  for (let i = 0; i < lista.length; i++) {
    const prefixo = lista.length > 1 ? `Parte ${i + 1} de ${lista.length} · ` : '';
    const texto = await transcribeMediaDirect(lista[i], (msg) => { if (onProgress) onProgress(prefixo + msg); });
    if (texto) textos.push(texto);
  }
  return textos.join('\n\n');
}
