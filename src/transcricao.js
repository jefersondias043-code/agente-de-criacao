'use strict';
/* ============================================================================
 * TRANSCRIÇÃO — organizar o texto que sai de um arquivo
 *
 * O que o Whisper devolve é fala corrida: sem pontuação confiável, sem quebra
 * de fala, com número em algarismo, nome próprio em minúscula e as concordâncias
 * que a boca faz e a escrita não perdoa. Um texto assim atrapalha duas vezes —
 * a pessoa não consegue reler, e a IA que vai trabalhar em cima dele gasta
 * atenção decifrando em vez de julgando.
 *
 * Esta etapa organiza. NÃO reescreve.
 *
 * A DISTINÇÃO QUE GOVERNA O TRABALHO, e ela é toda a segurança daqui:
 *
 *   ORGANIZAR é dar forma ao que já está dito — pontuar, separar quem fala,
 *   escrever o número por extenso, arrumar a concordância, pôr maiúscula em
 *   nome próprio, quebrar em parágrafos. Nada disso muda o que foi dito.
 *
 *   REESCREVER é mexer no conteúdo — acrescentar uma fala que ninguém disse,
 *   explicar o que está subentendido, resumir, melhorar a piada, narrar o que
 *   aconteceu entre uma fala e outra. Isso é proibido, sempre.
 *
 * Por que a proibição é séria e não decorativa: no Julgador, uma frase
 * inventada seria julgada como se estivesse no vídeo — a banca apontaria um
 * problema que não existe, ou deixaria de apontar um que existe. Nos Causos, um
 * fato inventado viraria matéria-prima da história. Em ambos, o estrago é
 * invisível: o texto fica ótimo e está errado.
 *
 * A IA recebe a instrução; o CÓDIGO confere o que dá para conferir. Nenhuma
 * fatia entra no lugar da original sem passar pela conferência, e o que não
 * passa é descartado — fica o texto cru, que é feio mas é verdadeiro.
 * ========================================================================== */

/* O modelo tem teto de saída (4096 tokens na Groq). Um trecho de ~3000
 * caracteres sai folgado abaixo disso mesmo depois de ganhar pontuação e
 * quebras — e fatiar é o que impede a resposta de ser cortada no meio, que é a
 * forma mais comum de "sumir" metade da transcrição. */
const TRANSC_MAX_CHARS = 3000;

/** Vale a pena organizar? Texto curtinho não tem o que estruturar. */
function transcricaoVale(texto) {
  return String(texto || '').trim().length >= 200;
}

/**
 * Fatia o texto em pedaços de no máximo `TRANSC_MAX_CHARS`, cortando em fim de
 * frase quando dá. Cortar no meio de uma frase faria a fatia seguinte começar
 * sem contexto e a IA "consertar" o começo inventando.
 */
function transcricaoFatiar(texto, maxChars) {
  const limite = maxChars || TRANSC_MAX_CHARS;
  const t = String(texto || '').trim();
  if (!t) return [];
  if (t.length <= limite) return [t];

  // Unidades de corte: preferimos fim de frase; sem pontuação (o caso comum
  // numa transcrição crua), caímos para palavras.
  const unidades = t.split(/(?<=[.!?…])\s+/);
  const fatias = [];
  let atual = '';
  const empurrar = (parte) => {
    if (!atual) { atual = parte; return; }
    if ((atual + ' ' + parte).length <= limite) { atual += ' ' + parte; return; }
    fatias.push(atual);
    atual = parte;
  };

  unidades.forEach((u) => {
    if (u.length <= limite) { empurrar(u); return; }
    // Uma "frase" maior que o limite: transcrição sem pontuação nenhuma.
    // Quebra por palavra, que é o melhor corte disponível.
    let bloco = '';
    u.split(/\s+/).forEach((p) => {
      if ((bloco + ' ' + p).trim().length > limite) { empurrar(bloco.trim()); bloco = p; }
      else bloco = (bloco + ' ' + p).trim();
    });
    if (bloco) empurrar(bloco);
  });
  if (atual) fatias.push(atual);
  return fatias;
}

/* -------------------------------------------------------------------------- */
/* A conferência — o que o código consegue verificar sozinho                   */
/* -------------------------------------------------------------------------- */

function _tNorm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}
function _tPalavras(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean);
}

/* Palavras sem carga não servem para comparar duas versões do mesmo texto:
 * entram e saem com a pontuação. */
