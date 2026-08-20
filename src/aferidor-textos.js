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

/* O VEREDITO — a primeira coisa que se lê, e por muito tempo a única que se lia
 * errado. "Bom · Saldo positivo, com pontos identificados para corrigir" é
 * contabilidade: descreve a NOTA, não o conteúdo, e não responde à pergunta que
 * o autor tem na cabeça, que é sempre a mesma — dá para publicar?
 *
 * Cada faixa responde a essa pergunta em duas partes: o veredito e o porquê. Os
 * cortes continuam sendo os do motor; aqui só se dá nome ao que eles querem
 * dizer para quem vai decidir se refaz o vídeo. */
const AFER_VEREDITO = {
  alto: {
    titulo: 'Pode publicar',
    frase: 'O conteúdo se sustenta do começo ao fim.',
    frasePerfeita: 'Passou em tudo que foi verificado.',
  },
  bom: {
    titulo: 'Dá para publicar, com uns ajustes',
    frase: 'A base está de pé. O que ainda pesa contra está logo abaixo.',
    frasePerfeita: 'Passou em tudo que foi verificado.',
  },
  medio: {
    titulo: 'Vale uma revisão antes de publicar',
    frase: 'O que funciona e o que atrapalha estão quase empatados — mexer nos pontos abaixo muda o resultado.',
    frasePerfeita: 'Passou em tudo que foi verificado.',
  },
  baixo: {
    titulo: 'Melhor mexer antes de publicar',
    frase: 'São vários pontos contra ao mesmo tempo. Comece pelo primeiro da lista.',
    frasePerfeita: 'Passou em tudo que foi verificado.',
  },
};

/* AS DUAS FRASES DE CADA PERGUNTA.
 *
 * A ordem segue a do questionário no motor, para conferir de um lado ao outro
 * sem procurar. O `id` é o mesmo — é o que costura os dois arquivos. */
const AFER_FALA = {
  /* ---- Abertura ---- */
  abre_no_fato: {
    conserto: 'Comece pelo fato. Corte tudo que vem antes da primeira coisa que acontece de verdade.',
    forte: 'A abertura já entra numa coisa concreta.',
  },
  sem_preambulo: {
    conserto: 'Tire a saudação e a apresentação do canal do começo — quem está assistindo já sabe onde chegou.',
    forte: 'Não gasta os primeiros segundos com saudação.',
  },
  assunto_claro: {
    conserto: 'Diga do que se trata logo no começo, sem depender do título para isso.',
    forte: 'Dá para saber do que se trata logo de cara.',
  },

  /* ---- Curiosidade e progressão ---- */
  pergunta_aberta: {
    conserto: 'Deixe uma pergunta no ar logo no início — alguma coisa que só o resto do conteúdo responde.',
    forte: 'Abre uma pergunta que segura a pessoa até a resposta.',
  },
  previsivel: {
    conserto: 'Dá para adivinhar o final antes da metade. Guarde alguma virada para depois disso.',
    forte: 'Não dá para adivinhar como termina.',
  },
  progride: {
    conserto: 'Tem parte que não acrescenta nada ao que já foi dito. Cada trecho precisa trazer informação nova.',
    forte: 'Cada parte acrescenta alguma coisa nova.',
  },
  causalidade: {
    conserto: 'Os acontecimentos apenas se sucedem. Ligue um ao outro: isto aconteceu PORQUE aquilo aconteceu.',
    forte: 'Uma coisa puxa a outra, não é só sequência.',
  },

  /* ---- Trechos mortos ---- */
  repeticao: {
    conserto: 'Tem informação dita duas vezes, com outras palavras. Fique com a versão melhor e corte a outra.',
    forte: 'Não repete informação.',
  },
  trecho_cortavel: {
    conserto: 'Tem trecho que sai inteiro sem o conteúdo perder nada. Tire.',
    forte: 'Não sobra trecho para cortar.',
  },
  explicacao_longa: {
    conserto: 'Alguma explicação se estende além do que era preciso para ser entendida. Encurte.',
    forte: 'As explicações param quando já se entendeu.',
  },

  /* ---- Entrega e final ---- */
  entrega_algo: {
    conserto: 'Quem chega ao fim não leva nada. Garanta uma entrega concreta — uma informação, uma emoção, uma surpresa, uma graça.',
    forte: 'Quem assiste até o fim leva alguma coisa.',
  },
  tem_conclusao: {
    conserto: 'O conteúdo para em vez de terminar. Feche com uma conclusão.',
    forte: 'Termina de verdade, com uma conclusão.',
  },
  promessa_cumprida: {
    conserto: 'O começo promete uma coisa que o fim não entrega. Ajuste um dos dois lados.',
    forte: 'Entrega o que o começo prometeu.',
  },
  final_responde: {
    conserto: 'O final não responde à pergunta que o começo abriu. Feche esse ciclo.',
    forte: 'O final responde ao que o começo abriu.',
  },

  /* ---- Naturalidade ---- */
  soa_falado: {
    conserto: 'O texto soa escrito, não falado. Leia em voz alta e reescreva o que travar na língua.',
    forte: 'Soa como gente falando.',
  },
  frase_de_ia: {
    conserto: 'Aparece frase com cara de texto gerado ("vamos mergulhar", "é importante ressaltar"). Troque por palavra sua.',
    forte: 'Sem frase com cara de texto gerado.',
  },

  /* ---- Distribuição ---- */
  motivo_compartilhar: {
    conserto: 'Falta o motivo do "olha isso". Dê à pessoa uma razão concreta para mandar o conteúdo a alguém.',
    forte: 'Tem motivo para alguém mandar a outra pessoa.',
  },
  provoca_reacao: {
    conserto: 'Não há com o que concordar nem discordar. Tome uma posição.',
    forte: 'Toma posição — dá para reagir.',
  },
  cta_artificial: {
    conserto: 'Tire o pedido de like, inscrição ou comentário: ele cobra antes de o conteúdo ter entregado.',
    forte: 'Não pede like nem inscrição.',
  },

  /* ---- Embalagem ---- */
  titulo_promete: {
    conserto: 'O título está vago. Prometa uma coisa específica.',
    forte: 'O título promete alguma coisa específica.',
  },
  titulo_spoiler: {
    conserto: 'O título ou a legenda entrega o desfecho. Guarde o final para o conteúdo.',
    forte: 'A embalagem desperta sem entregar o final.',
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

/**
 * O veredito de um resultado: título e frase, em português corrente.
 *
 * Quando nada ficou pelo caminho, a frase muda — dizer "o que ainda pesa contra
 * está logo abaixo" embaixo de uma lista vazia é a tela contradizendo a si
 * mesma, e foi assim que a versão anterior tratava o conteúdo perfeito.
 */
function aferVeredito(res) {
  const r = res || {};
  const id = (r.faixa || {}).id || 'medio';
  const v = AFER_VEREDITO[id] || AFER_VEREDITO.medio;
  const limpo = !((r.perdidos || []).length);
  return { titulo: v.titulo, frase: limpo ? v.frasePerfeita : v.frase };
}
