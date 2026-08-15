// AFERIDOR — a tela
//
// A vista é RECORTADA DO index.html, não escrita à mão aqui. É de propósito:
// um id que exista no JS e não no HTML (ou o contrário) é o defeito silencioso
// mais fácil de cometer ao criar uma ferramenta, e um DOM inventado no teste
// esconderia exatamente isso.
//
// O que estes testes protegem, além do óbvio: a tela precisa MOSTRAR A CONTA.
// Uma ferramenta cuja tese é "a nota é auditável" e que exibe só o número
// perdeu a razão de existir ao lado do Julgador.
import { describe, it, expect, beforeAll, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules, clearStorage } from './helpers/load.mjs';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const html = readFileSync(join(raiz, 'index.html'), 'utf8');

let U;
beforeAll(() => {
  clearStorage();
  U = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'media-transcode.js', 'ingest.js', 'aferidor-motor.js', 'aferidor.js'],
    ['State', 'renderAferidor', 'renderAferResultado', 'aferLimparResultado',
      'aferNovoConteudo', 'aferTemChave', 'aferAvisarSemChave', 'aferResultadoEmTexto',
      'consolidarRespostas', 'calcularAfericao', 'normalizarRodada', 'AFER_QUESTOES',
      'AFER_RODADAS_PADRAO', 'aferQuestao', 'STORAGE_KEYS']);
});

/** Recorta a vista do Aferidor do index.html e monta no documento do teste. */
const montarTela = () => {
  const inicio = html.indexOf('id="view-aferidor"');
  const fim = html.indexOf('id="view-settings"');
  expect(inicio, 'a vista do Aferidor não está no index.html').toBeGreaterThan(-1);
  expect(fim).toBeGreaterThan(inicio);
  const trecho = html.slice(inicio, fim);
  document.body.innerHTML =
    `<div id="toast-stack"></div><section>${trecho.slice(trecho.indexOf('>') + 1)}</section>`;
};

/** Uma aferição pronta, com `over` trocando respostas por id. */
const item = (over, extra) => {
  const qs = U.AFER_QUESTOES;
  const rodadas = (over && over.rodadas) || [{}];
  const mapas = rodadas.map((r) => U.normalizarRodada({
    respostas: qs.map((q) => ({ id: q.id, resposta: r[q.id] || q.bom })),
  }, qs));
  const resultado = U.calcularAfericao(U.consolidarRespostas(mapas, qs), { rodadas: mapas.length });
  return {
    id: 'a1', createdAt: new Date().toISOString(), nome: 'Vídeo do carro',
    conteudo: 'o conteúdo aferido', visual: '', embalagem: {},
    rodadasPedidas: mapas.length, rodadasValidas: mapas.length,
    resultado, ...(extra || {}),
  };
};

const tela = () => document.getElementById('af-result-area').textContent;

beforeEach(() => {
  clearStorage();
  U.State.afericoes = [];
  U.State.aferidorDraft = null;
  U.State.apiKeys = { groq: 'chave' };
  U.State.provider = 'groq';
  montarTela();
});

describe('a tela existe e casa com o HTML', () => {
  it('renderAferidor roda sem erro sobre a vista real', () => {
    expect(() => U.renderAferidor()).not.toThrow();
  });

  it('todos os campos que o JS procura existem no HTML', () => {
    U.renderAferidor();
    ['af-conteudo', 'af-visual', 'af-titulo', 'af-legenda', 'af-rodadas',
      'af-submit', 'af-novo', 'af-result-area', 'af-api-warning',
      'af-attach-input', 'af-attach-btn', 'af-attach-pending',
      'af-history-open', 'af-history-close', 'af-history-clear', 'af-history-list',
      'af-history-drawer', 'af-history-backdrop'].forEach((id) => {
      expect(document.getElementById(id), `#${id} não está no index.html`).toBeTruthy();
    });
  });

  it('o seletor de leituras vem do registro, só com números ímpares', () => {
    U.renderAferidor();
    const sel = document.getElementById('af-rodadas');
    const valores = [...sel.options].map((o) => Number(o.value));
    expect(valores.length).toBeGreaterThan(1);
    valores.forEach((n) => expect(n % 2, `${n} é par`).toBe(1));
    expect(Number(sel.value)).toBe(U.AFER_RODADAS_PADRAO);
  });

  it('sem chave, abrir a ferramenta não mostra aviso — o aviso é na hora de trabalhar', () => {
    U.State.apiKeys = {};
    U.renderAferidor();
    const a = document.getElementById('af-api-warning');
    expect(a.classList.contains('hidden')).toBe(true);
    U.aferAvisarSemChave();
    expect(a.classList.contains('hidden')).toBe(false);
  });
});

