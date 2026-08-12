// RESUMO — a essência do conteúdo, sem os nomes e sem o resto
//
// Pedido: "deve ser realmente um resumo, e não simplesmente uma reprodução
// menor da história"; e os nomes próprios de pessoas devem virar referências
// genéricas — "O senhor João jogou o lixo fora" → "Um homem jogou o lixo fora".
//
// AS DUAS COISAS SÃO MEDÍVEIS, e é por isso que a conferência existe:
//
//   1. resumo de verdade tem TAMANHO. 90% das palavras do original não é
//      resumo, é o mesmo texto com menos vírgulas — e é o que a IA entrega
//      quando ninguém confere;
//   2. anonimização é BINÁRIA. O nome está no resumo ou não está. Não depende
//      de a IA ser honesta sobre o próprio trabalho.
//
// O que NÃO se mede é se o resumo guardou o que importava — isso é juízo, e
// cobrar por conta de palavra reprovaria o resumo bom. Lição do r224.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let R;
beforeAll(() => {
  clearStorage();
  R = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'resumo.js'],
    ['resumoNomesProprios', 'resumoNomesVazados', 'conferirResumo', 'resumoVale',
      'buildResumoPrompt', 'resumoLimpar', 'runResumoPipeline',
      'RESUMO_MAX_PROPORCAO', 'RESUMO_MIN_PROPORCAO', 'RESUMO_MIN_PALAVRAS']);
});

/* Um relato com nomes, detalhe demais e acontecimentos claros. */
const ORIGINAL = `Na terça-feira de manhã, o senhor João saiu de casa por volta das sete horas,
como fazia todo dia desde que se aposentou da fábrica de tecidos onde trabalhou por trinta e dois anos.
Ele levava o saco de lixo na mão direita e o guarda-chuva na esquerda, porque tinha visto na televisão
que ia chover à tarde. O vizinho dele, o Anderson, estava lavando o carro na calçada, um Corsa prata
que ele comprou de segunda mão e do qual fala com um orgulho que ninguém entende direito.
O senhor João cumprimentou o Anderson com a cabeça, sem parar de andar, e seguiu até a lixeira da esquina.
Foi aí que ele percebeu que a lixeira tinha sumido. No lugar dela havia só um pedaço de cano enferrujado
saindo do chão, com a tinta velha ainda grudada. Ele ficou parado ali uns bons dois minutos, olhando
aquilo, com o saco de lixo pesando na mão. Voltou para casa com o lixo, contrariado, e ligou para a
prefeitura, onde ninguém atendeu. No fim da tarde, choveu mesmo, exatamente como a televisão tinha dito.`;

describe('nomes próprios de pessoas', () => {
  it('encontra os nomes que não abrem frase', () => {
    const n = R.resumoNomesProprios(ORIGINAL);
    expect(n).toContain('joao');
    expect(n).toContain('anderson');
  });

  it('não confunde início de frase com nome', () => {
    // "Ele", "Foi", "Voltou", "No" abrem frases — maiúscula por posição, não por
    // serem nome de ninguém. Acusá-las levaria o resumo a evitar palavra comum.
    const n = R.resumoNomesProprios(ORIGINAL);
    for (const falso of ['ele', 'foi', 'voltou', 'no', 'na']) expect(n).not.toContain(falso);
  });

  it('não confunde as palavras genéricas que o resumo DEVE usar', () => {
    const n = R.resumoNomesProprios('Foi assim: um Homem falou com a Vizinha e depois com o Motorista.');
    expect(n).toEqual([]);
  });

  it('não confunde ênfase em caixa alta com nome', () => {
    expect(R.resumoNomesProprios('Ele disse que NUNCA mais voltaria naquele lugar.')).toEqual([]);
  });
});

describe('a conferência do resumo', () => {
  const RESUMIDO = `Um homem aposentado saiu de casa de manhã para jogar o lixo fora, levando também
um guarda-chuva porque esperava chuva. Passou por um vizinho que lavava o carro e seguiu até a lixeira
da esquina, mas ela tinha sumido: no lugar havia só um cano enferrujado. Ele voltou para casa com o
lixo, ligou para a prefeitura e ninguém atendeu. À tarde choveu.`;

  it('aprova um resumo curto e sem nomes', () => {
    const c = R.conferirResumo(ORIGINAL, RESUMIDO);
    expect(c.problemas).toEqual([]);
    expect(c.ok).toBe(true);
    expect(c.proporcao).toBeLessThan(R.RESUMO_MAX_PROPORCAO);
  });

  it('reprova o texto contado de novo, só que mais curto', () => {
    // O defeito que o usuário nomeou: "uma reprodução menor da história".
    const encolhido = ORIGINAL.replace(/, como fazia todo dia[^.]*\./, '.').replace(/,\s*um Corsa[^.]*\./, '.');
    const c = R.conferirResumo(ORIGINAL, encolhido);
    expect(c.ok).toBe(false);
    expect(c.problemas.join(' ')).toMatch(/contado de novo mais curto/);
  });

  it('reprova o resumo que apagou os acontecimentos', () => {
    const c = R.conferirResumo(ORIGINAL, 'Um homem jogou o lixo.');
    expect(c.ok).toBe(false);
    expect(c.problemas.join(' ')).toMatch(/os acontecimentos se perdem/);
  });

  it('reprova quando o nome próprio sobrevive', () => {
    const comNome = RESUMIDO.replace('Um homem aposentado', 'O senhor João, aposentado,');
    const c = R.conferirResumo(ORIGINAL, comNome);
    expect(c.ok).toBe(false);
    expect(c.nomes).toContain('joao');
    expect(c.problemas.join(' ')).toMatch(/nomes próprios continuam/);
  });

  it('resumo vazio é reprovado, e não aprovado por omissão', () => {
    const c = R.conferirResumo(ORIGINAL, '   ');
    expect(c.ok).toBe(false);
    expect(c.palavras).toBe(0);
  });

  it('texto sem nome nenhum não inventa acusação', () => {
    const semNomes = 'Uma pessoa saiu de casa. ' .repeat(40);
    const c = R.conferirResumo(semNomes, 'Alguém saiu de casa várias vezes.');
    expect(c.nomes).toEqual([]);
  });
});

