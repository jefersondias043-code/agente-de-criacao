'use strict';
/* ============================================================================
 * AFERIDOR — avaliação binária de conteúdo
 *
 * O JULGADOR PERGUNTA "QUE NOTA ISSO MERECE?". AQUI NINGUÉM PERGUNTA ISSO.
 *
 * Pedir a uma IA uma nota de 0 a 100 é pedir um resumo de dezenas de juízos
 * que ela faz de uma vez e não mostra. O número sai, mas ninguém — nem ela —
 * sabe reconstruir de onde veio; e a mesma entrada, no dia seguinte, sai com
 * outro número. Esta ferramenta parte de outro lugar:
 *
 *     A IA responde SIM ou NÃO. O CÓDIGO calcula quanto aquilo vale.
 *
 * Três consequências, e são elas que justificam a ferramenta existir:
 *
 *  1. TRANSPARÊNCIA. A nota é a soma dos pesos das perguntas em que o conteúdo
 *     passou, dividida pela soma dos pesos que se aplicavam. Dá para conferir
 *     a conta na mão, pergunta por pergunta.
 *  2. CONTROLE. Mudar a importância de um quesito é mudar um número nesta
 *     tabela. Não mexe em prompt, não mexe em lógica, não precisa reaprender
 *     nada — e o efeito é previsível antes de rodar.
 *  3. ESTABILIDADE. Uma pergunta binária tem duas respostas possíveis; uma
 *     nota de 0 a 100 tem cento e uma. O ruído de amostragem que faz um 74
 *     virar 68 não faz um SIM virar NÃO com a mesma facilidade.
 *
 * O RESTO DO RUÍDO MORRE NA REPETIÇÃO. Cada aferição roda o MESMO questionário
 * sobre o MESMO conteúdo várias vezes, em chamadas independentes, e vale a
 * resposta predominante. Uma leitura torta isolada é voto vencido. E o quanto
 * as rodadas concordaram fica registrado: 5 de 5 é uma coisa, 3 de 5 é outra,
 * e esconder essa diferença seria inventar uma firmeza que não houve.
 *
 * A IA NUNCA VÊ OS PESOS — ver `buildAferPrompt`. É o que impede a separação
 * de ser só retórica: quem sabe que uma pergunta vale 10 e outra vale 3
 * responde diferente.
 *
 * As funções puras daqui não tocam no DOM e recebem a chamada de IA por
 * parâmetro: dá para exercitar a aferição inteira com IA dublada, offline.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* §1 — Os blocos                                                              */
/* -------------------------------------------------------------------------- */

const AFER_BLOCOS = [
  { id: 'abertura', label: 'Abertura', desc: 'O que decide se a pessoa fica ou vai embora.' },
  { id: 'curiosidade', label: 'Curiosidade e progressão', desc: 'O que dá motivo para continuar.' },
  { id: 'retencao', label: 'Trechos mortos', desc: 'O que faz a pessoa sair no meio.' },
  { id: 'entrega', label: 'Entrega e final', desc: 'O que a pessoa leva por ter assistido.' },
  { id: 'naturalidade', label: 'Naturalidade', desc: 'Se soa gente falando ou texto gerado.' },
  { id: 'distribuicao', label: 'Distribuição', desc: 'Se existe motivo para circular.' },
  { id: 'embalagem', label: 'Embalagem', desc: 'Título e legenda contra o que o vídeo entrega.' },
];

function aferBloco(id) {
  return AFER_BLOCOS.find((b) => b.id === id) || null;
}

/* -------------------------------------------------------------------------- */
/* §1b — Os gêneros                                                            */
/* -------------------------------------------------------------------------- */

/* POR QUE O GÊNERO EXISTE, e por que ele custou um vídeo de milhões de views.
 *
 * O questionário original media UM tipo de conteúdo — o informativo — e media
 * bem. Aplicado a um causo de humor, ele reprovava por motivos que são, no
 * humor, virtudes: "alguma informação é dita duas vezes?" (a repetição é o
 * timing da piada), "existe trecho removível?" (o vai-e-vem constrói a deixa),
 * "cada parte acrescenta informação nova?" (uma piada não informa, ela arma).
 * Somadas, essas perguntas tiravam 25% do peso de um causo BEM CONTADO, antes
 * de qualquer defeito de verdade.
 *
 * E havia o outro lado, mais silencioso: nada no questionário media a virada
 * final, o timing ou a construção dos personagens — justamente o que faz um
 * causo funcionar. O conteúdo perdia por ser causo e não ganhava por ser um
 * causo bom.
 *
 * Um gênero não é um rótulo decorativo: ele decide QUAIS PERGUNTAS se aplicam.
 * A régua muda; a aritmética, não. */
const AFER_GENEROS = [
  { id: 'noticia', label: 'notícia', artigo: 'uma',
    desc: 'Informa um fato: o que aconteceu, com quem, onde.' },
  { id: 'educativo', label: 'conteúdo educativo', artigo: 'um',
    desc: 'Ensina a fazer ou entender alguma coisa.' },
  { id: 'humor', label: 'humor', artigo: 'um',
    desc: 'A graça é o objetivo: piada, causo engraçado, esquete, diálogo cômico.' },
  { id: 'historia', label: 'história', artigo: 'uma',
    desc: 'Conta um acontecimento — real ou não. O interesse está no que aconteceu.' },
  { id: 'opiniao', label: 'opinião', artigo: 'uma',
    desc: 'Defende um ponto de vista sobre alguma coisa.' },
];

