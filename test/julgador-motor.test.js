// JULGADOR — a banca que lê antes de publicar
//
// A ferramenta não responde "isso vai viralizar?". Responde "dá para publicar,
// onde está fraco, e o que eu conserto primeiro". Estes testes existem para
// travar essa diferença: qualquer volta à promessa de previsão quebra a suíte.
//
// O desenho é o mesmo do Causos, com uma diferença: aqui NINGUÉM escreve. Os
// avaliadores só julgam. E, como lá:
//
//   • cada avaliador é uma chamada independente e cega às outras;
//   • o juiz é código — recebe as notas, aplica a regra e decide;
//   • metade da conferência é MEDIDA, não julgada, e por isso produz
//     apontamento com minuto e segundo.
//
// A regra acima de todas: nota baixa não se esconde na média.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let J;
beforeAll(() => {
  clearStorage();
  J = loadModules(
    ['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js', 'narrativa-motor.js',
      'causos-motor.js', 'embalagem.js', 'julgador-motor.js'],
    ['JULG_DIMENSOES', 'JULG_EIXOS', 'JULG_AVALIADORES', 'JULG_BANCA_COMPLETA', 'JULG_BANCA_TRIAGEM',
      'JULG_VEREDITOS', 'JULG_FORMATOS', 'julgFormato', 'julgDimensao', 'julgSegundos', 'julgMomento',
      'julgTempoAteOGancho', 'julgRepeticao', 'julgExplicacaoExcessiva', 'julgCtaArtificial',
      'julgFrasesDeIA', 'julgPromessaCumprida', 'julgProgressao', 'julgTerminaAbrupto',
      'julgSpoilerNaEmbalagem', 'conferirJulgamentoLocal',
      'julgarConteudo', 'compararJulgamentos', 'normalizarAvaliacao',
      'buildAvaliadorPrompt', 'runJulgamentoPipeline', 'runTriagemPipeline']);
});

/* Um vídeo que começa pelo acontecimento, progride e não se repete. */
const BOM = `O Zé Macambira chegou em casa sem a carteira e sem o carro.
A mulher perguntou onde estava o carro.
Ele disse que tinha emprestado pro cunhado por dez minutos, três semanas atrás.
O cunhado mudou de cidade no dia seguinte.
Levou o carro, a carteira que estava no porta-luvas e o cachorro da família.
O Zé só descobriu quando o seguro ligou perguntando por que o veículo estava em Goiás.`;

/* Outro vídeo limpo, para os testes que precisam de dois conteúdos distintos
 * sem que a conferência de código ache nada em nenhum dos dois. */
const OUTRO = `A Dona Ana descobriu o buraco no muro numa terça de manhã.
O vizinho jurava que não tinha sido o cachorro dele.
Três dias depois apareceu um bezerro dentro da sala.`;

/* O mesmo assunto, estragado: quinze segundos de garganta limpando, a mesma
 * informação três vezes e pedido de comentário no fim. */
const RUIM = `Oi gente, tudo bem com vocês? Aqui é o canal de novo.
Sejam bem-vindos a mais um vídeo.
Hoje eu vou falar sobre uma coisa que aconteceu comigo.
Antes de começar, se inscreve no canal e deixa o like.
Então, o que aconteceu foi que eu perdi a carteira no mercado.
Ou seja, eu perdi a carteira lá no mercado da esquina.
Quer dizer, a carteira sumiu no mercado.
Isto é, eu não achei a carteira.
Comenta aqui embaixo se já aconteceu com você.`;

/** Uma avaliação como um avaliador a devolveria. */
const av = (avaliador, notas) => ({ avaliador, notas, resumo: '' });

