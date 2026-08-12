// CAUSOS — tamanho de vídeo curto e controle de repetição
//
// Relato: "as histórias estão ficando excessivamente longas e repetitivas… a
// ferramenta desenvolve uma ideia, mas continua prolongando mesmo depois de já
// ter transmitido aquilo que precisava." O destino é TikTok, Shorts e Reels, e
// o alvo é 1 a 1min30 de narração.
//
// AS DUAS COISAS SÃO CONTÁVEIS, e é por isso que viraram conferência em vez de
// só pedido no prompt:
//
//   duração    palavras ÷ 2,6 por segundo — a mesma conta que o Julgador usa
//              para dizer em que segundo o vídeo perde a pessoa;
//   repetição  duas frases que dizem a mesma coisa, por continência de 0,7 —
//              o mesmo limiar que o Julgador achou por medição.
//
// E O PEDIDO ERA EXPLÍCITO SOBRE O COMO: "não quero que a ferramenta
// simplesmente corte a história de maneira artificial". Por isso nada aqui
// trunca nada: a conta MEDE e reprova, quem reescreve é o reescritor — e o
// prompt dele diz, com todas as letras, que o fim fica e o que sai é a gordura
// do meio.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let C;
beforeAll(() => {
  clearStorage();
  C = loadModules(
    ['catalogs.js', 'core.js', 'llm.js', 'poster-templates.js', 'agents.js',
      'dialogos-motor.js', 'causos-motor.js'],
    ['causoDuracao', 'causoRepeticao', 'causoSegundos', 'conferirCausoLocal', 'julgarCauso',
      'buildContarPrompt', 'buildReescreverCausoPrompt',
      'dialogoDuracao', 'dialogoFalado', 'conferirDialogoLocal',
      'buildDialogoContarPrompt', 'buildDialogoReescreverPrompt',
      'CAUSO_SEG_ALVO_MIN', 'CAUSO_SEG_ALVO_MAX', 'CAUSO_SEG_TETO', 'CAUSO_SEG_PISO',
      'CAUSO_PALAVRAS_POR_SEGUNDO']);
});

const comPalavras = (n) => Array.from({ length: n }, (_, i) => `palavra${i % 40}`).join(' ') + '.';

describe('duração — o formato é vídeo curto', () => {
  it('a janela é de 1 a 1min30', () => {
    expect(C.CAUSO_SEG_ALVO_MIN).toBe(60);
    expect(C.CAUSO_SEG_ALVO_MAX).toBe(90);
  });

  it('história no alvo passa limpa', () => {
    // 1min15 ≈ 195 palavras a 2,6 por segundo.
    const r = C.causoDuracao(comPalavras(195));
    expect(r.segundos).toBeGreaterThanOrEqual(C.CAUSO_SEG_ALVO_MIN);
    expect(r.segundos).toBeLessThanOrEqual(C.CAUSO_SEG_ALVO_MAX);
    expect(r.problemas).toEqual([]);
  });

  it('história comprida reprova, dizendo quanto passou', () => {
    const r = C.causoDuracao(comPalavras(600));
    expect(r.problemas.length).toBe(1);
    expect(r.problemas[0]).toMatch(/3min5?\ds|além do formato/);
    expect(r.problemas[0]).toMatch(/Não corte o fim/);
  });

  it('há folga entre o alvo e a reprovação', () => {
    /* Entre 1min30 e 1min45 a história está no espírito do formato. Reprovar por
     * dez segundos empurraria a mesa para o corte seco — que é justamente o que
     * o pedido manda evitar. */
    expect(C.CAUSO_SEG_TETO).toBeGreaterThan(C.CAUSO_SEG_ALVO_MAX);
    const quaseNoTeto = comPalavras(Math.round(100 * C.CAUSO_PALAVRAS_POR_SEGUNDO));
    expect(C.causoDuracao(quaseNoTeto).problemas).toEqual([]);
  });

  it('história curta demais também reprova — falta acontecimento, não palavra', () => {
    const r = C.causoDuracao(comPalavras(40));
    expect(r.problemas.length).toBe(1);
    expect(r.problemas[0]).toMatch(/não dá para armar a mentira/);
  });

  it('texto vazio não inventa reprovação', () => {
    expect(C.causoDuracao('').problemas).toEqual([]);
    expect(C.causoDuracao('   ').segundos).toBe(0);
  });
});

