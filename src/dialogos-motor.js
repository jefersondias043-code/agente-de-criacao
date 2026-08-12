'use strict';
/* ============================================================================
 * DIÁLOGOS NATURAIS — o segundo modo da mesa
 *
 * Mesmo motor do Causos: concepção em quatro caminhos, dossiê, escrita,
 * críticos independentes, juiz de código, reescrita só do que reprovou. O que
 * muda é a CABEÇA — a doutrina, os gêneros, as dimensões e o que a conta mede.
 *
 * O Causos não é tocado por nada daqui. Este arquivo só acrescenta; o outro
 * segue como estava, e há teste de assinatura provando byte a byte
 * (test/causos-intocado.test.js).
 *
 * ---------------------------------------------------------------------------
 * O QUE TORNA UM DIÁLOGO FALSO, que é o que este modo existe para evitar
 *
 * Diálogo escrito por IA falha sempre pelos mesmos lugares, e nenhum deles é
 * "escreveu mal":
 *
 *   1. TODO MUNDO FALA IGUAL. Duas pessoas, um vocabulário só. Se você tapar as
 *      etiquetas de quem fala, não dá para saber quem é quem.
 *   2. NINGUÉM ATRAPALHA NINGUÉM. Turnos do mesmo tamanho, um de cada vez, cada
 *      um esperando educadamente o outro terminar. Conversa de verdade tem
 *      "ahn?", "não", "peraí", tem gente cortando e gente falando junto.
 *   3. AS PESSOAS EXPLICAM O QUE JÁ SABEM. "Como você sabe, João, desde que
 *      nossa mãe morreu em 2019…" — ninguém fala assim com quem já estava lá.
 *      É informação escrita para o público, na boca de quem não teria por quê.
 *   4. TODO MUNDO RESPONDE À PERGUNTA. Na vida real a pessoa desconversa,
 *      responde outra coisa, devolve outra pergunta, ou não responde.
 *   5. NARRADOR VAZANDO. "— Sei lá, disse ele, coçando a cabeça." Rubrica e
 *      verbo de fala transformam conversa em roteiro; o pedido é ouvir gente
 *      conversando, não ler a descrição de uma conversa.
 *
 * A doutrina pede; a CONTA mede o que dá para medir — turno curto, monopólio,
 * vozes idênticas, narração vazada. É a mesma divisão de trabalho do Causos, e
 * é ela que impede a IA de aprovar o próprio texto.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* §1 — Gêneros: de quem é a conversa                                          */
/* -------------------------------------------------------------------------- */

/* Como no Causos, o usuário não escolhe: o gênero sai da própria etapa de
 * concepção, a partir da ideia que ele escreveu. Uma ideia como "dois amigos
 * discutindo quem paga a conta" já diz de quem é a conversa. */
const DIALOGO_GENEROS = [
  {
    id: 'amigos', label: 'Entre amigos',
    ctx: 'Intimidade velha: eles se interrompem, se xingam com carinho, retomam piada de anos atrás sem explicar. Ninguém precisa ser educado. O que está em jogo costuma ser pequeno e tratado como enorme.',
    especialista: 'humor',
  },
  {
    id: 'familia', label: 'Em família',
    ctx: 'A conversa nunca é só sobre o assunto: por baixo dela corre uma cobrança antiga que ninguém nomeia. Mãe, pai, filho, irmão — gente que sabe exatamente onde dói e escolhe se aperta ou não.',
    especialista: 'subtexto',
  },
  {
    id: 'casal', label: 'Casal',
    ctx: 'Duas pessoas que falam por atalho — meia frase basta. A briga raramente é sobre o que parece ser, e o carinho aparece no jeito, não na palavra.',
    especialista: 'subtexto',
  },
  {
    id: 'trabalho', label: 'No trabalho',
    ctx: 'Cada um tem um papel e uma coisa a esconder. A cordialidade é uma camada fina: o que interessa está no que não se diz na frente de quem manda.',
    especialista: 'subtexto',
  },
  {
    id: 'desconhecidos', label: 'Entre desconhecidos',
    ctx: 'Fila, ônibus, sala de espera, balcão de bar. Não há história em comum, então tudo é negociado ali: quem puxa assunto, quanto se conta, quando se corta. A graça está no desencontro.',
    especialista: 'humor',
  },
  {
    id: 'vizinhos', label: 'Vizinhança',
    ctx: 'Convivência forçada: precisam se dar bem porque moram um do lado do outro, e é isso que segura o que qualquer um dos dois gostaria de dizer.',
    especialista: 'humor',
  },
];

function dialogoGenero(id) {
  return DIALOGO_GENEROS.find((g) => g.id === id) || DIALOGO_GENEROS[0];
}