const TRANSC_VAZIAS = new Set([
  'que', 'para', 'com', 'uma', 'nao', 'por', 'mais', 'como', 'mas', 'dos', 'das',
  'nas', 'nos', 'pelo', 'pela', 'isso', 'esse', 'essa', 'este', 'esta', 'ele',
  'ela', 'eles', 'elas', 'voce', 'seu', 'sua', 'meu', 'minha', 'aqui', 'ali',
  'muito', 'quando', 'onde', 'porque', 'entao', 'tambem', 'ainda', 'depois',
  'antes', 'sobre', 'tem', 'ter', 'foi', 'ser', 'esta', 'estava', 'era', 'sao',
]);

function _tConteudo(texto) {
  return _tNorm(texto).split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !TRANSC_VAZIAS.has(w));
}

/* Números em algarismo viram extenso — é o que a pessoa diz em voz alta, e o
 * exemplo que motivou esta etapa faz exatamente isso. Escrever por extenso é
 * ORGANIZAR (a mesma quantidade, outra grafia), então a conferência precisa
 * saber disso para não acusar invenção onde houve conversão. */
const TRANSC_NUMERO_EXTENSO = new Set([
  'zero', 'um', 'uma', 'dois', 'duas', 'tres', 'quatro', 'cinco', 'seis', 'sete',
  'oito', 'nove', 'dez', 'onze', 'doze', 'treze', 'catorze', 'quatorze', 'quinze',
  'dezesseis', 'dezessete', 'dezoito', 'dezenove', 'vinte', 'trinta', 'quarenta',
  'cinquenta', 'sessenta', 'setenta', 'oitenta', 'noventa', 'cem', 'cento',
  'duzentos', 'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos',
  'setecentos', 'oitocentos', 'novecentos', 'mil', 'milhao', 'milhoes',
  'milhares', 'bilhao', 'bilhoes', 'meia', 'dezena', 'dezenas', 'centena',
  'centenas', 'primeiro', 'segundo', 'terceiro',
]);

/* VERBO DE FALA — o que o travessão substitui.
 *
 * O prompt manda, com todas as letras, "separar QUEM FALA: cada fala numa linha
 * própria, começando com travessão (—)". Quando o modelo obedece, "aí o vizinho
 * FALOU vizinho me compra esse relógio e eu FALEI quanto e ele DISSE cinquenta"
 * vira quatro linhas de diálogo — e os verbos de fala somem, porque é
 * exatamente isso que o travessão faz: ele É o "fulano falou".
 *
 * A conferência contava esses verbos como palavras apagadas e REPROVAVA a
 * fatia. O texto voltava cru, sem aviso nenhum, toda vez que a transcrição
 * tinha diálogo — que é o caso mais comum em causo, entrevista e história
 * contada. A ferramenta brigava com a própria instrução.
 *
 * Ficam de fora daqui os verbos que carregam conteúdo além do ato de falar
 * ("contou", "pediu", "mandou", "chamou"): esses somem por resumo, não por
 * formatação, e a conferência precisa continuar pegando isso. */
const TRANSC_VERBO_DE_FALA = new Set([
  'falou', 'falei', 'falamos', 'falaram', 'falava', 'falavam', 'falando',
  'disse', 'dissi', 'disseram', 'dizia', 'diziam', 'dizendo', 'dizer',
  'respondeu', 'respondi', 'responderam', 'respondia', 'respondendo',
  'perguntou', 'perguntei', 'perguntaram', 'perguntava', 'perguntando',
  'gritou', 'gritei', 'gritaram', 'gritava', 'gritando',
  'retrucou', 'emendou', 'exclamou', 'indagou', 'replicou', 'comentou',
  'murmurou', 'sussurrou', 'berrou', 'balbuciou', 'completou',
]);

/* O texto organizado virou DIÁLOGO? Só então a isenção acima se aplica — e é o
 * que a mantém estreita: sem travessão de fala no resultado, nenhum verbo é
 * perdoado, e a conferência segue tão dura quanto era. */
function transcricaoVirouDialogo(novo) {
  return /(^|\n)\s*[—–-]\s+\S/.test(String(novo || ''));
}

/* Preâmbulo de assistente. O modelo às vezes entrega "Aqui está o texto
 * corrigido:" antes do texto — e isso entraria no roteiro como se fosse fala. */
const TRANSC_PREAMBULO = /^\s*(aqui est[áa][^\n:]{0,40}:|segue[^\n:]{0,40}:|texto (corrigido|organizado|revisado)[^\n:]{0,20}:|claro[!,.][^\n]{0,60}:)\s*/i;

function transcricaoSemPreambulo(texto) {
  let t = String(texto || '').trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '').trim();
  const antes = t;
  t = t.replace(TRANSC_PREAMBULO, '').trim();
  return { texto: t, tinhaPreambulo: t !== antes };
}

