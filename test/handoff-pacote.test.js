// ENVIAR PARA — Pacote como destino
//
// Mesmo padrão de test/handoff-causos-julgador.test.js: um destino só existe
// de verdade quando alguém o CONSOME. Isto recorta o `<section id="view-pacote">`
// de verdade do index.html — não um fragmento de DOM escrito à mão — para que
// o teste prove que a tela REAL, como ela é servida, lê `State.handoff`.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
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
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js', 'storage.js',
      'media-transcode.js', 'transcricao.js', 'embalagem.js', 'resumo.js', 'ingest.js',
      'handoff.js', 'pacote-motor.js', 'pacote.js'],
    ['State', 'sendTextTo', 'sendToBarHtml', 'TEXT_CONSUMERS',
      'renderPacote', 'pacoteDraft', 'STORAGE_KEYS']);
});

const recortar = (idVista, ateId) => {
  const inicio = html.indexOf(`id="${idVista}"`);
  const fim = html.indexOf(`id="${ateId}"`);
  expect(inicio, idVista).toBeGreaterThan(-1);
  const t = html.slice(inicio, fim);
  return t.slice(t.indexOf('>') + 1);
};

beforeEach(() => {
  clearStorage();
  globalThis.goTo = (v) => { globalThis.__foi = v; };
  globalThis.__foi = null;
  U.State.handoff = null;
  U.State.pacoteDraft = null;
  U.State.pacotes = [];
  document.body.innerHTML = '<div id="toast-stack"></div>';
});

describe('a barra oferece o Pacote', () => {
  it('Pacote está na lista de destinos', () => {
    const ids = U.TEXT_CONSUMERS.map((c) => c.id);
    expect(ids).toContain('pacote');
  });

  it('e aparece na barra montada a partir da ferramenta Extrair', () => {
    const barra = U.sendToBarHtml('extract');
    expect(barra).toContain('data-sendto="pacote"');
  });

  it('a ferramenta de origem continua fora da própria barra', () => {
    expect(U.sendToBarHtml('pacote')).not.toContain('data-sendto="pacote"');
  });
});

describe('Pacote recebe o material', () => {
  it('o texto vira o conteúdo, e a ferramenta é aberta', () => {
    U.sendTextTo('pacote', '  um vizinho que jurava ter pescado um peixe enorme  ');
    expect(globalThis.__foi).toBe('pacote');
    expect(U.State.handoff).toMatchObject({ target: 'pacote' });

    document.body.innerHTML = `<div id="toast-stack"></div><section id="view-pacote">${recortar('view-pacote', 'pk-history-backdrop')}</section>`;
    U.renderPacote();
    expect(document.getElementById('pk-conteudo').value).toBe('um vizinho que jurava ter pescado um peixe enorme');
  });

  it('a fila é esvaziada — material que fica volta a se colar sozinho', () => {
    U.sendTextTo('pacote', 'material recebido, comprido o bastante para não disparar o aviso de tamanho');
    document.body.innerHTML = `<div id="toast-stack"></div><section id="view-pacote">${recortar('view-pacote', 'pk-history-backdrop')}</section>`;
    U.renderPacote();
    expect(U.State.handoff).toBeNull();

    // O usuário escreve outra coisa; um novo render não pode desfazer isso.
    U.pacoteDraft().conteudo = 'outro conteúdo meu';
    U.renderPacote();
    expect(document.getElementById('pk-conteudo').value).toBe('outro conteúdo meu');
  });
});

describe('texto vazio não vira envio', () => {
  it('não navega nem enfileira nada', () => {
    U.sendTextTo('pacote', '   ');
    expect(globalThis.__foi).toBeNull();
    expect(U.State.handoff).toBeNull();
  });
});
