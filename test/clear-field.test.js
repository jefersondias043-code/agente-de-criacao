// BOTÃO LIMPAR (×) NOS CAMPOS DE CONTEÚDO
//
// Começar um conteúdo novo exigia apagar o anterior à mão, caractere por
// caractere. O × devolve o campo vazio num toque.
//
// A decisão que estes testes protegem é a de NÃO marcar campo por campo: a
// plataforma cria campos em tempo de execução (elenco da Narrativa, textos do
// editor de cartaz, edição do pacote no AutoPost). Uma marcação manual cobriria
// só o que está escrito no HTML e envelheceria — cada campo novo nasceria sem o
// botão. A regra é do TIPO de campo, com um observador para o que vier depois.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const ler = (p) => readFileSync(join(raiz, p), 'utf8');

let C;
beforeAll(() => {
  // O módulo se inicializa sozinho ao carregar; no jsdom isso já vale.
  (0, eval)(ler('src/clear-field.js')
    + '\n;globalThis.__CF__ = { clearFieldWire, clearFieldWireAll, clearFieldElegivel, CLEAR_SELETOR };');
  C = globalThis.__CF__;
});

beforeEach(() => { document.body.innerHTML = ''; });

const campo = (html) => {
  document.body.innerHTML = `<div class="field">${html}</div>`;
  return document.body.querySelector('textarea, input');
};

describe('quais campos ganham o botão', () => {
  it('caixa de texto ganha', () => {
    const el = campo('<textarea></textarea>');
    C.clearFieldWire(el);
    expect(el.closest('.clearable')).toBeTruthy();
    expect(el.closest('.clearable').querySelector('.field-clear')).toBeTruthy();
  });

  it('campo de uma linha ganha, e é marcado como tal', () => {
    const el = campo('<input type="text" />');
    C.clearFieldWire(el);
    expect(el.closest('.clearable').classList.contains('clearable-inline')).toBe(true);
  });

  it('campo desabilitado ou somente-leitura não ganha', () => {
    expect(C.clearFieldElegivel(campo('<textarea disabled></textarea>'))).toBe(false);
    expect(C.clearFieldElegivel(campo('<textarea readonly></textarea>'))).toBe(false);
  });

  it('opt-out vale no campo e na tela inteira', () => {
    expect(C.clearFieldElegivel(campo('<textarea data-no-clear></textarea>'))).toBe(false);
    document.body.innerHTML = '<div data-no-clear><textarea id="x"></textarea></div>';
    expect(C.clearFieldElegivel(document.getElementById('x'))).toBe(false);
  });

  it('campo fora da vista não ganha — o botão nem seria clicável', () => {
    document.body.innerHTML = '<div hidden><textarea id="y"></textarea></div>';
    expect(C.clearFieldElegivel(document.getElementById('y'))).toBe(false);
  });

  it('não liga duas vezes no mesmo campo', () => {
    const el = campo('<textarea></textarea>');
    C.clearFieldWire(el);
    C.clearFieldWire(el);
    expect(el.closest('.clearable').querySelectorAll('.field-clear').length).toBe(1);
  });

  it('o seletor cobre os tipos de entrada de conteúdo', () => {
    ['textarea', 'input[type="text"]', 'input[type="search"]', 'input[type="url"]']
      .forEach((t) => expect(C.CLEAR_SELETOR, t).toContain(t));
  });
});

