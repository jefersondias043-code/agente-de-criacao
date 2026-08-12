// CAUSOS — o seletor de modo na tela
//
// A tela é recortada do index.html publicado e ligada por `renderCausos`: o
// teste quebra tanto se a fiação sumir quanto se o seletor nunca tiver chegado
// ao HTML. É a lição do r219/r220, quando a lógica estava certa e o botão não
// fazia nada.
//
// O QUE MAIS IMPORTA AQUI é o que o usuário pediu com todas as letras: quem não
// mexer no seletor continua na ferramenta de sempre. O modo Causos é o padrão,
// e um rascunho antigo — gravado antes de existirem modos — tem de abrir nele.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');

let U;
beforeAll(() => {
  clearStorage();
  U = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'media-transcode.js', 'ingest.js', 'dialogos-motor.js', 'causos-motor.js', 'causos.js'],
    ['State', 'renderCausos', 'causoModoAtual', 'causoTrocarModo', 'causoNovo', 'renderCausoResultado',
      'STORAGE_KEYS', 'CAUSO_MODO_PADRAO']);
});

const montarTela = () => {
  const inicio = html.indexOf('id="view-causos"');
  const fim = html.indexOf('id="c-history-backdrop"');
  expect(inicio, 'a vista do Causos sumiu do index.html').toBeGreaterThan(-1);
  expect(fim).toBeGreaterThan(inicio);
  const trecho = html.slice(inicio, fim);
  document.body.innerHTML =
    `<div id="toast-stack"></div><section id="view-causos">${trecho.slice(trecho.indexOf('>') + 1)}</section>`;
};

let fetchOriginal;
beforeEach(() => {
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => { throw new Error('nenhuma chamada de rede era esperada'); };
  clearStorage();
  U.State.causoDraft = null;
  U.State.causos = [];
  montarTela();
  U.renderCausos();
});
afterEach(() => { globalThis.fetch = fetchOriginal; });

const $$ = (s) => document.querySelector(s);
const botoes = () => [...document.querySelectorAll('#c-modos [data-modo]')];
const ativo = () => (botoes().find((b) => b.classList.contains('ativo')) || {}).dataset?.modo;

describe('o seletor', () => {
  it('está na parte de cima da ferramenta, com os dois modos', () => {
    expect($$('#c-modos')).toBeTruthy();
    expect(botoes().map((b) => b.dataset.modo)).toEqual(['causos', 'dialogos']);
    // Acima do campo de ideia — é o que decide o que o campo significa.
    const pos = (sel) => html.indexOf(sel);
    expect(pos('id="c-modos"')).toBeLessThan(pos('id="c-ideia"'));
  });

  it('abre no modo Causos, que é o que já existia', () => {
    expect(ativo()).toBe('causos');
    expect(U.causoModoAtual()).toBe(U.CAUSO_MODO_PADRAO);
  });

  it('cada modo diz o que faz — o nome sozinho não basta para escolher', () => {
    for (const b of botoes()) {
      expect(b.querySelector('.causo-modo-nome').textContent.trim().length).toBeGreaterThan(3);
      expect(b.querySelector('.causo-modo-desc').textContent.trim().length).toBeGreaterThan(30);
    }
  });

  it('clicar troca o modo e marca o botão', () => {
    $$('[data-modo="dialogos"]').click();
    expect(U.causoModoAtual()).toBe('dialogos');
    expect(ativo()).toBe('dialogos');
    expect($$('[data-modo="dialogos"]').getAttribute('aria-checked')).toBe('true');
    expect($$('[data-modo="causos"]').getAttribute('aria-checked')).toBe('false');
  });

  it('a escolha sobrevive a fechar e abrir a ferramenta', () => {
    $$('[data-modo="dialogos"]').click();
    const guardado = JSON.parse(localStorage.getItem(U.STORAGE_KEYS.causoDraft));
    expect(guardado.modo).toBe('dialogos');
    // Remonta a tela do zero, como acontece ao voltar para a ferramenta.
    montarTela();
    U.renderCausos();
    expect(ativo()).toBe('dialogos');
  });

  it('o exemplo do campo de ideia acompanha o modo', () => {
    const antes = $$('#c-ideia').placeholder;
    $$('[data-modo="dialogos"]').click();
    expect($$('#c-ideia').placeholder).not.toBe(antes);
    expect($$('#c-ideia').placeholder).toMatch(/conta do bar/i);
  });

  it('"criar outro" limpa a ideia mas mantém o modo escolhido', () => {
    // Trocar de formato é decisão do usuário, não efeito colateral de limpar.
    $$('[data-modo="dialogos"]').click();
    $$('#c-ideia').value = 'dois amigos no bar';
    U.causoNovo(true);
    expect($$('#c-ideia').value).toBe('');
    expect(U.causoModoAtual()).toBe('dialogos');
  });
});

describe('quem já usava a ferramenta não é afetado', () => {
  it('rascunho antigo, sem campo de modo, abre no Causos', () => {
    // É o rascunho de quem estava usando a ferramenta antes desta versão.
    localStorage.setItem(U.STORAGE_KEYS.causoDraft, JSON.stringify({ ideia: 'um peixe enorme' }));
    U.State.causoDraft = { ideia: 'um peixe enorme' };
    montarTela();
    U.renderCausos();
    expect(ativo()).toBe('causos');
    expect($$('#c-ideia').value).toBe('um peixe enorme');
  });

  it('modo estragado no rascunho cai no Causos em vez de quebrar a tela', () => {
    U.State.causoDraft = { ideia: 'x', modo: 'modo-que-nao-existe' };
    montarTela();
    U.renderCausos();
    expect(ativo()).toBe('causos');
  });
});

describe('a tela fala a língua do modo', () => {
  it('em Causos, o painel e o botão dizem "causo"', () => {
    expect($$('#view-causos .card-title').textContent).toMatch(/causo/i);
    expect($$('#c-submit').textContent).toMatch(/contar o causo/i);
  });

  it('em Diálogos, dizem "conversa" — chamar de causo seria o nome errado', () => {
    $$('[data-modo="dialogos"]').click();
    expect($$('#view-causos .card-title').textContent).toMatch(/conversa/i);
    expect($$('#c-submit').textContent).toMatch(/escrever a conversa/i);
  });

  it('a capitular é desligada na conversa, senão ela parte "TIÃO:" ao meio', () => {
    // Medido no navegador: a letra gigante engolia a primeira letra do nome de
    // quem fala e a linha saía "T IÃO: Você viu…".
    U.State.causos = [{ id: 'x', createdAt: new Date().toISOString(), modo: 'dialogos',
      ideia: 'i', conteudo: 'TIÃO: Oi.\nMARISA: Oi.', juizo: { avaliadas: [], reprovadas: [], ordens: [] } }];
    U.renderCausoResultado(U.State.causos[0]);
    expect($$('#c-result-content').classList.contains('sem-capitular')).toBe(true);

    U.State.causos[0].modo = 'causos';
    U.renderCausoResultado(U.State.causos[0]);
    expect($$('#c-result-content').classList.contains('sem-capitular')).toBe(false);
  });
});
