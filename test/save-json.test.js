// Fase 3 — confiabilidade: gravação resiliente a cota.
// Antes, saveJSON falhava em silêncio sob cota e o State divergia do persistido.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let C;
let originalSetItem;
beforeEach(() => {
  clearStorage();
  document.body.innerHTML = '<div id="toast-stack"></div>'; // toast() precisa do alvo
  C = loadModules(['core.js'], ['saveJSON']);
  originalSetItem = localStorage.setItem.bind(localStorage);
});
afterEach(() => { localStorage.setItem = originalSetItem; });

describe('saveJSON', () => {
  it('devolve true ao gravar com sucesso', () => {
    expect(C.saveJSON('agp.x', { a: 1 })).toBe(true);
    expect(localStorage.getItem('agp.x')).toBe('{"a":1}');
  });

  it('devolve false (sem lançar) quando o armazenamento estoura a cota', () => {
    localStorage.setItem = () => { const e = new Error('quota'); e.name = 'QuotaExceededError'; throw e; };
    expect(C.saveJSON('agp.x', { a: 1 })).toBe(false);
    // e avisa o usuário (toast renderizado no DOM)
    expect(document.querySelector('#toast-stack').children.length).toBeGreaterThan(0);
  });
});
