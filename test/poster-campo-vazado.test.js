// CAMPO VAZADO — o slot de foto vira um buraco transparente no PNG.
//
// O cartaz deixa de ser a arte final e passa a ser uma MOLDURA: importado num
// editor de vídeo, o vídeo aparece exatamente onde estaria a foto, com título,
// faixas e formas continuando por cima.
//
// Já existiu um recurso parecido (r179) e foi revertido: lá era um MODO DE
// EXPORTAÇÃO que vazava o fundo inteiro. Aqui é uma propriedade do SLOT,
// escolhida ao compor e visível na tela. Estes testes travam essa diferença.
import { describe, it, expect, beforeAll } from 'vitest';
import { JSDOM } from 'jsdom';
import { loadModules, clearStorage } from './helpers/load.mjs';

let P;
const portal = {
  name: 'Portal Exemplo', acronym: 'PE', handle: '@portalexemplo',
  tagline: 'Notícias que conectam.', location: 'Salvador, BA', theme: 'municipios-bahia',
};

function makePoster(extra) {
  return Object.assign({
    id: 'x', template: 'manchete', format: '4:5',
    headline: 'Prefeitura entrega novas obras na capital baiana',
    category: 'CIDADES', location: 'Salvador, BA',
    subtitle: 'Investimento beneficia milhares de famílias',
    description: 'Um.\nDois.\nTrês.', figure: '47%', labelA: 'A', labelB: 'B',
    personName: 'Maria Silva', personRole: 'Prefeita',
    image1: null, image2: null, image3: null, image4: null,
    portalSnapshot: portal,
  }, extra || {});
}

beforeAll(() => {
  clearStorage();
  P = loadModules(['catalogs.js', 'core.js', 'posters.js', 'poster-templates.js'], [
    'POSTER_TEMPLATES', 'POSTER_FORMATS', 'POSTER_VAZADO_SRC', 'posterVazado',
    'posterEhSentinelaVazado', 'posterImageKeys', 'posterImageLayer',
    'posterCamadaVazada', 'posterTemVazado', 'applyTheme',
  ]);
  P.applyTheme('municipios-bahia');
});

describe('marcação do slot', () => {
  it('reconhece o slot marcado, e só ele', () => {
    const p = makePoster({ imagesVazadas: ['image2'] });
    expect(P.posterVazado(p, 'image2')).toBe(true);
    expect(P.posterVazado(p, 'image1')).toBe(false);
    expect(P.posterVazado({}, 'image1')).toBe(false);
    expect(P.posterVazado(null, 'image1')).toBe(false);
  });

  it('o pixel-sentinela é distinguível de uma foto de verdade', () => {
    // Ele existe só para os modelos que testam `p.imageN` direto; a interface
    // não pode mostrá-lo como se fosse a foto do usuário.
    expect(P.POSTER_VAZADO_SRC).toMatch(/^data:image\/png;base64,/);
    expect(P.posterEhSentinelaVazado(P.POSTER_VAZADO_SRC)).toBe(true);
    expect(P.posterEhSentinelaVazado('data:image/jpeg;base64,abc')).toBe(false);
    expect(P.posterEhSentinelaVazado(null)).toBe(false);
  });

  it('slot vazado conta como área de foto ocupada', () => {
    // Sem isso o modelo cairia no placeholder "adicione a imagem" e não haveria
    // buraco nenhum.
    const p = makePoster({ imagesVazadas: ['image1'] });
    expect(P.posterImageKeys(p)).toContain('image1');
  });

  it('slot desativado pelo olho não vira buraco, mesmo marcado', () => {
    const p = makePoster({ imagesVazadas: ['image1'], imagesOff: ['image1'] });
    expect(P.posterImageKeys(p)).not.toContain('image1');
    expect(P.posterTemVazado(p)).toBe(false);
  });

  it('posterTemVazado responde pelo cartaz inteiro', () => {
    expect(P.posterTemVazado(makePoster({ imagesVazadas: ['image1'] }))).toBe(true);
    expect(P.posterTemVazado(makePoster({ imagesVazadas: [] }))).toBe(false);
    expect(P.posterTemVazado(makePoster())).toBe(false);
  });
});

describe('a camada renderizada', () => {
  it('o slot vazado emite o marcador em vez da foto', () => {
    const p = makePoster({ imagesVazadas: ['image1'], image1: 'data:image/jpeg;base64,FOTO' });
    const html = P.posterImageLayer(p, 'image1');
    expect(html).toContain('data-vazado="image1"');
    expect(html).toContain('pt-vazado');
    expect(html).not.toContain('FOTO');       // a foto NÃO é desenhada
    expect(html).not.toContain('<img');
  });

  it('a foto do usuário não é apagada — só deixa de ser desenhada', () => {
    // Desmarcar tem de devolver a foto; por isso o valor continua no cartaz.
    const p = makePoster({ imagesVazadas: ['image1'], image1: 'data:image/jpeg;base64,FOTO' });
    expect(p.image1).toBe('data:image/jpeg;base64,FOTO');
    p.imagesVazadas = [];
    expect(P.posterImageLayer(p, 'image1')).toContain('FOTO');
  });

  it('slot normal segue exatamente como era', () => {
    const p = makePoster({ image1: 'data:image/jpeg;base64,FOTO' });
    const html = P.posterImageLayer(p, 'image1');
    expect(html).toContain('<img');
    expect(html).not.toContain('data-vazado');
    expect(P.posterImageLayer(makePoster(), 'image1')).toBe('');   // sem foto, sem nada
  });
});

describe('todos os modelos com área de foto aceitam o vazado', () => {
  const comFoto = () => Object.entries(P.POSTER_TEMPLATES).filter(([, t]) => t.usesImages);

  it('a biblioteca tem uma quantidade relevante de modelos com foto', () => {
    expect(comFoto().length).toBeGreaterThanOrEqual(35);
  });

  it('cada um emite o buraco quando o slot está marcado', () => {
    const fmt = P.POSTER_FORMATS['4:5'];
    const semBuraco = [];
    comFoto().forEach(([id, t]) => {
      const p = makePoster({
        template: id, imagesVazadas: ['image1'], image1: P.POSTER_VAZADO_SRC,
      });
      const html = t.render(p, fmt, portal);
      if (html.indexOf('data-vazado') === -1) semBuraco.push(id);
    });
    expect(semBuraco).toEqual([]);
  });

  it('sem a marca, nenhum modelo emite buraco — a biblioteca fica intacta', () => {
    const fmt = P.POSTER_FORMATS['4:5'];
    Object.entries(P.POSTER_TEMPLATES).forEach(([id, t]) => {
      const html = t.render(makePoster({ template: id, image1: 'data:image/png;base64,AAA' }), fmt, portal);
      expect(html.indexOf('data-vazado'), id).toBe(-1);
    });
  });

  it('o resto do desenho continua no cartaz — é isso que faz dele uma moldura', () => {
    // O buraco é só a área da foto: título, categoria e assinatura permanecem.
    const fmt = P.POSTER_FORMATS['4:5'];
    const p = makePoster({ template: 'destaque-foto', imagesVazadas: ['image1'], image1: P.POSTER_VAZADO_SRC });
    const html = P.POSTER_TEMPLATES['destaque-foto'].render(p, fmt, portal);
    const doc = new JSDOM(`<body>${html}</body>`).window.document;
    const txt = doc.body.textContent;
    expect(txt).toContain('Prefeitura entrega novas obras');
    expect(txt).toContain('CIDADES');
    expect(doc.querySelector('[data-vazado]')).toBeTruthy();
  });
});