describe('o que o clique faz', () => {
  it('esvazia o campo', () => {
    const el = campo('<textarea>conteúdo antigo</textarea>');
    el.value = 'conteúdo antigo';
    C.clearFieldWire(el);
    el.closest('.clearable').querySelector('.field-clear').click();
    expect(el.value).toBe('');
  });

  it('avisa quem escuta — senão o campo fica vazio na tela e cheio na memória', () => {
    // Contador de caracteres, autosave de rascunho, diagnóstico da Narrativa e
    // estado do cartaz reagem a `input`/`change`.
    const el = campo('<textarea></textarea>');
    el.value = 'algo';
    C.clearFieldWire(el);
    const vistos = [];
    el.addEventListener('input', () => vistos.push('input:' + el.value));
    el.addEventListener('change', () => vistos.push('change:' + el.value));
    el.closest('.clearable').querySelector('.field-clear').click();
    expect(vistos).toEqual(['input:', 'change:']);
  });

  it('devolve o foco para quem vai digitar agora', () => {
    const el = campo('<textarea></textarea>');
    el.value = 'algo';
    C.clearFieldWire(el);
    el.closest('.clearable').querySelector('.field-clear').click();
    expect(document.activeElement).toBe(el);
  });

  it('em campo vazio não faz nada nem dispara evento', () => {
    const el = campo('<textarea></textarea>');
    C.clearFieldWire(el);
    let n = 0;
    el.addEventListener('input', () => n++);
    el.closest('.clearable').querySelector('.field-clear').click();
    expect(n).toBe(0);
  });
});

describe('o botão só aparece quando há o que limpar', () => {
  it('campo vazio nasce sem a marca de conteúdo', () => {
    const el = campo('<textarea></textarea>');
    C.clearFieldWire(el);
    expect(el.closest('.clearable').classList.contains('has-value')).toBe(false);
  });

  it('digitar mostra, limpar esconde', () => {
    const el = campo('<textarea></textarea>');
    C.clearFieldWire(el);
    const host = el.closest('.clearable');
    el.value = 'x';
    el.dispatchEvent(new Event('input'));
    expect(host.classList.contains('has-value')).toBe(true);
    host.querySelector('.field-clear').click();
    expect(host.classList.contains('has-value')).toBe(false);
  });

  it('campo que já vem preenchido nasce mostrando o botão', () => {
    document.body.innerHTML = '<textarea id="z">já tinha texto</textarea>';
    const el = document.getElementById('z');
    el.value = 'já tinha texto';
    C.clearFieldWire(el);
    expect(el.closest('.clearable').classList.contains('has-value')).toBe(true);
  });
});

describe('campos criados depois também ganham', () => {
  it('varrer uma raiz nova liga todos de uma vez', () => {
    document.body.innerHTML = '<div id="novo"><textarea></textarea><input type="text" /></div>';
    const n = C.clearFieldWireAll(document.getElementById('novo'));
    expect(n).toBe(2);
    expect(document.querySelectorAll('.field-clear').length).toBe(2);
  });

  it('o observador está armado — é o que cobre o que a interface cria', () => {
    expect(ler('src/clear-field.js')).toMatch(/new MutationObserver/);
    expect(ler('src/clear-field.js')).toMatch(/childList: true, subtree: true/);
  });
});

describe('vale nas duas aplicações', () => {
  it('o app principal carrega o módulo', () => {
    expect(ler('scripts/scripts.manifest.mjs')).toContain("'clear-field.js'");
    expect(ler('index.html')).toContain('src/clear-field.js');
  });

  it('o AutoPost tem a sua cópia, carregada e assada', () => {
    expect(ler('autopost-ia/index.html')).toContain('js/clear-field.js');
    const assado = ler('autopost-ia.html');
    expect(assado).toContain('field-clear');
    expect(assado).not.toContain('src="js/clear-field.js"');
  });

  it('a caixa do AutoPost, que já tinha × próprio, fica de fora', () => {
    // Sem o opt-out, o mecanismo genérico somaria um SEGUNDO × em cima do
    // botão que a smartbox já desenha — conferido em navegador.
    expect(ler('autopost-ia/index.html')).toMatch(/data-no-clear id="transcricaoTexto"/);
  });

  it('as duas folhas de estilo escondem o botão em campo vazio', () => {
    [ler('styles.css'), ler('autopost-ia/css/app.css')].forEach((css, i) => {
      expect(css, `folha ${i}`).toMatch(/\.clearable\s*\{[^}]*position:\s*relative/);
      expect(css, `folha ${i}`).toMatch(/\.clearable\.has-value\s*>\s*\.field-clear\s*\{[^}]*display:\s*inline-flex/);
    });
  });
});
