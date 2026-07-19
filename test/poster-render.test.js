// Fase 0 — rede de segurança: render headless de TODOS os modelos de cartaz.
// Superfície enorme (33 modelos × 4 formatos) e hoje sem nenhum teste: um
// template que quebre em um formato/tema fica invisível até um usuário esbarrar.
// Cada modelo retorna string HTML com nó raiz .poster-1440 (contrato do catálogo).
// (São 32 modelos no catálogo atual.)
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let P;
const portal = {
  name: 'Municípios Bahia', acronym: 'MB', handle: '@municipiosbahia',
  tagline: 'Notícias que conectam.', location: 'Salvador, BA', theme: 'municipios-bahia',
};

// Cartaz com TODOS os campos preenchidos — exercita o máximo de caminhos de cada
// modelo (dado em destaque, rótulos A/B, pessoa, tópicos por linha, etc.).
function makePoster(template, format) {
  return {
    id: 'test-' + template, template, format,
    headline: 'Prefeitura entrega novas obras na capital baiana',
    category: 'CIDADES', location: 'Salvador, BA',
    subtitle: 'Investimento beneficia milhares de famílias em toda a região metropolitana',
    description: 'Primeira linha do corpo do texto.\nSegunda linha com mais detalhes.\nTerceira linha para virar tópico.',
    figure: '47%', labelA: 'Antes', labelB: 'Depois',
    personName: 'Maria Silva', personRole: 'Prefeita de Salvador',
    footer: '',
    image1: null, image2: null, image3: null, image4: null, avatar: null,
    image1PosX: 50, image1PosY: 50, image1Scale: 1,
    image2PosX: 50, image2PosY: 50, image2Scale: 1,
    image3PosX: 50, image3PosY: 50, image3Scale: 1,
    image4PosX: 50, image4PosY: 50, image4Scale: 1,
    portalSnapshot: portal,
    _idx: 1, _total: 5,
  };
}

beforeAll(() => {
  clearStorage();
  P = loadModules(['catalogs.js', 'core.js', 'posters.js', 'poster-templates.js'], [
    'POSTER_TEMPLATES', 'POSTER_FORMATS', 'applyTheme', 'PT_THEMES',
  ]);
});

describe('render de todos os modelos × formatos', () => {
  it('o catálogo tem os 32 modelos e 4 formatos esperados', () => {
    expect(Object.keys(P.POSTER_TEMPLATES).length).toBe(32);
    expect(Object.keys(P.POSTER_FORMATS)).toEqual(['3:4', '4:5', '1:1', '9:16']);
  });

  it('renderiza sem lançar e produz nó .poster-1440', () => {
    const templateIds = Object.keys(P.POSTER_TEMPLATES);
    const formatKeys = Object.keys(P.POSTER_FORMATS);
    const falhas = [];
    for (const id of templateIds) {
      for (const fk of formatKeys) {
        P.applyTheme(portal.theme);
        let html;
        try {
          html = P.POSTER_TEMPLATES[id].render(makePoster(id, fk), P.POSTER_FORMATS[fk], portal);
        } catch (e) {
          falhas.push(`${id} @ ${fk}: lançou ${e.message}`);
          continue;
        }
        if (typeof html !== 'string' || !html.trim()) { falhas.push(`${id} @ ${fk}: HTML vazio`); continue; }
        const div = document.createElement('div');
        div.innerHTML = html;
        if (!div.querySelector('.poster-1440')) falhas.push(`${id} @ ${fk}: sem nó .poster-1440`);
      }
    }
    expect(falhas).toEqual([]);
  });
});

describe('render de um modelo em todos os temas', () => {
  it('manchete renderiza em todos os 16 temas sem lançar', () => {
    const falhas = [];
    for (const themeId of Object.keys(P.PT_THEMES)) {
      P.applyTheme(themeId);
      try {
        const html = P.POSTER_TEMPLATES.manchete.render(
          makePoster('manchete', '3:4'), P.POSTER_FORMATS['3:4'], { ...portal, theme: themeId });
        const div = document.createElement('div');
        div.innerHTML = html;
        if (!div.querySelector('.poster-1440')) falhas.push(`${themeId}: sem .poster-1440`);
      } catch (e) { falhas.push(`${themeId}: ${e.message}`); }
    }
    expect(falhas).toEqual([]);
  });
});