/* O gênero de quem não foi identificado. Não é um gênero de verdade: é o
 * conjunto das perguntas que valem para qualquer conteúdo. Quando a chamada de
 * identificação falha, é MELHOR AFERIR PELO QUE SERVE A TODOS do que chutar um
 * gênero — um chute errado aplica a régua errada em silêncio, que é exatamente
 * o defeito que este trabalho veio consertar. */
const AFER_GENERO_PADRAO = 'geral';

function aferGenero(id) {
  return AFER_GENEROS.find((g) => g.id === id) || null;
}

/** Nome do gênero para a tela: "um humor" fica errado, "humor" fica seco. */
function aferGeneroNome(id) {
  const g = aferGenero(id);
  return g ? g.label : '';
}

/* -------------------------------------------------------------------------- */
/* §2 — O questionário                                                         */
/* -------------------------------------------------------------------------- */

/* O QUE FAZ UMA PERGUNTA PRESTAR AQUI, e é a coisa mais importante do arquivo.
 *
 * Uma pergunta ruim devolve a subjetividade pela janela. "O gancho é forte?"
 * não é binária coisa nenhuma: é uma nota de 0 a 10 disfarçada de SIM/NÃO, e
 * duas leituras do mesmo vídeo respondem diferente. A pergunta precisa ser
 * VERIFICÁVEL NO CONTEÚDO — alguém que discorde da resposta tem de conseguir
 * apontar o trecho que prova.
 *
 * Daí a forma delas: "nos primeiros segundos JÁ ACONTECE alguma coisa
 * concreta?" em vez de "a abertura é boa?". A primeira se resolve olhando; a
 * segunda se resolve opinando.
 *
 * `bom` DIZ QUAL RESPOSTA PONTUA, e existe porque metade das perguntas é
 * armadilha por desenho. "Existe trecho repetitivo?" pontua com NÃO. Sem esse
 * campo, ou todas as perguntas teriam de ser escritas na forma positiva —
 * o que força construções torcidas ("o conteúdo está LIVRE de repetição?") e
 * convida a IA a concordar por educação —, ou o cálculo teria de saber de cor
 * quais invertem, que é a mesma informação em lugar pior.
 *
 * `peso` é o único número da tabela. Mudar aqui muda a nota, e nada mais.
 *
 * `exige` marca a pergunta que só faz sentido com aquela informação na mão.
 * Sem título nem legenda, as duas de embalagem não são respondidas NEM contam
 * no divisor — ver `calcularAfericao`. Perguntar sobre o que não existe e
 * descontar pontos por isso seria punir quem ainda não escreveu o título.
 *
 * `so` e `exceto` SÃO A RÉGUA POR GÊNERO, e é aqui que mora a correção que um
 * causo de milhões de views obrigou a fazer:
 *
 *   `so: ['humor']`      — a pergunta só existe naquele gênero. É como entram
 *                          os quesitos que medem o que faz o gênero funcionar,
 *                          e que o questionário informativo nunca mediu.
 *   `exceto: ['humor']`  — a pergunta vale em todo lugar MENOS ali, porque ali
 *                          ela pune o que deveria premiar.
 *
 * Sem os dois campos, a pergunta vale para todos — inclusive para o conteúdo
 * cujo gênero não foi identificado. */
