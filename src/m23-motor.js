'use strict';
/* ============================================================================
 * M23 — laboratório matemático do cenário 25/23
 *
 * PERGUNTA DO LABORATÓRIO: existe uma construção — um conjunto de cartelas —
 * que GARANTA 15 acertos em pelo menos uma cartela, partindo de uma redução
 * do universo de 25 dezenas da Lotofácil para um grupo menor de v dezenas
 * (o "cenário 25/23" reduz para v=23), e que ainda assim seja economicamente
 * defensável? E se não for, exatamente ONDE está a parede, e o que dá para
 * fazer com o espaço de configurações que sobra?
 *
 * Este arquivo não assume a resposta. Ele calcula.
 *
 * ---------------------------------------------------------------------------
 * O MODELO (e por que ele é o modelo certo, não um enfeite)
 * ---------------------------------------------------------------------------
 * A Lotofácil sorteia DRAW_SIZE=15 dezenas de um universo de POOL_SIZE=25.
 * Reduzir para v dezenas (v<25) só faz sentido SE o sorteio real cair inteiro
 * dentro das v escolhidas — isso é uma APOSTA sobre o sorteio, não uma
 * garantia; a probabilidade de acontecer é C(v,15)/C(25,15), calculada por
 * `m23ProbDrawWithinUniverse`, e o laboratório mostra esse número sempre,
 * para não deixar a condicional escondida atrás da palavra "garantia".
 *
 * DADO que o sorteio caiu dentro das v dezenas, uma cartela de c dezenas
 * (15 a 20, como o próprio jogo oficial permite) acerta pelo menos
 *   max(0, c + 15 − v)
 * pontos, SEMPRE — é o princípio da casa dos pombos aplicado ao pior caso: a
 * cartela deixa de fora (v−c) dezenas do universo reduzido, e o sorteio, no
 * pior caso, concentra todas as suas "faltas" exatamente nelas. Essa é
 * `m23SingleTicketGuarantee`, e ela sozinha já é a prova de que UMA cartela
 * não garante 15 pontos a menos que c=v (jogar o universo inteiro).
 *
 * Para várias cartelas garantirem juntas ≥t acertos em pelo menos uma delas,
 * CONTRA QUALQUER sorteio de 15 dezenas dentro do universo v, basta (esse é
 * um teorema, não uma heurística) que toda combinação de t dezenas do
 * universo esteja CONTIDA em pelo menos uma cartela jogada — porque toda
 * cartela de 15 dezenas contém pelo menos uma combinação de t dezenas suas
 * (qualquer uma, já que t≤15), e se essa combinação está contida numa
 * cartela jogada, a interseção entre a cartela e o sorteio tem no mínimo t
 * elementos. Isso reduz o problema a um objeto clássico da combinatória: um
 * "covering design" C(v,c,t) — cartelas de tamanho c cobrindo toda t-upla de
 * um universo de tamanho v. `m23CoveringLowerBound` calcula o piso desse
 * problema por contagem dupla (cada cartela cobre C(c,t) t-uplas; existem
 * C(v,t) t-uplas a cobrir; logo, nenhuma construção cabe em menos do que
 * ceil(C(v,t)/C(c,t)) cartelas). Quando t=15=c, C(c,t)=1: cada cartela cobre
 * exatamente A SI MESMA, e o piso vira C(v,15) inteiro — a parede é essa
 * contagem, não uma opinião.
 *
 * O que muda o jogo é que c NÃO precisa ser 15. O jogo oficial aceita
 * cartelas de até 20 dezenas (cobrando, para isso, o preço de todas as
 * C(c,15) combinações simples embutidas — `m23TicketPrice`). Cartelas
 * maiores cobrem MUITAS t-uplas de uma vez (C(c,t) cresce rápido com c), e
 * isso pode derrubar o piso de centenas de milhares de cartelas para dezenas
 * — a um preço por cartela muito mais alto. É exatamente essa troca —
 * cartelas maiores e mais caras vs. mais cartelas e mais baratas — que o
 * motor de busca explora, em vez de simplesmente "aumentar a quantidade".
 *
 * ---------------------------------------------------------------------------
 * O MOTOR DE BUSCA (a parte que não assume, TENTA)
 * ---------------------------------------------------------------------------
 * `m23BuildCoveringGreedy` constrói coberturas de verdade: a cada passo,
 * sorteia candidatas (cartelas aleatórias de tamanho c) e joga a que cobre
 * mais t-uplas ainda não cobertas — greedy estocástico, a técnica padrão
 * para set cover em espaços grandes demais para tentar tudo. `m23PruneRedundant`
 * remove cartelas que não são mais necessárias depois que outras as tornaram
 * redundantes. `m23RefineAnnealing` tenta trocar cartelas por outras
 * melhores com um cronograma de temperatura decrescente (recozimento
 * simulado), aceitando pioras pequenas no começo para não travar em mínimos
 * locais ruins. Nenhuma dessas três funções sabe de antemão se vai
 * completar a cobertura — elas relatam o que conseguiram, com o piso teórico
 * ao lado para dar a régua.
 *
 * `m23RunCampaign` varre uma grade de configurações (universo v, tamanho de
 * cartela c, meta de acertos t) dentro de um orçamento de tempo, e devolve
 * cada resultado — completo ou parcial — para o laboratório comparar.
 *
 * ---------------------------------------------------------------------------
 * Tudo aqui é função pura sobre números; nada toca o DOM. Dá para testar o
 * motor inteiro com Node puro — é o que test/m23-motor.test.js faz.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* §1 — Constantes do jogo                                                     */
