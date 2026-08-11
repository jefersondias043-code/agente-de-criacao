'use strict';
/* ============================================================================
 * JULGADOR — a banca que lê antes de publicar
 *
 * A pergunta que esta ferramenta responde NÃO é "isso vai viralizar?". Ninguém
 * responde isso antes de publicar, e fingir que responde é dar falsa precisão a
 * um chute. A pergunta é outra, e é respondível:
 *
 *     "Este conteúdo está forte o bastante para publicar? Onde ele é fraco?
 *      O que eu deveria corrigir ANTES de publicar?"
 *
 * Por isso aqui não existe "87% de chance de viralizar". Existe um veredito de
 * três estados, uma lista priorizada do que consertar, e — a informação mais
 * útil de todas — a resposta a "se eu só puder mudar uma coisa, qual seria?".
 *
 * O QUE ESTA BANCA NÃO FAZ: escrever. Nenhum avaliador reescreve nada. Eles
 * julgam, cada um pela sua lente, e o conteúdo continua sendo do autor. Essa é
 * a diferença de desenho em relação à mesa do Causos, onde os agentes criam.
 *
 * E, como lá, a desconfiança que governa a arquitetura é a mesma:
 *
 *   • os AVALIADORES são chamadas separadas e independentes. Nenhum vê a nota
 *     do outro — avaliação que lê avaliação vira eco, e a banca inteira passa a
 *     ter uma opinião só.
 *   • o JUIZ É CÓDIGO. Ele não opina: recebe as notas, aplica a regra e decide.
 *     Um juiz de LLM erraria a conta e perdoaria o que não deve.
 *   • parte da conferência é MEDIDA, não julgada: o tempo até o gancho, a
 *     repetição de informação, o CTA artificial, a promessa da capa. Isso não
 *     depende de a IA ser honesta — e é o que produz apontamento com minuto e
 *     segundo, em vez de "a retenção poderia ser melhor".
 *
 * A REGRA ACIMA DE TODAS (a mesma do Causos): nota baixa não se esconde na
 * média. Uma dimensão em 4 reprova o conteúdo inteiro, por melhor que esteja o
 * resto — porque é ali que o espectador vai embora.
 *
 * A SEGUNDA REGRA: potencial não é garantia. A banca julga o que dá para julgar
 * no conteúdo — gancho, clareza, retenção potencial, curiosidade, naturalidade,
 * valor, embalagem. O que acontece depois de publicar depende de sinais que só
 * existem depois de publicar.
 *
 * As funções puras daqui não tocam no DOM e recebem a chamada de IA por
 * parâmetro: dá para exercitar a banca inteira com IA dublada, offline.
 * ========================================================================== */

/* -------------------------------------------------------------------------- */
/* §1 — As dimensões e os quatro eixos                                         */
/* -------------------------------------------------------------------------- */

/* `minimo` é o que sustenta a regra da média: nota abaixo disso reprova o
 * conteúdo inteiro.
 *
 * `momento` é ONDE no vídeo aquele defeito age, de 0 (antes do play — a capa e
 * o título) a 1 (o fim). Não entra na nota: entra na PRIORIDADE. Um problema de
 * abertura e um problema de encerramento com a mesma gravidade não valem a
 * mesma coisa, porque quem foi embora nos três primeiros segundos nunca chegou
 * ao encerramento. É o que faz a ferramenta responder "se eu só puder mudar uma
 * coisa" com a coisa certa.
 *
 * Os mínimos não são iguais de propósito. `impacto` e `embalagem` cobram alto
 * porque decidem se o vídeo é assistido; `compartilhamento` e `comentarios`
 * cobram baixo porque nem todo conteúdo bom precisa ser compartilhável — exigir
 * isso empurraria tudo para a isca de engajamento. */
const JULG_DIMENSOES = [
  { id: 'impacto', label: 'Primeiro impacto', eixo: 'atencao', minimo: 7, momento: 0.02,
    pergunta: 'Nos primeiros segundos, existe motivo para parar de rolar o feed?' },
  { id: 'clareza', label: 'Clareza', eixo: 'qualidade', minimo: 7, momento: 0.10,
    pergunta: 'Dá para entender do que se trata sem esforço?' },
  { id: 'curiosidade', label: 'Curiosidade', eixo: 'atencao', minimo: 6, momento: 0.20,
    pergunta: 'Fica alguma pergunta aberta que dá vontade de ver respondida?' },
  { id: 'retencao', label: 'Retenção potencial', eixo: 'atencao', minimo: 7, momento: 0.40,
    pergunta: 'Depois que começou, existe motivo para continuar até o fim?' },
  { id: 'historia', label: 'História', eixo: 'qualidade', minimo: 6, momento: 0.50,
    pergunta: 'Existe progressão — as coisas se puxam, ou apenas se sucedem?' },
  { id: 'naturalidade', label: 'Naturalidade', eixo: 'qualidade', minimo: 7, momento: 0.50,
    pergunta: 'Parece gente falando, ou parece texto gerado?' },
  { id: 'valor', label: 'Valor entregue', eixo: 'reacao', minimo: 7, momento: 0.75,
    pergunta: 'Quem assistiu ganhou alguma coisa — informação, emoção, surpresa, graça?' },
  { id: 'compartilhamento', label: 'Compartilhamento', eixo: 'distribuicao', minimo: 5, momento: 0.90,
    pergunta: 'Existe uma razão real para mandar isso para alguém?' },
  { id: 'comentarios', label: 'Reação', eixo: 'reacao', minimo: 5, momento: 0.95,
    pergunta: 'O conteúdo provoca alguma coisa — opinião, discordância, identificação?' },
  { id: 'embalagem', label: 'Embalagem', eixo: 'distribuicao', minimo: 7, momento: 0.00,
    pergunta: 'A promessa do título e da capa é cumprida pelo vídeo?' },
];

function julgDimensao(id) {
  return JULG_DIMENSOES.find((d) => d.id === id) || null;
}

/* Os quatro eixos. Existem porque "qualidade" e "potencial" são coisas
 * diferentes: um vídeo pode ser muito bem produzido e pouco interessante, ou
 * mal produzido e interessantíssimo — e o segundo costuma ir melhor. Separar
 * impede que um compense o outro numa nota só. */
const JULG_EIXOS = [
  { id: 'qualidade', label: 'Qualidade editorial', pergunta: 'É bom?' },
  { id: 'atencao', label: 'Potencial de atenção', pergunta: 'Prende?' },
  { id: 'reacao', label: 'Potencial de reação', pergunta: 'Provoca alguma coisa?' },
  { id: 'distribuicao', label: 'Potencial de distribuição', pergunta: 'Tem por que circular?' },
];