describe('o resultado mostra a CONTA, não só o número', () => {
  it('a nota vem com sinal e com as DUAS parcelas da conta ao lado', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    expect(document.querySelector('.afer-nota-valor').textContent,
      'o sinal é o que separa "ganha mais do que perde" de "perde mais do que ganha"').toBe('+85');
    const conta = document.querySelector('.afer-conta').textContent;
    expect(conta, 'sem a conta, a ferramenta é só outro número de IA').toMatch(/\+125 ganhos − 10 perdidos = \+115 de 135 em jogo/);
    expect(conta).toMatch(/quesitos verificados/);
  });

  it('nota negativa aparece com o menos, não escondida', () => {
    const tudoErrado = {};
    U.AFER_QUESTOES.forEach((q) => { tudoErrado[q.id] = q.bom === 'sim' ? 'nao' : 'sim'; });
    U.renderAferResultado(item({ rodadas: [tudoErrado] }));
    expect(document.querySelector('.afer-nota-valor').textContent).toBe('−100');
    expect(document.querySelector('.afer-cabeca').className).toMatch(/afer-vermelho/);
  });

  it('a largura da barra mapeia a escala inteira, de −100 a +100', () => {
    /* A largura vinha de `Math.max(2, nota)`, que só funciona numa escala
     * 0..100. Numa escala com negativo ela achata TUDO abaixo de 2 no mesmo
     * traço: um bloco em −100 e um em 0 ficam idênticos na tela.
     *
     * O caso que separa as duas fórmulas é o valor INTERMEDIÁRIO — em −100 as
     * duas dão o mínimo, e em +100 as duas dão 100. Por isso o teste usa um
     * bloco de saldo pequeno: `abertura` erra só a pergunta de peso 10 das
     * três (10+7+7), ficando em +17, onde a fórmula certa dá 59% e a antiga
     * daria 17%. */
    U.renderAferResultado(item({ rodadas: [{ abre_no_fato: 'nao' }] }));
    const abertura = [...document.querySelectorAll('.afer-bloco')]
      .find((e) => /Abertura/.test(e.textContent));
    expect(abertura.querySelector('.afer-bloco-nota').textContent).toBe('+17');
    const w = parseFloat(abertura.querySelector('.afer-bloco-preenche').style.width);
    expect(w, 'a largura tem de medir a distância do pior caso, não a nota crua')
      .toBe(Math.round((17 + 100) / 2));
  });

  it('e um bloco no fundo da escala fica no mínimo, sem largura negativa', () => {
    const tudoErrado = {};
    U.AFER_QUESTOES.forEach((q) => { tudoErrado[q.id] = q.bom === 'sim' ? 'nao' : 'sim'; });
    U.renderAferResultado(item({ rodadas: [tudoErrado] }));
    const barras = [...document.querySelectorAll('.afer-bloco-preenche')];
    expect(barras.length).toBeGreaterThan(0);
    barras.forEach((b) => {
      expect(parseFloat(b.style.width), 'largura negativa não existe em CSS').toBeGreaterThanOrEqual(0);
      expect(b.className, 'bloco negativo precisa da cor de alerta').toMatch(/afer-faixa-baixo/);
    });
  });

  it('cada bloco mostra as duas parcelas dele', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    const entrega = [...document.querySelectorAll('.afer-bloco')]
      .find((e) => /Entrega e final/.test(e.textContent));
    expect(entrega.textContent).toMatch(/\+22 − 10 de 32 em jogo/);
    expect(entrega.querySelector('.afer-bloco-nota').textContent).toBe('+38');
  });

  it('"onde a nota foi embora" lista os quesitos perdidos, do mais caro ao mais barato', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao', cta_artificial: 'sim', frase_de_ia: 'sim' }] }));
    const pesos = [...document.querySelectorAll('.afer-perdido-peso')]
      .map((e) => Number(e.textContent.replace(/[^\d]/g, '')));
    expect(pesos).toEqual([10, 4, 3]);
    for (let i = 1; i < pesos.length; i++) expect(pesos[i - 1]).toBeGreaterThanOrEqual(pesos[i]);
  });

  it('e cada linha diz quanto custou', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    const linha = document.querySelector('.afer-perdido').textContent;
    expect(linha).toMatch(/−?10/);
    expect(linha).toMatch(/respondido/i);
  });

  it('sem nada perdido, diz isso em vez de mostrar uma lista vazia', () => {
    U.renderAferResultado(item({}));
    expect(document.querySelector('.afer-perdido')).toBeFalsy();
    expect(tela()).toMatch(/passou em tudo que foi verificado/i);
  });

  it('o questionário inteiro fica disponível, recolhido — é a auditoria', () => {
    U.renderAferResultado(item({}));
    const det = [...document.querySelectorAll('details')]
      .find((d) => /questionário/i.test(d.textContent));
    expect(det, 'sem o questionário não há o que auditar').toBeTruthy();
    expect(det.hasAttribute('open'), 'quem quer saber o que fazer não quer a planilha aberta').toBe(false);
    expect(document.querySelectorAll('.afer-q').length).toBe(U.AFER_QUESTOES.length);
  });

  it('cada linha da auditoria mostra resposta, votos e peso', () => {
    U.renderAferResultado(item({ rodadas: [{}, {}, {}] }));
    const linha = document.querySelector('.afer-q').textContent;
    expect(linha).toMatch(/SIM|NÃO/);
    expect(linha).toMatch(/3\/3 sim/);
    expect(linha).toMatch(/peso \d+/);
  });

  it('a tela diz que a IA não viu os pesos — é a promessa da ferramenta', () => {
    U.renderAferResultado(item({}));
    expect(tela()).toMatch(/sem ver os pesos/i);
  });
});

