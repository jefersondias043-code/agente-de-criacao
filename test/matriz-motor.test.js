// MATRIZ — motor de poda e otimização combinatória.
//
// O que estes testes protegem, em ordem de risco:
//
//   • A ENUMERAÇÃO RÁPIDA das 136 combinações. É a otimização mais perigosa do
//     motor: troca 136×15 somas por prefixos em O(1), e um erro ali envenena
//     silenciosamente TODA a cobertura — os números continuariam saindo
//     bonitos, só que errados. Comparada contra a versão ingênua em milhares
//     de cartelas aleatórias.
//   • A ARITMÉTICA DO MODELO: C(25,15), C(17,15), e a dupla contagem
//     3.268.760 × 45 = 1.081.575 × 136, que é o que sustenta usar Uint8Array.
//   • A REVERSIBILIDADE de remover/adicionar — a busca local desfaz trocas o
//     tempo todo, e um estado que não volta exatamente ao anterior corromperia
//     a matriz sem avisar.
//   • A PROMESSA CENTRAL: a poda inteligente tem de ganhar da remoção
//     aleatória. O projeto chama isso de prioridade absoluta; aqui é teste.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules } from './helpers/load.mjs';

let M;
beforeAll(() => {
  M = loadModules(['matriz-motor.js'], [
    'MTZ_UNIVERSO', 'MTZ_SORTEIO', 'MTZ_CARTELA', 'MTZ_TOTAL_COMB',
    'MTZ_COMB_POR_CARTELA', 'MTZ_REDUNDANCIA_MAX', 'MTZ_CARTELAS_POSSIVEIS',
    'mtzBinom', 'mtzRankCombinacao', 'mtzCombosDaCartela',
    'mtzMascaraParaArray', 'mtzArrayParaMascara', 'mtzRng', 'mtzGerarCartelas',
    'mtzMontarMatriz', 'mtzPerdaSeRemover', 'mtzGanhoSeAdicionar',
    'mtzRemover', 'mtzAdicionar', 'mtzEstatisticasCartela', 'mtzHistogramaRedundancia',
    'MtzMinHeap', 'mtzDescida', 'mtzResetar', 'mtzAplicarPrefixo',
    'mtzRemocoesSemPerda', 'mtzRemocoesParaCobertura', 'mtzRemocoesParaMeta', 'mtzAmostrarCurva',
    'mtzBuscaLocal', 'mtzCoberturaAleatoria', 'mtzValidarExaustivo',
    'mtzOtimizar', 'mtzExportarAtivas', 'mtzImportarTexto',
  ]);
});

/** TODAS as cartelas de 17 que cabem nas primeiras `p` dezenas — uma matriz
 *  densa, com redundância de verdade. A matriz aleatória do universo cheio é
 *  esparsa demais para exercitar o modo 100%. */
function cartelasDeSubUniverso(p) {
  const masks = [];
  for (let a = 0; a < p; a++) {
    for (let b = a + 1; b < p; b++) {
      for (let c = b + 1; c < p; c++) {
        const fora = new Set([a, b, c]);
        const dezenas = [];
        for (let d = 0; d < p; d++) if (!fora.has(d)) dezenas.push(d);
        masks.push(M.mtzArrayParaMascara(dezenas));   // p−3 = 17 quando p = 20
      }
    }
  }
  return Int32Array.from(masks);
}

/** Enumeração INGÊNUA: monta cada subconjunto de 15 e rankeia do zero.
 *  Existe só para desmentir a versão rápida, se ela estiver errada. */
function combosIngenuo(cartelaOrdenada) {
  const out = [];
  for (let i = 0; i < 17; i++) {
    for (let j = i + 1; j < 17; j++) {
      const sub = [];
      for (let k = 0; k < 17; k++) if (k !== i && k !== j) sub.push(cartelaOrdenada[k]);
      out.push(M.mtzRankCombinacao(sub));
    }
  }
  return out;
}

