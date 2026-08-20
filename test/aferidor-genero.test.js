// AFERIDOR — o gênero decide a régua
//
// ESTE ARQUIVO NASCEU DE UM VÍDEO DE MILHÕES DE VISUALIZAÇÕES QUE A FERRAMENTA
// REPROVOU. Um causo de humor — o patrão, o Zé e as galinhas do galinheiro —
// levou "NÃO POSTE" porque o questionário media um tipo só de conteúdo, o
// informativo, e nele repetir é desperdício.
//
// Num causo, a repetição É o timing: o "não é, meu patrão" que volta cinco
// vezes é o que arma a deixa final. O questionário cobrava "cada parte
// acrescenta informação nova?", "existe trecho removível?", "alguma informação
// é dita duas vezes?" — e o causo pagava por ser bem contado. Somadas, essas
// perguntas tiravam um quarto do peso antes de qualquer defeito de verdade.
//
// E havia o outro lado: NADA media a virada final, o timing ou os personagens.
// O conteúdo perdia por ser causo e não ganhava por ser um causo bom.
//
// DEPOIS VEIO UM SEGUNDO VÍDEO, e ele reprovou com o gênero CERTO. A carona da
// galinha — o homem com a galinha numa mão, a bacia debaixo do braço e o cacho
// de banana na outra — foi lida como humor e reprovada assim mesmo, porque as
// perguntas de humor que eu havia escrito descreviam a PIADA COM DEIXA: "o
// final traz uma virada?", "alguma coisa prepara o final?". Isso é o causo das
// galinhas; não é a carona, onde ninguém revela nada no fim e o absurdo só vai
// subindo até os dois desistirem. Confundir um subgênero com o gênero é o mesmo
// erro do questionário original, uma camada abaixo.
//
// O que os testes daqui seguram:
//   1. a classificação acontece ISOLADA — quem escolhe o gênero não vê nenhuma
//      pergunta de avaliação, senão classifica já procurando defeito;
//   2. cada gênero traz as perguntas que fazem sentido nele;
//   3. os DOIS vídeos passam — o que vira no fim e o que escala até o fim;
//   4. humor ruim continua reprovando: a régua afrouxou, não caiu.
import { describe, it, expect, beforeAll } from 'vitest';
import { loadModules, clearStorage } from './helpers/load.mjs';

let A;
beforeAll(() => {
  clearStorage();
  // `agents.js` entra porque é dele que vem o `extractJSON` que o pipeline usa
  // para ler a resposta da IA — sem ele, toda classificação viraria "geral".
  A = loadModules(['catalogs.js', 'core.js', 'poster-templates.js', 'agents.js',
    'aferidor-motor.js', 'aferidor-textos.js'],
    ['AFER_QUESTOES', 'AFER_GENEROS', 'AFER_GENERO_PADRAO', 'aferGenero', 'aferGeneroNome',
      'aferQuestoesAplicaveis', 'buildGeneroPrompt', 'buildAferPrompt', 'normalizarGenero',
      'normalizarRodada', 'consolidarRespostas', 'calcularAfericao', 'runAfericaoPipeline',
      'aferRecomendacao', 'AFER_FALA']);
});

/* A transcrição real, encurtada só no que se repete — a repetição está
 * preservada onde ela é o próprio material da piada. */
const CAUSO = `— No galinheiro tinha dez galinhas, levaram três, quantas ficaram?
— Bom, Zé, tinha dez, levaram três, ficaram sete.
— Não é, meu patrão, pense direito.
— Não é, Zé?
— Não é, meu patrão.
— Zé, agora você me deixou confuso.
— Não é, Zé?
— Não é, não, meu patrão, será possível, o senhor ia ganhar um dinheirinho agora se acertar.
— Aí tem que ser um cara mais inteligente que eu para saber.
— O senhor falou que era quanto?
— Eu falei que era sete, Zé.
— Não é, meu patrão!
— Bom... se tinha dez, levaram três, ficou quanto? Eu disse a você que era sete.
— Presta atenção: eu não lhe disse que roubaram três. Eu disse que LEVARAM.`;

