// INTEGRIDADE DA EXPORTAÇÃO — duas regressões medidas no navegador real.
//
// 1) CARROSSEL INCOMPLETO EM SILÊNCIO
//    O laço de exportação fazia `if (canvas) files.push(...)`. Quando um slide
//    não desenhava, ele era simplesmente PULADO: o usuário pedia 11 imagens,
//    recebia 10, nada dizia qual faltou, e o carrossel ia para o ar com um
//    buraco. Só era considerado erro se NENHUM slide saísse.
//
// 2) ALVO SEM DIMENSÃO → ERRO ILEGÍVEL
//    Com o palco medindo 0×0, o html2canvas não devolve erro tratável: estoura
//    lá dentro com "addColorStop: The provided double value is non-finite",
//    porque a linha do gradiente mede zero e a parada vira NaN. Esse texto cru
//    chegava ao usuário como "Não foi possível exportar: Failed to execute
//    'addColorStop'…". Agora a dimensão é conferida antes e a função devolve
//    null — o contrato que os dois chamadores já sabem tratar.
//
// Os dois defeitos são de CONTRATO, então o teste lê o contrato no código: a
// verificação de comportamento ponta a ponta roda no navegador (html2canvas de
// verdade, palco de verdade), que o jsdom não reproduz.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const carousels = readFileSync(join(raiz, 'src/carousels.js'), 'utf8');
const posters = readFileSync(join(raiz, 'src/posters.js'), 'utf8');

/** Corpo de uma função top-level, do `function nome` até a próxima em coluna 0. */
function corpo(fonte, nome) {
  const i = fonte.indexOf(`function ${nome}(`);
  if (i < 0) throw new Error(`função ${nome} não encontrada`);
  const resto = fonte.slice(i + 1);
  const j = resto.search(/\n(?:async )?function /);
  return resto.slice(0, j < 0 ? undefined : j);
}

describe('exportação de carrossel não entrega conjunto incompleto em silêncio', () => {
  const fn = corpo(carousels, 'exportCarousel');

  it('registra os slides que não foram capturados', () => {
    expect(fn).toMatch(/naoCapturados/);
    // o else do `if (canvas)` precisa existir — era ali que o slide sumia
    expect(fn).toMatch(/else naoCapturados\.push/);
  });

  it('avisa o usuário quando o conjunto saiu incompleto', () => {
    const trecho = fn.slice(fn.indexOf('naoCapturados.length'));
    expect(trecho).toMatch(/toast\(/);
    expect(trecho).toMatch(/incompleto/i);
    // e diz QUAIS slides faltaram, não só quantos
    expect(trecho).toMatch(/naoCapturados\.join/);
  });

  it('o aviso é de erro, não um "info" que passa batido', () => {
    const i = fn.indexOf('naoCapturados.length');
    expect(fn.slice(i, i + 420)).toMatch(/'error'/);
  });

  it('continua tratando o caso em que NENHUM slide saiu', () => {
    expect(fn).toMatch(/if \(!files\.length\)/);
  });
});

describe('captureStageCanvas protege contra alvo sem dimensão', () => {
  const fn = corpo(posters, 'captureStageCanvas');

  it('mede o alvo antes de entregar ao html2canvas', () => {
    expect(fn).toMatch(/getBoundingClientRect\(\)/);
    expect(fn).toMatch(/width < 1 \|\| .*height < 1/);
  });

  it('devolve null (contrato conhecido dos chamadores), não lança', () => {
    const i = fn.indexOf('width < 1');
    const bloco = fn.slice(i, i + 320);
    expect(bloco).toMatch(/return null/);
    expect(bloco).not.toMatch(/throw/);
  });

  it('a guarda vem ANTES de preparar o palco (não deixa cover/exporting presos)', () => {
    expect(fn.indexOf('width < 1')).toBeLessThan(fn.indexOf('showStageCaptureCover()'));
  });

  it('deixa rastro no console para diagnóstico', () => {
    const i = fn.indexOf('width < 1');
    expect(fn.slice(i, i + 320)).toMatch(/console\.warn/);
  });
});