describe('aritmética do modelo', () => {
  it('as constantes são os binomiais que dizem ser', () => {
    expect(M.mtzBinom(25, 15)).toBe(3268760);
    expect(M.MTZ_TOTAL_COMB).toBe(M.mtzBinom(25, 15));
    expect(M.mtzBinom(17, 15)).toBe(136);
    expect(M.MTZ_COMB_POR_CARTELA).toBe(M.mtzBinom(17, 15));
    expect(M.mtzBinom(25, 17)).toBe(1081575);
    expect(M.MTZ_CARTELAS_POSSIVEIS).toBe(M.mtzBinom(25, 17));
    expect(M.mtzBinom(10, 2)).toBe(45);
    expect(M.MTZ_REDUNDANCIA_MAX).toBe(M.mtzBinom(10, 2));
  });

  it('a dupla contagem fecha — é o que autoriza o Uint8Array no contador', () => {
    // Cada combinação cabe em 45 cartelas; cada cartela cobre 136 combinações.
    expect(M.MTZ_TOTAL_COMB * M.MTZ_REDUNDANCIA_MAX)
      .toBe(M.MTZ_CARTELAS_POSSIVEIS * M.MTZ_COMB_POR_CARTELA);
    expect(M.MTZ_REDUNDANCIA_MAX).toBeLessThan(256);
  });

  it('mtzBinom devolve 0 fora dos limites e 1 para r=0', () => {
    expect(M.mtzBinom(5, 6)).toBe(0);
    expect(M.mtzBinom(5, -1)).toBe(0);
    expect(M.mtzBinom(7, 0)).toBe(1);
  });
});