const AFER_QUESTOES = [
  /* ---- Abertura: peso alto porque age antes de todo o resto ---- */
  { id: 'abre_no_fato', bloco: 'abertura', peso: 10, bom: 'sim',
    pergunta: 'Nos primeiros segundos já acontece alguma coisa concreta — um fato, uma ação, uma fala de personagem, uma afirmação específica — em vez de o apresentador cumprimentar o público ou anunciar o que virá?' },
  /* "BOA TARDE, CIDADÃ" NÃO É PREÂMBULO — É A CENA COMEÇANDO.
   *
   * A redação anterior dizia só "começa com saudação", e um terceiro vídeo de
   * milhões de views reprovou por causa disso: uma esquete de guarda parando
   * uma motociclista abre com o cumprimento entre os dois personagens, e o
   * modelo marcou o defeito que a pergunta descrevia ao pé da letra.
   *
   * O defeito real é o autor falando COM O ESPECTADOR antes de entregar
   * qualquer coisa ("oi gente, tudo bem?"). Dois personagens se cumprimentando
   * dentro da história é o oposto: é a ficção já em andamento no primeiro
   * segundo. A pergunta agora nomeia a diferença em vez de contar com o bom
   * senso do modelo — e vale para todo gênero, porque notícia, relato e
   * educativo também dramatizam. */
  { id: 'sem_preambulo', bloco: 'abertura', peso: 7, bom: 'nao',
    pergunta: 'O conteúdo começa com alguém falando DIRETAMENTE COM O ESPECTADOR — saudação ("oi gente", "sejam bem-vindos"), apresentação do canal ou pedido de inscrição? Atenção: cumprimento entre personagens dentro da cena ("boa tarde, cidadã") NÃO conta aqui — isso é a cena começando, não preâmbulo.' },
  { id: 'assunto_claro', bloco: 'abertura', peso: 7, bom: 'sim',
    pergunta: 'Lendo só o começo, e sem depender do título, dá para dizer do que o conteúdo trata?' },

  /* ---- Curiosidade e progressão ---- */
  /* FORA DO HUMOR, junto com `promessa_cumprida`. As duas descrevem a mesma
     arquitetura — abrir uma pergunta, prometer, entregar — que é o causo das
     galinhas e não é uma esquete de bate-boca: numa briga de guarda com
     motociclista ninguém abre pergunta nenhuma nem promete nada, e o que
     segura é o conflito. `humor_impasse` e `humor_fecha` já medem isso pelo
     critério certo; manter estas aqui era cobrar a mesma coisa duas vezes, uma
     delas pela forma errada. */
  { id: 'pergunta_aberta', bloco: 'curiosidade', peso: 8, bom: 'sim', exceto: ['humor'],
    pergunta: 'Fica alguma pergunta em aberto que só o restante do conteúdo responde?' },
  /* FORA DO HUMOR: em comédia de situação o público SABE desde o começo que
     não vai dar certo, e a graça está justamente em ver a coisa não dar certo.
     A pergunta separa bem o previsível do surpreendente num conteúdo que
     promete informação; diante de uma teimosia circular ela não tem resposta
     honesta, e no binário a dúvida vira desconto. */
  { id: 'previsivel', bloco: 'curiosidade', peso: 6, bom: 'nao', exceto: ['humor'],
    pergunta: 'Dá para adivinhar como termina antes de chegar à metade?' },
  /* FORA DO HUMOR: uma piada não informa, ela arma. O vai-e-vem de um diálogo
     cômico não "acrescenta informação" e não deveria pagar por isso. */
  { id: 'progride', bloco: 'curiosidade', peso: 8, bom: 'sim', exceto: ['humor'],
    pergunta: 'Cada parte acrescenta informação que não estava na anterior?' },
  { id: 'causalidade', bloco: 'curiosidade', peso: 5, bom: 'sim', exceto: ['humor'],
    pergunta: 'As coisas se puxam — uma causa a outra — em vez de apenas se sucederem?' },

  /* ---- Trechos mortos ----
     O bloco inteiro sai do humor. Repetir é o timing da piada; o trecho que
     "poderia ser removido" é o que constrói a deixa; a explicação que "se
     estende" é o suspense. No humor, quem cuida disso é `humor_gordura`, que
     pergunta a mesma coisa pelo critério certo. */
  { id: 'repeticao', bloco: 'retencao', peso: 7, bom: 'nao', exceto: ['humor'],
    pergunta: 'Alguma informação é dita duas vezes, com palavras diferentes?' },
  { id: 'trecho_cortavel', bloco: 'retencao', peso: 7, bom: 'nao', exceto: ['humor'],
    pergunta: 'Existe algum trecho que poderia ser removido inteiro sem o conteúdo perder nada?' },
  { id: 'explicacao_longa', bloco: 'retencao', peso: 5, bom: 'nao', exceto: ['humor'],
    pergunta: 'Alguma explicação se estende além do necessário para ser entendida?' },

  /* ---- Entrega e final: o que sobra depois de assistir ---- */
  { id: 'entrega_algo', bloco: 'entrega', peso: 10, bom: 'sim',
    pergunta: 'Quem chegou ao fim leva alguma coisa concreta — uma informação, uma emoção, uma surpresa, uma graça?' },
  /* No humor a conclusão é a DEIXA, e ela tem pergunta própria — cobrar
     "conclusão" de uma piada faz o modelo procurar um fecho explicativo que
     mataria a graça se existisse. */
  { id: 'tem_conclusao', bloco: 'entrega', peso: 8, bom: 'sim', exceto: ['humor'],
    pergunta: 'O conteúdo termina com uma conclusão, em vez de simplesmente parar?' },
  { id: 'promessa_cumprida', bloco: 'entrega', peso: 8, bom: 'sim', exceto: ['humor'],
    pergunta: 'O que o começo prometeu é entregue até o fim?' },
  { id: 'final_responde', bloco: 'entrega', peso: 6, bom: 'sim', exceto: ['humor'],
    pergunta: 'O final responde à pergunta que o começo abriu?' },

  /* ---- Naturalidade ---- */
  { id: 'soa_falado', bloco: 'naturalidade', peso: 6, bom: 'sim',
    pergunta: 'O texto soa como uma pessoa falando, em vez de texto escrito para ser lido?' },
  { id: 'frase_de_ia', bloco: 'naturalidade', peso: 4, bom: 'nao',
    pergunta: 'Aparece alguma frase de vocabulário genérico de IA — "vamos mergulhar", "é importante ressaltar", "em um mundo onde", "não é apenas"?' },

  /* ---- Distribuição ---- */
  { id: 'motivo_compartilhar', bloco: 'distribuicao', peso: 6, bom: 'sim',
    pergunta: 'Existe uma razão concreta para alguém mandar isto a outra pessoa — algo que valha um "olha isso"?' },
  /* Tomar posição é virtude na opinião e defeito na notícia; numa piada e num
     tutorial, não é nem uma coisa nem outra. */
  { id: 'provoca_reacao', bloco: 'distribuicao', peso: 4, bom: 'sim', so: ['opiniao', 'historia'],
    pergunta: 'O conteúdo toma alguma posição ou deixa algo com que dê para concordar ou discordar?' },
  { id: 'cta_artificial', bloco: 'distribuicao', peso: 3, bom: 'nao',
    pergunta: 'Existe pedido explícito de like, inscrição, comentário ou compartilhamento?' },

  /* ================= HUMOR =================
   *
   * A PRIMEIRA VERSÃO DESTAS PERGUNTAS CONFUNDIU UM SUBGÊNERO COM O GÊNERO, e
   * reprovou um segundo vídeo de milhões de views por isso. Elas exigiam a
   * estrutura da PIADA COM DEIXA — "o final traz uma virada?", "alguma coisa
   * prepara o final?" —, que descreve o causo das galinhas ("levaram", não
   * "roubaram") e não descreve a carona da galinha, da bacia e do cacho de
   * banana, onde a graça é o impasse circular: ninguém revela nada no fim, o
   * absurdo só vai subindo até os dois desistirem.
   *
   * Comédia tem pelo menos dois motores, e um questionário que só conhece um
   * reprova o outro por não ser o primeiro:
   *
   *   deixa    — tudo converge para uma revelação que reinterpreta o que veio;
   *   escalada — a situação se repete e piora, e a graça está em vê-la piorar.
   *
   * As perguntas agora medem o que os DOIS têm em comum: que a coisa feche, que
   * a graça cresça, que haja um impasse sustentando, que as vozes se
   * distingam, e que nada sobre. Cada uma admite as duas formas por escrito —
   * "com uma virada OU levando ao ponto mais absurdo" —, porque num binário a
   * forma não prevista vira "não". */
  { id: 'humor_fecha', bloco: 'entrega', peso: 10, bom: 'sim', so: ['humor'],
    pergunta: 'O final fecha a graça — seja com uma virada, um trocadilho ou uma revelação, seja levando a situação ao ponto mais absurdo — em vez de simplesmente parar?' },
  { id: 'humor_escalada', bloco: 'curiosidade', peso: 8, bom: 'sim', so: ['humor'],
    pergunta: 'A graça CRESCE ao longo do conteúdo — por insistência, por repetição ou porque a situação vai ficando cada vez mais absurda?' },
  { id: 'humor_impasse', bloco: 'curiosidade', peso: 8, bom: 'sim', so: ['humor'],
    pergunta: 'Existe um mal-entendido, um impasse ou uma teimosia que sustenta a graça, em vez de piadas soltas sem nada as ligando?' },
  { id: 'humor_personagem', bloco: 'naturalidade', peso: 6, bom: 'sim', so: ['humor'],
    pergunta: 'Havendo mais de uma voz, dá para diferenciar quem fala pelo jeito de falar, sem ninguém dizer o nome?' },
  { id: 'humor_gordura', bloco: 'retencao', peso: 5, bom: 'nao', so: ['humor'],
    pergunta: 'Existe fala que não faz graça, não constrói a situação nem caracteriza quem está falando?' },

  /* ================= HISTÓRIA / RELATO ================= */
  { id: 'hist_acontece', bloco: 'curiosidade', peso: 10, bom: 'sim', so: ['historia'],
    pergunta: 'Acontece alguma coisa que muda a situação — um problema, uma virada, uma decisão?' },
  { id: 'hist_concreto', bloco: 'curiosidade', peso: 6, bom: 'sim', so: ['historia'],
    pergunta: 'A história traz detalhes concretos — lugar, gente, o que foi dito — em vez de ser contada por resumo?' },
  { id: 'hist_desfecho', bloco: 'entrega', peso: 8, bom: 'sim', so: ['historia'],
    pergunta: 'A história chega a um desfecho, em vez de parar no meio do acontecimento?' },

  /* ================= EDUCATIVO ================= */
  { id: 'edu_aplicavel', bloco: 'entrega', peso: 10, bom: 'sim', so: ['educativo'],
    pergunta: 'Quem assistiu até o fim consegue fazer a coisa, ou fica sabendo o suficiente para tentar?' },
  { id: 'edu_ordem', bloco: 'curiosidade', peso: 7, bom: 'sim', so: ['educativo'],
    pergunta: 'Os passos vêm numa ordem que dá para seguir, sem depender de informação que só aparece depois?' },

  /* ================= OPINIÃO ================= */
  { id: 'opi_tese', bloco: 'abertura', peso: 10, bom: 'sim', so: ['opiniao'],
    pergunta: 'Dá para dizer em uma frase qual é a posição que o conteúdo defende?' },
  { id: 'opi_razao', bloco: 'entrega', peso: 8, bom: 'sim', so: ['opiniao'],
    pergunta: 'A posição vem acompanhada de pelo menos uma razão, dado ou exemplo concreto?' },

  /* ================= NOTÍCIA ================= */
  { id: 'not_apuracao', bloco: 'entrega', peso: 7, bom: 'sim', so: ['noticia'],
    pergunta: 'Fica claro de onde veio a informação — quem disse, onde aconteceu, quando?' },

  /* ---- Embalagem: só quando houver título ou legenda ---- */
  { id: 'titulo_promete', bloco: 'embalagem', peso: 5, bom: 'sim', exige: 'embalagem',
    pergunta: 'O título promete alguma coisa específica, em vez de ser vago?' },
  { id: 'titulo_spoiler', bloco: 'embalagem', peso: 5, bom: 'nao', exige: 'embalagem',
    pergunta: 'O título ou a legenda entrega o desfecho, a ponto de tornar o conteúdo dispensável?' },
];

