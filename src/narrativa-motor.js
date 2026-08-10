'use strict';
/* ============================================================================
 * NARRATIVA — O MOTOR DE ROTEIROS
 *
 * O QUE MUDOU E POR QUÊ
 * A Narrativa fazia: entrada → prompt → roteiro. Uma chamada só. O modelo
 * escrevia a primeira coisa que lhe vinha, e o que saía era correto e sem
 * força — texto que cumpre a estrutura e não prende ninguém.
 *
 * Agora: entrada → compreensão → construção → escrita → crítica → reescrita →
 * validação → roteiro final. A primeira versão passa a ser uma POSSIBILIDADE,
 * não a entrega. Entre uma coisa e outra existe uma leitura crítica que procura
 * os defeitos de sempre — abertura que enrola, personagem que narra em vez de
 * falar, frase feita, explicação no lugar da cena — e uma reescrita que os
 * corrige antes de o usuário ver qualquer coisa.
 *
 * O QUE O USUÁRIO VÊ: nada disso. A tela continua sendo um campo e um botão.
 * A complexidade fica aqui atrás, que é o lugar dela.
 *
 * DUAS DECISÕES QUE SUSTENTAM O RESTO
 *
 * 1. A ESTRUTURA NASCE DA HISTÓRIA. O formato (Reels, carrossel, thread) diz
 *    como o texto é ENTREGUE — marcação de tempo, tamanho de slide, numeração.
 *    Ele não diz mais quais são os beats. Quem decide a forma de contar é a
 *    etapa de leitura, a partir do material: uma piada pede escalada e quebra
 *    de expectativa; uma perda pede vínculo antes da ameaça; uma notícia pede o
 *    fato impactante primeiro. Enfiar tudo em "gancho → problema → solução →
 *    CTA" é o que produz conteúdo formulaico.
 *
 * 2. A CRÍTICA TEM UMA PARTE QUE NÃO É OPINIÃO. Perguntar a uma LLM "este
 *    roteiro está bom?" devolve "sim" com frequência incômoda. Por isso metade
 *    da crítica é determinística e roda no código: abertura, frases feitas,
 *    diálogo que narra, número inventado, repetição. Essas achados entram na
 *    reescrita como constatação, e valem também como trava — uma reescrita que
 *    inventa fato é descartada e fica o rascunho.
 *
 * As funções puras deste arquivo (os críticos locais, os prompts, os
 * normalizadores) não tocam no DOM e recebem a chamada de IA por parâmetro:
 * dá para exercitar o motor inteiro com uma IA dublada, offline.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* §1 — O que se pergunta a um roteiro antes de entregá-lo                     */
/* -------------------------------------------------------------------------- */

/* A lista de perguntas que a crítica precisa responder. Vive como DADO porque
 * é lida em três lugares: o prompt do crítico, a checagem do que voltou e o
 * teste. Uma lista solta dentro de uma string de prompt sairia de sincronia na
 * primeira vez que alguém mexesse. */
const NARR_CRITERIOS = [
  { id: 'protagonista', pergunta: 'Existe um protagonista, e dá para dizer quem é?' },
  { id: 'desejo', pergunta: 'Esse protagonista quer alguma coisa concreta?' },
  { id: 'obstaculo', pergunta: 'Existe algo impedindo esse desejo?' },
  { id: 'risco', pergunta: 'Existe algo em jogo — o que se perde se der errado?' },
  { id: 'conflito', pergunta: 'Existe conflito real, ou tudo se resolve fácil demais?' },
  { id: 'ponto-de-entrada', pergunta: 'A história começa no ponto interessante, ou antes dele?' },
  { id: 'motivo-de-continuar', pergunta: 'Nos primeiros segundos, existe motivo para continuar assistindo?' },
  { id: 'tensao', pergunta: 'A tensão cresce, ou o texto anda de lado?' },
  { id: 'revelacao', pergunta: 'A informação é revelada aos poucos, ou entregue de uma vez?' },
  { id: 'virada', pergunta: 'Existe uma virada — algo que muda o jogo?' },
  { id: 'final-entrega', pergunta: 'O final entrega alguma coisa?' },
  { id: 'final-previsivel', pergunta: 'O final é previsível desde o começo?' },
  { id: 'dialogo-natural', pergunta: 'Os diálogos soam como pessoas falando, ou como um narrador explicando?' },
  { id: 'vozes-proprias', pergunta: 'Cada personagem tem uma maneira própria de falar?' },
  { id: 'mostrar-nao-explicar', pergunta: 'Alguma parte explica o que poderia ser mostrado?' },
  { id: 'frases-genericas', pergunta: 'Há frases genéricas, artificiais ou de encher linguiça?' },
  { id: 'cheiro-de-ia', pergunta: 'O roteiro parece escrito por IA?' },
  { id: 'cada-frase-tem-razao', pergunta: 'Cada frase tem uma razão para existir, ou dá para cortar sem perda?' },
];

/* -------------------------------------------------------------------------- */
/* §2 — Crítica determinística (roda no código, sem IA)                        */
/* -------------------------------------------------------------------------- */

