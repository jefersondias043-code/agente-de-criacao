// Composição tipográfica dos cartazes — o miolo calculável.
//
// O ajuste de corpo depende de layout real (linhas desenhadas) e por isso é
// verificado no navegador. Aqui travamos a parte pura, que é onde mora a
// qualidade da quebra: a distribuição equilibrada das palavras e a curva do
// controle único de presença.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let T;
beforeAll(() => {
  clearStorage();
  T = loadModules(['catalogs.js', 'core.js', 'poster-typeset.js'], [
    'tsBalance', 'tsPresence', 'TS_DEFAULT_FIT', 'TS_MIN_RATIO', 'TS_LINHAS_MAX',
  ]);
});

/** Medidor de mentira: cada caractere vale 10px, espaço vale 10px.
 *  Deixa as contas previsíveis sem depender de fonte. */
const medir = (s) => s.length * 10;

describe('controle único de presença', () => {
  it('vai de uma fração mínima até o tamanho cheio que cabe', () => {
    expect(T.tsPresence(0)).toBeCloseTo(T.TS_MIN_RATIO, 5);
    expect(T.tsPresence(100)).toBeCloseTo(1, 5);
  });

  it('cresce sem saltos — o oposto da tabela por faixa de caractere', () => {
    let ant = -Infinity;
    for (let v = 0; v <= 100; v += 5) {
      const p = T.tsPresence(v);
      expect(p).toBeGreaterThan(ant);
      ant = p;
    }
  });

  it('nunca ultrapassa o tamanho que cabe (o teto é o que foi medido)', () => {
    for (const v of [-50, 0, 50, 100, 150, NaN, undefined, null, 'x']) {
      const p = T.tsPresence(v);
      expect(p).toBeGreaterThanOrEqual(T.TS_MIN_RATIO);
      expect(p).toBeLessThanOrEqual(1);
    }
  });

  it('sem preferência salva, usa o padrão', () => {
    expect(T.tsPresence(undefined)).toBeCloseTo(T.tsPresence(T.TS_DEFAULT_FIT), 5);
  });
});

describe('quebra equilibrada', () => {
  it('distribui as palavras em exatamente o número de linhas pedido', () => {
    const palavras = 'um dois tres quatro cinco seis sete oito'.split(' ');
    const linhas = T.tsBalance(palavras, 3, medir, 300);
    expect(linhas).toHaveLength(3);
    expect(linhas.join(' ')).toBe(palavras.join(' '));   // não perde nem troca palavra
  });

  it('evita a última linha órfã — o defeito clássico', () => {
    // Sem equilíbrio, o navegador encheria as primeiras linhas e sobraria
    // "solitaria" sozinha na última.
    const palavras = 'Prefeitura anuncia obras de mobilidade urbana solitaria'.split(' ');
    const linhas = T.tsBalance(palavras, 3, medir, 260);
    expect(linhas).toHaveLength(3);
    const larguras = linhas.map(medir);
    const menor = Math.min(...larguras), maior = Math.max(...larguras);
    // nenhuma linha com menos de 40% da mais larga
    expect(menor / maior).toBeGreaterThan(0.4);
  });

  it('respeita a largura disponível em todas as linhas', () => {
    const palavras = 'governo estadual anuncia investimento historico regional'.split(' ');
    const largura = 240;
    const linhas = T.tsBalance(palavras, 3, medir, largura);
    expect(linhas).not.toBeNull();
    linhas.forEach((l) => expect(medir(l)).toBeLessThanOrEqual(largura));
  });

  it('desiste (null) quando uma palavra não cabe na largura', () => {
    expect(T.tsBalance(['palavraenorme', 'a', 'b'], 2, medir, 40)).toBeNull();
  });

  it('desiste quando há menos palavras que linhas', () => {
    expect(T.tsBalance(['a', 'b'], 3, medir, 500)).toBeNull();
    expect(T.tsBalance(['a'], 1, medir, 500)).toBeNull();
  });

  it('acha a divisão de MENOR desequilíbrio, não a gulosa', () => {
    // Guloso encheria a 1ª linha e deixaria a 2ª curta; o equilibrado divide.
    const palavras = ['aaaa', 'bbbb', 'cccc', 'dd'];
    const linhas = T.tsBalance(palavras, 2, medir, 100);
    expect(linhas).toEqual(['aaaa bbbb', 'cccc dd']);
  });
});

describe('teto de linhas por campo', () => {
  it('manchete e subtítulo têm limites próprios e sóbrios', () => {
    // O `-webkit-line-clamp` dos modelos chega a 6-7 (limite de segurança).
    // O alvo estético precisa ser bem menor, senão um título curto vira um
    // bloco de 6 linhas gigantes.
    expect(T.TS_LINHAS_MAX.headline).toBeLessThanOrEqual(3);
    expect(T.TS_LINHAS_MAX.subtitle).toBeLessThanOrEqual(4);
    expect(T.TS_LINHAS_MAX.subtitle).toBeGreaterThanOrEqual(T.TS_LINHAS_MAX.headline);
  });
});