/* -------------------------------------------------------------------------- */

const M23_POOL_SIZE = 25;      // universo oficial da Lotofácil
const M23_DRAW_SIZE = 15;      // dezenas sorteadas
const M23_MIN_TICKET = 15;     // menor cartela possível
const M23_MAX_TICKET = 20;     // maior cartela aceita pelo jogo oficial
const M23_BASE_PRICE = 3;      // preço (R$) da aposta simples de 15 dezenas — referência estável; confira o valor vigente antes de decidir por dinheiro real

/* -------------------------------------------------------------------------- */
/* §2 — Combinatória de base                                                   */
/* -------------------------------------------------------------------------- */

/** C(n,r) — via BigInt internamente (evita erro de arredondamento em produtos
 *  intermediários grandes) e devolve Number; os parâmetros usados neste
 *  laboratório (n≤25) nunca chegam perto do limite de precisão do double. */
function m23NCr(n, r) {
  if (r < 0 || r > n) return 0;
  r = Math.min(r, n - r);
  let num = 1n, den = 1n;
  for (let i = 0; i < r; i++) {
    num *= BigInt(n - i);
    den *= BigInt(i + 1);
  }
  return Number(num / den);
}

/** Gerador RNG determinístico (mulberry32) — mesma semente, mesma busca;
 *  necessário para que uma configuração encontrada seja reproduzível. */
function m23Mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Amostra aleatória de r índices distintos em [0,n) — algoritmo de Floyd,
 *  devolve ordenado. Usado para propor cartelas-candidatas na busca gulosa. */
function m23RandomCombination(n, r, rng) {
  const picked = new Set();
  for (let j = n - r; j < n; j++) {
    const t = Math.floor(rng() * (j + 1));
    picked.add(picked.has(t) ? j : t);
  }
  return Array.from(picked).sort((a, b) => a - b);
}

/** Rank de uma combinação (índices 0-based, ordenados asc) no sistema
 *  combinatorial numérico — bijeção entre C(n,r) combinações e [0,C(n,r)).
 *  É a chave usada para marcar "esta t-upla já foi coberta" sem guardar o
 *  array inteiro como identificador. */
function m23RankCombo(sortedIdx, n) {
  const r = sortedIdx.length;
  let rank = 0;
  for (let i = 0; i < r; i++) {
    const elem = sortedIdx[i];
    rank += m23NCr(elem, i + 1);
  }
  return rank;
}

/** Inverso de `m23RankCombo` — reconstrói a combinação a partir do rank.
 *  Usada só em testes/depuração (confirma a bijeção). */
function m23UnrankCombo(rank, n, r) {
  const out = [];
  let rem = rank;
  for (let i = r; i >= 1; i--) {
    let elem = i - 1;
    while (m23NCr(elem + 1, i) <= rem) elem++;
    out.unshift(elem);
    rem -= m23NCr(elem, i);
  }
  return out;
}