describe('vale a pena resumir?', () => {
  it('texto curto não passa — já é do tamanho de um resumo', () => {
    expect(R.resumoVale('Uma frase curta e nada mais.')).toBe(false);
    expect(R.resumoVale(ORIGINAL)).toBe(true);
  });

  it('e o pipeline recusa em vez de gastar uma chamada', async () => {
    let n = 0;
    await expect(R.runResumoPipeline({ texto: 'curto demais', call: async () => { n++; return { content: 'x' }; } }))
      .rejects.toThrow(new RegExp(`${R.RESUMO_MIN_PALAVRAS} palavras`));
    expect(n).toBe(0);
  });
});

describe('o pedido que sai para a IA', () => {
  it('define resumir pelo que NÃO é', () => {
    const p = R.buildResumoPrompt(ORIGINAL, {});
    expect(p).toMatch(/NÃO é contar a mesma coisa com menos palavras/);
    expect(p).toMatch(/você não resumiu — encolheu/);
  });

  it('manda trocar o nome por QUEM A PESSOA É, com o exemplo do usuário', () => {
    const p = R.buildResumoPrompt(ORIGINAL, {});
    expect(p).toMatch(/O senhor João jogou o lixo fora.*Um homem jogou o lixo fora/s);
    expect(p).toMatch(/quem ela É na história/);
  });

  it('avisa que a troca não pode confundir duas pessoas', () => {
    // "uma pessoa" para as duas partes de um negócio destrói o entendimento —
    // e o usuário pediu anonimização "sempre que isso não prejudicar".
    expect(R.buildResumoPrompt(ORIGINAL, {})).toMatch(/nunca "uma pessoa" para as duas/);
  });

  it('proíbe inventar e proíbe a introdução de redação escolar', () => {
    const p = R.buildResumoPrompt(ORIGINAL, {});
    expect(p).toMatch(/Não invente nada/);
    expect(p).toMatch(/Neste texto…/);
  });

  it('na segunda tentativa, leva o que a conferência achou', () => {
    const p = R.buildResumoPrompt(ORIGINAL, { problemas: ['nomes próprios continuam no resumo: joao'] });
    expect(p).toContain('REPROVADA NA CONFERÊNCIA');
    expect(p).toContain('joao');
  });
});

describe('o pipeline', () => {
  const BOM = `Um homem aposentado saiu de casa de manhã para jogar o lixo, levando um guarda-chuva
porque esperava chuva. Passou por um vizinho lavando o carro e foi até a lixeira da esquina, que tinha
sumido: sobrara só um cano enferrujado. Voltou com o lixo, ligou para a prefeitura e ninguém atendeu.`;

  it('uma chamada quando a conferência aprova de primeira', async () => {
    const chamadas = [];
    const r = await R.runResumoPipeline({
      texto: ORIGINAL,
      call: async (p) => { chamadas.push(p); return { content: BOM }; },
    });
    expect(chamadas.length).toBe(1);
    expect(r.conferencia.ok).toBe(true);
    expect(r.tentativas).toBe(1);
    expect(r.resumo).toBe(BOM);
  });

  it('vazou nome? refaz uma vez, com o problema na mão', async () => {
    const chamadas = [];
    const r = await R.runResumoPipeline({
      texto: ORIGINAL,
      call: async (p) => {
        chamadas.push(p);
        return { content: chamadas.length === 1 ? BOM.replace('Um homem', 'O senhor João') : BOM };
      },
    });
    expect(chamadas.length).toBe(2);
    expect(chamadas[1]).toContain('REPROVADA NA CONFERÊNCIA');
    expect(chamadas[1]).toMatch(/joao/i);
    expect(r.conferencia.ok).toBe(true);
  });

  it('insistiu no erro? entrega assim mesmo, com a reprovação declarada', async () => {
    // Esconder deixaria o usuário sem nada e sem saber por quê. O que não se faz
    // é entregar um resumo com nome dizendo que passou.
    let n = 0;
    const r = await R.runResumoPipeline({
      texto: ORIGINAL,
      call: async () => { n++; return { content: BOM.replace('Um homem', 'O senhor João') }; },
    });
    expect(n).toBe(2);
    expect(r.conferencia.ok).toBe(false);
    expect(r.conferencia.nomes).toContain('joao');
    expect(r.resumo).toContain('João');
  });

  it('nunca passa de duas chamadas', async () => {
    let n = 0;
    await R.runResumoPipeline({ texto: ORIGINAL, call: async () => { n++; return { content: BOM.replace('Um homem', 'O senhor João') }; } });
    expect(n).toBe(2);
  });

  it('resposta vazia é erro, não resumo vazio', async () => {
    await expect(R.runResumoPipeline({ texto: ORIGINAL, call: async () => ({ content: '   ' }) }))
      .rejects.toThrow(/não devolveu/i);
  });

  it('tira a cerca de código e o "Resumo:" que a IA insiste em pôr', () => {
    expect(R.resumoLimpar('```\nUm homem saiu.\n```')).toBe('Um homem saiu.');
    expect(R.resumoLimpar('Resumo: Um homem saiu.')).toBe('Um homem saiu.');
    expect(R.resumoLimpar('Aqui está o resumo — Um homem saiu.')).toBe('Um homem saiu.');
  });
});
