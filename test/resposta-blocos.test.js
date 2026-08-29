// LER A RESPOSTA DE UM MODELO QUE RACIOCINA
//
// A resposta da Anthropic é uma LISTA de blocos. Isso nunca importou enquanto
// os modelos respondiam direto: o texto era o primeiro item, e ler
// content[0].text funcionava.
//
// Na linha Claude 5 o raciocínio vem LIGADO por padrão, e o primeiro bloco
// passa a ser um 'thinking' — de conteúdo vazio, porque a Anthropic não devolve
// o raciocínio cru. A plataforma então anunciava "Resposta vazia" para uma
// resposta que estava toda ali, um bloco adiante. Foi o que travou a ferramenta
// Causos na primeira etapa: quanto mais elaborado o pedido, mais o modelo pensa
// antes de escrever.
//
// Junto vem a segunda metade da lição: resposta sem texto tem CAUSAS
// diferentes, e "vazia" não é diagnóstico. O motivo está no stop_reason.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let S;
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  clearStorage();
  S = loadModules(['catalogs.js', 'core.js', 'llm.js'],
    ['callGroq', 'callOpenAI', 'callAnthropic', 'textoAnthropic', 'motivoRespostaVazia']);
});
afterEach(() => { globalThis.fetch = fetchOriginal; });

const responde = (corpo) => {
  const visto = {};
  globalThis.fetch = async (url, init) => {
    visto.init = init;
    return { ok: true, status: 200, json: async () => corpo };
  };
  return visto;
};

describe('o texto é achado mesmo quando não é o primeiro bloco', () => {
  it('bloco de raciocínio na frente não esconde a resposta', async () => {
    // O caso REAL que travou o Causos.
    responde({ content: [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: 'Era uma vez um causo.' },
    ] });
    const r = await S.callAnthropic({ apiKey: 'k', model: 'claude-sonnet-5', prompt: 'oi' });
    expect(r.content).toBe('Era uma vez um causo.');
  });

  it('texto partido em vários blocos volta inteiro, na ordem', async () => {
    responde({ content: [
      { type: 'thinking', thinking: '' },
      { type: 'text', text: 'Primeira parte. ' },
      { type: 'text', text: 'Segunda parte.' },
    ] });
    const r = await S.callAnthropic({ apiKey: 'k', model: 'claude-sonnet-5', prompt: 'oi' });
    expect(r.content).toBe('Primeira parte. Segunda parte.');
  });

  it('bloco de tipo desconhecido é ignorado, não derruba a leitura', () => {
    // O que eu não sei ler, eu ignoro — em vez de tropeçar num tipo que a
    // Anthropic ainda vai inventar.
    expect(S.textoAnthropic({ content: [
      { type: 'tipo_que_ainda_nao_existe', dados: {} },
      { type: 'text', text: 'vale' },
    ] })).toBe('vale');
  });

  it('o formato antigo, com o texto na frente, continua funcionando', async () => {
    responde({ content: [{ type: 'text', text: 'direto ao ponto' }] });
    const r = await S.callAnthropic({ apiKey: 'k', model: 'claude-haiku-4-5', prompt: 'oi' });
    expect(r.content).toBe('direto ao ponto');
  });

  it.each([
    [{ content: [] }, 'lista vazia'],
    [{ content: [{ type: 'thinking', thinking: '' }] }, 'só raciocínio'],
    [{}, 'sem campo content'],
    [{ content: 'texto solto' }, 'content que não é lista'],
  ])('%#: %s não quebra a leitura', (corpo) => {
    expect(S.textoAnthropic(corpo)).toBe('');
  });
});

describe('resposta sem texto explica POR QUE', () => {
  it('cortada no limite de tamanho: diz isso e o que fazer', async () => {
    // Com raciocínio ligado, o pensamento sai do mesmo orçamento de tokens —
    // este caso deixou de ser teórico.
    responde({ content: [{ type: 'thinking', thinking: '' }], stop_reason: 'max_tokens' });
    await expect(S.callAnthropic({ apiKey: 'k', model: 'claude-sonnet-5', prompt: 'oi' }))
      .rejects.toThrow(/limite de tamanho[\s\S]*mais curto/i);
  });

  it('recusa do modelo: diz que foi recusa, com a categoria', async () => {
    responde({ content: [], stop_reason: 'refusal', stop_details: { category: 'cyber' } });
    await expect(S.callAnthropic({ apiKey: 'k', model: 'claude-sonnet-5', prompt: 'oi' }))
      .rejects.toThrow(/recusou este pedido \(cyber\)/i);
  });

  it('sem motivo conhecido, aí sim "resposta vazia"', async () => {
    responde({ content: [], stop_reason: 'end_turn' });
    await expect(S.callAnthropic({ apiKey: 'k', model: 'claude-sonnet-5', prompt: 'oi' }))
      .rejects.toThrow('Resposta vazia da Anthropic.');
  });

  it.each([
    ['callGroq', 'Groq'],
    ['callOpenAI', 'OpenAI'],
  ])('%s também explica o corte por tamanho', async (fn, nome) => {
    responde({ choices: [{ message: { content: '' }, finish_reason: 'length' }] });
    await expect(S[fn]({ apiKey: 'k', model: 'm', prompt: 'oi' }))
      .rejects.toThrow(new RegExp(`${nome}[\\s\\S]*limite de tamanho`, 'i'));
  });
});

describe('espaço para pensar E escrever', () => {
  it('o pedido à Anthropic reserva bem mais que os 4096 de antes', async () => {
    // Nos modelos que raciocinam o pensamento sai do MESMO max_tokens. Com
    // 4096 o modelo gastava a cota pensando e sobrava pouco ou nada de texto.
    const visto = responde({ content: [{ type: 'text', text: 'ok' }] });
    await S.callAnthropic({ apiKey: 'k', model: 'claude-sonnet-5', prompt: 'oi' });
    expect(JSON.parse(visto.init.body).max_tokens).toBeGreaterThanOrEqual(16000);
  });
});