/** Gerador de todas as combinações de tamanho r de um array (mantendo os
 *  VALORES do array, não índices) — usado para varrer as t-uplas cobertas
 *  por uma cartela (arr = a cartela, r = t). */
function* m23Combinations(arr, r) {
  const n = arr.length;
  if (r > n || r < 0) return;
  const idx = Array.from({ length: r }, (_, i) => i);
  while (true) {
    yield idx.map((i) => arr[i]);
    let i = r - 1;
    while (i >= 0 && idx[i] === i + n - r) i--;
    if (i < 0) return;
    idx[i]++;
    for (let j = i + 1; j < r; j++) idx[j] = idx[j - 1] + 1;
  }
}

/** Bitset compacto (Uint32Array) para marcar t-uplas cobertas — para v=23 e
 *  t=14 são 817.190 bits (~102 KB); um Set de Number equivalente pesaria
 *  muito mais e seria mais lento para o volume de checagens da busca. */
class M23Bitset {
  constructor(n) {
    this.n = n;
    this.buf = new Uint32Array((n >>> 5) + 1);
    this.count = 0;
  }
  has(i) { return (this.buf[i >>> 5] & (1 << (i & 31))) !== 0; }
  /** Marca i; devolve true se ANTES não estava marcado (nova cobertura). */
  add(i) {
    const word = i >>> 5, bit = 1 << (i & 31);
    if (this.buf[word] & bit) return false;
    this.buf[word] |= bit;
    this.count++;
    return true;
  }
  clone() {
    const b = new M23Bitset(this.n);
    b.buf.set(this.buf);
    b.count = this.count;
    return b;
  }
}

/* -------------------------------------------------------------------------- */
/* §3 — As fórmulas do modelo (fechadas, sem busca)                            */
/* -------------------------------------------------------------------------- */

/** Garantia mínima de UMA cartela de c dezenas contra QUALQUER sorteio de
 *  15 dezenas dentro de um universo reduzido de v — princípio da casa dos
 *  pombos: a cartela erra no máximo as (v−c) dezenas que não escolheu, e o
 *  sorteio, no pior caso, é composto por essas faltas primeiro. */
function m23SingleTicketGuarantee(v, c, drawSize = M23_DRAW_SIZE) {
  return Math.max(0, c + drawSize - v);
}

/** Preço (R$) de uma cartela de c dezenas — o jogo oficial cobra o
 *  equivalente a jogar todas as C(c,15) apostas simples embutidas nela. */
function m23TicketPrice(c, drawSize = M23_DRAW_SIZE, basePrice = M23_BASE_PRICE) {
  return m23NCr(c, drawSize) * basePrice;
}

/** Probabilidade de o sorteio oficial (15 de 25) cair inteiro dentro de um
 *  universo reduzido de v dezenas — a premissa de que TODO o resto do
 *  laboratório depende, e por isso nunca fica escondida. */
function m23ProbDrawWithinUniverse(v, poolSize = M23_POOL_SIZE, drawSize = M23_DRAW_SIZE) {
  return m23NCr(v, drawSize) / m23NCr(poolSize, drawSize);
}

/** Distribuição EXATA de acertos de uma única cartela de c dezenas contra um
 *  sorteio aleatório de 15 dentro do universo v (hipergeométrica: a cartela
 *  tem c dezenas "boas" e o universo tem v−c "ruins" fora dela). Serve de
 *  referência rápida antes de rodar qualquer simulação. */
function m23HitDistribution(v, c, drawSize = M23_DRAW_SIZE) {
  const out = [];
  const minHits = Math.max(0, drawSize - (v - c));
  const maxHits = Math.min(c, drawSize);
  const total = m23NCr(v, drawSize);
  for (let h = minHits; h <= maxHits; h++) {
    const ways = m23NCr(c, h) * m23NCr(v - c, drawSize - h);
    out.push({ hits: h, probability: total ? ways / total : 0 });
  }
  return out;
}

