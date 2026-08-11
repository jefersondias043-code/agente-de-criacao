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
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'media-transcode.js', 'ingest.js', 'causos-motor.js', 'causos.js'],
    ['State', 'renderCausos', 'causoTemChave', 'causoAvisarSemChave', 'causoLimparResultado',
      'causoNovo', 'renderCausoResultado', 'causoMemoriaAtual', 'STORAGE_KEYS']);
});

/* A tela da ferramenta, reduzida ao que `renderCausos` toca. */
const montarTela = () => {
  document.body.innerHTML = `
    <div id="c-api-warning" class="hidden"></div>
    <textarea id="c-ideia"></textarea>
    <div id="c-attach-pending"></div>
    <input type="file" id="c-attach-input" />
    <button id="c-attach-btn"></button>
    <div id="toast-stack"></div>
    <div id="c-result-badge"></div>
    <div id="c-result-area"></div>
    <button id="c-submit"></button>
    <button id="c-novo"></button>
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

describe('contar outro causo', () => {
  const IDEIA = 'uma história de pescador sobre um peixe impossível';
  /* Um causo guardado, com a forma que a memória da mesa lê. */
  const guardado = (id, ideia) => ({
    id, createdAt: new Date().toISOString(), ideia,
    conteudo: 'O Zé Macambira voltou do rio com a canoa torta.\nNinguém perguntou nada.',
    dossie: { genero: 'pescador', estrutura: 'a mentira sustentada',
      personagens: [{ nome: 'Zé Macambira' }] },
    juizo: { aprovado: true, avaliadas: [], pior: 90 },
    criticas: [],
  });
  const escrever = (t) => {
    const c = document.getElementById('c-ideia');
    c.value = t; c.dispatchEvent(new Event('input', { bubbles: true }));
  };
  const campo = () => document.getElementById('c-ideia').value;

  beforeEach(() => { U.State.apiKeys = { groq: 'gsk_teste' }; U.renderCausos(); });

  it('limpa a ideia', () => {
    escrever(IDEIA);
    U.causoNovo(true);
    expect(campo()).toBe('');
  });

  it('NÃO apaga o histórico — ele É a memória da mesa', () => {
    // Este histórico não é só arquivo: `causoMemoriaDe` lê dele as aberturas,
    // os nomes e os desenhos já usados, e é o que impede a mesa de contar a
    // mesma história de novo. Levá-lo junto seria um estrago silencioso.
    U.State.causos = [guardado('c1', IDEIA)];
    const antes = U.causoMemoriaAtual();
    expect(antes.nomes.length, 'a memória precisa ter o que perder').toBeGreaterThan(0);
    escrever(IDEIA);
    U.causoNovo(true);
    expect(U.State.causos.length).toBe(1);
    expect(U.causoMemoriaAtual(), 'a mesa esqueceu o que já contou').toEqual(antes);
  });

  /* Os dois seguintes desligam o ouvinte do campo de propósito.
   *
   * `causoNovo` esvazia o campo E dispara `input`, e esse evento provoca os
   * mesmos efeitos (guardar o rascunho, tirar a história). Com o ouvinte ligado,
   * os testes passavam mesmo depois de eu remover as chamadas explícitas — não
   * mediam quem fez o quê. Sem o ouvinte, sobra só o que a função garante
   * sozinha, que é o contrato de verdade. */
  const semOuvinte = () => { document.getElementById('c-ideia').oninput = null; };

  it('tira a história da tela por conta própria', () => {
    U.State.causos = [guardado('c1', IDEIA)];
    U.renderCausoResultado(U.State.causos[0]);
    expect(document.getElementById('c-result-content')).toBeTruthy();
    semOuvinte();
    U.causoNovo(true);
    expect(document.getElementById('c-result-content'), 'a história antiga ficou na tela').toBeFalsy();
  });

  it('guarda o rascunho vazio por conta própria, senão volta ao recarregar', () => {
    escrever(IDEIA);
    semOuvinte();
    U.causoNovo(true);
    const d = JSON.parse(localStorage.getItem(U.STORAGE_KEYS.causoDraft) || '{}');
    expect(d.ideia, 'a ideia antiga voltaria ao recarregar').toBe('');
  });

  it('avisa quem escuta o campo — é o que faz o × sumir', () => {
    // `clear-field.js` sincroniza o × pelo evento `input`. Esvaziar o campo
    // calado deixaria o × na tela de um campo já vazio.
    escrever(IDEIA);
    let avisou = false;
    document.getElementById('c-ideia').addEventListener('input', () => { avisou = true; });
    U.causoNovo(true);
    expect(avisou).toBe(true);
  });

  it('o botão do resultado limpa sem perguntar — aquela ideia já virou causo', () => {
    U.State.causos = [guardado('c1', IDEIA)];
    escrever(IDEIA);
    U.renderCausoResultado(U.State.causos[0]);
    globalThis.confirm = () => { throw new Error('não devia perguntar'); };
    document.getElementById('c-result-novo').click();
    expect(campo()).toBe('');
  });

  it('o botão sempre visível pergunta antes de descartar ideia não contada', () => {
    U.State.causos = [];
    escrever('uma ideia que nunca virou causo');
    let perguntou = false;
    globalThis.confirm = () => { perguntou = true; return false; };
    document.getElementById('c-novo').click();
    expect(perguntou, 'apagaria trabalho sem avisar').toBe(true);
    expect(campo(), 'disse não e limpou assim mesmo').not.toBe('');
  });

  it('e não pergunta quando a ideia na tela já virou causo', () => {
    U.State.causos = [guardado('c1', IDEIA)];
    escrever(IDEIA);
    globalThis.confirm = () => { throw new Error('não devia perguntar'); };
    document.getElementById('c-novo').click();
    expect(campo()).toBe('');
  });

  it('renderizar duas vezes não empilha o handler', () => {
    U.renderCausos();
    U.renderCausos();
    U.State.causos = [];
    escrever('uma ideia solta');
    globalThis.confirm = () => true;
    document.getElementById('toast-stack').innerHTML = '';
    document.getElementById('c-novo').click();
    expect(document.getElementById('toast-stack').children.length,
      'o handler rodou mais de uma vez').toBe(1);
  });
});

describe('anexar vídeo', () => {
  /* Esta tela tinha a mesma falha do Julgador, pelo mesmo motivo: a fiação foi
   * escrita sem o cartão de gesto que a Gerar e a Narrativa já tinham. Mídia
   * grande passa pelo compressor de Web Audio, que no celular exige um toque. */
  it('vídeo grande espera o toque em vez de converter sozinho', () => {
    U.State.apiKeys = { groq: 'gsk_teste' };
    U.renderCausos();
    const f = new Blob(['x'], { type: 'video/mp4' });
    Object.defineProperty(f, 'size', { value: 40 * 1024 * 1024 });
    Object.defineProperty(f, 'name', { value: 'causo.mp4' });
    const inp = document.getElementById('c-attach-input');
    Object.defineProperty(inp, 'files', { value: [f], configurable: true });
    inp.onchange();
    expect(document.getElementById('toast-stack').children.length,
      'converteu sem gesto — é a falha do celular').toBe(0);
    expect(document.querySelector('#c-attach-pending [data-attach-go]'),
      'a tela não passou o container do cartão').toBeTruthy();
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
