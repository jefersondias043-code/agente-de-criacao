// CAUSOS — a tela
//
// O aviso de chave de API ficava permanente na frente de quem só queria contar
// um causo. Duas coisas erradas, e a segunda explica por que ele nunca saía:
//
//   1. era montado ao ABRIR a ferramenta, quando a plataforma já tem uma tela
//      de configuração própria;
//   2. procurava a chave em `State.settings.groqKey` — lugar que não existe.
//      `callLLM` lê de `State.apiKeys[provider]`. Como o lugar errado é sempre
//      vazio, o aviso dava a chave por ausente SEMPRE, inclusive configurada.
//
// Estes testes exercitam a tela de verdade em jsdom, em vez de conferir o
// formato do código: uma versão anterior conferia a forma de `renderCausos` e
// deixava passar o aviso voltando por outro caminho.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let U;
beforeAll(() => {
  clearStorage();
  U = loadModules(
    ['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js', 'causos-motor.js', 'causos.js'],
    ['State', 'renderCausos', 'causoTemChave', 'causoAvisarSemChave', 'causoLimparResultado']);
});

/* A tela da ferramenta, reduzida ao que `renderCausos` toca. */
const montarTela = () => {
  document.body.innerHTML = `
    <div id="c-api-warning" class="hidden"></div>
    <textarea id="c-ideia"></textarea>
    <div id="c-attach-pending"></div>
    <input type="file" id="c-attach-input" />
    <button id="c-attach-btn"></button>
    <div id="c-result-badge"></div>
    <div id="c-result-area"></div>
    <button id="c-submit"></button>
    <div id="c-history-list"></div>
    <button id="c-history-open"></button><button id="c-history-close"></button>
    <div id="c-history-backdrop"></div><button id="c-history-clear"></button>`;
};

const avisoVisivel = () => {
  const a = document.getElementById('c-api-warning');
  return !!a && !a.classList.contains('hidden');
};

beforeEach(() => {
  clearStorage();
  U.State.causos = [];
  U.State.causoDraft = null;
  montarTela();
});

describe('o aviso de chave não fica na frente de quem quer trabalhar', () => {
  it('abrir a ferramenta SEM chave não mostra aviso nenhum', () => {
    // É a reclamação literal: a plataforma já tem tela de configuração; um
    // aviso permanente ali é ruído.
    U.State.apiKeys = {};
    U.renderCausos();
    expect(avisoVisivel()).toBe(false);
  });

  it('abrir a ferramenta COM chave também não mostra nada', () => {
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderCausos();
    expect(avisoVisivel()).toBe(false);
  });

  it('renderizar de novo não faz o aviso voltar', () => {
    U.State.apiKeys = {};
    U.renderCausos();
    U.renderCausos();
    expect(avisoVisivel()).toBe(false);
  });

  it('o aviso aparecido numa tentativa some ao reabrir a ferramenta', () => {
    // Quem configurou a chave e voltou não pode encontrar o aviso de antes.
    U.State.apiKeys = {};
    U.causoAvisarSemChave();
    expect(avisoVisivel()).toBe(true);
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderCausos();
    expect(avisoVisivel()).toBe(false);
  });

  it('quando aparece, diz o que aconteceu e leva para as Configurações', () => {
    U.State.apiKeys = {};
    U.causoAvisarSemChave();
    const a = document.getElementById('c-api-warning');
    expect(a.textContent).toMatch(/não pôde trabalhar/i);
    expect(a.querySelector('[data-go="settings"]'), 'sem caminho para resolver').toBeTruthy();
  });
});

describe('onde a chave é procurada', () => {
  it('no mesmo lugar de onde o callLLM a lê', () => {
    U.State.provider = 'groq';
    U.State.apiKeys = { groq: 'gsk_teste' };
    expect(U.causoTemChave()).toBe(true);
    U.State.apiKeys = {};
    expect(U.causoTemChave()).toBe(false);
  });

  it('respeita o provedor escolhido, não só a Groq', () => {
    U.State.provider = 'anthropic';
    U.State.apiKeys = { groq: 'gsk_teste' };
    expect(U.causoTemChave(), 'chave da Groq não serve para a Anthropic').toBe(false);
    U.State.apiKeys = { anthropic: 'sk-ant-teste' };
    expect(U.causoTemChave()).toBe(true);
    U.State.provider = 'groq';
  });

  it('sem provedor definido, assume groq', () => {
    U.State.provider = null;
    U.State.apiKeys = { groq: 'gsk_teste' };
    expect(U.causoTemChave()).toBe(true);
    U.State.provider = 'groq';
  });
});