describe('a divergência entre as leituras aparece', () => {
  const apertado = () => item({ rodadas: [{}, {}, { entrega_algo: 'nao' }, { entrega_algo: 'nao' }, {}] });

  it('mostra o placar dos votos quando as leituras não foram unânimes', () => {
    U.renderAferResultado(apertado());
    const d = document.querySelector('.afer-divergente');
    expect(d, 'a divergência sumiu da tela').toBeTruthy();
    expect(d.textContent).toMatch(/3×SIM · 2×NÃO/);
  });

  it('e some quando todas concordaram', () => {
    U.renderAferResultado(item({ rodadas: [{}, {}, {}] }));
    expect(document.querySelector('.afer-divergente')).toBeFalsy();
  });

  it('a divergência NÃO muda a resposta — só avisa', () => {
    const it3 = apertado();
    const q = it3.resultado.questoes.find((x) => x.id === 'entrega_algo');
    expect(q.resposta).toBe('sim');
    expect(q.acertou).toBe(true);
    U.renderAferResultado(it3);
    expect(document.querySelector('.afer-perdido'), 'quesito ganho virou perda').toBeFalsy();
  });
});

describe('o rascunho e o botão Novo', () => {
  beforeEach(() => U.renderAferidor());

  it('cada campo guarda sozinho', () => {
    const c = document.getElementById('af-conteudo');
    c.value = 'o roteiro do vídeo';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    expect(U.State.aferidorDraft.conteudo).toBe('o roteiro do vídeo');
  });

  it('o número de leituras também, e por `change` (é um select)', () => {
    const sel = document.getElementById('af-rodadas');
    sel.value = '7';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    expect(U.State.aferidorDraft.rodadas).toBe('7');
  });

  it('tudo volta ao reabrir a ferramenta', () => {
    const c = document.getElementById('af-conteudo');
    c.value = 'texto guardado';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    const sel = document.getElementById('af-rodadas');
    sel.value = '3';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    montarTela();
    U.renderAferidor();
    expect(document.getElementById('af-conteudo').value).toBe('texto guardado');
    expect(document.getElementById('af-rodadas').value).toBe('3');
  });

  it('"Novo" limpa o conteúdo mas PRESERVA o número de leituras', () => {
    const sel = document.getElementById('af-rodadas');
    sel.value = '7';
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    const c = document.getElementById('af-conteudo');
    c.value = 'texto qualquer';
    c.dispatchEvent(new Event('input', { bubbles: true }));

    U.aferNovoConteudo(true);
    expect(document.getElementById('af-conteudo').value).toBe('');
    expect(document.getElementById('af-rodadas').value, 'configuração da sessão, não do conteúdo').toBe('7');
  });

  it('o rascunho GUARDADO também é limpo, senão volta ao recarregar', () => {
    const c = document.getElementById('af-conteudo');
    c.value = 'texto que precisa sumir';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    U.aferNovoConteudo(true);
    const guardado = JSON.parse(localStorage.getItem(U.STORAGE_KEYS.aferidorDraft) || '{}');
    expect(guardado.conteudo).toBe('');
  });

  it('mexer no conteúdo tira o resultado da tela — ele é da versão anterior', () => {
    U.renderAferResultado(item({}));
    expect(document.querySelector('.afer-cabeca')).toBeTruthy();
    const c = document.getElementById('af-conteudo');
    c.value = 'outro texto';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('.afer-cabeca'), 'resultado velho ficou sobre conteúdo novo').toBeFalsy();
  });
});