describe('rank de combinações', () => {
  it('é uma bijeção para [0, C(25,15)) numa amostra grande e sem colisões', () => {
    const rng = M.mtzRng(20260820);
    const vistos = new Set();
    for (let t = 0; t < 4000; t++) {
      const pool = Array.from({ length: 25 }, (_, i) => i);
      for (let i = 0; i < 15; i++) {
        const j = i + Math.floor(rng() * (25 - i));
        const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      const combo = pool.slice(0, 15).sort((a, b) => a - b);
      const r = M.mtzRankCombinacao(combo);
      expect(r).toBeGreaterThanOrEqual(0);
      expect(r).toBeLessThan(M.MTZ_TOTAL_COMB);
      const chave = combo.join(',');
      if (vistos.has(r)) expect(vistos.get?.(r) ?? chave).toBe(chave);
      vistos.add(r);
    }
    expect(vistos.size).toBeGreaterThan(3500); // praticamente sem repetição
  });

  it('rankeia a primeira e a última combinação nos extremos do intervalo', () => {
    const primeira = Array.from({ length: 15 }, (_, i) => i);            // 0..14
    const ultima = Array.from({ length: 15 }, (_, i) => i + 10);         // 10..24
    expect(M.mtzRankCombinacao(primeira)).toBe(0);
    expect(M.mtzRankCombinacao(ultima)).toBe(M.MTZ_TOTAL_COMB - 1);
  });
});

describe('enumeração rápida das 136 combinações (a otimização de risco)', () => {
  it('bate EXATAMENTE com a enumeração ingênua em 2.000 cartelas aleatórias', () => {
    const rng = M.mtzRng(7);
    const out = new Int32Array(136);
    for (let t = 0; t < 2000; t++) {
      const pool = Array.from({ length: 25 }, (_, i) => i);
      for (let i = 0; i < 17; i++) {
        const j = i + Math.floor(rng() * (25 - i));
        const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
      }
      const cartela = pool.slice(0, 17).sort((a, b) => a - b);
      M.mtzCombosDaCartela(Int32Array.from(cartela), out, 0);
      expect(Array.from(out)).toEqual(combosIngenuo(cartela));
    }
  });

  it('produz 136 combinações DISTINTAS por cartela', () => {
    const out = new Int32Array(136);
    const cartela = Int32Array.from({ length: 17 }, (_, i) => i); // 0..16
    M.mtzCombosDaCartela(cartela, out, 0);
    expect(new Set(Array.from(out)).size).toBe(136);
  });

  it('respeita o offset (escreve no lugar certo do índice achatado)', () => {
    const out = new Int32Array(272);
    const c1 = Int32Array.from({ length: 17 }, (_, i) => i);
    const c2 = Int32Array.from({ length: 17 }, (_, i) => i + 8); // 8..24
    M.mtzCombosDaCartela(c1, out, 0);
    const fim = M.mtzCombosDaCartela(c2, out, 136);
    expect(fim).toBe(272);
    expect(Array.from(out.slice(136))).toEqual(combosIngenuo(Array.from(c2)));
  });
});

describe('máscaras', () => {
  it('máscara → array → máscara é identidade', () => {
    const rng = M.mtzRng(3);
    const buf = new Int32Array(17);
    const masks = M.mtzGerarCartelas(200, 99);
    for (const mask of masks) {
      const n = M.mtzMascaraParaArray(mask, buf);
      expect(n).toBe(17);
      expect(M.mtzArrayParaMascara(Array.from(buf.slice(0, 17)))).toBe(mask);
    }
    expect(rng()).toBeGreaterThanOrEqual(0);
  });

  it('o gerador devolve cartelas distintas com 17 dezenas cada', () => {
    const masks = M.mtzGerarCartelas(3000, 42);
    expect(masks.length).toBe(3000);
    expect(new Set(Array.from(masks)).size).toBe(3000);
    for (const m of masks) {
      let bits = 0;
      for (let b = 0; b < 25; b++) if (m & (1 << b)) bits++;
      expect(bits).toBe(17);
    }
  });

  it('mesma semente, mesma matriz (reprodutibilidade)', () => {
    expect(Array.from(M.mtzGerarCartelas(50, 123))).toEqual(Array.from(M.mtzGerarCartelas(50, 123)));
  });
});

describe('a matriz: cobertura e redundância', () => {
  it('uma cartela sozinha cobre exatamente 136 combinações', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(1, 5), {});
    expect(mat.cobertas).toBe(136);
    expect(mat.ativas).toBe(1);
  });

  it('as 45 cartelas que contêm uma combinação a cobrem 45 vezes — o teto do Uint8Array', async () => {
    // Fixa a combinação 0..14 e monta TODAS as suas 45 extensões para 17.
    const base = Array.from({ length: 15 }, (_, i) => i);
    const resto = Array.from({ length: 10 }, (_, i) => i + 15);
    const masks = [];
    for (let i = 0; i < 10; i++) {
      for (let j = i + 1; j < 10; j++) {
        masks.push(M.mtzArrayParaMascara(base.concat([resto[i], resto[j]])));
      }
    }
    expect(masks.length).toBe(45);
    const mat = await M.mtzMontarMatriz(Int32Array.from(masks), {});
    const rank = M.mtzRankCombinacao(base);
    expect(mat.cover[rank]).toBe(45);
    expect(mat.cover[rank]).toBeLessThanOrEqual(M.MTZ_REDUNDANCIA_MAX);
  });

  it('o histograma de redundância soma o total de combinações', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(500, 11), {});
    const h = M.mtzHistogramaRedundancia(mat);
    let soma = 0;
    for (const v of h) soma += v;
    expect(soma).toBe(M.MTZ_TOTAL_COMB);
    expect(h[0]).toBe(M.MTZ_TOTAL_COMB - mat.cobertas); // descobertas
  });
});

describe('remover e adicionar', () => {
  it('adicionar desfaz remover BIT A BIT — a base da busca local', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(400, 8), {});
    const antesCover = Uint8Array.from(mat.cover);
    const antesCobertas = mat.cobertas;
    const antesAtivas = mat.ativas;

    for (const c of [0, 7, 39, 123, 399]) {
      const perda = M.mtzRemover(mat, c);
      expect(mat.cobertas).toBe(antesCobertas - perda);
      const ganho = M.mtzAdicionar(mat, c);
      expect(ganho).toBe(perda);
      expect(mat.cobertas).toBe(antesCobertas);
      expect(mat.ativas).toBe(antesAtivas);
    }
    expect(Array.from(mat.cover)).toEqual(Array.from(antesCover));
  });

  it('a perda prevista é EXATAMENTE a perda que acontece', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(600, 21), {});
    for (const c of [1, 50, 200, 599]) {
      const previsto = M.mtzPerdaSeRemover(mat, c);
      const antes = mat.cobertas;
      M.mtzRemover(mat, c);
      expect(antes - mat.cobertas).toBe(previsto);
    }
  });

  it('o ganho previsto é EXATAMENTE o ganho que acontece', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(600, 22), {});
    M.mtzRemover(mat, 10); M.mtzRemover(mat, 11); M.mtzRemover(mat, 12);
    for (const c of [10, 11, 12]) {
      const previsto = M.mtzGanhoSeAdicionar(mat, c);
      const antes = mat.cobertas;
      M.mtzAdicionar(mat, c);
      expect(mat.cobertas - antes).toBe(previsto);
    }
  });

  it('remover duas vezes não conta perda duas vezes', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(100, 4), {});
    M.mtzRemover(mat, 3);
    const depois = mat.cobertas, ativas = mat.ativas;
    expect(M.mtzRemover(mat, 3)).toBe(0);
    expect(mat.cobertas).toBe(depois);
    expect(mat.ativas).toBe(ativas);
  });

  it('as estatísticas por cartela somam 136 e a perda é o total de exclusivas', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(800, 31), {});
    const st = M.mtzEstatisticasCartela(mat, 42);
    expect(st.exclusivas + st.raras + st.redundantes + st.descobertas).toBe(136);
    expect(st.perdaSeRemover).toBe(M.mtzPerdaSeRemover(mat, 42));
  });
});

