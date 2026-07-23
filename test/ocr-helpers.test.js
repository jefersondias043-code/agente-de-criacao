// extract.js — heurísticas PURAS do OCR com pré-processamento (paridade AutoPost).
// O pipeline de imagem (canvas/Tesseract) depende do navegador; aqui cobrimos as
// decisões que escolhem quando refinar e qual resultado fica.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let E;
beforeAll(() => {
  clearStorage();
  E = loadModules(['catalogs.js', 'core.js', 'extract.js'], ['_ocrFraco', '_ocrMelhor']);
});

describe('_ocrFraco (resultado fraco → vale refinar)', () => {
  it('texto vazio é fraco', () => {
    expect(E._ocrFraco({ text: '', conf: 90 })).toBe(true);
  });
  it('pouquíssimo texto é fraco (mesmo com confiança alta)', () => {
    expect(E._ocrFraco({ text: 'abc', conf: 95 })).toBe(true);
  });
  it('baixa confiança é fraco (mesmo com bastante texto)', () => {
    expect(E._ocrFraco({ text: 'um texto razoavelmente longo aqui', conf: 40 })).toBe(true);
  });
  it('texto suficiente e confiança boa NÃO é fraco', () => {
    expect(E._ocrFraco({ text: 'um texto razoavelmente longo aqui', conf: 80 })).toBe(false);
  });
});

describe('_ocrMelhor (escolhe o melhor entre dois resultados)', () => {
  it('escolhe o que tem claramente mais texto', () => {
    const a = { text: 'pouco', conf: 90 };
    const b = { text: 'muito mais texto reconhecido aqui do que no outro', conf: 60 };
    expect(E._ocrMelhor(a, b)).toBe(b);
  });
  it('com quantidades de texto próximas, desempata pela confiança', () => {
    const a = { text: 'texto de exemplo', conf: 85 };
    const b = { text: 'texto de exemplo!', conf: 60 };  // diferença de tamanho ≤ 8 chars
    expect(E._ocrMelhor(a, b)).toBe(a);
  });
});