const ids = (qs) => qs.map((q) => q.id);
const doGenero = (g) => A.aferQuestoesAplicaveis({ embalagem: {}, genero: g });

/* ========================================================================== */
describe('a classificação acontece isolada da avaliação', () => {
  /* A ordem e o isolamento são a coisa toda. Um modelo que já leu "existe
   * trecho removível?" começa a ler o conteúdo procurando defeito — e um causo
   * lido com olhos de auditor vira "conteúdo repetitivo", não humor. */

  const prompt = () => A.buildGeneroPrompt(CAUSO, {});

  it('o prompt de gênero não carrega NENHUMA pergunta do questionário', () => {
    const p = prompt();
    A.AFER_QUESTOES.forEach((q) => {
      expect(p, `a pergunta "${q.id}" vazou para a classificação`).not.toContain(q.pergunta);
      expect(p, `o id "${q.id}" vazou para a classificação`).not.toContain(q.id);
    });
  });

  it('nem fala em nota, peso, qualidade ou defeito', () => {
    expect(prompt()).not.toMatch(/nota|peso|pontu|qualidade|defeito|melhor|avali(e|ar)\b/i);
  });

  it('pede só o rótulo — sem justificativa, resumo ou confiança', () => {
    // Cada palavra a mais é uma chance de o modelo se convencer de uma
    // classificação e arrastá-la.
    const p = prompt();
    expect(p).toMatch(/SOMENTE JSON/);
    expect(p).not.toMatch(/justifi|explique|por que|confian|resum/i);
  });

  it('oferece todos os gêneros do catálogo, e só eles', () => {
    const p = prompt();
    A.AFER_GENEROS.forEach((g) => expect(p, g.id).toContain(g.id));
  });

  it('gênero irreconhecível não vira chute: cai no conjunto geral', () => {
    // Chutar um gênero aplicaria a régua errada em silêncio — exatamente o
    // defeito que este trabalho veio consertar.
    ['', null, undefined, 'poesia', '{}', 'HUMOR!!', 42].forEach((v) => {
      const g = A.normalizarGenero({ genero: v });
      expect(A.aferGenero(g) || g === A.AFER_GENERO_PADRAO, `"${v}" virou gênero`).toBeTruthy();
    });
    expect(A.normalizarGenero({ genero: 'poesia' })).toBe(A.AFER_GENERO_PADRAO);
    expect(A.normalizarGenero(null)).toBe(A.AFER_GENERO_PADRAO);
  });

  it('mas reconhece o gênero escrito de outros jeitos', () => {
    expect(A.normalizarGenero({ genero: ' Humor ' })).toBe('humor');
    expect(A.normalizarGenero({ genero: 'HISTÓRIA' })).toBe('historia');
    expect(A.normalizarGenero({ genero: 'opinião' })).toBe('opiniao');
  });
});

