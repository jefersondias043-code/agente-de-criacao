// TRANSCRIÇÃO — organizar o texto que sai de um arquivo
//
// O Whisper devolve fala corrida: sem pontuação, sem quebra de fala, número em
// algarismo, nome próprio em minúscula. Esta etapa dá forma a isso.
//
// A LINHA QUE ELA NÃO PODE CRUZAR: organizar não é reescrever. Uma fala
// inventada seria julgada pelo Julgador como se estivesse no vídeo, e viraria
// matéria-prima de história nos Causos. Em ambos o estrago é invisível — o
// texto fica ótimo e está errado.
//
// A IA recebe a instrução; o código confere o que dá para conferir. Fatia que
// não passa é descartada, e fica o texto cru: feio, mas verdadeiro.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let T;
beforeAll(() => {
  clearStorage();
  T = loadModules(
    ['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js', 'transcricao.js'],
    ['TRANSC_MAX_CHARS', 'transcricaoVale', 'transcricaoFatiar', 'transcricaoSemPreambulo',
      'conferirTranscricao', 'buildTranscricaoPrompt', 'runLimpezaTranscricao']);
});

/* O caso que motivou esta etapa: transcrição de um causo do relógio, como o
 * Whisper entrega — fala corrida, sem travessão, número em algarismo. */
const CRU = `Vizinho, me compra esse relógio na minha mão que eu tô precisando. E quanto é esse relógio? Deixa eu ver aí. Vizinho, eu tô vendendo por 50 reais, porque eu tô precisando. Tá precisando, né? Vamos fazer o seguinte, nem eu nem você, eu vou lhe dar 20 conto nele. Fechado. Pronto, daqui a 30 dias eu te pago. Ainda, vizinho? Negócio fechado, já fechou já era. Fechado. Pronto. Opa! Ô, seu sabido, tudo bom? Bom. Relógio? É para vender Vale mais de mil reais esse relógio aqui Mas eu lhe vendo barato Peraí, rapaz, coisa bonita mesmo É bonito e é banhada a ouro Sim, Zé, mil reais, mas o relógio é usado Faço por menos, Zé Você vai me pagar a vista quanto? Fala essa sua proposta Ele paga a vista, mas o dinheiro que eu tenho aqui é duzentos reais Negócio fechado, me dê cá`;

/* O mesmo texto organizado do jeito certo: travessão, pontuação, nome próprio,
 * número por extenso, concordância. Nenhuma palavra nova de conteúdo. */
const ORGANIZADO = `— Vizinho, me compra esse relógio que tá na minha mão? Eu tô precisando.

— E quanto é esse relógio? Deixa eu ver aí.

— Vizinho, eu tô vendendo por cinquenta reais, porque eu tô precisando.

— Tá precisando, né? Vamos fazer o seguinte: nem eu nem você. Eu vou lhe dar vinte conto nele.

— Fechado.

— Pronto. Daqui a trinta dias eu te pago.

— Ainda, vizinho?

— Negócio fechado. Já fechou, já era.

— Fechado. Pronto.

— Opa! Ô, Seu Sabido, tudo bom?

— Bom. Relógio?

— É para vender. Vale mais de mil reais esse relógio aqui, mas eu lhe vendo barato.

— Peraí, rapaz! Coisa bonita mesmo.

— É bonito e é banhado a ouro.

— Sim, Zé, mil reais, mas o relógio é usado.

— Faço por menos, Zé. Você vai me pagar à vista quanto? Fala essa sua proposta.

— Ele paga à vista, mas o dinheiro que eu tenho aqui é duzentos reais.

— Negócio fechado, me dê cá.`;

const dublar = (resposta) => {
  const prompts = [];
  const call = async (p) => {
    prompts.push(p);
    const r = typeof resposta === 'function' ? resposta(p, prompts.length) : resposta;
    if (r instanceof Error) throw r;
    return { content: r, model: 'dublado' };
  };
  call.prompts = prompts;
  return call;
};

