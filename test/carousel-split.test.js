// CARROSSEL AUTOMÁTICO — divisão da matéria em slides.
//
// A regressão que este arquivo tranca: o teto de 10 slides de corpo existe de
// propósito (carrossel de 40 telas não se publica), mas ele DESCARTAVA o texto
// que sobrava em silêncio absoluto. Medido no navegador: matéria de 60
// parágrafos perdia 40 deles — 66% do corpo — sem uma linha de aviso, e quem
// exportava só descobria contando os slides.
//
// A correção não mexe no teto; faz o número de blocos omitidos viajar até quem
// mostra a mensagem. E ele viaja numa propriedade NÃO-ENUMERÁVEL, porque o
// array de slides é serializado para o IndexedDB e percorrido em vários pontos:
// um índice extra visível viraria slide fantasma.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let C;
beforeAll(() => {
  clearStorage();
  C = loadModules(
    ['catalogs.js', 'core.js', 'posters.js', 'poster-templates.js', 'carousels.js'],
    ['splitIntoSlides', 'CAROUSEL_MAX_BODY_SLIDES']
  );
});

const portal = { name: 'Portal Exemplo', handle: '@portalexemplo' };

/** Matéria com `n` parágrafos de ~200 caracteres (2 por slide de corpo). */
function materia(n) {
  const paras = [];
  for (let i = 1; i <= n; i++) {
    paras.push(`Parágrafo ${i}: a Prefeitura de Camaçari informou que a etapa ${i} da obra ` +
      'consumiu recursos próprios e exigiu remanejamento de trânsito nas vias de acesso, ' +
      'segundo o boletim divulgado pela secretaria responsável naquela semana.');
  }
  return {
    title: 'Ponte do Joanes', subtitle: 'Obra de R$ 4,2 milhões',
    category: 'CIDADE', location: 'Camaçari, BA',
    body: paras.join('\n\n'), bodyParagraphs: paras, cta: '',
  };
}

const corpoDosSlides = (slides) => slides.map((s) => s.description || '').join('\n\n');

describe('estrutura do carrossel', () => {
  it('capa + corpo + fechamento, com a capa levando o título', () => {
    const s = C.splitIntoSlides(materia(4), portal, '1:1');
    expect(s.length).toBeGreaterThanOrEqual(3);
    expect(s[0].template).toBe('destaque-foto');
    expect(s[0].headline).toBe('Ponte do Joanes');
    expect(s[s.length - 1].template).toBe('cor-solida');
  });

  it('todo slide sai com algum texto — nenhum slide em branco', () => {
    const s = C.splitIntoSlides(materia(12), portal, '1:1');
    s.forEach((slide, i) => {
      const tem = (slide.headline || '').trim() || (slide.description || '').trim() || (slide.subtitle || '').trim();
      expect(!!tem, `slide ${i} (${slide.template}) sem texto`).toBe(true);
    });
  });

  it('matéria sem corpo ainda rende slides usáveis', () => {
    const s = C.splitIntoSlides(
      { title: 'Só título', subtitle: 'Só subtítulo', body: '', bodyParagraphs: [], category: '', location: '', cta: '' },
      portal, '1:1'
    );
    expect(s.length).toBeGreaterThanOrEqual(2);
    expect(s.every((x) => x && typeof x.template === 'string')).toBe(true);
  });
});

describe('teto de slides de corpo', () => {
  it('o teto é uma constante nomeada, não um 10 solto no meio do código', () => {
    expect(C.CAROUSEL_MAX_BODY_SLIDES).toBe(10);
  });

  it('matéria que cabe no teto não perde nada e não reporta omissão', () => {
    const art = materia(10);
    const s = C.splitIntoSlides(art, portal, '1:1');
    expect(s.slidesOmitidos).toBe(0);
    // cada parágrafo da origem aparece em algum slide
    const junto = corpoDosSlides(s);
    art.bodyParagraphs.forEach((p) => expect(junto).toContain(p.slice(0, 50)));
  });

  it('matéria longa respeita o teto E informa quantos blocos ficaram de fora', () => {
    const s = C.splitIntoSlides(materia(60), portal, '1:1');
    const corpo = s.filter((x) => x.template === 'texto');
    expect(corpo.length).toBe(C.CAROUSEL_MAX_BODY_SLIDES);
    // o número tem que ser real: 30 grupos couberam 10, sobraram 20
    expect(s.slidesOmitidos).toBeGreaterThan(0);
    expect(s.slidesOmitidos).toBe(30 - C.CAROUSEL_MAX_BODY_SLIDES);
  });

  it('a contagem cresce junto com a matéria (não é um flag fixo)', () => {
    const a = C.splitIntoSlides(materia(30), portal, '1:1').slidesOmitidos;
    const b = C.splitIntoSlides(materia(60), portal, '1:1').slidesOmitidos;
    expect(b).toBeGreaterThan(a);
  });
});

describe('slidesOmitidos não contamina os slides', () => {
  // Este bloco existe porque a correção mais óbvia (um campo normal no array)
  // criaria um slide fantasma em toda iteração e viajaria para o IndexedDB.
  const s = () => C.splitIntoSlides(materia(60), portal, '1:1');

  it('não aparece no JSON serializado', () => {
    expect(JSON.stringify(s())).not.toContain('slidesOmitidos');
  });

  it('não aparece em Object.keys nem muda o length', () => {
    const slides = s();
    expect(Object.keys(slides).every((k) => /^\d+$/.test(k))).toBe(true);
    expect(slides.length).toBe(C.CAROUSEL_MAX_BODY_SLIDES + 2); // capa + corpo + fecho
  });

  it('percorrer com map/forEach devolve só slides de verdade', () => {
    const slides = s();
    expect(slides.map((x) => x.template).filter(Boolean).length).toBe(slides.length);
    let n = 0;
    slides.forEach((x) => { expect(x && typeof x.template).toBe('string'); n++; });
    expect(n).toBe(slides.length);
  });
});