/* As dimensões deste modo. `minimo` funciona igual ao do Causos: abaixo dele a
 * conversa inteira reprova, por melhor que esteja o resto.
 *
 * NATURALIDADE tem o mínimo mais alto (8) porque é a coisa que o usuário pediu:
 * "transmitir a sensação de que estamos realmente ouvindo pessoas conversando".
 * Uma conversa correta e sem vida falhou no que importa. */
const DIALOGO_DIMENSOES = [
  { id: 'naturalidade', pergunta: 'Parece gente falando, ou parece texto escrito para ser lido?', minimo: 8 },
  { id: 'vozes', pergunta: 'Tapando as etiquetas, dá para saber quem está falando?', minimo: 7 },
  { id: 'escuta', pergunta: 'As falas respondem ao que veio antes, ou são monólogos em paralelo?', minimo: 7 },
  { id: 'dinamica', pergunta: 'Alguém interrompe, reage, desconversa, muda de assunto?', minimo: 7 },
  { id: 'subtexto', pergunta: 'Existe coisa dita por baixo, ou tudo está na superfície?', minimo: 6 },
  { id: 'assunto', pergunta: 'Há alguma coisa em jogo, por menor que seja?', minimo: 7 },
  { id: 'oralidade', pergunta: 'É a língua da boca, ou a da página?', minimo: 7 },
  { id: 'originalidade', pergunta: 'Já ouvi essa conversa em outro lugar?', minimo: 7 },
  { id: 'humor', pergunta: 'Tem graça — de rir ou de reconhecer?', minimo: 6 },
  { id: 'final', pergunta: 'A conversa termina, ou apenas para?', minimo: 6 },
  { id: 'brasilidade', pergunta: 'Soa brasileiro sem virar caricatura?', minimo: 7 },
];

function dialogoDimensao(id) {
  return DIALOGO_DIMENSOES.find((d) => d.id === id) || null;
}

/* Fixos em toda conversa; o especialista do gênero se soma. */
const DIALOGO_CRITICOS_FIXOS = ['ouvido', 'vozes', 'oralidade', 'originalidade'];

function dialogoCriticosDe(genero) {
  const g = dialogoGenero(genero);
  return [...new Set(DIALOGO_CRITICOS_FIXOS.concat([g.especialista]))];
}

/* -------------------------------------------------------------------------- */
/* §2 — Conferência medida: o que dá para contar sem opinião                   */
/* -------------------------------------------------------------------------- */

/* COMO UM TURNO É RECONHECIDO. Aceita as duas formas que a mesa produz:
 *     — Fala do travessão
 *     NOME: fala com etiqueta
 * Linha que não é nem uma nem outra é candidata a narração — ver adiante. */
const DIALOGO_RE_TRAVESSAO = /^\s*[—–-]\s*(.+)$/;
const DIALOGO_RE_ETIQUETA = /^\s*([A-ZÀ-Ý][\wÀ-ÿ .'-]{0,28}?)\s*:\s*(.+)$/;

/**
 * Fatia o texto em turnos. Devolve `{ turnos, soltas }`, em que `soltas` são as
 * linhas que não são fala de ninguém.
 */
function dialogoTurnos(texto) {
  const turnos = [];
  const soltas = [];
  String(texto || '').split(/\n+/).forEach((bruta) => {
    const linha = bruta.trim();
    if (!linha) return;
    const etiq = linha.match(DIALOGO_RE_ETIQUETA);
    if (etiq) { turnos.push({ quem: etiq[1].trim(), fala: etiq[2].trim(), marcado: true }); return; }
    const trav = linha.match(DIALOGO_RE_TRAVESSAO);
    if (trav) { turnos.push({ quem: '', fala: trav[1].trim(), marcado: false }); return; }
    soltas.push(linha);
  });
  return { turnos, soltas };
}

const DIALOGO_PALAVRAS = (t) => String(t || '').trim().split(/\s+/).filter(Boolean).length;

/* Verbo de fala com atribuição — o vazamento de narrador mais comum. Só conta
 * quando vem DEPOIS de vírgula ou travessão dentro da linha ("…, disse ele"),
 * porque "ele disse que vinha" é fala legítima de alguém contando um caso. */
const DIALOGO_RE_ATRIBUICAO =
  /[,—–]\s*(disse|falou|respondeu|perguntou|retrucou|murmurou|gritou|sussurrou|exclamou|indagou|completou|emendou)\b/i;

/* Rubrica de roteiro: (rindo), (pausa), [silêncio]. */
const DIALOGO_RE_RUBRICA = /[([][^)\]]{1,40}[)\]]/;

