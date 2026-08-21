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
// O TERCEIRO caso não era do humor: uma esquete de guarda abrindo com "boa
// tarde, cidadã" era marcada como quem começa com saudação ao público. Fala de
// personagem não é preâmbulo, e isso valia para todo gênero.
//
// O QUARTO INVERTEU O SINAL, e é o mais caro: um causo de caçada APROVADO que
// não performou. Depois de três rodadas afrouxando a régua do humor, ela passou
// a deixar entrar um relato de nicho que não faz rir. A ferramenta chegou a
// dizer "falta o motivo do olha isso" — e aprovou assim mesmo, porque aquilo
// valia 6 pontos de 90. Ver o sinal e pesá-lo como detalhe é o mesmo que não
// vê-lo.
//
// O que os testes daqui seguram:
//   1. a classificação acontece ISOLADA — quem escolhe o gênero não vê nenhuma
//      pergunta de avaliação, senão classifica já procurando defeito;
//   2. cada gênero traz as perguntas que fazem sentido nele;
//   3. OS QUATRO CASOS SE SEPARAM NA MESMA RODADA: os três virais passam e o
//      causo da caçada reprova. Sem isso, cada conserto de um lado empurra a
//      régua para cima do outro;
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
    ['AFER_QUESTOES', 'AFER_GENEROS', 'AFER_GENERO_PADRAO', 'AFER_FAIXAS', 'aferGenero', 'aferGeneroNome',
      'aferQuestoesAplicaveis', 'buildGeneroPrompt', 'buildAferPrompt', 'normalizarGenero',
      'normalizarRodada', 'consolidarRespostas', 'calcularAfericao', 'runAfericaoPipeline',
      'aferRecomendacao', 'AFER_FALA', 'AFER_INTENCOES', 'aferIntencao']);
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

  it('oferece todas as intenções, e cada uma leva a um gênero', () => {
    const p = prompt();
    A.AFER_INTENCOES.forEach((i) => {
      expect(p, `a intenção "${i.id}" não está no prompt`).toContain(i.id);
      expect(A.aferGenero(i.genero), `"${i.id}" aponta para um gênero que não existe`).toBeTruthy();
    });
    // E todo gênero precisa ser alcançável por alguma intenção, senão vira
    // gênero morto: existe na tabela e nunca é escolhido.
    A.AFER_GENEROS.forEach((g) => {
      expect(A.AFER_INTENCOES.some((i) => i.genero === g.id),
        `nenhuma intenção leva a "${g.id}"`).toBe(true);
    });
  });

  it('resposta irreconhecível não vira chute: cai no conjunto geral', () => {
    // Chutar aplicaria a régua errada em silêncio — o defeito mais caro desta
    // ferramenta.
    ['', null, undefined, 'poesia', '{}', 'RIR!!', 42].forEach((v) => {
      const g = A.normalizarGenero({ intencao: v });
      expect(A.aferGenero(g) || g === A.AFER_GENERO_PADRAO, `"${v}" virou gênero`).toBeTruthy();
    });
    expect(A.normalizarGenero({ intencao: 'poesia' })).toBe(A.AFER_GENERO_PADRAO);
    expect(A.normalizarGenero(null)).toBe(A.AFER_GENERO_PADRAO);
  });

  it('cada intenção leva ao gênero certo', () => {
    expect(A.normalizarGenero({ intencao: 'rir' })).toBe('humor');
    expect(A.normalizarGenero({ intencao: 'contar' })).toBe('historia');
    expect(A.normalizarGenero({ intencao: 'rotina' })).toBe('vlog');
    expect(A.normalizarGenero({ intencao: 'informar' })).toBe('noticia');
    expect(A.normalizarGenero({ intencao: 'ensinar' })).toBe('educativo');
    expect(A.normalizarGenero({ intencao: 'convencer' })).toBe('opiniao');
  });

  it('e aferição guardada com o formato antigo continua abrindo', () => {
    // O histórico do usuário tem itens gravados antes desta mudança; eles não
    // podem virar "geral" retroativamente.
    expect(A.normalizarGenero({ genero: 'humor' })).toBe('humor');
    expect(A.normalizarGenero({ genero: 'vlog' })).toBe('vlog');
  });

  it('o desempate cobre TODAS as intenções, não só as que existiam antes', () => {
    /* O BUG QUE ESTE TESTE EXISTE PARA IMPEDIR. Quando o vlog entrou no
     * catálogo (r258), este bloco de regras continuou falando só de humor e
     * história — sobrou "uma história engraçada é humor" e não entrou nada
     * sobre vlog. Um vlog de rotina contado com graça (a moça que caiu do
     * cavalo e depois arrumou a égua com produtos da Shopee) ia direto para
     * humor e recebia as perguntas da piada.
     *
     * Gênero novo sem regra de desempate é gênero que nunca vai ser escolhido
     * quando disputar com um parecido. */
    const p = prompt();
    ['rir', 'rotina', 'contar'].forEach((id) => {
      expect(p.split(id).length - 1,
        `"${id}" aparece só na lista: falta regra ou sinal para ele`).toBeGreaterThan(1);
    });
  });

  it('CLASSIFICA POR INTENÇÃO, não por rótulo — a correção de raiz', () => {
    /* O ERRO QUE SE REPETIA CASO A CASO, e a razão de ele se repetir.
     *
     * Pedir "escolha entre notícia, humor, história, vlog…" faz o modelo
     * comparar o conteúdo com as DESCRIÇÕES e escolher a mais parecida. E
     * parecença é FORMA: uma esquete cômica de dez minutos, com personagens,
     * enredo e reviravoltas, se parece muito com "narra um acontecimento
     * fechado, com começo, meio e fim". Uma novela caipira encenada para fazer
     * rir foi para "historia" — onde a régua cobra desfecho, conclusão, não
     * repetir e não ter trecho removível — e reprovou por ser o que é.
     *
     * INTENÇÃO não se confunde com forma. "O que este conteúdo quer que a
     * pessoa sinta ou saiba ao terminar?" tem uma resposta só, e ela não muda
     * porque o vídeo é longo, tem enredo ou muitos personagens.
     *
     * Este teste guarda o PRINCÍPIO, não o caso: se um dia o prompt voltar a
     * pedir um rótulo de gênero, a mesma classe de erro volta com ele. */
    const p = prompt();
    expect(p, 'o prompt voltou a pedir um rótulo de gênero')
      .toMatch(/SINTA OU SAIBA|intencao/i);
    expect(p, 'a regra que impede a forma de decidir sumiu')
      .toMatch(/TAMANHO, ENREDO E NÚMERO DE PERSONAGENS NÃO DECIDEM/);
    expect(p, 'falta dizer que esquete longa continua sendo humor')
      .toMatch(/esquete cômica pode ser longa/i);
    // E os ids de intenção são diferentes dos de gênero, para o modelo não
    // cair de volta em rotular.
    A.AFER_INTENCOES.forEach((i) => {
      expect(A.aferGenero(i.id), `a intenção "${i.id}" tem nome de gênero`).toBeFalsy();
    });
  });

  it('resolve os HÍBRIDOS por um teste só, e não por exceção inventada', () => {
    /* Conteúdo híbrido é comum, e a régua é uma só: alguém tem de ganhar.
     *
     * O critério é sempre "tire uma das duas e veja se sobra conteúdo", e ele
     * decide os três pares sem regra ad hoc:
     *
     *   fato + posição   o fato serve à posição       → convencer
     *   história + graça armada PARA a piada          → rir
     *   rotina + graça   tirando as piadas sobra o dia → rotina
     *
     * O terceiro é o que engana, e é o único com evidência: um vlog de rotina
     * lido como "rir" recebeu cobrança de arremate, impasse e despropósito — a
     * régua da piada encenada — e reprovou. Num vlog a graça é TEMPERO; na
     * esquete é ESTRUTURA. */
    const p = prompt();
    expect(p, 'sumiu a seção de precedência dos híbridos')
      .toMatch(/QUANDO DUAS CABEM AO MESMO TEMPO/);
    expect(p, 'sumiu o teste que decide todos os pares')
      .toMatch(/TIRE UMA DAS DUAS E VEJA SE AINDA SOBRA CONTEÚDO/);
    expect(p, 'notícia com opinião precisa ir para convencer')
      .toMatch(/FATO \+ POSIÇÃO[\s\S]{0,120}convencer/);
    expect(p, 'história armada para a piada precisa ir para rir')
      .toMatch(/HISTÓRIA \+ GRAÇA[\s\S]{0,120}rir/);
    expect(p, 'vlog engraçado precisa continuar sendo rotina')
      .toMatch(/ROTINA \+ GRAÇA[\s\S]{0,60}rotina/);
  });

  it('e diz explicitamente que TOM não define gênero', () => {
    // A regra mais importante das seis: leve e divertido não é o mesmo que
    // "humor". Humor é quando fazer rir é o OBJETIVO.
    const p = prompt();
    expect(p).toMatch(/TOM TAMBÉM NÃO DECIDE/);
    expect(p).toMatch(/o próprio dia com muita graça.*rotina/is);
  });

  it('e lista os sinais observáveis de vlog', () => {
    const p = prompt();
    ['link na bio', 'produtos', 'câmera', 'se despede']
      .forEach((sinal) => expect(p, `falta o sinal "${sinal}"`).toContain(sinal));
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
    ['humor_fecha', 'humor_escalada', 'humor_impasse', 'humor_voz', 'humor_gordura']
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

  it('lido como conteúdo informativo, ele perde o que no humor nem se pergunta', () => {
    /* O retrato do defeito original. A régua informativa cobra do causo
     * repetição, trecho removível, informação nova e conclusão — e ele paga por
     * todos, porque é assim que um causo é contado.
     *
     * O veredito nesse gênero deixou de ser NÃO POSTE quando `premissa` e
     * `memoravel` entraram (r258) e o causo passou a ganhar pontos por ter as
     * duas coisas. O que este teste segura não é o selo, é o BURACO: a régua
     * errada cobra dele meia dúzia de quesitos que a régua certa nem faz. */
    const informativo = aferir(A.AFER_GENERO_PADRAO, LEITURA_REAL);
    const comoHumor = aferir('humor', LEITURA_REAL);
    expect(informativo.res.perdidos.length,
      'a régua informativa parou de cobrar o que o causo não deve').toBeGreaterThan(4);
    expect(comoHumor.res.perdidos.length,
      'a régua de humor passou a cobrar tanto quanto a informativa')
      .toBeLessThan(informativo.res.perdidos.length);
    expect(comoHumor.res.nota).toBeGreaterThan(informativo.res.nota + 30);
  });

  it('lido como humor, ele passa', () => {
    /* As perguntas que o derrubavam não existem neste gênero, e as que existem
     * ele acerta: tem a virada do "levaram", tem a insistência que arma o
     * final, tem duas vozes distintas e nenhuma fala sobrando. */
    const { rec } = aferir('humor', { ...LEITURA_REAL, humor_absurdo: 'sim' });
    expect(rec.selo, 'o causo continua reprovado no gênero certo').toBe('POSTE');
  });

  it('e o motivo fala da piada, não de repetição', () => {
    const { rec } = aferir('humor', { ...LEITURA_REAL, humor_absurdo: 'sim' });
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
      expect(p, 'a pergunta cobra a virada sem admitir outras formas de arremate')
        .toMatch(/absurdo|escala|situação|seja|recusa|desabafo|tirada|inesperada/);
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
      humor_absurdo: 'sim', humor_voz: 'sim', humor_gordura: 'nao',
      assunto_claro: 'nao',   // "Vizinho, não me pegue" abre no meio da cena
    };
    const mapa = A.normalizarRodada({
      respostas: qs.map((q) => ({ id: q.id, resposta: leitura[q.id] || q.bom })),
    }, qs);
    const res = A.calcularAfericao(A.consolidarRespostas([mapa], qs), { rodadas: 1 });
    expect(A.aferRecomendacao(res).selo).toBe('POSTE');
    expect(CARONA.length, 'a transcrição sumiu do teste').toBeGreaterThan(100);
  });

  it('"boa tarde, cidadã" não é preâmbulo — é a cena começando', () => {
    /* TERCEIRO VÍDEO REPROVADO, e este defeito não era só do humor.
     *
     * Uma esquete de guarda parando uma motociclista abre com o cumprimento
     * entre os dois personagens. A pergunta dizia apenas "começa com saudação?"
     * e o modelo marcou o defeito que ela descrevia ao pé da letra — custando
     * 7 pontos a uma cena que começa do jeito certo.
     *
     * O defeito real é o autor falando COM O ESPECTADOR antes de entregar
     * alguma coisa. Dois personagens se cumprimentando dentro da história é o
     * oposto disso: é a ficção já em andamento no primeiro segundo. Vale para
     * todo gênero — notícia, relato e educativo também dramatizam. */
    const q = A.AFER_QUESTOES.find((x) => x.id === 'sem_preambulo');
    expect(q.pergunta, 'a pergunta não distingue o espectador do personagem')
      .toMatch(/ESPECTADOR/);
    expect(q.pergunta, 'falta dizer que fala de personagem não conta')
      .toMatch(/personagens?.*NÃO conta|NÃO conta.*personagem/is);
    // E a de abertura não pode empurrar o mesmo engano pelo outro lado.
    const abre = A.AFER_QUESTOES.find((x) => x.id === 'abre_no_fato');
    expect(abre.pergunta).toMatch(/fala de personagem/i);
  });

  it('a esquete do guarda passa', () => {
    const qs = doGenero('humor');
    /* Bate-boca de autoridade: ninguém abre pergunta nem promete nada, e o que
     * segura é o conflito. As duas perguntas que cobravam essa arquitetura
     * ("fica pergunta em aberto?", "o começo promete e entrega?") saíram do
     * humor — `humor_impasse` e `humor_fecha` medem a mesma coisa pelo
     * critério certo. */
    expect(ids(qs)).not.toContain('pergunta_aberta');
    expect(ids(qs)).not.toContain('promessa_cumprida');
    const leitura = {
      humor_fecha: 'sim', humor_escalada: 'sim', humor_impasse: 'sim',
      humor_absurdo: 'sim', humor_voz: 'sim', humor_gordura: 'nao',
    };
    const mapa = A.normalizarRodada({
      respostas: qs.map((q) => ({ id: q.id, resposta: leitura[q.id] || q.bom })),
    }, qs);
    const res = A.calcularAfericao(A.consolidarRespostas([mapa], qs), { rodadas: 1 });
    expect(A.aferRecomendacao(res).selo).toBe('POSTE');
  });

  it('NENHUMA pergunta pede um juízo — a régua do §2 vale para os gêneros também', () => {
    /* A CAUSA-RAIZ DE TODO O VAIVÉM DESTA SEMANA, e ela estava escrita no
     * motor desde o primeiro dia: "'O gancho é forte?' não é binária coisa
     * nenhuma: é uma nota de 0 a 10 disfarçada de SIM/NÃO".
     *
     * As perguntas de gênero que escrevi violaram isso — "acontece alguma coisa
     * que FAZ RIR?", "a GRAÇA cresce?", "a fala tem JEITO PRÓPRIO?". E
     * subjetividade não erra para os dois lados por igual: um modelo lendo
     * TRANSCRIÇÃO não tem entonação, cara nem ritmo, então diante de "isso faz
     * rir?" ele responde "não" quase sempre. Foi assim que um vídeo de milhões
     * de views reprovou duas vezes, a segunda por causa do meu conserto da
     * primeira.
     *
     * Uma pergunta verificável aponta o que está ESCRITO — a última fala,
     * quantas vezes algo volta, que expressões aparecem. Quem discordar acha o
     * trecho. */
    const JUIZO = /\b(faz rir|engraçad|a graça (cresce|vai)|jeito próprio|é (bom|forte|boa)|de qualidade|interessante|bem (feito|contad))/i;
    A.AFER_QUESTOES.forEach((q) => {
      expect(q.pergunta, `"${q.id}" pede um juízo em vez de uma observação`)
        .not.toMatch(JUIZO);
    });
  });

  it('pergunta de duas saídas precisa prever a TERCEIRA: o nada', () => {
    /* A ARMADILHA DO "A OU B", e ela custou um falso positivo.
     *
     * "A última fala é uma tirada EM VEZ DE uma conclusão que explica?" oferece
     * duas alternativas — e o modelo escolhe a que sobra. Um esquete que
     * simplesmente PARA NO MEIO ("Faz assim.") não é conclusão explicativa,
     * logo deve ser tirada: responde SIM por eliminação. O vídeo foi aprovado
     * com "arremata na última fala".
     *
     * Quem escreve "em vez de" está oferecendo um caminho de fuga. Ou a
     * pergunta diz o que responder quando não há nem uma coisa nem outra, ou
     * ela aprova o vazio. */
    const comAlternativa = A.AFER_QUESTOES.filter((q) => /em vez de/i.test(q.pergunta));
    expect(comAlternativa.length, 'nenhuma pergunta usa "em vez de"?').toBeGreaterThan(0);
    // As de maior peso são as que decidem o veredito: nelas o caso nulo tem de
    // estar escrito.
    comAlternativa.filter((q) => q.essencial).forEach((q) => {
      expect(q.pergunta, `"${q.id}" é essencial, oferece duas saídas e não prevê o nada`)
        .toMatch(/ATENÇÃO|apenas para|não conta|responda "nao"/i);
    });
  });

  it('as formas curtas encaixam depois de "Ele" — são predicados, não frases', () => {
    /* O motivo do card costura três formas curtas depois de "Ele ": uma que
     * comece com artigo produz "Ele o começo explica em vez de fisgar". Saiu
     * assim na tela antes deste teste existir, e são justamente as frases que
     * ninguém relê depois de escrever. */
    const ARTIGO = /^(o|a|os|as|um|uma|quem|nada)\s/i;
    Object.entries(A.AFER_FALA).forEach(([id, f]) => {
      expect(f.curto, `"${id}": curto começa com artigo → "Ele ${f.curto}"`)
        .not.toMatch(ARTIGO);
      expect(f.curtoBom, `"${id}": curtoBom começa com artigo → "Ele ${f.curtoBom}"`)
        .not.toMatch(ARTIGO);
      expect(f.curto, `"${id}": curto termina com ponto`).not.toMatch(/\.$/);
      expect(f.curtoBom, `"${id}": curtoBom termina com ponto`).not.toMatch(/\.$/);
    });
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
describe('o causo da caçada — o primeiro FALSO POSITIVO', () => {
  /* Os três casos anteriores eram conteúdo viral que a ferramenta reprovava.
   * Este é o inverso, e é o erro mais caro dos dois: um causo de caçada
   * APROVADO que não performou. Depois de três rodadas afrouxando a régua do
   * humor para deixar os virais passarem, ela passou a deixar passar um relato
   * de nicho que não faz rir.
   *
   * O QUE A FERRAMENTA JÁ TINHA VISTO, e pesou como detalhe: "falta o motivo do
   * olha isso". Ela acertou o diagnóstico e o classificou como item 2 de uma
   * lista de ajustes, porque `motivo_compartilhar` valia 6 de 90 — menos que
   * "o conteúdo começa com saudação". Ver o sinal e pesá-lo como detalhe é o
   * mesmo que não vê-lo.
   *
   * O QUE FALTAVA MEDIR: o gancho (o vídeo abre explicando qual cachorro presta
   * para caçar — uma aula de dez segundos antes de a história começar) e o
   * alcance (paca, oco de pau, pabulagem: quem nunca caçou não acompanha). */

  const aferir = (over) => {
    const qs = doGenero('humor');
    const mapa = A.normalizarRodada({
      respostas: qs.map((q) => ({ id: q.id, resposta: over[q.id] || q.bom })),
    }, qs);
    const res = A.calcularAfericao(A.consolidarRespostas([mapa], qs), { rodadas: 1 });
    return { res, rec: A.aferRecomendacao(res) };
  };

  /* Como o causo da caçada se lê, item a item. */
  const CACADA = {
    gancho: 'nao',                // abre explicando, não fisgando
    alcance: 'nao',               // depende do vocabulário de caça
    motivo_compartilhar: 'nao',   // não rende um "olha isso"
    humor_fecha: 'nao',           // o cachorro acha a paca: conclui, não faz rir
    humor_escalada: 'nao',        // a graça não cresce
    humor_gordura: 'sim',         // sobra fala
  };

  it('o causo da caçada reprova', () => {
    expect(aferir(CACADA).rec.selo).toBe('NÃO POSTE');
  });

  it('e o motivo aponta os essenciais primeiro, depois o gancho', () => {
    /* As três vagas da frase vão para o que mais importa: os dois motores da
     * comédia que faltam, e só então o defeito de maior peso — o começo que
     * explica em vez de fisgar. */
    const motivo = aferir(CACADA).rec.motivo;
    expect(motivo).toContain(A.AFER_FALA.humor_fecha.curto);
    expect(motivo).toContain(A.AFER_FALA.gancho.curto);
  });

  it('"o motivo do olha isso" pesa como preditor, não como detalhe', () => {
    // Valia 6 quando a ferramenta aprovou um conteúdo que não circulou.
    const q = A.AFER_QUESTOES.find((x) => x.id === 'motivo_compartilhar');
    expect(q.peso).toBeGreaterThanOrEqual(10);
    const preambulo = A.AFER_QUESTOES.find((x) => x.id === 'sem_preambulo');
    expect(q.peso, 'circular continua valendo menos que não dar bom-dia')
      .toBeGreaterThan(preambulo.peso);
  });

  it('gancho e alcance existem, e valem para todo gênero', () => {
    [...A.AFER_GENEROS.map((g) => g.id), A.AFER_GENERO_PADRAO].forEach((g) => {
      expect(ids(doGenero(g)), `"${g}" sem gancho`).toContain('gancho');
      expect(ids(doGenero(g)), `"${g}" sem alcance`).toContain('alcance');
    });
  });

  it('"fecha a graça" separa arremate de conclusão — pelo que está ESCRITO', () => {
    /* Era por essa porta que um relato entrava como piada: um causo que termina
     * com o cachorro achando a paca "fecha" — amarra a história, não para no
     * meio.
     *
     * A primeira correção cobrava o EFEITO ("faz rir?") e criou um defeito
     * pior: um modelo lendo transcrição, sem entonação nem cara, quase sempre
     * responde que não faz rir. A pergunta agora aponta a ÚLTIMA FALA e
     * pergunta o que ela é — resposta inesperada e recusa de um lado,
     * conclusão que explica do outro. Isso se confere lendo. */
    const q = A.AFER_QUESTOES.find((x) => x.id === 'humor_fecha');
    expect(q.pergunta).toMatch(/última fala/i);
    expect(q.pergunta, 'a pergunta voltou a aceitar o vazio por eliminação')
      .toMatch(/apenas para|cortada no meio|sem fechar nada/i);
  });

  it('um monólogo não perde ponto por não ter um segundo personagem', () => {
    // A pergunta começava com "havendo mais de uma voz", e num causo em
    // primeira pessoa o modelo respondia "não" em vez de "não se aplica".
    const q = A.AFER_QUESTOES.find((x) => x.id === 'humor_voz');
    expect(q, 'humor_voz sumiu').toBeTruthy();
    expect(q.pergunta, 'voltou a depender de haver duas vozes')
      .not.toMatch(/havendo mais de uma voz/i);
    expect(q.pergunta).toMatch(/express|gíria/i);
  });

  it('a carona não perde mais por "entrega" e "assunto claro"', () => {
    /* Ela reprovou DUAS vezes, e a segunda foi consertando a primeira. Duas
     * perguntas universais a derrubavam por juízo:
     *
     *   entrega_algo   "quem chegou ao fim leva uma GRAÇA?" — pede que o modelo
     *                  ria lendo transcrição; `humor_fecha` mede o mesmo pela
     *                  última fala, que se confere olhando;
     *   assunto_claro  "lendo só o começo dá para dizer do que trata?" —
     *                  "Vizinho, não me pegue" não diz, e é por isso que
     *                  funciona: entrar no meio da cena é técnica. */
    const humor = ids(doGenero('humor'));
    expect(humor).not.toContain('entrega_algo');
    expect(humor).not.toContain('assunto_claro');
    // Mas nos outros gêneros as duas continuam de pé.
    expect(ids(doGenero('noticia'))).toContain('entrega_algo');
    expect(ids(doGenero('historia'))).toContain('assunto_claro');
  });

  it('a negociação das pedras reprova — piada precisa de despropósito', () => {
    /* SEGUNDO FALSO POSITIVO EM HUMOR. Um esquete de negociação de diária —
     * duzentos reais para tirar pedras na mão — foi aprovado. Ele tem impasse
     * (o serviço é pesado demais para o preço) e voz, mas não tem o que separa
     * uma piada de uma conversa qualquer: nada ali é fora do normal, e a coisa
     * termina cortada em "Faz assim.".
     *
     * Os três que funcionaram têm um despropósito que cabe numa frase — o homem
     * com a galinha, a bacia e o cacho de banana tentando pegar carona; a
     * charada em que "levaram" não é "roubaram"; a motociclista sem capacete
     * dando lição de moral no guarda. */
    const pedras = {
      humor_fecha: 'nao',       // "Faz assim." — corta no meio
      humor_escalada: 'nao',    // "diga a sua proposta" repete sem apertar
      humor_absurdo: 'nao',     // negociação que aconteceria igual na vida real
      humor_gordura: 'sim',
      motivo_compartilhar: 'nao',
    };
    const { res, rec } = aferir(pedras);
    expect(rec.selo).toBe('NÃO POSTE');
    expect(res.essenciaisFalhos.length, 'os essenciais não pegaram o caso')
      .toBeGreaterThan(1);
    expect(rec.motivo).toContain(A.AFER_FALA.humor_absurdo.curto);
  });

  it('o chucaio passa — comédia de IRONIA não tem duas partes discutindo', () => {
    /* O TERCEIRO MOTOR DA COMÉDIA, e o terceiro viral que eu reprovei pelo
     * mesmo tipo de erro. Um patrão amarra um chocalho no empregado para ouvir
     * de longe se ele trabalha, e vai dizendo "posso dormir despreocupado",
     * "está merecendo um aumento", "é um bom funcionário" — enquanto o
     * espectador entende sozinho que o chocalho está amarrado em outra coisa.
     *
     * `humor_impasse` e `humor_escalada` estavam escritas pressupondo DUAS
     * PARTES EM CONFRONTO ("alguém quer o que o outro não faz", "a dificuldade
     * volta pior"). Isso descreve as galinhas, a carona e o guarda; não
     * descreve um monólogo. As duas essenciais responderam "nao", e um vídeo de
     * milhões de views levou NÃO POSTE com nota 59.
     *
     * As perguntas agora aceitam as três formas: a tensão pode ser entre
     * pessoas OU entre o que se acredita e o que é; a intensificação pode ser
     * da dificuldade, do absurdo OU da convicção de quem fala. */
    const pergunta = (id) => A.AFER_QUESTOES.find((q) => q.id === id).pergunta;
    expect(pergunta('humor_impasse'), 'a tensão voltou a exigir duas partes')
      .toMatch(/acredita numa coisa que o conteúdo deixa claro não ser verdade/i);
    expect(pergunta('humor_escalada'), 'a intensificação voltou a exigir dificuldade que volta')
      .toMatch(/convencendo cada vez mais/i);
    // Monólogo irônico: fecha na tirada, a convicção cresce, a tensão é entre o
    // que o patrão acredita e o que o espectador vê.
    const { res, rec } = aferir({ humor_gordura: 'sim' });
    expect(rec.selo).toBe('POSTE');
    expect(res.essenciaisFalhos.length).toBe(0);
  });

  it('as pedras, com as RESPOSTAS REAIS DA IA, reprovam', () => {
    /* O ÚNICO CASO DESTE ARQUIVO CUJAS RESPOSTAS NÃO SÃO SUPOSIÇÃO MINHA.
     *
     * Todos os outros usam o que eu IMAGINO que o modelo responderia, e foi
     * justamente aí que errei: previ "nao" para o despropósito e a IA respondeu
     * "sim" três vezes de três. O usuário mandou a auditoria da tela, e ela
     * mostrou a conta inteira:
     *
     *   perdeu   humor_fecha (−10) e humor_escalada (−8) — os dois motores
     *   ganhou   58 pontos de higiene: abre no fato, não pede like, soa
     *            falado, não tem frase de IA, dá para contar numa frase
     *   nota 55, faixa "Bom", UM essencial falho → dentro da tolerância → POSTE
     *
     * O conteúdo falhava em tudo que faz uma piada ser piada e passava
     * sustentado por quesitos que qualquer vídeo decente acerta. */
    const RESPOSTAS_REAIS = { humor_fecha: 'nao', humor_escalada: 'nao', humor_gordura: 'sim' };
    const { res, rec } = aferir(RESPOSTAS_REAIS);
    expect(rec.selo).toBe('NÃO POSTE');
    expect(res.essenciaisFalhos.length, 'a escalada precisa contar como essencial').toBe(2);
    // E a nota continua na faixa que aprovaria: quem reprovou foram os
    // essenciais, não a soma. Se este expect cair, o teste virou outro.
    expect(res.nota, 'a soma deixou de ser o que aprovaria').toBeGreaterThanOrEqual(40);
  });

  it('mas falhar em UM motor só não reprova — comédia não precisa dos dois', () => {
    /* Um esquete que escala bem e não fecha com tirada ainda pode funcionar. A
     * régua pune a ausência dos DOIS, que é o que caracteriza não haver piada. */
    expect(aferir({ humor_fecha: 'nao' }).rec.selo).toBe('POSTE');
    expect(aferir({ humor_escalada: 'nao' }).rec.selo).toBe('POSTE');
    expect(aferir({ humor_fecha: 'nao', humor_escalada: 'nao' }).rec.selo).toBe('NÃO POSTE');
  });

  it('e o despropósito é essencial — impasse e voz sozinhos não bastam', () => {
    // Só com impasse e voz, sem absurdo e sem arremate, não é piada.
    const ids0 = doGenero('humor').filter((q) => q.essencial).map((q) => q.id);
    expect(ids0).toContain('humor_absurdo');
    expect(ids0).toContain('humor_fecha');
  });

  it('E OS TRÊS VIRAIS CONTINUAM PASSANDO — é a trava dos dois lados', () => {
    /* Sem isto, cada conserto de falso positivo empurraria a régua de volta
     * para cima dos vídeos que funcionaram. Os quatro casos precisam se separar
     * na MESMA rodada, ou não há régua nenhuma. */
    const viral = {
      gancho: 'sim', alcance: 'sim', motivo_compartilhar: 'sim',
      humor_fecha: 'sim', humor_escalada: 'sim', humor_impasse: 'sim',
      humor_absurdo: 'sim', humor_voz: 'sim', humor_gordura: 'nao',
    };
    expect(aferir({ ...viral, assunto_claro: 'nao' }).rec.selo).toBe('POSTE');  // galinhas
    expect(aferir({ ...viral, assunto_claro: 'nao' }).rec.selo).toBe('POSTE');  // carona
    expect(aferir(viral).rec.selo).toBe('POSTE');                               // guarda
    expect(aferir(CACADA).rec.selo).toBe('NÃO POSTE');                          // caçada
  });
});

/* ========================================================================== */
describe('vlog: o acerto por OMISSÃO deixa de comprar aprovação', () => {
  /* O PROBLEMA QUE ESTE BLOCO RESOLVE. Histórias e vlogs quase sempre passavam,
   * bons ou ruins, e a razão é aritmética: um vlog em que nada acontece acerta
   * cinco quesitos sem fazer esforço nenhum — não repete informação, não tem
   * frase de IA, não pede like, soa falado, termina com conclusão. Esses cinco
   * somavam mais que a premissa e a mudança de estado que faltavam, e a média
   * ponderada aprovava. O questionário media a AUSÊNCIA DE DEFEITOS e chamava
   * isso de qualidade.
   *
   * A correção tem duas partes: perguntar o que decide se um vlog presta
   * (premissa, mudança, memória, ponto de vista, autoria, tempo morto) e
   * impedir que essas respostas sejam compensadas por acertos periféricos. */

  const aferir = (genero, over) => {
    const qs = doGenero(genero);
    const mapa = A.normalizarRodada({
      respostas: qs.map((q) => ({ id: q.id, resposta: (over && over[q.id]) || q.bom })),
    }, qs);
    const res = A.calcularAfericao(A.consolidarRespostas([mapa], qs), { rodadas: 1 });
    return { res, rec: A.aferRecomendacao(res) };
  };

  /* O vlog tecnicamente correto em que NADA ACONTECE: acerta tudo o que se
   * acerta por omissão, e falha só no que exige ter assunto. */
  const VAZIO = {
    premissa: 'nao', mudanca: 'nao', memoravel: 'nao',
    ponto_de_vista: 'nao', autoria: 'nao', tempo_morto: 'sim',
  };

  it('vlog existe como gênero próprio', () => {
    expect(A.aferGenero('vlog'), 'vlog não é história nem tutorial').toBeTruthy();
    expect(ids(doGenero('vlog'))).toContain('mudanca');
    expect(ids(doGenero('vlog'))).toContain('ponto_de_vista');
    expect(ids(doGenero('vlog'))).toContain('tempo_morto');
  });

  it('o vlog sem assunto REPROVA, mesmo com nota de faixa aprovada', () => {
    const { res, rec } = aferir('vlog', VAZIO);
    expect(rec.selo).toBe('NÃO POSTE');
    // A prova de que não foi a soma que o reprovou: a nota, sozinha, aprovaria.
    expect(A.AFER_FAIXAS.find((f) => res.nota >= f.min).id,
      'este teste deixou de exercitar a regra dos essenciais').toMatch(/alto|bom/);
  });

  it('e o motivo fala do assunto que falta, não do trecho a cortar', () => {
    /* Ouvir "corte o trecho parado" quando o problema é não haver assunto é
     * receber o conselho errado com toda a educação. */
    const { rec } = aferir('vlog', VAZIO);
    expect(rec.motivo).toContain(A.AFER_FALA.premissa.curto);
    expect(rec.motivo).toContain(A.AFER_FALA.mudanca.curto);
  });

  it('mas o vlog imperfeito COM assunto continua passando', () => {
    // Uma falha essencial isolada é imperfeição, não ausência de conteúdo.
    const { rec } = aferir('vlog', { tempo_morto: 'sim', trecho_cortavel: 'sim', memoravel: 'nao' });
    expect(rec.selo).toBe('POSTE');
  });

  it('duas falhas essenciais reprovam; uma, não', () => {
    expect(aferir('vlog', { premissa: 'nao' }).rec.selo).toBe('POSTE');
    expect(aferir('vlog', { premissa: 'nao', mudanca: 'nao' }).rec.selo).toBe('NÃO POSTE');
  });

  it('cada gênero declara os quesitos sem os quais ele não existe', () => {
    const essenciais = (g) => doGenero(g).filter((q) => q.essencial).map((q) => q.id);
    expect(essenciais('vlog')).toContain('mudanca');
    expect(essenciais('historia')).toContain('hist_acontece');
    expect(essenciais('educativo')).toContain('edu_aplicavel');
    expect(essenciais('opiniao')).toContain('opi_tese');
    expect(essenciais('humor')).toContain('humor_fecha');
    // E todo gênero precisa ter pelo menos dois, senão a regra nunca dispara.
    [...A.AFER_GENEROS.map((g) => g.id), A.AFER_GENERO_PADRAO].forEach((g) => {
      expect(essenciais(g).length, `"${g}" tem essenciais de menos`).toBeGreaterThan(1);
    });
  });

  it('A COMÉDIA NÃO REGREDIU — ela estava certa e não se mexe no que funciona', () => {
    /* As dimensões novas ficaram FORA do humor de propósito: lá o impasse e a
     * última fala já medem premissa e memória pelo critério do gênero. Este
     * teste existe para o dia em que alguém quiser "uniformizar" os gêneros. */
    const humor = ids(doGenero('humor'));
    ['premissa', 'mudanca', 'memoravel', 'ponto_de_vista', 'autoria', 'tempo_morto']
      .forEach((id) => expect(humor, `"${id}" invadiu o humor`).not.toContain(id));
    const viral = {
      humor_fecha: 'sim', humor_escalada: 'sim', humor_impasse: 'sim', humor_voz: 'sim',
      humor_absurdo: 'sim', humor_gordura: 'nao', gancho: 'sim', alcance: 'sim',
      motivo_compartilhar: 'sim',
    };
    expect(aferir('humor', viral).rec.selo).toBe('POSTE');
  });
});

/* ========================================================================== */
describe('qualidade e potencial são medidas separadas', () => {
  it('o resultado traz as duas, cada uma na escala da nota', () => {
    const qs = doGenero('vlog');
    const mapa = A.normalizarRodada({
      respostas: qs.map((q) => ({ id: q.id, resposta: q.bom })),
    }, qs);
    const res = A.calcularAfericao(A.consolidarRespostas([mapa], qs), { rodadas: 1 });
    const fam = (id) => (res.porFamilia || []).find((f) => f.id === id);
    expect(fam('qualidade'), 'sumiu a medida de qualidade').toBeTruthy();
    expect(fam('potencial'), 'sumiu a medida de potencial').toBeTruthy();
    expect(fam('qualidade').nota).toBe(100);
  });

  it('conteúdo bom de nicho fechado separa as duas', () => {
    /* O caso que justifica a separação: qualidade alta e potencial baixo pede
     * um conserto (ampliar a porta de entrada); o inverso pede outro
     * (reescrever o vídeo). Um número só esconderia qual dos dois é. */
    const qs = doGenero('vlog');
    const nicho = { alcance: 'nao', motivo_compartilhar: 'nao' };
    const mapa = A.normalizarRodada({
      respostas: qs.map((q) => ({ id: q.id, resposta: nicho[q.id] || q.bom })),
    }, qs);
    const res = A.calcularAfericao(A.consolidarRespostas([mapa], qs), { rodadas: 1 });
    const fam = (id) => res.porFamilia.find((f) => f.id === id);
    expect(fam('qualidade').nota).toBe(100);
    expect(fam('potencial').nota, 'o potencial não caiu com o nicho fechado')
      .toBeLessThan(fam('qualidade').nota);
  });

  it('a força de distribuição NÃO é medida — e não deve fingir que é', () => {
    /* Seguidores, histórico do canal e autoridade do perfil decidem boa parte
     * do desempenho e não estão na transcrição. Dois vlogs de mesma qualidade
     * fazem 2 milhões e 20 mil views conforme o tamanho de quem publica, e esta
     * ferramenta não tem como saber disso. Fingir medir seria inventar. */
    const PROIBIDO = /seguidor|inscrit|audiência|alcance do canal|autoridade|views|visualiza/i;
    A.AFER_QUESTOES.forEach((q) => {
      expect(q.pergunta, `"${q.id}" pergunta sobre distribuição, que não está no texto`)
        .not.toMatch(PROIBIDO);
    });
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
      if (/A PERGUNTA/.test(prompt)) {
        if (o.generoCai) throw new Error('classificação caiu');
        // A classificação devolve INTENÇÃO; o motor deriva o gênero dela.
        const i = A.AFER_INTENCOES.find((x) => x.genero === genero);
        return { content: JSON.stringify({ intencao: i ? i.id : 'nada' }), model: 'dublado' };
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
    expect(/A PERGUNTA/.test(call.chamadas[0]), 'a avaliação correu antes da classificação').toBe(true);
    expect(call.chamadas.filter((p) => /A PERGUNTA/.test(p)).length,
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

  it('gênero imposto pelo usuário NÃO é reclassificado', async () => {
    /* A rede de segurança para o classificador que erra. Quando a pessoa
     * corrige o rótulo na tela, ela não quer que a IA revise a correção: a
     * escolha dela não é um palpite. E a chamada de classificação nem sai —
     * seria pedir uma opinião que já foi descartada. */
    const call = dublar('humor');   // o dublê insistiria em "humor"
    const r = await A.runAfericaoPipeline({
      conteudo: CAUSO, rodadas: 3, genero: 'vlog', call, comoSeFosse: 'vlog',
    });
    expect(r.genero, 'a escolha do usuário foi revista pela IA').toBe('vlog');
    expect(call.chamadas.filter((p) => /A PERGUNTA/.test(p)).length,
      'classificou mesmo com o gênero imposto').toBe(0);
  });

  it('gênero imposto inválido não passa: cai na classificação normal', async () => {
    const call = dublar('humor');
    const r = await A.runAfericaoPipeline({ conteudo: CAUSO, rodadas: 3, genero: 'inventado', call });
    expect(r.genero).toBe('humor');
    expect(call.chamadas.filter((p) => /A PERGUNTA/.test(p)).length).toBe(1);
  });

  it('o mesmo conteúdo, em gêneros diferentes, é medido por réguas diferentes', async () => {
    const comoHumor = await A.runAfericaoPipeline({ conteudo: CAUSO, rodadas: 3, call: dublar('humor') });
    const comoNoticia = await A.runAfericaoPipeline({ conteudo: CAUSO, rodadas: 3, call: dublar('noticia') });
    expect(ids(comoHumor.questoes)).not.toEqual(ids(comoNoticia.questoes));
    expect(comoHumor.resultado.pesoTotal).not.toBe(comoNoticia.resultado.pesoTotal);
  });
});