describe('repetição — o coração do pedido', () => {
  it('acusa a informação que volta com outras palavras', () => {
    const texto = 'O peixe que ele fisgou naquele dia entortou o motor da canoa inteira. '
      + 'Depois disso ele foi para casa. '
      + 'O motor da canoa inteira entortou por causa daquele peixe que ele fisgou.';
    const r = C.causoRepeticao(texto);
    expect(r.achados.length).toBe(1);
    expect(r.problemas[0]).toMatch(/repete o que já foi dito/);
  });

  it('NÃO acusa duas frases sobre o mesmo assunto que dizem coisas diferentes', () => {
    // Falso positivo aqui destruiria a história: causo fala do mesmo assunto o
    // tempo todo. O que se pega é a informação repetida, não o tema repetido.
    const texto = 'O peixe entortou o motor da canoa. '
      + 'O vizinho apareceu no dia seguinte com uma máquina fotográfica emprestada.';
    expect(C.causoRepeticao(texto).achados).toEqual([]);
  });

  it('e nem quando METADE do conteúdo se repete — 0,7 não é 0,5', () => {
    /* O par acima não prova nada sobre o limiar: as duas frases não têm uma
     * palavra em comum, então passariam até com a continência em 0,2. Este par
     * mede 0,50 (medido: "canoa","velha" comuns, menor conjunto de 4) e é o
     * caso que existe em causo de verdade — o objeto volta à cena carregando
     * informação nova. Afrouxar o limiar para 0,5 acusaria isto, e a mesa
     * começaria a mandar cortar frase que faz a história andar.
     * UM AVISO FALSO É PIOR QUE AVISO NENHUM. */
    const texto = 'A canoa velha afundou no meio do rio. '
      + 'O rio naquele ano estava mais fundo que a canoa velha inteira.';
    expect(C.causoRepeticao(texto).achados).toEqual([]);
  });

  it('frase curta não entra na conta', () => {
    /* "Fisgou peixe grande." está INTEIRA dentro da frase longa — continência
     * 1,00, medida. Sem a exigência de quatro palavras de conteúdo, toda frase
     * curta de remate viraria acusação de repetição, e o texto perderia
     * justamente as frases de três palavras que dão o fôlego da oralidade. */
    const texto = 'O peixe grande que ele fisgou naquela tarde entortou o motor inteiro da canoa velha. '
      + 'Fisgou peixe grande.';
    expect(C.causoRepeticao(texto).achados).toEqual([]);
  });

  it('marca uma vez por frase, não uma por par', () => {
    const f = 'O peixe grande entortou o motor da canoa velha. ';
    expect(C.causoRepeticao(f + f + f).achados.length).toBe(2);
  });
});

describe('as duas contas entram no juízo pela dimensão do ritmo', () => {
  it('a DURAÇÃO sozinha já vira achado de ritmo', () => {
    /* Este teste existe porque o outro não bastava: com um texto que estoura o
     * teto E se repete quarenta vezes, a repetição sozinha já enche a dimensão
     * de achados, e desligar a duração passava despercebido (mutação
     * sobrevivente). Aqui o texto é comprido e NÃO se repete — medido: 480
     * palavras, 3min05, zero achados de repetição —, então o único achado de
     * ritmo que pode existir é o da duração. */
    const frases = [];
    for (let i = 0; i < 30; i++) {
      frases.push(`No episodio numero${i} apareceu um bicho diferente${i} carregando ferramenta estranha${i} pela estrada empoeirada${i} daquele povoado distante${i}.`);
    }
    const local = C.conferirCausoLocal(frases.join(' '), {}, {});
    expect(local.repeticao.achados).toEqual([]);
    expect(local.duracao.segundos).toBeGreaterThan(C.CAUSO_SEG_TETO);

    const ritmo = local.achados.filter((a) => a.dimensao === 'ritmo');
    expect(ritmo.length).toBe(1);
    expect(ritmo[0].texto).toMatch(/para ser contada/);
  });

  it('história comprida e repetitiva vira achado de ritmo', () => {
    // 40 repetições ≈ 440 palavras ≈ 2min49 — passa do teto E repete. Com 12
    // dava 51s e só a repetição disparava; o teste falhava por metade do motivo.
    const repetida = 'O peixe grande entortou o motor da canoa velha naquele dia. '.repeat(40);
    const local = C.conferirCausoLocal(repetida, {}, {});
    const ritmo = local.achados.filter((a) => a.dimensao === 'ritmo');
    expect(ritmo.length).toBeGreaterThan(1);
    expect(local.duracao.segundos).toBeGreaterThan(C.CAUSO_SEG_TETO);
    expect(local.repeticao.achados.length).toBeGreaterThan(0);
  });
});