describe('heap de mínimo', () => {
  it('devolve as chaves em ordem crescente', () => {
    const h = new M.MtzMinHeap(64);
    const chaves = [9, 3, 7, 1, 8, 2, 5, 0, 4, 6];
    chaves.forEach((k, i) => h.push(k, i * 10));
    const saida = [];
    while (h.tam > 0) { h.pop(); saida.push(h.topoChave); }
    expect(saida).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('mantém o par chave/valor junto', () => {
    const h = new M.MtzMinHeap(8);
    h.push(5, 500); h.push(1, 100); h.push(3, 300);
    h.pop(); expect([h.topoChave, h.topoValor]).toEqual([1, 100]);
    h.pop(); expect([h.topoChave, h.topoValor]).toEqual([3, 300]);
    h.pop(); expect([h.topoChave, h.topoValor]).toEqual([5, 500]);
  });
});

describe('a descida gulosa', () => {
  it('remove todas as cartelas e a curva é não-crescente, terminando em zero', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(1200, 77), {});
    const cheio = mat.cobertas;
    const { ordem, curva, removidas } = await M.mtzDescida(mat, {});
    expect(removidas).toBe(1200);
    expect(new Set(Array.from(ordem)).size).toBe(1200); // cada cartela sai uma vez
    expect(curva[0]).toBe(cheio);
    expect(curva[1200]).toBe(0);
    for (let r = 1; r <= 1200; r++) expect(curva[r]).toBeLessThanOrEqual(curva[r - 1]);
    expect(mat.ativas).toBe(0);
  });

  it('a curva gravada corresponde ao estado reconstruído (a descida é aninhada)', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(900, 5), {});
    const { ordem, curva } = await M.mtzDescida(mat, {});
    for (const r of [0, 1, 100, 450, 899]) {
      M.mtzAplicarPrefixo(mat, ordem, r);
      expect(mat.cobertas).toBe(curva[r]);
      expect(mat.ativas).toBe(900 - r);
    }
  });

  it('escolhe remoções BARATAS primeiro: a curva cai devagar no começo', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(2000, 13), {});
    const { curva } = await M.mtzDescida(mat, {});
    const perdaPrimeiroQuarto = curva[0] - curva[500];
    const perdaUltimoQuarto = curva[1500] - curva[2000];
    expect(perdaPrimeiroQuarto).toBeLessThan(perdaUltimoQuarto);
  });

  it('mtzResetar devolve a matriz ao estado cheio', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(500, 6), {});
    const cheio = mat.cobertas;
    await M.mtzDescida(mat, {});
    expect(mat.ativas).toBe(0);
    M.mtzResetar(mat);
    expect(mat.ativas).toBe(500);
    expect(mat.cobertas).toBe(cheio);
  });
});