/**
 * A fatia organizada pode entrar no lugar da original?
 *
 * O que dá para verificar mecanicamente são os estragos GRANDES, e são eles que
 * importam: o modelo resumir em vez de organizar, alucinar um trecho inteiro,
 * ou ter a resposta cortada pelo teto de saída — que apagaria o fim do texto
 * sem avisar ninguém.
 *
 * O que NÃO dá para pegar assim é o acréscimo pequeno: uma fala curta, montada
 * com as mesmas palavras que já estão no texto, não move nenhuma destas contas.
 * Contra isso só existe a instrução no prompt — e é por isso que ela é tão
 * insistente lá.
 */
function conferirTranscricao(original, limpo) {
  const problemas = [];
  const orig = String(original || '');
  const novo = String(limpo || '');
  if (!novo.trim()) return { ok: false, problemas: ['a IA não devolveu texto.'] };

  /* Virou diálogo? Então o travessão comeu os "fulano falou" de propósito, e as
   * duas contas abaixo precisam saber disso — senão a conferência reprova
   * justamente o trabalho que o prompt pediu. */
  const dialogo = transcricaoVirouDialogo(novo);

  const pOrig = _tPalavras(orig).length;
  const pNovo = _tPalavras(novo).length;
  const proporcao = pOrig ? pNovo / pOrig : 1;

  // Encolher é resumo ou resposta cortada. Crescer muito é invenção.
  // Em diálogo o piso cede: cada travessão substitui de duas a quatro palavras
  // ("aí o vizinho falou"), então o texto encolhe de verdade sem perder nada.
  const piso = dialogo ? 0.55 : 0.75;
  if (proporcao < piso) {
    problemas.push(`o texto encolheu de ${pOrig} para ${pNovo} palavras — isso é resumo ou resposta cortada, não organização.`);
  } else if (proporcao > 1.35) {
    problemas.push(`o texto cresceu de ${pOrig} para ${pNovo} palavras — organizar não acrescenta conteúdo.`);
  }

  // O que estava dito continua dito? Números em algarismo saem da conta: eles
  // viram extenso de propósito — e verbo de fala também, quando virou diálogo.
  const doOriginal = [...new Set(_tConteudo(orig))]
    .filter((w) => !/^\d+$/.test(w))
    .filter((w) => !(dialogo && TRANSC_VERBO_DE_FALA.has(w)));
  if (doOriginal.length >= 10) {
    const noNovo = new Set(_tConteudo(novo));
    const sumiram = doOriginal.filter((w) => !noNovo.has(w));
    const retencao = 1 - (sumiram.length / doOriginal.length);
    if (retencao < 0.85) {
      problemas.push(`${sumiram.length} de ${doOriginal.length} palavras do original sumiram (ex.: "${sumiram.slice(0, 6).join('", "')}") — organizar não apaga o que foi dito.`);
    }
  }

  // Vocabulário novo em volume é alucinação. Extenso de número não conta.
  const doNovo = [...new Set(_tConteudo(novo))];
  if (doNovo.length >= 10) {
    const noOriginal = new Set(_tConteudo(orig));
    const inventadas = doNovo.filter((w) => !noOriginal.has(w) && !TRANSC_NUMERO_EXTENSO.has(w));
    if (inventadas.length / doNovo.length > 0.2) {
      problemas.push(`${inventadas.length} palavras que não existiam no original (ex.: "${inventadas.slice(0, 6).join('", "')}") — isso é reescrita, não organização.`);
    }
  }

  return { ok: problemas.length === 0, problemas, proporcao };
}

/* -------------------------------------------------------------------------- */
/* O prompt                                                                    */
/* -------------------------------------------------------------------------- */