function aferQuestao(id) {
  return AFER_QUESTOES.find((q) => q.id === id) || null;
}

/** As perguntas que se aplicam ao material que existe E ao gênero identificado. */
function aferQuestoesAplicaveis(ctx) {
  const c = ctx || {};
  const temEmbalagem = !!(String((c.embalagem || {}).titulo || '').trim()
    || String((c.embalagem || {}).legenda || '').trim());
  const genero = c.genero || AFER_GENERO_PADRAO;
  return AFER_QUESTOES.filter((q) => {
    if (q.exige === 'embalagem' && !temEmbalagem) return false;
    // `so` restringe; `exceto` exclui. Sem nenhum dos dois, vale para todos —
    // inclusive para o conteúdo cujo gênero não foi identificado.
    if (q.so && q.so.indexOf(genero) < 0) return false;
    if (q.exceto && q.exceto.indexOf(genero) >= 0) return false;
    return true;
  });
}

/* Quantas vezes o mesmo questionário roda. ÍMPAR de propósito: com número par
 * existe empate, e empate obriga a inventar uma regra de desempate para uma
 * coisa que não precisava ter empatado. Cinco é o padrão porque três já corrige
 * a leitura torta isolada mas deixa uma segunda coincidência decidir, e sete
 * custa 40% mais para mudar pouca coisa. */