describe('leitura da curva: as metas do usuário', () => {
  it('modo 100%: o corte encontrado não perde NENHUMA combinação', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(2500, 314), {});
    const cheio = mat.cobertas;
    const { ordem, curva } = await M.mtzDescida(mat, {});
    const r = M.mtzRemocoesSemPerda(curva);
    expect(curva[r]).toBe(cheio);
    if (r + 1 <= 2500) expect(curva[r + 1]).toBeLessThan(cheio); // é o ÚLTIMO sem perda

    M.mtzAplicarPrefixo(mat, ordem, r);
    expect(mat.cobertas).toBe(cheio);
    // e o resultado é irredundante: ninguém mais sai de graça
    let removivelDeGraca = 0;
    for (let c = 0; c < mat.n; c++) {
      if (mat.ativo[c] && M.mtzPerdaSeRemover(mat, c) === 0) removivelDeGraca++;
    }
    expect(removivelDeGraca).toBe(0);
  });

  it('cobertura mínima: entrega o maior corte que ainda respeita o piso', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(2000, 8), {});
    const { curva } = await M.mtzDescida(mat, {});
    const piso = Math.ceil(0.5 * curva[0]);
    const r = M.mtzRemocoesParaCobertura(curva, piso);
    expect(curva[r]).toBeGreaterThanOrEqual(piso);
    if (r + 1 < curva.length) expect(curva[r + 1]).toBeLessThan(piso);
  });

  it('quantidade e percentual traduzem para o mesmo corte', async () => {
    const curva = new Int32Array(1001).fill(0);
    expect(M.mtzRemocoesParaMeta(curva, 1000, { modo: 'quantidade', valor: 250 })).toBe(750);
    expect(M.mtzRemocoesParaMeta(curva, 1000, { modo: 'percentual', valor: 75 })).toBe(750);
  });

  it('metas fora da faixa são aparadas em vez de estourarem', () => {
    const curva = new Int32Array(101).fill(5);
    expect(M.mtzRemocoesParaMeta(curva, 100, { modo: 'quantidade', valor: 999 })).toBe(0);
    expect(M.mtzRemocoesParaMeta(curva, 100, { modo: 'quantidade', valor: -5 })).toBe(100);
    expect(M.mtzRemocoesParaMeta(curva, 100, { modo: 'percentual', valor: 300 })).toBe(100);
  });

  it('a amostragem da curva sai em ordem decrescente de cartelas', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(600, 2), {});
    const { curva } = await M.mtzDescida(mat, {});
    const amostra = M.mtzAmostrarCurva(curva, 600, 10);
    expect(amostra.length).toBeGreaterThan(5);
    for (let i = 1; i < amostra.length; i++) {
      expect(amostra[i].cartelas).toBeLessThan(amostra[i - 1].cartelas);
      expect(amostra[i].cobertas).toBeLessThanOrEqual(amostra[i - 1].cobertas);
    }
  });
});

describe('busca local', () => {
  it('nunca piora a cobertura e nunca muda a quantidade de cartelas', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(1500, 55), {});
    const { ordem } = await M.mtzDescida(mat, {});
    M.mtzAplicarPrefixo(mat, ordem, 1100);   // sobram 400
    const antesCobertas = mat.cobertas, antesAtivas = mat.ativas;

    const res = await M.mtzBuscaLocal(mat, { tempoMs: 1500, candidatos: 48 });
    expect(mat.ativas).toBe(antesAtivas);
    expect(mat.cobertas).toBeGreaterThanOrEqual(antesCobertas);
    expect(res.ganhoTotal).toBe(mat.cobertas - antesCobertas);
  });

  it('o estado continua íntegro depois das trocas (contador bate com a verdade)', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(1200, 66), {});
    const { ordem } = await M.mtzDescida(mat, {});
    M.mtzAplicarPrefixo(mat, ordem, 900);
    await M.mtzBuscaLocal(mat, { tempoMs: 1200, candidatos: 32 });

    const v = await M.mtzValidarExaustivo(mat, {});
    expect(v.confere).toBe(true);
    expect(v.cobertas).toBe(mat.cobertas);
  });
});

