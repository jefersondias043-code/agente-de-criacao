// SUBABAS do editor de cartaz — o segundo nível de navegação.
//
// O problema medido no celular (360×640): a aba "Texto" empilhava Modelo +
// Headline + Ajuste + Categoria + Localização + Subtítulo + Corpo numa coluna
// só. Com metade da tela para os controles, isso obrigava a rolar 70–142px em
// quase toda aba — e rolagem vertical é justamente o que sobra menos.
//
// A aba Estilo já resolvia com uma barra de pílulas horizontal; a correção
// promoveu essa mecânica a genérica. Este arquivo tranca as duas garantias que
// fizeram a coisa funcionar:
//   1) toda pílula tem sua sub-área e vice-versa (nada de pílula que não abre
//      nada, nem sub-área inalcançável);
//   2) disponibilidade é EXPLÍCITA (dataset.subOff) e não medida do layout —
//      medir escondia as grades de Modelo/Formato/Temas, que nascem vazias e
//      só são preenchidas quando a sub-aba abre.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');
const css = readFileSync(join(raiz, 'styles.css'), 'utf8');
const postersSrc = readFileSync(join(raiz, 'src/posters.js'), 'utf8');
const removedor = readFileSync(join(raiz, 'removedor.html'), 'utf8');

/** Painéis do editor e suas pílulas/sub-áreas, lidos do HTML real. */
function painelDe(grupo) {
  const i = html.indexOf(`<div class="pedit-panel" data-pgroup="${grupo}"`);
  if (i < 0) return null;
  // até o próximo painel (ou o fim do contêiner de painéis)
  const resto = html.slice(i + 10);
  const j = resto.search(/<div class="pedit-panel"|<\/div><!-- \/pedit-panels -->/);
  return resto.slice(0, j < 0 ? undefined : j);
}
const pilulas = (bloco) => [...bloco.matchAll(/<button[^>]*data-sub="([^"]+)"/g)].map((m) => m[1]);
const subareas = (bloco) => [...bloco.matchAll(/<div class="style-sub"[^>]*data-sub="([^"]+)"/g)].map((m) => m[1]);

describe('painéis que ganharam subabas', () => {
  // Texto e Imagens eram as pilhas longas; Estilo já tinha e não pode regredir.
  const casos = [
    ['content', ['titulo', 'subtitulo', 'rotulos', 'corpo', 'campos']],
    ['images', ['midias', 'camadas', 'ajustes']],
  ];

  casos.forEach(([grupo, esperadas]) => {
    it(`${grupo}: declara as subabas previstas`, () => {
      const bloco = painelDe(grupo);
      expect(bloco, `painel ${grupo} não encontrado`).toBeTruthy();
      expect(pilulas(bloco).sort()).toEqual([...esperadas].sort());
    });

    it(`${grupo}: cada pílula tem sua sub-área (e nenhuma sobra)`, () => {
      const bloco = painelDe(grupo);
      expect(subareas(bloco).sort()).toEqual(pilulas(bloco).sort());
    });
  });

  it('Estilo continua com as cinco subabas originais', () => {
    const bloco = painelDe('colors');
    expect(pilulas(bloco)).toEqual(['model', 'format', 'themes', 'manual', 'favorites']);
  });

  it('os campos de texto seguem existindo uma única vez cada', () => {
    // Reorganizar a marcação não pode ter duplicado nem perdido campo — os ids
    // são o contrato com o auto-save (ver poster-text-autosave.test.js).
    ['p-headline', 'p-subtitle', 'p-category', 'p-location', 'p-description',
      'p-person-name', 'p-person-role', 'p-figure', 'p-label-a', 'p-label-b',
      'p-fit-headline', 'p-fit-subtitle'].forEach((id) => {
      const n = html.split(`id="${id}"`).length - 1;
      expect(n, `#${id} aparece ${n}×`).toBe(1);
    });
  });
});

