// Fase 4 — cartaz: geometria de enquadramento do export (cover + zoom + pan).
// Trava o contrato matemático que o flatten do PNG reproduz do preview.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let G;
beforeAll(() => {
  clearStorage();
  G = loadModules(['catalogs.js', 'core.js', 'posters.js'], ['posterCoverRect']);
});

describe('posterCoverRect', () => {
  // Célula quadrada 1080×1080, imagem larga 2000×1000 → cover pela altura.
  const W = 1080, H = 1080, iw = 2000, ih = 1000;

  it('cobre a célula no scale 1 (sem faixa transparente)', () => {
    const r = G.posterCoverRect(W, H, iw, ih, 1, 50, 50);
    expect(r.renderW).toBeGreaterThanOrEqual(W);
    expect(r.renderH).toBeGreaterThanOrEqual(H);
  });

  it('centraliza com pan 50/50', () => {
    const r = G.posterCoverRect(W, H, iw, ih, 1, 50, 50);
    expect(r.dx).toBeCloseTo((W - r.renderW) / 2, 5);
    expect(r.dy).toBeCloseTo((H - r.renderH) / 2, 5);
  });

  it('pan horizontal 0 alinha a borda esquerda; 100 alinha a direita', () => {
    const left = G.posterCoverRect(W, H, iw, ih, 1, 0, 50);
    const right = G.posterCoverRect(W, H, iw, ih, 1, 100, 50);
    expect(left.dx).toBeCloseTo(0, 5);                 // borda esquerda em x=0
    expect(right.dx).toBeCloseTo(W - right.renderW, 5); // borda direita em x=W
  });

  it('aumentar o scale aumenta o tamanho renderizado', () => {
    const a = G.posterCoverRect(W, H, iw, ih, 1, 50, 50);
    const b = G.posterCoverRect(W, H, iw, ih, 2, 50, 50);
    expect(b.renderW).toBeGreaterThan(a.renderW);
    expect(b.renderH).toBeGreaterThan(a.renderH);
  });

  it('limita o scale (clamp 0.05..3) — não estoura', () => {
    const huge = G.posterCoverRect(W, H, iw, ih, 999, 50, 50);
    const max = G.posterCoverRect(W, H, iw, ih, 3, 50, 50);
    expect(huge.renderW).toBeCloseTo(max.renderW, 5);
  });
});
