// M23 — o motor matemático do laboratório 25/23.
//
// Estes testes travam as duas metades do que o motor promete:
//
//   • AS FÓRMULAS FECHADAS batem com contas que dá para conferir na mão
//     (casa dos pombos, contagem dupla, hipergeométrica) — se um dia
//     alguém "otimizar" `m23SingleTicketGuarantee` ou `m23CoveringLowerBound`
//     de um jeito que pareça mais esperto mas mude o número, a suíte acusa;
//   • A BUSCA DE VERDADE ACHA COISA DE VERDADE — não é só "roda sem
//     quebrar": no plano de Fano (v=7,c=3,t=2) existe uma cobertura exata
//     de 7 blocos, e o guloso estocástico precisa achar uma cobertura
//     completa (não necessariamente ótima) para o teste passar.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules } from './helpers/load.mjs';

let M;
beforeAll(() => {
  M = loadModules(['m23-motor.js'], [
    'M23_POOL_SIZE', 'M23_DRAW_SIZE', 'M23_BASE_PRICE',
    'm23NCr', 'm23Mulberry32', 'm23RandomCombination', 'm23RankCombo', 'm23UnrankCombo', 'm23Combinations',
    'M23Bitset',
    'm23SingleTicketGuarantee', 'm23TicketPrice', 'm23ProbDrawWithinUniverse', 'm23HitDistribution',
    'm23CoveringLowerBound', 'm23SchonheimBound',
    'm23BuildCoveringGreedy', 'm23PruneRedundant', 'm23RefineAnnealing',
    'm23MonteCarloEvaluate',
    'm23ComputeCost', 'm23ComputeExpectedReturn', 'm23ScoreResult', 'm23CompareResults',
    'm23PlanCampaign', 'm23RunConfig', 'm23RunCampaign',
  ]);
});

