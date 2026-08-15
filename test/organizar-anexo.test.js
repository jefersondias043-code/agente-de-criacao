// ORGANIZAR O ANEXO — em todas as telas que aceitam arquivo
//
// O que o usuário pediu no AutoPost foi "faça como nas outras ferramentas".
// Ao conferir, "as outras" eram só duas — Gerar e Narrativa ainda despejavam
// fala corrida no campo. A diferença não era decisão de ninguém, era o passo
// ter nascido em duas telas e não ter sido levado às outras.
//
// O Julgador saiu da plataforma no r244 e os dois casos dele saíram daqui
// junto; o passo em si não mudou.
//
// Este arquivo mede o caminho inteiro, sem dublê de função: um .txt DE VERDADE
// entra pelo mesmo ponto que o usuário usa, e a única coisa substituída é a
// rede. Espião não serve aqui — os módulos rodam em `'use strict'` dentro de um
// eval isolado, e a chamada resolve pela ligação léxica (o comentário em
// test/ingest-anexo.test.js conta como essa tentativa fracassou).
//
// O que se observa é o texto que CHEGA AO CAMPO: cru quer dizer que o passo não
// rodou, organizado quer dizer que rodou.
import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');

// Precisa passar de 200 caracteres, senão `transcricaoVale` (com razão) diz que
// não há o que organizar e o passo nem começa.
const CRU =
  'então eu tava lá no mercado sabe e o seu joão chegou perto de mim e falou ' +
  'olha eu comprei esse relógio por 350 reais e eu falei nossa mas isso é muito ' +
  'caro e ele disse não é não porque esse relógio aqui ele é original e eu olhei ' +
  'e vi que tava escrito rolexx com dois xis aí eu não falei nada só fiquei ' +
  'olhando pra cara dele esperando ele perceber sozinho e ele não percebeu';

const ORGANIZADO =
  '— Então eu estava lá no mercado, sabe? E o seu João chegou perto de mim e falou:\n\n' +
  '— Olha, eu comprei esse relógio por trezentos e cinquenta reais.\n\n' +
  '— Nossa, mas isso é muito caro!\n\n' +
  '— Não é não, porque esse relógio aqui é original.\n\n' +
  'Eu olhei e vi que estava escrito "Rolexx", com dois xis. Aí eu não falei nada, ' +
  'só fiquei olhando para a cara dele, esperando ele perceber sozinho. E ele não percebeu.';

let M;
beforeAll(() => {
  clearStorage();
  M = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'media-transcode.js', 'transcricao.js', 'ingest.js',
      'causos-motor.js', 'causos.js',
      'narrativa-motor.js', 'narrativa.js', 'generate.js'],
    ['State', 'ingestLigarAnexo', 'handleGenAttach', 'handleNarrAttach',
      'renderCausos', 'STORAGE_KEYS']);
});

let chamadas;
let fetchOriginal;

beforeEach(() => {
  chamadas = [];
  fetchOriginal = globalThis.fetch;
  globalThis.fetch = async (_url, opcoes) => {
    const corpo = JSON.parse(opcoes.body);
    chamadas.push(corpo.messages[corpo.messages.length - 1].content);
    return {
      ok: true, status: 200,
      json: async () => ({ choices: [{ message: { content: ORGANIZADO } }] }),
    };
  };
  M.State.provider = 'groq';
  M.State.apiKeys = { groq: 'chave-de-teste' };
  M.State.models = { groq: 'modelo-de-teste' };
  document.body.innerHTML = '<div id="toast-stack"></div>';
});

afterEach(() => { globalThis.fetch = fetchOriginal; });

/** Um .txt de verdade — atravessa o pipeline sem nenhum dublê no caminho. */
const txt = (conteudo, nome = 'transcricao.txt') => {
  const f = new Blob([conteudo], { type: 'text/plain' });
  Object.defineProperty(f, 'name', { value: nome });
  return f;
};

/** Espera o pipeline (leitura do arquivo + chamada + conferência) terminar. */
const assentar = async () => {
  for (let i = 0; i < 40; i++) await new Promise((r) => setTimeout(r, 5));
};

/** Recorta uma vista do index.html e a monta no documento do teste. */
function montarVista(idVista, ateId) {
  const inicio = html.indexOf(`id="${idVista}"`);
  const fim = html.indexOf(`id="${ateId}"`);
  expect(inicio, `vista ${idVista} não encontrada no index.html`).toBeGreaterThan(-1);
  expect(fim, `âncora ${ateId} não encontrada no index.html`).toBeGreaterThan(inicio);
  const trecho = html.slice(inicio, fim);
  document.body.innerHTML =
    `<div id="toast-stack"></div><section>${trecho.slice(trecho.indexOf('>') + 1)}</section>`;
}

/** Dispara o mesmo `change` que o seletor de arquivo dispara no navegador. */
async function anexarPeloInput(seletorInput, arquivo) {
  const inp = document.querySelector(seletorInput);
  expect(inp, `input ${seletorInput} não está na tela`).toBeTruthy();
  Object.defineProperty(inp, 'files', { value: [arquivo], configurable: true });
  inp.dispatchEvent(new Event('change'));
  await assentar();
}

