'use strict';
/* ============================================================================
 * MATRIZ — motor de poda e otimização combinatória de cartelas
 *
 * O PROBLEMA. Universo de 25 dezenas, sorteio de 15, cartelas de 17. Uma
 * cartela vence quando CONTÉM as 15 dezenas sorteadas. Como uma cartela de 17
 * contém C(17,2) = 136 subconjuntos de 15, cada cartela "cobre" 136 das
 * C(25,15) = 3.268.760 combinações possíveis. Otimizar a matriz é escolher
 * QUAIS cartelas manter para cobrir o máximo com o mínimo de cartelas.
 *
 * ---------------------------------------------------------------------------
 * OS DOIS NÚMEROS QUE DECIDEM A ARQUITETURA INTEIRA
 * ---------------------------------------------------------------------------
 * 1. Toda combinação de 15 está contida em EXATAMENTE C(25−15, 17−15) =
 *    C(10,2) = 45 cartelas de 17 (escolhem-se as 2 dezenas extras entre as 10
 *    que sobraram). Logo o contador de cobertura NUNCA passa de 45 e cabe num
 *    Uint8Array: 3,12 MB em vez dos 13 MB de um Int32Array. Esse contador é o
 *    índice de redundância do §6 do projeto — não é uma estrutura à parte.
 *
 * 2. A dupla contagem fecha: 3.268.760 × 45 = 1.081.575 × 136 = 147.094.200.
 *    (1.081.575 = C(25,17) é o total de cartelas que existem.) Isso é o teste
 *    de sanidade do modelo, e está travado em teste.
 *
 * ---------------------------------------------------------------------------
 * A IDEIA CENTRAL: UMA DESCIDA, TODAS AS RESPOSTAS
 * ---------------------------------------------------------------------------
 * A poda gulosa remove, a cada passo, a cartela cuja remoção custa MENOS
 * cobertura. Como a remoção é sempre a de menor perda, a sequência de remoções
 * é ANINHADA: o melhor conjunto de 20.000 cartelas que este método produz é
 * exatamente o de 25.000 menos mais 5.000 remoções. Então não há por que rodar
 * a poda uma vez por meta. `mtzDescida` roda UMA vez, do topo até zero, e
 * grava duas coisas:
 *
 *   • `ordem` — a ordem em que as cartelas saíram;
 *   • `curva` — quantas combinações continuavam cobertas após cada remoção.
 *
 * Com isso TODAS as metas do projeto viram consulta a um vetor, instantânea:
 *   – quantidade final (§7A) → r = n − K, cobertura = curva[r];
 *   – percentual de redução (§7B) → idem, com K derivado do percentual;
 *   – cobertura mínima (§7C) → maior r com curva[r] ≥ limite;
 *   – modo 100% (§10) → maior r com curva[r] = curva[0] (a última remoção que
 *     ainda não custou nada). É o mesmo passe: o ponto onde a curva começa a
 *     cair É a menor matriz irredundante que o método alcança.
 *   – curva de equilíbrio (§8) → a própria `curva`, amostrada.
 *
 * ---------------------------------------------------------------------------
 * POR QUE A PODA É EXATA (e não "mais ou menos gulosa")
 * ---------------------------------------------------------------------------
 * "Perda ao remover a cartela c" = quantas das 136 combinações de c são
 * cobertas SÓ por ela (coverCount == 1). Recalcular isso para todas as
 * cartelas a cada remoção seria O(n × 136) por passo — inviável.
 *
 * A saída é uma propriedade do problema: REMOVER UMA CARTELA NUNCA DIMINUI A
 * PERDA DE OUTRA. Remover baixa contadores; um contador que cai de 2 para 1
 * torna alguém exclusivo, nunca o contrário. Como as perdas só CRESCEM, um
 * valor antigo é sempre um LIMITE INFERIOR do valor atual — e aí vale o
 * "guloso preguiçoso" (lazy greedy): guarda-se tudo num heap de mínimo com os
 * valores antigos; ao tirar o topo, recalcula-se só ELE. Se o valor recalculado
 * bate com o guardado, ele é o mínimo global de verdade (todos os outros têm
 * valor real ≥ valor guardado ≥ este). Se subiu, devolve ao heap e tenta o
 * próximo. O resultado é idêntico ao do guloso ingênuo, com uma fração do custo.
 *
 * ---------------------------------------------------------------------------
 * As funções aqui são puras sobre tipos numéricos e não tocam o DOM.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* §1 — Constantes do problema                                                 */
/* -------------------------------------------------------------------------- */

