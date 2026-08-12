// ENVIAR PARA — Causos e Julgador como destinos
//
// Relato: "na integração do conteúdo extraído com outras ferramentas, foi
// disponibilizado um atalho para enviar o conteúdo para a Narrativa, mas
// faltaram outras ferramentas importantes, como Causos e Julgar."
//
// Conferido: os dois nunca estiveram em `TEXT_CONSUMERS`. Não era a tela
// Extrair que os escondia — eles não existiam como destino em lugar nenhum da
// plataforma.
//
// UM DESTINO SÓ EXISTE DE VERDADE QUANDO ALGUÉM O CONSOME. Registrar na lista
// faz o botão aparecer; sem o outro lado lendo `State.handoff`, o clique leva a
// pessoa para uma tela vazia e o texto se perde no caminho — falha silenciosa,
// que é a pior. Por isso metade destes testes é sobre a CHEGADA.
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
      'media-transcode.js', 'transcricao.js', 'resumo.js', 'embalagem.js', 'ingest.js',
      'handoff.js', 'dialogos-motor.js', 'causos-motor.js', 'causos.js',
      'julgador-motor.js', 'julgador.js'],
    ['State', 'sendTextTo', 'sendToBarHtml', 'TEXT_CONSUMERS',
      'renderCausos', 'causosDraft', 'renderJulgador', 'julgadorDraft', 'STORAGE_KEYS']);
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
  U.State.causoDraft = null;
  U.State.julgadorDraft = null;
  U.State.causos = [];
  U.State.julgamentos = [];
  document.body.innerHTML = '<div id="toast-stack"></div>';
});

describe('a barra oferece os dois', () => {
  it('Causos e Julgador estão na lista de destinos', () => {
    const ids = U.TEXT_CONSUMERS.map((c) => c.id);
    expect(ids).toContain('causos');
    expect(ids).toContain('julgador');
  });

  it('e aparecem na barra montada a partir da ferramenta Extrair', () => {
    const barra = U.sendToBarHtml('extract');
    expect(barra).toContain('data-sendto="causos"');
    expect(barra).toContain('data-sendto="julgador"');
  });

  it('a ferramenta de origem continua fora da própria barra', () => {
    expect(U.sendToBarHtml('causos')).not.toContain('data-sendto="causos"');
  });
});

describe('Causos recebe o material', () => {
  it('o texto vira a ideia, e a ferramenta é aberta', () => {
    U.sendTextTo('causos', '  um vizinho que jurava ter pescado um peixe enorme  ');
    expect(globalThis.__foi).toBe('causos');
    expect(U.State.handoff).toMatchObject({ target: 'causos' });

    document.body.innerHTML = `<div id="toast-stack"></div><section id="view-causos">${recortar('view-causos', 'c-history-backdrop')}</section>`;
    U.renderCausos();
    expect(document.getElementById('c-ideia').value).toBe('um vizinho que jurava ter pescado um peixe enorme');
  });

  it('a fila é esvaziada — material que fica volta a se colar sozinho', () => {
    U.sendTextTo('causos', 'material recebido');
    document.body.innerHTML = `<div id="toast-stack"></div><section id="view-causos">${recortar('view-causos', 'c-history-backdrop')}</section>`;
    U.renderCausos();
    expect(U.State.handoff).toBeNull();

    // O usuário escreve outra coisa; um novo render não pode desfazer isso.
    U.causosDraft().ideia = 'outra ideia minha';
    U.renderCausos();
    expect(document.getElementById('c-ideia').value).toBe('outra ideia minha');
  });
});

describe('Julgador recebe o material', () => {
  it('o texto vira o CONTEÚDO a julgar, não outro campo', () => {
    U.sendTextTo('julgador', 'a transcrição inteira do vídeo, com bastante texto aqui');
    expect(globalThis.__foi).toBe('julgador');

    document.body.innerHTML = `<div id="toast-stack"></div><section id="view-julgador" class="mtabs-host" data-mtab="a">${recortar('view-julgador', 'j-history-backdrop')}</section>`;
    U.renderJulgador();
    expect(document.getElementById('j-conteudo').value).toMatch(/transcrição inteira do vídeo/);
    expect(U.State.handoff).toBeNull();
  });

  it('zera a comparação — senão o veredito sai comparado com o vídeo anterior', () => {
    /* Mesmo motivo do botão "Julgar outro conteúdo" (r219): com `julgadorOrigemId`
     * de pé, o próximo julgamento nasce comparado a um vídeo que não tem relação
     * nenhuma com o material que acabou de chegar — e o "+5 em impacto" que
     * aparece não quer dizer coisa alguma. */
    U.State.julgadorOrigemId = 'algum-julgamento-antigo';
    U.sendTextTo('julgador', 'a transcrição inteira do vídeo, com bastante texto aqui');
    document.body.innerHTML = `<div id="toast-stack"></div><section id="view-julgador" class="mtabs-host" data-mtab="a">${recortar('view-julgador', 'j-history-backdrop')}</section>`;
    U.renderJulgador();
    expect(U.State.julgadorOrigemId).toBeNull();
  });

  it('limpa a embalagem do vídeo anterior', () => {
    // Título e legenda do vídeo passado, em cima da transcrição de outro, fariam
    // a banca conferir uma promessa que não é daquele conteúdo.
    U.State.julgadorDraft = { conteudo: 'velho', visual: 'cena antiga', titulo: 'Título antigo', capa: 'capa', legenda: 'legenda', lote: 'nao mexer' };
    U.sendTextTo('julgador', 'a transcrição nova do vídeo, com bastante texto aqui');
    document.body.innerHTML = `<div id="toast-stack"></div><section id="view-julgador" class="mtabs-host" data-mtab="a">${recortar('view-julgador', 'j-history-backdrop')}</section>`;
    U.renderJulgador();
    const d = U.julgadorDraft();
    expect(d.titulo).toBe('');
    expect(d.visual).toBe('');
    expect(d.legenda).toBe('');
    expect(d.lote).toBe('nao mexer');   // outra aba: não é para mexer
  });
});

describe('texto vazio não vira envio', () => {
  it('não navega nem enfileira nada', () => {
    U.sendTextTo('causos', '   ');
    expect(globalThis.__foi).toBeNull();
    expect(U.State.handoff).toBeNull();
  });
});