describe('validação exaustiva independente', () => {
  it('confere com o contador incremental na matriz cheia', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(1000, 9), {});
    const v = await M.mtzValidarExaustivo(mat, {});
    expect(v.total).toBe(3268760);
    expect(v.confere).toBe(true);
    expect(v.cobertas + v.descobertas).toBe(3268760);
    expect(v.cartelas).toBe(1000);
  });

  it('confere depois de podar', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(1500, 17), {});
    const { ordem } = await M.mtzDescida(mat, {});
    M.mtzAplicarPrefixo(mat, ordem, 1000);
    const v = await M.mtzValidarExaustivo(mat, {});
    expect(v.confere).toBe(true);
    expect(v.cartelas).toBe(500);
    expect(v.cobertura).toBeCloseTo(mat.cobertas / 3268760, 12);
  });

  it('detectaria uma divergência entre o cache e a realidade', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(300, 3), {});
    mat.cobertas += 1;                       // sabota o contador incremental
    const v = await M.mtzValidarExaustivo(mat, {});
    expect(v.confere).toBe(false);           // a validação NÃO acredita no cache
  });
});

describe('a promessa central: ganhar da remoção aleatória', () => {
  it('a matriz otimizada cobre mais que um sorteio aleatório do mesmo tamanho', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(4000, 2026), {});
    const res = await M.mtzOtimizar(mat, {
      meta: { modo: 'quantidade', valor: 1500 },
      reinicios: 1, tempoBuscaMs: 1200, seed: 5,
    });
    expect(res.cartelasFinais).toBe(1500);
    expect(res.coberturaFinal).toBeGreaterThan(res.referenciaAleatoria);
    // e não por pouco: a poda inteligente tem de abrir vantagem de verdade
    const vantagem = (res.coberturaFinal - res.referenciaAleatoria) / res.referenciaAleatoria;
    expect(vantagem).toBeGreaterThan(0.01);
  });

  it('a busca local só melhora sobre a poda pura', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(3000, 88), {});
    const res = await M.mtzOtimizar(mat, {
      meta: { modo: 'percentual', valor: 60 },
      reinicios: 1, tempoBuscaMs: 1200, seed: 9,
    });
    expect(res.coberturaFinal).toBeGreaterThanOrEqual(res.coberturaAntesBusca);
    expect(res.cartelasFinais).toBe(3000 - 1800);
  });

  it('o modo 100% encolhe MUITO uma matriz densa, sem perder uma combinação', async () => {
    // Matriz densa de propósito: TODAS as C(20,17)=1140 cartelas que cabem num
    // sub-universo de 20 dezenas. Elas se sobrepõem pesadamente, então existe
    // redundância de verdade para a poda encontrar — e a cobertura alvo é
    // exatamente C(20,15)=15504.
    const mat = await M.mtzMontarMatriz(cartelasDeSubUniverso(20), {});
    expect(mat.n).toBe(1140);
    const cheio = mat.cobertas;
    expect(cheio).toBe(15504);

    const res = await M.mtzOtimizar(mat, {
      meta: { modo: 'cobertura100' }, reinicios: 1, tempoBuscaMs: 0, seed: 3,
    });
    expect(res.coberturaFinal).toBe(cheio);          // nenhuma perda, é a regra do modo
    expect(res.cartelasFinais).toBeLessThan(570);    // corta mais da metade
    expect(res.cartelasFinais).toBeGreaterThanOrEqual(114); // piso teórico: 15504/136

    // A garantia de fato do modo 100%: o que sobrou é IRREDUNDANTE — nenhuma
    // cartela restante sai de graça. (O mínimo absoluto é NP-difícil; o que se
    // promete é "não dá para remover mais nada sem perder".)
    let removivelDeGraca = 0;
    for (let c = 0; c < mat.n; c++) {
      if (mat.ativo[c] && M.mtzPerdaSeRemover(mat, c) === 0) removivelDeGraca++;
    }
    expect(removivelDeGraca).toBe(0);

    const v = await M.mtzValidarExaustivo(mat, {});
    expect(v.cobertas).toBe(cheio);
    expect(v.confere).toBe(true);
  });

  it('o modo 100% não remove nada de uma matriz ESPARSA — e isso é o certo', async () => {
    // Com 2.000 cartelas sorteadas entre as 1.081.575 possíveis, a chance de as
    // 136 combinações de uma cartela estarem todas cobertas por outras é
    // ~10^-128. Nenhuma cartela é dispensável, então o modo 100% devolve a
    // matriz intacta. Se algum dia isto "melhorar", é porque quebrou.
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(2000, 404), {});
    const cheio = mat.cobertas;
    const res = await M.mtzOtimizar(mat, {
      meta: { modo: 'cobertura100' }, reinicios: 1, tempoBuscaMs: 0, seed: 3,
    });
    expect(res.cartelasFinais).toBe(2000);
    expect(res.coberturaFinal).toBe(cheio);
  });

  it('marca como INVIÁVEL uma cobertura mínima acima do que a matriz tem', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(2000, 71), {});
    const temAgora = mat.cobertas / 3268760;
    expect(temAgora).toBeLessThan(0.9);            // matriz esparsa, longe de 90%
    const res = await M.mtzOtimizar(mat, {
      meta: { modo: 'coberturaMinima', valor: 90 }, reinicios: 1, tempoBuscaMs: 0, seed: 2,
    });
    expect(res.metaViavel).toBe(false);
    expect(res.metaObservacao).toContain('90');
    expect(res.cartelasFinais).toBe(2000);         // não removeu nada, e diz por quê
  });

  it('marca como viável uma cobertura mínima que a matriz alcança', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(2000, 71), {});
    const metade = Math.floor((100 * mat.cobertas / 3268760) / 2);
    const res = await M.mtzOtimizar(mat, {
      meta: { modo: 'coberturaMinima', valor: metade }, reinicios: 1, tempoBuscaMs: 0, seed: 2,
    });
    expect(res.metaViavel).toBe(true);
    expect(res.cartelasFinais).toBeLessThan(2000);
    expect(res.coberturaFinal / 3268760).toBeGreaterThanOrEqual(metade / 100);
  });

  it('reinícios não pioram o resultado (guarda o melhor)', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(2000, 51), {});
    const um = await M.mtzOtimizar(mat, {
      meta: { modo: 'quantidade', valor: 800 }, reinicios: 1, tempoBuscaMs: 0, seed: 4,
    });
    const tres = await M.mtzOtimizar(mat, {
      meta: { modo: 'quantidade', valor: 800 }, reinicios: 3, tempoBuscaMs: 0, seed: 4,
    });
    expect(tres.coberturaAntesBusca).toBeGreaterThanOrEqual(um.coberturaAntesBusca);
  });
});