/** Piso teórico (cota por contagem dupla) para o número mínimo de cartelas
 *  de tamanho k necessárias para cobrir TODA combinação de t dezenas de um
 *  universo de v — cada cartela cobre C(k,t) t-uplas; existem C(v,t) a
 *  cobrir; nenhuma construção cabe em menos do que o teto dessa razão.
 *  Quando t=k (a meta de 15 acertos com cartela de 15 dezenas), C(k,t)=1 e
 *  o piso vira C(v,t) inteiro — a parede matemática do cenário ingênuo. */
function m23CoveringLowerBound(v, k, t) {
  if (t > k || k > v || t < 0) return Infinity;
  const perBlock = m23NCr(k, t);
  if (perBlock === 0) return Infinity;
  return Math.ceil(m23NCr(v, t) / perBlock);
}

/** Refinamento recursivo do piso (cota de Schönheim) — em vez de só contar
 *  quantas t-uplas cabem por cartela, aplica o MESMO argumento uma dimensão
 *  abaixo (fixando um ponto do universo e olhando quantas cartelas TÊM de
 *  conter esse ponto), o que produz um piso pelo menos tão apertado quanto
 *  o de contagem simples — nunca mais frouxo. Usado como segunda régua ao
 *  lado da cota simples, para saber quando a busca ainda tem margem real. */
function m23SchonheimBound(v, k, t) {
  if (t <= 0 || v < k) return 1;
  if (v === k) return 1;
  const inner = m23SchonheimBound(v - 1, k - 1, t - 1);
  return Math.ceil((v / k) * inner);
}

/* -------------------------------------------------------------------------- */
/* §4 — Construção: busca gulosa estocástica                                   */
/* -------------------------------------------------------------------------- */

/** Marca no bitset todas as t-uplas cobertas por uma cartela; devolve quantas
 *  eram NOVAS (não estavam marcadas antes). */
function m23MarkBlock(bitset, block, t, v) {
  let novas = 0;
  for (const combo of m23Combinations(block, t)) {
    if (bitset.add(m23RankCombo(combo, v))) novas++;
  }
  return novas;
}

/** Conta quantas t-uplas de uma cartela AINDA NÃO estão marcadas, sem marcar
 *  nada — usado para avaliar candidatas antes de escolher a melhor. */
function m23CountNew(bitset, block, t, v) {
  let novas = 0;
  for (const combo of m23Combinations(block, t)) {
    if (!bitset.has(m23RankCombo(combo, v))) novas++;
  }
  return novas;
}

/** Constrói uma cobertura C(v,c,t) por busca gulosa estocástica, em passos
 *  assíncronos (cede o event loop periodicamente — isto roda na thread
 *  principal do navegador, então uma busca longa não pode travar a tela).
 *
 *  A cada iteração sorteia `sampleSize` cartelas candidatas e joga a que
 *  cobre mais t-uplas novas; quando t=k, cada candidata cobre exatamente 1
 *  t-upla (ela mesma) e a função devolve resultado exato sem precisar
 *  varrer nada — ver a nota no início do arquivo sobre por que t=k é a
 *  parede.
 *
 *  Nunca finge ter terminado: `complete` só é true quando o bitset atingiu
 *  100% das t-uplas do universo. */
