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
  anthropic: { content: [{ text: 'oi' }] },
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
  it.each(['gpt-5.6-terra', 'gpt-5.6-sol', 'gpt-5', 'o3', 'o4-mini'])(
    '%s raciocina e recusa o parâmetro', (m) => {
      expect(S.modeloAceitaTemperatura(m)).toBe(false);
    });

  it.each(['gpt-4.1', 'openai/gpt-oss-120b', 'llama-3.1-8b', 'mistral-large', 'qwen/qwen3.6-27b'])(
    '%s aceita', (m) => {
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
