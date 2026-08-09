// Rede de segurança: render headless de TODOS os modelos de cartaz.
// A superfície é enorme (catálogo × 4 formatos) e um template que quebre em um
// formato/tema fica invisível até um usuário esbarrar nele.
// Cada modelo retorna string HTML com nó raiz .poster-1440 (contrato do catálogo).
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let P;
const portal = {
  name: 'Portal Exemplo', acronym: 'PE', handle: '@portalexemplo',
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
    'POSTER_TEMPLATES', 'POSTER_CATEGORIES', 'POSTER_FORMATS', 'applyTheme', 'PT_THEMES',
  ]);
});

describe('render de todos os modelos × formatos', () => {
  // Fixar o NÚMERO exato de modelos travava a biblioteca: crescer o acervo
  // (que é justamente o objetivo) quebrava o teste sem nada estar errado. O que
  // vale proteger é o contrato — piso de variedade e entradas bem formadas.
  it('a biblioteca tem variedade e os formatos esperados', () => {
    expect(Object.keys(P.POSTER_TEMPLATES).length).toBeGreaterThanOrEqual(55);
    // 16:9 entrou com as capas de vídeo (r199) e é o ÚNICO deitado — todos os
    // outros são retrato ou quadrado.
    expect(Object.keys(P.POSTER_FORMATS)).toEqual(['3:4', '4:5', '1:1', '9:16', '16:9']);
    const deitados = Object.entries(P.POSTER_FORMATS).filter(([, f]) => f.w > f.h);
    expect(deitados.map(([k]) => k)).toEqual(['16:9']);
  });

  it('todo modelo declara rótulo, categoria válida e render', () => {
    const validas = new Set(P.POSTER_CATEGORIES.map((c) => c.id));
    const problemas = [];
    for (const [id, t] of Object.entries(P.POSTER_TEMPLATES)) {
      if (!t.label) problemas.push(id + ': sem label');
      if (typeof t.render !== 'function') problemas.push(id + ': sem render');
      if (!t.cat) problemas.push(id + ': sem categoria');
      else if (t.cat === 'todos' || !validas.has(t.cat)) problemas.push(id + ': categoria inválida (' + t.cat + ')');
    }
    expect(problemas).toEqual([]);
  });

  // Uma aba com um único modelo é pior que não ter aba: o usuário paga o clique
  // da navegação para não ganhar escolha nenhuma. Piso de 2 por categoria.
  it('nenhuma categoria anunciada fica vazia ou com um só modelo', () => {
    const conta = {};
    Object.values(P.POSTER_TEMPLATES).forEach((t) => { conta[t.cat] = (conta[t.cat] || 0) + 1; });
    const rasas = P.POSTER_CATEGORIES
      .filter((c) => c.id !== 'todos' && (conta[c.id] || 0) < 2)
      .map((c) => `${c.id} (${conta[c.id] || 0})`);
    expect(rasas).toEqual([]);
  });

  it('rótulos não se repetem (o usuário escolhe pelo nome)', () => {
    const labels = Object.values(P.POSTER_TEMPLATES).map((t) => t.label);
    expect(labels.length).toBe(new Set(labels).size);
  });

  // Dois cenários por modelo: SEM foto (placeholder/ramo ausente) e COM as 4
  // fotos. Vários modelos trocam de composição conforme a imagem existe — o
  // caminho não exercitado é justo o que quebra em produção.
  const varrer = (mutar) => {
    const falhas = [];
    for (const id of Object.keys(P.POSTER_TEMPLATES)) {
      for (const fk of Object.keys(P.POSTER_FORMATS)) {
        P.applyTheme(portal.theme);
        let html;
        try {
          html = P.POSTER_TEMPLATES[id].render(mutar(makePoster(id, fk)), P.POSTER_FORMATS[fk], portal);
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
    return falhas;
  };

  it('renderiza sem lançar e produz nó .poster-1440 (sem fotos)', () => {
    expect(varrer((p) => p)).toEqual([]);
  });

  it('renderiza sem lançar e produz nó .poster-1440 (com as 4 fotos)', () => {
    const PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';
    expect(varrer((p) => Object.assign(p, {
      image1: PX, image2: PX, image3: PX, image4: PX, avatar: PX,
    }))).toEqual([]);
  });

  // Campos vazios são o estado de um cartaz recém-criado: nenhum modelo pode
  // depender de texto para existir.
  it('renderiza com todos os campos de texto vazios', () => {
    expect(varrer((p) => Object.assign(p, {
      headline: '', subtitle: '', description: '', category: '', location: '',
      figure: '', labelA: '', labelB: '', personName: '', personRole: '',
    }))).toEqual([]);
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
