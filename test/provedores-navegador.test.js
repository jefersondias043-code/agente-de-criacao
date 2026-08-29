// A plataforma roda 100% no navegador — não há servidor nosso no meio. Isso faz
// do CORS uma regra de PRODUTO, não um detalhe: o navegador só deixa a página
// falar com um domínio que autorize por cabeçalho.
//
//   • Groq       autoriza qualquer origem. Foi por isso que a plataforma nasceu
//                em cima dela.
//   • Anthropic  autoriza SOB PEDIDO, com um cabeçalho próprio. Sem ele a
//                chamada é recusada e o fetch nem recebe resposta.
//   • OpenAI     NÃO autoriza. Nenhum cabeçalho resolve.
//
// Falha de rede não vem com status nem com corpo: o fetch é REJEITADO e o
// navegador entrega um TypeError seco — "Load failed" no Safari, "Failed to
// fetch" no Chrome. Foi exatamente esse texto cru, em inglês, que chegou ao
// usuário depois de ele configurar uma chave da OpenAI. Este arquivo tranca as
// três pontas: o cabeçalho que a Anthropic exige, a tradução da falha de rede e
// o aviso na tela antes de o usuário gastar com uma chave que não vai funcionar.
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

describe('falha de rede vira frase em português, não "Load failed"', () => {
  it('a OpenAI explica que o bloqueio é do navegador, não da chave', async () => {
    // O usuário acabou de criar a chave e pôr crédito. Se a mensagem não disser
    // de quem é a culpa, ele vai procurar o defeito no lugar errado.
    fetchQueRejeita();
    await expect(S.callOpenAI({ apiKey: 'sk-x', model: 'gpt-5.6-terra', prompt: 'oi' }))
      .rejects.toThrow(/navegador/i);
  });

  it('a mensagem da OpenAI inocenta a chave e aponta a saída', async () => {
    fetchQueRejeita();
    await expect(S.callOpenAI({ apiKey: 'sk-x', model: 'gpt-5.6-terra', prompt: 'oi' }))
      .rejects.toThrow(/não é problema da sua chave[\s\S]*Groq ou Anthropic/i);
  });

  it.each([
    ['callGroq', 'gsk_x', 'openai/gpt-oss-120b', /Groq[\s\S]*conexão/i],
    ['callAnthropic', 'sk-ant-x', 'claude-sonnet-5', /Anthropic[\s\S]*conexão/i],
  ])('%s manda verificar a conexão', async (fn, chave, modelo, esperado) => {
    fetchQueRejeita();
    await expect(S[fn]({ apiKey: chave, model: modelo, prompt: 'oi' }))
      .rejects.toThrow(esperado);
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

describe('aviso na tela de Configurações', () => {
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

  it('a OpenAI avisa que não funciona pelo navegador, antes de pedir a chave', () => {
    // Sem isto o usuário só descobre depois de criar a chave e pôr crédito.
    const html = telaDe('openai');
    expect(html).toMatch(/não atende chamadas feitas direto do navegador/i);
    expect(html).toMatch(/Groq/);
  });

  it.each(['groq', 'anthropic'])('o provedor %s não recebe esse aviso', (prov) => {
    expect(telaDe(prov)).not.toMatch(/não atende chamadas feitas direto do navegador/i);
  });
});