const MTZ_UNIVERSO = 25;         // dezenas disponíveis
const MTZ_SORTEIO = 15;          // dezenas sorteadas
const MTZ_CARTELA = 17;          // dezenas por cartela
const MTZ_TOTAL_COMB = 3268760;  // C(25,15)
const MTZ_COMB_POR_CARTELA = 136;// C(17,2) = C(17,15)
const MTZ_REDUNDANCIA_MAX = 45;  // C(10,2) — teto de cartelas cobrindo a mesma combinação
const MTZ_CARTELAS_POSSIVEIS = 1081575; // C(25,17)

/* -------------------------------------------------------------------------- */
/* §2 — Combinatória: rank de uma combinação de 15                             */
/* -------------------------------------------------------------------------- */

/** Tabela de binomiais até 25 — o motor consulta isto milhões de vezes. */
const MTZ_BINOM = (() => {
  const B = [];
  for (let n = 0; n <= MTZ_UNIVERSO; n++) {
    B[n] = new Int32Array(MTZ_UNIVERSO + 2);
    B[n][0] = 1;
    for (let r = 1; r <= n; r++) B[n][r] = B[n - 1][r - 1] + B[n - 1][r];
  }
  return B;
})();

function mtzBinom(n, r) {
  if (r < 0 || n < 0 || r > n) return 0;
  return MTZ_BINOM[n][r];
}

/** Rank de uma combinação no sistema numérico combinatorial — bijeção entre as
 *  C(25,15) combinações e [0, 3.268.760). É o endereço da combinação nos
 *  vetores de cobertura. */
function mtzRankCombinacao(ordenada) {
  let rank = 0;
  for (let i = 0; i < ordenada.length; i++) rank += mtzBinom(ordenada[i], i + 1);
  return rank;
}

/* Buffers de rascunho reaproveitados: com 50.000 cartelas, alocar três vetores
 * por cartela colocaria 150.000 objetos na fila do coletor de lixo à toa. */
const _mtzP0 = new Int32Array(MTZ_CARTELA + 1);
const _mtzP1 = new Int32Array(MTZ_CARTELA + 1);
const _mtzP2 = new Int32Array(MTZ_CARTELA + 1);

/** Escreve em `out[offset…]` os 136 ranks cobertos pela cartela `a` (17 valores
 *  0..24, ORDENADOS). Devolve a posição seguinte.
 *
 *  O jeito óbvio — montar cada subconjunto de 15 e rankear — custa 136 × 15
 *  somas por cartela. Aqui sai em O(1) por combinação, e a razão é a estrutura
 *  do rank: ao remover as posições i<j da cartela, quem está antes de i mantém
 *  seu índice, quem está entre i e j desloca 1, e quem está depois de j
 *  desloca 2. Como o rank é uma soma de C(valor, índice), basta ter a soma
 *  acumulada em cada um dos três deslocamentos — daí P0, P1 e P2. Fica ~13×
 *  mais rápido, o que importa quando são 6,8 milhões de combinações. */
function mtzCombosDaCartela(a, out, offset) {
  for (let k = 0; k < MTZ_CARTELA; k++) {
    _mtzP0[k + 1] = _mtzP0[k] + mtzBinom(a[k], k + 1);
    _mtzP1[k + 1] = _mtzP1[k] + mtzBinom(a[k], k);
    _mtzP2[k + 1] = _mtzP2[k] + (k >= 1 ? mtzBinom(a[k], k - 1) : 0);
  }
  const cauda = _mtzP2[MTZ_CARTELA];
  let p = offset;
  for (let i = 0; i < MTZ_CARTELA - 1; i++) {
    const cabeca = _mtzP0[i];
    const meioBase = _mtzP1[i + 1];
    for (let j = i + 1; j < MTZ_CARTELA; j++) {
      out[p++] = cabeca + (_mtzP1[j] - meioBase) + (cauda - _mtzP2[j + 1]);
    }
  }
  return p;
}

/** Máscara de 25 bits → vetor ordenado de dezenas (0-based). */
function mtzMascaraParaArray(mask, out) {
  let n = 0;
  for (let b = 0; b < MTZ_UNIVERSO; b++) if (mask & (1 << b)) out[n++] = b;
  return n;
}

/** Vetor de dezenas (0-based) → máscara de 25 bits. */
function mtzArrayParaMascara(arr) {
  let m = 0;
  for (let i = 0; i < arr.length; i++) m |= (1 << arr[i]);
  return m;
}

/* -------------------------------------------------------------------------- */
/* §3 — Aleatoriedade determinística                                           */
/* -------------------------------------------------------------------------- */

/** mulberry32 — mesma semente, mesma matriz. Sem isso um resultado bom não
 *  seria reproduzível, e comparar duas execuções não faria sentido. */