/* ========================================================================== */
describe('cada gênero traz a régua que faz sentido nele', () => {
  it('no humor, o bloco de trechos mortos sai inteiro', () => {
    const humor = ids(doGenero('humor'));
    ['repeticao', 'trecho_cortavel', 'explicacao_longa'].forEach((id) => {
      expect(humor, `"${id}" pune o timing da piada`).not.toContain(id);
    });
    // E "cada parte acrescenta informação nova?" — uma piada não informa, arma.
    expect(humor).not.toContain('progride');
  });

  it('e entram as perguntas que medem se a piada FUNCIONA', () => {
    const humor = ids(doGenero('humor'));
    ['humor_fecha', 'humor_escalada', 'humor_impasse', 'humor_personagem', 'humor_gordura']
      .forEach((id) => expect(humor, `falta "${id}"`).toContain(id));
  });

  it('mas essas perguntas não vazam para os outros gêneros', () => {
    ['noticia', 'educativo', 'historia', 'opiniao', A.AFER_GENERO_PADRAO].forEach((g) => {
      expect(ids(doGenero(g)), `humor_fecha apareceu em "${g}"`).not.toContain('humor_fecha');
    });
  });

  it('fora do humor, o bloco de trechos mortos continua valendo', () => {
    ['noticia', 'educativo', 'historia', 'opiniao', A.AFER_GENERO_PADRAO].forEach((g) => {
      expect(ids(doGenero(g)), `"${g}" perdeu a checagem de repetição`).toContain('repeticao');
    });
  });

  it('cada gênero tem quesito próprio para o que ele existe para fazer', () => {
    expect(ids(doGenero('historia'))).toContain('hist_acontece');
    expect(ids(doGenero('educativo'))).toContain('edu_aplicavel');
    expect(ids(doGenero('opiniao'))).toContain('opi_tese');
    expect(ids(doGenero('noticia'))).toContain('not_apuracao');
  });

  it('sem gênero identificado, valem as perguntas que servem a todos', () => {
    const geral = doGenero(A.AFER_GENERO_PADRAO);
    expect(geral.length).toBeGreaterThan(10);
    geral.forEach((q) => {
      expect(q.so, `"${q.id}" é de um gênero e entrou no geral`).toBeFalsy();
    });
  });

  it('todo gênero rende questionário com peso suficiente para uma nota', () => {
    [...A.AFER_GENEROS.map((g) => g.id), A.AFER_GENERO_PADRAO].forEach((g) => {
      const qs = doGenero(g);
      const peso = qs.reduce((a, q) => a + q.peso, 0);
      expect(qs.length, `"${g}" ficou com poucas perguntas`).toBeGreaterThan(8);
      expect(peso, `"${g}" ficou com pouco peso`).toBeGreaterThan(60);
    });
  });

  it('toda pergunta de gênero tem fala humana escrita', () => {
    A.AFER_QUESTOES.filter((q) => q.so).forEach((q) => {
      const f = A.AFER_FALA[q.id];
      expect(f, `"${q.id}" não tem fala em aferidor-textos.js`).toBeTruthy();
      expect(f.curto, `"${q.id}" sem forma curta`).toBeTruthy();
      expect(f.curtoBom, `"${q.id}" sem forma curta positiva`).toBeTruthy();
    });
  });
});

/* ========================================================================== */
describe('o causo das galinhas — o caso que obrigou tudo isto', () => {
  /** Responde o questionário do gênero: `over` troca respostas por id. */
  const aferir = (genero, over) => {
    const qs = doGenero(genero);
    const mapa = A.normalizarRodada({
      respostas: qs.map((q) => ({ id: q.id, resposta: (over && over[q.id]) || q.bom })),
    }, qs);
    const res = A.calcularAfericao(A.consolidarRespostas([mapa], qs), { rodadas: 1 });
    return { res, rec: A.aferRecomendacao(res) };
  };

  /* Como um modelo lê este causo quando o questionário insiste em informação
   * nova e trecho removível. Foi assim que ele levou NÃO POSTE. */
  const LEITURA_REAL = {
    progride: 'nao',
    repeticao: 'sim',
    trecho_cortavel: 'sim',
    explicacao_longa: 'sim',
    causalidade: 'nao',
    tem_conclusao: 'nao',
    assunto_claro: 'nao',
  };

  it('lido como conteúdo informativo, ele reprovava', () => {
    // O retrato do defeito. Se algum dia isto virar POSTE sozinho, a régua
    // informativa mudou e este teste deixou de descrever o problema.
    const { rec } = aferir(A.AFER_GENERO_PADRAO, LEITURA_REAL);
    expect(rec.selo).toBe('NÃO POSTE');
  });

  it('lido como humor, ele passa', () => {
    /* As perguntas que o derrubavam não existem neste gênero, e as que existem
     * ele acerta: tem a virada do "levaram", tem a insistência que arma o
     * final, tem duas vozes distintas e nenhuma fala sobrando. */
    const { rec } = aferir('humor', LEITURA_REAL);
    expect(rec.selo, 'o causo continua reprovado no gênero certo').toBe('POSTE');
  });

  it('e o motivo fala da piada, não de repetição', () => {
    const { rec } = aferir('humor', LEITURA_REAL);
    expect(rec.motivo).not.toMatch(/repet/i);
    expect(rec.motivo.length).toBeGreaterThan(20);
  });

  it('nenhuma das perguntas que o derrubavam sobrou no gênero humor', () => {
    const humor = ids(doGenero('humor'));
    Object.keys(LEITURA_REAL).forEach((id) => {
      if (id === 'assunto_claro') return;   // essa vale em qualquer gênero
      expect(humor, `"${id}" ainda pune o causo`).not.toContain(id);
    });
  });
});