async function m23BuildCoveringGreedy(opts) {
  const {
    v, c, t,
    timeBudgetMs = 8000,
    maxBlocks = 4000,
    sampleSize = 60,
    seed = 1,
    onProgress = null,
    shouldStop = null,
  } = opts;

  const rng = m23Mulberry32(seed);
  const totalAlvo = m23NCr(v, t);
  const bitset = new M23Bitset(totalAlvo);
  const blocks = [];
  const seen = new Set();
  const t0 = Date.now();
  let iterations = 0;

  // Caso trivial t=k: cada cartela cobre exatamente a si mesma — não há o
  // que "buscar", só enumerar até completar (e isso só é viável quando
  // C(v,t) é pequeno o bastante para caber no orçamento).
  const trivial = (t === c);

  while (bitset.count < totalAlvo && blocks.length < maxBlocks) {
    if (shouldStop && shouldStop()) break;
    const elapsed = Date.now() - t0;
    if (elapsed > timeBudgetMs) break;

    let melhor = null, melhorNovas = -1;
    const tentativas = trivial ? 1 : sampleSize;
    for (let s = 0; s < tentativas; s++) {
      const cand = m23RandomCombination(v, c, rng);
      const key = cand.join(',');
      if (seen.has(key)) continue;
      const novas = trivial ? 1 : m23CountNew(bitset, cand, t, v);
      if (novas > melhorNovas) { melhorNovas = novas; melhor = cand; }
      if (trivial && novas > 0) break;
    }
    iterations++;
    if (!melhor || melhorNovas <= 0) {
      // Amostragem não achou candidata útil — não decide que acabou (pode
      // ser azar da amostra), só cede a vez e tenta de novo, até o tempo
      // acabar. Isto é o que acontece perto do fim de coberturas grandes.
      if (iterations % 25 === 0) await new Promise((r) => setTimeout(r, 0));
      if (Date.now() - t0 > timeBudgetMs) break;
      continue;
    }
    seen.add(melhor.join(','));
    m23MarkBlock(bitset, melhor, t, v);
    blocks.push(melhor);

    if (onProgress && blocks.length % 5 === 0) {
      onProgress({ blocks: blocks.length, coverage: bitset.count / totalAlvo, elapsed: Date.now() - t0 });
    }
    if (blocks.length % 20 === 0) await new Promise((r) => setTimeout(r, 0));
  }

  if (onProgress) onProgress({ blocks: blocks.length, coverage: bitset.count / totalAlvo, elapsed: Date.now() - t0 });

  return {
    v, c, t,
    blocks,
    totalAlvo,
    covered: bitset.count,
    coverageFraction: totalAlvo ? bitset.count / totalAlvo : 1,
    complete: bitset.count >= totalAlvo,
    elapsedMs: Date.now() - t0,
    iterations,
  };
}

/** Remove cartelas redundantes: joga fora, uma a uma, qualquer cartela cuja
 *  ausência não reduz a cobertura (porque toda t-upla que ela cobria também
 *  é coberta por outra cartela do conjunto). Passe determinístico e barato,
 *  sempre roda antes do recozimento simulado. */
function m23PruneRedundant(blocks, v, t) {
  const totalAlvo = m23NCr(v, t);
  const bitset = new M23Bitset(totalAlvo);
  for (const b of blocks) m23MarkBlock(bitset, b, t, v);
  if (bitset.count < totalAlvo) return blocks.slice(); // cobertura incompleta: não mexe

  const kept = blocks.slice();
  for (let i = kept.length - 1; i >= 0; i--) {
    const testBitset = new M23Bitset(totalAlvo);
    for (let j = 0; j < kept.length; j++) {
      if (j === i) continue;
      m23MarkBlock(testBitset, kept[j], t, v);
    }
    if (testBitset.count >= totalAlvo) kept.splice(i, 1); // ainda cobre tudo sem ela
  }
  return kept;
}

/** Recozimento simulado: tenta trocar uma cartela do conjunto por outra
 *  aleatória; aceita a troca se ela não piora a cobertura, e aceita pioras
 *  PEQUENAS com probabilidade decrescente (temperatura caindo ao longo do
 *  orçamento de tempo) para não travar em mínimos locais. Só faz sentido
 *  chamar depois de uma cobertura já completa ou quase completa — o
 *  objetivo aqui é ENXUGAR o número de cartelas, não completar do zero. */
