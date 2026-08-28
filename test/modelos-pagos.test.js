// A Groq não é a única que aposenta modelo. A OpenAI trocou a linha 5.4/5.5
// pela família 5.6 (Sol, Terra e Luna) em julho de 2026; a Anthropic passou da
// 4.x para a linha Claude 5. Um ID vencido no catálogo tem o MESMO efeito que
// teve na Groq em agosto de 2026: quem escolhe aquele modelo nas Configurações
// recebe erro em toda ferramenta, e não texto.
//
// O irmão deste arquivo (groq-modelos.test.js) tranca a ponta da Groq. Aqui vão
// as três mesmas travas para os provedores PAGOS:
//
//   1. o catálogo não pode voltar a oferecer um modelo já retirado;
//   2. quem tem um modelo retirado salvo no navegador é migrado sozinho no boot;
//   3. nenhum padrão vencido pode ter ficado escrito no código.
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadModules, clearStorage } from './helpers/load.mjs';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// IDs que os provedores já tiraram do ar (ou que nunca devem voltar por serem
// de geração vencida). Ao aposentar mais um modelo, acrescente aqui.
const RETIRADOS = {
  openai: ['gpt-5.5', 'gpt-5.4', 'gpt-5.4-mini', 'gpt-4.5', 'gpt-4.1', 'gpt-4o'],
  anthropic: [
    'claude-sonnet-4-6', 'claude-opus-4-7', 'claude-opus-4-6',
    'claude-3-5-sonnet-20241022', 'claude-3-opus-20240229',
  ],
};

let S;
beforeEach(() => {
  clearStorage();
  S = loadModules(['catalogs.js', 'core.js', 'apikey-sync.js'],
    ['PROVIDER_MODELS', 'State', 'syncModels', 'syncGroqModel']);
});

describe.each(['openai', 'anthropic'])('catálogo da %s', (prov) => {
  it('não oferece nenhum modelo de geração vencida', () => {
    const ids = S.PROVIDER_MODELS[prov].map((m) => m.id);
    for (const morto of RETIRADOS[prov]) {
      expect(ids, `"${morto}" é de geração vencida e não pode ficar no catálogo`)
        .not.toContain(morto);
    }
  });

  it('tem pelo menos um modelo, com id e rótulo preenchidos', () => {
    // Catálogo vazio deixaria a normalização sem padrão para onde migrar e o
    // usuário sem escolha nenhuma nas Configurações.
    expect(S.PROVIDER_MODELS[prov].length).toBeGreaterThan(0);
    S.PROVIDER_MODELS[prov].forEach((m) => {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(m.desc).toBeTruthy();
    });
  });

  it('não repete o mesmo id duas vezes', () => {
    const ids = S.PROVIDER_MODELS[prov].map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('formato dos IDs da Anthropic', () => {
  it('vão sem sufixo de data', () => {
    // A Anthropic pede o nome exato do modelo. Um "-20250514" grudado no fim
    // vira 404 assim que aquele instantâneo sai do ar.
    S.PROVIDER_MODELS.anthropic.forEach((m) => {
      expect(m.id, `${m.id} carrega sufixo de data`).not.toMatch(/-\d{8}$/);
    });
  });
});

describe('migração de quem já tinha modelo vencido salvo', () => {
  it.each(['openai', 'anthropic'])('troca o modelo vencido de %s pelo padrão no boot', (prov) => {
    // Sem isto, atualizar o catálogo não conserta nada para quem já tinha o
    // provedor configurado: o navegador guarda a escolha antiga.
    S.State.models[prov] = RETIRADOS[prov][0];
    S.syncModels();
    expect(S.State.models[prov]).toBe(S.PROVIDER_MODELS[prov][0].id);
  });

  it.each(['groq', 'openai', 'anthropic'])('não mexe no modelo válido de %s', (prov) => {
    const valido = S.PROVIDER_MODELS[prov][S.PROVIDER_MODELS[prov].length - 1].id;
    S.State.models[prov] = valido;
    S.syncModels();
    expect(S.State.models[prov]).toBe(valido);
  });

  it('normaliza os três provedores numa passada só', () => {
    S.State.models.groq = 'modelo-fantasma';
    S.State.models.openai = 'gpt-5.4';
    S.State.models.anthropic = 'claude-sonnet-4-6';
    S.syncModels();
    ['groq', 'openai', 'anthropic'].forEach((p) => {
      expect(S.State.models[p]).toBe(S.PROVIDER_MODELS[p][0].id);
    });
  });

  it('o nome histórico syncGroqModel continua funcionando e agora cobre todos', () => {
    // O boot, as Configurações e o desbloqueio chamam por esse nome.
    S.State.models.openai = 'gpt-4.1';
    S.syncGroqModel();
    expect(S.State.models.openai).toBe(S.PROVIDER_MODELS.openai[0].id);
  });
});

describe('nenhum modelo vencido sobrou escrito no código', () => {
  // O padrão da OpenAI e da Anthropic ficava repetido no catálogo E no estado
  // inicial (core.js). Trocar um e esquecer o outro devolve a falha por uma
  // porta lateral — daí a varredura.
  const arquivos = [
    ...fs.readdirSync(path.join(RAIZ, 'src')).map((f) => `src/${f}`),
    ...fs.readdirSync(path.join(RAIZ, 'scripts')).map((f) => `scripts/${f}`),
    'index.html', 'replicador.html', 'removedor.html',
  ].filter((f) => /\.(js|mjs|html)$/.test(f));

  const mortos = [...RETIRADOS.openai, ...RETIRADOS.anthropic];
  it.each(mortos)('nenhum arquivo de produção usa "%s" como modelo', (morto) => {
    // O comentário do catálogo CITA as gerações vencidas para explicar a
    // migração; o que não pode é o ID aparecer entre aspas, como valor.
    const culpados = arquivos.filter((f) => {
      const txt = fs.readFileSync(path.join(RAIZ, f), 'utf8');
      return txt.includes(`'${morto}'`) || txt.includes(`"${morto}"`);
    });
    expect(culpados, `${culpados.join(', ')} ainda aponta para um modelo vencido`)
      .toEqual([]);
  });
});