const AFER_RODADAS = [3, 5, 7];
const AFER_RODADAS_PADRAO = 5;

function aferRodadas(n) {
  const v = Math.round(Number(n));
  return AFER_RODADAS.indexOf(v) >= 0 ? v : AFER_RODADAS_PADRAO;
}

/* -------------------------------------------------------------------------- */
/* §3 — O prompt                                                               */
/* -------------------------------------------------------------------------- */

function _aTexto(v) { return (v == null) ? '' : String(v).trim(); }

/**
 * O prompt que IDENTIFICA O GÊNERO — e o que ele não contém é a razão de ele
 * existir separado.
 *
 * Aqui não entra nenhuma pergunta do questionário, nenhum critério de
 * qualidade, nenhuma menção a nota, peso ou avaliação. A classificação acontece
 * numa CHAMADA PRÓPRIA, antes de qualquer julgamento, e o motivo é o mesmo que
 * mantém os pesos escondidos da avaliação: um modelo que já leu "existe trecho
 * removível?" começa a ler o conteúdo procurando defeito, e classifica sob essa
 * luz. Um causo lido com olhos de auditor vira "conteúdo repetitivo"; lido sem
 * agenda nenhuma, vira o que é — humor.
 *
 * Também não se pede justificativa, resumo nem confiança: só o rótulo. Cada
 * palavra a mais que o modelo escreve aqui é uma chance de ele se convencer de
 * uma classificação e arrastá-la.
 */
function buildGeneroPrompt(conteudo, embalagem) {
  const e = embalagem || {};
  const linhas = [];
  /* A instrução é POSITIVA e curta de propósito. A primeira versão listava o
   * que não fazer ("não avalie a qualidade, não dê nota, não aponte defeito") e
   * conseguia o oposto do que queria: para proibir, precisava nomear — e
   * nomear já põe as ideias de nota e defeito na frente de quem só deveria
   * dizer que tipo de coisa é aquilo. */
  linhas.push('Sua única tarefa é dizer QUE TIPO de conteúdo é este. Nada além disso.');
  linhas.push('');
  linhas.push('== OS GÊNEROS ==');
  AFER_GENEROS.forEach((g) => linhas.push(`${g.id}: ${g.desc}`));
  linhas.push('');
  linhas.push('== COMO ESCOLHER ==');
  linhas.push('Escolha pela INTENÇÃO PRINCIPAL do conteúdo — o que ele está tentando ser, não o assunto de que trata.');
  linhas.push('Uma história engraçada, um causo cômico ou um diálogo de piada são "humor", mesmo que contem um acontecimento.');
  linhas.push('Um relato de algo que aconteceu, sem a graça como objetivo, é "historia".');
  linhas.push('Se mais de um couber, escolha aquele que a pessoa perderia mais se fosse retirado.');
  linhas.push('Se nenhum couber bem, responda "geral".');
  linhas.push('');

  if (e.titulo || e.legenda) {
    linhas.push('== EMBALAGEM ==');
    if (e.titulo) linhas.push(`Título: ${e.titulo}`);
    if (e.legenda) linhas.push(`Legenda: ${e.legenda}`);
    linhas.push('');
  }

  linhas.push('== O CONTEÚDO ==');
  linhas.push(_aTexto(conteudo));
  linhas.push('');
  linhas.push('Devolva SOMENTE JSON, sem cercas e sem comentário:');
  linhas.push('{ "genero": "um dos ids acima" }');
  return linhas.join('\n');
}

/** O gênero que veio da IA, ou o padrão. Rótulo desconhecido não é chute: é
 *  ausência de identificação, e cai nas perguntas que valem para todos. */
function normalizarGenero(obj) {
  const bruto = _aTexto(obj && obj.genero).toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  return aferGenero(bruto) ? bruto : AFER_GENERO_PADRAO;
}

/**
 * O questionário como a IA o vê — e o que ela NÃO vê é a parte importante.
 *
 * Não vai peso, não vai pontuação, não vai qual resposta pontua, não vai
 * quantas rodadas existem nem que existe mais de uma. Se fosse, a separação
 * entre "quem observa" e "quem calcula" seria só uma história que o código
 * conta para si mesmo: um modelo que sabe que a pergunta vale 10 responde
 * diferente de um que acha que ela vale 3, e um que sabe que NÃO é a resposta
 * premiada tende a achar o motivo de responder NÃO.
 *
 * Também não vai nenhum pedido de nota, de resumo ou de opinião. A única coisa
 * que se pede é a observação.
 */