async function m23RefineAnnealing(blocks, v, c, t, opts = {}) {
  const { timeBudgetMs = 4000, seed = 2, onProgress = null } = opts;
  const rng = m23Mulberry32(seed);
  const totalAlvo = m23NCr(v, t);
  let atual = blocks.slice();
  const t0 = Date.now();
  let melhorConjunto = atual.slice();

  const cobertura = (conj) => {
    const bs = new M23Bitset(totalAlvo);
    for (const b of conj) m23MarkBlock(bs, b, t, v);
    return bs.count;
  };
  let coberturaAtual = cobertura(atual);
  let melhorCobertura = coberturaAtual;

  let passo = 0;
  while (Date.now() - t0 < timeBudgetMs && atual.length > 1) {
    passo++;
    const frac = (Date.now() - t0) / timeBudgetMs;
    const temperatura = Math.max(0.01, 1 - frac);

    // remove a cartela que menos contribui de forma exclusiva (aproximação:
    // sorteia uma e testa) e tenta substituí-la por uma candidata melhor.
    const idx = Math.floor(rng() * atual.length);
    const semEla = atual.slice(0, idx).concat(atual.slice(idx + 1));
    const coberturaSemEla = cobertura(semEla);

    if (coberturaSemEla >= totalAlvo) {
      // a cartela era redundante — descarta, conjunto encolhe de graça.
      atual = semEla;
      coberturaAtual = coberturaSemEla;
    } else {
      const candidata = m23RandomCombination(v, c, rng);
      const testando = semEla.concat([candidata]);
      const coberturaTeste = cobertura(testando);
      const delta = coberturaTeste - coberturaAtual;
      if (delta >= 0 || rng() < Math.exp(delta / (totalAlvo * 0.001 * temperatura + 1e-9))) {
        atual = testando;
        coberturaAtual = coberturaTeste;
      }
    }

    if (coberturaAtual >= melhorCobertura && atual.length <= melhorConjunto.length) {
      melhorCobertura = coberturaAtual;
      melhorConjunto = atual.slice();
    }
    if (passo % 15 === 0) {
      await new Promise((r) => setTimeout(r, 0));
      if (onProgress) onProgress({ blocks: atual.length, coverage: coberturaAtual / totalAlvo, elapsed: Date.now() - t0 });
    }
  }

  return {
    blocks: melhorConjunto,
    coverageFraction: totalAlvo ? melhorCobertura / totalAlvo : 1,
    complete: melhorCobertura >= totalAlvo,
    elapsedMs: Date.now() - t0,
  };
}

/* -------------------------------------------------------------------------- */
/* §5 — Avaliação por simulação (Monte Carlo)                                  */
/* -------------------------------------------------------------------------- */

/** Simula `trials` sorteios aleatórios de 15 dezenas dentro do universo v
 *  (a premissa condicional do cenário reduzido) e mede, para o conjunto de
 *  cartelas dado, quantas vezes cada faixa de acerto (11 a 15) foi atingida
 *  por PELO MENOS UMA cartela — a estatística que sustenta "quantas cartelas
 *  premiadas" e "retorno estimado" quando a cobertura não é 100% garantida
 *  (ou mesmo quando é, para contar prêmios SECUNDÁRIOS nas faixas abaixo). */
function m23MonteCarloEvaluate(opts) {
  const {
    v, blocks, trials = 4000, seed = 3,
    drawSize = M23_DRAW_SIZE, tiers = [11, 12, 13, 14, 15],
  } = opts;
  const rng = m23Mulberry32(seed);
  const tierHitsAnyTicket = Object.fromEntries(tiers.map((tt) => [tt, 0]));
  const tierTicketCount = Object.fromEntries(tiers.map((tt) => [tt, 0])); // soma de cartelas premiadas por faixa (todas as rodadas)
  let melhorAcertoGlobal = 0;

  const blockSets = blocks.map((b) => new Set(b));

  for (let trial = 0; trial < trials; trial++) {
    const draw = m23RandomCombination(v, drawSize, rng);
    let melhorNestaRodada = 0;
    const atingidosNestaRodada = Object.fromEntries(tiers.map((tt) => [tt, 0]));
    for (const bs of blockSets) {
      let hits = 0;
      for (const d of draw) if (bs.has(d)) hits++;
      if (hits > melhorNestaRodada) melhorNestaRodada = hits;
      for (const tt of tiers) if (hits >= tt) atingidosNestaRodada[tt]++;
    }
    if (melhorNestaRodada > melhorAcertoGlobal) melhorAcertoGlobal = melhorNestaRodada;
    for (const tt of tiers) {
      if (atingidosNestaRodada[tt] > 0) tierHitsAnyTicket[tt]++;
      tierTicketCount[tt] += atingidosNestaRodada[tt];
    }
  }

  const tierProbability = Object.fromEntries(tiers.map((tt) => [tt, trials ? tierHitsAnyTicket[tt] / trials : 0]));
  const tierAvgTicketsPerDraw = Object.fromEntries(tiers.map((tt) => [tt, trials ? tierTicketCount[tt] / trials : 0]));

  return { trials, tierProbability, tierAvgTicketsPerDraw, melhorAcertoGlobal, tiers };
}

