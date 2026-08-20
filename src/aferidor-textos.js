'use strict';
/* ============================================================================
 * AFERIDOR — a língua
 *
 * O motor calcula. Este arquivo FALA. São duas responsabilidades diferentes e
 * agora moram em lugares diferentes: `aferidor-motor.js` não sabe conversar com
 * ninguém, e nada aqui altera um número sequer.
 *
 * POR QUE ISTO EXISTE. O questionário é escrito para ser RESPONDIDO por uma IA,
 * e perguntas boas de auditoria são péssimas de ler: "Nos primeiros segundos já
 * acontece alguma coisa concreta — um fato, uma ação, uma afirmação específica
 * — em vez de saudação, apresentação ou anúncio do que virá?". Quem acabou de
 * gravar um vídeo não quer uma pergunta: quer saber o que cortar. A tela
 * mostrava a pergunta e deixava a tradução por conta do usuário.
 *
 * Então cada pergunta ganha duas frases suas:
 *
 *   `conserto` — o que FAZER, quando o conteúdo não passou. Imperativo, curto,
 *                acionável sem reler a pergunta.
 *   `forte`    — o que ESTÁ BOM, quando passou. Existe porque uma ferramenta
 *                que só devolve defeito ensina o autor a não abri-la.
 *
 * REGRA DE OURO: a frase não pode mentir sobre a resposta. `conserto` descreve
 * o conteúdo como ele está, e `forte` descreve o que ele já faz — nunca o
 * contrário, nunca ameno demais para o defeito que a resposta constatou.
 *
 * Uma pergunta nova no motor sem entrada aqui não quebra a tela (o `aferFala`
 * cai na pergunta original), mas o teste reprova — o cinto existe para o caso
 * raro, não para virar o costume.
 * ========================================================================== */

/* A RESPOSTA — POSTA OU NÃO POSTA.
 *
 * É a única coisa que o autor precisa saber ao terminar de aferir, e a tela
 * demorou três versões para dizê-la: primeiro devolvia a conta, depois um
 * veredito com a nota e duas listas ao lado. Tudo informação verdadeira que
 * ninguém pediu — quem acabou de gravar não quer analisar métrica, quer que a
 * ferramenta analise por ele e responda.
 *
 * ONDE FICA O CORTE. Nas duas faixas de cima do motor (nota 40 ou mais): são as
 * que descrevem um conteúdo que ganha claramente mais do que perde. "Médio", no
 * motor, é o ponto em que o que passa e o que não passa quase se anulam — isso
 * não é conteúdo pronto, é conteúdo em cima do muro, e devolver "poste" ali
 * seria a ferramenta empurrando a dúvida de volta para o autor.
 *
 * O corte sai da faixa, não de um número solto aqui: mudar a régua continua
 * sendo mudar `AFER_FAIXAS` no motor, num lugar só. */
const AFER_FAIXAS_QUE_POSTAM = ['alto', 'bom'];

/* As duas respostas possíveis. O selo é a palavra que o autor lê de longe; o
 * título diz a mesma coisa por extenso, para a tela não depender só do selo. */
const AFER_RECOMENDACAO = {
  postar: { selo: 'POSTE', titulo: 'Este conteúdo é bom para publicar.' },
  esperar: { selo: 'NÃO POSTE', titulo: 'Este conteúdo ainda não está pronto.' },
};

/* Quantos pontos entram no motivo. Três é o que cabe numa frase que ainda se lê
 * de uma vez — com cinco vira lista disfarçada de frase, que é o formato do
 * qual esta tela está justamente saindo. */
const AFER_PONTOS_NO_MOTIVO = 3;

/* AS DUAS FRASES DE CADA PERGUNTA.
 *
 * A ordem segue a do questionário no motor, para conferir de um lado ao outro
 * sem procurar. O `id` é o mesmo — é o que costura os dois arquivos. */
/* AS QUATRO FRASES DE CADA PERGUNTA.
 *
 * `conserto` e `forte` são frases inteiras, para serem lidas sozinhas numa
 * lista. `curto` e `curtoBom` são PEDAÇOS DE ORAÇÃO, feitos para entrar no meio
 * de uma frase maior — o motivo do card encaixa três deles seguidos ("ele
 * começa com saudação, repete informação e não entrega nada no fim").
 *
 * Daí a forma deles: verbo na terceira pessoa, sem ponto final, sem maiúscula
 * inicial, e curtos o bastante para três caberem numa linha que ainda se lê de
 * uma vez. Um `curto` escrito como frase completa quebra a costura e o defeito
 * só aparece na tela, nunca no teste. */
