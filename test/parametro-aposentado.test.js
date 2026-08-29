// AUTOCONSERTO DE PARÂMETRO APOSENTADO
//
// Servidor de IA não se molda a aplicativo. Duas vezes seguidas um parâmetro
// que a plataforma mandava por hábito virou 400 e derrubou a geração inteira:
// primeiro na família GPT-5 da OpenAI, meses depois na linha Claude 5 da
// Anthropic. As duas vezes exigiram uma versão nova do app para tirar UMA
// linha — o app se moldando devagar demais.
//
// A lista de modelos que recusam cada parâmetro continua existindo (evita o
// pedido perdido), mas ela envelhece: o próximo modelo a aposentar algo pegaria
// o app de calças curtas outra vez. Por isso existe a segunda defesa que este
// arquivo protege — quando o servidor recusa um parâmetro OPCIONAL, o pedido é
// refeito sem ele, na hora, sem esperar por uma versão nova.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let S;
const fetchOriginal = globalThis.fetch;

beforeEach(() => {
  clearStorage();
  S = loadModules(['catalogs.js', 'core.js', 'llm.js'],
    ['callGroq', 'callOpenAI', 'callAnthropic', 'paramRecusado', 'State']);
});
afterEach(() => { globalThis.fetch = fetchOriginal; });

/** Servidor que recusa `param` no primeiro pedido e responde bem quando ele sai. */
function servidorQueRecusa(param, mensagem, resposta) {
  const corpos = [];
  globalThis.fetch = async (url, init) => {
    const corpo = JSON.parse(init.body);
    corpos.push(corpo);
    if (Object.prototype.hasOwnProperty.call(corpo, param)) {
      return { ok: false, status: 400, json: async () => ({ error: { message: mensagem } }) };
    }
    return { ok: true, status: 200, json: async () => resposta };
  };
  return corpos;
}

describe('reconhecer que o 400 é de parâmetro', () => {
  it.each([
    "'temperature' is deprecated for this model.",
    'Unsupported parameter: temperature is not supported with this model.',
    "Unsupported value: 'temperature' does not support 0.6 with this model.",
    'unknown parameter: top_p',
  ])('%s → identifica o culpado', (msg) => {
    expect(S.paramRecusado(msg)).toBeTruthy();
  });

  it.each([
    'Invalid API key provided.',
    'Pedido longo demais.',
    'The model `x` has been decommissioned.',
    '',
  ])('%s → NÃO é erro de parâmetro', (msg) => {
    // Descartar parâmetro por causa de um erro que não é disso esconderia a
    // causa real e faria o app tentar duas vezes à toa.
    expect(S.paramRecusado(msg)).toBe('');
  });

  it('não confunde um parâmetro que a plataforma nem manda', () => {
    expect(S.paramRecusado('Unsupported parameter: frequency_penalty')).toBe('');
  });
});

describe('o pedido é refeito sem o parâmetro recusado', () => {
  it('Anthropic: modelo novo que a lista ainda não conhece se conserta sozinho', async () => {
    // Simula EXATAMENTE o próximo caso: um modelo que aceita temperature pela
    // lista, mas cujo servidor já aposentou o parâmetro.
    const corpos = servidorQueRecusa('temperature',
      "'temperature' is deprecated for this model.", { content: [{ type: 'text', text: 'pronto' }] });
    const r = await S.callAnthropic({ apiKey: 'sk-ant-x', model: 'claude-haiku-4-5', prompt: 'oi' });

    expect(r.content).toBe('pronto');
    expect(corpos).toHaveLength(2);
    expect(corpos[0]).toHaveProperty('temperature');
    expect(corpos[1]).not.toHaveProperty('temperature');
  });

  it('OpenAI idem, por um servidor compatível qualquer', async () => {
    const corpos = servidorQueRecusa('temperature',
      'Unsupported parameter: temperature', { choices: [{ message: { content: 'pronto' } }] });
    S.State.endpoints.openai = 'https://gateway.exemplo.com/v1';
    const r = await S.callOpenAI({ apiKey: 'k', model: 'mistral-novo', prompt: 'oi' });
    expect(r.content).toBe('pronto');
    expect(corpos).toHaveLength(2);
  });

  it('o resto do pedido sobrevive intacto à segunda tentativa', async () => {
    const corpos = servidorQueRecusa('temperature',
      "'temperature' is deprecated", { content: [{ type: 'text', text: 'ok' }] });
    await S.callAnthropic({ apiKey: 'sk-ant-x', model: 'claude-haiku-4-5', prompt: 'era uma vez' });
    // Comparar as duas tentativas, em vez de travar valores: o que importa é
    // que SÓ o parâmetro recusado saiu — e assim o teste não quebra quando um
    // limite legítimo muda.
    expect(corpos[1].model).toBe('claude-haiku-4-5');
    expect(corpos[1].max_tokens).toBe(corpos[0].max_tokens);
    expect(corpos[1].messages).toEqual([{ role: 'user', content: 'era uma vez' }]);
    expect(Object.keys(corpos[0]).filter((k) => k !== 'temperature'))
      .toEqual(Object.keys(corpos[1]));
  });
});

describe('o autoconserto não vira laço nem disfarce', () => {
  it('tenta no máximo uma vez a mais', async () => {
    // Servidor que recusa SEMPRE, mesmo sem o parâmetro: sem o limite, o app
    // ficaria pedindo para sempre e queimando cota.
    let chamadas = 0;
    globalThis.fetch = async () => {
      chamadas++;
      return { ok: false, status: 400, json: async () => ({ error: { message: "'temperature' is deprecated" } }) };
    };
    await expect(S.callAnthropic({ apiKey: 'k', model: 'claude-haiku-4-5', prompt: 'oi' })).rejects.toThrow();
    expect(chamadas).toBe(2);
  });

  it('erro que não é de parâmetro passa direto, sem segunda tentativa', async () => {
    let chamadas = 0;
    globalThis.fetch = async () => {
      chamadas++;
      return { ok: false, status: 400, json: async () => ({ error: { message: 'Pedido longo demais.' } }) };
    };
    await expect(S.callGroq({ apiKey: 'k', model: 'openai/gpt-oss-120b', prompt: 'oi' }))
      .rejects.toThrow('Pedido longo demais.');
    expect(chamadas).toBe(1);
  });

  it('a mensagem real do servidor chega ao usuário quando o conserto não resolve', async () => {
    // Se o 400 persistir, o usuário precisa ver O QUE o servidor disse — não um
    // "falhou" genérico que esconde a causa.
    globalThis.fetch = async () => ({
      ok: false, status: 400,
      json: async () => ({ error: { message: 'max_tokens acima do limite do modelo' } }),
    });
    await expect(S.callAnthropic({ apiKey: 'k', model: 'claude-sonnet-5', prompt: 'oi' }))
      .rejects.toThrow('max_tokens acima do limite do modelo');
  });

  it('401 e 429 seguem com o aviso próprio, sem passar pelo conserto', async () => {
    globalThis.fetch = async () => ({ ok: false, status: 401, json: async () => ({}) });
    await expect(S.callAnthropic({ apiKey: 'k', model: 'claude-sonnet-5', prompt: 'oi' }))
      .rejects.toThrow(/chave de API/i);
    globalThis.fetch = async () => ({ ok: false, status: 429, json: async () => ({}) });
    await expect(S.callAnthropic({ apiKey: 'k', model: 'claude-sonnet-5', prompt: 'oi' }))
      .rejects.toThrow(/Limite de requisições/i);
  });
});
