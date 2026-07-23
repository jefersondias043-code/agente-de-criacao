// toolFrameSrc — cache-buster de versão para os iframes das ferramentas.
// Garante que, a cada release (data-build muda), o iframe busque o HTML novo
// em vez de servir a versão antiga do cache.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let C;
beforeEach(() => {
  clearStorage();
  document.body.innerHTML = '';
  C = loadModules(['catalogs.js', 'core.js'], ['toolFrameSrc']);
});

describe('toolFrameSrc', () => {
  it('anexa ?v=<build> quando há data-build no DOM', () => {
    document.body.innerHTML = '<div data-build="2026-07-23-r131"></div>';
    expect(C.toolFrameSrc('detector-flop.html')).toBe('detector-flop.html?v=2026-07-23-r131');
  });

  it('escapa o valor da versão', () => {
    document.body.innerHTML = '<div data-build="a b&c"></div>';
    expect(C.toolFrameSrc('x.html')).toBe('x.html?v=a%20b%26c');
  });

  it('devolve o arquivo sem query quando não há data-build (degrada sem quebrar)', () => {
    expect(C.toolFrameSrc('replicador.html')).toBe('replicador.html');
  });
});
