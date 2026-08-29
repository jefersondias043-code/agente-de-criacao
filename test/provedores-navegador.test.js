// A plataforma roda 100% no navegador — não há servidor nosso no meio. Os três
// provedores ACEITAM isso: é o padrão "cada usuário com a própria chave". Só que
// cada um cobra uma condição diferente, e errar a condição derruba a geração
// inteira:
//
//   • Groq       libera qualquer origem. Nada a fazer.
//   • Anthropic  libera SOB PEDIDO, com um cabeçalho próprio. Sem ele a chamada
//                é recusada e o fetch nem recebe resposta.
//   • OpenAI     libera a API, mas a família GPT-5 RECUSA 'temperature' no Chat
//                Completions e devolve 400 em cima disso.
//
// Falha de rede é outra história: o fetch é REJEITADO, sem status e sem corpo, e
// o navegador entrega um TypeError seco — "Load failed" no Safari, "Failed to
// fetch" no Chrome. Foi esse texto cru, em inglês, que chegou ao usuário. Este
// arquivo tranca as três pontas.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let S;
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  clearStorage();
  S = loadModules(['catalogs.js', 'core.js', 'llm.js'],
    ['callGroq', 'callOpenAI', 'callAnthropic', 'State']);
});
afterEach(() => { globalThis.fetch = fetchOriginal; });

/** Dublê que guarda como a chamada foi montada e devolve uma resposta boa. */
function espiaFetch(corpo) {
  const visto = {};
  globalThis.fetch = async (url, init) => {
    visto.url = url;
    visto.init = init;
    return { ok: true, status: 200, json: async () => corpo };
  };
  return visto;
}

/** Dublê da falha de REDE: o fetch rejeita, sem status e sem corpo — igual ao
 *  navegador quando o CORS barra o pedido ou a internet cai. */
function fetchQueRejeita() {
  globalThis.fetch = async () => { throw new TypeError('Load failed'); };
}