function _narrNorm(s) {
  return String(s == null ? '' : s)
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/* Aberturas que gastam o único momento em que ninguém ainda decidiu ficar.
 * Só valem no COMEÇO do texto — "era uma vez" no meio de uma fala é outra
 * coisa, e reprovar aquilo seria reprovar o personagem. */
const NARR_ABERTURAS_FRACAS = [
  'hoje eu vou', 'hoje vou', 'nesse video eu vou', 'neste video eu vou',
  'deixa eu te contar', 'deixa eu contar', 'vou te contar uma',
  'essa e a historia de', 'esta e a historia de', 'era uma vez',
  'voce ja parou pra pensar', 'voce ja parou para pensar', 'ja pensou',
  'antes de comecar', 'prepare-se', 'preparem-se', 'senta que la vem historia',
  'voce nao vai acreditar', 'imagina so', 'sabe aquela historia',
  'oi gente', 'ola pessoal', 'fala galera', 'e ai galera',
  'vou falar sobre', 'quero falar sobre', 'bora falar',
];

/* Frases que qualquer texto poderia ter. Não são erro de gramática: são o som
 * de quem não tinha o que dizer naquela linha. */
const NARR_FRASES_FEITAS = [
  'no fim das contas', 'a verdade e que', 'reviravolta do destino',
  'mudou sua vida para sempre', 'mudou a vida dele para sempre',
  'jamais imaginaria', 'jamais poderia imaginar', 'nunca imaginou que',
  'uma licao que ficou', 'fica a licao', 'nos faz refletir', 'nos faz pensar',
  'o que ninguem esperava', 'e foi ai que tudo mudou', 'contra todas as probabilidades',
  'exemplo de superacao', 'a vida tem dessas', 'o destino tinha outros planos',
  'so o tempo dira', 'como num passe de magica', 'de arrepiar',
  'nao poderia ser diferente', 'para a surpresa de todos', 'sem sombra de duvidas',
];

/* Explicar o sentimento é o atalho que mata a cena: dizer "ele ficou nervoso"
 * economiza a mão tremendo na chave da porta. */
const _NARR_EMOCOES = 'triste|nervos[oa]|feliz|furios[oa]|com medo|ansios[oa]|emocionad[oa]|arrasad[oa]|aliviad[oa]|orgulhos[oa]|envergonhad[oa]|frustrad[oa]|indignad[oa]|desesperad[oa]';
const NARR_EXPLICA_SENTIMENTO = new RegExp(
  `\\b(ficou|ficaram|estava|estavam|se sentiu|sentiu-se|se sentia|sentia-se)\\s+(muito\\s+|bastante\\s+|super\\s+)?(${_NARR_EMOCOES})\\b`, 'gi');

/* Fala que existe para informar a plateia, não para dizer algo a alguém. */
const NARR_DIALOGO_EXPOSITIVO = [
  'como voce sabe', 'como voce bem sabe', 'como ja falamos', 'conforme eu disse',
  'lembre-se de que', 'preciso te explicar', 'deixa eu te explicar',
  'como todos sabem', 'como eu sempre digo',
];

/* Chamadas coladas no fim por hábito. Só contam quando o usuário NÃO pediu
 * uma ação — pedida, ela deixa de ser vício e passa a ser o trabalho. */
const NARR_CTA_CLICHE = [
  'comenta aqui embaixo', 'comente aqui embaixo', 'deixa o seu like', 'deixe seu like',
  'salva esse video', 'salve esse video', 'compartilha com alguem', 'compartilhe com alguem',
  'me segue para mais', 'siga para mais', 'nao esqueca de seguir', 'ative o sininho',
];

/** As primeiras palavras do roteiro, já sem marcação de formato. */
function narrPrimeiraFrase(texto) {
  const limpo = String(texto || '')
    // Tira marcação de entrega: "0–3s", "SLIDE 1 —", "1/", "TELA 2:", "NOME:".
    .replace(/^\s*(\d+\s*[–\-—]\s*\d+\s*s|\d+s|slide\s*\d+|tela\s*\d+|ato\s*\d+|abertura|\d+\/)\s*[—:\-–]?\s*/gim, '')
    .replace(/^\s*\[[^\]]*\]\s*/gm, '')
    .trim();
  const m = /^[^.!?\n]{1,240}/.exec(limpo);
  return (m ? m[0] : '').trim();
}

/** A abertura gasta o primeiro segundo pigarreando? */
function narrAberturaFraca(texto) {
  const inicio = _narrNorm(narrPrimeiraFrase(texto)).replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!inicio) return '';
  return NARR_ABERTURAS_FRACAS.find((a) => inicio.indexOf(a) === 0 || inicio.indexOf(' ' + a) >= 0 && inicio.indexOf(a) <= 12) || '';
}

/** Frases que poderiam estar em qualquer roteiro. */
function narrFrasesFeitas(texto) {
  const t = _narrNorm(texto);
  return NARR_FRASES_FEITAS.filter((f) => t.indexOf(f) >= 0);
}

/** Trechos que explicam o que a cena deveria mostrar. */
function narrExplicaEmVezDeMostrar(texto) {
  const achados = String(texto || '').match(NARR_EXPLICA_SENTIMENTO) || [];
  return [...new Set(achados.map((s) => s.trim()))];
}

/* Uma linha de fala: travessão, ou "NOME:" antes do que a pessoa diz.
 *
 * O prefixo de entrega precisa ser tolerado ANTES do nome: num roteiro de Reels
 * a fala vem como "3–10s Seu João: ..." e num carrossel como "SLIDE 2 — JOÃO:".
 * Sem isso, a checagem de diálogo não enxergava fala nenhuma justamente nos
 * dois formatos mais usados — e acusava de "tudo narrado" um roteiro cheio de
 * conversa. Achado ao escrever o teste com um roteiro de Reels de verdade. */
const _NARR_PREFIXO_ENTREGA = /^\s*(?:\d+\s*[–\-—]\s*\d+\s*s|\d+s|slide\s*\d+|tela\s*\d+|ato\s*\d+|\d+\/|\d+[.)])\s*[—:\-–]?\s*/i;
const _NARR_NOME_FALANTE = /^([A-ZÁÂÃÀÉÊÍÓÔÕÚÜÇ][\wÀ-ÿ'.]*(?:\s+[A-ZÁÂÃÀÉÊÍÓÔÕÚÜÇa-zà-ÿ'.]+){0,2}):\s+\S/;