/**
 * NARRAÇÃO VAZANDO. O pedido é ouvir gente conversando; narrador transforma
 * isso em roteiro lido.
 *
 * Três coisas contam: linha que não é fala de ninguém, atribuição de fala
 * ("…, disse ele") e rubrica entre parênteses.
 */
function dialogoNarracao(texto) {
  const { turnos, soltas } = dialogoTurnos(texto);
  const problemas = [];
  const comAtribuicao = turnos.filter((t) => DIALOGO_RE_ATRIBUICAO.test(t.fala));
  const comRubrica = turnos.filter((t) => DIALOGO_RE_RUBRICA.test(t.fala));

  if (soltas.length) {
    problemas.push(`${soltas.length} linha(s) não são fala de ninguém — é narração no meio da conversa: "${soltas[0].slice(0, 60)}…". A conversa é só o que sai da boca das pessoas.`);
  }
  if (comAtribuicao.length) {
    problemas.push(`${comAtribuicao.length} fala(s) trazem verbo de dizer atribuído ("…, disse ele"). Quem está ouvindo não precisa disso — vira roteiro.`);
  }
  if (comRubrica.length) {
    problemas.push(`${comRubrica.length} fala(s) trazem rubrica entre parênteses. Se a emoção precisa de legenda, ela não está na fala.`);
  }
  return { problemas, soltas: soltas.length, atribuicoes: comAtribuicao.length, rubricas: comRubrica.length, ok: problemas.length === 0 };
}

/* Quanto da conversa uma só pessoa pode tomar antes de virar palestra. Conversa
 * real é desigual — 60/40 é comum, e cobrar meio a meio produziria o revezamento
 * educado que este modo existe para evitar. */
const DIALOGO_MAX_MONOPOLIO = 0.72;
const DIALOGO_MIN_TURNOS = 6;

/** MONOPÓLIO: um fala, o outro faz "hum-hum". */
function dialogoMonopolio(texto) {
  const { turnos } = dialogoTurnos(texto);
  const problemas = [];
  if (turnos.length < DIALOGO_MIN_TURNOS) {
    // Conversa curta demais não tem distribuição a medir. Dizer que passou
    // seria afirmar o que não foi medido.
    return { problemas, medido: false, ok: true };
  }
  const porQuem = new Map();
  turnos.forEach((t, i) => {
    // Sem etiqueta, o travessão alterna entre dois falantes — é a convenção.
    const quem = t.quem || (i % 2 === 0 ? '#1' : '#2');
    porQuem.set(quem, (porQuem.get(quem) || 0) + DIALOGO_PALAVRAS(t.fala));
  });
  const total = [...porQuem.values()].reduce((a, b) => a + b, 0);
  if (!total) return { problemas, medido: false, ok: true };
  let dono = '';
  let maior = 0;
  porQuem.forEach((n, quem) => { if (n > maior) { maior = n; dono = quem; } });
  const fatia = maior / total;
  if (porQuem.size > 1 && fatia > DIALOGO_MAX_MONOPOLIO) {
    problemas.push(`${dono} fala ${Math.round(fatia * 100)}% de tudo — os outros viraram plateia. Conversa é disputa pelo turno, não palestra com apartes.`);
  }
  return { problemas, medido: true, fatia, dono, ok: problemas.length === 0 };
}

/* Turno curto: a reação, o "ahn?", o "não". Uma conversa sem nenhum é uma
 * troca de parágrafos. Seis palavras é generoso — "sei lá, acho que não" tem
 * cinco. */
const DIALOGO_TURNO_CURTO = 6;
const DIALOGO_MIN_CURTOS = 0.15;

/** REVEZAMENTO EDUCADO: todos os turnos do mesmo tamanho, nenhum curto. */
function dialogoRitmo(texto) {
  const { turnos } = dialogoTurnos(texto);
  const problemas = [];
  if (turnos.length < DIALOGO_MIN_TURNOS) return { problemas, medido: false, ok: true };

  const tamanhos = turnos.map((t) => DIALOGO_PALAVRAS(t.fala));
  const curtos = tamanhos.filter((n) => n <= DIALOGO_TURNO_CURTO).length;
  const proporcao = curtos / tamanhos.length;
  if (proporcao < DIALOGO_MIN_CURTOS) {
    problemas.push(`nenhuma fala curta em ${tamanhos.length} turnos (a mais curta tem ${Math.min(...tamanhos)} palavras). Ninguém responde "ahn?", "sério?", "não" — todo mundo está fazendo discurso na vez.`);
  }
  return { problemas, medido: true, curtos, proporcao, minimo: Math.min(...tamanhos), ok: problemas.length === 0 };
}

