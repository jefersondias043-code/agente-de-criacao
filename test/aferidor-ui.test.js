// AFERIDOR — a tela
//
// A vista é RECORTADA DO index.html, não escrita à mão aqui. É de propósito:
// um id que exista no JS e não no HTML (ou o contrário) é o defeito silencioso
// mais fácil de cometer ao criar uma ferramenta, e um DOM inventado no teste
// esconderia exatamente isso.
//
// O que estes testes protegem, além do óbvio, e a coisa mudou de lado:
//
// A TELA DO RESULTADO RESPONDE UMA PERGUNTA SÓ — posta ou não posta. Nada de
// nota, faixa, peso, barra ou placar de votos: quem terminou de gravar não quer
// analisar métrica, quer que a ferramenta analise por ele. Há um teste que
// falha se QUALQUER dígito reaparecer ali.
//
// A CONTA CONTINUA EXISTINDO, e continua auditável — dentro de "ver o que foi
// analisado", fechado. É a tese da ferramenta desde o primeiro dia e não se
// perdeu: mudou de camada. Os testes cobram as duas coisas ao mesmo tempo, e é
// essa tensão que eles existem para segurar.
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
      'media-transcode.js', 'ingest.js', 'aferidor-motor.js', 'aferidor-textos.js', 'aferidor.js'],
    ['State', 'renderAferidor', 'renderAferResultado', 'aferLimparResultado',
      'aferNovoConteudo', 'aferTemChave', 'aferAvisarSemChave', 'aferResultadoEmTexto',
      'consolidarRespostas', 'calcularAfericao', 'normalizarRodada', 'AFER_QUESTOES',
      'AFER_RODADAS_PADRAO', 'aferQuestao', 'STORAGE_KEYS',
      'AFER_FAIXAS', 'AFER_FALA', 'aferFala', 'aferConserto', 'aferForte',
      'aferRecomendacao', 'aferMotivo', 'aferPostar', 'aferEnumerar']);
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

