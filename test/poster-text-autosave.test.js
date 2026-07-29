// AUTO-SAVE dos campos de texto do editor de cartazes.
//
// Regressão que este arquivo tranca: os campos da aba Texto só chamavam
// updatePreview(), que renderiza um objeto `draft` DESCARTÁVEL. O cartaz nunca
// era tocado, nada ia para o IndexedDB e toda edição manual se perdia ao sair
// do editor — enquanto modelo, formato, mosaico e visibilidade já salvavam.
//
// O bug era invisível em teste de unidade porque a gravação depende do wiring
// do editor; por isso a checagem aqui é sobre o CONTRATO do código: existe um
// ponto único de gravação, ele é alcançável de fora do closure, e os campos de
// texto estão ligados a ele.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const posters = readFileSync(join(raiz, 'src/posters.js'), 'utf8');

describe('ponto único de gravação', () => {
  it('existe e é publicado no escopo global', () => {
    expect(posters).toMatch(/let _posterCommitFields = null;/);
    expect(posters).toMatch(/_posterCommitFields = commitFields;/);
  });

  it('a exportação usa o ponto global, não a const de outro escopo', () => {
    // `applyEditorTo` é const dentro do render do editor: fora dali o
    // `typeof` dava 'undefined' e o "Salvar" não gravava nada, em silêncio.
    const foraDoEditor = posters.slice(posters.indexOf('function _savePosterProject'));
    expect(foraDoEditor).not.toMatch(/typeof applyEditorTo === 'function'/);
    expect(foraDoEditor).toMatch(/_posterCommitFields\(\{ flush: true \}\)/);
  });

  it('fechar o editor descarrega o que estiver na janela de espera', () => {
    const fechar = posters.slice(
      posters.indexOf('function closePosterEditor'),
      posters.indexOf('function renderPosters')
    );
    expect(fechar).toMatch(/_posterCommitFields\(\{ flush: true \}\)/);
    // e não deixa o closure apontando para o cartaz que saiu
    expect(fechar).toMatch(/_posterCommitFields = null/);
  });
});

describe('campos de texto ligados à gravação', () => {
  // A lista real de campos da aba Texto, como o editor a declara.
  const CAMPOS = ['p-headline', 'p-category', 'p-location', 'p-subtitle', 'p-description',
    'p-person-name', 'p-person-role', 'p-figure', 'p-label-a', 'p-label-b'];

  it('todos os campos da aba Texto continuam na lista de wiring', () => {
    const bloco = posters.slice(posters.indexOf('// AUTO-SAVE dos campos de texto.'));
    CAMPOS.forEach((id) => expect(bloco, id).toContain(`'${id}'`));
  });

  it('digitar grava, não só desenha o preview', () => {
    const bloco = posters.slice(posters.indexOf('// AUTO-SAVE dos campos de texto.'));
    expect(bloco).toMatch(/el\.oninput = \(\) => \{ commitFields\(\); updatePreview\(\); \};/);
  });

  it('sair do campo grava na hora (fecha a janela do debounce)', () => {
    const bloco = posters.slice(posters.indexOf('// AUTO-SAVE dos campos de texto.'));
    expect(bloco).toMatch(/el\.onblur = \(\) => commitFields\(\{ flush: true \}\)/);
  });

  it('os controles de encaixe do texto também gravam', () => {
    const bloco = posters.slice(posters.indexOf("['p-fit-headline', 'p-fit-subtitle']"));
    expect(bloco.slice(0, 500)).toMatch(/commitFields\(\)/);
    expect(bloco.slice(0, 500)).toMatch(/commitFields\(\{ flush: true \}\)/);
  });

  it('a escrita no IndexedDB é adiada, não feita a cada tecla', () => {
    const bloco = posters.slice(posters.indexOf('const commitFields ='), posters.indexOf('_posterCommitFields = commitFields;'));
    expect(bloco).toMatch(/setTimeout\(/);
    expect(bloco).toMatch(/savePosters\(\)/);
  });
});

describe('applyEditorTo cobre os campos que o editor mostra', () => {
  const bloco = posters.slice(posters.indexOf('const applyEditorTo = (t) =>'), posters.indexOf('// AUTO-SAVE dos campos de texto.'));
  const PARES = [
    ['headline', 'p-headline'], ['category', 'p-category'], ['location', 'p-location'],
    ['subtitle', 'p-subtitle'], ['description', 'p-description'], ['personName', 'p-person-name'],
    ['personRole', 'p-person-role'], ['figure', 'p-figure'], ['labelA', 'p-label-a'],
    ['labelB', 'p-label-b'], ['fitHeadline', 'p-fit-headline'], ['fitSubtitle', 'p-fit-subtitle'],
  ];
  PARES.forEach(([campo, id]) => {
    it(`grava ${campo} a partir de #${id}`, () => {
      expect(bloco).toContain(`#${id}`);
      expect(bloco).toMatch(new RegExp(`t\\.${campo}\\s*=`));
    });
  });

  it('é declarado ANTES de ser publicado (sem zona morta temporal)', () => {
    expect(posters.indexOf('const applyEditorTo = (t) =>'))
      .toBeLessThan(posters.indexOf('_posterCommitFields = commitFields;'));
  });
});