describe('a distinção que governa o trabalho', () => {
  it('o prompt manda organizar e proíbe reescrever, com todas as letras', () => {
    const p = T.buildTranscricaoPrompt(CRU, {});
    expect(p).toMatch(/ORGANIZAR é dar forma ao que já está no texto/);
    expect(p).toMatch(/REESCREVER é mexer no CONTEÚDO/);
    expect(p).toMatch(/NÃO acrescente nenhuma fala que não esteja no texto/);
    expect(p, 'narração inventada é o acréscimo mais tentador').toMatch(/NÃO acrescente narração/);
  });

  it('manda fazer tudo que o exemplo do usuário faz', () => {
    const p = T.buildTranscricaoPrompt(CRU, {});
    expect(p, 'travessão por fala').toMatch(/travessão/);
    expect(p, 'número por extenso').toMatch(/50 reais → cinquenta reais/);
    expect(p, 'nome próprio').toMatch(/seu sabido → Seu Sabido/);
    expect(p, 'concordância').toMatch(/banhada a ouro → banhado a ouro/);
    expect(p, 'parágrafos').toMatch(/Parágrafos|parágrafos/);
  });

  it('protege o jeito de falar — gíria não é erro', () => {
    // Trocar "tô" por "estou" descaracterizaria a fala, que é justamente o que
    // as duas ferramentas precisam preservar.
    const p = T.buildTranscricaoPrompt(CRU, {});
    expect(p).toMatch(/"Tô", "pra", "cê"/);
    expect(p).toMatch(/Gíria e regionalismo são o texto, não erro/);
  });

  it('avisa a fatia de que ela é um pedaço, para não inventar ponta', () => {
    const p = T.buildTranscricaoPrompt('trecho', { parte: 2, total: 5 });
    expect(p).toMatch(/trecho 2 de 5/);
    expect(p).toMatch(/não tente "completar" a ponta/);
    expect(T.buildTranscricaoPrompt('t', { parte: 1, total: 1 }), 'texto único não é fatia').not.toMatch(/trecho 1 de 1/);
  });
});

