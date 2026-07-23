// Gerar → anexo: roteamento de mídia grande (que precisa de um GESTO para
// transcrever no iOS) vs. o resto (conversão automática). E o wakeLock gracioso.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let G;
beforeAll(() => {
  clearStorage();
  G = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js', 'media-transcode.js', 'ingest.js', 'generate.js'],
    ['_genEhMidiaGrande', 'withWakeLock', 'WHISPER_SAFE_BYTES']
  );
});

function fakeFile(name, sizeBytes, type = '') {
  const f = new Blob(['x'], { type });
  Object.defineProperty(f, 'size', { value: sizeBytes });
  Object.defineProperty(f, 'name', { value: name });
  return f;
}

describe('_genEhMidiaGrande', () => {
  // Tamanhos calculados DENTRO dos testes (G só existe após o beforeAll).
  const big = () => G.WHISPER_SAFE_BYTES + 1024;
  const small = 1024 * 1024;

  it('vídeo acima do limite seguro → precisa do botão (true)', () => {
    expect(G._genEhMidiaGrande(fakeFile('clipe.mp4', big(), 'video/mp4'))).toBe(true);
  });
  it('áudio grande também (true)', () => {
    expect(G._genEhMidiaGrande(fakeFile('audio.m4a', big(), 'audio/mp4'))).toBe(true);
  });
  it('vídeo PEQUENO vai direto, sem botão (false)', () => {
    expect(G._genEhMidiaGrande(fakeFile('curto.mp4', small, 'video/mp4'))).toBe(false);
  });
  it('imagem grande NÃO é mídia (OCR não precisa de gesto) (false)', () => {
    expect(G._genEhMidiaGrande(fakeFile('foto.png', big(), 'image/png'))).toBe(false);
  });
  it('PDF grande NÃO é mídia (false)', () => {
    expect(G._genEhMidiaGrande(fakeFile('doc.pdf', big(), 'application/pdf'))).toBe(false);
  });
  it('sem arquivo → false (não quebra)', () => {
    expect(G._genEhMidiaGrande(null)).toBe(false);
  });
});

describe('withWakeLock', () => {
  it('executa a função e devolve o resultado mesmo sem a API de Wake Lock (jsdom)', async () => {
    let rodou = false;
    const r = await G.withWakeLock(async () => { rodou = true; return 42; });
    expect(rodou).toBe(true);
    expect(r).toBe(42);
  });
  it('libera o recurso e propaga erro da função', async () => {
    await expect(G.withWakeLock(async () => { throw new Error('falhou dentro'); })).rejects.toThrow('falhou dentro');
  });
});
