// ingest.js — orquestrador de transcrição. Cobre o ROTEAMENTO (arquivo pequeno
// vai direto à Groq; sem chave falha antes da rede) e o tratamento de status da
// API. A compressão de arquivos grandes usa Web Audio (coberta por sonda no
// navegador), então aqui exercitamos só o caminho direto, com fetch stubado.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let I;
beforeEach(() => {
  clearStorage();
  I = loadModules(
    ['catalogs.js', 'core.js', 'media-transcode.js', 'ingest.js'],
    ['transcribeMedia', 'transcribeMediaDirect', 'State', 'WHISPER_SAFE_BYTES']
  );
});

function fakeFile(sizeBytes, name = 'audio.mp3') {
  // Blob leve com .size forjado (não alocamos os bytes de verdade).
  const f = new Blob(['x'], { type: 'audio/mpeg' });
  Object.defineProperty(f, 'size', { value: sizeBytes });
  Object.defineProperty(f, 'name', { value: name });
  return f;
}
function okResponse(text) {
  return { ok: true, status: 200, headers: { get: () => null }, json: async () => ({ text }), text: async () => text };
}
function errResponse(status) {
  return { ok: false, status, headers: { get: () => null }, json: async () => ({}), text: async () => '' };
}

describe('transcribeMedia — roteamento', () => {
  it('sem chave da Groq: falha antes de qualquer rede', async () => {
    I.State.apiKeys.groq = '';
    const spy = vi.fn();
    globalThis.fetch = spy;
    await expect(I.transcribeMedia(fakeFile(1000))).rejects.toThrow(/chave de API da Groq/i);
    expect(spy).not.toHaveBeenCalled();
  });

  it('arquivo pequeno vai DIRETO à Groq e devolve o texto', async () => {
    I.State.apiKeys.groq = 'gsk_teste';
    const spy = vi.fn(async () => okResponse('olá mundo transcrito'));
    globalThis.fetch = spy;
    const txt = await I.transcribeMedia(fakeFile(2 * 1024 * 1024)); // 2 MB ≤ seguro
    expect(txt).toBe('olá mundo transcrito');
    expect(spy).toHaveBeenCalledTimes(1);
    // envia ao endpoint de transcrição da Groq
    expect(spy.mock.calls[0][0]).toMatch(/api\.groq\.com.*transcriptions/);
  });

  it('401 → erro de chave inválida (mensagem clara)', async () => {
    I.State.apiKeys.groq = 'gsk_ruim';
    globalThis.fetch = vi.fn(async () => errResponse(401));
    await expect(I.transcribeMedia(fakeFile(1024))).rejects.toThrow(/inválida ou expirou/i);
  });

  it('resposta sem fala → erro amigável', async () => {
    I.State.apiKeys.groq = 'gsk_teste';
    globalThis.fetch = vi.fn(async () => okResponse('   '));
    await expect(I.transcribeMedia(fakeFile(1024))).rejects.toThrow(/Não encontramos fala/i);
  });
});

describe('transcribeMediaDirect — guarda de tamanho', () => {
  it('rejeita parte acima de 25 MB (a API não aceita)', async () => {
    I.State.apiKeys.groq = 'gsk_teste';
    globalThis.fetch = vi.fn();
    await expect(I.transcribeMediaDirect(fakeFile(30 * 1024 * 1024))).rejects.toThrow(/muito longo|trecho menor/i);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });
});