/* -------------------------------------------------------------------------- */
/* §6 — Economia: custo, retorno, pontuação                                    */
/* -------------------------------------------------------------------------- */

/** Custo total (R$) de um conjunto de cartelas de tamanho c. */
function m23ComputeCost(numTickets, c, basePrice = M23_BASE_PRICE, drawSize = M23_DRAW_SIZE) {
  return numTickets * m23TicketPrice(c, drawSize, basePrice);
}

/** Retorno esperado (R$) a partir das probabilidades por faixa (Monte Carlo
 *  ou distribuição exata) e uma tabela de prêmios FORNECIDA por quem chama —
 *  o motor nunca embute valor de prêmio como se fosse fato: o valor de cada
 *  faixa muda com concurso e acumulado, e cabe a quem usa o laboratório
 *  informar o valor vigente. Sem tabela (ou com valores zerados), o retorno
 *  esperado sai honestamente como zero, não como um número inventado. */
function m23ComputeExpectedReturn({ tierProbability, tierAvgTicketsPerDraw, prizeTable }) {
  let esperado = 0;
  const porFaixa = {};
  for (const tier of Object.keys(prizeTable || {})) {
    const premio = Number(prizeTable[tier]) || 0;
    const mediaCartelas = (tierAvgTicketsPerDraw && tierAvgTicketsPerDraw[tier]) || 0;
    const valor = premio * mediaCartelas;
    porFaixa[tier] = valor;
    esperado += valor;
  }
  return { esperado, porFaixa };
}

/** Pontuação composta para ranquear soluções — critério transparente e
 *  documentado (não é "IA decide"): primeiro quem GARANTE de verdade
 *  (cobertura=100%) na meta pedida; entre garantidas, a de menor custo;
 *  entre as não-garantidas, a de maior cobertura, e como desempate o
 *  retorno esperado por real investido. */
function m23ScoreResult(r) {
  const roi = r.cost > 0 ? (r.expectedReturn || 0) / r.cost : 0;
  return { garante: !!r.complete, custo: r.cost, cobertura: r.coverageFraction, roi };
}

function m23CompareResults(a, b) {
  const sa = m23ScoreResult(a), sb = m23ScoreResult(b);
  if (sa.garante !== sb.garante) return sa.garante ? -1 : 1;
  if (sa.garante && sb.garante) return sa.custo - sb.custo;
  if (Math.abs(sa.cobertura - sb.cobertura) > 1e-9) return sb.cobertura - sa.cobertura;
  return sb.roi - sa.roi;
}

/* -------------------------------------------------------------------------- */
/* §7 — A campanha: varre a grade de configurações                             */
/* -------------------------------------------------------------------------- */

/** Gera a lista de configurações (v,c,t) a testar, cruzando os intervalos
 *  pedidos e limitando o total (uma campanha não pode virar um laço
 *  infinito por engano do formulário). */
function m23PlanCampaign({ vRange, cRange, tRange, maxConfigs = 30 }) {
  const configs = [];
  for (const v of vRange) {
    for (const c of cRange) {
      if (c > v) continue;
      for (const t of tRange) {
        if (t > c || t > M23_DRAW_SIZE) continue;
        configs.push({ v, c, t });
      }
    }
  }
  // Prioriza metas mais altas e universos mais próximos do pedido pelo
  // usuário — quem pediu "15 acertos" quer ver 15 primeiro, não por último.
  configs.sort((a, b) => (b.t - a.t) || (a.c - b.c) || (a.v - b.v));
  return configs.slice(0, maxConfigs);
}

/** Roda uma configuração isolada: decide entre atalho exato (t=c: a parede
 *  é a fórmula, não precisa buscar) e busca real (greedy + poda + recozimento
 *  + avaliação por simulação), sempre dentro de orçamentos de tempo. */
