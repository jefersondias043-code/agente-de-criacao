// ENDEREÇO DA API CONFIGURÁVEL
//
// Servidor de IA não se molda a aplicativo. O padrão que o mercado adotou para
// isso é o base URL configurável: o cliente guarda um endereço, e tudo que muda
// entre um provedor e outro — região, gateway, proxy, servidor compatível —
// vira configuração em vez de código novo.
//
// O que este arquivo protege:
//   1. o endereço salvo é REALMENTE usado na chamada (senão o campo é enfeite);
//   2. vazio continua caindo no padrão de fábrica, para que a troca de endereço
//      oficial chegue sozinha a quem nunca mexeu no campo;
//   3. a normalização aceita o endereço do jeito que a documentação do provedor
//      mostra — com /v1, sem /v1, com a rota completa colada, com barra sobrando;
//   4. endereço inválido NÃO derruba a geração, volta ao padrão.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let S;
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  clearStorage();
  S = loadModules(['catalogs.js', 'core.js', 'llm.js'],
    ['callGroq', 'callOpenAI', 'callAnthropic', 'State', 'PROVIDER_ENDPOINTS',
     'normalizarBaseUrl', 'baseUrlDe', 'modeloAceitaTemperatura']);
});
afterEach(() => { globalThis.fetch = fetchOriginal; });

function espiaFetch(corpo) {
  const visto = {};
  globalThis.fetch = async (url, init) => {
    visto.url = url; visto.init = init;
    return { ok: true, status: 200, json: async () => corpo };
  };
  return visto;
}
const RESP = {
  groq: { choices: [{ message: { content: 'oi' } }] },
  openai: { choices: [{ message: { content: 'oi' } }] },
  anthropic: { content: [{ type: 'text', text: 'oi' }] },
};

describe('normalização do que o usuário digita', () => {
  const PADRAO = 'https://api.openai.com/v1';

  it.each([
    ['https://openrouter.ai/api/v1', 'https://openrouter.ai/api/v1'],
    ['https://openrouter.ai/api/v1/', 'https://openrouter.ai/api/v1'],
    ['  https://openrouter.ai/api/v1///  ', 'https://openrouter.ai/api/v1'],
    // colar a rota completa é o erro mais comum: é o que aparece no exemplo de curl
    ['https://openrouter.ai/api/v1/chat/completions', 'https://openrouter.ai/api/v1'],
    ['https://api.anthropic.com/v1/messages', 'https://api.anthropic.com/v1'],
    ['https://api.openai.com/v1/responses', 'https://api.openai.com/v1'],
    // só o domínio → /v1, que é a convenção do dialeto
    ['https://meu-gateway.com', 'https://meu-gateway.com/v1'],
    ['meu-gateway.com', 'https://meu-gateway.com/v1'],
    // caminho escrito pelo usuário é preservado: ele sabia o que fazia
    ['https://api.groq.com/openai/v1', 'https://api.groq.com/openai/v1'],
    ['http://localhost:11434/v1', 'http://localhost:11434/v1'],
  ])('%s → %s', (entrada, esperado) => {
    expect(S.normalizarBaseUrl(entrada, PADRAO)).toBe(esperado);
  });

  it.each([['', 'vazio'], ['   ', 'só espaços'], ['não é url', 'texto solto'],
    ['javascript:alert(1)', 'esquema perigoso'], ['ftp://x.com', 'esquema errado']])(
    '%s (%s) volta ao padrão de fábrica', (entrada) => {
      // O campo é atalho, não jeito de quebrar o app.
      expect(S.normalizarBaseUrl(entrada, PADRAO)).toBe(PADRAO);
    });
});