function _narrSemPrefixo(linha) {
  return String(linha || '').replace(_NARR_PREFIXO_ENTREGA, '').trim();
}

/** Quem fala nesta linha ('' quando a linha não é fala). Travessão devolve '—'. */
function narrFalanteDaLinha(linha) {
  const l = _narrSemPrefixo(linha);
  if (/^[—–]\s+\S/.test(l)) return '—';
  const m = _NARR_NOME_FALANTE.exec(l);
  return m ? m[1].trim() : '';
}

function narrLinhasDeFala(texto) {
  return String(texto || '').split('\n')
    .map((l) => l.trim())
    .filter((l) => l && narrFalanteDaLinha(l));
}

/** Os personagens conversam, ou continuam narrando? */
function narrDialogoNarrado(texto, plano) {
  const problemas = [];
  const falas = narrLinhasDeFala(texto);
  const personagens = ((plano && plano.personagens) || []).filter((p) => p && p.nome);

  /* Para a pergunta "alguém fala aqui?", só conta fala de quem EXISTE na
   * história (ou travessão). Uma linha de narração com dois-pontos — "Ele
   * pensou: a chave ainda serve" — casaria com o padrão de falante e faria a
   * checagem calar justamente quando devia falar. */
  const nomes = personagens.map((p) => _narrNorm(p.nome));
  const falasReais = falas.filter((l) => {
    const quem = _narrNorm(narrFalanteDaLinha(l));
    return quem === '—' || nomes.some((n) => n && (n.indexOf(quem) >= 0 || quem.indexOf(n) >= 0));
  });

  // Duas ou mais pessoas na história e ninguém abre a boca: a cena virou resumo.
  if (personagens.length >= 2 && !falasReais.length) {
    problemas.push(`a história tem ${personagens.length} pessoas (${personagens.map((p) => p.nome).join(', ')}) e nenhuma fala: está tudo contado por um narrador.`);
  }

  // Ninguém fala em parágrafo. Fala comprida é discurso escrito na boca de alguém.
  const compridas = falas.filter((l) => l.replace(/^[^:]*:\s*/, '').length > 220);
  if (compridas.length) {
    problemas.push(`${compridas.length} fala(s) longas demais para alguém dizer de uma vez — a primeira começa em "${compridas[0].slice(0, 60)}…".`);
  }

  // Fala que existe para informar a plateia.
  const t = _narrNorm(falas.join('\n'));
  const expositivas = NARR_DIALOGO_EXPOSITIVO.filter((e) => t.indexOf(e) >= 0);
  if (expositivas.length) {
    problemas.push(`fala escrita para informar quem assiste, não para dizer algo a alguém: "${expositivas.join('", "')}".`);
  }
  return problemas;
}

/* Números que aparecem no roteiro e não estão no material. A marcação de
 * entrega (tempos, slides, numeração de thread) é retirada antes — senão
 * "0–3s" viraria fato inventado em todo roteiro de Reels. */
function _narrNumeros(texto) {
  const semMarcacao = String(texto || '')
    .replace(/^\s*\d+\s*[–\-—]\s*\d+\s*s\b.*$/gim, (l) => l.replace(/^\s*\d+\s*[–\-—]\s*\d+\s*s/i, ''))
    .replace(/\b\d+\s*[–\-—]\s*\d+\s*s\b/gi, ' ')
    .replace(/^\s*(slide|tela|ato|parte|post)\s*\d+/gim, ' ')
    .replace(/^\s*\d+\s*\/\s*/gm, ' ')
    .replace(/^\s*\d+[.)]\s+/gm, ' ');
  return [...new Set((semMarcacao.match(/\d[\d.,:]*/g) || [])
    .map((n) => n.replace(/[.,:]+$/, ''))
    .filter((n) => n.length >= 1))];
}

/** Números presentes no roteiro que não vieram do material nem do plano. */
function narrFatosInventados(roteiro, material) {
  const doMaterial = new Set(_narrNumeros(material));
  return _narrNumeros(roteiro).filter((n) => !doMaterial.has(n));
}

/** Chamada de ação colada por hábito, quando ninguém pediu ação nenhuma. */
function narrCtaCliche(texto, ctaPedido) {
  if (String(ctaPedido || '').trim()) return [];
  const t = _narrNorm(texto);
  return NARR_CTA_CLICHE.filter((c) => t.indexOf(c) >= 0);
}

/* Três ou mais frases começando igual — o texto andando de lado em vez de
 * avançar. Conta pela PRIMEIRA palavra e também pelas duas primeiras: "Ele
 * girou / Ele olhou / Ele lembrou" não repete duas palavras nenhuma vez, e é
 * exatamente o tique que se quer pegar. */
function narrRepeticaoDeAbertura(texto) {
  const frases = String(texto || '').split(/[.!?\n]+/)
    .map((f) => f.trim()).filter((f) => f.length > 10);
  const uma = new Map(), duas = new Map();
  frases.forEach((f) => {
    const palavras = _narrNorm(f).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
    if (palavras[0] && palavras[0].length >= 3) uma.set(palavras[0], (uma.get(palavras[0]) || 0) + 1);
    if (palavras.length >= 2) {
      const k = palavras.slice(0, 2).join(' ');
      if (k.length >= 5) duas.set(k, (duas.get(k) || 0) + 1);
    }
  });
  const repetidas = [...uma.entries()].concat([...duas.entries()])
    .filter(([, n]) => n >= 3).map(([c]) => c);
  // "ele" e "ele girou" seriam o mesmo tique contado duas vezes.
  return repetidas.filter((r, i) => !repetidas.some((outro, j) => j !== i && outro !== r && outro.indexOf(r + ' ') === 0));
}