describe('cabeçalho que a Anthropic exige de quem chama do navegador', () => {
  it('vai em toda chamada à Anthropic', async () => {
    const visto = espiaFetch({ content: [{ text: 'oi' }] });
    await S.callAnthropic({ apiKey: 'sk-ant-x', model: 'claude-sonnet-5', prompt: 'oi' });
    expect(visto.init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });

  it('não atrapalha os cabeçalhos que já iam', async () => {
    const visto = espiaFetch({ content: [{ text: 'oi' }] });
    await S.callAnthropic({ apiKey: 'sk-ant-x', model: 'claude-sonnet-5', prompt: 'oi' });
    expect(visto.init.headers['x-api-key']).toBe('sk-ant-x');
    expect(visto.init.headers['anthropic-version']).toBe('2023-06-01');
  });

  it('a Groq não recebe o cabeçalho da Anthropic', async () => {
    // Cabeçalho estranho no pedido pode custar um preflight recusado de graça.
    const visto = espiaFetch({ choices: [{ message: { content: 'oi' } }] });
    await S.callGroq({ apiKey: 'gsk_x', model: 'openai/gpt-oss-120b', prompt: 'oi' });
    expect(visto.init.headers['anthropic-dangerous-direct-browser-access']).toBeUndefined();
  });
});

describe('parâmetros que a OpenAI aceita', () => {
  it('NÃO manda temperature — a família GPT-5 devolve 400 em cima dela', () => {
    // Este era o defeito real: toda geração pela OpenAI caía por causa de um
    // parâmetro que a plataforma mandava por hábito.
    const visto = espiaFetch({ choices: [{ message: { content: 'oi' } }] });
    return S.callOpenAI({ apiKey: 'sk-x', model: 'gpt-5.6-terra', prompt: 'oi' })
      .then(() => {
        expect(JSON.parse(visto.init.body)).not.toHaveProperty('temperature');
      });
  });

  it('manda o modelo e a mensagem do jeito que a API espera', async () => {
    const visto = espiaFetch({ choices: [{ message: { content: 'oi' } }] });
    await S.callOpenAI({ apiKey: 'sk-x', model: 'gpt-5.6-terra', prompt: 'era uma vez' });
    const corpo = JSON.parse(visto.init.body);
    expect(corpo.model).toBe('gpt-5.6-terra');
    expect(corpo.messages).toEqual([{ role: 'user', content: 'era uma vez' }]);
  });

  it.each([
    ['callGroq', 'gsk_x', 'openai/gpt-oss-120b', { choices: [{ message: { content: 'oi' } }] }],
    ['callAnthropic', 'sk-ant-x', 'claude-haiku-4-5', { content: [{ text: 'oi' }] }],
  ])('%s com modelo que aceita segue mandando temperature', async (fn, chave, modelo, resposta) => {
    const visto = espiaFetch(resposta);
    await S[fn]({ apiKey: chave, model: modelo, prompt: 'oi' });
    expect(JSON.parse(visto.init.body).temperature).toBe(0.6);
  });

  it('a Anthropic também recusa na linha Claude 5 — não é privilégio da OpenAI', async () => {
    // Foi o segundo provedor a aposentar o parâmetro, meses depois do primeiro.
    // Tratar isso como defeito só da OpenAI era o que fazia a falha voltar.
    const visto = espiaFetch({ content: [{ text: 'oi' }] });
    await S.callAnthropic({ apiKey: 'sk-ant-x', model: 'claude-sonnet-5', prompt: 'oi' });
    expect(JSON.parse(visto.init.body)).not.toHaveProperty('temperature');
  });
});

describe('falha de rede vira frase em português, não "Load failed"', () => {
  it.each([
    ['callGroq', 'gsk_x', /Groq/],
    ['callOpenAI', 'sk-x', /OpenAI/],
    ['callAnthropic', 'sk-ant-x', /Anthropic/],
  ])('%s nomeia o provedor e diz o que verificar', async (fn, chave, provedor) => {
    fetchQueRejeita();
    const chamada = S[fn]({ apiKey: chave, model: 'm', prompt: 'oi' });
    await expect(chamada).rejects.toThrow(provedor);
    await expect(chamada).rejects.toThrow(/conexão[\s\S]*bloqueador/i);
  });

  it('diz QUAL domínio liberar no bloqueador', async () => {
    // "Libere o domínio da API" não ajuda ninguém: o usuário precisa do nome.
    fetchQueRejeita();
    await expect(S.callOpenAI({ apiKey: 'sk-x', model: 'm', prompt: 'oi' }))
      .rejects.toThrow(/api\.openai\.com/);
  });

  it('nenhuma das mensagens repassa o texto cru do navegador', async () => {
    fetchQueRejeita();
    for (const [fn, chave] of [['callGroq', 'gsk_x'], ['callOpenAI', 'sk-x'], ['callAnthropic', 'sk-ant-x']]) {
      await expect(S[fn]({ apiKey: chave, model: 'm', prompt: 'oi' }))
        .rejects.not.toThrow(/Load failed|Failed to fetch/i);
    }
  });

  it('erro na LEITURA da resposta não vira "sem rede"', async () => {
    // Só o fetch entra no try. Um JSON quebrado é outra história, e disfarçá-la
    // de queda de conexão mandaria o usuário reiniciar o roteador à toa.
    globalThis.fetch = async () => ({
      ok: true, status: 200, json: async () => { throw new SyntaxError('JSON quebrado'); },
    });
    await expect(S.callGroq({ apiKey: 'gsk_x', model: 'openai/gpt-oss-120b', prompt: 'oi' }))
      .rejects.toThrow(/JSON quebrado/);
  });
});

describe('tela de Configurações', () => {
  /** Monta a tela de Configurações já no provedor pedido. */
  function telaDe(provider) {
    document.body.innerHTML = `
      <button class="s-provider-btn" data-provider="${provider}"></button>
      <div id="s-provider-config"></div>`;
    const T = loadModules(['catalogs.js', 'core.js', 'settings.js'],
      ['renderSettings', 'State']);
    T.State.provider = provider;
    T.renderSettings();
    return document.getElementById('s-provider-config').innerHTML;
  }

  it.each(['groq', 'openai', 'anthropic'])('%s oferece chave e modelo, sem aviso de incompatibilidade', (prov) => {
    // Houve uma versão que dizia à OpenAI "não funciona no navegador". Era
    // falso, e um aviso falso custa mais caro que aviso nenhum: manda o usuário
    // desistir de um provedor que funciona.
    const html = telaDe(prov);
    expect(html).toMatch(/Chave de API/);
    expect(html).not.toMatch(/não atende chamadas feitas direto do navegador/i);
  });
});
