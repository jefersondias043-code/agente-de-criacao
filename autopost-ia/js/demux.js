'use strict';
/* ============================================================
   DEMUX — fontes de áudio em STREAMING (essencial pro iPhone).

   POR QUE EXISTE: o Safari do iOS NÃO decodifica a trilha de áudio
   de arquivos de VÍDEO (MP4/MOV) via decodeAudioData — só formatos
   de áudio puros (AAC/M4A, MP3, WAV). E carregar o vídeo inteiro na
   memória (ArrayBuffer + PCM completo) mata a aba no celular.

   O QUE FAZ: lê o arquivo em PEDAÇOS (File.slice — nunca inteiro):
     · MP4/MOV/M4A → parser ISOBMFF próprio: acha a trilha de áudio
       AAC nas tabelas do contêiner (stsd/stts/stsc/stsz/stco),
       extrai os quadros AAC por faixa de bytes e embrulha em ADTS
       (áudio puro) — que o iOS decodifica feliz, em blocos de ~48 s;
     · MP3 → fatias de bytes (~1,5 MB); o decoder ressincroniza no
       próximo quadro (perda ≤26 ms por emenda, irrelevante p/ fala);
     · demais formatos → fallback: decodifica o arquivo inteiro
       (comportamento anterior, ok no computador).

   INTERFACE ÚNICA consumida por otimizarArquivo (audio.js):
     abrirFonteAudio(arquivo) → {
       dur,               // duração total estimada (s)
       nSegs,             // nº de segmentos
       segmento(i),       // → Promise<Float32Array 16 kHz MONO>
       origem,            // 'isobmff' | 'mp3' | 'completa' (debug)
       fechar()           // libera recursos
     }
   Memória de pico por segmento: poucos MB, qualquer que seja o
   tamanho do arquivo de entrada.
   ============================================================ */

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

  // 2) Acha a trilha de ÁUDIO (hdlr == 'soun') com tabelas completas.
  for (const trak of _boxesEm(moovBytes, dv, moov.ini, moov.fim).filter(b => b.tipo === 'trak')) {
    const mdia = _acharBox(moovBytes, dv, trak.ini, trak.fim, 'mdia');
    if (!mdia) continue;
    const hdlr = _acharBox(moovBytes, dv, mdia.ini, mdia.fim, 'hdlr');
    if (!hdlr || _tipo(moovBytes, hdlr.ini + 8) !== 'soun') continue;
    const minf = _acharBox(moovBytes, dv, mdia.ini, mdia.fim, 'minf');
    const stbl = minf && _acharBox(moovBytes, dv, minf.ini, minf.fim, 'stbl');
    if (!stbl) continue;
    const caixa = {};
    for (const t of ['stsd', 'stts', 'stsc', 'stsz', 'stco', 'co64']) {
      caixa[t] = _acharBox(moovBytes, dv, stbl.ini, stbl.fim, t);
    }
    if (!caixa.stsd || !caixa.stts || !caixa.stsc || !caixa.stsz || !(caixa.stco || caixa.co64)) continue;

    // stsd → entrada mp4a; o esds pode vir direto OU dentro de 'wave' (MOV) →
    // varredura tolerante pelo fourcc dentro da entrada.
    const sdIni = caixa.stsd.ini + 8; // ver/flags + entry_count
    const formato = _tipo(moovBytes, sdIni + 4);
    if (formato !== 'mp4a' && formato !== 'enca') continue;
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
  throw new Error('isobmff: sem trilha de áudio AAC');
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

  if (ehIsobmff) {
    try { return embrulhar(await _fonteIsobmff(arquivo, ctx)); }
    catch (_) { /* sem trilha AAC ou MP4 fragmentado → tenta o fallback */ }
  }
  if (_ehMp3(arquivo, cab)) {
    try { return embrulhar(await _fonteMp3(arquivo, ctx)); }
    catch (_) { /* MP3 problemático → fallback */ }
  }
  try { if (ctx.close) ctx.close(); } catch (_) {} // fallback usa contexto próprio
  const fonte = await _fonteCompleta(arquivo);
  return fonte;
}