/**
 * A crítica que não é opinião. Devolve uma lista de constatações — cada uma
 * com o id do critério que ela fere, para que a reescrita saiba o que corrigir.
 * NÃO reescreve nem descarta nada: quem decide o que fazer é o pipeline.
 */
function criticarRoteiroLocal(roteiro, plano, opcoes) {
  const o = opcoes || {};
  const achados = [];
  const texto = String(roteiro || '');

  const abertura = narrAberturaFraca(texto);
  if (abertura) {
    achados.push({ criterio: 'ponto-de-entrada', grave: true,
      texto: `a primeira frase começa com "${abertura}" — é pigarro antes da história. Comece no instante em que já está acontecendo alguma coisa.` });
  }

  const feitas = narrFrasesFeitas(texto);
  if (feitas.length) {
    achados.push({ criterio: 'frases-genericas', grave: feitas.length > 1,
      texto: `frase(s) de qualquer roteiro: "${feitas.join('", "')}". Troque pelo que aconteceu de fato.` });
  }

  const explicando = narrExplicaEmVezDeMostrar(texto);
  if (explicando.length) {
    achados.push({ criterio: 'mostrar-nao-explicar', grave: false,
      texto: `o texto anuncia o sentimento em vez de mostrá-lo: "${explicando.join('", "')}". Mostre o gesto, a fala ou o detalhe que faz sentir aquilo.` });
  }

  narrDialogoNarrado(texto, plano).forEach((p) => {
    achados.push({ criterio: 'dialogo-natural', grave: true, texto: p });
  });

  const inventados = narrFatosInventados(texto, o.material || '');
  if (inventados.length) {
    achados.push({ criterio: 'fatos', grave: true,
      texto: `número(s) que não estão no material: ${inventados.join(', ')}. Não invente dado — o que não veio do material não entra.` });
  }

  const ctas = narrCtaCliche(texto, o.cta);
  if (ctas.length) {
    achados.push({ criterio: 'cada-frase-tem-razao', grave: false,
      texto: `chamada colada por hábito: "${ctas.join('", "')}". Ninguém pediu ação; corte ou substitua por algo que a história justifique.` });
  }

  const repetidas = narrRepeticaoDeAbertura(texto);
  if (repetidas.length) {
    achados.push({ criterio: 'tensao', grave: false,
      texto: `frases começando igual várias vezes ("${repetidas.join('", "')}") — o texto anda de lado em vez de avançar.` });
  }

  return { achados, graves: achados.filter((a) => a.grave), ok: achados.length === 0 };
}

/* -------------------------------------------------------------------------- */
/* §3 — Prompts: cada etapa é um papel                                         */
/* -------------------------------------------------------------------------- */

/** Etapa 1 — ANALISTA + ARQUITETO: entende o material e descobre que história
 *  existe ali dentro, incluindo a FORMA de contá-la. */
function buildLeituraPrompt(material, lema) {
  return [
    'Você é analista de histórias e arquiteto narrativo. Trabalha em português do Brasil.',
    'Sua tarefa NÃO é escrever. É entender o material e decidir que história existe nele.',
    '',
    lema ? `== DOUTRINA ==\n${lema}` : '',
    '',
    '== MATERIAL BRUTO (única fonte de fatos) ==',
    String(material || '').trim(),
    '',
    '== O QUE VOCÊ PRECISA DESCOBRIR ==',
    '1. O que de fato ACONTECE aqui. Só o que está escrito — nada de completar buracos.',
    '2. Quem é o protagonista, o que quer, o que impede e o que está em jogo.',
    '3. Quem mais aparece: o que cada um quer, como fala e o que sabe (e o que NÃO sabe).',
    '4. Qual é o momento MAIS INTERESSANTE do material — o instante em que já existe alguma coisa acontecendo. É por ele que o roteiro vai começar, não pelo começo cronológico.',
    '5. Qual a forma natural desta história.',
    '',
    '== SOBRE A FORMA (o ponto mais importante) ==',
    'A estrutura nasce da história, não a história da estrutura. NÃO force este material dentro de "gancho → problema → solução → chamada": é o que produz conteúdo formulaico.',
    'Descreva primeiro o desenho que ESTE material pede, e só então nomeie-o. Materiais diferentes pedem desenhos diferentes — uma história engraçada pede escalada e quebra de expectativa; uma perda pede que o vínculo seja criado antes da ameaça; uma notícia pede o fato impactante antes do contexto; um relato pessoal costuma funcionar começando pelo momento crítico e voltando para explicar como se chegou ali.',
    'Esses são exemplos de VARIEDADE, não um cardápio: se este material pedir outro desenho, use o outro e explique por quê.',
    'Os beats devem citar o que acontece NESTE material, com as pessoas e as coisas dele — não rótulos genéricos.',
    '',
    '== O QUE É LER E O QUE É INVENTAR (a distinção que decide este trabalho) ==',
    'INVENTAR é acrescentar FATO que não está no material: um número, um nome, uma data, uma fala, um acontecimento. Isso é proibido, sempre.',
    'LER é dizer o que os fatos do material significam: quem quer o quê, o que atrapalha, o que essa pessoa perde se der errado. Isso é o SEU TRABALHO — e é esperado que você faça mesmo quando o material não diz com todas as letras.',
    'Exemplo da diferença: se o material conta que alguém gastou a reserva da aposentadoria numa causa, o que está em jogo é a aposentadoria — dizer isso é ler, não inventar. Já afirmar de quanto era a reserva, quando ninguém disse, é inventar.',
    'Portanto: deduza o desejo, o obstáculo e o que está em jogo a partir dos fatos, sem acrescentar fato nenhum.',
    'Só devolva string vazia quando o material realmente não permitir NEM a dedução — e, nesse caso, diga em "naoTem" o que ficou faltando.',
    '',
    'Devolva SOMENTE um objeto JSON, sem cercas de código:',
    '{',
    '  "fatos": ["o que acontece, um por item, apenas do material"],',
    '  "protagonista": "quem deseja algo",',
    '  "desejo": "o objetivo concreto, começando por verbo",',
    '  "obstaculo": "a força que impede",',
    '  "risco": "o que se perde se falhar",',
    '  "personagens": [{ "nome": "", "quer": "", "jeitoDeFalar": "como essa pessoa fala: ritmo, vocabulário, o que ela evita dizer", "sabe": "o que essa pessoa sabe e o que ela ignora nesta altura" }],',
    '  "natureza": "que tipo de coisa é este material, em uma frase (relato, notícia, piada, desabafo, denúncia, memória...)",',
    '  "comecaEm": "o momento exato em que o roteiro deve começar",',
    '  "porqueComecaAi": "por que este é o instante mais interessante",',
    '  "estrutura": { "nome": "o desenho, nomeado por você", "porque": "por que ESTE material pede este desenho, citando o que há nele", "beats": ["cada passo, com o que acontece de concreto"] },',
    '  "mostrar": ["coisas que precisam aparecer em cena ou em fala, nunca explicadas pelo narrador"],',
    '  "naoTem": "o que o material não responde (ou string vazia)"',
    '}',
  ].filter((l) => l !== '').join('\n');
}