/* -------------------------------------------------------------------------- */
/* §2 — Conferência medida (roda no código, sem IA)                            */
/* -------------------------------------------------------------------------- */

function _jNorm(s) {
  return String(s == null ? '' : s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function _jFrases(texto) {
  return String(texto || '')
    .split(/(?<=[.!?…])\s+|\n+/)
    .map((f) => f.trim())
    .filter((f) => f.length > 1);
}

function _jPalavras(texto) {
  return String(texto || '').trim().split(/\s+/).filter(Boolean);
}

/* Fala corrida em português brasileiro fica perto de 2,6 palavras por segundo.
 * É estimativa, e está aqui declarada como tal: serve para dizer "por volta de
 * 00:17", que é acionável, e não para cronometrar. Um roteiro não tem duração —
 * tem duração provável. */
const JULG_PALAVRAS_POR_SEGUNDO = 2.6;

function julgSegundos(palavras) {
  return Number(palavras || 0) / JULG_PALAVRAS_POR_SEGUNDO;
}

/** Segundos → "01:07". É o formato em que o apontamento vira acionável. */
function julgMomento(segundos) {
  const s = Math.max(0, Math.round(Number(segundos) || 0));
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}

/* Palavras sem carga: entram em qualquer frase e por isso não servem para
 * comparar duas frases nem para medir novidade. */
const JULG_VAZIAS = new Set([
  'que', 'para', 'com', 'uma', 'não', 'nao', 'por', 'mais', 'como', 'mas', 'dos',
  'das', 'nas', 'nos', 'pelo', 'pela', 'isso', 'esse', 'essa', 'este', 'esta',
  'ele', 'ela', 'eles', 'elas', 'você', 'voce', 'seu', 'sua', 'meu', 'minha',
  'aqui', 'ali', 'lá', 'la', 'muito', 'quando', 'onde', 'porque', 'então',
  'entao', 'também', 'tambem', 'já', 'ja', 'ainda', 'depois', 'antes', 'sobre',
  'tem', 'ter', 'foi', 'ser', 'está', 'esta', 'estava', 'era', 'são', 'sao',
  'vai', 'vou', 'fazer', 'faz', 'dizer', 'disse', 'todo', 'toda', 'todos',
  'todas', 'cada', 'outro', 'outra', 'assim', 'aí', 'ai', 'só', 'so', 'bem',
]);

/** As palavras de uma frase que realmente carregam conteúdo. */
function _jConteudo(texto) {
  return _jNorm(texto).split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4 && !JULG_VAZIAS.has(w));
}

/* ---- 1. O TEMPO ATÉ O GANCHO ---------------------------------------------
 *
 * A medição mais valiosa da ferramenta, e a que produz o apontamento que o
 * autor consegue executar sozinho: "o vídeo demora 11 segundos para chegar no
 * que interessa; comece pelo acontecimento".
 *
 * Preâmbulo é o que vem ANTES do conteúdo: saudação, apresentação, anúncio do
 * que o vídeo vai fazer, pedido de inscrição. Nada disso é o vídeo — é a
 * garganta limpando. */
/* Preâmbulo PURO: saudação, apresentação, pedido de canal. Nada disso é o
 * vídeo, aconteça o que acontecer dentro da frase. */
const JULG_PREAMBULO_PURO = [
  /\b(oi|ol[áa]|fala|e a[íi]|salve|opa)\b[^.!?]{0,20}\b(gente|galera|pessoal|povo|rapaziada|fam[íi]lia)\b/i,
  /\bsejam?\s+bem[- ]vindos?\b/i,
  /\b(meu nome [ée]|eu sou o|eu sou a|aqui [ée] o|aqui quem fala)\b/i,
  /\b(bem[- ]vindos?\s+ao|de volta ao)\s+(canal|meu canal)\b/i,
  /\bmais um v[íi]deo\b/i,
  /\bantes\s+d[eo]\s+(come[çc]ar|mais nada|tudo)\b/i,
  /\b(se inscrev[ae]|deixa? o like|deixe seu like|ativa? o sininho)\b/i,
  /\b(primeiramente|antes de mais nada|s[óo] um aviso|rapidinho aqui)\b/i,
];

/* Preâmbulo de ANÚNCIO: "hoje eu vou falar sobre…", "nesse vídeo…". Este é o
 * único que uma âncora concreta resgata — "hoje eu vou te contar como o Zé
 * sumiu por três dias" anuncia E entrega, e já é o vídeo começando. Sem essa
 * distinção a medição puniria uma abertura perfeitamente boa; sem separar do
 * preâmbulo puro, um "oi gente, aqui é o Léo" escaparia por causa do nome. */
const JULG_PREAMBULO_ANUNCIO = [
  /\b(hoje|nesse|neste)\s+(eu\s+)?(v[íi]deo|v[ôo]u|vamos|vamo)\b[^.!?]{0,30}\b(falar|mostrar|contar|explicar|ensinar|trazer)\b/i,
  /\bnesse?\s+v[íi]deo\b/i,
  /\bhoje\s+eu\s+trouxe\b/i,
];

/* Número escrito. "um" fica DE FORA: é artigo muito mais vezes do que número, e
 * incluí-lo fazia "mais um vídeo" contar como âncora concreta. */
const JULG_NUMEROS_ESCRITOS = /\b(dois|duas|tr[êe]s|quatro|cinco|seis|sete|oito|nove|dez|onze|doze|quinze|vinte|trinta|quarenta|cinquenta|cem|cento|duzentos|mil|milh[ãa]o|milh[õo]es)\b/i;

function _jTemAncora(frase) {
  const s = String(frase || '');
  if (/\d/.test(s)) return true;
  if (JULG_NUMEROS_ESCRITOS.test(s)) return true;
  // Nome próprio: maiúscula que não seja a que abre a frase — toda frase começa
  // com maiúscula, então a primeira palavra nunca conta.
  return _jPalavras(s).slice(1).some((p) => /^[A-ZÁÂÃÀÉÊÍÓÔÕÚÜÇ][a-zà-ÿ]/.test(p));
}

function julgTempoAteOGancho(texto) {
  const frases = _jFrases(texto);
  const preambulo = [];
  for (let i = 0; i < frases.length; i++) {
    const f = frases[i];
    const ehPreambulo = JULG_PREAMBULO_PURO.some((re) => re.test(f))
      || (JULG_PREAMBULO_ANUNCIO.some((re) => re.test(f)) && !_jTemAncora(f));
    if (!ehPreambulo) break;
    preambulo.push(f);
  }
  const palavras = preambulo.reduce((acc, f) => acc + _jPalavras(f).length, 0);
  const segundos = julgSegundos(palavras);
  const problemas = [];
  // Três segundos é o que o feed dá antes da decisão de continuar. Acima disso,
  // o preâmbulo está consumindo a única janela que o vídeo tinha.
  if (segundos > 3) {
    problemas.push(`o vídeo leva cerca de ${Math.round(segundos)} segundos até chegar no assunto — até ${julgMomento(segundos)} é apresentação, saudação ou anúncio do que virá. Comece pelo acontecimento e corte o resto.`);
  }
  return { problemas, segundos, palavras, frases: preambulo };
}

/* ---- 2. REPETIÇÃO DE INFORMAÇÃO ------------------------------------------
 *
 * A causa mais comum de queda no meio: a informação já dada volta com outras
 * palavras. O apontamento carrega o momento da SEGUNDA ocorrência, porque é ali
 * que a pessoa sai.
 *
 * A medida é de CONTINÊNCIA, não de semelhança: "quanto da frase menor já foi
 * dito na maior". Comparar por semelhança (Jaccard) parecia mais rigoroso e não
 * era — "eu perdi a carteira no mercado" seguido de "ou seja, eu perdi a
 * carteira lá no mercado da esquina" dá 0,5 de semelhança, porque as palavras
 * novas da segunda frase entram na conta e diluem a repetição. Justo o que se
 * quer pegar era o que escapava. */
const JULG_CONTINENCIA = 0.7;

function julgRepeticao(texto) {
  const frases = _jFrases(texto);
  const conteudos = frases.map(_jConteudo);
  // Momento em que cada frase começa, em segundos.
  const inicios = [];
  let acumulado = 0;
  frases.forEach((f) => { inicios.push(julgSegundos(acumulado)); acumulado += _jPalavras(f).length; });

  const achados = [];
  for (let j = 1; j < frases.length; j++) {
    if (conteudos[j].length < 4) continue;
    for (let i = 0; i < j; i++) {
      if (conteudos[i].length < 4) continue;
      const a = new Set(conteudos[i]);
      const comuns = [...new Set(conteudos[j])].filter((w) => a.has(w));
      const menor = Math.min(new Set(conteudos[i]).size, new Set(conteudos[j]).size);
      const continencia = menor ? comuns.length / menor : 0;
      if (continencia >= JULG_CONTINENCIA) {
        achados.push({ momento: julgMomento(inicios[j]), segundos: inicios[j], frase: frases[j], repeteA: frases[i] });
        break;   // uma marcação por frase basta
      }
    }
  }
  const problemas = achados.map((a) =>
    `por volta de ${a.momento} a informação volta com outras palavras ("${a.frase.slice(0, 70)}"). Quem já entendeu na primeira vez sai aqui — corte uma das duas.`);
  return { problemas, achados };
}

/* ---- 3. EXPLICAÇÃO EXCESSIVA ---------------------------------------------- */
const JULG_REEXPLICA = [
  'ou seja', 'isto e', 'quer dizer', 'em outras palavras', 'como eu disse',
  'como eu falei', 'como ja falei', 'resumindo', 'em resumo', 'ou melhor',
  'deixa eu explicar melhor', 'explicando melhor',
];

function julgExplicacaoExcessiva(texto) {
  const t = _jNorm(texto);
  const achadas = JULG_REEXPLICA.filter((m) => t.indexOf(m) >= 0);
  const total = JULG_REEXPLICA.reduce((acc, m) => acc + t.split(m).length - 1, 0);
  const problemas = [];
  if (total >= 3) {
    problemas.push(`o texto reexplica o que já disse ${total} vezes ("${achadas.join('", "')}"). Cada reexplicação é um trecho em que quem entendeu de primeira olha para o lado.`);
  }
  return { problemas, total, achadas };
}

/* ---- 4. CTA ARTIFICIAL ----------------------------------------------------
 *
 * Pedir comentário não gera comentário: gera a sensação de estar sendo usado. O
 * que gera comentário é o conteúdo dar motivo. Por isso o pedido explícito é
 * PENALIZADO aqui, e não premiado. */
const JULG_CTA_ARTIFICIAL = [
  'deixa o like', 'deixe seu like', 'deixa aquele like', 'manda um like',
  'se inscreve no canal', 'se inscreva no canal', 'inscreva-se no canal',
  'ativa o sininho', 'ative o sininho', 'comenta aqui embaixo', 'comente aqui embaixo',
  'comenta ai', 'comente ai', 'deixa nos comentarios', 'deixe nos comentarios',
  'compartilha com aquele amigo', 'compartilhe com aquele amigo', 'marca aquele amigo',
  'marque aquele amigo', 'salva esse video', 'salve esse video', 'me segue',
  'siga o perfil', 'nao esquece de curtir', 'curte e compartilha',
];

function julgCtaArtificial(texto) {
  const t = _jNorm(texto);
  const achadas = JULG_CTA_ARTIFICIAL.filter((c) => t.indexOf(c) >= 0);
  const problemas = [];
  if (achadas.length) {
    problemas.push(`pedido de engajamento colado no texto: "${achadas.join('", "')}". Pedir não produz reação — dá a impressão de estar sendo usado. O que produz reação é o conteúdo deixar motivo.`);
  }
  return { problemas, achadas };
}

/* ---- 5. FRASE QUE PARECE IA ----------------------------------------------
 *
 * O conjunto próprio desta banca. Quando o motor da Narrativa está carregado, a
 * lista dele entra junto — as duas ferramentas caçam o mesmo defeito, e manter
 * duas listas divergentes faria uma achar o que a outra deixa passar. A checagem
 * por `typeof` mantém isso como reuso, não como dependência. */
const JULG_FRASES_DE_IA = [
  'nao e apenas', 'nao se trata apenas', 'vamos mergulhar', 'neste artigo',
  'e importante ressaltar', 'vale ressaltar', 'cabe destacar', 'em suma',
  'desempenha um papel', 'de suma importancia', 'e fundamental entender',
  'em um mundo onde', 'num mundo onde', 'prepare-se para', 'voce nao vai acreditar',
  'isso mesmo que voce leu', 'pois bem', 'dito isso', 'nesse contexto',
  'de forma alguma', 'a resposta pode te surpreender', 'continue lendo',
  'descubra agora', 'o que voce precisa saber',
];

function julgFrasesDeIA(texto) {
  const t = _jNorm(texto);
  let lista = JULG_FRASES_DE_IA;
  if (typeof NARR_FRASES_FEITAS !== 'undefined' && Array.isArray(NARR_FRASES_FEITAS)) {
    lista = [...new Set(lista.concat(NARR_FRASES_FEITAS))];
  }
  const achadas = lista.filter((f) => t.indexOf(f) >= 0);
  const problemas = [];
  if (achadas.length) {
    problemas.push(`frase que entrega texto gerado: "${achadas.join('", "')}". Ninguém fala assim em vídeo — troque pelo que você diria em voz alta.`);
  }
  return { problemas, achadas };
}

/* ---- 6. A PROMESSA DA EMBALAGEM ------------------------------------------
 *
 * O conteúdo não existe sozinho: existe vídeo + título + capa + legenda. Se o
 * título promete uma coisa e os primeiros segundos entregam outra, a pessoa sai
 * — e sai com a sensação de ter sido enganada, que é pior do que não ter
 * clicado. Mede-se: quanto do que o título promete aparece no começo do vídeo. */
const JULG_JANELA_DA_PROMESSA = 30;   // segundos

function julgPromessaCumprida(texto, embalagem) {
  const e = embalagem || {};
  const promessa = [...new Set(_jConteudo(`${e.titulo || ''} ${e.capa || ''}`))];
  if (promessa.length < 2) return { problemas: [], conferido: false, cumpridas: [], ausentes: [] };

  const palavras = _jPalavras(texto);
  const naJanela = palavras.slice(0, Math.round(JULG_JANELA_DA_PROMESSA * JULG_PALAVRAS_POR_SEGUNDO)).join(' ');
  const inicio = new Set(_jConteudo(naJanela));
  const todo = new Set(_jConteudo(texto));

  const cumpridas = promessa.filter((w) => inicio.has(w));
  const ausentes = promessa.filter((w) => !todo.has(w));
  const atrasadas = promessa.filter((w) => !inicio.has(w) && todo.has(w));
  const problemas = [];

  if (ausentes.length / promessa.length >= 0.5) {
    problemas.push(`a promessa do título/capa não aparece no vídeo: "${ausentes.join('", "')}" não são tratados em lugar nenhum. Quem clicou por causa disso vai embora — e volta com desconfiança na próxima capa.`);
  } else if (cumpridas.length / promessa.length < 0.4 && atrasadas.length) {
    problemas.push(`o que o título promete só aparece depois dos primeiros ${JULG_JANELA_DA_PROMESSA} segundos ("${atrasadas.join('", "')}"). Quem clicou pela promessa precisa reconhecê-la logo, senão sai antes de chegar nela.`);
  }
  return { problemas, conferido: true, cumpridas, ausentes, atrasadas };
}

/* ---- 7. PROGRESSÃO ---------------------------------------------------------
 *
 * O vídeo continua acrescentando coisa, ou já disse tudo o que tinha para dizer
 * e está enrolando até o fim? Mede-se a fração de conteúdo NOVO em cada terço.
 * Um terço final sem novidade nenhuma é o trecho que devia ter sido cortado. */
function julgProgressao(texto) {
  const palavras = _jPalavras(texto);
  if (palavras.length < 60) return { problemas: [], novidades: [] };
  const t = Math.floor(palavras.length / 3);
  const tercos = [palavras.slice(0, t), palavras.slice(t, 2 * t), palavras.slice(2 * t)];

  const vistas = new Set();
  const novidades = tercos.map((bloco) => {
    const cont = _jConteudo(bloco.join(' '));
    if (!cont.length) return 0;
    const novas = cont.filter((w) => !vistas.has(w));
    cont.forEach((w) => vistas.add(w));
    return novas.length / cont.length;
  });

  const problemas = [];
  if (novidades[2] < 0.2) {
    const inicioDoUltimo = julgSegundos(2 * t);
    problemas.push(`a partir de ${julgMomento(inicioDoUltimo)} o vídeo praticamente não traz nada novo (${Math.round(novidades[2] * 100)}% de conteúdo inédito no último terço). Ou o fim entrega alguma coisa, ou ele é o corte mais fácil de fazer.`);
  }
  return { problemas, novidades };
}

/**
 * Tudo o que dá para medir sem perguntar nada a ninguém. Vira munição para os
 * avaliadores (que não devem gastar atenção com o que a conta já resolveu) e
 * para o juiz.
 */
function conferirJulgamentoLocal(texto, embalagem) {
  const gancho = julgTempoAteOGancho(texto);
  const repet = julgRepeticao(texto);
  const reexp = julgExplicacaoExcessiva(texto);
  const cta = julgCtaArtificial(texto);
  const ia = julgFrasesDeIA(texto);
  const promessa = julgPromessaCumprida(texto, embalagem);
  const prog = julgProgressao(texto);

  const achados = []
    .concat(gancho.problemas.map((p) => ({ dimensao: 'impacto', texto: p })))
    .concat(repet.problemas.map((p) => ({ dimensao: 'retencao', texto: p })))
    .concat(reexp.problemas.map((p) => ({ dimensao: 'retencao', texto: p })))
    .concat(prog.problemas.map((p) => ({ dimensao: 'retencao', texto: p })))
    .concat(cta.problemas.map((p) => ({ dimensao: 'comentarios', texto: p })))
    .concat(ia.problemas.map((p) => ({ dimensao: 'naturalidade', texto: p })))
    .concat(promessa.problemas.map((p) => ({ dimensao: 'embalagem', texto: p })));

  return {
    achados, gancho, repeticao: repet, reexplicacao: reexp, cta,
    frasesDeIA: ia, promessa, progressao: prog,
    duracao: julgSegundos(_jPalavras(texto).length),
    ok: achados.length === 0,
  };
}

/* -------------------------------------------------------------------------- */
/* §3 — Os avaliadores                                                         */
/* -------------------------------------------------------------------------- */

/* Cada avaliador tem uma CABEÇA diferente — não é o mesmo prompt com outro
 * nome. E nenhum reescreve nada: a banca julga, o autor decide.
 *
 * O ESPECTADOR merece explicação. Ele não é especialista em nada, e é de
 * propósito: existe para impedir que os nove especialistas deixem o conteúdo
 * tecnicamente impecável e sem graça. Como o juiz fica sempre com a PIOR
 * avaliação de cada dimensão, o leigo ganha poder de veto sobre os técnicos sem
 * precisar de nenhum mecanismo especial — se ele diz que sairia aos 12
 * segundos, a nota dele é que vale. */
const JULG_AVALIADORES = {
  impacto: {
    label: 'Primeiro impacto',
    persona: 'Você é quem rola o feed. Você não deve nada a esse vídeo: se ele não te segurar, o polegar sobe e acabou. Você não está avaliando se o vídeo é bom — está avaliando se você PARARIA.',
    dimensoes: ['impacto', 'clareza'],
    olhar: [
      'Nos três primeiros segundos, o que aparece? Já é o assunto ou ainda é apresentação?',
      'Existe alguma introdução que poderia ser cortada inteira sem perda?',
      'A primeira informação é a mais forte que o vídeo tem, ou a mais forte está guardada para o meio?',
      'Dá para entender do que se trata sem ter visto o título?',
      'Se você fosse resumir o vídeo em uma frase pelos primeiros segundos, conseguiria?',
    ],
  },
  retencao: {
    label: 'Retenção',
    persona: 'Você analisa a estrutura no tempo. Você procura o ponto exato em que a pessoa desiste — e sabe que ela desiste quando não recebe nada novo, não quando o texto fica feio.',
    dimensoes: ['retencao', 'historia'],
    olhar: [
      'Onde está o trecho morto? Aponte o momento aproximado.',
      'Alguma informação é dada duas vezes com palavras diferentes?',
      'Alguma explicação é mais longa do que precisava?',
      'A tensão cai em algum ponto e não volta a subir?',
      'Dá para adivinhar o que vem depois? Em que ponto?',
      'Quanto tempo o vídeo leva para chegar ao ponto?',
      'As coisas se PUXAM (uma causa a outra) ou apenas se sucedem?',
    ],
  },
  curiosidade: {
    label: 'Curiosidade',
    persona: 'Você procura lacunas de informação — as perguntas que ficam abertas e cobram resposta. Você sabe que um conteúdo pode ser tecnicamente correto e mesmo assim não dar vontade nenhuma de continuar.',
    dimensoes: ['curiosidade'],
    olhar: [
      'Que pergunta fica aberta na cabeça de quem assiste? "O que aconteceu depois?", "Por que ele fez isso?", "Será que conseguiu?"',
      'A lacuna é interessante ou é só informação omitida?',
      'O vídeo entrega tudo de uma vez ou segura alguma coisa?',
      'Existe algum momento em que dá vontade de saber mais? Onde?',
      'Se não existe nenhuma pergunta aberta, diga isso com todas as letras.',
    ],
  },
  historia: {
    label: 'História',
    persona: 'Você entende de narrativa: protagonista, desejo, obstáculo, virada, resolução. Mas você NÃO obriga todo vídeo a ser uma história — um conteúdo informativo não precisa virar ficção. Você julga se existe PROGRESSÃO, seja ela qual for.',
    dimensoes: ['historia'],
    olhar: [
      'Existe alguém de quem é a história? Essa pessoa quer alguma coisa?',
      'Existe obstáculo, ou tudo acontece sem resistência?',
      'Existe virada — algum momento em que a coisa muda de direção?',
      'O fim decorre do que veio antes, ou foi colado?',
      'Se for informativo e não narrativo: existe progressão de ideia, do simples ao surpreendente? Não force estrutura de ficção onde não cabe.',
    ],
  },
  naturalidade: {
    label: 'Naturalidade',
    persona: 'Você reconhece na hora quando um texto foi escrito por IA ou escrito para ser lido, não falado. Você não julga literatura: julga se aquilo sai da boca de uma pessoa.',
    dimensoes: ['naturalidade'],
    olhar: [
      'Tem frase que ninguém falaria em voz alta? Cite.',
      'O registro é formal demais para a situação?',
      'Tem palavra que essa pessoa não usaria?',
      'Tem explicação óbvia — coisa que não precisava ser dita?',
      'Tem frase genérica que serviria para qualquer vídeo?',
      'Tem diálogo que soa escrito em vez de falado?',
    ],
  },
  valor: {
    label: 'Valor',
    persona: 'Sua pergunta é uma só: o espectador ganhou alguma coisa? Não precisa ser ensinamento — pode ser emoção, entretenimento, surpresa, identificação, indignação, graça. Mas alguma coisa precisa ter sido entregue.',
    dimensoes: ['valor'],
    olhar: [
      'O que exatamente a pessoa leva depois de assistir? Nomeie.',
      'Se ela não levar nada, diga isso claramente — é o defeito mais grave que existe.',
      'O valor entregue corresponde ao tempo pedido?',
      'O vídeo entrega o que prometeu no começo?',
      'Se o valor é entretenimento, ele é entretido de verdade ou apenas inofensivo?',
    ],
  },
  compartilhamento: {
    label: 'Compartilhamento',
    persona: 'Você NÃO tenta prever viralização. Sua pergunta é concreta: existe uma razão real para alguém mandar isso para outra pessoa? "Você precisa ver isso", "olha essa história", "lembrei de você", "isso explica o que aconteceu".',
    dimensoes: ['compartilhamento'],
    olhar: [
      'Que frase a pessoa escreveria ao mandar isso para alguém?',
      'Para QUEM ela mandaria? Existe um destinatário óbvio?',
      'Mandar isso diz alguma coisa sobre quem manda? (é o que mais move compartilhamento)',
      'Serve como resposta a alguma conversa comum?',
      'Se não houver razão nenhuma, diga — nem todo conteúdo bom é compartilhável, e isso não é defeito fatal.',
    ],
  },
  comentarios: {
    label: 'Reação',
    persona: 'Você procura motivos NATURAIS de reação — discordância, identificação, opinião, surpresa, pergunta legítima, experiência parecida. Você penaliza pedido explícito de comentário: pedir não gera reação, gera a sensação de estar sendo usado.',
    dimensoes: ['comentarios'],
    olhar: [
      'Existe algo com que dá para discordar?',
      'Existe algo em que a pessoa se reconhece a ponto de querer contar a própria versão?',
      'Existe uma pergunta legítima que fica no ar?',
      'O conteúdo toma alguma posição, ou fica em cima do muro para não desagradar?',
      'Tem pedido de comentário/like/inscrição colado no texto? Isso PENALIZA a nota.',
    ],
  },
  embalagem: {
    label: 'Embalagem',
    persona: 'Você julga o conjunto: título, capa e legenda contra o que o vídeo entrega. Você sabe que promessa não cumprida é pior que promessa modesta — quem se sente enganado não volta na próxima capa.',
    dimensoes: ['embalagem'],
    olhar: [
      'O que exatamente o título promete? E a capa?',
      'Os primeiros segundos do vídeo confirmam essa promessa?',
      'A promessa é cumprida em algum momento? Onde?',
      'O título entrega demais — a ponto de tornar o vídeo desnecessário?',
      'O título é vago a ponto de não prometer nada?',
      'Se não houver título e capa informados, avalie o que o vídeo PEDIRIA de título e diga qual seria.',
    ],
  },
  espectador: {
    label: 'O Espectador',
    persona: 'Você é uma pessoa comum. Você não sabe o que é gancho, retenção, storytelling nem algoritmo, e não quer saber. Você só viu um vídeo e vai dizer o que sentiu, com as suas palavras. Não use nenhum termo técnico.',
    dimensoes: ['impacto', 'retencao', 'valor', 'compartilhamento'],
    olhar: [
      'Você assistiria até o fim? Responda com sinceridade.',
      'Em que momento exato você perderia o interesse?',
      'O que te chamou atenção?',
      'O que te incomodou?',
      'Você mandaria isso para alguém? Para quem?',
      'Você lembraria desse vídeo amanhã?',
      'Se você achou chato, diga que achou chato. É a coisa mais útil que você pode dizer.',
    ],
  },
};

/* Quem lê sempre. O Espectador é fixo por desenho: ele é a trava contra o
 * conteúdo tecnicamente perfeito e sem graça, e essa trava não pode ser
 * opcional. */
const JULG_BANCA_COMPLETA = Object.keys(JULG_AVALIADORES);

/* A banca da TRIAGEM, para o modo Seleção. Painel reduzido de propósito: com
 * dezenas de vídeos, dez chamadas por vídeo é caro e desnecessário — o que a
 * triagem precisa responder é "vale a pena abrir este?". Os três aqui são os
 * que decidem isso, e TODAS as conferências de código continuam rodando, porque
 * são de graça. Quem passar na triagem é julgado pela banca inteira. */
const JULG_BANCA_TRIAGEM = ['impacto', 'retencao', 'espectador'];

/* -------------------------------------------------------------------------- */
/* §4 — Prompts                                                                */
/* -------------------------------------------------------------------------- */

function julgBlocoDoutrina() {
  return [
    '== O QUE ESTA BANCA FAZ ==',
    'Você avalia um conteúdo ANTES de ele ser publicado. A pergunta não é "isso vai viralizar?" — ninguém responde isso antes de publicar, e fingir que responde é inventar precisão que não existe.',
    'A pergunta é: este conteúdo está forte o bastante para publicar, onde ele é fraco, e o que dá para corrigir agora.',
    '',
    'VOCÊ NÃO REESCREVE NADA. Você aponta — com o trecho na mão e, quando der, com o momento aproximado. O conteúdo é de quem fez; a decisão de mudar é dele.',
    'Elogio genérico não serve para nada. "Está bom" não ajuda ninguém. Se estiver bom, diga POR QUE em uma frase. Se estiver ruim, cite o pedaço exato.',
    '',
    'NOTA É HONESTA. 10 é raro. 7 é aceitável. Abaixo de 5 é falha grave. Não infle para ser gentil: uma nota inflada faz a pessoa publicar um vídeo que ia falhar, e isso é pior do que um comentário duro.',
    'Você não é o único avaliador, e não vê a opinião dos outros. Julgue só a sua parte, com rigor.',
  ].join('\n');
}

function julgBlocoConteudo(conteudo, embalagem) {
  const e = embalagem || {};
  const linhas = [];
  if (e.titulo || e.capa || e.legenda) {
    linhas.push('== A EMBALAGEM (o que a pessoa vê ANTES de dar play) ==');
    if (e.titulo) linhas.push(`Título: ${e.titulo}`);
    if (e.capa) linhas.push(`Capa/thumbnail: ${e.capa}`);
    if (e.legenda) linhas.push(`Legenda: ${e.legenda}`);
    linhas.push('');
  }
  linhas.push('== O CONTEÚDO (roteiro ou transcrição do vídeo) ==');
  linhas.push(String(conteudo || ''));
  return linhas.join('\n');
}

function buildAvaliadorPrompt(avaliadorId, conteudo, embalagem, achadosLocais) {
  const a = JULG_AVALIADORES[avaliadorId];
  if (!a) throw new Error('Avaliador desconhecido: ' + avaliadorId);
  const dims = a.dimensoes.map((id) => {
    const d = julgDimensao(id);
    return d ? `  ${d.id} — ${d.label}: ${d.pergunta}` : '';
  }).filter(Boolean);

  const linhas = [];
  linhas.push(a.persona);
  linhas.push('');
  linhas.push(julgBlocoDoutrina());
  linhas.push('');
  linhas.push(julgBlocoConteudo(conteudo, embalagem));
  linhas.push('');
  if ((achadosLocais || []).length) {
    linhas.push('== JÁ MEDIDO NO CÓDIGO (não é opinião, e não precisa ser repetido) ==');
    achadosLocais.forEach((x) => linhas.push('- ' + x.texto));
    linhas.push('Procure o que a medição não alcança.');
    linhas.push('');
  }
  linhas.push('== O QUE VOCÊ OLHA ==');
  a.olhar.forEach((o) => linhas.push('- ' + o));
  linhas.push('');
  linhas.push('== SUAS DIMENSÕES (dê nota de 0 a 10 em cada uma) ==');
  dims.forEach((d) => linhas.push(d));
  linhas.push('');
  linhas.push('Devolva SOMENTE JSON, sem cercas:');
  linhas.push('{');
  linhas.push('  "notas": [{ "dimensao": "' + a.dimensoes[0] + '", "nota": 7, "problema": "o que está errado e onde (com o momento aproximado, se der)", "correcao": "o que fazer — uma ação, não um conselho" }],');
  linhas.push('  "resumo": "em uma frase, o que mais atrapalha"');
  linhas.push('}');
  return linhas.join('\n');
}

/* -------------------------------------------------------------------------- */
/* §5 — Normalizadores                                                         */
/* -------------------------------------------------------------------------- */

function _jTexto(v) { return (v == null) ? '' : String(v).trim(); }

function normalizarAvaliacao(obj, avaliadorId) {
  const o = obj || {};
  const permitidas = (JULG_AVALIADORES[avaliadorId] || {}).dimensoes || [];
  const notas = (Array.isArray(o.notas) ? o.notas : [])
    .filter((n) => n && permitidas.indexOf(_jTexto(n.dimensao)) >= 0 && Number.isFinite(Number(n.nota)))
    .map((n) => ({
      dimensao: _jTexto(n.dimensao),
      nota: Math.max(0, Math.min(10, Number(n.nota))),
      problema: _jTexto(n.problema),
      correcao: _jTexto(n.correcao),
    }));
  return { avaliador: avaliadorId, notas, resumo: _jTexto(o.resumo) };
}

/* -------------------------------------------------------------------------- */
/* §6 — O juiz é código                                                        */
/* -------------------------------------------------------------------------- */

/* Nota que uma medição feita no código impõe. Não é opinião: se a conta achou o
 * problema, a dimensão não passa como se estivesse boa — nem que os dez
 * avaliadores tenham dado 10. */
const JULG_NOTA_DE_ACHADO = 5;

/* Os três estados do veredito. "Vai viralizar" não é um deles, de propósito. */
const JULG_VEREDITOS = {
  sim: { id: 'sim', label: 'PUBLICARIA', cor: 'verde',
    resumo: 'Conteúdo forte. Nenhuma falha crítica encontrada.' },
  ajustes: { id: 'ajustes', label: 'PUBLICARIA APÓS AJUSTES', cor: 'amarelo',
    resumo: 'A ideia se sustenta, mas há pontos que dá para corrigir antes de publicar.' },
  nao: { id: 'nao', label: 'NÃO PUBLICARIA AINDA', cor: 'vermelho',
    resumo: 'Há problemas estruturais que reduzem bastante o alcance do que o conteúdo poderia ser.' },
};

/* A gravidade de uma reprovação, em três faixas. É o que separa "ajuste" de
 * "problema estrutural". */
function _jGravidade(nota, minimo) {
  if (nota <= minimo - 3) return 'critico';
  if (nota < minimo) return 'alto';
  if (nota <= minimo + 1) return 'medio';
  return 'baixo';
}

/**
 * Recebe o que os avaliadores disseram e o que a conta mediu, e decide.
 *
 * A REGRA: nota baixa não se esconde na média. Qualquer dimensão abaixo do
 * mínimo dela reprova o conteúdo — 95+95+95+95+40 não é 84.
 */
function julgarConteudo(avaliacoes, achadosLocais) {
  const porDimensao = new Map();

  const registrar = (dimensao, nota, problema, correcao, fonte) => {
    const dim = julgDimensao(dimensao);
    if (!dim) return;
    const atual = porDimensao.get(dim.id);
    // Fica sempre a PIOR avaliação da dimensão. É o que dá poder de veto ao
    // Espectador sobre os especialistas: se o leigo diz que sairia aos 12
    // segundos, não interessa que o técnico tenha achado a estrutura elegante.
    if (atual && atual.nota <= nota) return;
    porDimensao.set(dim.id, {
      dimensao: dim.id, label: dim.label, nota, problema, correcao, fonte,
      minimo: dim.minimo, momento: dim.momento, eixo: dim.eixo,
    });
  };

  (avaliacoes || []).forEach((a) => {
    ((a && a.notas) || []).forEach((n) => {
      const nota = Number(n.nota);
      if (!Number.isFinite(nota)) return;
      registrar(n.dimensao, Math.max(0, Math.min(10, nota)),
        n.problema || '', n.correcao || '', (a && a.avaliador) || 'avaliador');
    });
  });

  // A medição entra por cima: avaliador que deu nota alta para o que a conta
  // reprovou perde. É exatamente o falso positivo que a autoavaliação produz.
  (achadosLocais || []).forEach((x) => {
    registrar(x.dimensao, JULG_NOTA_DE_ACHADO, x.texto, x.texto, 'conferência automática');
  });

  const avaliadas = [...porDimensao.values()]
    .map((a) => ({ ...a, gravidade: _jGravidade(a.nota, a.minimo) }));
  const reprovadas = avaliadas.filter((a) => a.nota < a.minimo);
  const criticas = reprovadas.filter((a) => a.gravidade === 'critico');

  /* A PRIORIDADE — gravidade × onde o defeito age.
   *
   * Duas falhas de mesma gravidade não custam a mesma coisa: quem foi embora
   * nos três primeiros segundos nunca chegou no encerramento fraco. O peso vai
   * de 2,0 (a capa, que age antes do play) a 1,05 (o encerramento). É isto que
   * faz a ferramenta responder "se eu só puder mudar uma coisa" com a coisa
   * certa, em vez de com a de nota mais baixa. */
  const prioridade = (a) => (a.minimo - a.nota) * (1 + (1 - a.momento));
  const ordenadas = reprovadas.slice().sort((x, y) => prioridade(y) - prioridade(x));

  let veredito = 'sim';
  if (criticas.length || reprovadas.length >= 3) veredito = 'nao';
  else if (reprovadas.length) veredito = 'ajustes';

  /* O PRINCIPAL — a informação mais valiosa da ferramenta. Um conteúdo com 14
   * problemas não tem 14 problemas: tem um que importa e treze que vêm depois.
   * Quando não há reprovação nenhuma, o principal é o ponto mais baixo entre os
   * aprovados — quem quer subir de 8 para 9 também precisa saber por onde. */
  const principal = ordenadas[0]
    || avaliadas.slice().sort((x, y) => (x.nota - x.minimo) - (y.nota - y.minimo))[0]
    || null;

  const acoes = avaliadas
    .filter((a) => a.gravidade !== 'baixo' && (a.correcao || a.problema))
    .sort((x, y) => prioridade(y) - prioridade(x) || x.nota - y.nota)
    .map((a) => ({
      dimensao: a.dimensao, label: a.label, gravidade: a.gravidade, nota: a.nota,
      minimo: a.minimo, fonte: a.fonte,
      acao: a.correcao || a.problema, problema: a.problema,
    }));

  /* Os eixos ficam com a PIOR dimensão do grupo, não com a média — pelo mesmo
   * motivo que o veredito: é a pior que decide se a pessoa fica. */
  const eixos = JULG_EIXOS.map((e) => {
    const doEixo = avaliadas.filter((a) => a.eixo === e.id);
    if (!doEixo.length) return { ...e, nota: null, dimensoes: [] };
    const pior = doEixo.reduce((m, a) => (a.nota < m.nota ? a : m), doEixo[0]);
    return { ...e, nota: pior.nota * 10, pior: pior.dimensao, dimensoes: doEixo.map((a) => a.dimensao) };
  });

  return {
    avaliadas: avaliadas.slice().sort((x, y) => x.nota - y.nota),
    reprovadas: ordenadas,
    criticas,
    eixos,
    veredito,
    vereditoInfo: JULG_VEREDITOS[veredito],
    principal,
    acoes,
    /* A nota geral é a PIOR dimensão, não a média — e por isso ela é honesta.
     * Uma média de 84 esconderia um 4 em naturalidade; a pior, não. A média fica
     * disponível ao lado, só para mostrar. */
    nota: avaliadas.length ? Math.min(...avaliadas.map((a) => a.nota)) * 10 : 0,
    media: avaliadas.length
      ? Math.round((avaliadas.reduce((acc, a) => acc + a.nota, 0) / avaliadas.length) * 10) : 0,
  };
}

/* -------------------------------------------------------------------------- */
/* §7 — Comparação entre versões                                               */
/* -------------------------------------------------------------------------- */

/**
 * O que mudou da versão anterior para esta. É o que transforma a ferramenta de
 * detector de problemas em laboratório: o autor corrige, reenvia, e vê se o que
 * ele mexeu melhorou de fato — inclusive se estragou outra coisa no caminho.
 */
function compararJulgamentos(antes, depois) {
  const mapa = (j) => new Map(((j && j.avaliadas) || []).map((a) => [a.dimensao, a]));
  const mA = mapa(antes), mD = mapa(depois);

  const dimensoes = JULG_DIMENSOES
    .filter((d) => mA.has(d.id) || mD.has(d.id))
    .map((d) => {
      const a = mA.get(d.id), b = mD.get(d.id);
      const notaAntes = a ? a.nota : null;
      const notaDepois = b ? b.nota : null;
      const delta = (notaAntes != null && notaDepois != null) ? notaDepois - notaAntes : null;
      return { dimensao: d.id, label: d.label, antes: notaAntes, depois: notaDepois, delta };
    });

  const comDelta = dimensoes.filter((x) => x.delta != null);
  return {
    dimensoes,
    melhoraram: comDelta.filter((x) => x.delta > 0).sort((x, y) => y.delta - x.delta),
    pioraram: comDelta.filter((x) => x.delta < 0).sort((x, y) => x.delta - y.delta),
    iguais: comDelta.filter((x) => x.delta === 0),
    notaAntes: (antes && antes.nota) || 0,
    notaDepois: (depois && depois.nota) || 0,
    deltaNota: ((depois && depois.nota) || 0) - ((antes && antes.nota) || 0),
    vereditoAntes: antes && antes.veredito,
    vereditoDepois: depois && depois.veredito,
    mudouVeredito: !!(antes && depois && antes.veredito !== depois.veredito),
  };
}

/* -------------------------------------------------------------------------- */
/* §8 — A banca inteira                                                        */
/* -------------------------------------------------------------------------- */

function _jLimpar(texto) {
  let t = String(texto == null ? '' : texto).trim();
  t = t.replace(/^```[a-z]*\s*/i, '').replace(/```\s*$/, '');
  return (typeof cleanText === 'function') ? cleanText(t).trim() : t.trim();
}

/**
 * Roda a banca: conferência de código → avaliadores em paralelo → juiz.
 *
 * Não há etapa de reescrita, e isso é desenho: os avaliadores não criam nada. O
 * conteúdo continua sendo do autor; a banca diz onde ele é fraco.
 *
 * @param {object} opts
 *   conteudo    o roteiro ou a transcrição
 *   embalagem   { titulo, capa, legenda } — o que a pessoa vê antes do play
 *   banca       ids dos avaliadores (padrão: a banca completa)
 *   onEtapa(chave, titulo, desc)
 *   call(prompt)  chamada de IA — injetável; é o que torna a banca testável
 */
async function runJulgamentoPipeline(opts) {
  const o = opts || {};
  const chamar = o.call || (typeof callLLM === 'function' ? callLLM : null);
  if (!chamar) throw new Error('Sem função de chamada de IA.');
  const conteudo = _jLimpar(o.conteudo);
  if (!conteudo) throw new Error('Não há conteúdo para avaliar.');
  const embalagem = o.embalagem || {};
  const banca = (o.banca && o.banca.length ? o.banca : JULG_BANCA_COMPLETA)
    .filter((id) => JULG_AVALIADORES[id]);
  const etapa = (k, t, d) => { if (typeof o.onEtapa === 'function') o.onEtapa(k, t, d); };
  const lerJSON = (r) => (typeof extractJSON === 'function' ? extractJSON(r && r.content) : null);
  const etapas = [];
  let modelo = '';

  // 1) A CONFERÊNCIA DE CÓDIGO — roda primeiro porque é de graça e porque o que
  //    ela achar não deve ocupar a atenção dos avaliadores.
  etapa('conferencia', 'Medindo o conteúdo…', 'Tempo até o gancho, repetição, promessa da capa.');
  const local = conferirJulgamentoLocal(conteudo, embalagem);
  etapas.push('conferencia');

  // 2) OS AVALIADORES — em paralelo, independentes, cada um com a sua lente.
  etapa('banca', 'A banca está lendo…', `${banca.length} avaliadores, cada um com a sua lente.`);
  const avaliacoes = await Promise.all(banca.map(async (id) => {
    try {
      const r = await chamar(buildAvaliadorPrompt(id, conteudo, embalagem, local.achados));
      const parcial = normalizarAvaliacao(lerJSON(r), id);
      if (r && r.model) modelo = r.model;
      return parcial;
    } catch (_) {
      // Um avaliador que falha não derruba a banca: os outros continuam, e a
      // conferência medida continua valendo.
      return { avaliador: id, notas: [], resumo: '' };
    }
  }));
  etapas.push('banca');

  // 3) O JUIZ — código, não opinião.
  etapa('juiz', 'Decidindo…', 'A pior nota decide; média não esconde defeito.');
  const juizo = julgarConteudo(avaliacoes, local.achados);
  etapas.push('juiz');

  etapa('pronto', 'Pronto.', JULG_VEREDITOS[juizo.veredito].label);
  return { conteudo, embalagem, avaliacoes, juizo, local, banca, etapas, model: modelo };
}

/**
 * Modo Seleção — triagem de um acervo. Avalia vários conteúdos com a banca
 * reduzida e devolve a fila, do mais forte ao mais fraco.
 *
 * A ordenação é por veredito primeiro, nota depois: um vídeo verde de 70 vem
 * antes de um amarelo de 75, porque a pergunta da triagem é "em qual eu mexo
 * primeiro?", não "qual tem a nota maior".
 */
async function runTriagemPipeline(opts) {
  const o = opts || {};
  const itens = Array.isArray(o.itens) ? o.itens : [];
  if (!itens.length) throw new Error('Nada para triar.');
  const etapa = (k, t, d) => { if (typeof o.onEtapa === 'function') o.onEtapa(k, t, d); };
  const ordemVeredito = { sim: 0, ajustes: 1, nao: 2 };

  const resultados = [];
  for (let i = 0; i < itens.length; i++) {
    const it = itens[i] || {};
    etapa('triagem', `Avaliando ${i + 1} de ${itens.length}…`, it.nome || '');
    try {
      const r = await runJulgamentoPipeline({
        conteudo: it.conteudo, embalagem: it.embalagem,
        banca: o.banca || JULG_BANCA_TRIAGEM, call: o.call,
      });
      resultados.push({ nome: it.nome || `Conteúdo ${i + 1}`, id: it.id, ok: true, ...r });
    } catch (err) {
      resultados.push({ nome: it.nome || `Conteúdo ${i + 1}`, id: it.id, ok: false, erro: err.message });
    }
  }

  const fila = resultados.slice().sort((a, b) => {
    if (a.ok !== b.ok) return a.ok ? -1 : 1;
    if (!a.ok) return 0;
    const va = ordemVeredito[a.juizo.veredito], vb = ordemVeredito[b.juizo.veredito];
    if (va !== vb) return va - vb;
    return b.juizo.nota - a.juizo.nota;
  });

  etapa('pronto', 'Triagem pronta.', `${fila.filter((x) => x.ok && x.juizo.veredito === 'sim').length} prontos para publicar.`);
  return { fila, banca: o.banca || JULG_BANCA_TRIAGEM, triagem: true };
}