describe('o endereço salvo é o que vai para a rede', () => {
  it.each([
    ['groq', '/chat/completions'],
    ['openai', '/chat/completions'],
    ['anthropic', '/messages'],
  ])('%s sem personalização usa o padrão de fábrica', async (prov, rota) => {
    const visto = espiaFetch(RESP[prov]);
    const fn = { groq: 'callGroq', openai: 'callOpenAI', anthropic: 'callAnthropic' }[prov];
    await S[fn]({ apiKey: 'k', model: 'm', prompt: 'oi' });
    expect(visto.url).toBe(`${S.PROVIDER_ENDPOINTS[prov]}${rota}`);
  });

  it.each([
    ['groq', '/chat/completions'],
    ['openai', '/chat/completions'],
    ['anthropic', '/messages'],
  ])('%s personalizado troca o destino da chamada', async (prov, rota) => {
    const visto = espiaFetch(RESP[prov]);
    S.State.endpoints[prov] = 'https://gateway.exemplo.com/api/v1';
    const fn = { groq: 'callGroq', openai: 'callOpenAI', anthropic: 'callAnthropic' }[prov];
    await S[fn]({ apiKey: 'k', model: 'm', prompt: 'oi' });
    expect(visto.url).toBe(`https://gateway.exemplo.com/api/v1${rota}`);
  });

  it('a rota colada inteira não vira rota duplicada', async () => {
    // Sem a normalização isto viraria /chat/completions/chat/completions.
    const visto = espiaFetch(RESP.openai);
    S.State.endpoints.openai = 'https://gateway.exemplo.com/v1/chat/completions';
    await S.callOpenAI({ apiKey: 'k', model: 'm', prompt: 'oi' });
    expect(visto.url).toBe('https://gateway.exemplo.com/v1/chat/completions');
  });

  it('endereço inválido não derruba a geração', async () => {
    const visto = espiaFetch(RESP.openai);
    S.State.endpoints.openai = 'isso não é um endereço';
    await expect(S.callOpenAI({ apiKey: 'k', model: 'm', prompt: 'oi' })).resolves.toBeTruthy();
    expect(visto.url).toBe(`${S.PROVIDER_ENDPOINTS.openai}/chat/completions`);
  });

  it('a personalização de um provedor não vaza para outro', async () => {
    S.State.endpoints.openai = 'https://gateway.exemplo.com/v1';
    const visto = espiaFetch(RESP.groq);
    await S.callGroq({ apiKey: 'k', model: 'm', prompt: 'oi' });
    expect(visto.url).toBe(`${S.PROVIDER_ENDPOINTS.groq}/chat/completions`);
  });

  it('a chave e o cabeçalho da Anthropic sobrevivem ao endereço trocado', async () => {
    const visto = espiaFetch(RESP.anthropic);
    S.State.endpoints.anthropic = 'https://gateway.exemplo.com/v1';
    await S.callAnthropic({ apiKey: 'sk-ant-x', model: 'claude-sonnet-5', prompt: 'oi' });
    expect(visto.init.headers['x-api-key']).toBe('sk-ant-x');
    expect(visto.init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
  });
});

describe('temperature segue o MODELO, não o provedor', () => {
  it.each([
    // OpenAI: família GPT-5 e linha "o"
    'gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5', 'o3', 'o4-mini',
    // Anthropic: linha Claude 5 inteira e os Opus 4.7 / 4.8
    'claude-sonnet-5', 'claude-opus-5', 'claude-fable-5',
    'claude-opus-4-7', 'claude-opus-4-8',
  ])('%s raciocina e recusa o parâmetro', (m) => {
    expect(S.modeloAceitaTemperatura(m)).toBe(false);
  });

  it.each([
    'gpt-4.1', 'openai/gpt-oss-120b', 'llama-3.1-8b', 'mistral-large', 'qwen/qwen3.6-27b',
    // O -5 aqui é a segunda metade do "4-5", não a geração 5: continua aceitando.
    'claude-haiku-4-5', 'claude-sonnet-4-6', 'claude-opus-4-6',
  ])('%s aceita', (m) => {
    expect(S.modeloAceitaTemperatura(m)).toBe(true);
  });

  it('com endereço compatível e modelo que aceita, o parâmetro volta a ir', async () => {
    // É o ganho de separar por modelo: o mesmo caminho da OpenAI serve um
    // servidor compatível rodando outra família.
    const visto = espiaFetch(RESP.openai);
    S.State.endpoints.openai = 'https://openrouter.ai/api/v1';
    await S.callOpenAI({ apiKey: 'k', model: 'mistral-large', prompt: 'oi' });
    expect(JSON.parse(visto.init.body).temperature).toBe(0.6);
  });

  it('e some de novo quando o modelo é da família que recusa', async () => {
    const visto = espiaFetch(RESP.openai);
    await S.callOpenAI({ apiKey: 'k', model: 'gpt-5.6-terra', prompt: 'oi' });
    expect(JSON.parse(visto.init.body)).not.toHaveProperty('temperature');
  });
});

describe('a escolha sobrevive ao fechar o app', () => {
  it('o endereço salvo volta no boot seguinte', () => {
    S.State.endpoints.openai = 'https://gateway.exemplo.com/v1';
    localStorage.setItem('agp.endpoints', JSON.stringify(S.State.endpoints));
    const S2 = loadModules(['catalogs.js', 'core.js', 'llm.js'], ['State', 'baseUrlDe']);
    expect(S2.baseUrlDe('openai')).toBe('https://gateway.exemplo.com/v1');
  });

  it('entra no backup do workspace junto com o resto', () => {
    // O prefixo 'agp.' é o que o backup varre; sem ele a configuração se perderia
    // na troca de aparelho, justo a hora em que ela mais importa.
    const T = loadModules(['catalogs.js', 'core.js', 'crypto.js', 'storage.js'],
      ['isWorkspaceKey', 'STORAGE_KEYS']);
    expect(T.isWorkspaceKey(T.STORAGE_KEYS.endpoints)).toBe(true);
  });
});

describe('chave colada com sujeira não vira falso erro de rede', () => {
  it('espaço e quebra de linha saem antes de virar cabeçalho', async () => {
    // Caractere inválido em cabeçalho faz o fetch morrer ANTES de sair, com o
    // MESMO sintoma de falha de rede — e o usuário vai caçar defeito na internet.
    const visto = espiaFetch(RESP.openai);
    await S.callOpenAI({ apiKey: '  sk-proj-abc\n def  ', model: 'm', prompt: 'oi' });
    expect(visto.init.headers.Authorization).toBe('Bearer sk-proj-abcdef');
  });

  it('espaço-duro colado de página web também sai', async () => {
    const visto = espiaFetch(RESP.anthropic);
    await S.callAnthropic({ apiKey: 'sk-ant-\u00a0xyz', model: 'm', prompt: 'oi' });
    expect(visto.init.headers['x-api-key']).toBe('sk-ant-xyz');
  });

  it('chave limpa passa intacta', async () => {
    const visto = espiaFetch(RESP.groq);
    await S.callGroq({ apiKey: 'gsk_abc123', model: 'm', prompt: 'oi' });
    expect(visto.init.headers.Authorization).toBe('Bearer gsk_abc123');
  });
});

describe('a mensagem de rede da OpenAI aponta a ponte', () => {
  it('diz que o bloqueio pode ser da própria OpenAI e onde está a saída', async () => {
    globalThis.fetch = async () => { throw new TypeError('Load failed'); };
    await expect(S.callOpenAI({ apiKey: 'k', model: 'm', prompt: 'oi' }))
      .rejects.toThrow(/ponte\//);
  });

  it('Groq e Anthropic não falam de ponte — elas autorizam o navegador', async () => {
    globalThis.fetch = async () => { throw new TypeError('Load failed'); };
    for (const fn of ['callGroq', 'callAnthropic']) {
      await expect(S[fn]({ apiKey: 'k', model: 'm', prompt: 'oi' }))
        .rejects.not.toThrow(/ponte\//);
    }
  });
});

describe('testar conexão, ao lado do campo', () => {
  /** Configurações montadas no provedor pedido, com chave já salva. */
  function tela(provider, chave) {
    document.body.innerHTML = `
      <div data-build="teste"></div>
      <button class="s-provider-btn" data-provider="${provider}"></button>
      <div id="s-provider-config"></div>
      <span id="s-build"></span><button id="s-update-now"></button>
      <div class="toast-stack" id="toast-stack"></div>`;
    const T = loadModules(['catalogs.js', 'core.js', 'llm.js', 'settings.js'],
      ['renderSettings', 'State']);
    if (chave) T.State.apiKeys[provider] = chave;
    T.State.provider = provider;
    T.renderSettings();
    return T;
  }
  const res = () => document.getElementById('s-endpoint-resultado').textContent;

  it('sem chave, manda salvar a chave em vez de falhar na rede', async () => {
    tela('openai', '');
    await document.getElementById('s-endpoint-test').onclick();
    expect(res()).toMatch(/Salve a chave/i);
  });

  it('deu certo: diz qual modelo respondeu e por qual endereço', async () => {
    // Sem o endereço na confirmação, o usuário não sabe se testou o gateway
    // novo ou continuou no padrão.
    espiaFetch(RESP.openai);
    tela('openai', 'sk-x');
    await document.getElementById('s-endpoint-test').onclick();
    expect(res()).toMatch(/Conexão OK/i);
    expect(res()).toMatch(/api\.openai\.com\/v1/);
  });

  it('confirma o endereço PERSONALIZADO quando há um', async () => {
    espiaFetch(RESP.openai);
    localStorage.setItem('agp.endpoints', JSON.stringify({ openai: 'https://ponte.workers.dev/v1' }));
    tela('openai', 'sk-x');
    await document.getElementById('s-endpoint-test').onclick();
    expect(res()).toMatch(/ponte\.workers\.dev\/v1/);
  });

  it('deu errado: mostra o motivo real e NÃO some da tela', async () => {
    // Erro de API é longo demais para caber num toast que desaparece sozinho.
    globalThis.fetch = async () => { throw new TypeError('Load failed'); };
    tela('openai', 'sk-x');
    await document.getElementById('s-endpoint-test').onclick();
    expect(res()).toMatch(/não chegou a sair do navegador/i);
    expect(document.getElementById('s-endpoint-resultado').innerHTML).toBeTruthy();
  });

  it('erro da API chega inteiro, sem virar "falhou"', async () => {
    globalThis.fetch = async () => ({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'Unsupported parameter: temperature' } }),
    });
    tela('openai', 'sk-x');
    await document.getElementById('s-endpoint-test').onclick();
    expect(res()).toMatch(/Unsupported parameter: temperature/);
  });
});
