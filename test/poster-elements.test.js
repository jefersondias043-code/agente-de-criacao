// Editor visual — modelo da camada de elementos livres (add/duplicar/ordenar/excluir).
// As funções de UI (render/interações) são no-op em jsdom (sem #p-stage), então
// testamos a lógica do modelo, que é o contrato persistido no cartaz.
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let E;
beforeEach(() => {
  clearStorage();
  E = loadModules(['catalogs.js', 'core.js', 'posters.js', 'poster-elements.js'], [
    'makePosterElement', 'addPosterElement', 'duplicatePosterElement',
    'deletePosterElement', 'reorderPosterElement', 'posterElements',
    'POSTER_BADGE_PRESETS', 'State',
  ]);
  E.State.posters = [{ id: 'p1', elements: [] }];
  E.State.activePosterId = 'p1';
});

const els = () => E.State.posters[0].elements;

describe('makePosterElement', () => {
  it('cria formas com defaults sensatos', () => {
    expect(E.makePosterElement('rect').type).toBe('rect');
    expect(E.makePosterElement('circle').radius).toBe(50);
    const badge = E.makePosterElement('badge', { text: 'AO VIVO', bg: '#E30613', fg: '#fff', dot: true });
    expect(badge.text).toBe('AO VIVO');
    expect(badge.color).toBe('#E30613');
    expect(badge.dot).toBe(true);
  });
});

describe('operações de elemento', () => {
  it('adiciona elementos ao cartaz ativo', () => {
    E.addPosterElement('rect');
    E.addPosterElement('badge', E.POSTER_BADGE_PRESETS[0]);
    expect(els().length).toBe(2);
    expect(els()[1].type).toBe('badge');
  });

  it('duplica preservando o tipo e deslocando a posição', () => {
    E.addPosterElement('circle');
    const id = els()[0].id;
    E.duplicatePosterElement(id);
    expect(els().length).toBe(2);
    expect(els()[1].id).not.toBe(id);
    expect(els()[1].type).toBe('circle');
    expect(els()[1].x).not.toBe(els()[0].x);
  });

  it('reordena: "front" leva ao topo (fim do array = camada da frente)', () => {
    E.addPosterElement('rect');   // [rect]
    E.addPosterElement('circle'); // [rect, circle]
    const rectId = els()[0].id;
    E.reorderPosterElement(rectId, 'front');
    expect(els()[els().length - 1].id).toBe(rectId);
  });

  it('exclui o elemento', () => {
    E.addPosterElement('line');
    const id = els()[0].id;
    E.deletePosterElement(id);
    expect(els().length).toBe(0);
  });
});