/** Etapa 2 — ROTEIRISTA: escreve seguindo o desenho decidido na leitura. */
function buildRoteiroPrompt(plano, opcoes) {
  const o = opcoes || {};
  const f = o.formato || {};
  const t = o.tom || {};
  const tam = o.tamanho || {};
  const p = plano || {};
  const linhas = [];

  linhas.push('Você é roteirista de vídeo. Escreve em português do Brasil, para ser FALADO e assistido.');
  linhas.push('');
  if (o.lema) { linhas.push('== DOUTRINA =='); linhas.push(o.lema); linhas.push(''); }

  linhas.push('== A HISTÓRIA QUE FOI ENCONTRADA NO MATERIAL ==');
  if (p.protagonista) linhas.push(`Protagonista: ${p.protagonista}`);
  if (p.desejo) linhas.push(`Quer: ${p.desejo}`);
  if (p.obstaculo) linhas.push(`Impede: ${p.obstaculo}`);
  if (p.risco) linhas.push(`Em jogo: ${p.risco}`);
  if (p.natureza) linhas.push(`Natureza do material: ${p.natureza}`);
  if ((p.fatos || []).length) {
    linhas.push('');
    linhas.push('Fatos disponíveis (não invente nenhum além destes):');
    p.fatos.forEach((x) => linhas.push('- ' + x));
  }

  const pers = (p.personagens || []).filter((x) => x && x.nome);
  if (pers.length) {
    linhas.push('');
    linhas.push('== QUEM FALA ==');
    pers.forEach((x) => {
      const partes = [`- ${x.nome}`];
      if (x.quer) partes.push(`quer: ${x.quer}`);
      if (x.jeitoDeFalar) partes.push(`fala assim: ${x.jeitoDeFalar}`);
      if (x.sabe) partes.push(`sabe: ${x.sabe}`);
      linhas.push(partes.join(' — '));
    });
    linhas.push('');
    linhas.push('REGRAS DO ELENCO:');
    linhas.push('- O centro é o protagonista: é o desejo DELE que impulsiona a história. Ninguém toma a história para si.');
    linhas.push('- Não crie personagens além dos listados. Figurante necessário fica sem nome ("o fiscal", "a vizinha").');
    linhas.push('- Use os nomes exatamente como estão escritos acima.');
    if (pers.some((x) => !x.quer)) {
      linhas.push('- Quando o que a pessoa quer não foi declarado — não invente: mantenha-a em segundo plano.');
    }
    linhas.push('');
    linhas.push('REGRAS DAS FALAS:');
    linhas.push('- Ninguém fala porque quem assiste precisa saber. Cada um fala porque QUER dizer aquilo, àquela pessoa, naquele momento.');
    linhas.push('- Cada personagem sabe só o que sabe. Não coloque na boca de alguém uma informação que ele não teria.');
    linhas.push('- Vozes diferentes: quem é seco fala curto; quem enrola se perde na frase. Se trocar os nomes de lugar e a cena continuar igual, as falas estão todas iguais.');
    linhas.push('- Ninguém explica a própria motivação em voz alta. A intenção aparece no que a pessoa faz e no que ela evita dizer.');
  }

  if (p.comecaEm) {
    linhas.push('');
    linhas.push('== ONDE COMEÇA ==');
    linhas.push(String(p.comecaEm));
    if (p.porqueComecaAi) linhas.push(`(motivo: ${p.porqueComecaAi})`);
    linhas.push('Comece EXATAMENTE aí. Nada de preâmbulo, saudação ou anúncio do que virá — a primeira frase já é a história acontecendo.');
  }

  const est = p.estrutura || {};
  if ((est.beats || []).length) {
    linhas.push('');
    linhas.push(`== O DESENHO DESTA HISTÓRIA${est.nome ? `: ${est.nome}` : ''} ==`);
    if (est.porque) linhas.push(est.porque);
    est.beats.forEach((b, i) => linhas.push(`${i + 1}. ${b}`));
    linhas.push('Este desenho é desta história. Siga-o — não substitua por uma fórmula pronta.');
  }

  if ((p.mostrar || []).length) {
    linhas.push('');
    linhas.push('== MOSTRAR, NÃO EXPLICAR ==');
    p.mostrar.forEach((x) => linhas.push('- ' + x));
    linhas.push('Estes pontos aparecem em cena, gesto ou fala. Se o texto ANUNCIA o sentimento ("ficou nervoso"), ele está explicando o que devia mostrar.');
  }

  linhas.push('');
  linhas.push(`== COMO ENTREGAR: ${f.label || 'texto'} ==`);
  if (f.desc) linhas.push(f.desc);
  (f.entrega || []).forEach((e) => linhas.push('- ' + e));
  linhas.push('Isto é embalagem — como o texto é marcado e entregue. NÃO é a estrutura da história: essa já está definida acima.');

  linhas.push('');
  linhas.push(`== TOM: ${t.label || 'natural'} ==`);
  if (t.desc) linhas.push(t.desc);
  if (tam.label) linhas.push(`Extensão: ${tam.label} — ${tam.desc || ''}`);

  if (o.perfil && (o.perfil.name || o.perfil.handle || o.perfil.tagline)) {
    linhas.push('');
    linhas.push('== QUEM PUBLICA ==');
    if (o.perfil.name) linhas.push(`Nome: ${o.perfil.name}`);
    if (o.perfil.tagline) linhas.push(`Assinatura: ${o.perfil.tagline}`);
    linhas.push('Escreva nessa voz, sem citar estes dados.');
  }
  if (o.cta) { linhas.push(''); linhas.push(`== AÇÃO DESEJADA NO FIM ==\n${o.cta}`); }

  linhas.push('');
  linhas.push('== O QUE FAZ ISTO FUNCIONAR EM VÍDEO ==');
  linhas.push('- O primeiro segundo responde "por que eu pararia?". Não com promessa de que algo bom vem depois: com algo acontecendo agora.');
  linhas.push('- O meio responde "por que eu continuaria?". A cada trecho, uma informação nova que muda o que se sabia — nunca a mesma ideia repetida com outras palavras.');
  linhas.push('- O fim responde "por que valeu a pena?". Entregue o que a abertura prometeu, e entregue de um jeito que não dava para adivinhar no começo.');
  linhas.push('- Nada de gancho artificial grudado na frente. A própria história começa no ponto mais interessante — é ela o gancho.');
  linhas.push('');
  // Quando a leitura não conseguiu nem deduzir, o roteirista não pode nem
  // inventar nem anunciar a falta: escreve com o que existe. Antes disso, a
  // ferramenta parava e cobrava a resposta do usuário — o formulário voltando
  // pela porta dos fundos.
  const faltando = ['desejo', 'obstaculo', 'risco'].filter((k) => !p[k]);
  if (faltando.length) {
    linhas.push('');
    linhas.push('== O QUE O MATERIAL NÃO ENTREGOU ==');
    linhas.push(`Não foi possível deduzir: ${faltando.join(', ')}.`);
    linhas.push('Escreva assim mesmo, com o que existe. Não invente fato para tapar o buraco e NÃO comente a ausência no texto — faça o peso da história aparecer pelo que o material dá.');
  }

  linhas.push('');
  linhas.push('== REGRAS DE ESCRITA ==');
  linhas.push('1. Use apenas os fatos acima. Não invente número, nome, data nem citação.');
  linhas.push('2. Frases curtas. Voz ativa. Corte todo adjetivo que não muda o sentido.');
  linhas.push('3. Cada frase precisa de uma razão para existir. Se dá para cortar sem perder nada, ela não deveria estar lá.');
  linhas.push('4. Escreva o que sai da boca, não a descrição do que a câmera vê.');
  linhas.push('5. No máximo 2 emojis no total, e só se o tom pedir.');
  linhas.push('6. Devolva SOMENTE o roteiro. Sem introdução, sem explicação, sem comentário sobre o texto.');

  return linhas.join('\n');
}