/* TAMANHO DA CONVERSA (r235).
 *
 * O pedido foi feito sobre as histórias, mas a razão dele vale para os dois
 * modos: "o objetivo principal é criar conteúdo para plataformas de vídeos
 * curtos". Este modo só media turno — quantos, de que tamanho, quem monopoliza
 * — e nunca media QUANTO TEMPO a conversa leva. Uma conversa de 55 turnos passa
 * fácil dos três minutos e nenhuma conta reclamava.
 *
 * SÓ CONTA O QUE É FALADO. A etiqueta `NOME:` não sai da boca de ninguém no
 * vídeo; contá-la inflaria o tempo em uma palavra por turno — em 30 turnos, uns
 * doze segundos de conversa que não existem. */
function dialogoFalado(texto) {
  const { turnos, soltas } = dialogoTurnos(texto);
  return turnos.map((t) => t.fala).concat(soltas || []).join(' ');
}

/** Quanto tempo esta conversa leva. Mesma janela e mesma tolerância do outro
 *  modo: a régua do formato é uma só.
 *
 *  Só o TETO reprova. O piso já existe aqui com outro nome — `dialogoTurnos`
 *  cobra o mínimo de turnos —, e duas contas reclamando da mesma conversa curta
 *  dariam dois avisos para um defeito só. */
function dialogoDuracao(texto) {
  if (typeof causoDuracao !== 'function') return { problemas: [], segundos: 0 };
  const d = causoDuracao(dialogoFalado(texto));
  const problemas = [];
  if (d.segundos > CAUSO_SEG_TETO) {
    problemas.push(`a conversa leva ${Math.floor(d.segundos / 60)}min${d.segundos % 60 ? ' e ' + (d.segundos % 60) + 's' : ''} para ser dita em voz alta — o formato pede 1 a 1min30. Não corte o fim: tire as voltas em que ninguém diz nada novo, e comece a conversa mais adiante.`);
  }
  return { problemas, segundos: d.segundos, palavras: d.palavras };
}