/* ========================================================================== */
describe('a carona da galinha — comédia sem deixa também é comédia', () => {
  /* O SEGUNDO VÍDEO DE MILHÕES DE VIEWS REPROVADO, e desta vez o gênero estava
   * certo: a ferramenta acertou "humor" e reprovou mesmo assim.
   *
   * O defeito era das perguntas de humor da primeira versão. Elas descreviam a
   * PIADA COM DEIXA — "o final traz uma virada?", "alguma coisa prepara o
   * final?" — que é o causo das galinhas e não é este vídeo. Aqui a graça é o
   * impasse: o homem com a galinha numa mão, a bacia debaixo do braço e o cacho
   * de banana na outra, discutindo como pegar carona. Ninguém revela nada no
   * fim; o absurdo sobe até os dois desistirem.
   *
   * Comédia tem dois motores — deixa e escalada — e um questionário que só
   * conhece o primeiro reprova o segundo por não ser o primeiro. */
  const CARONA = `— Vizinho, não me pegue.
— Mas vizinho, como é que eu vou te pegar? Eu com a galinha numa mão, a bacia
debaixo do braço e um cacho de banana na outra mão. Me diz aí.
— É só você pegar a galinha, botar embaixo da bacia e a banana em cima.
— Me mostra aí como é isso. Faz aí que eu quero ver.
— Bote a galinha no chão. Agora pegue a banana.
— Mas vizinho, eu tenho medo.
— E larga minhas coisas aqui, meu cacho de banana pros outros comer, minha
bacia pros outros carregar.
— Depois você vem pegar.
— Os outros vão comer minhas bananas.
— Por isso que eu gosto dos caminhoneiro. Eu quero é prova.`;

  const humorIds = () => ids(doGenero('humor'));

  it('as perguntas de humor não exigem mais uma virada final', () => {
    // A trava direta do defeito: nenhuma pergunta do gênero pode cobrar
    // exclusivamente a estrutura de piada com deixa.
    const perguntas = doGenero('humor').filter((q) => q.so).map((q) => q.pergunta.toLowerCase());
    perguntas.forEach((p) => {
      if (!/virada|trocadilho|revela/.test(p)) return;
      expect(p, 'a pergunta cobra a virada sem admitir a escalada')
        .toMatch(/absurdo|escala|situação|seja/);
    });
  });

  it('e o previsível deixou de descontar no humor', () => {
    /* Em comédia de situação o público SABE desde o começo que não vai dar
     * certo — e a graça é ver a coisa não dar certo. */
    expect(humorIds()).not.toContain('previsivel');
  });

  it('existe quesito para a graça que CRESCE, não só para a que vira', () => {
    expect(humorIds()).toContain('humor_escalada');
    expect(humorIds()).toContain('humor_impasse');
  });

  it('a carona passa', () => {
    const qs = doGenero('humor');
    // Como o vídeo se lê: fecha no ápice do absurdo, a graça escala, o impasse
    // sustenta, as duas vozes se distinguem, e nenhuma fala sobra.
    const leitura = {
      humor_fecha: 'sim', humor_escalada: 'sim', humor_impasse: 'sim',
      humor_personagem: 'sim', humor_gordura: 'nao',
      assunto_claro: 'nao',   // "Vizinho, não me pegue" abre no meio da cena
    };
    const mapa = A.normalizarRodada({
      respostas: qs.map((q) => ({ id: q.id, resposta: leitura[q.id] || q.bom })),
    }, qs);
    const res = A.calcularAfericao(A.consolidarRespostas([mapa], qs), { rodadas: 1 });
    expect(A.aferRecomendacao(res).selo).toBe('POSTE');
    expect(CARONA.length, 'a transcrição sumiu do teste').toBeGreaterThan(100);
  });

  it('mas humor ruim continua reprovando — a régua afrouxou, não caiu', () => {
    /* O risco de corrigir um falso negativo é criar um "passa tudo". Um
     * conteúdo que não fecha, não escala, não tem impasse e ainda tem fala
     * sobrando precisa continuar reprovando. */
    const qs = doGenero('humor');
    const ruim = {
      humor_fecha: 'nao', humor_escalada: 'nao', humor_impasse: 'nao',
      humor_gordura: 'sim', entrega_algo: 'nao',
    };
    const mapa = A.normalizarRodada({
      respostas: qs.map((q) => ({ id: q.id, resposta: ruim[q.id] || q.bom })),
    }, qs);
    const res = A.calcularAfericao(A.consolidarRespostas([mapa], qs), { rodadas: 1 });
    expect(A.aferRecomendacao(res).selo).toBe('NÃO POSTE');
  });
});