/** Etapa 3 — CRÍTICO + DIRETOR DE RETENÇÃO + ESPECIALISTA EM DIÁLOGOS. */
function buildCriticaPrompt(roteiro, plano, achadosLocais) {
  const linhas = [];
  linhas.push('Você é um leitor crítico de roteiros de vídeo curto. Rigoroso e específico.');
  linhas.push('Trabalha em três funções ao mesmo tempo: diretor de retenção (ritmo, abertura, progressão), especialista em diálogos (naturalidade das falas) e crítico (pontos fracos).');
  linhas.push('Você NÃO reescreve. Aponta.');
  linhas.push('');
  linhas.push('Elogio genérico não serve para nada. Para cada problema, cite o TRECHO exato e diga o que fazer com ele.');
  linhas.push('');
  const p = plano || {};
  linhas.push('== A HISTÓRIA QUE O ROTEIRO DEVERIA CONTAR ==');
  if (p.protagonista) linhas.push(`Protagonista: ${p.protagonista}`);
  if (p.desejo) linhas.push(`Quer: ${p.desejo}`);
  if (p.obstaculo) linhas.push(`Impede: ${p.obstaculo}`);
  if (p.risco) linhas.push(`Em jogo: ${p.risco}`);
  if (p.comecaEm) linhas.push(`Deveria começar em: ${p.comecaEm}`);
  linhas.push('');
  linhas.push('== ROTEIRO A CRITICAR ==');
  linhas.push(String(roteiro || ''));
  linhas.push('');

  if ((achadosLocais || []).length) {
    linhas.push('== JÁ CONSTATADO NA CONFERÊNCIA AUTOMÁTICA (não é opinião, é medição) ==');
    achadosLocais.forEach((a) => linhas.push('- ' + a.texto));
    linhas.push('Não repita estes pontos: procure o que a medição não alcança — sentido, ritmo, verdade das falas, previsibilidade.');
    linhas.push('');
  }

  linhas.push('== RESPONDA A CADA PERGUNTA ==');
  NARR_CRITERIOS.forEach((c) => linhas.push(`- ${c.id}: ${c.pergunta}`));
  linhas.push('');
  linhas.push('Para cada uma: veredito "ok" ou "falha", e — quando for falha — o trecho problemático e a correção concreta.');
  linhas.push('');
  linhas.push('Devolva SOMENTE JSON, sem cercas:');
  linhas.push('{');
  linhas.push('  "avaliacoes": [{ "id": "ponto-de-entrada", "veredito": "falha", "trecho": "o trecho exato", "correcao": "o que fazer" }],');
  linhas.push('  "vale_reescrever": true,');
  linhas.push('  "resumo": "em uma frase, o que mais atrapalha este roteiro"');
  linhas.push('}');
  return linhas.join('\n');
}