function buildTranscricaoPrompt(trecho, opcoes) {
  const o = opcoes || {};
  const linhas = [];
  linhas.push('Você organiza transcrições de áudio em português do Brasil. Você NÃO é revisor de estilo nem roteirista: você dá forma ao que já está dito.');
  linhas.push('');
  linhas.push('== A DISTINÇÃO QUE DECIDE ESTE TRABALHO ==');
  linhas.push('ORGANIZAR é dar forma ao que já está no texto. É o seu trabalho, e você faz sem pedir licença:');
  linhas.push('- pontuar: ponto, vírgula, interrogação, exclamação, reticências onde a fala pede;');
  linhas.push('- separar QUEM FALA: cada fala numa linha própria, começando com travessão (—). Uma conversa vira diálogo legível;');
  linhas.push('- maiúscula em nome próprio, apelido e tratamento (seu sabido → Seu Sabido; zé → Zé);');
  linhas.push('- número em algarismo vira extenso, como se diz em voz alta (50 reais → cinquenta reais; 30 dias → trinta dias);');
  linhas.push('- concordância e regência que a boca atropela (banhada a ouro → banhado a ouro; pagar a vista → pagar à vista);');
  linhas.push('- palavra que o transcritor entendeu errado, quando o certo é ÓBVIO pelo contexto;');
  linhas.push('- parágrafos: quebre onde o assunto muda.');
  linhas.push('');
  linhas.push('REESCREVER é mexer no CONTEÚDO. É proibido, sem exceção:');
  linhas.push('- NÃO acrescente nenhuma fala que não esteja no texto, nem uma palavra dela — nem que a conversa pareça incompleta, nem que "ficaria melhor assim";');
  linhas.push('- NÃO acrescente narração, descrição de cena, rubrica, nem frases do tipo "pouco depois" ou "então ele percebeu";');
  linhas.push('- NÃO resuma, não corte, não junte duas falas numa;');
  linhas.push('- NÃO explique o que ficou subentendido, não melhore a piada, não conserte o argumento de ninguém;');
  linhas.push('- NÃO troque o jeito de falar por português formal. "Tô", "pra", "cê", "vixe", "num sei" FICAM. Gíria e regionalismo são o texto, não erro.');
  linhas.push('');
  linhas.push('A prova: alguém que ouvisse o áudio junto com o seu texto na mão não deveria encontrar NENHUMA palavra que não tenha sido dita.');
  linhas.push('Se um trecho estiver truncado ou incompreensível, deixe como está. Texto confuso é melhor do que texto inventado.');
  linhas.push('');
  if (o.parte && o.total > 1) {
    linhas.push(`(Este é o trecho ${o.parte} de ${o.total} de uma transcrição maior. Ele pode começar e terminar no meio de uma conversa — está certo. Não escreva introdução nem fecho, e não tente "completar" a ponta.)`);
    linhas.push('');
  }
  linhas.push('== O TRECHO ==');
  linhas.push(String(trecho || ''));
  linhas.push('');
  linhas.push('Devolva SOMENTE o texto organizado. Sem título, sem comentário, sem "aqui está", sem explicar o que você mudou.');
  return linhas.join('\n');
}

/* -------------------------------------------------------------------------- */
/* A etapa                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * Organiza uma transcrição. Trabalha por fatias e confere cada uma: a fatia que
 * não passa na conferência é DESCARTADA e o trecho cru dela fica no lugar.
 *
 * Falhar aqui nunca custa o anexo: sem chave, sem IA ou com erro, volta o texto
 * como veio. Organizar é melhoria, não requisito.
 *
 * @param {object} opts
 *   texto       o que saiu do arquivo
 *   call(prompt) chamada de IA — injetável; é o que torna esta etapa testável
 *   onProgress(msg)
 */
async function runLimpezaTranscricao(opts) {
  const o = opts || {};
  const original = String(o.texto || '').trim();
  const chamar = o.call || (typeof callLLM === 'function' ? callLLM : null);
  if (!original) return { texto: '', limpou: false, motivo: 'sem texto' };
  if (!chamar) return { texto: original, limpou: false, motivo: 'sem IA disponível' };
  if (!transcricaoVale(original)) return { texto: original, limpou: false, motivo: 'texto curto demais para valer a etapa' };

  const fatias = transcricaoFatiar(original, o.maxChars);
  const saida = [];
  let organizadas = 0;
  const descartes = [];

  for (let i = 0; i < fatias.length; i++) {
    if (typeof o.onProgress === 'function') {
      o.onProgress(fatias.length > 1
        ? `Organizando o texto… ${i + 1} de ${fatias.length}`
        : 'Organizando o texto…');
    }
    let limpa = '';
    try {
      const r = await chamar(buildTranscricaoPrompt(fatias[i], { parte: i + 1, total: fatias.length }));
      limpa = transcricaoSemPreambulo(r && r.content).texto;
    } catch (e) {
      descartes.push({ parte: i + 1, problemas: [(e && e.message) || 'a chamada falhou'] });
      saida.push(fatias[i]);
      continue;
    }
    const conf = conferirTranscricao(fatias[i], limpa);
    if (conf.ok) { saida.push(limpa); organizadas++; }
    else { descartes.push({ parte: i + 1, problemas: conf.problemas }); saida.push(fatias[i]); }
  }

  return {
    texto: saida.join('\n\n'),
    limpou: organizadas > 0,
    partes: fatias.length,
    organizadas,
    descartes,
    // Nenhuma fatia passou: o resultado é o texto cru, e quem chamou precisa
    // poder dizer isso em vez de anunciar uma organização que não houve.
    motivo: organizadas ? '' : (descartes[0] && descartes[0].problemas[0]) || 'nada a organizar',
  };
}