/* ========================================================================== */
describe('o fluxo completo, de ponta a ponta', () => {
  /** IA dublada que responde as duas conversas do pipeline. */
  const dublar = (genero, over, opcoes) => {
    const o = opcoes || {};
    const chamadas = [];
    const call = async (prompt) => {
      chamadas.push(prompt);
      if (/OS GÊNEROS/.test(prompt)) {
        if (o.generoCai) throw new Error('classificação caiu');
        return { content: JSON.stringify({ genero }), model: 'dublado' };
      }
      const qs = doGenero(o.comoSeFosse || genero);
      return {
        content: JSON.stringify({
          respostas: qs.map((q) => ({ id: q.id, resposta: (over && over[q.id]) || q.bom })),
        }),
        model: 'dublado',
      };
    };
    call.chamadas = chamadas;
    return call;
  };

  it('classifica primeiro, avalia depois — e o questionário segue o gênero', async () => {
    const call = dublar('humor');
    const r = await A.runAfericaoPipeline({ conteudo: CAUSO, rodadas: 3, call });
    expect(r.genero).toBe('humor');
    expect(ids(r.questoes)).toContain('humor_fecha');
    expect(ids(r.questoes)).not.toContain('repeticao');
    // A classificação vem ANTES: é o primeiro prompt enviado.
    expect(/OS GÊNEROS/.test(call.chamadas[0]), 'a avaliação correu antes da classificação').toBe(true);
    expect(call.chamadas.filter((p) => /OS GÊNEROS/.test(p)).length,
      'o gênero é uma chamada só, não uma por rodada').toBe(1);
  });

  it('o gênero viaja no resultado, para a aferição continuar explicável depois', async () => {
    const r = await A.runAfericaoPipeline({ conteudo: CAUSO, rodadas: 3, call: dublar('historia') });
    expect(r.resultado.genero).toBe('historia');
  });

  it('classificação que falha NÃO derruba a aferição — cai no conjunto geral', async () => {
    /* Menos preciso, e honesto quanto a isso: melhor aferir pelo que serve a
     * todos do que chutar um gênero e aplicar a régua errada em silêncio. */
    const call = dublar('humor', {}, { generoCai: true, comoSeFosse: A.AFER_GENERO_PADRAO });
    const r = await A.runAfericaoPipeline({ conteudo: CAUSO, rodadas: 3, call });
    expect(r.genero).toBe(A.AFER_GENERO_PADRAO);
    expect(r.resultado.nota).toBe(100);
  });

  it('o mesmo conteúdo, em gêneros diferentes, é medido por réguas diferentes', async () => {
    const comoHumor = await A.runAfericaoPipeline({ conteudo: CAUSO, rodadas: 3, call: dublar('humor') });
    const comoNoticia = await A.runAfericaoPipeline({ conteudo: CAUSO, rodadas: 3, call: dublar('noticia') });
    expect(ids(comoHumor.questoes)).not.toEqual(ids(comoNoticia.questoes));
    expect(comoHumor.resultado.pesoTotal).not.toBe(comoNoticia.resultado.pesoTotal);
  });
});