describe('o histórico', () => {
  it('guarda, lista e reabre', () => {
    const it1 = item({ rodadas: [{ entrega_algo: 'nao' }] });
    U.State.afericoes = [it1];
    U.renderAferidor();
    const linha = document.querySelector('[data-afer-id="a1"]');
    expect(linha, 'a aferição não apareceu no histórico').toBeTruthy();
    expect(linha.textContent).toMatch(/\+85\/100/);
    linha.click();
    expect(document.getElementById('af-conteudo').value).toBe('o conteúdo aferido');
    expect(document.querySelector('.afer-cabeca')).toBeTruthy();
  });

  it('vazio, avisa em vez de mostrar nada', () => {
    U.renderAferidor();
    expect(document.getElementById('af-history-list').textContent).toMatch(/nada aferido ainda/i);
  });
});

describe('o resultado copiável carrega a conta junto', () => {
  it('leva nota, conta, perdidos e a frase que separa a IA do cálculo', () => {
    const texto = U.aferResultadoEmTexto(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    expect(texto).toMatch(/\+85\/100/);
    expect(texto).toMatch(/\+125 ganhos − 10 perdidos = \+115 de 135 em jogo/);
    expect(texto).toMatch(/ONDE A NOTA FOI EMBORA/);
    expect(texto).toMatch(/apenas SIM ou NÃO/);
  });

  it('o botão copiar copia — clicado de verdade', async () => {
    const caixa = { texto: null };
    Object.defineProperty(navigator, 'clipboard',
      { value: { writeText: async (t) => { caixa.texto = t; } }, configurable: true });
    U.renderAferResultado(item({}));
    document.getElementById('af-result-copy').click();
    await new Promise((r) => setTimeout(r, 20));
    expect(caixa.texto, 'o clique não copiou nada').toBeTruthy();
    expect(document.getElementById('toast-stack').textContent).toMatch(/copiado/i);
  });
});