/* Vocabulário distintivo de cada falante — o que ele usa e o outro não. */
function _dPalavrasDe(falas) {
  const t = String(falas || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  return new Set(t.split(/[^a-z0-9]+/).filter((w) => w.length >= 4));
}

/* Duas vozes se separam por VOCABULÁRIO ou por TAMANHO DE FALA. Cobrar as duas
 * seria cobrar caricatura; aceitar qualquer uma é o suficiente para dizer que
 * não é a mesma pessoa falando duas vezes. */
const DIALOGO_MAX_SOBREPOSICAO = 0.5;

/** VOZES IDÊNTICAS: tapando as etiquetas, não dá para saber quem fala. */
function dialogoVozes(texto) {
  const { turnos } = dialogoTurnos(texto);
  const problemas = [];
  const comEtiqueta = turnos.filter((t) => t.marcado);
  // Sem etiqueta não há como separar quem é quem: a medida não se aplica, e o
  // crítico de vozes continua olhando isso com os olhos dele.
  if (comEtiqueta.length < DIALOGO_MIN_TURNOS) return { problemas, medido: false, ok: true };

  const porQuem = new Map();
  comEtiqueta.forEach((t) => {
    const a = porQuem.get(t.quem) || { falas: [], palavras: 0 };
    a.falas.push(t.fala);
    a.palavras += DIALOGO_PALAVRAS(t.fala);
    porQuem.set(t.quem, a);
  });
  const gente = [...porQuem.entries()];
  if (gente.length !== 2) return { problemas, medido: false, ok: true };

  const [[n1, a1], [n2, a2]] = gente;
  const v1 = _dPalavrasDe(a1.falas.join(' '));
  const v2 = _dPalavrasDe(a2.falas.join(' '));
  const comuns = [...v1].filter((w) => v2.has(w)).length;
  const sobreposicao = comuns / Math.max(1, Math.min(v1.size, v2.size));
  const media1 = a1.palavras / a1.falas.length;
  const media2 = a2.palavras / a2.falas.length;
  const difTamanho = Math.abs(media1 - media2) / Math.max(media1, media2, 1);

  if (sobreposicao > DIALOGO_MAX_SOBREPOSICAO && difTamanho < 0.25) {
    problemas.push(`${n1} e ${n2} falam igual: ${Math.round(sobreposicao * 100)}% do vocabulário é o mesmo e os turnos têm quase o mesmo tamanho. É uma pessoa fazendo duas vozes.`);
  }
  return { problemas, medido: true, sobreposicao, difTamanho, ok: problemas.length === 0 };
}

/**
 * A conferência do modo. Reaproveita o que já vale para qualquer texto falado —
 * oralidade e originalidade contra a memória da mesa vêm do motor do Causos, e
 * são as mesmas contas.
 */
function conferirDialogoLocal(texto, dossie, opcoes) {
  const o = opcoes || {};
  const oral = (typeof causoOralidade === 'function') ? causoOralidade(texto) : { problemas: [] };
  const orig = (typeof causoOriginalidade === 'function') ? causoOriginalidade(texto, o.memoria, dossie) : { problemas: [] };
  const narr = dialogoNarracao(texto);
  const mono = dialogoMonopolio(texto);
  const ritmo = dialogoRitmo(texto);
  const vozes = dialogoVozes(texto);
  const dur = dialogoDuracao(texto);

  const achados = []
    .concat(oral.problemas.map((p) => ({ dimensao: 'oralidade', texto: p })))
    .concat(orig.problemas.map((p) => ({ dimensao: 'originalidade', texto: p })))
    .concat(narr.problemas.map((p) => ({ dimensao: 'naturalidade', texto: p })))
    .concat(mono.problemas.map((p) => ({ dimensao: 'dinamica', texto: p })))
    .concat(ritmo.problemas.map((p) => ({ dimensao: 'dinamica', texto: p })))
    .concat(dur.problemas.map((p) => ({ dimensao: 'dinamica', texto: p })))
    .concat(vozes.problemas.map((p) => ({ dimensao: 'vozes', texto: p })));

  return { achados, oralidade: oral, originalidade: orig, narracao: narr, monopolio: mono, ritmo, vozes, duracao: dur, ok: achados.length === 0 };
}

/* -------------------------------------------------------------------------- */
/* §3 — A cabeça: doutrina e prompts                                           */
/* -------------------------------------------------------------------------- */

function dialogoBlocoDoutrina() {
  return [
    '== PARA QUE ESTA CONVERSA EXISTE ==',
    'Para dar a sensação de que a pessoa está OUVINDO gente conversar. Não lendo uma cena, não acompanhando um roteiro: ouvindo, como quem está na mesa do lado e não consegue deixar de escutar.',
    '',
    'O TESTE: se alguém tapar os nomes de quem fala, ainda dá para saber quem é quem? Se não dá, é uma pessoa só fazendo duas vozes — e é o defeito mais comum de todos.',
    '',
    '== COMO GENTE CONVERSA DE VERDADE ==',
    'NINGUÉM ESPERA A VEZ COM EDUCAÇÃO. As pessoas cortam, atropelam, respondem antes de o outro terminar, falam junto. Uma conversa em que cada um fala um parágrafo bem-feito e cede a palavra é uma entrevista, não uma conversa.',
    'NINGUÉM FALA SÓ EM FRASE COMPLETA. Tem "ahn?", "sei lá", "não", "peraí", "tá", "hum". Tem frase que morre no meio porque o outro entendeu antes do fim. Tem gente repetindo a mesma palavra três vezes porque está com raiva.',
    'NINGUÉM EXPLICA O QUE OS DOIS JÁ SABEM. "Como você sabe, desde que a mamãe morreu…" é fala escrita para o público, não para quem está ali. Se a informação precisa aparecer, ela vaza por acidente — numa acusação, numa piada velha, num detalhe que um cobra do outro.',
    'NEM TODA PERGUNTA É RESPONDIDA. Gente desconversa, devolve outra pergunta, finge que não ouviu, responde outra coisa. Quem responde tudo direitinho está prestando depoimento.',
    'CADA UM QUER UMA COISA na conversa, e as duas coisas não são a mesma. É isso que faz a conversa andar. Se os dois querem o mesmo, não há conversa: há concordância.',
    '',
    '== PROIBIDO ==',
    'NARRADOR. Nada de "…, disse ele", "…, respondeu ela, sorrindo". Nada de rubrica entre parênteses — (rindo), (pausa), (olhando para o chão). Nada de linha descrevendo o ambiente. Só o que sai da boca das pessoas.',
    'Se a emoção precisa de legenda para ser entendida, ela não está na fala — e o certo é consertar a fala, não pôr a legenda.',
    '',
    '== A REGRA ACIMA DE TODAS ==',
    'NÃO tente parecer coloquial. Tentar é o caminho mais curto para a caricatura — a gíria decorada, o "mano" de dois em dois turnos, o sotaque escrito errado de propósito.',
    'Pareça gente. Brasileiro, do lugar onde a conversa acontece, com a idade que tem. O jeito de falar nasce de quem é a pessoa, não de uma lista de gírias.',
  ].join('\n');
}

function buildDialogoConceitosPrompt(ideia, memoria) {
  return [
    'Você explora conversas possíveis. Português do Brasil.',
    'Você NÃO escreve a conversa. Você descobre quantas conversas diferentes cabem numa mesma ideia.',
    '',
    dialogoBlocoDoutrina(),
    '',
    (typeof causoBlocoMemoria === 'function' ? causoBlocoMemoria(memoria) : ''),
    '',
    '== A IDEIA ==',
    String(ideia || '').trim(),
    '',
    '== TAREFA ==',
    'Proponha QUATRO conversas possíveis a partir dessa ideia. Diferentes de verdade: não quatro versões da mesma, mas quatro que ninguém confundiria uma com a outra.',
    'Em cada uma, as duas pessoas têm de QUERER COISAS DIFERENTES naquela conversa — é o desencontro que faz a conversa andar. Diga o que cada uma quer.',
    'Diga também o que está POR BAIXO: a coisa que ninguém vai dizer com todas as letras, mas que está mandando na conversa inteira.',
    'E diga qual é o RISCO: o jeito mais provável de essa conversa sair falsa. "Os dois falarem igual" é o risco mais comum aqui.',
    '',
    'Situações possíveis (escolha a que couber em cada conceito):',
    DIALOGO_GENEROS.map((g) => `  ${g.id} — ${g.label}: ${g.ctx}`).join('\n'),
    '',
    'Devolva SOMENTE JSON, sem cercas:',
    '{',
    '  "conceitos": [',
    '    {',
    '      "titulo": "como se chamaria essa conversa em quatro palavras",',
    '      "genero": "um dos ids acima",',
    '      "premissa": "o que acontece na conversa, em duas frases",',
    '      "quem": "quem são as pessoas e o que uma é da outra",',
    '      "quer": "o que CADA UMA quer nesta conversa — e são coisas diferentes",',
    '      "virada": "o momento em que a conversa muda de rumo",',
    '      "absurdo": "o que está por baixo e ninguém diz com todas as letras",',
    '      "graca": "de onde vem a graça ou o reconhecimento",',
    '      "estrutura": "o desenho da conversa, nomeado por você",',
    '      "porqueFunciona": "por que é boa de ouvir",',
    '      "risco": "o jeito mais provável de sair falsa"',
    '    }',
    '  ]',
    '}',
  ].filter(Boolean).join('\n');
}

function buildDialogoDossiePrompt(conceito, ideia, memoria) {
  const c = conceito || {};
  const g = dialogoGenero(c.genero);
  return [
    'Você prepara uma conversa antes de alguém escrevê-la: quem conhece essas pessoas e sabe como cada uma fala.',
    'Você NÃO escreve a conversa. Você prepara o dossiê.',
    '',
    dialogoBlocoDoutrina(),
    '',
    `== A SITUAÇÃO: ${g.label} ==`,
    g.ctx,
    '',
    '== O CONCEITO ESCOLHIDO ==',
    `Título: ${c.titulo || ''}`,
    `Premissa: ${c.premissa || ''}`,
    `Quem: ${c.quem || ''}`,
    `O que cada um quer: ${c.quer || ''}`,
    `Por baixo: ${c.absurdo || ''}`,
    `Virada: ${c.virada || ''}`,
    `Risco: ${c.risco || ''}`,
    '',
    '== A IDEIA ORIGINAL ==',
    String(ideia || '').trim(),
    '',
    (typeof causoBlocoMemoria === 'function' ? causoBlocoMemoria(memoria) : ''),
    '',
    '== TAREFA ==',
    'Prepare as pessoas e o jeito de falar de cada uma. A VOZ é a parte mais importante: é ela que faz o teste de tapar os nomes funcionar.',
    'Para cada pessoa, o jeito de falar precisa ser CONCRETO e diferente do da outra: tamanho de frase (quem fala em três palavras e quem enrola), o que ela nunca diz, o vício de linguagem, se responde direto ou desconversa, se pergunta ou afirma.',
    'Duas pessoas com "jeito informal e descontraído" são a mesma pessoa. Diga o que SEPARA uma da outra.',
    /* r236: mesma lição do modo Causos — resolver o tamanho aqui, no plano, em
     * vez de deixar para a hora de escrever (que aí já é tarde: ou a conversa
     * sai maior que o formato, ou alguém corta depois de pronta). */
    `Isto vai virar vídeo curto: dita em voz alta, a conversa inteira tem de caber entre 1 minuto e 1min30. Planeje o "plano" já nesse tamanho — poucos pontos de virada, não uma conversa longa que precisaria ser cortada depois.`,
    '',
    'Devolva SOMENTE JSON, sem cercas:',
    '{',
    '  "genero": "o id da situação",',
    '  "personagens": [',
    '    { "nome": "como aparece na conversa", "quem": "quem é, em uma frase",',
    '      "quer": "o que quer desta conversa", "fala": "o jeito de falar, concreto e só dela",',
    '      "nuncaDiz": "uma coisa que essa pessoa não diria de jeito nenhum" }',
    '  ],',
    '  "mundo": { "lugar": "onde estão", "quando": "que hora do dia, que momento" },',
    '  "voz": { "quem": "quem conduz a conversa", "comoFala": "o clima geral da troca" },',
    '  "plano": ["por onde a conversa começa", "o que muda no meio", "como termina — o desfecho de verdade, não um resumo"],',
    '  "porBaixo": "o que está mandando na conversa e ninguém diz"',
    '}',
  ].filter(Boolean).join('\n');
}

const DIALOGO_TAMANHOS = {
  curto: '12 a 20 turnos',
  medio: '20 a 35 turnos',
  longo: '35 a 55 turnos',
};

function buildDialogoContarPrompt(dossie, opcoes) {
  const d = dossie || {};
  const o = opcoes || {};
  const g = dialogoGenero(d.genero);
  const gente = (d.personagens || []).map((p) =>
    `  ${p.nome || '?'} — ${p.quem || ''}. Quer: ${p.quer || ''}. Fala assim: ${p.fala || ''}. Nunca diria: ${p.nuncaDiz || ''}`).join('\n');
  return [
    'Você escreve a conversa. Português do Brasil.',
    '',
    dialogoBlocoDoutrina(),
    '',
    `== A SITUAÇÃO: ${g.label} ==`,
    g.ctx,
    '',
    '== QUEM CONVERSA ==',
    gente || '  (não informado)',
    '',
    d.mundo ? `== ONDE ==\n${d.mundo.lugar || ''} ${d.mundo.quando || ''}`.trim() : '',
    d.porBaixo ? `== O QUE ESTÁ POR BAIXO E NINGUÉM DIZ ==\n${d.porBaixo}` : '',
    (d.plano || []).length ? `== POR ONDE A CONVERSA PASSA ==\n${d.plano.map((p) => `- ${p}`).join('\n')}` : '',
    '',
    '== COMO ESCREVER ==',
    `Tamanho: ${DIALOGO_TAMANHOS[o.tamanho] || DIALOGO_TAMANHOS.medio}.`,
    /* A contagem de turnos sozinha não diz nada sobre tempo: trinta turnos
     * podem dar quarenta segundos ou quatro minutos. Isto vira vídeo curto, e é
     * o tempo que manda. */
    `Isto vai virar vídeo curto: dita em voz alta, a conversa inteira tem de caber entre 1 minuto e 1min30 — algo perto de ${Math.round(CAUSO_SEG_ALVO_MIN * CAUSO_PALAVRAS_POR_SEGUNDO)} a ${Math.round(CAUSO_SEG_ALVO_MAX * CAUSO_PALAVRAS_POR_SEGUNDO)} palavras faladas, somando todos os turnos. Turnos curtos são o jeito de ter muitos turnos dentro desse tempo.`,
    'CADA FALA TEM DE FAZER A CONVERSA ANDAR. Fala que não muda o que se sabe, não muda o que se sente e não muda o rumo do assunto sobra — e sobra faz quem ouve perceber que já entendeu e sair.',
    'NÃO DÊ VOLTAS NO MESMO PONTO. Assunto tocado uma vez está tocado. Não retome com outras palavras para reforçar, e não feche resumindo o que acabou de ser dito.',
    'FORMATO, e não há outro: uma fala por linha, no formato `NOME: fala`. Nada antes, nada depois, nada entre.',
    'Sem narração. Sem rubrica entre parênteses. Sem "…, disse ele". Sem descrever o lugar. Só as falas.',
    'VARIE O TAMANHO DOS TURNOS de propósito: alguns de uma palavra, outros de três linhas. Uma conversa em que todos os turnos têm o mesmo tamanho é falsa antes de qualquer outra coisa.',
    'Deixe pelo menos uma pergunta sem resposta, e pelo menos uma frase morrer no meio porque o outro cortou.',
    'Não resolva tudo. Conversa não termina em conclusão — termina quando alguém sai, muda de assunto ou desiste.',
    '',
    'Escreva a conversa. Nada além dela.',
  ].filter(Boolean).join('\n');
}

const DIALOGO_CRITICOS = {
  ouvido: {
    papel: 'Você ouve conversas a vida inteira e sabe na hora quando uma é escrita. Você não avalia enredo nem mensagem: avalia se aquilo poderia ter saído de bocas humanas.',
    olha: ['naturalidade', 'dinamica', 'escuta', 'final'],
    pergunta: 'Alguém fala assim? Onde a conversa vira texto? Quem está esperando educadamente a vez? Que pergunta foi respondida direitinho demais?',
  },
  vozes: {
    papel: 'Você faz um teste só: tapa os nomes e tenta descobrir quem está falando.',
    olha: ['vozes', 'naturalidade'],
    pergunta: 'Tapando as etiquetas, dá para separar as pessoas? O que separa uma da outra — vocabulário, tamanho de fala, jeito de responder? Ou é a mesma pessoa duas vezes?',
  },
  oralidade: {
    papel: 'Você é do ouvido: escuta a frase em voz alta e sente onde ela trava.',
    olha: ['oralidade', 'brasilidade'],
    pergunta: 'Que palavra ninguém usaria falando? Onde está a língua da página no lugar da língua da boca? Onde a gíria soa decorada?',
  },
  originalidade: {
    papel: 'Você já ouviu tudo. O seu trabalho é dizer onde esta conversa é a conversa de sempre.',
    olha: ['originalidade', 'assunto'],
    pergunta: 'Onde isto é o diálogo padrão que qualquer um escreveria? O assunto tem alguma coisa em jogo, ou é conversa de encher linguiça?',
  },
  subtexto: {
    papel: 'Você lê o que não foi dito. O que interessa numa conversa raramente é o assunto dela.',
    olha: ['subtexto', 'assunto', 'escuta'],
    pergunta: 'O que está por baixo? Está por baixo mesmo, ou alguém acabou dizendo com todas as letras? Onde a conversa fica plana por não ter segunda camada?',
  },
  humor: {
    papel: 'Você olha a graça: a de rir e a de reconhecer ("é exatamente assim que a minha tia fala").',
    olha: ['humor', 'naturalidade'],
    pergunta: 'Onde dá vontade de rir? Onde a graça foi explicada em vez de acontecer? Onde falta o reconhecimento que faz a pessoa dizer "é bem isso"?',
  },
};

function buildDialogoCriticoPrompt(criticoId, texto, dossie, achadosLocais) {
  const c = DIALOGO_CRITICOS[criticoId] || DIALOGO_CRITICOS.ouvido;
  const achados = (achadosLocais || []).filter((a) => c.olha.includes(a.dimensao));
  return [
    c.papel,
    'Português do Brasil. Você é DURO: nota alta é para o que merece, não para o que não incomodou.',
    '',
    '== O QUE VOCÊ OLHA ==',
    c.olha.map((id) => {
      const d = dialogoDimensao(id);
      return d ? `  ${d.id} — ${d.pergunta} (mínimo ${d.minimo})` : `  ${id}`;
    }).join('\n'),
    '',
    '== AS PERGUNTAS QUE VOCÊ FAZ ==',
    c.pergunta,
    '',
    achados.length ? `== O QUE A CONTA JÁ MEDIU (não repita, mas leve em conta) ==\n${achados.map((a) => `- ${a.texto}`).join('\n')}` : '',
    '',
    '== A CONVERSA ==',
    String(texto || ''),
    '',
    'Devolva SOMENTE JSON, sem cercas:',
    '{',
    '  "notas": [',
    '    { "dimensao": "um dos ids acima", "nota": 0, "problema": "o que está errado, concreto", "correcao": "o que fazer, executável" }',
    '  ],',
    '  "resumo": "uma frase"',
    '}',
  ].filter(Boolean).join('\n');
}

function buildDialogoReescreverPrompt(texto, ordens, dossie) {
  const d = dossie || {};
  return [
    'Você reescreve uma conversa corrigindo APENAS os pontos abaixo. Português do Brasil.',
    '',
    'O QUE JÁ FUNCIONA FICA. Não reescreva por reescrever: mexa no que está listado e preserve o resto — as falas boas, o jeito de cada um, o que já está engraçado ou tenso.',
    '',
    '== O QUE CORRIGIR (do mais grave para o menos) ==',
    (ordens || []).map((o, i) => `${i + 1}. ${o.dimensao}: ${o.ordem}`).join('\n'),
    '',
    (d.personagens || []).length
      ? `== COMO CADA UM FALA (não troque as vozes) ==\n${d.personagens.map((p) => `  ${p.nome || '?'}: ${p.fala || ''}`).join('\n')}`
      : '',
    '',
    '== A CONVERSA ATUAL ==',
    String(texto || ''),
    '',
    /* Mesma trava do outro modo: "está longa" não pode virar "corte o fim". A
     * conversa perde justamente onde ela chega a algum lugar. */
    'Se o que reprovou foi TAMANHO: não corte o fim nem resuma a conversa. Tire as falas que não mudam nada, as voltas no assunto já tocado e as explicações do que já ficou claro. O fim fica; o que sai é o meio que patina.',
    'FORMATO: uma fala por linha, `NOME: fala`. Sem narração, sem rubrica, sem verbo de dizer atribuído.',
    'Escreva a conversa corrigida. Nada além dela.',
  ].filter(Boolean).join('\n');
}