describe('controlador genérico', () => {
  it('existe e é chamado no setup do editor', () => {
    expect(postersSrc).toMatch(/function setupPanelSubnavs\(/);
    expect(postersSrc).toMatch(/function activatePanelSub\(/);
    expect(postersSrc).toMatch(/setupStyleSubnav\(\)\s*\{\s*setupPanelSubnavs\(\);\s*\}/);
  });

  it('a disponibilidade é explícita, não medida do layout', () => {
    const i = postersSrc.indexOf('function activatePanelSub(');
    const corpo = postersSrc.slice(i, i + 1600);
    expect(corpo).toMatch(/dataset\.subOff/);
    // medir visibilidade foi a tentativa que escondeu as grades preguiçosas
    expect(corpo).not.toMatch(/offsetParent/);
    expect(corpo).not.toMatch(/getClientRects/);
  });

  it('a sub-aba ativa é lembrada por grupo', () => {
    expect(postersSrc).toMatch(/_pSubByGroup/);
    const i = postersSrc.indexOf('function activatePanelSub(');
    expect(postersSrc.slice(i, i + 1600)).toMatch(/_pSubByGroup\[group\] = key/);
  });

  it('"Campos" só existe nos modelos que têm campo dedicado', () => {
    const i = postersSrc.indexOf('const updateExtraFields');
    const corpo = postersSrc.slice(i, i + 1200);
    expect(corpo).toMatch(/data-sub="campos"/);
    expect(corpo).toMatch(/subOff = \(person \|\| figure \|\| labels\) \? '0' : '1'/);
  });
});

describe('activatePanelSub em execução', () => {
  let P;
  beforeAll(() => {
    clearStorage();
    P = loadModules(['catalogs.js', 'core.js', 'posters.js', 'poster-templates.js'],
      ['activatePanelSub', 'setupPanelSubnavs', '_pSubByGroup']);
  });

  beforeEach(() => {
    document.body.innerHTML = `
      <div id="toast-stack"></div>
      <div class="pedit-panel" data-pgroup="content">
        <div class="style-subnav">
          <button data-sub="a"></button><button data-sub="b"></button><button data-sub="c"></button>
        </div>
        <div class="style-sub" data-sub="a"></div>
        <div class="style-sub" data-sub="b"></div>
        <div class="style-sub" data-sub="c" data-sub-off="1"></div>
      </div>`;
  });

  const pil = (s) => document.querySelector(`.style-subnav button[data-sub="${s}"]`);
  const sub = (s) => document.querySelector(`.style-sub[data-sub="${s}"]`);

  it('ativa exatamente uma sub-área por vez', () => {
    P.activatePanelSub('content', 'b');
    expect(sub('b').classList.contains('active')).toBe(true);
    expect(sub('a').classList.contains('active')).toBe(false);
    expect(document.querySelectorAll('.style-sub.active').length).toBe(1);
  });

  it('a pílula ativa acompanha a sub-área', () => {
    P.activatePanelSub('content', 'b');
    expect(pil('b').classList.contains('active')).toBe(true);
    expect(pil('a').classList.contains('active')).toBe(false);
  });

  it('esconde a pílula da sub-área marcada como indisponível', () => {
    P.activatePanelSub('content', 'a');
    expect(pil('c').hidden).toBe(true);
    expect(pil('a').hidden).toBe(false);
  });

  it('pedir uma sub-aba indisponível cai na primeira disponível', () => {
    P.activatePanelSub('content', 'c');
    expect(sub('c').classList.contains('active')).toBe(false);
    expect(sub('a').classList.contains('active')).toBe(true);
  });

  it('a sub-aba escolhida fica lembrada para o grupo', () => {
    P.activatePanelSub('content', 'b');
    expect(P._pSubByGroup.content).toBe('b');
  });

  it('uma sub-área que volta a ficar disponível reaparece', () => {
    P.activatePanelSub('content', 'a');
    expect(pil('c').hidden).toBe(true);
    sub('c').dataset.subOff = '0';
    P.activatePanelSub('content', 'c');
    expect(pil('c').hidden).toBe(false);
    expect(sub('c').classList.contains('active')).toBe(true);
  });

  it('painel sem subnav não quebra', () => {
    document.body.innerHTML = '<div class="pedit-panel" data-pgroup="x"></div>';
    expect(() => P.activatePanelSub('x', 'a')).not.toThrow();
  });

  it('setupPanelSubnavs liga o clique das pílulas', () => {
    P.setupPanelSubnavs();
    pil('b').onclick();
    expect(sub('b').classList.contains('active')).toBe(true);
  });
});

describe('metade da tela para os controles', () => {
  it('o painel do editor abre em 50dvh, inclusive em telas baixas', () => {
    // 44dvh deixava os controles com ~36% da tela num aparelho de 640px.
    const i = css.indexOf('#p-editor.sheet-open > .pedit-panels {');
    expect(css.slice(i, i + 500)).toMatch(/height: var\(--pe-panel-h, 50dvh\)/);
    const j = css.indexOf('@media (max-width: 900px) and (max-height: 700px)');
    expect(css.slice(j, j + 320)).toMatch(/--pe-panel-h, 50dvh/);
  });

  it('nenhuma regra zera o min-height do textarea globalmente', () => {
    // O min-height de 120px existe para a pauta do Gerar; zerá-lo sem escopo
    // encolheria a caixa onde o usuário cola a matéria inteira. Toda regra que
    // zera precisa estar presa a algum seletor do editor de cartaz.
    const escopos = ['#p-editor', '.pe-textarea', '#p-elements-ui', '#p-'];
    const regras = css.split('\n').filter((l) => /\.textarea[^{]*\{[^}]*min-height:\s*0/.test(l));
    expect(regras.length).toBeGreaterThan(0);
    regras.forEach((l) => {
      expect(escopos.some((e) => l.includes(e)), `regra sem escopo de cartaz: ${l.trim()}`).toBe(true);
    });
  });

  it('o Removedor abre com metade para os controles em telas baixas', () => {
    expect(removedor).toMatch(/const padrao = \(window\.innerHeight \|\| 800\) <= 700 \? 40 : 46;/);
    expect(removedor).toMatch(/@media \(max-height: 700px\)/);
  });
});