describe('a conferência do código', () => {
  it('aprova a organização de verdade — a do exemplo', () => {
    const c = T.conferirTranscricao(CRU, ORGANIZADO);
    expect(c.problemas).toEqual([]);
    expect(c.ok).toBe(true);
  });

  it('número por extenso NÃO conta como invenção', () => {
    // "50" vira "cinquenta": mesma quantidade, outra grafia. Sem esta regra a
    // conferência acusaria justamente o que ela deve permitir.
    //
    // O texto precisa ser longo o bastante para a checagem de invenção RODAR —
    // ela exige dez palavras de conteúdo. A primeira versão deste teste usava
    // uma frase de nove, e passava com a lista de extensos apagada: não media
    // nada.
    const cru = 'Custou 50 reais e levou 30 dias e 200 pratas e mil coisas mais '
      + 'porque o comprador queria pagar apenas 40 moedas pelo relógio antigo '
      + 'enquanto o vendedor pedia 500 cruzados pela corrente dourada usada '
      + 'depois de 15 semanas e 80 tentativas e 12 propostas recusadas';
    const limpo = 'Custou cinquenta reais e levou trinta dias e duzentos pratas e mil coisas mais '
      + 'porque o comprador queria pagar apenas quarenta moedas pelo relógio antigo '
      + 'enquanto o vendedor pedia quinhentos cruzados pela corrente dourada usada '
      + 'depois de quinze semanas e oitenta tentativas e doze propostas recusadas';
    // A trava: sem ela o teste voltaria a passar por não exercitar a regra.
    expect(new Set(limpo.toLowerCase().split(/[^a-zà-ÿ0-9]+/)
      .filter((w) => w.length >= 4)).size, 'texto curto demais para acionar a checagem')
      .toBeGreaterThanOrEqual(10);
    expect(T.conferirTranscricao(cru, limpo).problemas).toEqual([]);
  });

  it('pega o resumo disfarçado de organização', () => {
    const c = T.conferirTranscricao(CRU, '— O vizinho vendeu um relógio barato para o Zé.');
    expect(c.ok).toBe(false);
    expect(c.problemas.join(' ')).toMatch(/encolheu/);
  });

  it('pega a resposta cortada pelo teto de saída', () => {
    // Metade do texto sumindo em silêncio é o pior estrago possível aqui.
    const c = T.conferirTranscricao(CRU, ORGANIZADO.slice(0, 200));
    expect(c.ok).toBe(false);
  });

  it('pega o trecho alucinado mesmo quando ele cabe no tamanho', () => {
    // O acréscimo é montado para NÃO disparar a conta de tamanho: o texto
    // continua dentro do crescimento tolerado, e nenhuma palavra do original
    // sumiu. Só a checagem de vocabulário novo pode pegá-lo — que é justamente
    // o que este teste precisa exercitar. A primeira versão acrescentava tanto
    // texto que a conta de tamanho pegava antes, e passava com a checagem de
    // invenção desligada.
    const inventado = ORGANIZADO
      + '\n\n— Naquele instante a delegacia federal apreendeu documentos falsificados durante '
      + 'fiscalização tributária municipal, segundo relatório assinado pela perita judicial '
      + 'responsável pelo inquérito administrativo aberto contra a joalheria clandestina.';
    const c = T.conferirTranscricao(CRU, inventado);
    expect(c.problemas.join(' '), 'a conta de tamanho não pode ser quem pega')
      .not.toMatch(/cresceu|encolheu/);
    expect(c.problemas.join(' ')).toMatch(/não existiam no original/);
    expect(c.ok).toBe(false);
  });

  it('pega quando o texto foi apagado', () => {
    expect(T.conferirTranscricao(CRU, '   ').ok).toBe(false);
  });

  it('pega o conteúdo que evaporou sem o texto encolher', () => {
    // O modelo trocar um trecho por enrolação do mesmo tamanho é perda que a
    // conta de tamanho não vê: só a retenção de palavras pega. Por isso a
    // versão "limpa" aqui é feita de palavras que JÁ existem no original — sem
    // invenção e sem encolhimento, para que nenhuma outra checagem interfira.
    const cru = 'O comprador ofereceu moedas antigas pela corrente dourada enquanto '
      + 'o vendedor recusava propostas menores durante semanas seguidas naquela '
      + 'feira barulhenta cheia de gente curiosa observando cada palavra dita';
    const perdido = 'O comprador ofereceu moedas antigas pela corrente dourada enquanto '
      + 'o comprador ofereceu moedas antigas pela corrente dourada enquanto '
      + 'o comprador ofereceu moedas antigas pela corrente dourada enquanto';
    const c = T.conferirTranscricao(cru, perdido);
    expect(c.problemas.join(' '), 'nenhuma outra conta pode ser quem pega')
      .not.toMatch(/cresceu|encolheu|não existiam/);
    expect(c.problemas.join(' ')).toMatch(/palavras do original sumiram/);
    expect(c.ok).toBe(false);
  });

  it('não é rigorosa a ponto de reprovar pontuação e travessão', () => {
    const c = T.conferirTranscricao(
      'ele chegou cansado e ninguem falou nada aquele dia foi longo demais para todo mundo',
      '— Ele chegou cansado, e ninguém falou nada.\n\n— Aquele dia foi longo demais para todo mundo.');
    expect(c.ok).toBe(true);
  });
});

describe('o preâmbulo de assistente', () => {
  it('some — senão entraria no roteiro como se fosse fala', () => {
    ['Aqui está o texto organizado:\n— Bom dia.', 'Segue o texto corrigido:\n— Bom dia.',
      'Texto corrigido:\n— Bom dia.'].forEach((t) => {
      const r = T.transcricaoSemPreambulo(t);
      expect(r.texto, t).toBe('— Bom dia.');
      expect(r.tinhaPreambulo).toBe(true);
    });
  });

  it('tira também a cerca de código', () => {
    expect(T.transcricaoSemPreambulo('```\n— Bom dia.\n```').texto).toBe('— Bom dia.');
  });

  it('não come um texto que começa parecido', () => {
    // "Aqui está o dinheiro" é fala, não preâmbulo.
    expect(T.transcricaoSemPreambulo('— Aqui está o dinheiro que eu te devia.').texto)
      .toBe('— Aqui está o dinheiro que eu te devia.');
  });
});