describe('o resultado é um card: posta ou não posta', () => {
  /* O QUE ESTE BLOCO PROTEGE. A tela do resultado tem uma pergunta só a
   * responder, e a resposta cabe numa palavra. Toda vez que um número, uma
   * faixa, uma barra ou uma lista voltou para cá, ela voltou por um motivo que
   * parecia bom — e o autor perdeu de novo a resposta de vista. */

  /** O que está VISÍVEL: o card e mais nada. A auditoria vive fechada. */
  const visivel = () => {
    const area = document.getElementById('af-result-area').cloneNode(true);
    area.querySelectorAll('details, button').forEach((e) => e.remove());
    return area.textContent;
  };

  it('diz POSTE quando o conteúdo se sustenta', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    expect(document.querySelector('.afer-card-selo').textContent).toBe('POSTE');
    expect(document.querySelector('.afer-card').className).toMatch(/afer-card-sim/);
  });

  it('e NÃO POSTE quando não se sustenta', () => {
    const tudoErrado = {};
    U.AFER_QUESTOES.forEach((q) => { tudoErrado[q.id] = q.bom === 'sim' ? 'nao' : 'sim'; });
    U.renderAferResultado(item({ rodadas: [tudoErrado] }));
    expect(document.querySelector('.afer-card-selo').textContent).toBe('NÃO POSTE');
    expect(document.querySelector('.afer-card').className).toMatch(/afer-card-nao/);
  });

  it('nenhum número aparece na tela — nem nota, nem peso, nem placar', () => {
    // A trava principal desta versão. O usuário não quer analisar métrica.
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao', cta_artificial: 'sim' }] }));
    expect(visivel(), 'voltou número para a tela do resultado').not.toMatch(/\d/);
  });

  it('nem jargão de auditoria', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    expect(visivel()).not.toMatch(/quesito|peso|saldo|em jogo|consenso|×SIM|×NÃO|\/100/i);
  });

  it('o motivo explica em uma frase, com os pontos que mais pesaram', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    const motivo = document.querySelector('.afer-card-motivo').textContent;
    expect(motivo).toMatch(/^Ele /);
    expect(motivo, 'o motivo cita o acerto mais pesado')
      .toContain(U.aferFala({ id: 'abre_no_fato' }).curtoBom);
    expect(motivo.length, 'motivo comprido demais para ser lido de uma vez').toBeLessThan(260);
  });

  it('quem não posta ouve o que derrubou, na ordem do peso', () => {
    const tudoErrado = {};
    U.AFER_QUESTOES.forEach((q) => { tudoErrado[q.id] = q.bom === 'sim' ? 'nao' : 'sim'; });
    U.renderAferResultado(item({ rodadas: [tudoErrado] }));
    const motivo = document.querySelector('.afer-card-motivo').textContent;
    // Os dois quesitos de peso 10 são os primeiros que a frase cita.
    expect(motivo).toContain(U.aferFala({ id: 'abre_no_fato' }).curto);
    expect(motivo).toContain(U.aferFala({ id: 'entrega_algo' }).curto);
    expect(motivo).toMatch(/antes de publicar/i);
  });

  it('um "poste" com pendência NOMEIA a pendência principal', () => {
    /* Um conteúdo pode ser aprovado e ainda assim falhar no quesito mais pesado
     * do questionário. Resumir isso como "uns pontos menores" é a ferramenta
     * amaciando o que ela mesma mediu — e o autor descobre a diferença na hora
     * em que o vídeo não segura ninguém até o fim. */
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    const motivo = document.querySelector('.afer-card-motivo').textContent;
    expect(motivo).toContain(U.aferFala({ id: 'entrega_algo' }).curto);
    expect(motivo, 'o defeito mais pesado foi chamado de menor').not.toMatch(/menor/i);
  });

  it('e um "poste" sem pendência nenhuma diz isso', () => {
    U.renderAferResultado(item({}));
    const motivo = document.querySelector('.afer-card-motivo').textContent;
    expect(motivo).toMatch(/não ficou nada/i);
    expect(motivo, 'inventou pendência onde não havia').not.toMatch(/melhorar antes/i);
  });

  it('a frase se fecha mesmo quando não há o que citar dos dois lados', () => {
    // Passou em tudo: não há defeito a citar. Errou tudo: não há acerto.
    // Nos dois casos a enumeração vem vazia e a frase sairia truncada.
    const enumeracaoVazia = { faixa: { id: 'alto' }, avaliadas: [], perdidos: [] };
    expect(U.aferMotivo(enumeracaoVazia)).toMatch(/passou em tudo/i);
    const semAcerto = { faixa: { id: 'baixo' }, avaliadas: [], perdidos: [] };
    expect(U.aferMotivo(semAcerto)).toMatch(/não se sustenta/i);
  });

  it('a régua sai da faixa do motor, não de um número solto na tela', () => {
    U.AFER_FAIXAS.forEach((f) => {
      const r = U.aferRecomendacao({ faixa: f, avaliadas: [], perdidos: [] });
      expect(r.selo, `faixa ${f.id} sem selo`).toMatch(/^(POSTE|NÃO POSTE)$/);
      expect(r.postar, `faixa ${f.id} decidiu fora da régua`)
        .toBe(f.id === 'alto' || f.id === 'bom');
    });
  });
});