function buildAferPrompt(conteudo, embalagem, visual, questoes) {
  const qs = (questoes && questoes.length) ? questoes : AFER_QUESTOES;
  const e = embalagem || {};
  const linhas = [];

  linhas.push('Você examina um conteúdo e responde a um questionário objetivo. Você NÃO dá nota, NÃO resume e NÃO opina sobre qualidade geral — outra etapa cuida disso.');
  linhas.push('');
  linhas.push('== COMO RESPONDER ==');
  linhas.push('Cada pergunta admite exatamente duas respostas: "sim" ou "nao". Não existe "talvez", "parcialmente" nem "depende".');
  linhas.push('Responda pelo que ESTÁ no conteúdo, não pelo que ele poderia ser nem pelo que seria simpático dizer.');
  linhas.push('Antes de responder, procure o trecho que sustenta a resposta. Se você não acha o trecho, a resposta é a que descreve o conteúdo como ele está.');
  linhas.push('Algumas perguntas descrevem defeitos. Responder "sim" nelas não é ser severo, é constatar — e responder "nao" quando o defeito está lá atrapalha quem vai usar isto para corrigir o conteúdo.');
  linhas.push('Nenhuma pergunta vale mais que outra para você. Responda cada uma isoladamente.');
  linhas.push('');

  if (e.titulo || e.legenda) {
    linhas.push('== A EMBALAGEM (o que a pessoa vê ANTES de dar play) ==');
    if (e.titulo) linhas.push(`Título: ${e.titulo}`);
    if (e.legenda) linhas.push(`Legenda: ${e.legenda}`);
    linhas.push('');
  }

  linhas.push('== O QUE SE OUVE (transcrição ou roteiro) ==');
  linhas.push(_aTexto(conteudo));

  const v = _aTexto(visual);
  if (v) {
    linhas.push('');
    linhas.push('== O QUE SE VÊ (descrição visual) ==');
    linhas.push(v);
    linhas.push('');
    linhas.push('As duas seções acima são o MESMO conteúdo, por dois canais. Uma informação pode estar inteira na imagem sem ninguém dizer uma palavra sobre ela — e continua entregue.');
  }

  linhas.push('');
  linhas.push('== O QUESTIONÁRIO ==');
  qs.forEach((q) => linhas.push(`${q.id}: ${q.pergunta}`));

  linhas.push('');
  linhas.push('Devolva SOMENTE JSON, sem cercas e sem comentário:');
  linhas.push('{');
  linhas.push('  "respostas": [');
  qs.slice(0, 2).forEach((q, i) => {
    linhas.push(`    { "id": "${q.id}", "resposta": "sim" }${i === 0 ? ',' : ','}`);
  });
  linhas.push('    ... uma entrada para CADA pergunta acima');
  linhas.push('  ]');
  linhas.push('}');
  return linhas.join('\n');
}

/* -------------------------------------------------------------------------- */
/* §4 — Normalização de uma rodada                                             */
/* -------------------------------------------------------------------------- */

/* O que o modelo devolve não é confiável por construção: pode vir "Sim", "SIM",
 * "sim.", "true", um id que não existe, uma pergunta faltando ou uma resposta
 * que não é nenhuma das duas. Nada disso pode derrubar a aferição — e nada
 * disso pode ser CHUTADO para o lado bom, porque chutar é exatamente a
 * subjetividade que a ferramenta existe para tirar do caminho.
 *
 * Resposta que não é reconhecível vira ausência: aquela rodada não votou
 * naquela pergunta. A consolidação lida com isso contando só quem votou. */
function _aResposta(v) {
  const s = _aTexto(v).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
  if (s === 'sim' || s === 's' || s === 'true' || s === 'yes') return 'sim';
  if (s === 'nao' || s === 'n' || s === 'false' || s === 'no') return 'nao';
  return null;
}

/** Uma rodada → Map(id → 'sim'|'nao'). Ids desconhecidos e lixo saem fora. */
function normalizarRodada(obj, questoes) {
  const qs = (questoes && questoes.length) ? questoes : AFER_QUESTOES;
  const validos = new Set(qs.map((q) => q.id));
  const out = new Map();
  const lista = obj && Array.isArray(obj.respostas) ? obj.respostas : [];
  lista.forEach((r) => {
    if (!r) return;
    const id = _aTexto(r.id);
    if (!validos.has(id) || out.has(id)) return;   // primeira vale; repetição é ruído
    const resp = _aResposta(r.resposta);
    if (resp) out.set(id, resp);
  });
  return out;
}

/* -------------------------------------------------------------------------- */
/* §5 — Consolidação: várias rodadas viram uma resposta                        */
/* -------------------------------------------------------------------------- */

/**
 * Junta as rodadas e decide cada pergunta pela resposta predominante.
 *
 * O CONSENSO É GUARDADO, e não é enfeite. Cinco rodadas concordando e três
 * contra duas produzem a MESMA resposta consolidada — e não são a mesma coisa.
 * A primeira é uma observação firme; a segunda é a ferramenta dizendo, sem
 * disfarce, que aquela pergunta ficou no fio. Quem vai usar isso para decidir
 * o que corrigir merece saber a diferença, e a tela mostra.
 *
 * EMPATE. Não deveria acontecer — as rodadas são ímpares — mas acontece quando
 * uma chamada falha ou quando uma rodada devolve lixo naquela pergunta e some
 * da contagem. A regra é conservadora e fixa: empate NÃO pontua. Dar o ponto
 * numa moeda ao ar seria fabricar meio acerto, e a nota deixaria de ser
 * reproduzível — que é a única coisa que esta ferramenta promete.
 */