describe('as fatias', () => {
  it('texto curto vai inteiro', () => {
    expect(T.transcricaoFatiar('uma frase só.')).toEqual(['uma frase só.']);
  });

  it('corta em fim de frase, não no meio', () => {
    const texto = Array.from({ length: 40 }, (_, i) => `Esta é a frase número ${i} e ela tem um tamanho razoável.`).join(' ');
    const fatias = T.transcricaoFatiar(texto, 300);
    expect(fatias.length).toBeGreaterThan(1);
    fatias.forEach((f) => expect(f.length).toBeLessThanOrEqual(300));
    fatias.slice(0, -1).forEach((f) => expect(f.trim(), 'cortou no meio da frase').toMatch(/[.!?…]$/));
    expect(fatias.join(' ').replace(/\s+/g, ' ')).toBe(texto.replace(/\s+/g, ' '));
  });

  it('transcrição SEM pontuação nenhuma também é fatiada', () => {
    // É o caso comum: o Whisper devolve um parágrafo só, sem um ponto sequer.
    const texto = Array.from({ length: 200 }, (_, i) => `palavra${i}`).join(' ');
    const fatias = T.transcricaoFatiar(texto, 200);
    expect(fatias.length).toBeGreaterThan(1);
    fatias.forEach((f) => expect(f.length).toBeLessThanOrEqual(200));
    expect(fatias.join(' ')).toBe(texto);
  });

  it('nenhuma palavra se perde no corte', () => {
    const fatias = T.transcricaoFatiar(CRU, 250);
    expect(fatias.join(' ').split(/\s+/).length).toBe(CRU.split(/\s+/).length);
  });
});

describe('a etapa de ponta a ponta', () => {
  it('organiza e entrega o texto novo', async () => {
    const call = dublar(ORGANIZADO);
    const r = await T.runLimpezaTranscricao({ texto: CRU, call });
    expect(r.limpou).toBe(true);
    expect(r.texto).toBe(ORGANIZADO);
    expect(r.descartes).toEqual([]);
  });

  it('a fatia que não passa na conferência é DESCARTADA — fica o texto cru', async () => {
    // A regra que sustenta a etapa: entre um texto feio e um texto inventado,
    // fica o feio.
    const call = dublar('— O vizinho vendeu um relógio.');
    const r = await T.runLimpezaTranscricao({ texto: CRU, call });
    expect(r.limpou).toBe(false);
    expect(r.texto, 'o texto original tem de sobreviver inteiro').toBe(CRU);
    expect(r.descartes.length).toBe(1);
    expect(r.motivo).toMatch(/encolheu/);
  });

  it('uma fatia ruim não estraga as boas', async () => {
    const texto = Array.from({ length: 60 }, (_, i) => `Esta é a frase número ${i} e ela tem um tamanho bem razoável para o teste.`).join(' ');
    // A segunda fatia volta resumida; as outras voltam íntegras.
    const call = dublar((p, n) => (n === 2 ? 'resumo.' : (p.split('== O TRECHO ==\n')[1] || '').split('\n\nDevolva')[0]));
    const r = await T.runLimpezaTranscricao({ texto, call, maxChars: 400 });
    expect(r.partes).toBeGreaterThan(2);
    expect(r.organizadas).toBe(r.partes - 1);
    expect(r.descartes.length).toBe(1);
    expect(r.texto, 'o trecho cru da fatia ruim tem de estar lá').toMatch(/frase número/);
  });

  it('erro de chamada não custa o anexo', async () => {
    const call = dublar(new Error('a rede caiu'));
    const r = await T.runLimpezaTranscricao({ texto: CRU, call });
    expect(r.texto).toBe(CRU);
    expect(r.limpou).toBe(false);
  });

  it('sem IA disponível, devolve o texto como veio', async () => {
    const r = await T.runLimpezaTranscricao({ texto: CRU, call: null });
    expect(r.texto).toBe(CRU);
    expect(r.limpou).toBe(false);
  });

  it('texto curto não gasta chamada nenhuma', async () => {
    const call = dublar('qualquer coisa');
    const r = await T.runLimpezaTranscricao({ texto: 'Bom dia, tudo bem?', call });
    expect(call.prompts.length).toBe(0);
    expect(r.texto).toBe('Bom dia, tudo bem?');
  });

  it('avisa o progresso quando são várias fatias', async () => {
    const texto = Array.from({ length: 60 }, (_, i) => `Esta é a frase número ${i} e ela tem um tamanho bem razoável para o teste.`).join(' ');
    const avisos = [];
    await T.runLimpezaTranscricao({
      texto, maxChars: 400, onProgress: (m) => avisos.push(m),
      call: dublar((p) => (p.split('== O TRECHO ==\n')[1] || '').split('\n\nDevolva')[0]),
    });
    expect(avisos.length).toBeGreaterThan(1);
    expect(avisos[0]).toMatch(/Organizando o texto… 1 de \d+/);
  });
});