describe('a conta continua inteira — uma camada abaixo', () => {
  it('a conta e as duas parcelas estão na auditoria', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    const conta = document.querySelector('.afer-conta');
    expect(conta, 'sem a conta, a ferramenta é só outro número de IA').toBeTruthy();
    expect(conta.textContent).toMatch(/\+125 ganhos − 10 perdidos = \+115 de 135 em jogo/);
    expect(conta.textContent).toMatch(/quesitos verificados/);
    expect(conta.closest('.afer-auditoria'), 'a conta tem de morar dentro da auditoria').toBeTruthy();
  });

  it('nota negativa aparece com o menos, não escondida', () => {
    const tudoErrado = {};
    U.AFER_QUESTOES.forEach((q) => { tudoErrado[q.id] = q.bom === 'sim' ? 'nao' : 'sim'; });
    U.renderAferResultado(item({ rodadas: [tudoErrado] }));
    expect(document.querySelector('.afer-nota-valor').textContent).toBe('−100');
    expect(document.querySelector('.afer-nota-valor').closest('.afer-auditoria'),
      'a nota tem de morar dentro da auditoria').toBeTruthy();
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

  it('sem nada perdido, diz isso em vez de mostrar uma lista vazia', () => {
    U.renderAferResultado(item({}));
    expect(document.querySelector('.afer-acao')).toBeFalsy();
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

  it('a auditoria diz que a IA não viu os pesos — é a promessa da ferramenta', () => {
    U.renderAferResultado(item({}));
    const det = document.querySelector('.afer-auditoria');
    expect(det.textContent).toMatch(/sem ver os pesos/i);
  });
});

describe('"o que melhorar" diz o que FAZER', () => {
  /* A lista antiga exibia o texto da PERGUNTA do questionário, que é escrita
   * para ser respondida por uma IA, não lida por quem acabou de gravar. Estes
   * testes travam a tradução — e travam que ela não é enfeite solto: a ordem
   * continua sendo a do peso, que é a mesma prioridade de antes. */

  it('cada linha é a ação, não a pergunta do questionário', () => {
    U.renderAferResultado(item({ rodadas: [{ sem_preambulo: 'sim' }] }));
    const acao = document.querySelector('.afer-acao-texto');
    const pergunta = U.aferQuestao('sem_preambulo').pergunta;
    expect(acao.textContent).toBe(U.aferConserto({ id: 'sem_preambulo' }));
    expect(acao.textContent, 'a pergunta crua voltou para a tela').not.toBe(pergunta);
  });

  it('a ordem continua sendo a do peso — o que mais muda vem primeiro', () => {
    // Sem o peso escrito na linha, a ORDEM é o que restou da prioridade. Se ela
    // se perder, a lista deixa de responder "o que eu conserto primeiro".
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao', cta_artificial: 'sim', frase_de_ia: 'sim' }] }));
    const textos = [...document.querySelectorAll('.afer-acao-texto')].map((e) => e.textContent);
    expect(textos).toEqual([
      U.aferConserto({ id: 'entrega_algo' }),   // peso 10
      U.aferConserto({ id: 'frase_de_ia' }),    // peso 4
      U.aferConserto({ id: 'cta_artificial' }), // peso 3
    ]);
  });

  it('e a numeração acompanha, com destaque no primeiro', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao', cta_artificial: 'sim' }] }));
    const nums = [...document.querySelectorAll('.afer-acao-num')].map((e) => e.textContent);
    expect(nums).toEqual(['1', '2']);
    const primeira = document.querySelector('.afer-acao');
    expect(primeira.className).toMatch(/afer-acao-primeira/);
  });

  it('nenhum peso, saldo ou placar de votos vaza para a lista', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    const secao = [...document.querySelectorAll('.afer-secao')]
      .find((s) => /O que melhorar/.test(s.textContent));
    expect(secao.textContent).not.toMatch(/peso|×SIM|×NÃO|pontua com|em jogo/i);
  });

  it('TODA pergunta do motor tem as duas frases escritas', () => {
    // O fallback devolve a pergunta crua para a tela não quebrar. Ele é cinto de
    // segurança, não o caminho normal — quem acrescentar uma pergunta ao motor
    // precisa saber, aqui, que falta escrever a fala dela.
    U.AFER_QUESTOES.forEach((q) => {
      expect(U.AFER_FALA[q.id], `"${q.id}" não tem fala humana em aferidor-textos.js`).toBeTruthy();
      expect(U.aferConserto(q), `"${q.id}" sem conserto`).not.toBe(q.pergunta);
      expect(U.aferForte(q), `"${q.id}" sem elogio`).not.toBe(q.pergunta);
    });
  });
});

describe('"o que já está bom" também aparece', () => {
  it('lista os acertos mais pesados, para a tela não ser só defeito', () => {
    U.renderAferResultado(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    const fortes = [...document.querySelectorAll('.afer-forte')].map((e) => e.textContent.trim());
    expect(fortes.length).toBeGreaterThan(0);
    expect(fortes[0], 'o acerto mais pesado vem primeiro').toBe(U.aferForte({ id: 'abre_no_fato' }));
  });

  it('e diz quantos ficaram de fora, em vez de sumir com eles', () => {
    U.renderAferResultado(item({}));
    const secao = [...document.querySelectorAll('.afer-secao')]
      .find((s) => /O que já está bom/.test(s.textContent));
    expect(secao.textContent).toMatch(/E mais \d+ pontos? que passaram?/);
  });

  it('sem acerto nenhum, a seção não aparece vazia', () => {
    const tudoErrado = {};
    U.AFER_QUESTOES.forEach((q) => { tudoErrado[q.id] = q.bom === 'sim' ? 'nao' : 'sim'; });
    U.renderAferResultado(item({ rodadas: [tudoErrado] }));
    expect(document.querySelector('.afer-forte')).toBeFalsy();
  });
});

describe('a divergência entre as leituras aparece', () => {
  const apertado = () => item({ rodadas: [{}, {}, { entrega_algo: 'nao' }, { entrega_algo: 'nao' }, {}] });

  it('o placar exato continua na auditoria', () => {
    U.renderAferResultado(apertado());
    const d = document.querySelector('.afer-divergente');
    expect(d, 'a divergência sumiu da tela').toBeTruthy();
    expect(d.textContent).toMatch(/3×SIM · 2×NÃO/);
    expect(d.closest('.afer-auditoria'), 'o placar é auditoria, não recado').toBeTruthy();
  });

  it('e vira um aviso em português colado na correção correspondente', () => {
    // Era uma segunda lista, que obrigava a cruzar as duas para descobrir que
    // uma das correções pedidas estava no fio. Colada no item, a informação
    // chega na hora de decidir se mexe naquilo.
    U.renderAferResultado(item({ rodadas: [{ repeticao: 'sim' }, { repeticao: 'sim' }, {}] }));
    const aviso = document.querySelector('.afer-acao-duvida');
    expect(aviso, 'a divergência não chegou até a correção').toBeTruthy();
    expect(aviso.textContent).toMatch(/divididas/i);
    expect(aviso.textContent, 'o placar cru voltou para a tela principal').not.toMatch(/\d/);
  });

  it('e some quando todas concordaram', () => {
    U.renderAferResultado(item({ rodadas: [{}, {}, {}] }));
    expect(document.querySelector('.afer-divergente')).toBeFalsy();
    expect(document.querySelector('.afer-acao-duvida')).toBeFalsy();
  });

  it('a divergência NÃO muda a resposta — só avisa', () => {
    const it3 = apertado();
    const q = it3.resultado.questoes.find((x) => x.id === 'entrega_algo');
    expect(q.resposta).toBe('sim');
    expect(q.acertou).toBe(true);
    U.renderAferResultado(it3);
    expect(document.querySelector('.afer-acao'), 'quesito ganho virou correção').toBeFalsy();
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
    expect(document.querySelector('.afer-card')).toBeTruthy();
    const c = document.getElementById('af-conteudo');
    c.value = 'outro texto';
    c.dispatchEvent(new Event('input', { bubbles: true }));
    expect(document.querySelector('.afer-card'), 'resultado velho ficou sobre conteúdo novo').toBeFalsy();
  });
});

describe('o histórico', () => {
  it('guarda, lista e reabre', () => {
    const it1 = item({ rodadas: [{ entrega_algo: 'nao' }] });
    U.State.afericoes = [it1];
    U.renderAferidor();
    const linha = document.querySelector('[data-afer-id="a1"]');
    expect(linha, 'a aferição não apareceu no histórico').toBeTruthy();
    expect(linha.textContent, 'o histórico voltou a listar nota em vez da resposta').toMatch(/POSTE/);
    linha.click();
    expect(document.getElementById('af-conteudo').value).toBe('o conteúdo aferido');
    expect(document.querySelector('.afer-card')).toBeTruthy();
  });

  it('vazio, avisa em vez de mostrar nada', () => {
    U.renderAferidor();
    expect(document.getElementById('af-history-list').textContent).toMatch(/nada aferido ainda/i);
  });
});

describe('o resultado copiável carrega a conta junto', () => {
  it('leva a resposta, o motivo e o que ajustar — nada além disso', () => {
    /* Quem copia manda para o editor ou cola no grupo da equipe. O outro lado
     * precisa saber se sobe e o que mexer; conta, blocos e placar de votos não
     * viram trabalho para ninguém. */
    const texto = U.aferResultadoEmTexto(item({ rodadas: [{ entrega_algo: 'nao' }] }));
    expect(texto.split('\n')[0]).toBe('POSTE');
    expect(texto).toContain(U.aferConserto({ id: 'entrega_algo' }));
    expect(texto).toMatch(/O QUE AJUSTAR/);
    expect(texto, 'a planilha voltou para o texto copiado')
      .not.toMatch(/em jogo|ganhos|perdidos|quesito|\/100|×SIM/i);
  });

  it('sem nada a ajustar, não cola uma seção vazia', () => {
    const texto = U.aferResultadoEmTexto(item({}));
    expect(texto).toMatch(/^POSTE/);
    expect(texto).not.toMatch(/O QUE AJUSTAR/);
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