/** Etapa 4 — EDITOR + REVISOR FINAL: reescreve corrigindo o que foi apontado. */
function buildReescritaPrompt(roteiro, critica, achadosLocais, plano, opcoes) {
  const o = opcoes || {};
  const falhas = ((critica && critica.avaliacoes) || []).filter((a) => a && a.veredito === 'falha');
  const linhas = [];

  linhas.push('Você é editor de roteiro. Recebe um rascunho e uma lista de defeitos, e devolve a versão corrigida.');
  linhas.push('Não é uma história nova: é ESTA história, sem os defeitos.');
  linhas.push('');
  linhas.push('== RASCUNHO ==');
  linhas.push(String(roteiro || ''));
  linhas.push('');

  if ((achadosLocais || []).length) {
    linhas.push('== CONSTATADO NA CONFERÊNCIA AUTOMÁTICA (corrija todos) ==');
    achadosLocais.forEach((a) => linhas.push('- ' + a.texto));
    linhas.push('');
  }
  if (falhas.length) {
    linhas.push('== APONTADO NA LEITURA CRÍTICA ==');
    falhas.forEach((f) => {
      const trecho = f.trecho ? ` (em: "${String(f.trecho).slice(0, 140)}")` : '';
      linhas.push(`- [${f.id}]${trecho}: ${f.correcao || 'corrigir'}`);
    });
    linhas.push('');
  }
  if (critica && critica.resumo) {
    linhas.push(`== O QUE MAIS ATRAPALHA ==\n${critica.resumo}`);
    linhas.push('');
  }

  const p = plano || {};
  if ((p.fatos || []).length) {
    linhas.push('== FATOS PERMITIDOS (a única fonte) ==');
    p.fatos.forEach((x) => linhas.push('- ' + x));
    linhas.push('');
  }

  linhas.push('== COMO REESCREVER ==');
  linhas.push('- Corrija cada ponto acima. O que já estava bom permanece.');
  linhas.push('- Não invente fato, número, nome nem citação para resolver um problema. Se falta informação, resolva com o que existe.');
  linhas.push('- Não troque a história por outra, não mude o desfecho e não acrescente personagem.');
  linhas.push('- Mantenha a mesma marcação de entrega do rascunho (tempos, slides, numeração — o que houver).');
  if (o.formato && o.formato.label) linhas.push(`- Formato: ${o.formato.label}.`);
  linhas.push('- Cada frase precisa de uma razão para existir. Se sobrou enchimento, corte.');
  linhas.push('');
  linhas.push('Devolva SOMENTE o roteiro final. Sem introdução, sem explicação, sem lista do que mudou.');
  return linhas.join('\n');
}

/* -------------------------------------------------------------------------- */
/* §4 — Normalizadores: o que volta da IA nunca é confiável                    */
/* -------------------------------------------------------------------------- */

function _narrTexto(v) { return (v == null) ? '' : String(v).trim(); }
function _narrLista(v) {
  if (Array.isArray(v)) return v.map(_narrTexto).filter(Boolean);
  const s = _narrTexto(v);
  return s ? [s] : [];
}

function normalizarPlano(obj, material) {
  const o = obj || {};
  const est = o.estrutura || {};
  return {
    fatos: _narrLista(o.fatos),
    protagonista: _narrTexto(o.protagonista),
    desejo: _narrTexto(o.desejo),
    obstaculo: _narrTexto(o.obstaculo),
    risco: _narrTexto(o.risco),
    personagens: (Array.isArray(o.personagens) ? o.personagens : [])
      .filter((p) => p && _narrTexto(p.nome))
      .slice(0, 8)
      .map((p) => ({
        nome: _narrTexto(p.nome),
        quer: _narrTexto(p.quer),
        jeitoDeFalar: _narrTexto(p.jeitoDeFalar),
        sabe: _narrTexto(p.sabe),
      })),
    natureza: _narrTexto(o.natureza),
    comecaEm: _narrTexto(o.comecaEm),
    porqueComecaAi: _narrTexto(o.porqueComecaAi),
    estrutura: {
      nome: _narrTexto(est.nome),
      porque: _narrTexto(est.porque),
      beats: _narrLista(est.beats),
    },
    mostrar: _narrLista(o.mostrar),
    naoTem: _narrTexto(o.naoTem),
    material: _narrTexto(material),
  };
}

function normalizarCritica(obj) {
  const o = obj || {};
  const validos = NARR_CRITERIOS.map((c) => c.id);
  const avaliacoes = (Array.isArray(o.avaliacoes) ? o.avaliacoes : [])
    .filter((a) => a && validos.indexOf(_narrTexto(a.id)) >= 0)
    .map((a) => ({
      id: _narrTexto(a.id),
      veredito: _narrTexto(a.veredito).toLowerCase() === 'falha' ? 'falha' : 'ok',
      trecho: _narrTexto(a.trecho),
      correcao: _narrTexto(a.correcao),
    }));
  return {
    avaliacoes,
    falhas: avaliacoes.filter((a) => a.veredito === 'falha'),
    resumo: _narrTexto(o.resumo),
    valeReescrever: o.vale_reescrever === true || avaliacoes.some((a) => a.veredito === 'falha'),
  };
}

/* -------------------------------------------------------------------------- */
/* §5 — O motor                                                               */
/* -------------------------------------------------------------------------- */