describe('o passo de organizar, ligado ao anexo de cada ferramenta', () => {
  it('Gerar: o texto do arquivo chega organizado ao campo', async () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    M.handleGenAttach(txt(CRU), ta);
    await assentar();

    expect(chamadas.length).toBe(1);
    expect(ta.value).toContain('trezentos e cinquenta');
    expect(ta.value).not.toBe(CRU);
  });

  it('Narrativa: o texto do arquivo chega organizado ao campo', async () => {
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    M.handleNarrAttach(txt(CRU), ta);
    await assentar();

    expect(chamadas.length).toBe(1);
    expect(ta.value).toContain('trezentos e cinquenta');
    expect(ta.value).not.toBe(CRU);
  });

  it('Causos: o texto do arquivo chega organizado ao campo', async () => {
    montarVista('view-causos', 'c-history-backdrop');
    M.renderCausos();
    await anexarPeloInput('#c-attach-input', txt(CRU));

    expect(chamadas.length).toBe(1);
    expect(document.getElementById('c-ideia').value).toContain('trezentos e cinquenta');
  });

  it('sem pedir organização, o texto entra cru — o passo é opcional de fato', async () => {
    // Controle do próprio experimento: se o campo ficasse organizado ATÉ SEM o
    // pedido, os testes acima não estariam medindo o que dizem medir.
    document.body.innerHTML = `
      <div id="toast-stack"></div>
      <textarea id="campo"></textarea>
      <input type="file" id="entrada" />
      <button id="botao"></button>`;
    M.ingestLigarAnexo({ botao: '#botao', input: '#entrada', campo: '#campo' });
    await anexarPeloInput('#entrada', txt(CRU));

    expect(chamadas.length).toBe(0);
    expect(document.getElementById('campo').value).toBe(CRU);
  });

  it('sem chave de API, o anexo continua entrando — cru, mas entra', async () => {
    // Organizar é melhoria, não requisito. Perder o anexo por causa de um
    // enfeite seria trocar o certo pelo bonito.
    M.State.apiKeys = {};
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    M.handleGenAttach(txt(CRU), ta);
    await assentar();

    expect(chamadas.length).toBe(0);
    expect(ta.value).toBe(CRU);
  });

  /* A TRANSCRIÇÃO COM DIÁLOGO — o caso que voltava cru em silêncio.
   *
   * O prompt manda separar quem fala em travessões; quando o modelo obedecia,
   * os "falou/falei/disse" sumiam (é o que o travessão faz) e a conferência
   * reprovava a fatia por palavras apagadas. O texto entrava cru com um
   * "Conteúdo adicionado." idêntico ao do sucesso — nada na tela dizia que a
   * etapa tinha rodado e falhado. */
  it('conversa virada em diálogo chega ORGANIZADA ao campo', async () => {
    const conversa =
      'ai o seu joao falou rapaz esse relogio aqui e original mesmo viu e eu falei ' +
      'que nao acreditava naquilo de jeito nenhum e ele disse que tinha comprado numa ' +
      'loja boa do centro da cidade e eu perguntei quanto tinha pagado e ele respondeu ' +
      'que foram trezentos reais e ai eu falei que tinha visto igualzinho por trinta';
    const emDialogo =
      '— Rapaz, esse relógio aqui é original mesmo, viu?\n\n' +
      '— Não acreditava naquilo de jeito nenhum.\n\n' +
      '— Tinha comprado numa loja boa do centro da cidade.\n\n' +
      '— Quanto tinha pagado?\n\n' +
      '— Foram trezentos reais.\n\n' +
      '— Tinha visto igualzinho por trinta.';
    globalThis.fetch = async (_url, opcoes) => {
      chamadas.push(JSON.parse(opcoes.body));
      return { ok: true, status: 200, json: async () => ({ choices: [{ message: { content: emDialogo } }] }) };
    };
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    M.handleGenAttach(txt(conversa), ta);
    await assentar();

    expect(chamadas.length).toBe(1);
    expect(ta.value, 'a conferência reprovou o diálogo que o próprio prompt pediu').toContain('—');
    expect(ta.value).not.toBe(conversa);
  });

  it('quando a organização não passa, a tela DIZ que o texto entrou cru', async () => {
    // O silêncio era o defeito mais caro: "não está funcionando" sem sintoma.
    globalThis.fetch = async (_url, opcoes) => {
      chamadas.push(JSON.parse(opcoes.body));
      // Resumo descarado: a conferência reprova, e com razão.
      return { ok: true, status: 200,
        json: async () => ({ choices: [{ message: { content: 'O Seu João comprou um relógio falso.' } }] }) };
    };
    const ta = document.createElement('textarea');
    document.body.appendChild(ta);
    M.handleGenAttach(txt(CRU), ta);
    await assentar();

    expect(ta.value, 'o texto cru precisa entrar de qualquer jeito').toBe(CRU);
    const avisos = document.getElementById('toast-stack').textContent;
    expect(avisos, 'falhou calado — o usuário não tem como saber').toMatch(/entrou como veio/i);
  });
});
