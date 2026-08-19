// A Groq aposenta modelos e passa a recusar os IDs antigos. Quando isso pegou a
// plataforma em agosto de 2026, TODA ferramenta que chama a IA parou de uma vez
// — e a tela mostrava o texto cru da Groq, em inglês, mandando ler a
// documentação. Este arquivo tranca as três pontas dessa falha:
//
//   1. o catálogo não pode voltar a oferecer um modelo já retirado;
//   2. quem tem um modelo retirado salvo no navegador precisa ser migrado
//      sozinho no boot, sem abrir as Configurações;
//   3. se ainda assim a Groq recusar o modelo, a mensagem tem de dizer o que
//      fazer, em português.
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules, clearStorage } from './helpers/load.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// IDs que a Groq já retirou do ar. Pedidos a qualquer um deles voltam com erro,
// nunca com texto. Ao aposentar mais um modelo, acrescente aqui.
const MODELOS_RETIRADOS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct',
  'meta-llama/llama-4-maverick-17b-128e-instruct',
  'qwen/qwen3-32b',
];

let S;
beforeEach(() => {
  clearStorage();
  S = loadModules(['catalogs.js', 'core.js', 'llm.js', 'apikey-sync.js'],
    ['PROVIDER_MODELS', 'State', 'syncGroqModel', 'callGroq']);
});

describe('catálogo de modelos da Groq', () => {
  it('não oferece nenhum modelo já retirado do ar', () => {
    const ids = S.PROVIDER_MODELS.groq.map((m) => m.id);
    for (const morto of MODELOS_RETIRADOS) {
      expect(ids, `"${morto}" saiu do ar na Groq e não pode ficar no catálogo`)
        .not.toContain(morto);
    }
  });

  it('tem pelo menos um modelo, com id e rótulo preenchidos', () => {
    // Catálogo vazio derrubaria a normalização do boot (validIds[0] seria
    // undefined) e deixaria o usuário sem escolha nenhuma nas Configurações.
    expect(S.PROVIDER_MODELS.groq.length).toBeGreaterThan(0);
    S.PROVIDER_MODELS.groq.forEach((m) => {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
    });
  });
});

describe('migração de quem já tinha modelo retirado salvo', () => {
  it('troca o modelo aposentado pelo padrão atual no boot', () => {
    // Este é o caso real: o navegador guardava llama-3.3-70b-versatile desde
    // antes da retirada. Sem esta troca, atualizar o catálogo não conserta nada
    // para quem já usava a plataforma.
    S.State.models.groq = 'llama-3.3-70b-versatile';
    S.syncGroqModel();
    expect(S.State.models.groq).toBe(S.PROVIDER_MODELS.groq[0].id);
  });

  it('não mexe no modelo de quem já está num id válido', () => {
    const valido = S.PROVIDER_MODELS.groq[S.PROVIDER_MODELS.groq.length - 1].id;
    S.State.models.groq = valido;
    S.syncGroqModel();
    expect(S.State.models.groq).toBe(valido);
  });
});

describe('nenhum modelo retirado sobrou escrito no código', () => {
  // O padrão estava repetido em quatro lugares (catálogo, estado inicial,
  // Replicador e script de prova real). Trocar um e esquecer outro devolve a
  // falha por uma porta lateral — daí a varredura.
  const arquivos = [
    ...fs.readdirSync(path.join(RAIZ, 'src')).map((f) => `src/${f}`),
    ...fs.readdirSync(path.join(RAIZ, 'scripts')).map((f) => `scripts/${f}`),
    'index.html', 'replicador.html', 'removedor.html',
  ].filter((f) => /\.(js|mjs|html)$/.test(f));

  it.each(MODELOS_RETIRADOS)('nenhum arquivo de produção cita "%s"', (morto) => {
    const culpados = arquivos.filter((f) =>
      fs.readFileSync(path.join(RAIZ, f), 'utf8').includes(morto));
    expect(culpados, `${culpados.join(', ')} ainda aponta para um modelo fora do ar`)
      .toEqual([]);
  });
});

describe('erro da Groq quando o modelo saiu do ar', () => {
  const fetchOriginal = globalThis.fetch;
  afterEach(() => { globalThis.fetch = fetchOriginal; });

  /** Dublê de resposta HTTP com o corpo de erro da Groq. */
  const respostaDeErro = (status, error) => {
    globalThis.fetch = async () => ({ ok: false, status, json: async () => ({ error }) });
  };

  it('explica em português o que fazer, em vez de repassar o texto cru', async () => {
    respostaDeErro(400, {
      code: 'model_decommissioned',
      message: 'The model `llama-3.3-70b-versatile` has been decommissioned and is no '
             + 'longer supported. Please refer to https://console.groq.com/docs/deprecations',
    });
    await expect(S.callGroq({ apiKey: 'gsk_x', model: 'llama-3.3-70b-versatile', prompt: 'oi' }))
      .rejects.toThrow(/retirado do ar/i);
  });

  it('nomeia o modelo recusado e aponta o conserto', async () => {
    respostaDeErro(404, { code: 'model_not_found', message: 'The model does not exist' });
    await expect(S.callGroq({ apiKey: 'gsk_x', model: 'modelo-fantasma', prompt: 'oi' }))
      .rejects.toThrow(/modelo-fantasma[\s\S]*Configurações/i);
  });

  it('preserva a mensagem da Groq nos erros que não são de modelo', async () => {
    // Sobrescrever todo erro com o aviso de modelo esconderia a causa real.
    respostaDeErro(400, { code: 'context_length_exceeded', message: 'Pedido longo demais.' });
    await expect(S.callGroq({ apiKey: 'gsk_x', model: 'openai/gpt-oss-120b', prompt: 'oi' }))
      .rejects.toThrow('Pedido longo demais.');
  });

  it('chave inválida continua com o aviso próprio', async () => {
    respostaDeErro(401, { message: 'Invalid API Key' });
    await expect(S.callGroq({ apiKey: 'ruim', model: 'openai/gpt-oss-120b', prompt: 'oi' }))
      .rejects.toThrow(/chave de API/i);
  });
});