/* Quantas reescritas no máximo. Duas porque a segunda existe para o caso de a
 * primeira ter corrigido o texto e quebrado outra coisa; da terceira em diante
 * o ganho não paga a espera de quem está olhando para a tela. */
const NARR_MAX_REESCRITAS = 2;

/**
 * Roda o motor inteiro: leitura → escrita → crítica → reescrita → validação.
 *
 * @param {object} opts
 *   material   texto bruto do usuário (única fonte de fatos)
 *   formato/tom/tamanho  objetos do catálogo (entrega, não estrutura)
 *   perfil, cta, lema
 *   onEtapa(chave, titulo, desc)  progresso para a interface
 *   call(prompt)  a chamada de IA — injetável, é o que torna o motor testável
 * @returns {Promise<object>} { conteudo, plano, rascunho, critica, achados, etapas }
 */
async function runNarrativaPipeline(opts) {
  const o = opts || {};
  const chamar = o.call || (typeof callLLM === 'function' ? callLLM : null);
  if (!chamar) throw new Error('Sem função de chamada de IA.');
  const material = String(o.material || '').trim();
  const etapa = (k, t, d) => { if (typeof o.onEtapa === 'function') o.onEtapa(k, t, d); };
  const lerJSON = (r) => (typeof extractJSON === 'function' ? extractJSON(r && r.content) : null);
  const etapas = [];
  let modelo = '';

  // 1) LEITURA — analista + arquiteto. Se falhar, não há história para escrever:
  //    o erro sobe e o usuário vê a mensagem, em vez de receber texto genérico.
  etapa('leitura', 'Lendo o material…', 'Entendendo o que aconteceu e quem está nisso.');
  const rLeitura = await chamar(buildLeituraPrompt(material, o.lema));
  modelo = (rLeitura && rLeitura.model) || modelo;
  const plano = normalizarPlano(lerJSON(rLeitura), material);
  etapas.push('leitura');

  // Porta de saída: quem chama pode olhar o plano e decidir que não há história
  // aqui — é o que sustenta a pergunta focada da interface, sem gastar as três
  // chamadas seguintes num material que ainda não dá história.
  if (typeof o.aposLeitura === 'function' && o.aposLeitura(plano) === false) {
    return { abortado: true, plano, etapas, model: modelo, conteudo: '' };
  }

  // 2) ESCRITA — roteirista, seguindo o desenho que a leitura decidiu.
  etapa('escrita', 'Escrevendo…', plano.estrutura.nome ? `Desenho: ${plano.estrutura.nome}.` : 'Montando a cena.');
  const rEscrita = await chamar(buildRoteiroPrompt(plano, o));
  modelo = (rEscrita && rEscrita.model) || modelo;
  const rascunho = _narrLimpar(rEscrita && rEscrita.content);
  if (!rascunho) throw new Error('A IA não devolveu roteiro.');
  etapas.push('escrita');

  let atual = rascunho;
  let critica = null;
  let achados = criticarRoteiroLocal(atual, plano, { material, cta: o.cta });

  for (let volta = 0; volta < NARR_MAX_REESCRITAS; volta++) {
    // 3) CRÍTICA — só na primeira volta gasta uma chamada de IA. Na segunda, o
    //    que sobrou é o que a conferência automática ainda aponta: perguntar de
    //    novo a mesma coisa custaria tempo e traria a mesma resposta.
    if (volta === 0) {
      etapa('critica', 'Lendo com olhos de crítico…', 'Abertura, ritmo, falas e pontos fracos.');
      try {
        const rCrit = await chamar(buildCriticaPrompt(atual, plano, achados.achados));
        critica = normalizarCritica(lerJSON(rCrit));
        etapas.push('critica');
      } catch (_) {
        // Crítica é melhoria, não requisito: sem ela seguimos com a conferência
        // automática, que é o que nunca falha.
        critica = normalizarCritica(null);
      }
    }

    const precisa = achados.achados.length || (critica && critica.falhas.length);
    if (!precisa) break;

    // 4) REESCRITA — editor + revisor final.
    etapa('reescrita', 'Reescrevendo…', 'Corrigindo o que a leitura crítica apontou.');
    let novo = '';
    try {
      const rRe = await chamar(buildReescritaPrompt(atual, critica, achados.achados, plano, o));
      modelo = (rRe && rRe.model) || modelo;
      novo = _narrLimpar(rRe && rRe.content);
    } catch (_) { novo = ''; }
    if (!novo) break;                       // falhou a reescrita: fica o que havia

    // 5) VALIDAÇÃO — a reescrita precisa MELHORAR. Duas travas:
    //    a) não pode inventar número que nem o material nem o rascunho tinham;
    //    b) não pode sair com mais problemas graves do que entrou.
    const inventou = narrFatosInventados(novo, material + '\n' + atual);
    const achadosNovos = criticarRoteiroLocal(novo, plano, { material, cta: o.cta });
    const piorou = achadosNovos.graves.length > achados.graves.length;
    if (inventou.length || piorou) {
      etapas.push('reescrita-descartada');
      break;                                 // fica a versão anterior, inteira
    }

    atual = novo;
    achados = achadosNovos;
    etapas.push('reescrita');
    if (achados.ok) break;
  }

  etapa('pronto', 'Pronto.', 'Roteiro final.');
  return {
    conteudo: atual,
    rascunho,
    plano,
    critica,
    achados,
    reescreveu: atual !== rascunho,
    etapas,
    model: modelo,
  };
}

/** Tira cercas de código e comentários que o modelo às vezes cola em volta. */
function _narrLimpar(texto) {
  let t = String(texto == null ? '' : texto).trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  return (typeof cleanText === 'function') ? cleanText(t).trim() : t.trim();
}