const AFER_FALA = {
  /* ---- Abertura ---- */
  abre_no_fato: {
    conserto: 'Comece pelo fato. Corte tudo que vem antes da primeira coisa que acontece de verdade.',
    forte: 'A abertura já entra numa coisa concreta.',
    curto: 'demora a entrar no assunto',
    curtoBom: 'abre num fato concreto',
  },
  sem_preambulo: {
    conserto: 'Tire a saudação e a apresentação do canal do começo — quem está assistindo já sabe onde chegou.',
    forte: 'Não gasta os primeiros segundos com saudação.',
    curto: 'começa com saudação',
    curtoBom: 'vai direto ao ponto',
  },
  assunto_claro: {
    conserto: 'Diga do que se trata logo no começo, sem depender do título para isso.',
    forte: 'Dá para saber do que se trata logo de cara.',
    curto: 'não deixa claro do que trata',
    curtoBom: 'deixa claro do que trata',
  },

  /* ---- Curiosidade e progressão ---- */
  pergunta_aberta: {
    conserto: 'Deixe uma pergunta no ar logo no início — alguma coisa que só o resto do conteúdo responde.',
    forte: 'Abre uma pergunta que segura a pessoa até a resposta.',
    curto: 'não desperta curiosidade',
    curtoBom: 'desperta curiosidade logo no começo',
  },
  previsivel: {
    conserto: 'Dá para adivinhar o final antes da metade. Guarde alguma virada para depois disso.',
    forte: 'Não dá para adivinhar como termina.',
    curto: 'deixa adivinhar o final cedo demais',
    curtoBom: 'não deixa adivinhar o final',
  },
  progride: {
    conserto: 'Tem parte que não acrescenta nada ao que já foi dito. Cada trecho precisa trazer informação nova.',
    forte: 'Cada parte acrescenta alguma coisa nova.',
    curto: 'tem parte que não acrescenta nada',
    curtoBom: 'avança sem enrolar',
  },
  causalidade: {
    conserto: 'Os acontecimentos apenas se sucedem. Ligue um ao outro: isto aconteceu PORQUE aquilo aconteceu.',
    forte: 'Uma coisa puxa a outra, não é só sequência.',
    curto: 'os fatos não se conectam',
    curtoBom: 'os fatos se puxam um ao outro',
  },

  /* ---- Trechos mortos ---- */
  repeticao: {
    conserto: 'Tem informação dita duas vezes, com outras palavras. Fique com a versão melhor e corte a outra.',
    forte: 'Não repete informação.',
    curto: 'repete informação',
    curtoBom: 'não repete informação',
  },
  trecho_cortavel: {
    conserto: 'Tem trecho que sai inteiro sem o conteúdo perder nada. Tire.',
    forte: 'Não sobra trecho para cortar.',
    curto: 'tem trecho sobrando',
    curtoBom: 'não tem trecho sobrando',
  },
  explicacao_longa: {
    conserto: 'Alguma explicação se estende além do que era preciso para ser entendida. Encurte.',
    forte: 'As explicações param quando já se entendeu.',
    curto: 'explica mais do que precisa',
    curtoBom: 'explica na medida',
  },

  /* ---- Entrega e final ---- */
  entrega_algo: {
    conserto: 'Quem chega ao fim não leva nada. Garanta uma entrega concreta — uma informação, uma emoção, uma surpresa, uma graça.',
    forte: 'Quem assiste até o fim leva alguma coisa.',
    curto: 'não entrega nada no fim',
    curtoBom: 'entrega alguma coisa a quem assiste até o fim',
  },
  tem_conclusao: {
    conserto: 'O conteúdo para em vez de terminar. Feche com uma conclusão.',
    forte: 'Termina de verdade, com uma conclusão.',
    curto: 'termina sem conclusão',
    curtoBom: 'termina fechando a ideia',
  },
  promessa_cumprida: {
    conserto: 'O começo promete uma coisa que o fim não entrega. Ajuste um dos dois lados.',
    forte: 'Entrega o que o começo prometeu.',
    curto: 'não cumpre o que promete',
    curtoBom: 'cumpre o que promete',
  },
  final_responde: {
    conserto: 'O final não responde à pergunta que o começo abriu. Feche esse ciclo.',
    forte: 'O final responde ao que o começo abriu.',
    curto: 'o final não fecha o que o começo abriu',
    curtoBom: 'o final responde ao começo',
  },

  /* ---- Naturalidade ---- */
  soa_falado: {
    conserto: 'O texto soa escrito, não falado. Leia em voz alta e reescreva o que travar na língua.',
    forte: 'Soa como gente falando.',
    curto: 'soa escrito, não falado',
    curtoBom: 'soa como gente falando',
  },
  frase_de_ia: {
    conserto: 'Aparece frase com cara de texto gerado ("vamos mergulhar", "é importante ressaltar"). Troque por palavra sua.',
    forte: 'Sem frase com cara de texto gerado.',
    curto: 'tem frase com cara de texto gerado',
    curtoBom: 'não soa gerado por IA',
  },

  /* ---- Distribuição ---- */
  motivo_compartilhar: {
    conserto: 'Falta o motivo do "olha isso". Dê à pessoa uma razão concreta para mandar o conteúdo a alguém.',
    forte: 'Tem motivo para alguém mandar a outra pessoa.',
    curto: 'não dá vontade de mandar para alguém',
    curtoBom: 'dá vontade de mandar para alguém',
  },
  provoca_reacao: {
    conserto: 'Não há com o que concordar nem discordar. Tome uma posição.',
    forte: 'Toma posição — dá para reagir.',
    curto: 'não toma posição nenhuma',
    curtoBom: 'toma posição',
  },
  cta_artificial: {
    conserto: 'Tire o pedido de like, inscrição ou comentário: ele cobra antes de o conteúdo ter entregado.',
    forte: 'Não pede like nem inscrição.',
    curto: 'pede like e inscrição',
    curtoBom: 'não fica pedindo like',
  },

  /* ---- Embalagem ---- */
  titulo_promete: {
    conserto: 'O título está vago. Prometa uma coisa específica.',
    forte: 'O título promete alguma coisa específica.',
    curto: 'tem título vago',
    curtoBom: 'tem título que promete algo',
  },
  titulo_spoiler: {
    conserto: 'O título ou a legenda entrega o desfecho. Guarde o final para o conteúdo.',
    forte: 'A embalagem desperta sem entregar o final.',
    curto: 'entrega o final já no título',
    curtoBom: 'tem título que desperta sem entregar o final',
  },
};