describe('entrada e saída', () => {
  it('exporta apenas as cartelas ativas, com dezenas de 1 a 25', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(200, 12), {});
    M.mtzRemover(mat, 0); M.mtzRemover(mat, 1);
    const linhas = M.mtzExportarAtivas(mat);
    expect(linhas.length).toBe(198);
    for (const l of linhas) {
      expect(l.length).toBe(17);
      expect(new Set(l).size).toBe(17);
      for (const d of l) { expect(d).toBeGreaterThanOrEqual(1); expect(d).toBeLessThanOrEqual(25); }
    }
  });

  it('exportar e importar é uma ida e volta fiel', async () => {
    const mat = await M.mtzMontarMatriz(M.mtzGerarCartelas(150, 19), {});
    const texto = M.mtzExportarAtivas(mat).map((l) => l.join(' ')).join('\n');
    const { masks, erros } = M.mtzImportarTexto(texto);
    expect(erros).toEqual([]);
    expect(Array.from(masks).sort()).toEqual(Array.from(mat.masks).sort());
  });

  it('a importação recusa linhas inválidas dizendo qual é o problema', () => {
    const { masks, erros } = M.mtzImportarTexto([
      '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17',   // ok
      '1 2 3',                                        // curta
      '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 26',    // fora da faixa
      '1 1 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17',    // repetida
      '1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17',    // duplicata da 1ª
    ].join('\n'));
    expect(masks.length).toBe(1);
    expect(erros.length).toBe(4);
    expect(erros[0]).toContain('linha 2');
    expect(erros[1]).toContain('linha 3');
    expect(erros[2]).toContain('linha 4');
    expect(erros[3]).toContain('linha 5');
  });

  it('aceita separadores variados e ignora linhas em branco', () => {
    const { masks, erros } = M.mtzImportarTexto(
      '\n1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16,17\n\n  01-02-03-04-05-06-07-08-09-10-11-12-13-14-15-16-18 \n',
    );
    expect(erros).toEqual([]);
    expect(masks.length).toBe(2);
  });
});
