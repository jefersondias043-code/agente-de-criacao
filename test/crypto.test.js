// Fase 1 — segurança: módulo de cripto compartilhado (AES-GCM + PBKDF2).
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules } from './helpers/load.mjs';

let C;
beforeAll(() => {
  C = loadModules(['crypto.js'], [
    'cryptoAvailable', 'cryptoEncryptString', 'cryptoDecryptString', 'CRYPTO_PBKDF2_ITERATIONS',
  ]);
});

describe('crypto.js', () => {
  it('WebCrypto disponível no ambiente de teste', () => {
    expect(C.cryptoAvailable()).toBe(true);
    expect(C.CRYPTO_PBKDF2_ITERATIONS).toBe(150000);
  });

  it('round-trip: cifra e decifra de volta ao texto original', async () => {
    const secret = JSON.stringify({ groq: 'gsk_abc', openai: 'sk-xyz', anthropic: '' });
    const payload = await C.cryptoEncryptString(secret, 'senha-forte');
    expect(payload).not.toContain('gsk_abc'); // não vaza o segredo
    const back = await C.cryptoDecryptString(payload, 'senha-forte');
    expect(back).toBe(secret);
  });

  it('senha errada falha ao decifrar', async () => {
    const payload = await C.cryptoEncryptString('segredo', 'certa');
    await expect(C.cryptoDecryptString(payload, 'errada')).rejects.toThrow();
  });

  it('payload tem o formato {s,i,c} em base64 (compatível com o Detector)', async () => {
    const payload = await C.cryptoEncryptString('x', 'p');
    const obj = JSON.parse(payload);
    expect(obj).toHaveProperty('s');
    expect(obj).toHaveProperty('i');
    expect(obj).toHaveProperty('c');
    // base64 válido (atob não lança)
    expect(() => atob(obj.s)).not.toThrow();
    expect(() => atob(obj.i)).not.toThrow();
    expect(() => atob(obj.c)).not.toThrow();
  });

  it('cada cifragem usa salt/iv novos (ciphertexts diferentes p/ mesmo texto)', async () => {
    const a = await C.cryptoEncryptString('mesmo', 'p');
    const b = await C.cryptoEncryptString('mesmo', 'p');
    expect(a).not.toBe(b);
  });
});