/**
 * As frases de uma pergunta. Sem entrada no mapa, devolve a própria pergunta —
 * feio, porém verdadeiro, e melhor do que uma linha vazia na tela.
 */
function aferFala(q) {
  const f = AFER_FALA[q && q.id];
  if (f) return f;
  const p = (q && q.pergunta) ? String(q.pergunta) : '';
  return { conserto: p, forte: p };
}

/** O que fazer com este quesito, em uma frase. */
function aferConserto(q) { return aferFala(q).conserto; }

/** O que este quesito já faz bem, em uma frase. */
function aferForte(q) { return aferFala(q).forte; }

/** Junta pedaços numa enumeração em português: "a, b e c". */
function aferEnumerar(itens) {
  const l = (itens || []).filter(Boolean);
  if (l.length <= 1) return l[0] || '';
  return `${l.slice(0, -1).join(', ')} e ${l[l.length - 1]}`;
}

/**
 * POR QUE a recomendação é essa, numa frase que se lê de uma vez.
 *
 * A frase é montada dos MESMOS quesitos que decidiram a nota, na mesma ordem de
 * peso — o motivo não é um texto simpático colado depois da conta, é a conta
 * dita em palavras. Quem posta ouve o que sustenta o conteúdo; quem não posta
 * ouve o que o derruba, que é o que ele vai consertar.
 *
 * O SILÊNCIO TEM DE SER TRATADO. Um conteúdo que passa em tudo não tem defeito
 * a citar, e um que erra tudo não tem acerto — nos dois casos a enumeração
 * viria vazia e a frase sairia truncada.
 */
function aferMotivo(res) {
  const r = res || {};
  const postar = aferPostar(r);
  const itens = r.avaliadas || [];
  const perdidos = r.perdidos || [];

  if (postar) {
    const ganhos = itens.filter((q) => q.acertou)
      .slice().sort((a, b) => b.peso - a.peso || a.id.localeCompare(b.id));
    const lista = aferEnumerar(ganhos.slice(0, AFER_PONTOS_NO_MOTIVO).map((q) => aferFala(q).curtoBom));
    const base = lista ? `Ele ${lista}.` : 'Ele passou em tudo que foi verificado.';
    if (!perdidos.length) return `${base} Não ficou nada pelo caminho.`;
    /* Um "poste" com pendência NOMEIA a pendência principal, em vez de resumi-la
     * como "uns pontos menores". Um conteúdo pode ser aprovado e ainda assim
     * falhar no quesito mais pesado do questionário — chamar isso de "menor"
     * seria a ferramenta amaciando o que ela mesma mediu, e o autor descobre a
     * diferença na hora em que o vídeo não segura ninguém até o fim. */
    return `${base} Dá para publicar assim — se quiser melhorar antes, o principal é que ele ${aferFala(perdidos[0]).curto}.`;
  }

  const lista = aferEnumerar(perdidos.slice(0, AFER_PONTOS_NO_MOTIVO).map((q) => aferFala(q).curto));
  const base = lista ? `Ele ${lista}.` : 'Ele não se sustenta no que foi verificado.';
  return `${base} Vale ajustar isso antes de publicar.`;
}

/** A régua: este resultado recomenda publicar? */
function aferPostar(res) {
  const id = ((res || {}).faixa || {}).id || '';
  return AFER_FAIXAS_QUE_POSTAM.indexOf(id) >= 0;
}

/**
 * A RESPOSTA INTEIRA, e é só isto que a tela precisa mostrar: postar ou não,
 * dito em uma palavra, uma linha e um porquê.
 */
function aferRecomendacao(res) {
  const postar = aferPostar(res);
  const base = postar ? AFER_RECOMENDACAO.postar : AFER_RECOMENDACAO.esperar;
  return { postar, selo: base.selo, titulo: base.titulo, motivo: aferMotivo(res) };
}