describe('combinatória de base', () => {
  it('m23NCr acerta valores conhecidos', () => {
    expect(M.m23NCr(25, 15)).toBe(3268760);
    expect(M.m23NCr(23, 15)).toBe(490314);
    expect(M.m23NCr(20, 15)).toBe(15504);
    expect(M.m23NCr(15, 15)).toBe(1);
    expect(M.m23NCr(5, 0)).toBe(1);
    expect(M.m23NCr(5, 6)).toBe(0);
    expect(M.m23NCr(7, 2)).toBe(21);
    expect(M.m23NCr(7, 3)).toBe(35);
  });

  it('m23RankCombo/m23UnrankCombo são bijeção inversa uma da outra', () => {
    const n = 9, r = 4;
    const vistos = new Set();
    for (const combo of M.m23Combinations([0, 1, 2, 3, 4, 5, 6, 7, 8], r)) {
      const rank = M.m23RankCombo(combo, n);
      expect(vistos.has(rank)).toBe(false);
      vistos.add(rank);
      expect(M.m23UnrankCombo(rank, n, r)).toEqual(combo);
    }
    expect(vistos.size).toBe(M.m23NCr(n, r));
  });

  it('m23RandomCombination devolve r índices distintos e ordenados dentro de [0,n)', () => {
    const rng = M.m23Mulberry32(42);
    for (let i = 0; i < 20; i++) {
      const c = M.m23RandomCombination(23, 15, rng);
      expect(c.length).toBe(15);
      expect(new Set(c).size).toBe(15);
      expect(c).toEqual(c.slice().sort((a, b) => a - b));
      for (const x of c) expect(x).toBeGreaterThanOrEqual(0);
      for (const x of c) expect(x).toBeLessThan(23);
    }
  });

  it('m23Mulberry32 é determinístico (mesma semente → mesma sequência)', () => {
    const a = M.m23Mulberry32(7), b = M.m23Mulberry32(7);
    const seqA = Array.from({ length: 5 }, () => a());
    const seqB = Array.from({ length: 5 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it('M23Bitset marca e conta corretamente, sem contar duas vezes', () => {
    const bs = new M.M23Bitset(100);
    expect(bs.add(5)).toBe(true);
    expect(bs.add(5)).toBe(false);
    expect(bs.has(5)).toBe(true);
    expect(bs.has(6)).toBe(false);
    expect(bs.count).toBe(1);
  });
});

describe('fórmulas fechadas do modelo 25/23', () => {
  it('m23SingleTicketGuarantee é a casa dos pombos: duas 15-uplas de um universo de 25 sempre compartilham ≥5', () => {
    expect(M.m23SingleTicketGuarantee(25, 15)).toBe(5);
  });

  it('reduzir o universo para 23 e jogar cartela de 20 garante 12, nunca 15', () => {
    expect(M.m23SingleTicketGuarantee(23, 20)).toBe(12);
    expect(M.m23SingleTicketGuarantee(23, 20)).toBeLessThan(15);
  });

  it('jogar o universo inteiro (c=v) garante os 15 pontos — trivial, e o único jeito com 1 cartela', () => {
    expect(M.m23SingleTicketGuarantee(23, 23)).toBe(15);
  });

  it('m23TicketPrice cobra C(c,15) apostas simples', () => {
    expect(M.m23TicketPrice(15)).toBe(3);
    expect(M.m23TicketPrice(20)).toBe(15504 * 3);
  });

  it('m23ProbDrawWithinUniverse: universo cheio tem probabilidade 1; 23 dezenas cai para ~15%', () => {
    expect(M.m23ProbDrawWithinUniverse(25)).toBeCloseTo(1, 9);
    const p23 = M.m23ProbDrawWithinUniverse(23);
    expect(p23).toBeCloseTo(490314 / 3268760, 9);
    expect(p23).toBeGreaterThan(0.14);
    expect(p23).toBeLessThan(0.16);
  });

  it('m23HitDistribution soma 1 e respeita os limites do modelo hipergeométrico', () => {
    const dist = M.m23HitDistribution(25, 15);
    const soma = dist.reduce((s, d) => s + d.probability, 0);
    expect(soma).toBeCloseTo(1, 9);
    expect(dist[0].hits).toBe(5);           // mínimo garantido pela casa dos pombos
    expect(dist[dist.length - 1].hits).toBe(15);
  });

  it('m23CoveringLowerBound: t=k=15 é exatamente C(v,15) — a parede provada', () => {
    expect(M.m23CoveringLowerBound(23, 15, 15)).toBe(M.m23NCr(23, 15));
    expect(M.m23CoveringLowerBound(23, 15, 15)).toBe(490314);
  });

  it('m23CoveringLowerBound: cartelas maiores derrubam o piso de forma acentuada', () => {
    expect(M.m23CoveringLowerBound(23, 20, 15)).toBe(32); // ceil(490314/15504)
  });

  it('m23CoveringLowerBound bate com o plano de Fano (v=7,k=3,t=2 → 7)', () => {
    expect(M.m23CoveringLowerBound(7, 3, 2)).toBe(7);
  });

  it('m23SchonheimBound nunca é mais frouxo que a cota por contagem simples', () => {
    for (const [v, k, t] of [[23, 15, 15], [23, 20, 15], [23, 15, 11], [7, 3, 2], [9, 4, 2]]) {
      expect(M.m23SchonheimBound(v, k, t)).toBeGreaterThanOrEqual(M.m23CoveringLowerBound(v, k, t));
    }
  });
});

describe('busca gulosa estocástica', () => {
  it('caso trivial t=c: completa exatamente com C(v,t) blocos, nem um a mais', () => {
    return M.m23BuildCoveringGreedy({ v: 6, c: 3, t: 3, timeBudgetMs: 4000, maxBlocks: 50, seed: 1 })
      .then((res) => {
        expect(res.complete).toBe(true);
        expect(res.blocks.length).toBe(M.m23NCr(6, 3)); // 20 — cada bloco cobre só a si mesmo
        expect(res.coverageFraction).toBeCloseTo(1, 9);
      });
  });

  it('acha uma cobertura completa para o plano de Fano (v=7,c=3,t=2), perto do piso teórico de 7', () => {
    return M.m23BuildCoveringGreedy({ v: 7, c: 3, t: 2, timeBudgetMs: 5000, maxBlocks: 35, sampleSize: 30, seed: 5 })
      .then((res) => {
        expect(res.complete).toBe(true);
        expect(res.blocks.length).toBeGreaterThanOrEqual(7);
        expect(res.blocks.length).toBeLessThanOrEqual(14); // guloso não é ótimo, mas não deve disparar
      });
  });

  it('cada bloco tem tamanho c e usa índices válidos do universo v', () => {
    return M.m23BuildCoveringGreedy({ v: 9, c: 4, t: 2, timeBudgetMs: 3000, maxBlocks: 40, seed: 2 })
      .then((res) => {
        for (const b of res.blocks) {
          expect(b.length).toBe(4);
          expect(new Set(b).size).toBe(4);
          for (const x of b) { expect(x).toBeGreaterThanOrEqual(0); expect(x).toBeLessThan(9); }
        }
      });
  });
});

describe('poda de redundância', () => {
  it('remove um bloco cuja cobertura é inteiramente duplicada pelos demais', () => {
    // universo {0..4}, t=2: os 4 primeiros blocos já cobrem os 10 pares
    // possíveis; o 5º ([0,2,4]) só repete pares já cobertos.
    const blocks = [[0, 1, 2], [0, 1, 3], [0, 1, 4], [2, 3, 4], [0, 2, 4]];
    const podado = M.m23PruneRedundant(blocks, 5, 2);
    expect(podado.length).toBe(4);
    expect(podado).not.toContainEqual([0, 2, 4]);
  });

  it('cobertura incompleta não é mexida (devolve como veio)', () => {
    const blocks = [[0, 1, 2]]; // não cobre todos os pares de um universo de 5
    const podado = M.m23PruneRedundant(blocks, 5, 2);
    expect(podado).toEqual(blocks);
  });
});

describe('avaliação por Monte Carlo', () => {
  it('probabilidades por faixa são monotônicas (≥11 nunca é menos provável que ≥15) e ficam em [0,1]', () => {
    const rng = M.m23Mulberry32(11);
    const blocks = Array.from({ length: 30 }, () => M.m23RandomCombination(23, 15, rng));
    const mc = M.m23MonteCarloEvaluate({ v: 23, blocks, trials: 800, seed: 9 });
    for (const t of [11, 12, 13, 14, 15]) {
      expect(mc.tierProbability[t]).toBeGreaterThanOrEqual(0);
      expect(mc.tierProbability[t]).toBeLessThanOrEqual(1);
    }
    expect(mc.tierProbability[11]).toBeGreaterThanOrEqual(mc.tierProbability[15]);
    expect(mc.melhorAcertoGlobal).toBeLessThanOrEqual(15);
  });
});

describe('economia: custo, retorno, ranking', () => {
  it('m23ComputeCost multiplica o número de cartelas pelo preço de cada uma', () => {
    expect(M.m23ComputeCost(100, 15)).toBe(300);
    expect(M.m23ComputeCost(10, 20)).toBe(10 * 15504 * 3);
  });

  it('m23ComputeExpectedReturn é zero sem tabela de prêmios (nunca inventa valor)', () => {
    const ret = M.m23ComputeExpectedReturn({ tierProbability: {}, tierAvgTicketsPerDraw: { 11: 2 }, prizeTable: {} });
    expect(ret.esperado).toBe(0);
  });

  it('m23ComputeExpectedReturn multiplica prêmio pela média de cartelas premiadas por sorteio', () => {
    const ret = M.m23ComputeExpectedReturn({
      tierAvgTicketsPerDraw: { 11: 3, 15: 0.01 },
      prizeTable: { 11: 6, 15: 1000000 },
    });
    expect(ret.porFaixa[11]).toBeCloseTo(18, 6);
    expect(ret.porFaixa[15]).toBeCloseTo(10000, 6);
    expect(ret.esperado).toBeCloseTo(18 + 10000, 6);
  });

  it('m23CompareResults prioriza garantia completa sobre qualquer coisa', () => {
    const garante = { complete: true, cost: 1000000, coverageFraction: 1, expectedReturn: 0 };
    const parcial = { complete: false, cost: 10, coverageFraction: 0.99, expectedReturn: 500 };
    expect(M.m23CompareResults(garante, parcial)).toBeLessThan(0);
  });

  it('m23CompareResults, entre garantidas, prefere a mais barata', () => {
    const cara = { complete: true, cost: 5000, coverageFraction: 1, expectedReturn: 0 };
    const barata = { complete: true, cost: 500, coverageFraction: 1, expectedReturn: 0 };
    expect(M.m23CompareResults(barata, cara)).toBeLessThan(0);
  });
});

describe('planejamento da campanha', () => {
  it('descarta combinações inválidas (c>v, t>c, t>15) e respeita o teto de configurações', () => {
    const configs = M.m23PlanCampaign({ vRange: [23], cRange: [15, 20], tRange: [11, 15, 16], maxConfigs: 50 });
    for (const cfg of configs) {
      expect(cfg.c).toBeLessThanOrEqual(cfg.v);
      expect(cfg.t).toBeLessThanOrEqual(cfg.c);
      expect(cfg.t).toBeLessThanOrEqual(15);
    }
  });

  it('maxConfigs corta a lista sem estourar', () => {
    const configs = M.m23PlanCampaign({ vRange: [20, 21, 22, 23], cRange: [15, 16, 17, 18, 19, 20], tRange: [11, 12, 13, 14, 15], maxConfigs: 6 });
    expect(configs.length).toBeLessThanOrEqual(6);
  });
});

describe('m23RunConfig — atalho exato vs. busca real', () => {
  it('t=c usa o atalho da parede provada, sem depender de busca', () => {
    return M.m23RunConfig({ v: 6, c: 3, t: 3 }, {}).then((res) => {
      expect(res.method).toBe('parede-provada');
      expect(res.complete).toBe(true);
      expect(res.numTickets).toBe(M.m23NCr(6, 3));
      expect(res.cost).toBe(M.m23ComputeCost(M.m23NCr(6, 3), 3));
    });
  });

  it('t<c roda a busca de verdade e devolve custo e cobertura coerentes', () => {
    return M.m23RunConfig(
      { v: 7, c: 3, t: 2 },
      { greedyTimeMs: 3000, annealTimeMs: 800, monteCarloTrials: 300 },
    ).then((res) => {
      expect(res.method).not.toBe('parede-provada');
      expect(res.numTickets).toBeGreaterThan(0);
      expect(res.cost).toBeCloseTo(M.m23ComputeCost(res.numTickets, 3), 6);
      expect(res.coverageFraction).toBeGreaterThan(0);
      expect(res.coverageFraction).toBeLessThanOrEqual(1);
    });
  });
});

describe('m23RunCampaign — orquestração ponta a ponta', () => {
  it('roda uma grade pequena e devolve resultados ranqueados (garantidos primeiro)', () => {
    return M.m23RunCampaign({
      vRange: [6], cRange: [3], tRange: [2, 3],
      maxConfigs: 5, greedyTimeMs: 2500, annealTimeMs: 500, monteCarloTrials: 200,
    }).then((results) => {
      expect(results.length).toBe(2);
      for (let i = 1; i < results.length; i++) {
        expect(M.m23CompareResults(results[i - 1], results[i])).toBeLessThanOrEqual(0);
      }
      expect(results.some((r) => r.t === 3 && r.complete)).toBe(true);
    });
  });
});