function consolidarRespostas(rodadas, questoes) {
  const qs = (questoes && questoes.length) ? questoes : AFER_QUESTOES;
  const mapas = (rodadas || []).filter((m) => m && typeof m.get === 'function');

  return qs.map((q) => {
    const votos = mapas.map((m) => m.get(q.id)).filter(Boolean);
    const sim = votos.filter((v) => v === 'sim').length;
    const nao = votos.length - sim;

    let resposta = null;
    if (sim > nao) resposta = 'sim';
    else if (nao > sim) resposta = 'nao';
    else if (votos.length) resposta = (q.bom === 'sim' ? 'nao' : 'sim');  // empate não pontua

    return {
      id: q.id, bloco: q.bloco, pergunta: q.pergunta, peso: q.peso, bom: q.bom,
      resposta, sim, nao, votos: votos.length, empate: votos.length > 0 && sim === nao,
      // 1 = todas as rodadas concordaram; 0,6 = três contra duas.
      consenso: votos.length ? Math.max(sim, nao) / votos.length : 0,
      acertou: resposta != null && resposta === q.bom,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* §6 — O cálculo: determinístico, fora da IA                                  */
/* -------------------------------------------------------------------------- */

/* AS FAIXAS, na escala de −100 a +100. Elas dão nome ao número, não decidem
 * nada — quem decide é a lista de onde a nota foi embora, logo abaixo dela.
 *
 * Os cortes são os antigos (85 / 70 / 50 numa escala de 0 a 100) convertidos
 * pela mesma reta que converte a nota: `2n − 100`. Assim a mudança de escala
 * não reclassificou nenhum conteúdo por acidente — o que era "Bom" continua
 * "Bom". ZERO é o ponto de equilíbrio: metade do peso passou, metade não. */
const AFER_FAIXAS = [
  { min: 70, id: 'alto', label: 'Alto', resumo: 'Ganha muito mais do que perde no que foi verificado.' },
  { min: 40, id: 'bom', label: 'Bom', resumo: 'Saldo positivo, com pontos identificados para corrigir.' },
  { min: 0, id: 'medio', label: 'Médio', resumo: 'O que passa e o que não passa quase se anulam.' },
  { min: -100, id: 'baixo', label: 'Baixo', resumo: 'Perde mais pontos do que ganha.' },
];

function aferFaixa(nota) {
  return AFER_FAIXAS.find((f) => nota >= f.min) || AFER_FAIXAS[AFER_FAIXAS.length - 1];
}

/**
 * A conta, e ela cabe numa linha: peso dos acertos sobre peso do que se
 * aplicava, vezes cem.
 *
 * O DIVISOR É O QUE SE APLICAVA, não o questionário inteiro. Sem título nem
 * legenda, as duas perguntas de embalagem não entram em lugar nenhum — nem no
 * numerador, nem no divisor. Somá-las ao divisor e nunca ao numerador seria
 * descontar dez pontos de quem ainda não escreveu o título, o que faz a nota
 * medir o preenchimento do formulário em vez do conteúdo.
 *
 * Uma pergunta sem voto nenhum (todas as rodadas falharam nela) também sai do
 * divisor pelo mesmo motivo: não foi verificada, então não pode custar pontos.
 */
function calcularAfericao(consolidado, opcoes) {
  const o = opcoes || {};
  const itens = (consolidado || []).filter((q) => q.votos > 0);

  /* CADA QUESITO SOMA OU SUBTRAI — nunca fica neutro.
   *
   * A resposta que pontua ACRESCENTA o peso; a que não pontua SUBTRAI o mesmo
   * peso. Quem decide o sinal é a polaridade da pergunta, não a palavra da
   * resposta: numa pergunta de defeito ("existe trecho removível?") o NÃO é
   * que soma, e o SIM é que tira.
   *
   * A versão anterior deixava de somar em vez de subtrair. As duas escalas são
   * a mesma reta (`saldo/total = 2·(ganho/total) − 1`) e ordenam os conteúdos
   * igual, mas não se leem igual, e é a leitura que decide se o autor refaz o
   * vídeo: um conteúdo que passa em metade do peso marcava 50 — que parece
   * "meio bom" — e agora marca 0, que é o que ele é: o que ganha e o que
   * perde se anulam. */
  const pesoTotal = itens.reduce((acc, q) => acc + q.peso, 0);
  const pesoGanho = itens.reduce((acc, q) => acc + (q.acertou ? q.peso : 0), 0);
  const pesoPerdido = pesoTotal - pesoGanho;
  const saldo = pesoGanho - pesoPerdido;
  // De −100 a +100. Normalizado pelo peso APLICÁVEL, para que a nota de um
  // conteúdo sem título continue comparável com a de um que tem.
  const nota = pesoTotal ? Math.round((saldo / pesoTotal) * 100) : 0;

  /* ONDE A NOTA FOI EMBORA — os quesitos que não passaram, do mais caro para o
   * mais barato. É a resposta a "o que eu conserto primeiro", e ela sai da
   * mesma conta que produziu a nota: nada de prioridade inventada à parte. */
  const perdidos = itens.filter((q) => !q.acertou)
    .slice().sort((a, b) => b.peso - a.peso || a.id.localeCompare(b.id));

  /* ONDE AS RODADAS DISCORDARAM. Consenso incompleto não muda a resposta, mas
   * muda o quanto se pode confiar nela — e some se ninguém mostrar. */
  const divergentes = itens.filter((q) => q.consenso < 1)
    .slice().sort((a, b) => a.consenso - b.consenso || b.peso - a.peso);

  // Cada bloco na MESMA escala da nota geral, pela mesma conta — senão a barra
  // de um bloco diria uma coisa e o número do topo diria outra.
  const porBloco = AFER_BLOCOS.map((b) => {
    const doBloco = itens.filter((q) => q.bloco === b.id);
    if (!doBloco.length) return { ...b, nota: null, peso: 0, questoes: [] };
    const p = doBloco.reduce((acc, q) => acc + q.peso, 0);
    const g = doBloco.reduce((acc, q) => acc + (q.acertou ? q.peso : 0), 0);
    return { ...b, nota: Math.round(((g - (p - g)) / p) * 100), peso: p,
      ganho: g, perdido: p - g, questoes: doBloco.map((q) => q.id) };
  });

  return {
    nota, faixa: aferFaixa(nota),
    saldo, pesoGanho, pesoPerdido, pesoTotal,
    questoes: consolidado || [], avaliadas: itens,
    perdidos, divergentes, porBloco,
    rodadas: o.rodadas || 0,
    // Consenso médio da aferição inteira: o quanto as rodadas concordaram.
    consensoMedio: itens.length
      ? Math.round((itens.reduce((acc, q) => acc + q.consenso, 0) / itens.length) * 100) : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* §7 — O pipeline                                                             */
/* -------------------------------------------------------------------------- */

function _aLimpar(texto) {
  let t = String(texto == null ? '' : texto).trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  return (typeof cleanText === 'function') ? cleanText(t).trim() : t.trim();
}

/**
 * Identifica o gênero, escolhe a régua e roda o questionário N vezes.
 *
 *   conteúdo → gênero (chamada isolada) → questionário do gênero → N leituras → conta
 *
 * A PRIMEIRA ETAPA É SEPARADA DE PROPÓSITO. Quem classifica não vê pergunta de
 * avaliação nenhuma; quem avalia já recebe a régua escolhida. Misturar as duas
 * numa chamada só economizaria uma requisição e devolveria a classificação
 * enviesada pelos critérios — que é como um causo de humor virava "conteúdo
 * repetitivo" e reprovava por isso.
 *
 * As rodadas de avaliação são independentes e IDÊNTICAS: mesmo prompt, mesmo
 * conteúdo. A variação vem da amostragem do modelo, e é justamente ela que se
 * quer medir — mudar o prompt entre as rodadas mediria o prompt, não o
 * conteúdo.
 *
 * Uma rodada que falha não derruba a aferição: as outras continuam e o divisor
 * se ajusta. Todas falharem, aí sim é erro — uma nota tirada de zero
 * observação não é uma nota.
 *
 * @param {object} opts
 *   conteudo, visual, embalagem {titulo, legenda}
 *   rodadas    3, 5 ou 7 (padrão 5)
 *   call(prompt)  chamada de IA — injetável; é o que torna a aferição testável
 *   onEtapa(chave, titulo, desc)
 */
async function runAfericaoPipeline(opts) {
  const o = opts || {};
  const chamar = o.call || (typeof callLLM === 'function' ? callLLM : null);
  if (!chamar) throw new Error('Sem função de chamada de IA.');
  const conteudo = _aLimpar(o.conteudo);
  if (!conteudo) throw new Error('Não há conteúdo para aferir.');

  const embalagem = o.embalagem || {};
  const visual = _aTexto(o.visual);
  const n = aferRodadas(o.rodadas);
  const etapa = (k, t, d) => { if (typeof o.onEtapa === 'function') o.onEtapa(k, t, d); };
  const lerJSON = (r) => (typeof extractJSON === 'function' ? extractJSON(r && r.content) : null);

  /* ETAPA 1 — QUE TIPO DE CONTEÚDO É ESTE?
   *
   * Chamada própria, com prompt próprio, ANTES de qualquer avaliação. A ordem
   * não é detalhe de implementação: é o que impede a classificação de nascer
   * contaminada pelos critérios de qualidade. Ver `buildGeneroPrompt`.
   *
   * Falhar aqui NÃO derruba a aferição. Sem gênero, valem as perguntas que
   * servem a qualquer conteúdo — menos preciso, e honesto quanto a isso. */
  etapa('genero', 'Vendo que tipo de conteúdo é este…',
    'Uma leitura separada, antes de qualquer avaliação.');
  let genero = AFER_GENERO_PADRAO;
  try {
    const rg = await chamar(buildGeneroPrompt(conteudo, embalagem));
    genero = normalizarGenero(lerJSON(rg));
  } catch (_) { /* segue no conjunto geral */ }

  /* ETAPA 2 — a avaliação, com a régua do gênero. */
  const questoes = aferQuestoesAplicaveis({ embalagem, genero });
  const prompt = buildAferPrompt(conteudo, embalagem, visual, questoes);

  etapa('rodadas', 'Lendo o conteúdo…',
    `${n} leituras independentes de ${questoes.length} perguntas.`);

  let modelo = '';
  let falhas = 0;
  const rodadas = await Promise.all(Array.from({ length: n }, async () => {
    try {
      const r = await chamar(prompt);
      if (r && r.model) modelo = r.model;
      return normalizarRodada(lerJSON(r), questoes);
    } catch (_) {
      falhas++;
      return null;
    }
  }));

  const validas = rodadas.filter(Boolean);
  if (!validas.length) throw new Error('Nenhuma das leituras respondeu — verifique a chave e o modelo.');

  etapa('calculo', 'Fechando a resposta…', 'A conta é do código, não um juízo da IA.');
  const consolidado = consolidarRespostas(validas, questoes);
  const resultado = calcularAfericao(consolidado, { rodadas: validas.length });
  // O gênero viaja DENTRO do resultado: a tela mostra sob que régua o conteúdo
  // foi lido, e a aferição guardada continua explicável meses depois.
  resultado.genero = genero;

  etapa('pronto', 'Pronto.', `${resultado.nota}/100 · ${resultado.faixa.label}`);
  return {
    conteudo, visual, embalagem, genero,
    rodadasPedidas: n, rodadasValidas: validas.length, falhas,
    questoes, resultado, model: modelo,
  };
}
