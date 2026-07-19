// Editor visual pro — favoritos e banco de componentes.
// As funções com efeito de UI (renderPosters) são cobertas no smoke do navegador;
// aqui testamos o contrato de dados (round-trip de storage).
// (r109: "Composição (1 clique)" removida — redundante com os Temas unificados.)
import { describe, it, expect, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let E;
beforeEach(() => {
  clearStorage();
  E = loadModules(
    ['catalogs.js', 'core.js', 'posters.js', 'poster-templates.js', 'carousels.js', 'poster-elements.js', 'poster-editor-pro.js'],
    ['posterFavorites', 'posterComponents'],
  );
});

describe('favoritos e componentes (persistência)', () => {
  it('favoritos: round-trip pelo localStorage', () => {
    localStorage.setItem('agp.posterFavorites', JSON.stringify([{ id: 'f1', name: 'Oceano', theme: 'oceano', format: '1:1' }]));
    const favs = E.posterFavorites();
    expect(favs.length).toBe(1);
    expect(favs[0].theme).toBe('oceano');
  });

  it('componentes: round-trip pelo localStorage', () => {
    localStorage.setItem('agp.posterComponents', JSON.stringify([{ id: 'c1', name: 'Cabeçalho', elements: [{ type: 'badge' }, { type: 'line' }] }]));
    const comps = E.posterComponents();
    expect(comps.length).toBe(1);
    expect(comps[0].elements.length).toBe(2);
  });

  it('listas vazias por padrão', () => {
    expect(E.posterFavorites()).toEqual([]);
    expect(E.posterComponents()).toEqual([]);
  });
});