/** IA dublada: responde a cada prompt de avaliador com as notas pedidas. */
const dublar = (porAvaliador, opcoes) => {
  const o = opcoes || {};
  const prompts = [];
  const call = async (prompt) => {
    prompts.push(prompt);
    // Só o prompt de avaliador traz o esquema `"notas": [{ "dimensao": ... }]`,
    // e a primeira dimensão identifica quem está sendo chamado.
    const m = /"notas": \[\{ "dimensao": "([a-z]+)"/.exec(prompt);
    const quem = Object.keys(J.JULG_AVALIADORES)
      .find((id) => J.JULG_AVALIADORES[id].dimensoes[0] === m[1]
        && new RegExp(J.JULG_AVALIADORES[id].persona.slice(0, 40).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).test(prompt));
    if (o.falha && o.falha === quem) throw new Error('avaliador caiu');
    return { content: JSON.stringify({ notas: porAvaliador[quem] || [], resumo: 'ok' }), model: 'dublado' };
  };
  call.prompts = prompts;
  return call;
};

/* Notas boas para todos os avaliadores — a base sobre a qual cada teste
 * introduz UM defeito, para que a causa da reprovação seja inequívoca. */
const TUDO_BOM = {
  impacto: [{ dimensao: 'impacto', nota: 9 }, { dimensao: 'clareza', nota: 9 }],
  retencao: [{ dimensao: 'retencao', nota: 9 }, { dimensao: 'historia', nota: 8 }],
  curiosidade: [{ dimensao: 'curiosidade', nota: 8 }],
  historia: [{ dimensao: 'historia', nota: 8 }],
  naturalidade: [{ dimensao: 'naturalidade', nota: 9 }],
  valor: [{ dimensao: 'valor', nota: 9 }],
  compartilhamento: [{ dimensao: 'compartilhamento', nota: 7 }],
  comentarios: [{ dimensao: 'comentarios', nota: 7 }],
  embalagem: [{ dimensao: 'embalagem', nota: 8 }],
  espectador: [{ dimensao: 'impacto', nota: 8 }, { dimensao: 'retencao', nota: 8 },
    { dimensao: 'valor', nota: 8 }, { dimensao: 'compartilhamento', nota: 7 }],
};

/* ========================================================================== */
describe('a ferramenta não promete adivinhar o algoritmo', () => {
  it('o veredito tem três estados, e nenhum é "vai viralizar"', () => {
    expect(Object.keys(J.JULG_VEREDITOS).sort()).toEqual(['ajustes', 'nao', 'sim']);
    const rotulos = Object.values(J.JULG_VEREDITOS).map((v) => v.label).join(' ');
    expect(rotulos).toMatch(/PUBLICARIA/);
    expect(rotulos, 'promessa de viralização de volta').not.toMatch(/viral|VIRAL|flop|FLOP/);
  });

  it('nenhum prompt pede previsão de desempenho', () => {
    const p = J.buildAvaliadorPrompt('impacto', BOM, {}, []);
    expect(p).toMatch(/não é "isso vai viralizar\?"/);
    expect(p, 'a banca não deve tentar prever alcance').not.toMatch(/chance de viraliza|prever o alcance|quantas visualiza/i);
  });

  it('a doutrina proíbe elogio genérico e nota inflada em todo avaliador', () => {
    J.JULG_BANCA_COMPLETA.forEach((id) => {
      const p = J.buildAvaliadorPrompt(id, BOM, {}, []);
      expect(p, id).toMatch(/Elogio genérico não serve/);
      expect(p, id).toMatch(/Não infle/);
      expect(p, `${id}: avaliador não reescreve`).toMatch(/VOCÊ NÃO REESCREVE NADA/);
    });
  });
});

/* ========================================================================== */
describe('a conferência que é medida, não julgada', () => {
  describe('o tempo até o gancho', () => {
    it('mede os segundos de garganta limpando antes do assunto', () => {
      const r = J.julgTempoAteOGancho(RUIM);
      expect(r.frases.length, 'parou de contar cedo demais').toBe(5);
      expect(r.segundos).toBeGreaterThan(10);
      expect(r.problemas.join(' ')).toMatch(/leva cerca de \d+ segundos/);
    });

    it('não acusa quem começa pelo acontecimento', () => {
      expect(J.julgTempoAteOGancho(BOM).problemas).toEqual([]);
      expect(J.julgTempoAteOGancho(BOM).segundos).toBe(0);
    });

    it('um anúncio que JÁ entrega o fato não é preâmbulo', () => {
      // "hoje eu vou contar" anuncia, mas o nome e o número mostram que o vídeo
      // já começou. Sem esta exceção a medição puniria uma abertura boa.
      const t = 'Hoje eu vou te contar como o Zé sumiu por três dias.\nNinguém achou ele.';
      expect(J.julgTempoAteOGancho(t).segundos).toBe(0);
    });

    it('mas saudação continua sendo saudação, mesmo com nome próprio', () => {
      // A exceção da âncora vale só para o anúncio. "Oi gente, aqui é o Léo"
      // não vira conteúdo por ter um nome dentro.
      const r = J.julgTempoAteOGancho('Oi gente, tudo bem? Aqui é o Léo do canal.\nSejam bem-vindos a mais um vídeo.\nO carro sumiu.');
      expect(r.frases.length).toBeGreaterThanOrEqual(2);
    });

    it('"mais um vídeo" é saudação, não conteúdo', () => {
      expect(J.julgTempoAteOGancho('Sejam bem-vindos a mais um vídeo.\nO carro sumiu.').frases.length).toBe(1);
    });

    it('o artigo "um" não vale como número concreto', () => {
      // A âncora existe para reconhecer quantidade ("sumiu por três dias"). O
      // "um" de "contar um caso" é artigo, e contá-lo como número resgatava do
      // preâmbulo justamente o anúncio vazio que se quer pegar.
      const r = J.julgTempoAteOGancho('Hoje eu vou contar um caso que aconteceu.\nO carro sumiu.');
      expect(r.frases.length).toBe(1);
    });
  });

  describe('a repetição de informação', () => {
    it('pega a mesma informação dita com outras palavras, e diz onde', () => {
      const r = J.julgRepeticao(RUIM);
      expect(r.achados.length).toBeGreaterThan(0);
      expect(r.achados[0].momento).toMatch(/^\d{2}:\d{2}$/);
      expect(r.problemas.join(' ')).toMatch(/a informação volta com outras palavras/);
    });

    it('mede continência, não semelhança', () => {
      // Semelhança (Jaccard) dá 0,5 neste par porque as palavras novas da
      // segunda frase diluem a repetição — e era justo o caso a pegar.
      const t = 'Eu perdi a carteira no mercado hoje.\nOu seja, eu perdi a carteira lá no mercado da esquina.';
      expect(J.julgRepeticao(t).achados.length).toBe(1);
    });

    it('não acusa um texto que avança', () => {
      expect(J.julgRepeticao(BOM).problemas).toEqual([]);
    });
  });

  it('a reexplicação vira apontamento a partir da terceira vez', () => {
    expect(J.julgExplicacaoExcessiva(RUIM).total).toBeGreaterThanOrEqual(3);
    expect(J.julgExplicacaoExcessiva(RUIM).problemas.length).toBe(1);
    expect(J.julgExplicacaoExcessiva('Ou seja, foi isso.').problemas, 'uma vez não é vício').toEqual([]);
  });

  it('o pedido de engajamento é PENALIZADO, não premiado', () => {
    const r = J.julgCtaArtificial(RUIM);
    expect(r.achadas).toContain('comenta aqui embaixo');
    expect(r.problemas.join(' ')).toMatch(/Pedir não produz reação/);
    expect(J.julgCtaArtificial(BOM).problemas).toEqual([]);
  });

  describe('a frase que entrega texto gerado', () => {
    it('reconhece o vocabulário de IA', () => {
      ['Vamos mergulhar nesse assunto.', 'É importante ressaltar que sim.',
        'Em um mundo onde tudo muda.', 'Isso não é apenas um carro.'].forEach((t) => {
        expect(J.julgFrasesDeIA(t).problemas.length, t).toBeGreaterThan(0);
      });
    });

    it('herda a lista da Narrativa quando ela está carregada', () => {
      // As duas ferramentas caçam o mesmo defeito. Manter duas listas
      // divergentes faria uma achar o que a outra deixa passar.
      expect(J.julgFrasesDeIA('E foi aí que tudo mudou para sempre.').achadas.length).toBeGreaterThan(0);
    });

    it('não acusa fala normal', () => {
      expect(J.julgFrasesDeIA(BOM).problemas).toEqual([]);
    });
  });

  describe('a promessa da embalagem', () => {
    it('acusa promessa que o vídeo não cumpre em lugar nenhum', () => {
      const r = J.julgPromessaCumprida(BOM, { titulo: 'Receita de bolo de cenoura simples' });
      expect(r.problemas.join(' ')).toMatch(/não aparece no vídeo/);
    });

    it('aprova promessa cumprida logo no começo', () => {
      expect(J.julgPromessaCumprida(BOM, { titulo: 'O cunhado sumiu com o carro' }).problemas).toEqual([]);
    });

    it('acusa promessa que só é cumprida lá no fim', () => {
      const texto = 'Um dia comum na cidade. ' + 'Nada de mais acontecia por ali. '.repeat(30)
        + 'E então o jacaré apareceu na piscina.';
      const r = J.julgPromessaCumprida(texto, { titulo: 'O jacaré na piscina' });
      expect(r.problemas.join(' ')).toMatch(/só aparece depois dos primeiros/);
    });

    it('a capa cumprida PELA IMAGEM não é acusada de promessa quebrada', () => {
      // O defeito relatado, e ele era de raiz: a conferência procurava as
      // palavras da capa dentro da TRANSCRIÇÃO. Uma capa que mostra um homem
      // com um relógio dourado na mão está cumprida por uma cena em que ele
      // aparece assim — sem ninguém dizer "relógio" em momento nenhum. Quanto
      // melhor a capa descrevia o que se VÊ, mais a ferramenta reclamava.
      const fala = 'O Zé chegou em casa sem nada no bolso e a mulher perguntou o que tinha acontecido naquela tarde toda.';
      const embalagem = { titulo: 'O relógio dourado', capa: 'homem segurando um relógio dourado na mão' };
      expect(J.julgPromessaCumprida(fala, embalagem).problemas,
        'o teste precisa partir de uma acusação real').not.toEqual([]);
      const visual = 'O Zé aparece na calçada segurando um relógio dourado na mão, mostrando para o vizinho.';
      expect(J.julgPromessaCumprida(fala, embalagem, visual).problemas).toEqual([]);
    });

    it('promessa que não está NEM na fala NEM na imagem continua sendo acusada', () => {
      // A correção não pode virar anistia: se o vídeo não entrega por canal
      // nenhum, o apontamento tem de continuar saindo.
      const fala = 'O Zé chegou em casa sem nada no bolso e a mulher perguntou o que tinha acontecido.';
      const visual = 'O Zé aparece na calçada conversando com o vizinho, os dois de costas para o rio.';
      const r = J.julgPromessaCumprida(fala, { titulo: 'Receita de bolo de cenoura simples' }, visual);
      expect(r.problemas.join(' ')).toMatch(/nem na fala nem na imagem/);
    });

    it('o que a imagem mostra conta como cumprido CEDO', () => {
      // Imagem entrega no primeiro quadro, não no minuto três — não faz sentido
      // acusar de atraso o que está na tela desde o começo.
      const fala = 'Um dia comum na cidade. ' + 'Nada de mais acontecia por ali. '.repeat(30)
        + 'E então o jacaré apareceu na piscina.';
      expect(J.julgPromessaCumprida(fala, { titulo: 'O jacaré na piscina' }).problemas.join(' '),
        'sem imagem, o atraso continua sendo apontado').toMatch(/só aparece depois/);
      expect(J.julgPromessaCumprida(fala, { titulo: 'O jacaré na piscina' },
        'Um jacaré dentro da piscina desde o primeiro quadro.').problemas).toEqual([]);
    });

    it('sem título informado, não inventa apontamento', () => {
      expect(J.julgPromessaCumprida(BOM, {}).conferido).toBe(false);
      expect(J.julgPromessaCumprida(BOM, {}).problemas).toEqual([]);
    });
  });

  it('a progressão acusa o terço final que não traz nada', () => {
    const parado = 'O carro do Zé sumiu na terça de manhã bem cedo lá na rua. '
      + 'O carro do Zé sumiu na terça. '.repeat(12);
    const r = J.julgProgressao(parado);
    expect(r.problemas.join(' ')).toMatch(/não traz nada novo/);
    expect(J.julgProgressao(BOM).problemas, 'texto que avança não é acusado').toEqual([]);
  });

  it('o travessão de fala não vira palavra fantasma na conta do tempo', () => {
    // A etapa que organiza a transcrição põe cada fala numa linha com "—".
    // Contando o travessão, um roteiro de cinquenta falas ganhava vinte segundos
    // de duração inexistente — e o erro caía sobre "o vídeo leva N segundos até
    // o assunto", que é a medição mais útil da ferramenta.
    const corrido = 'Vizinho, me compra esse relógio. E quanto é? Deixa eu ver aí. Tô vendendo por cinquenta reais. Tá precisando, né? Vou lhe dar vinte conto nele.';
    const emFalas = '— Vizinho, me compra esse relógio.\n\n— E quanto é? Deixa eu ver aí.\n\n— Tô vendendo por cinquenta reais.\n\n— Tá precisando, né?\n\n— Vou lhe dar vinte conto nele.';
    const a = J.conferirJulgamentoLocal(corrido, {});
    const b = J.conferirJulgamentoLocal(emFalas, {});
    expect((emFalas.match(/—/g) || []).length, 'o texto precisa ter travessões').toBe(5);
    expect(Math.abs(b.duracao - a.duracao), 'organizar em falas mudou a duração medida').toBeLessThan(1);
  });

  it('o momento sai em minuto e segundo — é o que torna o apontamento acionável', () => {
    expect(J.julgMomento(0)).toBe('00:00');
    expect(J.julgMomento(17)).toBe('00:17');
    expect(J.julgMomento(67)).toBe('01:07');
  });

  it('a descrição visual NÃO entra nas contas que medem a fala', () => {
    /* Só a conferência da promessa lê a imagem. As outras medem tempo,
     * repetição e naturalidade DA FALA — jogar a descrição visual nelas
     * incharia a duração com um texto que ninguém pronuncia (o mesmo erro do
     * travessão contado como palavra) e julgaria como fala gravada um texto
     * que o AUTOR escreveu. */
    const fala = 'O Zé chegou em casa sem a carteira. A mulher perguntou onde estava o carro dele.';
    const visualLongo = ('O Zé aparece na calçada segurando o chapéu enquanto o vizinho observa da janela. '.repeat(20));
    const semVisual = J.conferirJulgamentoLocal(fala, {});
    const comVisual = J.conferirJulgamentoLocal(fala, {}, visualLongo);
    expect(comVisual.duracao, 'a imagem inflou a duração medida').toBe(semVisual.duracao);
    expect(comVisual.repeticao.achados.length, 'a repetição da descrição virou defeito do vídeo')
      .toBe(semVisual.repeticao.achados.length);
    expect(comVisual.frasesDeIA.achadas, 'a descrição do autor foi julgada como fala')
      .toEqual(semVisual.frasesDeIA.achadas);
  });

  it('cada achado cai na dimensão certa', () => {
    const local = J.conferirJulgamentoLocal(RUIM, { titulo: 'Receita de bolo de cenoura' });
    const porDim = local.achados.reduce((acc, a) => {
      (acc[a.dimensao] = acc[a.dimensao] || []).push(a.texto); return acc;
    }, {});
    expect(Object.keys(porDim).sort()).toEqual(['comentarios', 'embalagem', 'impacto', 'retencao']);
  });
});

/* ========================================================================== */
describe('o juiz é código', () => {
  it('fica com a PIOR nota de cada dimensão — é o veto do Espectador', () => {
    // O especialista achou a estrutura elegante; o leigo disse que sairia. O
    // que vale é o leigo, e é para isso que ele existe na banca.
    const j = J.julgarConteudo([
      av('retencao', [{ dimensao: 'retencao', nota: 9, problema: 'estrutura elegante' }]),
      av('espectador', [{ dimensao: 'retencao', nota: 3, problema: 'eu sairia aos 12 segundos' }]),
    ], []);
    const r = j.avaliadas.find((a) => a.dimensao === 'retencao');
    expect(r.nota).toBe(3);
    expect(r.fonte).toBe('espectador');
  });

  it('nota baixa não se esconde na média', () => {
    const j = J.julgarConteudo([
      av('impacto', [{ dimensao: 'impacto', nota: 10 }, { dimensao: 'clareza', nota: 10 }]),
      av('valor', [{ dimensao: 'valor', nota: 10 }]),
      av('naturalidade', [{ dimensao: 'naturalidade', nota: 4, problema: 'parece IA' }]),
    ], []);
    expect(j.media, 'a média sozinha diria que está ótimo').toBeGreaterThan(80);
    expect(j.nota, 'a nota que vale é a pior').toBe(40);
    expect(j.veredito).toBe('nao');
  });

  it('um achado de código derruba a nota alta do avaliador', () => {
    const j = J.julgarConteudo(
      [av('impacto', [{ dimensao: 'impacto', nota: 10, problema: 'abertura excelente' }])],
      [{ dimensao: 'impacto', texto: 'o vídeo leva 15 segundos até o assunto' }]);
    const i = j.avaliadas.find((a) => a.dimensao === 'impacto');
    expect(i.nota).toBe(5);
    expect(i.fonte).toBe('conferência automática');
    expect(j.veredito).not.toBe('sim');
  });

  describe('os três estados do veredito', () => {
    const notas = (over) => Object.entries({ ...TUDO_BOM, ...over })
      .map(([quem, ns]) => av(quem, ns));

    it('sem reprovação nenhuma: PUBLICARIA', () => {
      const j = J.julgarConteudo(notas({}), []);
      expect(j.reprovadas).toEqual([]);
      expect(j.veredito).toBe('sim');
    });

    it('uma reprovação leve: PUBLICARIA APÓS AJUSTES', () => {
      const j = J.julgarConteudo(notas({ curiosidade: [{ dimensao: 'curiosidade', nota: 5, problema: 'nada em aberto' }] }), []);
      expect(j.veredito).toBe('ajustes');
    });

    it('uma reprovação grave sozinha já é NÃO PUBLICARIA', () => {
      // Três pontos abaixo do mínimo é problema estrutural, não ajuste.
      const j = J.julgarConteudo(notas({ valor: [{ dimensao: 'valor', nota: 4, problema: 'não entrega nada' }] }), []);
      expect(j.criticas.length).toBe(1);
      expect(j.veredito).toBe('nao');
    });

    it('três reprovações leves também somam NÃO PUBLICARIA', () => {
      const j = J.julgarConteudo(notas({
        curiosidade: [{ dimensao: 'curiosidade', nota: 5 }],
        comentarios: [{ dimensao: 'comentarios', nota: 4 }],
        compartilhamento: [{ dimensao: 'compartilhamento', nota: 4 }],
      }), []);
      expect(j.criticas.length).toBe(0);
      expect(j.reprovadas.length).toBe(3);
      expect(j.veredito).toBe('nao');
    });
  });

  it('cada eixo fica com a pior dimensão dele, não com a média', () => {
    const j = J.julgarConteudo([
      av('impacto', [{ dimensao: 'impacto', nota: 10 }, { dimensao: 'clareza', nota: 10 }]),
      av('retencao', [{ dimensao: 'retencao', nota: 3 }, { dimensao: 'historia', nota: 9 }]),
      av('curiosidade', [{ dimensao: 'curiosidade', nota: 9 }]),
    ], []);
    const atencao = j.eixos.find((e) => e.id === 'atencao');
    expect(atencao.nota, '10+3+9 não é um eixo bom').toBe(30);
    expect(atencao.pior).toBe('retencao');
  });

  it('os quatro eixos separam qualidade de potencial', () => {
    // Um vídeo pode ser bem produzido e pouco interessante. Misturar as duas
    // coisas numa nota só esconde exatamente essa diferença.
    expect(J.JULG_EIXOS.map((e) => e.id)).toEqual(['qualidade', 'atencao', 'reacao', 'distribuicao']);
    J.JULG_DIMENSOES.forEach((d) => {
      expect(J.JULG_EIXOS.some((e) => e.id === d.eixo), `${d.id} sem eixo`).toBe(true);
    });
  });
});

/* ========================================================================== */
describe('se eu só puder mudar uma coisa', () => {
  it('um defeito de abertura ganha de um defeito de fim MAIS GRAVE', () => {
    // Os números são escolhidos para que só a regra decida: `comentarios` está
    // 4 pontos abaixo do mínimo e `impacto` só 3. Pela nota crua, o problema de
    // reação venceria. Mas quem saiu aos três segundos nunca chegou no fim —
    // então o defeito de abertura é o mais caro, e é ele que a ferramenta manda
    // consertar primeiro.
    const j = J.julgarConteudo([
      av('impacto', [{ dimensao: 'impacto', nota: 4, problema: 'demora a começar', correcao: 'corte a introdução' }]),
      av('comentarios', [{ dimensao: 'comentarios', nota: 1, problema: 'não provoca nada', correcao: 'tome posição' }]),
    ], []);
    expect(j.principal.dimensao, 'a nota mais baixa não é o problema mais caro').toBe('impacto');
    expect(j.principal.correcao).toMatch(/corte a introdução/);
  });

  it('a embalagem pesa mais que tudo — ela age antes do play', () => {
    // Mesma armação: `naturalidade` está 5 abaixo do mínimo e `embalagem` só 4.
    // A capa vence porque age antes de existir vídeo para ser natural.
    const j = J.julgarConteudo([
      av('embalagem', [{ dimensao: 'embalagem', nota: 3, problema: 'a capa promete outra coisa' }]),
      av('naturalidade', [{ dimensao: 'naturalidade', nota: 2, problema: 'soa escrito' }]),
    ], []);
    expect(j.principal.dimensao).toBe('embalagem');
  });

  it('sem reprovação nenhuma, aponta o ponto mais baixo mesmo assim', () => {
    // Quem quer subir de 8 para 9 também precisa saber por onde.
    const j = J.julgarConteudo([
      av('impacto', [{ dimensao: 'impacto', nota: 9 }, { dimensao: 'clareza', nota: 10 }]),
      av('curiosidade', [{ dimensao: 'curiosidade', nota: 6, problema: 'quase nada em aberto' }]),
    ], []);
    expect(j.veredito).toBe('sim');
    expect(j.principal.dimensao).toBe('curiosidade');
  });

  /* A AUDITORIA ACHOU ISTO, e era o defeito mais grave da ferramenta.
   *
   * Vale sempre a PIOR avaliação de cada dimensão, e o Espectador — leigo e
   * lacônico por desenho — costuma ser o mais duro. Quando ele dava a nota
   * mais baixa SEM escrever `problema`, a dimensão inteira caía do filtro
   * `(correcao || problema)` e sumia de "o que eu mudaria". A tela exibia
   * "NÃO PUBLICARIA — 10/100" com uma lista de correções que não mencionava
   * a dimensão responsável por aquele 10. */
  describe('nenhuma dimensão reprovada some da lista', () => {
    it('a pior dimensão aparece mesmo quando quem a reprovou não escreveu nada', () => {
      const j = J.julgarConteudo([
        av('retencao', [{ dimensao: 'retencao', nota: 8, problema: 'quase bom', correcao: 'aperte o meio' }]),
        // O leigo é mais duro E não explica — é o caso real que sumia.
        av('espectador', [{ dimensao: 'retencao', nota: 1 }]),
        av('valor', [{ dimensao: 'valor', nota: 3, problema: 'não entrega' }]),
      ], []);
      expect(j.avaliadas.find((a) => a.dimensao === 'retencao').nota, 'a pior nota precisa ter vencido').toBe(1);
      const dims = j.acoes.map((a) => a.dimensao);
      expect(dims, 'a dimensão que define a nota do cabeçalho sumiu da lista').toContain('retencao');
    });

    it('sem texto de ninguém, a pergunta da dimensão vira o ponto de partida', () => {
      const j = J.julgarConteudo([av('espectador', [{ dimensao: 'retencao', nota: 1 }])], []);
      const acao = j.acoes.find((a) => a.dimensao === 'retencao');
      expect(acao.acao, 'linha muda não ajuda ninguém').toBeTruthy();
      expect(acao.acao).toBe(J.julgDimensao('retencao').pergunta);
    });

    it('mas dimensão que PASSA e não tem texto continua fora — ali a linha seria ruído', () => {
      // `comentarios` tem mínimo 5; 6 passa raspando (gravidade "medio") e
      // ninguém escreveu nada sobre ela.
      const j = J.julgarConteudo([av('comentarios', [{ dimensao: 'comentarios', nota: 6 }])], []);
      expect(j.avaliadas[0].gravidade).toBe('medio');
      expect(j.acoes.map((a) => a.dimensao)).not.toContain('comentarios');
    });
  });

  it('a lista priorizada deixa de fora o que já está bom', () => {
    const j = J.julgarConteudo([
      av('impacto', [{ dimensao: 'impacto', nota: 3, problema: 'não segura', correcao: 'comece pelo fato' }]),
      av('valor', [{ dimensao: 'valor', nota: 10, problema: '', correcao: '' }]),
      av('curiosidade', [{ dimensao: 'curiosidade', nota: 6, problema: 'pouca coisa em aberto', correcao: 'segure o desfecho' }]),
    ], []);
    const dims = j.acoes.map((a) => a.dimensao);
    expect(dims[0], 'o mais grave vem primeiro').toBe('impacto');
    expect(dims, 'nota 10 não vira tarefa').not.toContain('valor');
    expect(j.acoes.find((a) => a.dimensao === 'impacto').gravidade).toBe('critico');
    expect(j.acoes.find((a) => a.dimensao === 'curiosidade').gravidade).toBe('medio');
  });
});

/* ========================================================================== */
describe('a comparação entre versões', () => {
  const antes = () => J.julgarConteudo([
    av('impacto', [{ dimensao: 'impacto', nota: 4 }, { dimensao: 'clareza', nota: 7 }]),
    av('naturalidade', [{ dimensao: 'naturalidade', nota: 6 }]),
    av('valor', [{ dimensao: 'valor', nota: 8 }]),
  ], []);
  const depois = () => J.julgarConteudo([
    av('impacto', [{ dimensao: 'impacto', nota: 9 }, { dimensao: 'clareza', nota: 7 }]),
    av('naturalidade', [{ dimensao: 'naturalidade', nota: 8 }]),
    av('valor', [{ dimensao: 'valor', nota: 8 }]),
  ], []);

  it('diz o que subiu, o que ficou igual e quanto', () => {
    const c = J.compararJulgamentos(antes(), depois());
    expect(c.melhoraram.map((x) => x.dimensao)).toEqual(['impacto', 'naturalidade']);
    expect(c.melhoraram[0].delta).toBe(5);
    expect(c.iguais.map((x) => x.dimensao).sort()).toEqual(['clareza', 'valor']);
    expect(c.pioraram).toEqual([]);
  });

  it('mostra a mudança de veredito, que é o que o autor quer saber', () => {
    const c = J.compararJulgamentos(antes(), depois());
    expect(c.vereditoAntes).toBe('nao');
    expect(c.vereditoDepois).toBe('sim');
    expect(c.mudouVeredito).toBe(true);
    expect(c.deltaNota).toBeGreaterThan(0);
  });

  it('acusa também o que a revisão ESTRAGOU', () => {
    // Corrigir uma coisa e quebrar outra é o risco real de toda reescrita.
    const pior = J.julgarConteudo([
      av('impacto', [{ dimensao: 'impacto', nota: 9 }, { dimensao: 'clareza', nota: 3 }]),
      av('naturalidade', [{ dimensao: 'naturalidade', nota: 6 }]),
      av('valor', [{ dimensao: 'valor', nota: 8 }]),
    ], []);
    const c = J.compararJulgamentos(antes(), pior);
    expect(c.pioraram.map((x) => x.dimensao)).toEqual(['clareza']);
    expect(c.pioraram[0].delta).toBe(-4);
  });
});

/* ========================================================================== */
describe('a banca', () => {
  it('cada avaliador tem uma cabeça diferente, não o mesmo prompt com outro nome', () => {
    const ids = Object.keys(J.JULG_AVALIADORES);
    const personas = ids.map((id) => J.JULG_AVALIADORES[id].persona);
    expect(new Set(personas).size, 'dois avaliadores com a mesma persona').toBe(ids.length);
    ids.forEach((id) => {
      const a = J.JULG_AVALIADORES[id];
      expect(a.olhar.length, `${id}: pouca coisa para olhar`).toBeGreaterThanOrEqual(4);
      a.dimensoes.forEach((d) => expect(J.julgDimensao(d), `${id} → ${d}`).toBeTruthy());
    });
  });

  it('toda dimensão é olhada por alguém', () => {
    const olhadas = new Set();
    Object.values(J.JULG_AVALIADORES).forEach((a) => a.dimensoes.forEach((d) => olhadas.add(d)));
    J.JULG_DIMENSOES.forEach((d) => expect(olhadas.has(d.id), `${d.id} sem avaliador`).toBe(true));
  });

  it('o Espectador é leigo e é fixo — é a trava contra o tecnicamente perfeito e sem graça', () => {
    const e = J.JULG_AVALIADORES.espectador;
    expect(J.JULG_BANCA_COMPLETA).toContain('espectador');
    expect(e.persona).toMatch(/pessoa comum/i);
    expect(e.persona).toMatch(/não use nenhum termo técnico/i);
    // Ele pontua as dimensões que decidem se alguém fica — por isso o veto dele
    // funciona sem precisar de mecanismo nenhum: o juiz fica com a pior nota.
    expect(e.dimensoes).toContain('impacto');
    expect(e.dimensoes).toContain('retencao');
  });

  it('nenhum avaliador vê a opinião dos outros', () => {
    const p = J.buildAvaliadorPrompt('valor', BOM, {}, []);
    expect(p).toMatch(/não vê a opinião dos outros/);
    expect(p).not.toMatch(/outro avaliador disse|os outros deram/i);
  });

  it('o avaliador só pode pontuar as dimensões dele', () => {
    const r = J.normalizarAvaliacao(
      { notas: [{ dimensao: 'curiosidade', nota: 9 }, { dimensao: 'embalagem', nota: 2 }] },
      'curiosidade');
    expect(r.notas.map((n) => n.dimensao), 'opinou fora da lente dele').toEqual(['curiosidade']);
  });

  describe('as duas fontes no prompt', () => {
    it('fala e imagem entram separadas e nomeadas', () => {
      const p = J.buildAvaliadorPrompt('impacto', BOM, {}, [], 'O Zé aparece de chapéu na beira do rio.');
      expect(p).toMatch(/== O QUE SE OUVE/);
      expect(p).toMatch(/== O QUE SE VÊ/);
      expect(p).toMatch(/O Zé aparece de chapéu/);
      expect(p, 'sem isto o avaliador cobra da fala o que a imagem entregou')
        .toMatch(/Não cobre da fala o que a imagem já mostrou/);
    });

    it('sem descrição visual, avisa em vez de fingir que o vídeo é só fala', () => {
      const p = J.buildAvaliadorPrompt('impacto', BOM, {}, [], '');
      expect(p).not.toMatch(/== O QUE SE VÊ/);
      expect(p).toMatch(/não trate como ausente o que poderia estar na imagem/);
    });

    it('os avaliadores que dependem do que se vê perguntam por isso', () => {
      // Impacto e Embalagem decidem pela imagem tanto quanto pela fala; o
      // Espectador julga a experiência inteira.
      expect(J.JULG_AVALIADORES.impacto.olhar.join(' ')).toMatch(/aparece NA TELA/);
      expect(J.JULG_AVALIADORES.embalagem.olhar.join(' ')).toMatch(/cumprida PELA IMAGEM/);
      expect(J.JULG_AVALIADORES.espectador.olhar.join(' ')).toMatch(/tocasse sem som/);
    });
  });

  it('a embalagem entra no prompt como o que se vê ANTES do play', () => {
    const p = J.buildAvaliadorPrompt('embalagem', BOM, { titulo: 'O carro sumiu', capa: 'foto do carro vazio' }, []);
    expect(p).toMatch(/ANTES de dar play/);
    expect(p).toMatch(/O carro sumiu/);
    expect(p).toMatch(/foto do carro vazio/);
  });

  it('o que o código já mediu chega ao avaliador como fato, não como opinião', () => {
    const p = J.buildAvaliadorPrompt('impacto', RUIM, {}, [{ dimensao: 'impacto', texto: 'leva 15 segundos até o assunto' }]);
    expect(p).toMatch(/JÁ MEDIDO NO CÓDIGO/);
    expect(p).toMatch(/leva 15 segundos até o assunto/);
    expect(p).toMatch(/Procure o que a medição não alcança/);
  });
});

/* ========================================================================== */
describe('a banca inteira, de ponta a ponta', () => {
  it('mede, consulta os dez e entrega o veredito', async () => {
    const call = dublar(TUDO_BOM);
    const r = await J.runJulgamentoPipeline({ conteudo: BOM, embalagem: { titulo: 'O cunhado sumiu com o carro' }, call });
    expect(call.prompts.length, 'a banca completa são dez avaliadores').toBe(10);
    expect(r.etapas).toEqual(['conferencia', 'banca', 'juiz']);
    // TRAVA CONTRA MEDIÇÃO VAZIA: sem isto, uma dublagem que não reconhecesse
    // os avaliadores devolveria notas vazias, o juiz não teria o que reprovar e
    // o veredito sairia "sim" — este teste passaria sem medir nada.
    expect(r.juizo.avaliadas.length, 'alguma dimensão ficou sem nota').toBe(J.JULG_DIMENSOES.length);
    expect(r.juizo.veredito).toBe('sim');
    expect(r.local.ok).toBe(true);
  });

  it('um avaliador que cai não derruba a banca', async () => {
    const call = dublar(TUDO_BOM, { falha: 'curiosidade' });
    const r = await J.runJulgamentoPipeline({ conteudo: BOM, call });
    expect(r.avaliacoes.find((a) => a.avaliador === 'curiosidade').notas).toEqual([]);
    expect(r.juizo.avaliadas.length, 'os outros continuam valendo').toBeGreaterThan(5);
  });

  it('o conteúdo ruim é reprovado pela conta, mesmo com a banca elogiando', async () => {
    // Todos os avaliadores dão nota alta. Quem reprova é a medição — que é o
    // ponto inteiro de ela existir.
    const call = dublar(TUDO_BOM);
    const r = await J.runJulgamentoPipeline({ conteudo: RUIM, embalagem: { titulo: 'Perdi a carteira no mercado' }, call });
    const fontes = r.juizo.reprovadas.map((x) => x.fonte);
    expect(fontes, 'nenhuma reprovação veio da conta').toContain('conferência automática');
    expect(r.juizo.veredito).not.toBe('sim');
    expect(r.juizo.principal.dimensao, 'o preâmbulo é o problema mais caro aqui').toBe('impacto');
  });

  it('a descrição visual chega a todos os dez avaliadores', async () => {
    const call = dublar(TUDO_BOM);
    const r = await J.runJulgamentoPipeline({
      conteudo: BOM, visual: 'O Zé aparece de chapéu na beira do rio, segurando um remo torto.', call,
    });
    expect(call.prompts.length).toBe(10);
    expect(call.prompts.every((p) => /segurando um remo torto/.test(p)),
      'algum avaliador julgou sem ver metade do vídeo').toBe(true);
    expect(r.visual).toMatch(/remo torto/);
  });

  it('recusa conteúdo vazio em vez de avaliar o nada', async () => {
    await expect(J.runJulgamentoPipeline({ conteudo: '   ', call: dublar(TUDO_BOM) }))
      .rejects.toThrow(/conteúdo/i);
  });
});

/* ========================================================================== */
describe('o modo Seleção', () => {
  it('tria com banca reduzida — dez chamadas por vídeo num acervo é caro e inútil', async () => {
    expect(J.JULG_BANCA_TRIAGEM.length).toBeLessThan(J.JULG_BANCA_COMPLETA.length);
    expect(J.JULG_BANCA_TRIAGEM, 'o leigo não pode ficar de fora da triagem').toContain('espectador');
    const call = dublar(TUDO_BOM);
    await J.runTriagemPipeline({ itens: [{ nome: 'a', conteudo: BOM }], call });
    expect(call.prompts.length).toBe(J.JULG_BANCA_TRIAGEM.length);
  });

  it('a conferência de código continua inteira na triagem — ela é de graça', async () => {
    const call = dublar(TUDO_BOM);
    const r = await J.runTriagemPipeline({ itens: [{ nome: 'ruim', conteudo: RUIM }], call });
    expect(r.fila[0].local.achados.length).toBeGreaterThan(0);
  });

  it('ordena por veredito primeiro e nota depois', async () => {
    // A pergunta da triagem é "em qual eu mexo primeiro?", não "qual tem a nota
    // maior". Por isso o caso montado aqui é justamente o que separa as duas
    // ordens: o VERDE tem nota MENOR que o amarelo. Ordenar por nota inverteria
    // a fila — e foi assim que a primeira versão deste teste passou sem
    // exercitar a regra, porque lá o verde também era o de nota maior.
    const call = async (prompt) => {
      const verde = /Macambira/.test(prompt);
      const notas = {
        impacto: verde
          ? [{ dimensao: 'impacto', nota: 9 }, { dimensao: 'clareza', nota: 9 }]
          : [{ dimensao: 'impacto', nota: 6 }, { dimensao: 'clareza', nota: 9 }],
        retencao: [{ dimensao: 'retencao', nota: 9 }, { dimensao: 'historia', nota: 9 }],
        espectador: [{ dimensao: 'impacto', nota: 9 }, { dimensao: 'retencao', nota: 9 },
          { dimensao: 'valor', nota: 9 },
          // 5 é o mínimo de `compartilhamento`: passa raspando, e puxa a nota
          // do verde para 50 — abaixo do amarelo, que fica em 60.
          { dimensao: 'compartilhamento', nota: verde ? 5 : 9 }],
      };
      const m = /"notas": \[\{ "dimensao": "([a-z]+)"/.exec(prompt);
      const quem = J.JULG_BANCA_TRIAGEM
        .find((id) => J.JULG_AVALIADORES[id].dimensoes[0] === m[1]
          && prompt.indexOf(J.JULG_AVALIADORES[id].persona.slice(0, 40)) >= 0);
      return { content: JSON.stringify({ notas: notas[quem] || [] }), model: 'd' };
    };
    const r = await J.runTriagemPipeline({
      itens: [{ nome: 'amarelo', conteudo: OUTRO }, { nome: 'verde', conteudo: BOM }], call,
    });
    const porNome = (n) => r.fila.find((x) => x.nome === n);
    expect(porNome('verde').juizo.veredito).toBe('sim');
    expect(porNome('amarelo').juizo.veredito).toBe('ajustes');
    expect(porNome('verde').juizo.nota, 'o verde precisa ter a nota MENOR').toBeLessThan(porNome('amarelo').juizo.nota);
    expect(r.fila.map((x) => x.nome)).toEqual(['verde', 'amarelo']);
  });

  it('um vídeo que quebra não derruba a triagem inteira', async () => {
    const call = dublar(TUDO_BOM);
    const r = await J.runTriagemPipeline({ itens: [{ nome: 'vazio', conteudo: '' }, { nome: 'bom', conteudo: BOM }], call });
    expect(r.fila.map((x) => x.nome)).toEqual(['bom', 'vazio']);
    expect(r.fila.find((x) => x.nome === 'vazio').ok).toBe(false);
  });
});

/* ========================================================================== */
describe('a nota ponderada — camada nova, paralela, que nunca decide o veredito', () => {
  const notas = (over) => Object.entries({ ...TUDO_BOM, ...over })
    .map(([quem, ns]) => av(quem, ns));

  it('sem opções, cai no formato geral', () => {
    // Chamada com dois argumentos é a de toda a suíte acima — precisa continuar
    // funcionando sem o terceiro parâmetro.
    const j = J.julgarConteudo(notas({}), []);
    expect(j.ponderado.formato).toBe('geral');
    expect(j.ponderado.nota).toBeGreaterThan(0);
  });

  it('um id de formato desconhecido também cai no geral', () => {
    const j = J.julgarConteudo(notas({}), [], { formato: 'formato-que-nao-existe' });
    expect(j.ponderado.formato).toBe('geral');
  });

  it('a nota ponderada muda com o formato, sem mexer no veredito nem na pior nota', () => {
    const avals = notas({ retencao: [{ dimensao: 'retencao', nota: 5 }, { dimensao: 'historia', nota: 8 }] });
    const geral = J.julgarConteudo(avals, [], { formato: 'geral' });
    const curto = J.julgarConteudo(avals, [], { formato: 'curto' });
    // Retenção pesa mais no perfil "curto" (35) que no "geral" (30): puxar a
    // nota de retenção para baixo tem de doer mais na ponderada do "curto".
    expect(curto.ponderado.nota).toBeLessThan(geral.ponderado.nota);
    expect(curto.veredito).toBe(geral.veredito);
    expect(curto.nota).toBe(geral.nota);
    expect(curto.principal).toEqual(geral.principal);
  });

  it('uma falha crítica em dimensão de peso baixo continua reprovando o veredito — a ponderada não dilui', () => {
    // Naturalidade pesa só 3% no perfil geral. Se o peso entrasse no veredito,
    // uma nota ótima no resto quase apagaria essa falha da média.
    const j = J.julgarConteudo(notas({
      naturalidade: [{ dimensao: 'naturalidade', nota: 1, problema: 'soa gerado por IA' }],
    }), []);
    expect(j.criticas.length, 'tem de ser reconhecida como crítica').toBe(1);
    expect(j.veredito, 'peso baixo não pode comprar o veredito').toBe('nao');
    // E, mesmo reprovando, a nota ponderada continua sendo um número plausível
    // de qualidade geral — não zera por causa de uma dimensão de peso baixo.
    expect(j.ponderado.nota).toBeGreaterThan(50);
  });

  it('os pesos são renormalizados para as dimensões presentes — a triagem não deve parecer pior só por ter menos avaliadores', () => {
    // Duas avaliações completas, mesmas notas, mas uma delas só tem a banca
    // de triagem (poucas dimensões). A nota ponderada de cada uma deve refletir
    // a qualidade das dimensões que existem, não a cobertura.
    const completa = J.julgarConteudo(notas({}), []);
    const reduzida = J.julgarConteudo([
      av('retencao', TUDO_BOM.retencao), av('impacto', TUDO_BOM.impacto), av('valor', TUDO_BOM.valor),
    ], []);
    expect(reduzida.ponderado.porDimensao.length).toBeLessThan(completa.ponderado.porDimensao.length);
    // As notas dadas são todas altas nos dois casos — sem renormalizar, faltar
    // cobertura faria a nota cair; com renormalização, ela fica no mesmo patamar.
    expect(Math.abs(reduzida.ponderado.nota - completa.ponderado.nota)).toBeLessThan(15);
  });

  it('porDimensao vem ordenado do que mais pesa na nota para o que menos pesa', () => {
    const j = J.julgarConteudo(notas({
      retencao: [{ dimensao: 'retencao', nota: 4 }, { dimensao: 'historia', nota: 8 }],
    }), []);
    for (let i = 1; i < j.ponderado.porDimensao.length; i++) {
      expect(j.ponderado.porDimensao[i - 1].contribuicao)
        .toBeGreaterThanOrEqual(j.ponderado.porDimensao[i].contribuicao);
    }
    // Retenção reprovada e de maior peso: precisa estar entre as primeiras.
    expect(j.ponderado.porDimensao.slice(0, 2).map((d) => d.dimensao)).toContain('retencao');
  });

  it('sem avaliações, a ponderada não quebra — fica zerada e vazia', () => {
    const j = J.julgarConteudo([], []);
    expect(j.ponderado.nota).toBe(0);
    expect(j.ponderado.porDimensao).toEqual([]);
  });
});

/* ========================================================================== */
describe('o ponto forte — o par simétrico do principal', () => {
  const notas = (over) => Object.entries({ ...TUDO_BOM, ...over })
    .map(([quem, ns]) => av(quem, ns));

  it('pega a maior nota entre as avaliadas', () => {
    const j = J.julgarConteudo(notas({}), []);
    const maior = Math.max(...j.avaliadas.map((a) => a.nota));
    expect(j.pontoForte.nota).toBe(maior);
  });

  it('null quando não há nada avaliado', () => {
    expect(J.julgarConteudo([], []).pontoForte).toBeNull();
  });

  it('não interfere em principal, veredito, criticas nem acoes', () => {
    // O ponto forte é lido do mesmo array `avaliadas`, mas por um sort
    // diferente — precisa ser aditivo, nunca mudar o resto do juízo.
    const semFormato = J.julgarConteudo(notas({}), []);
    const comFormato = J.julgarConteudo(notas({}), [], { formato: 'informativo' });
    expect(comFormato.principal).toEqual(semFormato.principal);
    expect(comFormato.veredito).toBe(semFormato.veredito);
    expect(comFormato.criticas).toEqual(semFormato.criticas);
    expect(comFormato.acoes).toEqual(semFormato.acoes);
  });
});

/* ========================================================================== */
describe('vídeo sem conclusão — julgTerminaAbrupto reaproveita o Causos', () => {
  it('acusa texto que para sem pontuação final', () => {
    const r = J.julgTerminaAbrupto('O Zé chegou em casa e contou a história toda para a mulher');
    expect(r.problemas.length).toBeGreaterThan(0);
  });

  it('acusa texto que termina numa palavra que pede continuação', () => {
    // Termina COM pontuação, mas a última palavra antes dela é um conectivo —
    // é o segundo ramo da conta, distinto do "sem pontuação nenhuma" acima.
    const r = J.julgTerminaAbrupto('O Zé chegou em casa e contou a história toda para a mulher que.');
    expect(r.problemas.join(' ')).toMatch(/pede continuação/);
  });

  it('não acusa um texto que fecha de verdade', () => {
    expect(J.julgTerminaAbrupto(BOM).problemas).toEqual([]);
  });

  it('entra na conferência local, mapeado para a dimensão história', () => {
    const cortado = 'O Zé chegou em casa sem a carteira e sem o carro e a mulher perguntou o que tinha acontecido e';
    const local = J.conferirJulgamentoLocal(cortado, {});
    const achado = local.achados.find((a) => /pede continuação|sem terminar a frase/.test(a.texto));
    expect(achado, 'o achado precisa chegar até a lista final de achados').toBeTruthy();
    expect(achado.dimensao).toBe('historia');
  });
});

/* ========================================================================== */
describe('spoiler na embalagem — julgSpoilerNaEmbalagem reaproveita a auditoria da Embalagem', () => {
  // Desfecho claramente no último terço: o número e o nome próprio só aparecem
  // lá, igual ao fixture que test/embalagem.test.js já usa para esta conta.
  const TRANSCRICAO = `O vizinho apareceu na porta de casa com um relógio na mão dizendo que estava
precisando de dinheiro naquele mesmo dia. Perguntei quanto ele queria pelo relógio e ele
respondeu que vendia por vinte se fosse na hora. Olhei a peça de perto, era pesada, o vidro
riscado, a pulseira gasta de tanto uso, mas o ponteiro dos segundos andava certinho.
Fiquei com pena da situação dele e resolvi comprar mesmo sem saber se prestava. Guardei o
relógio na gaveta e fui trabalhar sem pensar mais no assunto durante o resto da manhã.
Na hora do almoço mostrei a peça para um colega do escritório que entende dessas coisas.
Ele olhou o fundo da caixa, viu a inscrição e ficou quieto por um tempo bem longo.
Disse que aquilo ali não era um relógio comum de banca de camelô. O Ricardo pagou duzentos
reais na mesma tarde e ainda disse que estava levando vantagem no negócio.`;

  it('acusa o título que o próprio usuário escreveu entregando o desfecho', () => {
    const r = J.julgSpoilerNaEmbalagem(TRANSCRICAO, { titulo: 'O Ricardo pagou duzentos reais pelo relógio' });
    expect(r.problemas.length).toBeGreaterThan(0);
  });

  it('não acusa um título que não entrega o fim', () => {
    const r = J.julgSpoilerNaEmbalagem(TRANSCRICAO, { titulo: 'Achei um relógio estranho na rua' });
    expect(r.problemas).toEqual([]);
  });

  it('entra na conferência local, mapeado para a dimensão embalagem', () => {
    const local = J.conferirJulgamentoLocal(TRANSCRICAO, { titulo: 'O Ricardo pagou duzentos reais pelo relógio' });
    const achado = local.achados.find((a) => /entrega o desfecho/.test(a.texto));
    expect(achado, 'o achado precisa chegar até a lista final de achados').toBeTruthy();
    expect(achado.dimensao).toBe('embalagem');
  });
});

/* ========================================================================== */
describe('a jornada do espectador — só o crítico de retenção percorre por trecho', () => {
  it('o prompt do crítico de retenção pede a travessia por trecho', () => {
    const p = J.buildAvaliadorPrompt('retencao', BOM, {}, []);
    expect(p).toMatch(/PERCORRA O VÍDEO POR TRECHO/);
    expect(p).toMatch(/"jornada":/);
    expect(p).toMatch(/"recompensa_final":/);
  });

  it('nenhum outro avaliador ganha o esquema de jornada', () => {
    J.JULG_BANCA_COMPLETA.filter((id) => id !== 'retencao').forEach((id) => {
      const p = J.buildAvaliadorPrompt(id, BOM, {}, []);
      expect(p, id).not.toMatch(/PERCORRA O VÍDEO POR TRECHO/);
      expect(p, id).not.toMatch(/"jornada":/);
    });
  });

  it('normaliza a jornada só para o avaliador de retenção', () => {
    const payload = {
      notas: [{ dimensao: 'retencao', nota: 7 }],
      jornada: [{ trecho: '0-3s', risco_abandono: 'alto', observacao: 'começa devagar' }],
      recompensa_final: true, recompensa_final_texto: 'fecha o gancho do início',
    };
    const retencao = J.normalizarAvaliacao(payload, 'retencao');
    expect(retencao.jornada).toEqual([{ trecho: '0-3s', riscoAbandono: 'alto', observacao: 'começa devagar' }]);
    expect(retencao.recompensaFinal).toBe(true);
    expect(retencao.recompensaFinalTexto).toBe('fecha o gancho do início');

    const outro = J.normalizarAvaliacao(payload, 'impacto');
    expect(outro.jornada, 'jornada não pertence a nenhum outro avaliador').toBeUndefined();
  });

  it('degrada em silêncio diante de jornada ausente ou malformada', () => {
    const semJornada = J.normalizarAvaliacao({ notas: [{ dimensao: 'retencao', nota: 7 }] }, 'retencao');
    expect(semJornada.jornada).toEqual([]);
    expect(semJornada.recompensaFinal).toBe(false);

    const malformada = J.normalizarAvaliacao({
      notas: [{ dimensao: 'retencao', nota: 7 }],
      jornada: [
        { trecho: 'trecho-que-nao-existe', risco_abandono: 'alto' },
        { trecho: 'clímax', risco_abandono: 'furioso', observacao: 'x' },
        'nem um objeto',
      ],
    }, 'retencao');
    // O trecho inválido é descartado; o risco inválido cai no valor mais seguro.
    expect(malformada.jornada).toEqual([{ trecho: 'clímax', riscoAbandono: 'baixo', observacao: 'x' }]);
  });

  it('a jornada nunca vira nota — o juiz continua lendo só .notas', () => {
    // Mesma avaliação, com e sem os campos de jornada: o julgamento tem de
    // sair idêntico, porque julgarConteudo só olha para `.notas`.
    const semJornada = [{ avaliador: 'retencao', notas: [{ dimensao: 'retencao', nota: 6 }], resumo: '' }];
    const comJornada = [{
      ...semJornada[0],
      jornada: [{ trecho: 'final', riscoAbandono: 'alto', observacao: 'termina sem fechar' }],
      recompensaFinal: false, recompensaFinalTexto: 'não paga o que prometeu',
    }];
    const a = J.julgarConteudo(semJornada, []);
    const b = J.julgarConteudo(comJornada, []);
    expect(b).toEqual(a);
  });
});