describe('o tamanho é construído, não cortado', () => {
  it('o prompt de contar pede a história JÁ nesse tamanho', () => {
    const p = C.buildContarPrompt({ genero: 'pescador' }, {});
    expect(p).toMatch(/1 minuto e 1min30/);
    expect(p).toMatch(/NÃO escreva uma história longa e corte no fim/);
    expect(p).toMatch(/Construa já nesse tamanho/);
  });

  it('e diz em palavras, que é o que a IA consegue mirar', () => {
    const p = C.buildContarPrompt({ genero: 'pescador' }, {});
    expect(p).toMatch(/156 a 234 palavras/);
  });

  it('cobra função de cada frase e proíbe reforçar o que já foi dito', () => {
    const p = C.buildContarPrompt({ genero: 'pescador' }, {});
    expect(p).toMatch(/CADA FRASE TEM DE FAZER A HISTÓRIA ANDAR/);
    expect(p).toMatch(/NÃO REPITA O QUE JÁ DISSE/);
    expect(p).toMatch(/TERMINE QUANDO ACABOU/);
  });

  it('o reescritor sabe que encurtar NÃO é truncar', () => {
    // Sem esta linha, "a história está longa demais" vira cortar o fim — e a
    // história perde justamente o pagamento.
    const p = C.buildReescreverCausoPrompt('texto', [{ dimensao: 'ritmo', ordem: 'encurte' }], {});
    expect(p).toMatch(/não corte o fim nem resuma a história/i);
    expect(p).toMatch(/O fim fica; o que sai é a gordura do meio/);
  });
});

/* ---------------------------------------------------------------------------
 * MODO 2 — DIÁLOGOS NATURAIS
 *
 * O pedido falava de "histórias", que é o modo 1. Isto aqui é uma extensão
 * deliberada, e a razão é a razão dada pelo próprio pedido: "o objetivo
 * principal é criar conteúdo para plataformas de vídeos curtos". O modo 2
 * entrega no mesmo lugar e só media TURNO — quantos, de que tamanho, quem
 * monopoliza —, nunca quanto tempo a conversa leva.
 * -------------------------------------------------------------------------*/
describe('a conversa também cabe no formato', () => {
  const turno = (i) => `Maria: Eu falei com o rapaz da oficina sobre aquele barulho na roda dianteira numero${i} ontem de tarde.\n`
    + `Joao: E ele disse o que sobre a peca numero${i} que voce mandou trocar na semana retrasada?\n`;
  const longa = Array.from({ length: 12 }, (_, i) => turno(i)).join('');

  it('só conta o que sai da boca — a etiqueta NOME: não é falada', () => {
    /* Uma palavra por turno parece pouco; em 24 turnos são 24 palavras, uns
     * nove segundos de conversa que não existem. Numa janela de 90 segundos
     * isso é 10% do orçamento vindo de texto que ninguém diz. */
    const falado = C.dialogoFalado(longa);
    expect(falado).not.toMatch(/Maria:/);
    expect(falado).toContain('barulho na roda dianteira');
    expect(C.dialogoDuracao(longa).palavras).toBeLessThan(C.causoDuracao(longa).palavras);
  });

  it('conversa comprida demais vira achado — e a régua é a mesma do outro modo', () => {
    const d = C.dialogoDuracao(longa);
    expect(d.segundos).toBeGreaterThan(C.CAUSO_SEG_TETO);
    expect(d.problemas.length).toBe(1);
    expect(d.problemas[0]).toMatch(/Não corte o fim/);

    const local = C.conferirDialogoLocal(longa, {}, {});
    expect(local.achados.some((a) => a.dimensao === 'dinamica' && /para ser dita em voz alta/.test(a.texto))).toBe(true);
  });

  it('conversa dentro da janela passa limpa', () => {
    const curta = Array.from({ length: 4 }, (_, i) => turno(i)).join('');
    expect(C.dialogoDuracao(curta).segundos).toBeLessThanOrEqual(C.CAUSO_SEG_TETO);
    expect(C.dialogoDuracao(curta).problemas).toEqual([]);
  });

  it('conversa curta não é reprovada duas vezes pelo mesmo defeito', () => {
    // O piso já existe aqui com outro nome: o mínimo de turnos. Duas contas
    // reclamando da mesma conversa curta dariam dois avisos para um defeito só.
    expect(C.dialogoDuracao('Maria: Oi.\nJoao: Oi.').problemas).toEqual([]);
  });

  it('o prompt da conversa diz o tempo, não só o número de turnos', () => {
    const p = C.buildDialogoContarPrompt({ genero: 'amigos', personagens: [] }, {});
    expect(p).toMatch(/1 minuto e 1min30/);
    expect(p).toMatch(/156 a 234 palavras faladas/);
    expect(p).toMatch(/CADA FALA TEM DE FAZER A CONVERSA ANDAR/);
    expect(p).toMatch(/NÃO DÊ VOLTAS NO MESMO PONTO/);
  });

  it('e o reescritor da conversa também sabe que encurtar não é truncar', () => {
    const p = C.buildDialogoReescreverPrompt('Maria: oi', [{ dimensao: 'dinamica', ordem: 'encurte' }], {});
    expect(p).toMatch(/não corte o fim nem resuma a conversa/i);
    expect(p).toMatch(/O fim fica; o que sai é o meio que patina/);
  });
});

