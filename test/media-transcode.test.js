// media-transcode.js — planejamento de compressão/divisão de mídia grande.
// A função planejarPartes é PURA (só aritmética sobre a duração): decide quantas
// partes e a que bitrate, respeitando o piso de qualidade e o teto de upload.
// O demux/encoder em si depende de Web Audio (coberto por sonda no navegador).
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let M;
beforeAll(() => {
  clearStorage();
  // media-transcode.js referencia WHISPER_MAX_BYTES (de ingest.js) só em runtime;
  // planejarPartes usa apenas constantes locais, então carrega isolado.
  M = loadModules(['media-transcode.js'], ['planejarPartes', 'WHISPER_SAFE_BYTES', '_comTimeout']);
});

const PISO = 32, TETO = 64;

describe('planejarPartes', () => {
  it('áudio curto cabe em 1 parte, no teto de qualidade', () => {
    const p = M.planejarPartes(60);
    expect(p.partes).toBe(1);
    expect(p.kbps).toBe(TETO);      // 60 s cabe folgado → usa o teto
    expect(p.segPorParte).toBe(60);
  });

  it('nunca ultrapassa o teto de bitrate', () => {
    expect(M.planejarPartes(1).kbps).toBeLessThanOrEqual(TETO);
    expect(M.planejarPartes(5).kbps).toBeLessThanOrEqual(TETO);
  });

  it('áudio longo é dividido em várias partes, no piso de qualidade', () => {
    const p = M.planejarPartes(20000); // ~5,5 h
    expect(p.partes).toBeGreaterThan(1);
    expect(p.kbps).toBe(PISO);        // divide no piso, não degrada além disso
    // a soma das partes cobre toda a duração
    expect(p.segPorParte * p.partes).toBeGreaterThanOrEqual(20000 - 1);
  });

  it('cada parte no piso cabe no tamanho seguro', () => {
    const p = M.planejarPartes(20000);
    const bytesPorParte = (p.kbps * 1000 / 8) * p.segPorParte;
    expect(bytesPorParte).toBeLessThanOrEqual(M.WHISPER_SAFE_BYTES + 1);
  });

  it('duração inválida/zero não quebra (mínimo de 1 s)', () => {
    const p = M.planejarPartes(0);
    expect(p.partes).toBe(1);
    expect(p.kbps).toBeLessThanOrEqual(TETO);
    expect(p.kbps).toBeGreaterThanOrEqual(PISO);
  });

  it('monotonicidade: mais duração nunca reduz o nº de partes', () => {
    let ant = 0;
    for (const dur of [10, 100, 1000, 6000, 12000, 30000, 60000]) {
      const partes = M.planejarPartes(dur).partes;
      expect(partes).toBeGreaterThanOrEqual(ant);
      ant = partes;
    }
  });
});

describe('_comTimeout (salvaguarda contra travamento)', () => {
  it('resolve quando a promessa termina a tempo', async () => {
    const r = await M._comTimeout(Promise.resolve('ok'), 1000, 'estourou');
    expect(r).toBe('ok');
  });
  it('rejeita com a mensagem dada quando estoura o tempo', async () => {
    const nunca = new Promise(() => {}); // nunca resolve (simula travamento)
    await expect(M._comTimeout(nunca, 20, 'travou no aparelho')).rejects.toThrow('travou no aparelho');
  });
  it('propaga a rejeição original da promessa', async () => {
    await expect(M._comTimeout(Promise.reject(new Error('erro real')), 1000, 'x')).rejects.toThrow('erro real');
  });
});