function mtzRng(seed) {
  let a = (seed >>> 0) || 1;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Gera `quantas` cartelas de 17 dezenas DISTINTAS, como máscaras de 25 bits. */
function mtzGerarCartelas(quantas, seed) {
  const rng = mtzRng(seed);
  const vistas = new Set();
  const out = new Int32Array(quantas);
  const pool = new Int32Array(MTZ_UNIVERSO);
  let escritas = 0;
  let tentativas = 0;
  const limite = quantas * 200 + 10000;   // trava de segurança contra pedido impossível
  while (escritas < quantas && tentativas < limite) {
    tentativas++;
    for (let i = 0; i < MTZ_UNIVERSO; i++) pool[i] = i;
    // Fisher-Yates parcial: só os 17 primeiros importam.
    for (let i = 0; i < MTZ_CARTELA; i++) {
      const j = i + Math.floor(rng() * (MTZ_UNIVERSO - i));
      const t = pool[i]; pool[i] = pool[j]; pool[j] = t;
    }
    let mask = 0;
    for (let i = 0; i < MTZ_CARTELA; i++) mask |= (1 << pool[i]);
    if (vistas.has(mask)) continue;
    vistas.add(mask);
    out[escritas++] = mask;
  }
  return escritas === quantas ? out : out.subarray(0, escritas);
}

/* -------------------------------------------------------------------------- */
/* §4 — A matriz: índice direto + contador de redundância                      */
/* -------------------------------------------------------------------------- */

/** Monta a matriz de trabalho. Assíncrona e fatiada porque isto roda na thread
 *  da interface: 50.000 cartelas são 6,8 milhões de escritas, e sem ceder o
 *  event loop a tela congelaria durante o preparo.
 *
 *  Estruturas:
 *   • `combos`  — índice direto, 136 ranks por cartela (Int32Array achatado);
 *   • `cover`   — quantas cartelas ATIVAS cobrem cada combinação (Uint8Array,
 *                 teto 45). É o índice de redundância do §6;
 *   • `ativo`   — a cartela está na solução atual? */
async function mtzMontarMatriz(masks, opts) {
  const { onProgress = null } = opts || {};
  const n = masks.length;
  const combos = new Int32Array(n * MTZ_COMB_POR_CARTELA);
  const buf = new Int32Array(MTZ_CARTELA);

  for (let c = 0; c < n; c++) {
    mtzMascaraParaArray(masks[c], buf);
    mtzCombosDaCartela(buf, combos, c * MTZ_COMB_POR_CARTELA);
    if ((c & 8191) === 8191) {
      if (onProgress) onProgress({ fase: 'indice', feito: c + 1, total: n });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  const cover = new Uint8Array(MTZ_TOTAL_COMB);
  let cobertas = 0;
  for (let i = 0; i < combos.length; i++) {
    if (cover[combos[i]]++ === 0) cobertas++;
  }

  const ativo = new Uint8Array(n);
  ativo.fill(1);
  if (onProgress) onProgress({ fase: 'indice', feito: n, total: n });

  return { masks, combos, cover, ativo, n, ativas: n, cobertas };
}

/** Perda exata de cobertura se a cartela `c` for removida agora: quantas das
 *  suas 136 combinações são cobertas SÓ por ela. É a resposta à pergunta
 *  central do §3 — "se eu retirar esta cartela, quanto a cobertura global será
 *  prejudicada?". */
function mtzPerdaSeRemover(M, c) {
  const base = c * MTZ_COMB_POR_CARTELA;
  const cover = M.cover, combos = M.combos;
  let perda = 0;
  for (let k = 0; k < MTZ_COMB_POR_CARTELA; k++) {
    if (cover[combos[base + k]] === 1) perda++;
  }
  return perda;
}

/** Ganho exato de cobertura se a cartela inativa `c` for adicionada agora:
 *  quantas das suas 136 combinações estão hoje descobertas. */
function mtzGanhoSeAdicionar(M, c) {
  const base = c * MTZ_COMB_POR_CARTELA;
  const cover = M.cover, combos = M.combos;
  let ganho = 0;
  for (let k = 0; k < MTZ_COMB_POR_CARTELA; k++) {
    if (cover[combos[base + k]] === 0) ganho++;
  }
  return ganho;
}

/** Remove a cartela e atualiza o contador de redundância. Devolve a perda. */
function mtzRemover(M, c) {
  if (!M.ativo[c]) return 0;
  const base = c * MTZ_COMB_POR_CARTELA;
  const cover = M.cover, combos = M.combos;
  let perda = 0;
  for (let k = 0; k < MTZ_COMB_POR_CARTELA; k++) {
    if (--cover[combos[base + k]] === 0) perda++;
  }
  M.ativo[c] = 0; M.ativas--; M.cobertas -= perda;
  return perda;
}

/** Recoloca a cartela. Inverso exato de `mtzRemover` — é o que torna seguro
 *  testar uma troca na busca local e desfazê-la se não compensar. */
function mtzAdicionar(M, c) {
  if (M.ativo[c]) return 0;
  const base = c * MTZ_COMB_POR_CARTELA;
  const cover = M.cover, combos = M.combos;
  let ganho = 0;
  for (let k = 0; k < MTZ_COMB_POR_CARTELA; k++) {
    if (cover[combos[base + k]]++ === 0) ganho++;
  }
  M.ativo[c] = 1; M.ativas++; M.cobertas += ganho;
  return ganho;
}

/** Estatísticas de uma cartela — o ranking do §3, cartela a cartela. */
function mtzEstatisticasCartela(M, c) {
  const base = c * MTZ_COMB_POR_CARTELA;
  const cover = M.cover, combos = M.combos;
  let exclusivas = 0, raras = 0, redundantes = 0, descobertas = 0;
  for (let k = 0; k < MTZ_COMB_POR_CARTELA; k++) {
    const n = cover[combos[base + k]];
    if (n === 0) descobertas++;
    else if (n === 1) exclusivas++;
    else if (n === 2) raras++;
    else redundantes++;
  }
  return {
    cartela: c,
    total: MTZ_COMB_POR_CARTELA,
    exclusivas,      // só esta cartela cobre — perde-se ao removê-la
    raras,           // esta e mais uma
    redundantes,     // três ou mais cartelas cobrem
    descobertas,     // (só para cartela inativa) ganharia ao entrar
    perdaSeRemover: M.ativo[c] ? exclusivas : 0,
  };
}

/** Histograma do índice de redundância (§6): quantas combinações são cobertas
 *  por 0, 1, 2, … cartelas. Um passe sobre 3,27 M posições. */
function mtzHistogramaRedundancia(M) {
  const h = new Int32Array(MTZ_REDUNDANCIA_MAX + 1);
  const cover = M.cover;
  for (let i = 0; i < MTZ_TOTAL_COMB; i++) h[cover[i]]++;
  return h;
}

/* -------------------------------------------------------------------------- */
/* §5 — Heap de mínimo (chave = perda, valor = cartela)                        */
/* -------------------------------------------------------------------------- */

/** Heap binário sobre arrays tipados — sem alocar objeto por elemento, que é o
 *  que mataria o desempenho com dezenas de milhares de cartelas. */
class MtzMinHeap {
  constructor(cap) {
    this.chave = new Int32Array(cap);
    this.valor = new Int32Array(cap);
    this.tam = 0;
    this.topoChave = 0;
    this.topoValor = 0;
  }
  push(chave, valor) {
    let i = this.tam++;
    this.chave[i] = chave; this.valor[i] = valor;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (this.chave[p] <= this.chave[i]) break;
      const ck = this.chave[p], cv = this.valor[p];
      this.chave[p] = this.chave[i]; this.valor[p] = this.valor[i];
      this.chave[i] = ck; this.valor[i] = cv;
      i = p;
    }
  }
  /** Remove o mínimo e o expõe em `topoChave`/`topoValor`. */
  pop() {
    this.topoChave = this.chave[0];
    this.topoValor = this.valor[0];
    const ultimo = --this.tam;
    this.chave[0] = this.chave[ultimo];
    this.valor[0] = this.valor[ultimo];
    let i = 0;
    for (;;) {
      const e = 2 * i + 1, d = e + 1;
      let m = i;
      if (e < this.tam && this.chave[e] < this.chave[m]) m = e;
      if (d < this.tam && this.chave[d] < this.chave[m]) m = d;
      if (m === i) break;
      const ck = this.chave[m], cv = this.valor[m];
      this.chave[m] = this.chave[i]; this.valor[m] = this.valor[i];
      this.chave[i] = ck; this.valor[i] = cv;
      i = m;
    }
  }
}

/* -------------------------------------------------------------------------- */
/* §6 — A descida: uma passada que responde todas as metas                     */
/* -------------------------------------------------------------------------- */

/** Poda gulosa preguiçosa do topo até zero cartelas.
 *
 *  A cada passo remove a cartela de MENOR perda — exatamente, não por
 *  amostragem (ver a explicação do lazy greedy no cabeçalho). Grava a ordem de
 *  remoção e a cobertura resultante de cada passo.
 *
 *  `embaralhar` só muda o desempate entre cartelas de perda igual — é o que dá
 *  variedade entre reinícios aleatórios (§12.4) sem tornar a busca burra.
 *
 *  Devolve { ordem, curva }, com curva[r] = combinações cobertas após r
 *  remoções (curva[0] = cobertura da matriz cheia). */
async function mtzDescida(M, opts) {
  const { seed = 1, embaralhar = false, onProgress = null, shouldStop = null } = opts || {};
  const n = M.n;
  const ordem = new Int32Array(n);
  const curva = new Int32Array(n + 1);
  curva[0] = M.cobertas;

  const indices = new Int32Array(n);
  for (let i = 0; i < n; i++) indices[i] = i;
  if (embaralhar) {
    const rng = mtzRng(seed);
    for (let i = n - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      const t = indices[i]; indices[i] = indices[j]; indices[j] = t;
    }
  }

  const heap = new MtzMinHeap(n + 1);
  for (let k = 0; k < n; k++) {
    const c = indices[k];
    if (M.ativo[c]) heap.push(mtzPerdaSeRemover(M, c), c);
  }

  let removidas = 0;
  let desde = 0;
  while (heap.tam > 0) {
    heap.pop();
    const guardada = heap.topoChave;
    const c = heap.topoValor;
    if (!M.ativo[c]) continue;

    // Reavaliação preguiçosa: só o topo é recalculado. Se subiu, o valor
    // guardado era um limite inferior desatualizado — devolve e tenta outro.
    const real = mtzPerdaSeRemover(M, c);
    if (real > guardada) { heap.push(real, c); continue; }

    mtzRemover(M, c);
    ordem[removidas] = c;
    removidas++;
    curva[removidas] = M.cobertas;

    if (++desde >= 2000) {
      desde = 0;
      if (onProgress) onProgress({ fase: 'descida', removidas, restantes: M.ativas, cobertas: M.cobertas });
      await new Promise((r) => setTimeout(r, 0));
      if (shouldStop && shouldStop()) break;
    }
  }

  if (onProgress) onProgress({ fase: 'descida', removidas, restantes: M.ativas, cobertas: M.cobertas });
  return { ordem, curva, removidas };
}

/** Repõe a matriz no estado cheio (todas ativas). */
function mtzResetar(M) {
  M.cover.fill(0);
  const combos = M.combos, cover = M.cover;
  let cobertas = 0;
  for (let i = 0; i < combos.length; i++) {
    if (cover[combos[i]]++ === 0) cobertas++;
  }
  M.ativo.fill(1);
  M.ativas = M.n;
  M.cobertas = cobertas;
}

/** Coloca a matriz no estado "após r remoções" da descida gravada. Como a
 *  descida é aninhada, isto reconstrói qualquer ponto da curva sem repodar. */
function mtzAplicarPrefixo(M, ordem, r) {
  mtzResetar(M);
  for (let i = 0; i < r; i++) mtzRemover(M, ordem[i]);
}

/* -------------------------------------------------------------------------- */
/* §7 — Leitura da curva: cada meta vira uma consulta                          */
/* -------------------------------------------------------------------------- */

/** Maior número de remoções que ainda não custou NADA — o modo 100% (§10).
 *  É o ponto em que a curva começa a cair. */
function mtzRemocoesSemPerda(curva) {
  const cheio = curva[0];
  let r = 0;
  while (r + 1 < curva.length && curva[r + 1] === cheio) r++;
  return r;
}

/** Maior número de remoções mantendo pelo menos `minCobertas` combinações.
 *  A curva é não-crescente, então uma busca binária resolve. */
function mtzRemocoesParaCobertura(curva, minCobertas) {
  let lo = 0, hi = curva.length - 1, melhor = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (curva[mid] >= minCobertas) { melhor = mid; lo = mid + 1; }
    else hi = mid - 1;
  }
  return melhor;
}

/** Traduz a meta do usuário em "quantas remoções aplicar". */
function mtzRemocoesParaMeta(curva, n, meta) {
  const modo = meta && meta.modo;
  if (modo === 'cobertura100') return mtzRemocoesSemPerda(curva);
  if (modo === 'coberturaMinima') {
    const frac = Math.max(0, Math.min(1, Number(meta.valor) / 100));
    return mtzRemocoesParaCobertura(curva, Math.ceil(frac * MTZ_TOTAL_COMB));
  }
  if (modo === 'percentual') {
    const frac = Math.max(0, Math.min(1, Number(meta.valor) / 100));
    return Math.min(n, Math.round(n * frac));
  }
  // 'quantidade' (padrão)
  const alvo = Math.max(0, Math.min(n, Math.round(Number(meta.valor) || 0)));
  return n - alvo;
}

/** Amostra a curva para a tabela de equilíbrio (§8): cobertura a cada patamar
 *  de cartelas restantes. */
function mtzAmostrarCurva(curva, n, passos) {
  const out = [];
  const k = Math.max(2, passos || 12);
  for (let i = 0; i <= k; i++) {
    const restantes = Math.round(n - (n * i) / k);
    const r = n - restantes;
    if (r < 0 || r >= curva.length) continue;
    out.push({
      cartelas: restantes,
      cobertas: curva[r],
      cobertura: curva[r] / MTZ_TOTAL_COMB,
    });
  }
  return out;
}

/* -------------------------------------------------------------------------- */
/* §8 — Busca local: melhora a cobertura sem mudar a quantidade                */
/* -------------------------------------------------------------------------- */

/** Troca 1 por 1: tira uma cartela barata, põe uma cartela removida que cubra
 *  mais buracos. A eliminação gulosa é míope — ela decidiu cedo, quando o
 *  tabuleiro era outro —, então quase sempre sobra ganho aqui.
 *
 *  Cada troca é VERIFICADA no momento de aplicar, não pelo valor da lista: tira
 *  A de fato, mede o ganho real de B com o tabuleiro já sem A, e desfaz se não
 *  compensar. `mtzAdicionar` é o inverso exato de `mtzRemover`, então desfazer
 *  restaura o estado bit a bit — é o que permite testar sem risco.
 *
 *  Sobre a troca "tira A e B, põe C" que o projeto menciona: ela exigiria uma
 *  única cartela de 17 contendo a UNIÃO de tudo que A e B cobriam sozinhas.
 *  Como cada combinação dessas já tem 15 dezenas, duas combinações distintas
 *  quase sempre somam mais de 17 dezenas na união — e aí nenhuma cartela cabe.
 *  Não é um atalho que deixei de implementar; é um movimento que o problema
 *  praticamente proíbe. O esforço rende mais em trocas 1×1 e em reinícios. */
async function mtzBuscaLocal(M, opts) {
  const { tempoMs = 4000, candidatos = 96, onProgress = null, shouldStop = null } = opts || {};
  const t0 = Date.now();
  let trocas = 0;
  let ganhoTotal = 0;

  for (;;) {
    if (Date.now() - t0 >= tempoMs) break;
    if (shouldStop && shouldStop()) break;

    // Ativas mais baratas (menor perda) e inativas mais valiosas (maior ganho).
    const ativas = [];
    const inativas = [];
    for (let c = 0; c < M.n; c++) {
      if (M.ativo[c]) {
        const p = mtzPerdaSeRemover(M, c);
        ativas.push({ c, v: p });
      } else {
        const g = mtzGanhoSeAdicionar(M, c);
        if (g > 0) inativas.push({ c, v: g });
      }
    }
    if (!ativas.length || !inativas.length) break;
    ativas.sort((a, b) => a.v - b.v);
    inativas.sort((a, b) => b.v - a.v);
    const A = ativas.slice(0, candidatos);
    const B = inativas.slice(0, candidatos);

    let melhorouRodada = false;
    let ia = 0;
    for (let ib = 0; ib < B.length && ia < A.length; ib++) {
      if (Date.now() - t0 >= tempoMs) break;
      const cB = B[ib].c;
      if (M.ativo[cB]) continue;

      // avança até uma ativa que ainda esteja ativa e não seja a própria B
      while (ia < A.length && (!M.ativo[A[ia].c] || A[ia].c === cB)) ia++;
      if (ia >= A.length) break;
      const cA = A[ia].c;

      const perdaReal = mtzPerdaSeRemover(M, cA);
      mtzRemover(M, cA);
      const ganhoReal = mtzGanhoSeAdicionar(M, cB);
      if (ganhoReal > perdaReal) {
        mtzAdicionar(M, cB);
        trocas++;
        ganhoTotal += (ganhoReal - perdaReal);
        melhorouRodada = true;
        ia++;
      } else {
        mtzAdicionar(M, cA);   // desfaz: estado idêntico ao anterior
      }
    }

    if (onProgress) onProgress({ fase: 'busca-local', trocas, cobertas: M.cobertas, ganhoTotal });
    await new Promise((r) => setTimeout(r, 0));
    if (!melhorouRodada) break;
  }

  return { trocas, ganhoTotal, cobertas: M.cobertas, elapsedMs: Date.now() - t0 };
}

/* -------------------------------------------------------------------------- */
/* §9 — Referência aleatória (a prova de que o algoritmo serve para algo)      */
/* -------------------------------------------------------------------------- */

/** Cobertura de K cartelas escolhidas AO ACASO da matriz original. É a régua
 *  que o projeto define como prioridade absoluta: se a poda inteligente não
 *  ganhar disto com folga, ela não se justifica. Calculada num vetor próprio,
 *  sem tocar no estado da matriz. */
function mtzCoberturaAleatoria(M, k, seed) {
  const rng = mtzRng(seed);
  const idx = new Int32Array(M.n);
  for (let i = 0; i < M.n; i++) idx[i] = i;
  for (let i = M.n - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const t = idx[i]; idx[i] = idx[j]; idx[j] = t;
  }
  const cover = new Uint8Array(MTZ_TOTAL_COMB);
  const combos = M.combos;
  let cobertas = 0;
  const lim = Math.min(k, M.n);
  for (let i = 0; i < lim; i++) {
    const base = idx[i] * MTZ_COMB_POR_CARTELA;
    for (let m = 0; m < MTZ_COMB_POR_CARTELA; m++) {
      if (cover[combos[base + m]]++ === 0) cobertas++;
    }
  }
  return cobertas;
}

/* -------------------------------------------------------------------------- */
/* §10 — Validação exaustiva independente (§15)                                */
/* -------------------------------------------------------------------------- */

/** Percorre as 3.268.760 combinações e confere a cobertura da solução atual.
 *
 *  De propósito NÃO usa `M.combos` nem `M.cover`: reconstrói tudo a partir das
 *  máscaras das cartelas ativas. Se o índice direto ou o contador incremental
 *  tiverem qualquer defeito, os dois números divergem e `confere` sai false —
 *  que é o ponto de ter uma validação. Conferir o cache contra ele mesmo não
 *  validaria nada. */
async function mtzValidarExaustivo(M, opts) {
  const { onProgress = null } = opts || {};
  const verificador = new Uint8Array(MTZ_TOTAL_COMB);
  const buf = new Int32Array(MTZ_CARTELA);
  const combosBuf = new Int32Array(MTZ_COMB_POR_CARTELA);
  let ativas = 0;

  for (let c = 0; c < M.n; c++) {
    if (!M.ativo[c]) continue;
    ativas++;
    mtzMascaraParaArray(M.masks[c], buf);
    mtzCombosDaCartela(buf, combosBuf, 0);
    for (let k = 0; k < MTZ_COMB_POR_CARTELA; k++) verificador[combosBuf[k]] = 1;
    if ((ativas & 8191) === 8191) {
      if (onProgress) onProgress({ fase: 'validacao', feito: ativas });
      await new Promise((r) => setTimeout(r, 0));
    }
  }

  let cobertas = 0;
  for (let i = 0; i < MTZ_TOTAL_COMB; i++) cobertas += verificador[i];

  return {
    total: MTZ_TOTAL_COMB,
    cobertas,
    descobertas: MTZ_TOTAL_COMB - cobertas,
    cobertura: cobertas / MTZ_TOTAL_COMB,
    cartelas: ativas,
    confere: cobertas === M.cobertas && ativas === M.ativas,
    incremental: M.cobertas,
  };
}

/* -------------------------------------------------------------------------- */
/* §11 — Orquestração                                                          */
/* -------------------------------------------------------------------------- */

/** Otimiza a matriz até a meta pedida.
 *
 *  1. descida gulosa (uma passada, com reinícios embaralhados se pedido);
 *  2. escolhe da curva o ponto que atende a meta;
 *  3. busca local no ponto escolhido;
 *  4. mede a referência aleatória para comparação.
 *
 *  Entre reinícios, guarda a descida que dá a MELHOR cobertura na meta pedida
 *  — reinício só vale a pena se for julgado pelo critério final. */
async function mtzOtimizar(M, opts) {
  const {
    meta = { modo: 'quantidade', valor: 0 },
    reinicios = 1,
    tempoBuscaMs = 4000,
    seed = 1,
    onProgress = null,
    shouldStop = null,
  } = opts || {};

  const coberturaInicial = M.cobertas;
  const cartelasIniciais = M.n;
  let melhor = null;

  for (let t = 0; t < Math.max(1, reinicios); t++) {
    if (shouldStop && shouldStop()) break;
    mtzResetar(M);
    const desc = await mtzDescida(M, {
      seed: seed + t * 7919,
      embaralhar: t > 0,          // 1ª tentativa determinística; as demais variam o desempate
      onProgress, shouldStop,
    });
    const r = mtzRemocoesParaMeta(desc.curva, M.n, meta);
    const cobertasNaMeta = desc.curva[Math.min(r, desc.curva.length - 1)];
    const cartelasNaMeta = M.n - r;
    // Melhor = mais cobertura; empate resolve pelo conjunto menor.
    const ganhou = !melhor ||
      cobertasNaMeta > melhor.cobertasNaMeta ||
      (cobertasNaMeta === melhor.cobertasNaMeta && cartelasNaMeta < melhor.cartelasNaMeta);
    if (ganhou) melhor = { ordem: desc.ordem, curva: desc.curva, r, cobertasNaMeta, cartelasNaMeta };
    if (onProgress) onProgress({ fase: 'reinicio', tentativa: t + 1, de: Math.max(1, reinicios), cobertasNaMeta, cartelasNaMeta });
  }

  mtzAplicarPrefixo(M, melhor.ordem, melhor.r);
  const antesBusca = M.cobertas;

  /* A meta pedida era alcançável? Pedir "manter 95% de cobertura" a uma matriz
   * que só tem 88% não é erro de ninguém, mas o resultado sai sem remoção
   * alguma — e sem esta bandeira a tela mostraria "0% de redução" sem explicar
   * por quê, que é o pior tipo de silêncio. */
  let metaViavel = true;
  let metaObservacao = '';
  if (meta.modo === 'coberturaMinima') {
    const alvo = Math.ceil(Math.max(0, Math.min(1, Number(meta.valor) / 100)) * MTZ_TOTAL_COMB);
    if (coberturaInicial < alvo) {
      metaViavel = false;
      metaObservacao = `A matriz cheia cobre ${(100 * coberturaInicial / MTZ_TOTAL_COMB).toFixed(3)}%, abaixo dos ${Number(meta.valor)}% pedidos — não há o que remover sem furar o piso. Baixe a meta ou acrescente cartelas.`;
    }
  } else if (meta.modo === 'cobertura100' && melhor.r === 0) {
    metaViavel = false;
    metaObservacao = 'Nenhuma cartela é dispensável: toda cartela desta matriz tem pelo menos uma combinação que só ela cobre. É o esperado numa matriz esparsa.';
  }

  const busca = tempoBuscaMs > 0
    ? await mtzBuscaLocal(M, { tempoMs: tempoBuscaMs, onProgress, shouldStop })
    : { trocas: 0, ganhoTotal: 0, cobertas: M.cobertas };

  const aleatoria = mtzCoberturaAleatoria(M, M.ativas, seed + 104729);

  return {
    cartelasIniciais,
    coberturaInicial,
    cartelasFinais: M.ativas,
    coberturaFinal: M.cobertas,
    coberturaAntesBusca: antesBusca,
    curva: melhor.curva,
    ordem: melhor.ordem,
    remocoes: melhor.r,
    busca,
    referenciaAleatoria: aleatoria,
    remocoesSemPerda: mtzRemocoesSemPerda(melhor.curva),
    meta,
    metaViavel,
    metaObservacao,
  };
}

/** Máscaras das cartelas ativas, como listas de dezenas 1..25 (para exportar). */
function mtzExportarAtivas(M) {
  const out = [];
  const buf = new Int32Array(MTZ_CARTELA);
  for (let c = 0; c < M.n; c++) {
    if (!M.ativo[c]) continue;
    mtzMascaraParaArray(M.masks[c], buf);
    const linha = new Array(MTZ_CARTELA);
    for (let i = 0; i < MTZ_CARTELA; i++) linha[i] = buf[i] + 1;
    out.push(linha);
  }
  return out;
}

/** Lê cartelas de texto: uma por linha, 17 dezenas de 1 a 25 separadas por
 *  qualquer não-dígito. Devolve { masks, erros } — linhas inválidas são
 *  relatadas com o número da linha em vez de aceitas em silêncio. */
function mtzImportarTexto(texto) {
  const masks = [];
  const erros = [];
  const vistas = new Set();
  const linhas = String(texto || '').split(/\r?\n/);
  for (let i = 0; i < linhas.length; i++) {
    const bruto = linhas[i].trim();
    if (!bruto) continue;
    const nums = bruto.split(/[^0-9]+/).filter(Boolean).map(Number);
    if (nums.length !== MTZ_CARTELA) {
      erros.push(`linha ${i + 1}: ${nums.length} dezenas (esperado ${MTZ_CARTELA})`);
      continue;
    }
    const unicas = new Set(nums);
    if (unicas.size !== MTZ_CARTELA) { erros.push(`linha ${i + 1}: dezenas repetidas`); continue; }
    let fora = false;
    for (const v of nums) if (!(v >= 1 && v <= MTZ_UNIVERSO)) fora = true;
    if (fora) { erros.push(`linha ${i + 1}: dezena fora de 1..${MTZ_UNIVERSO}`); continue; }
    const mask = mtzArrayParaMascara(nums.map((v) => v - 1));
    if (vistas.has(mask)) { erros.push(`linha ${i + 1}: cartela repetida`); continue; }
    vistas.add(mask);
    masks.push(mask);
  }
  return { masks: Int32Array.from(masks), erros };
}
