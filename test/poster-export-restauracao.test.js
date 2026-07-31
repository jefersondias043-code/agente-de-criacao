// O PREVIEW TEM QUE VOLTAR AO QUE ERA DEPOIS DE EXPORTAR.
//
// Para capturar, o export troca cada foto e cada logo por um canvas achatado e
// esconde o elemento original com `display:none`. No fim, restaurava o estilo
// com '' — o que NÃO é "volta ao que era": apaga a declaração inline.
//
// O wrapper devolvido por posterImageLayer nasce com `display:flex` inline.
// Depois de qualquer exportação ele virava `block` e ficava assim até o próximo
// render. Medido no navegador comparando o estilo computado de todo elemento do
// cartaz antes × depois: 9 de 10 modelos divergiam.
//
// Guardar o valor original e reaplicá-lo custa uma propriedade no snapshot.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const posters = readFileSync(join(raiz, 'src/posters.js'), 'utf8');
const templates = readFileSync(join(raiz, 'src/poster-templates.js'), 'utf8');

/** Corpo de uma função top-level, do `function nome` até a próxima em coluna 0. */
function corpo(fonte, nome) {
  const i = fonte.indexOf(`function ${nome}(`);
  if (i < 0) throw new Error(`função ${nome} não encontrada`);
  const resto = fonte.slice(i + 1);
  const j = resto.search(/\n(?:async )?function /);
  return resto.slice(0, j < 0 ? undefined : j);
}

describe('achatamento de imagem/logo restaura o display original', () => {
  const fn = corpo(posters, 'captureStageCanvas');

  it('o wrapper da foto realmente tem display inline a preservar', () => {
    // se este helper deixar de emitir `display:flex`, o teste abaixo perde o
    // sentido — e é aqui que se descobre, não em produção
    expect(corpo(templates, 'posterImageLayer')).toMatch(/display:flex/);
  });

  it('guarda o display de cada elemento escondido', () => {
    expect(fn).toMatch(/display: wrapEl\.style\.display/);
    expect(fn).toMatch(/display: logo\.style\.display/);
  });

  it('guarda ANTES de esconder (senão grava o "none")', () => {
    expect(fn.indexOf('display: wrapEl.style.display')).toBeLessThan(fn.indexOf("wrapEl.style.display = 'none'"));
    expect(fn.indexOf('display: logo.style.display')).toBeLessThan(fn.indexOf("logo.style.display = 'none'"));
  });

  it('reaplica o valor guardado, não ""', () => {
    expect(fn).toMatch(/s\.wrapEl\.style\.display = s\.display \|\| ''/);
  });

  it('a restauração roda no finally — vale também se o html2canvas estourar', () => {
    const i = fn.indexOf('} finally {');
    expect(i).toBeGreaterThan(-1);
    expect(fn.slice(i)).toMatch(/s\.wrapEl\.style\.display/);
  });
});