async function m23RunConfig(config, params) {
  const { v, c, t } = config;
  const {
    basePrice = M23_BASE_PRICE,
    prizeTable = {},
    greedyTimeMs = 6000,
    annealTimeMs = 2500,
    monteCarloTrials = 3000,
    seed = 1,
    onProgress = null,
    shouldStop = null,
  } = params;

  const lowerBound = m23CoveringLowerBound(v, c, t);
  const schonheim = m23SchonheimBound(v, c, t);
  const singleGuarantee = m23SingleTicketGuarantee(v, c);

  if (t === c) {
    // Parede provada: a única forma de cobrir toda t-upla com blocos do
    // próprio tamanho t é jogar TODAS elas — não há o que buscar.
    const numTickets = m23NCr(v, t);
    const cost = m23ComputeCost(numTickets, c, basePrice);
    return {
      v, c, t, method: 'parede-provada',
      numTickets, lowerBound, schonheim, singleGuarantee,
      coverageFraction: 1, complete: true,
      cost, expectedReturn: 0, expectedReturnDetail: null,
      note: `Cobrir toda combinação de ${t} dezenas com cartelas de ${c} exige exatamente C(${v},${t}) = ${numTickets.toLocaleString('pt-BR')} cartelas — cada cartela só cobre a si mesma (C(${c},${t})=1). Não é limite de busca: é o piso exato, e a busca não precisa rodar para confirmar isso.`,
    };
  }

  const greedy = await m23BuildCoveringGreedy({
    v, c, t, timeBudgetMs: greedyTimeMs, seed, onProgress, shouldStop,
  });
  let blocks = greedy.blocks;
  if (greedy.complete && blocks.length > 1) {
    blocks = m23PruneRedundant(blocks, v, t);
    const refined = await m23RefineAnnealing(blocks, v, c, t, { timeBudgetMs: annealTimeMs, seed: seed + 1, onProgress });
    if (refined.complete && refined.blocks.length <= blocks.length) blocks = refined.blocks;
  }

  const finalCoverage = (() => {
    const totalAlvo = m23NCr(v, t);
    const bs = new M23Bitset(totalAlvo);
    for (const b of blocks) m23MarkBlock(bs, b, t, v);
    return { covered: bs.count, totalAlvo, fraction: totalAlvo ? bs.count / totalAlvo : 1 };
  })();

  const mc = m23MonteCarloEvaluate({ v, blocks, trials: monteCarloTrials, seed: seed + 2 });
  const cost = m23ComputeCost(blocks.length, c, basePrice);
  const ret = m23ComputeExpectedReturn({
    tierProbability: mc.tierProbability, tierAvgTicketsPerDraw: mc.tierAvgTicketsPerDraw, prizeTable,
  });

  return {
    v, c, t, method: 'busca (guloso + poda + recozimento)',
    numTickets: blocks.length, blocks,
    lowerBound, schonheim, singleGuarantee,
    coverageFraction: finalCoverage.fraction,
    complete: finalCoverage.fraction >= 1,
    cost, expectedReturn: ret.esperado, expectedReturnDetail: ret.porFaixa,
    monteCarlo: mc,
    note: finalCoverage.fraction >= 1
      ? `Cobertura completa alcançada com ${blocks.length} cartelas (piso teórico: ${lowerBound.toLocaleString('pt-BR')}).`
      : `Cobertura parcial: ${(finalCoverage.fraction * 100).toFixed(2)}% dentro do orçamento de tempo, com ${blocks.length} cartelas (piso teórico: ${lowerBound.toLocaleString('pt-BR')}). Mais tempo de busca tende a aproximar do piso, não a ultrapassá-lo.`,
  };
}

/** Orquestra a campanha inteira: roda cada configuração planejada, relata
 *  progresso incremental via `onResult` (a interface pode ir desenhando a
 *  tabela ranqueada enquanto a busca ainda roda) e devolve tudo ranqueado
 *  ao final. Cooperativa: `shouldStop()` permite cancelar entre configs. */
async function m23RunCampaign(params) {
  const { vRange, cRange, tRange, maxConfigs = 30, onResult = null, onConfigStart = null, shouldStop = null } = params;
  const configs = m23PlanCampaign({ vRange, cRange, tRange, maxConfigs });
  const results = [];
  for (const config of configs) {
    if (shouldStop && shouldStop()) break;
    if (onConfigStart) onConfigStart(config);
    const result = await m23RunConfig(config, params);
    results.push(result);
    if (onResult) onResult(result, results.slice().sort(m23CompareResults));
  }
  return results.sort(m23CompareResults);
}
