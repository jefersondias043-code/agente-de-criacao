// Bibliotecas de CDN (html2canvas, pdf.js, mammoth, Tesseract): quando o CDN
// está bloqueado, o recurso precisa AVISAR em vez de estourar ReferenceError e
// deixar o botão morto. Estes testes travam esse contrato.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let C;
beforeEach(() => {
  clearStorage();
  document.head.innerHTML = '';
  C = loadModules(['catalogs.js', 'core.js'], ['ensureLib', 'libReady', 'libUnavailableMsg', 'EXTERNAL_LIBS']);
});
afterEach(() => {
  ['html2canvas', 'pdfjsLib', 'mammoth', 'Tesseract'].forEach((g) => { delete globalThis[g]; });
});

describe('catálogo de bibliotecas externas', () => {
  it('cobre as quatro que o app carrega por CDN', () => {
    expect(Object.keys(C.EXTERNAL_LIBS).sort()).toEqual(['Tesseract', 'html2canvas', 'mammoth', 'pdfjsLib']);
  });

  it('cada entrada traz URL, hash de integridade e rótulo em português', () => {
    for (const [chave, spec] of Object.entries(C.EXTERNAL_LIBS)) {
      expect(spec.url, chave).toMatch(/^https:\/\//);
      expect(spec.sri, chave).toMatch(/^sha384-/);      // SRI preservado: CDN comprometido não passa
      expect(spec.label, chave).toBeTruthy();
      expect(spec.global, chave).toBeTruthy();
    }
  });
});

describe('libReady', () => {
  it('é falso quando a biblioteca não carregou', () => {
    expect(C.libReady('html2canvas')).toBe(false);
  });

  it('é verdadeiro quando o global existe', () => {
    globalThis.html2canvas = () => {};
    expect(C.libReady('html2canvas')).toBe(true);
  });

  it('não quebra com uma chave desconhecida', () => {
    expect(C.libReady('naoExiste')).toBe(false);
  });
});

describe('ensureLib', () => {
  it('resolve na hora quando a biblioteca já está presente', async () => {
    globalThis.mammoth = {};
    await expect(C.ensureLib('mammoth')).resolves.toBe(true);
    expect(document.head.querySelectorAll('script').length).toBe(0);   // não recarrega à toa
  });

  it('tenta recarregar do CDN, com o mesmo SRI, quando falta', async () => {
    const p = C.ensureLib('html2canvas');
    const s = document.head.querySelector('script');
    expect(s).toBeTruthy();
    expect(s.getAttribute('integrity')).toBe(C.EXTERNAL_LIBS.html2canvas.sri);
    expect(s.crossOrigin).toBe('anonymous');
    s.onerror();                                   // CDN bloqueado
    await expect(p).resolves.toBe(false);
  });

  it('devolve true se a recarga trouxer a biblioteca', async () => {
    const p = C.ensureLib('Tesseract');
    const s = document.head.querySelector('script');
    globalThis.Tesseract = {};
    s.onload();
    await expect(p).resolves.toBe(true);
  });

  it('uma falha não bloqueia tentativas futuras (a rede pode voltar)', async () => {
    const p1 = C.ensureLib('pdfjsLib');
    document.head.querySelector('script').onerror();
    await expect(p1).resolves.toBe(false);
    document.head.innerHTML = '';
    C.ensureLib('pdfjsLib');                        // segunda chance
    expect(document.head.querySelector('script')).toBeTruthy();
  });

  it('chave desconhecida resolve como indisponível, sem lançar', async () => {
    await expect(C.ensureLib('naoExiste')).resolves.toBe(false);
  });
});

describe('libUnavailableMsg', () => {
  it('nomeia o recurso afetado em vez de mostrar um erro técnico', () => {
    const m = C.libUnavailableMsg('html2canvas');
    expect(m).toContain('exportação de imagens');
    expect(m).not.toMatch(/ReferenceError|undefined|html2canvas/);
  });
});