/* ---------------------------------------------------------------------------
 * O QUE CHEGA AO REESCRITOR
 *
 * Achado numa medição de ponta a ponta, não pensando: uma conversa comprida E
 * de ritmo chapado só recebia a ordem do ritmo, porque as duas caíam na mesma
 * dimensão e o juiz guardava um problema por dimensão. No modo 1 é pior: a
 * história comprida e repetitiva mandava encurtar e NUNCA mandava tirar a
 * repetição — que é o ponto principal do pedido.
 * -------------------------------------------------------------------------*/
describe('uma dimensão com dois defeitos manda corrigir os dois', () => {
  const juizoDe = (achados) => C.julgarCauso(
    [{ critico: 'oralidade', notas: [{ dimensao: 'ritmo', nota: 9 }] }], achados);

  it('tamanho E repetição saem juntos na mesma ordem', () => {
    const j = juizoDe([
      { dimensao: 'ritmo', texto: 'a história leva 3min para ser contada' },
      { dimensao: 'ritmo', texto: 'esta parte repete o que já foi dito' },
    ]);
    const ordem = j.ordens.find((o) => o.dimensao === 'ritmo');
    expect(ordem.ordem).toMatch(/para ser contada/);
    expect(ordem.ordem).toMatch(/repete o que já foi dito/);
  });

  it('mas não despeja trinta linhas em cima do reescritor', () => {
    const muitos = Array.from({ length: 30 }, (_, i) => ({ dimensao: 'ritmo', texto: `repetição numero ${i}` }));
    const ordem = juizoDe(muitos).ordens.find((o) => o.dimensao === 'ritmo');
    expect(ordem.ordem.split('TAMBÉM:').length - 1).toBe(2);   // 3 exemplos
    expect(ordem.ordem).toMatch(/e mais 27 trechos com o mesmo defeito/);
  });

  it('problema repetido não conta duas vezes', () => {
    const igual = [
      { dimensao: 'ritmo', texto: 'o mesmo problema' },
      { dimensao: 'ritmo', texto: 'o mesmo problema' },
    ];
    const ordem = juizoDe(igual).ordens.find((o) => o.dimensao === 'ritmo');
    expect(ordem.ordem).toBe('o mesmo problema');
  });

  it('a NOTA continua sendo uma só, e continua sendo a pior', () => {
    // O painel "Como a mesa avaliou" é o que está funcionando bem; juntar
    // problemas não pode virar juntar notas.
    const j = juizoDe([
      { dimensao: 'ritmo', texto: 'defeito um' },
      { dimensao: 'ritmo', texto: 'defeito dois' },
    ]);
    const avaliadas = j.avaliadas.filter((a) => a.dimensao === 'ritmo');
    expect(avaliadas.length).toBe(1);
    expect(avaliadas[0].nota).toBe(5);
    expect(avaliadas[0].problema).toBe('defeito um');   // o painel mostra o pior, como antes
  });
});
