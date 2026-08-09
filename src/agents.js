'use strict';
// ============================================================================
// agents.js — Pipeline de IA em AGENTES ESPECIALIZADOS.
//
// Em vez de UMA chamada única que faz tudo (o antigo buildPrompt→callLLM), a
// matéria passa por uma pequena "linha de montagem" de agentes, cada um com um
// papel estreito e verificável:
//
//   1) Agente de Interpretação  → lê a pauta bruta e ISOLA os fatos em JSON
//                                 (assunto, categoria, entidades, números,
//                                 datas, citações). Nenhuma redação ainda.
//   2) Agente Redator           → recebe SÓ os fatos isolados + estilo + tom e
//                                 escreve título/subtítulo/lead/corpo.
//                                 Como os fatos já vêm separados, é muito mais
//                                 difícil alucinar (o redator não vê "texto
//                                 solto" para preencher lacunas por conta).
//   3) Agente Editor            → copidesque sobre o rascunho: coesão, ritmo,
//                                 transições e economia. Só FORMA — uma trava
//                                 determinística descarta a revisão se ela
//                                 introduzir número ou citação que não existia.
//
// (Houve um 4º agente, de DESIGN, que escolhia modelo/paleta/formato do cartaz.
//  Foi removido: na prática a sugestão quase nunca servia e o usuário refazia a
//  escolha à mão — a etapa custava uma chamada de IA e não poupava trabalho.)
//
// FILOSOFIA DE ROBUSTEZ: cada agente tem um FALLBACK. Se um agente não devolver
// JSON válido (modelos menores às vezes escapam do formato), o pipeline degrada
// com elegância em vez de quebrar — a matéria sempre sai. O resultado final
// também expõe um campo `content` em TEXTO PLANO idêntico ao formato antigo,
// para que TODOS os consumidores atuais (parseArticle, cartazes, carrosséis,
// histórico, handoff) continuem funcionando sem alteração.
// ============================================================================

/* -------------------------------------------------------------------------- */
/* Utilidades de JSON tolerante                                                */
/* -------------------------------------------------------------------------- */

/** Extrai um objeto JSON de uma resposta de LLM, tolerando cercas de código,
 *  texto ao redor e vírgulas finais. Devolve null se não achar nada válido. */
function extractJSON(raw) {
  if (raw == null) return null;
  let s = String(raw).trim();
  // Remove cercas ```json ... ```
  s = s.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim();
  const tryParse = (txt) => { try { return JSON.parse(txt); } catch (_) { return undefined; } };

  let out = tryParse(s);
  if (out !== undefined) return out;

  // Recorta do primeiro "{" ao último "}" (descarta prosa ao redor)
  const i = s.indexOf('{');
  const j = s.lastIndexOf('}');
  if (i >= 0 && j > i) {
    const sub = s.slice(i, j + 1);
    out = tryParse(sub);
    if (out !== undefined) return out;
    // Última tentativa: remove vírgulas finais (,} ,])
    out = tryParse(sub.replace(/,(\s*[}\]])/g, '$1'));
    if (out !== undefined) return out;
  }
  return null;
}

/** Normaliza uma lista vinda do modelo (aceita array ou string separada). */
function asList(v) {
  if (Array.isArray(v)) return v.map((x) => String(x || '').trim()).filter(Boolean);
  if (typeof v === 'string') {
    return v.split(/[\n;•]+/).map((x) => x.trim()).filter(Boolean);
  }
  return [];
}
function asText(v) { return (v == null) ? '' : String(v).trim(); }

/** Chama o LLM e tenta interpretar a resposta como JSON. Reaproveita callLLM
 *  (mesmo provedor/modelo/chave configurados). O parâmetro `call` é uma costura
 *  de injeção: em produção usa o callLLM real; nos testes recebe um stub (sem
 *  rede). Devolve { data, raw, model, ... }. */
async function callLLMJson(prompt, call = callLLM) {
  const r = await call(prompt);
  return {
    data: extractJSON(r.content),
    raw: r.content,
    model: r.model,
    promptTokens: r.promptTokens || null,
    completionTokens: r.completionTokens || null,
  };
}

/* -------------------------------------------------------------------------- */
/* 1) Agente de Interpretação                                                  */
/* -------------------------------------------------------------------------- */

function buildInterpreterPrompt(content) {
  let truncated = String(content || '');
  const max = (typeof MAX_CONTENT_CHARS === 'number') ? MAX_CONTENT_CHARS : 12000;
  if (truncated.length > max) truncated = truncated.slice(0, max);

  return [
    'Você é um AGENTE DE INTERPRETAÇÃO jornalística. Seu único trabalho é LER a pauta bruta e ORGANIZAR os fatos — você NÃO escreve a matéria.',
    '',
    'Extraia SOMENTE o que está LITERALMENTE no conteúdo. Não deduza, não complete, não adicione contexto de fora. Se algo não estiver no texto, deixe vazio ou fora da lista.',
    '',
    'Responda APENAS com um objeto JSON válido, sem comentários, sem cercas de código, com EXATAMENTE estas chaves:',
    '{',
    '  "assunto": "frase curta que resume o tema central",',
    '  "categoria": "uma categoria jornalística em MAIÚSCULAS (ex.: POLÍTICA, ECONOMIA, SAÚDE, EDUCAÇÃO, SEGURANÇA, ESPORTE, CULTURA, CIDADE, GERAL)",',
    '  "local": "cidade/UF ou lugar citado, ou string vazia se não houver",',
    '  "resumo_factual": "1 a 2 frases neutras contendo só os fatos, sem adjetivos",',
    '  "fatos": ["cada fato atômico em linguagem NEUTRA, JÁ COM A FONTE quando houver uma. Preserve o acontecimento, os nomes, os números e as datas; retire adjetivo e advérbio de valor. \'A obra foi um sucesso extraordinário e atendeu 500 famílias\' vira \'A obra atendeu 500 famílias\'. \'O governador disse que as obras começam em 1º de agosto\' vira \'Segundo o governador, as obras começam em 1º de agosto\' — NUNCA \'as obras começam em 1º de agosto\'"],',
    '  "atribuicoes": ["quem afirmou o quê, um por linha, no formato \'FONTE — o que ela afirma\'. Ex.: \'governador Jerônimo Rodrigues — anunciou que as obras da ponte começam em 1º de agosto\'. Entra tudo que veio de declaração, anúncio, nota, relatório, previsão ou estimativa de alguém"],',
    '  "entidades": ["pessoas, órgãos, empresas citados"],',
    '  "datas": ["datas/prazos citados"],',
    '  "numeros": ["números, valores, quantidades citados com sua unidade"],',
    '  "citacoes": ["falas entre aspas atribuídas a alguém, se houver"],',
    '  "contexto": ["elementos de PANO DE FUNDO presentes no material: antecedentes, causas, motivações, reações, comparações e consequências que o próprio texto menciona"],',
    '  "angulos": ["2 a 4 leituras editoriais que os fatos acima SUSTENTAM — sem afirmar nenhuma como verdade; é o repertório do redator para argumentar"],',
    '  "status_processual": "se houver acusação/crime/apuração, em que FASE o material coloca cada pessoa — ex.: \'X é suspeito\', \'Y foi denunciado pelo MP\', \'Z foi condenado em 1ª instância\'. String vazia se não se aplica",',
    '  "contraditorio": ["a versão do acusado/investigado/empresa, se o material a traz — falas, notas, negativas"],',
    '  "sensivel": ["marque os domínios de risco presentes: CRIMINAL, JUDICIAL, MENOR_DE_IDADE, SAUDE, FINANCEIRO, ELEITORAL — vazio se nenhum"],',
    '  "carga_original": ["as expressões de JUÍZO que você retirou dos fatos — os adjetivos, advérbios e construções com que a FONTE avaliou os acontecimentos (ex.: \'sucesso extraordinário\', \'situação caótica\', \'apenas\', \'finalmente\')"],',
    '  "viés_da_fonte": "para que lado o texto de origem pende: POSITIVO, NEGATIVO ou NEUTRO",',
    '  "lacunas": ["informações que faltam ou estão ambíguas — para o redator NÃO inventar"]',
    '}',
    '',
    'Regras: mantenha nomes, números e datas EXATAMENTE como no texto. Não traduza. Não arredonde números. Arrays vazios são permitidos.',
    '',
    '═══ QUEM DISSE É PARTE DO FATO ═══',
    'Anúncio, previsão, estimativa, promessa, balanço e avaliação NÃO são acontecimentos: são DECLARAÇÕES de alguém. Se você registrar "as obras começam em 1º de agosto" como fato seco, a matéria vai afirmar isso por conta própria — quando o que existe é um governador tendo dito isso. A obra pode não começar; o que é verificável é que ele anunciou.',
    'Então: todo item de "fatos" que veio de uma declaração começa por "Segundo X…", "De acordo com X…", "X informou que…". Só ficam SEM fonte os acontecimentos que o material apresenta como ocorridos e observáveis ("a ponte foi interditada", "choveu 80 mm").',
    'Quando o material NÃO diz de quem veio a informação, registre isso em "lacunas" (ex.: "o material não informa quem anunciou a data") — o redator precisa saber que ali falta dono.',
    '',
    'SEPARE O FATO DO JUÍZO. Este é o ponto mais importante do seu trabalho: o que aconteceu é FATO e vai para "fatos"; como a fonte avaliou o que aconteceu é OPINIÃO DELA e vai para "carga_original". Quem escreve a matéria vai aplicar um tom possivelmente OPOSTO ao da fonte — se o juízo vier grudado no fato, a matéria sai contraditória, elogiando e criticando o mesmo acontecimento.',
    'As CITAÇÕES são exceção: fala entre aspas é reproduzida literalmente, com o juízo de quem falou, porque o fato ali é "fulano disse isso".',
    '',
    'Sobre "status_processual": copie a fase EXATA que o material afirma, sem promover ninguém de suspeito a culpado. Se o material diz apenas "preso em flagrante", é isso — não é condenação.',
    'Sobre "contraditorio": recolha a defesa APENAS se ela estiver no material. Se não houver, deixe vazio — o redator vai registrar a ausência, e não inventar uma resposta.',
    '',
    'Sobre "contexto" e "angulos": eles NÃO são convite para inventar. "contexto" só recolhe o que o material já traz além do fato seco. "angulos" lista interpretações POSSÍVEIS a partir desses fatos (ex.: "o valor é alto para o porte do município", "o prazo foi cumprido") — o redator decide se usa e sob qual enquadramento.',
    '',
    'CONTEÚDO DA PAUTA:',
    truncated,
  ].join('\n');
}

/** Interpretação de reserva quando o modelo não devolve JSON: embrulha o texto
 *  bruto num objeto mínimo para o redator ainda ter os fatos à mão. */
function fallbackInterpretation(content) {
  const text = String(content || '').trim();
  const firstLine = (text.split('\n').find((l) => l.trim()) || '').trim();
  return {
    assunto: firstLine.slice(0, 120),
    categoria: 'GERAL',
    local: '',
    resumo_factual: firstLine.slice(0, 240),
    fatos: text ? [text] : [],
    entidades: [],
    datas: [],
    numeros: [],
    citacoes: [],
    contexto: [],
    angulos: [],
    cargaOriginal: [],
    viesDaFonte: 'NEUTRO',
    statusProcessual: '',
    contraditorio: [],
    sensivel: [],
    lacunas: [],
    _fallback: true,
  };
}

/** Normaliza a saída do interpretador para um formato estável. */
function normalizeInterpretation(data, content) {
  if (!data || typeof data !== 'object') return fallbackInterpretation(content);
  return {
    assunto: asText(data.assunto),
    categoria: (asText(data.categoria) || 'GERAL').toUpperCase(),
    local: asText(data.local),
    resumo_factual: asText(data.resumo_factual),
    fatos: asList(data.fatos),
    entidades: asList(data.entidades),
    datas: asList(data.datas),
    numeros: asList(data.numeros),
    citacoes: asList(data.citacoes),
    atribuicoes: asList(data.atribuicoes),
    contexto: asList(data.contexto),
    angulos: asList(data.angulos),
    cargaOriginal: asList(data.carga_original || data.cargaOriginal),
    viesDaFonte: (asText(data['viés_da_fonte'] || data.vies_da_fonte || data.viesDaFonte) || 'NEUTRO').toUpperCase(),
    statusProcessual: asText(data.status_processual || data.statusProcessual),
    contraditorio: asList(data.contraditorio),
    sensivel: asList(data.sensivel).map((x) => String(x).toUpperCase()),
    lacunas: asList(data.lacunas),
  };
}

async function runInterpreterAgent(content, call = callLLM) {
  try {
    const r = await callLLMJson(buildInterpreterPrompt(content), call);
    const interp = normalizeInterpretation(r.data, content);
    // Se o modelo não deu nenhum fato aproveitável, garante ao menos o texto bruto.
    if (!interp.fatos.length && !interp.resumo_factual) {
      interp.fatos = [String(content || '').trim()].filter(Boolean);
    }
    return { interpretation: interp, model: r.model, promptTokens: r.promptTokens, completionTokens: r.completionTokens, ok: !!r.data };
  } catch (err) {
    // Falha de rede/quota é fatal só se nenhum agente conseguir rodar — propaga.
    throw err;
  }
}

/* -------------------------------------------------------------------------- */
/* 2) Agente Redator                                                           */
/* -------------------------------------------------------------------------- */

function interpretationToBlock(interp) {
  const lines = [];
  if (interp.assunto) lines.push(`Assunto: ${interp.assunto}`);
  if (interp.categoria) lines.push(`Categoria: ${interp.categoria}`);
  if (interp.local) lines.push(`Local: ${interp.local}`);
  if (interp.resumo_factual) lines.push(`Resumo factual: ${interp.resumo_factual}`);
  const bullets = (label, arr) => { if (arr && arr.length) lines.push(`${label}:`, ...arr.map((x) => `  - ${x}`)); };
  bullets('Fatos', interp.fatos);
  bullets('Entidades', interp.entidades);
  bullets('Datas', interp.datas);
  bullets('Números', interp.numeros);
  bullets('Citações', interp.citacoes);
  bullets('ATRIBUIÇÕES — quem afirmou o quê (use SEMPRE que escrever a informação)', interp.atribuicoes);
  bullets('Contexto presente no material', interp.contexto);
  bullets('Ângulos editoriais que os fatos sustentam', interp.angulos);
  if (interp.statusProcessual) lines.push(`Fase processual (NÃO promova ninguém além dela): ${interp.statusProcessual}`);
  bullets('Contraditório disponível no material (USE se houver)', interp.contraditorio);
  if (interp.cargaOriginal && interp.cargaOriginal.length) {
    lines.push('Juízo DA FONTE (não é fato — NÃO herde estas expressões):',
      ...interp.cargaOriginal.map((x) => `  - ${x}`));
  }
  if (interp.viesDaFonte && interp.viesDaFonte !== 'NEUTRO') {
    lines.push(`Viés do texto de origem: ${interp.viesDaFonte}`);
  }
  if (interp.sensivel && interp.sensivel.length) lines.push(`Domínios sensíveis: ${interp.sensivel.join(', ')}`);
  bullets('Lacunas (NÃO preencher com invenção)', interp.lacunas);
  return lines.join('\n');
}

/** Quantos parágrafos de corpo o material comporta. Fixar 2 fazia toda matéria
 *  ter a mesma forma: pauta rica saía espremida, pauta magra saía inflada com
 *  repetição. A extensão passa a acompanhar a quantidade de material. */
function suggestBodyLength(interp) {
  const i = interp || {};
  const peso = (i.fatos || []).length
    + (i.citacoes || []).length
    + Math.ceil(((i.numeros || []).length + (i.datas || []).length) / 2);
  if (peso <= 3) return { min: 2, max: 2 };
  if (peso <= 7) return { min: 2, max: 3 };
  if (peso <= 12) return { min: 3, max: 4 };
  return { min: 4, max: 5 };
}

function buildWriterPrompt(interp, style, tone, comentarios) {
  const tonePrompt = (typeof TONE_PROMPTS !== 'undefined' && (TONE_PROMPTS[tone] || TONE_PROMPTS['Neutro'])) || `Tom: ${tone}`;
  const stylePrompt_ = (typeof stylePrompt === 'function') ? stylePrompt(style) : `Estilo: ${style}`;
  const len = suggestBodyLength(interp);
  const faixa = len.min === len.max ? `${len.min}` : `${len.min} a ${len.max}`;
  const temCitacao = (interp.citacoes || []).length > 0;
  const blocoComentario = (typeof comentarioBloco === 'function') ? comentarioBloco(comentarios, tone) : '';
  return [
    'Você é um AGENTE REDATOR jornalístico profissional. Recebe FATOS JÁ ISOLADOS por outro agente e escreve a matéria. Você NÃO tem acesso ao texto original — só aos fatos abaixo.',
    '',
    '═══ A LINHA QUE VOCÊ NÃO CRUZA — E A LIBERDADE QUE VOCÊ TEM ═══',
    'Existe uma diferença decisiva entre INVENTAR FATO e DESENVOLVER ARGUMENTO. Confundir as duas coisas produz ou uma matéria mentirosa ou uma matéria sem vida. Você não pode a primeira; você DEVE a segunda.',
    '',
    'PROIBIDO (é invenção de fato):',
    '• nome, número, data, valor, local, cargo ou instituição que não esteja nos fatos;',
    '• declaração, citação ou opinião atribuída a alguém que não esteja nos fatos;',
    '• acontecimento, medida, causa ou consequência apresentada como OCORRIDA sem estar nos fatos;',
    '• dado de fora do material (conhecimento geral, histórico, comparação com outros casos).',
    '',
    'PERMITIDO E ESPERADO (é trabalho editorial, não invenção):',
    '• INTERPRETAR o que os fatos significam e dizer isso com todas as letras;',
    '• ARGUMENTAR a partir deles — sustentar uma leitura, mostrar tensão, contrapor um dado a outro;',
    '• ENQUADRAR: decidir o que vem primeiro, o que ganha parágrafo próprio, o que fica subordinado;',
    '• DESENVOLVER o que o material já traz em "Contexto" e "Ângulos" — é para isso que estão ali;',
    '• QUALIFICAR com juízo assumido como leitura ("o valor chama atenção", "o prazo é apertado"), desde que o fato que sustenta esteja na lista;',
    '• usar recursos retóricos: pergunta, contraste, repetição deliberada, frase curta de impacto.',
    '',
    'Teste prático: se um leitor perguntasse "de onde você tirou isso?", você conseguiria apontar o fato exato? Se sim, mesmo sendo uma INTERPRETAÇÃO dele, pode escrever. Se a resposta for "deduzi" ou "costuma ser assim", corte.',
    '',
    'Se um fato necessário estiver ausente (veja "Lacunas"), escreva sem ele — não preencha com suposição.',
    '',
    (typeof EDITORIAL_ATTRIBUTION !== 'undefined' ? EDITORIAL_ATTRIBUTION : ''),
    '',
    'A lista "ATRIBUIÇÕES" acima é o seu mapa: cada linha dela diz de quem é a informação. Ao escrever qualquer uma dessas informações, a fonte vai junto.',
    '',
    '═══ QUEM MANDA NO TOM É A ESCOLHA DO USUÁRIO, NÃO O TEXTO DE ORIGEM ═══',
    'O material de entrada tem um tom próprio — e ele pode ser o OPOSTO do que foi pedido. Nesse caso o tom da fonte NÃO tem autoridade nenhuma: quem manda é o tom selecionado, do começo ao fim da matéria.',
    '',
    'O erro a evitar: aproveitar um trecho do original junto com a avaliação que vinha nele. Isso produz uma matéria que se contradiz — elogia e critica o mesmo acontecimento em parágrafos diferentes.',
    '',
    'Adjetivo, advérbio e construção de juízo que vieram da fonte NÃO são fatos: são a opinião dela. Você pode e DEVE trocá-los, removê-los ou invertê-los para servir ao tom pedido. O que não pode mudar é o acontecimento.',
    '• A fonte diz "a obra foi um sucesso e atendeu 500 famílias" e o tom pedido é pessimista → o fato é "atendeu 500 famílias"; "sucesso" é juízo da fonte e sai. Você pode escrever "atendeu 500 famílias — número que o próprio material não compara com a fila de espera".',
    '• A fonte diz "o caos no trânsito piorou com a obra" e o tom pedido é otimista → o fato é "a obra alterou o trânsito"; "caos" é juízo da fonte e sai.',
    '• Em nenhum dos dois casos o acontecimento mudou. Mudou de quem é a avaliação.',
    '',
    'ÚNICA EXCEÇÃO: fala entre aspas. Citação é reproduzida LITERALMENTE, mesmo carregando juízo contrário ao seu tom — o fato ali é "fulano disse isso". O que é seu é o enquadramento: apresente, contextualize e responda à fala ("o secretário classificou a obra como \'um sucesso\'; os números do próprio material mostram…").',
    '',
    blocoComentario
      ? 'UNIDADE: ao terminar, a matéria inteira precisa soar como UMA voz. O RELATO não pode puxar para o lado contrário ao tom escolhido. Atenção: a camada de comentário (adiante) é a única exceção — ela tem direção própria, pedida pelo usuário, e não conta como quebra de unidade.'
      : 'UNIDADE: ao terminar, a matéria inteira precisa soar como UMA voz. Nenhum parágrafo pode puxar para o lado contrário ao tom escolhido.',
    '',
    '═══ O TOM ENQUADRA O FATO — NÃO FABRICA FATO NOVO ═══',
    'Ao aplicar um tom forte existe uma tentação perigosa: inventar a premissa que justifica o tom. Isso é alucinação, não estilo.',
    'PODE (é enquadramento): escolher a palavra-pivô — "apenas 2 mil atletas", "somente três cidades", "já são 2 mil atletas". O número é o mesmo; a leitura é sua.',
    'NÃO PODE (é fato inventado):',
    '• criar COMPARAÇÃO que o material não faz — "número baixo em relação a outras corridas da região" quando o material não traz nenhuma outra corrida para comparar;',
    '• apresentar a sua avaliação como consenso alheio — "foi considerado baixo", "é visto como insuficiente" sem dizer POR QUEM. Avaliação sem dono é fato inventado disfarçado de reportagem;',
    '• deduzir causa ou consequência que o material não afirma — "a falta de participantes afetou a competitividade".',
    'Se você quer sustentar a crítica (ou o elogio), use o que EXISTE: o próprio material, ou a ausência dele — "o material não informa quantas pessoas eram esperadas" é uma frase forte, honesta e do seu lado.',
    '',
    '═══ CADA PARÁGRAFO AVANÇA — UM ARGUMENTO, UMA VEZ ═══',
    'Tom forte não se constrói repetindo a mesma crítica (ou o mesmo elogio) em todos os parágrafos. Isso não intensifica: cansa, e denuncia que faltou o que dizer.',
    'Cada parágrafo do corpo trata de um ASPECTO DIFERENTE do assunto. Se você já disse que o público foi pequeno, o parágrafo seguinte fala de outra coisa — estrutura, custo, agenda, quem organiza, o que falta — e não reformula a mesma frase.',
    'Se o material só sustenta UM argumento, entregue MENOS parágrafos. Matéria curta e densa vale mais que matéria longa e circular.',
    '',
    (typeof EDITORIAL_SAFETY !== 'undefined' ? EDITORIAL_SAFETY : ''),
    '',
    '═══ FATOS ISOLADOS (sua única fonte da verdade) ═══',
    interpretationToBlock(interp),
    '',
    '═══ COMO USAR ESTA LISTA ═══',
    'A lista acima é MATÉRIA-PRIMA, não roteiro. O erro mais comum é transformá-la em texto na ordem em que aparece, um fato por frase — isso produz uma matéria travada, que soa como legenda de planilha.',
    'Em vez disso:',
    '• AGRUPE os fatos que pertencem à mesma ideia e escreva-os num mesmo parágrafo, numa frase só quando couber;',
    '• REORDENE conforme a arquitetura do estilo, não conforme a ordem da lista;',
    '• SUBORDINE o secundário ao principal ("A obra, orçada em R$ 2 milhões, foi entregue…" em vez de duas frases soltas);',
    '• Um fato pode aparecer implícito no encadeamento — não precisa ser reafirmado literalmente.',
    '',
    '═══ OFÍCIO EDITORIAL (é aqui que a matéria fica boa) ═══',
    'COESÃO: cada parágrafo puxa o anterior. Use retomada por elipse, pronome ou sinônimo em vez de repetir o mesmo sujeito ("A Prefeitura… O órgão… A gestão municipal…").',
    'TRANSIÇÕES: conecte por sentido, não por muleta. Prefira a relação lógica explícita ("com a entrega", "desde então", "o mesmo levantamento") a conectivos genéricos ("além disso", "vale ressaltar", "é importante destacar").',
    'RITMO: varie o comprimento das frases. Três frases seguidas do mesmo tamanho e da mesma estrutura deixam o texto monótono.',
    'ABERTURAS: nenhum parágrafo pode começar com a mesma palavra ou a mesma estrutura do anterior.',
    'ECONOMIA: corte redundância e perífrase ("realizou a entrega de" → "entregou"; "por meio da utilização de" → "com"). Nada de frase que não acrescenta ("A notícia repercutiu", "Confira os detalhes").',
    'HIERARQUIA: título, subtítulo e lead informam coisas DIFERENTES. Se o subtítulo é o título reescrito, refaça — use-o para o ângulo secundário.',
    temCitacao
      ? 'CITAÇÃO: use pelo menos uma das falas disponíveis, integrada ao texto (apresente quem fala antes de citar). Reproduza a fala LITERALMENTE, sem editar palavras.'
      : 'CITAÇÃO: não há falas no material — não crie nenhuma, nem em discurso indireto atribuído.',
    '',
    `═══ ESTILO "${style}" — arquitetura do texto ═══`,
    stylePrompt_,
    '',
    `═══ TOM "${tone}" — voz do texto ═══`,
    tonePrompt,
    '',
    `═══ INTENSIDADE: o tom "${tone}" precisa ser INEQUÍVOCO ═══`,
    'O defeito mais comum é aplicar o tom só no verniz — uma palavra-pivô no lead e o resto neutro. O resultado é uma matéria que fica igual em qualquer tom, e a escolha do usuário vira decorativa.',
    'O tom deve estar presente em TODOS os níveis: no título, no subtítulo, no lead, em CADA parágrafo do corpo e no fecho. Escolha de verbo, adjetivação, ordem dos fatos, o que ganha destaque e o que é subordinado, ritmo das frases — tudo carrega o tom.',
    'TESTE ANTES DE ENTREGAR: se você trocasse o tom por outro, quantas frases precisaria reescrever? Se a resposta for "poucas", o tom NÃO está aplicado — refaça com mais convicção.',
    'A intensidade não afrouxa a fidelidade: um tom forte se constrói com ênfase, enquadramento e argumento sobre os fatos que existem, nunca com fato novo.',
    '',
    ...(blocoComentario ? [blocoComentario, ''] : []),
    'Responda APENAS com um objeto JSON válido, sem cercas de código, com EXATAMENTE estas chaves:',
    '{',
    '  "titulo": "chamativo e informativo, JÁ refletindo o tom",',
    '  "subtitulo": "ângulo COMPLEMENTAR ao título, com palavras-pivô do tom",',
    '  "lead": "primeiro parágrafo com o essencial, ordem alinhada ao estilo e ao tom",',
    // O requisito entra no PRÓPRIO contrato de saída, não só no bloco de
    // instruções: é a linha que o modelo relê ao montar o JSON, e a que ele
    // menos ignora. Sem isto, a camada de comentário dependia de uma seção
    // distante lá em cima do prompt.
    blocoComentario
      ? `  "corpo": ["parágrafos de desenvolvimento — ${faixa} no total. CADA UM termina com uma frase de comentário ${comentarioDirecaoCurta(comentarios)}"],`
      : `  "corpo": ["parágrafos de desenvolvimento — ${faixa} no total, conforme o material comporta"],`,
    '  "resumo": "1 frase para legenda de rede social"',
    '}',
    '',
    `Regras: título sem prefixo "Título:". Corpo com ${faixa} parágrafo(s) — não encha linguiça para atingir o número; se o material só dá para ${len.min}, entregue ${len.min}.`,
    '',
    'VERIFICAÇÃO antes de responder:',
    '1. Cada nome, número, data, local e citação está na lista de fatos?',
    '2. Algum parágrafo é uma transcrição da lista em ordem, um fato por frase? Se sim, reescreva agrupando.',
    '3. O subtítulo diz algo que o título já disse? Se sim, troque o ângulo.',
    '4. Duas frases seguidas começam igual ou têm o mesmo comprimento? Se sim, varie.',
    '5. Trocando o tom por outro, quantas frases eu reescreveria? Se forem poucas, o tom está fraco — reforce.',
    '6. Eu me limitei a repetir os fatos, ou também os interpretei e argumentei a partir deles? Matéria sem leitura é boletim.',
    '7. Há acusação, crime ou apuração no texto? Então: usei o termo da fase processual correta, atribuí a informação e registrei o outro lado (ou a ausência dele)?',
    '7b. ATRIBUIÇÃO: confira a lista "ATRIBUIÇÕES" item a item. Cada uma dessas informações aparece na matéria COM a fonte? Alguma promessa, previsão, número, causa ou avaliação ficou escrita como se fosse do veículo? Devolva a fonte antes de responder.',
    '7c. JUÍZO SEM DONO — PARÁGRAFO A PARÁGRAFO: leia cada parágrafo isolado, como quem chega nele sem ter lido o anterior. Ele avalia alguma coisa ("é um exemplo de…", "é um passo importante", "é um sinal de…", "demonstra o compromisso…", "gestão eficaz")? Se avalia, o dono do juízo está NAQUELE parágrafo? Fonte citada no primeiro parágrafo NÃO cobre o terceiro. Se o juízo veio da fonte, devolva o dono; se não veio de ninguém, apague a frase — a matéria pode ficar mais curta, e isso é melhor do que o veículo assinar a opinião de outro.',
    '8. Alguma frase afirma como PROVADO algo que o material não prova? Se sim, reescreva atribuindo ou recue para o que se sustenta.',
    '9. Sobrou alguma palavra de juízo herdada da fonte que puxa para o lado CONTRÁRIO ao tom pedido? Fora dela — sem tirar o acontecimento.',
    '10. Inventei alguma comparação, avaliação sem dono ("foi considerado…") ou consequência para sustentar o tom? Se sim, troque pelo que o material realmente traz.',
    '11. Dois parágrafos fazem a mesma crítica ou o mesmo elogio com outras palavras? Funda-os e traga um aspecto novo — ou entregue um parágrafo a menos.',
    ...(blocoComentario ? [
      // A checagem de DIREÇÃO vem primeiro e nomeada: era o furo que fazia a
      // matéria sair sempre elogiosa, qualquer que fosse a escolha.
      `12. DIREÇÃO: releia UM A UM os comentários. Todos estão na direção pedida (${comentarioDirecaoCurta(comentarios)})? Qualquer um fora dela é erro de execução — reescreva antes de responder.`,
      '13. Cada comentário se apoia num fato da lista, ou algum deles trouxe informação que não está lá?',
      '14. Algum comentário está escrito como fato provado em vez de leitura assumida? Marque-o como leitura.',
      '15. Algum comentário desqualifica uma PESSOA em vez de comentar o ato, o dado ou a ausência? Reescreva mirando o ato.',
      '16. Todos os parágrafos terminam com a mesma fórmula de comentário? Varie a construção.',
    ] : []),
  ].join('\n');
}

/** Monta o objeto "article" estável a partir da saída (possivelmente parcial). */
function normalizeArticle(data, interp) {
  const clean = (s) => (typeof cleanText === 'function' ? cleanText(s) : String(s || '').trim());
  const corpo = asList(data && data.corpo).map(clean).filter(Boolean);
  let hashtags = asList(data && data.hashtags)
    .map((h) => h.replace(/\s+/g, ''))
    .map((h) => (h.charAt(0) === '#' ? h : '#' + h))
    .filter((h) => h.length > 1);
  hashtags = Array.from(new Set(hashtags)).slice(0, 8);
  return {
    titulo: clean(data && data.titulo) || interp.assunto || '',
    subtitulo: clean(data && data.subtitulo),
    lead: clean(data && data.lead),
    corpo,
    resumo: clean(data && data.resumo) || interp.resumo_factual || '',
    hashtags,
  };
}

/** Quando o redator não devolve JSON: trata a resposta bruta como matéria em
 *  texto corrido (comportamento do fluxo antigo) e a fatia em título/corpo. */
function articleFromPlainText(raw, interp) {
  const clean = (s) => (typeof cleanText === 'function' ? cleanText(s) : String(s || '').trim());
  const lines = clean(raw).split('\n').map((l) => l.trim()).filter(Boolean);
  const titulo = lines.shift() || interp.assunto || '';
  let subtitulo = '';
  if (lines.length >= 2 && lines[0].length <= 160) subtitulo = lines.shift();
  return {
    titulo,
    subtitulo,
    lead: lines[0] || subtitulo || '',
    corpo: lines,
    resumo: interp.resumo_factual || subtitulo || '',
    hashtags: [],
    _fallback: true,
  };
}

async function runWriterAgent(interp, style, tone, call = callLLM, comentarios) {
  const r = await callLLMJson(buildWriterPrompt(interp, style, tone, comentarios), call);
  const article = r.data ? normalizeArticle(r.data, interp) : articleFromPlainText(r.raw, interp);
  return { article, model: r.model, promptTokens: r.promptTokens, completionTokens: r.completionTokens, ok: !!r.data };
}

/* -------------------------------------------------------------------------- */
/* 3) Agente Editor — a passada de revisão                                     */
/*                                                                             */
/* Um redator entrega PRIMEIRA VERSÃO. O que separa um texto publicável de um  */
/* texto profissional é a revisão: cortar redundância, desfazer repetição de   */
/* estrutura, ajustar transição e ritmo. Nenhum modelo faz isso bem enquanto   */
/* ainda está ocupado decidindo O QUE dizer — por isso vira uma etapa própria, */
/* que já recebe o conteúdo resolvido e só cuida da forma.                     */
/*                                                                             */
/* O risco óbvio é a revisão introduzir fato. Além da instrução, há uma trava  */
/* DETERMINÍSTICA (editorIntroduziuFato): se o texto revisado trouxer número   */
/* ou citação que não existiam, a revisão é DESCARTADA e fica o rascunho.      */
/* -------------------------------------------------------------------------- */

function buildEditorPrompt(article, interp, style, tone, conflitos, repeticoes, comentarios) {
  const corpo = (article.corpo || []).map((p, i) => `  P${i + 1}: ${p}`).join('\n');
  const listaConflito = (conflitos && conflitos.length)
    ? [
      '',
      `═══ CONFLITO DE TOM DETECTADO — resolva ANTES de qualquer outra coisa ═══`,
      `Estas expressões de juízo estão no texto e puxam para o lado CONTRÁRIO ao tom "${tone}": ${conflitos.join(', ')}.`,
      'Elas vieram do material de origem, não do tom pedido. Reescreva cada trecho preservando o ACONTECIMENTO e trocando a avaliação — ou simplesmente retire o adjetivo, se ele não carregar fato nenhum.',
      'Se a expressão estiver dentro de uma CITAÇÃO entre aspas, deixe como está: fala é reproduzida literalmente. Nesse caso ajuste o enquadramento em volta dela.',
    ].join('\n')
    : '';
  const listaRepeticao = (repeticoes && repeticoes.length)
    ? [
      '',
      '═══ REPETIÇÃO DETECTADA — o texto está girando em falso ═══',
      ...repeticoes.map((r) => `• ${r}`),
      'Cada parágrafo tem que AVANÇAR: trazer um aspecto novo do assunto, não reformular o anterior. Se dois parágrafos fazem a mesma crítica (ou o mesmo elogio) com outras palavras, funda-os num só e use o espaço liberado para um ângulo ainda não explorado — ou entregue menos parágrafos. Matéria curta e densa é melhor que matéria longa e circular.',
      'Varie também as aberturas: nenhum parágrafo deve começar com o mesmo sujeito ou a mesma construção do anterior.',
    ].join('\n')
    : '';
  // A revisão é o lugar mais provável de a camada opinativa morrer: o
  // copidesque é treinado para cortar o que "não é fato". Sem este aviso, o
  // editor devolveria a matéria neutralizada e o usuário veria o controle não
  // fazer efeito nenhum.
  const blocoComentario = (typeof comentarioAtivo === 'function' && comentarioAtivo(comentarios))
    ? [
      '',
      `═══ ESTA MATÉRIA LEVA COMENTÁRIO OPINATIVO — direção ${typeof comentarioDirecaoCurta === 'function' ? comentarioDirecaoCurta(comentarios) : comentarios} ═══`,
      'As passagens de leitura e opinião são INTENCIONAIS — foram pedidas pelo usuário. NÃO as neutralize, não as corte por "não serem fato" e não as transforme em relato seco. Se a sua versão ficou mais informativa e menos opinativa, você desfez o pedido.',
      'O que você CORRIGE nelas:',
      '• comentário sem nenhum fato que o sustente → corte (é invenção, não opinião);',
      '• comentário escrito como fato provado ("ficou provado que") → reescreva marcado como leitura ("o material não explica");',
      '• comentário que desqualifica uma pessoa → troque pela crítica ao ato, ao dado ou ao prazo;',
      '• o mesmo comentário repetido em parágrafos diferentes → funda ou corte um.',
      'O que você NÃO faz: transformar opinião em informação, nem informação em opinião — nem INVERTER a direção de um comentário. Se um comentário está na direção contrária à pedida, corrija-o PARA a direção pedida; nunca o contrário.',
    ].join('\n')
    : '';
  return [
    'Você é um AGENTE EDITOR de texto jornalístico. Recebe uma matéria já escrita e a revisa como um copidesque profissional faria.',
    '',
    'SEU TRABALHO É A FORMA, NÃO O CONTEÚDO.',
    'É TERMINANTEMENTE PROIBIDO: acrescentar qualquer informação; remover um fato; alterar número, nome, data, local ou o texto de uma citação. Se a matéria não menciona algo, a revisão também não menciona.',
    'Você não "melhora" a matéria acrescentando contexto — melhora reescrevendo melhor o que já está lá.',
    '',
    '═══ O QUE CORRIGIR ═══',
    '1. REPETIÇÃO: mesma palavra ou raiz reaparecendo perto; parágrafos que abrem com a mesma palavra ou a mesma estrutura; o mesmo sujeito repetido em vez de retomado.',
    '2. REDUNDÂNCIA: informação repetida entre título, subtítulo, lead e corpo. Cada um deve acrescentar algo.',
    '3. PERÍFRASE: "realizou a entrega de" → "entregou"; "por meio da utilização de" → "com"; "no dia de hoje" → "hoje".',
    '   ATENÇÃO: "segundo o governador", "de acordo com a Secretaria", "informou a empresa" NÃO são perífrase — são a ATRIBUIÇÃO da informação. Nunca corte para enxugar. Se a construção estiver pesada, encurte a forma ("de acordo com o que informou o governador" → "segundo o governador"), jamais o dono da afirmação.',
    '4. FRASE MORTA: sentença que não afirma nada ("A notícia repercutiu", "Vale destacar a importância") — corte.',
    '5. TRANSIÇÃO: parágrafos justapostos sem ligação lógica. Costure pelo sentido, não com muleta ("além disso", "ademais").',
    '6. RITMO: sequências de frases do mesmo comprimento e da mesma estrutura. Varie.',
    '7. ORDEM DENTRO DA FRASE: leve para a frente o que importa; subordine o acessório.',
    '8. AMBIGUIDADE: pronome sem referente claro, sujeito oculto trocado no meio do parágrafo.',
    '9. RISCO JURÍDICO: informação sem dono; rótulo criminal definitivo antes de condenação ("o assassino", "o corrupto"); conclusão apresentada como fato provado; adjetivo que desqualifica a pessoa em vez de criticar o ato. Corrija SEM amolecer o texto — troque a acusação solta pela versão atribuída e precisa, que é mais forte, não mais fraca.',
    '',
    'Se um trecho já está bom, DEIXE COMO ESTÁ. Revisão não é reescrita gratuita.',
    '',
    listaConflito,
    listaRepeticao,
    // Só entra quando há camada opinativa: um item vazio a mais mudaria o
    // prompt de quem não pediu nada (linha em branco extra).
    ...(blocoComentario ? [blocoComentario] : []),
    `═══ ESTILO "${style}" / TOM "${tone}" — preservar e, se der, REFORÇAR ═══`,
    'Atenção: ao cortar redundância e frase morta, é fácil neutralizar o texto sem querer. NÃO faça isso. Se uma palavra carrega o tom, ela fica — mesmo que "mais enxuto" fosse possível. Onde a revisão puder tornar o tom MAIS nítido sem inventar fato, torne.',
    'Nunca troque uma formulação assumidamente interpretativa por uma neutra: a leitura editorial é intencional, não é defeito de escrita.',
    '',
    '═══ FATOS PERMITIDOS (o universo fechado do que pode aparecer) ═══',
    interpretationToBlock(interp),
    '',
    '═══ MATÉRIA A REVISAR ═══',
    `TÍTULO: ${article.titulo || ''}`,
    `SUBTÍTULO: ${article.subtitulo || ''}`,
    `LEAD: ${article.lead || ''}`,
    'CORPO:',
    corpo || '  (vazio)',
    `RESUMO: ${article.resumo || ''}`,
    '',
    'Responda APENAS com o JSON da matéria revisada, mesmas chaves e mesma quantidade de parágrafos de corpo:',
    '{ "titulo": "", "subtitulo": "", "lead": "", "corpo": ["…"], "resumo": "" }',
    '',
    'VERIFICAÇÃO:',
    '1. Algum número, nome, data ou citação da sua versão está ausente da matéria original? Se sim, você inventou — desfaça.',
    '2. Sua versão ficou mais NEUTRA que a original? Se sim, você apagou o tom — devolva a intensidade.',
    '3. Sobrou alguma afirmação que acusa alguém sem atribuição ou sem respaldo nos fatos? Reescreva atribuindo.',
    '3b. Alguma atribuição ("segundo…", "de acordo com…") sumiu da sua versão em relação à original? Se sim, devolva: a matéria passou a afirmar por conta própria o que era de outra pessoa.',
    '3c. Percorra os parágrafos UM A UM. Existe algum que avalia sem dono no próprio parágrafo ("é um exemplo de…", "é um passo importante", "é um sinal de…", "demonstra o compromisso…")? Atribuição no parágrafo anterior não vale — o leitor lê cada parágrafo como voz do veículo. Devolva o dono ou corte a frase. Cortar é permitido mesmo que o texto encurte.',
    blocoComentario
      ? '4. Restou expressão de juízo puxando o RELATO para o lado contrário ao tom? Corrija — sem tocar na camada de comentário, que tem direção própria e pedida.'
      : '4. Restou alguma expressão de juízo puxando para o lado contrário ao tom? A matéria tem que soar como UMA voz do início ao fim.',
    '5. Dois parágrafos dizem a mesma coisa com outras palavras? Funda-os — repetir argumento não reforça, cansa.',
  ].join('\n');
}

/** Remove os trechos entre aspas — citação é reproduzida literalmente e pode
 *  carregar juízo contrário ao tom sem que isso seja incoerência da matéria. */
function semCitacoes(texto) {
  return String(texto || '').replace(/[""«"][^""»"]*[""»"]/g, ' ');
}

/**
 * Acha, no texto, expressões de juízo que puxam para o lado CONTRÁRIO ao tom
 * escolhido — o vazamento que faz a matéria se contradizer.
 *
 * Devolve as expressões encontradas (lista vazia = coerente). Tom sem lado
 * definido (neutros e emocionais) não é verificado: não há contrário a apontar.
 * O resultado ALIMENTA O REVISOR com os trechos exatos a reescrever, em vez de
 * virar aviso na tela — o conserto é automático e o usuário não precisa saber
 * que houve conflito.
 */
function detectarConflitosDeTom(article, tone, interp, comentarios) {
  const texto = semCitacoes(articleAllText(article)).toLowerCase();
  const achados = [];

  // Valência que o usuário PEDIU na camada de comentário. Juízo daquele lado
  // deixa de ser vazamento e passa a ser o serviço contratado — apontá-lo ao
  // revisor faria a ferramenta apagar a escolha do próprio usuário.
  const intencional = (typeof comentarioValencias === 'function')
    ? comentarioValencias(comentarios)
    : { positivo: false, negativo: false };

  // (a) Léxico fixo — pega o vazamento clássico.
  const valencia = (typeof toneValence === 'function') ? toneValence(tone) : 0;
  if (valencia) {
    // Tom positivo → o "contrário" é o léxico negativo, e vice-versa.
    const contrarioEhNegativo = valencia > 0;
    const pedido = contrarioEhNegativo ? intencional.negativo : intencional.positivo;
    const contrarios = pedido ? [] : (contrarioEhNegativo
      ? ((typeof TOM_LEXICO_NEGATIVO !== 'undefined') ? TOM_LEXICO_NEGATIVO : [])
      : ((typeof TOM_LEXICO_POSITIVO !== 'undefined') ? TOM_LEXICO_POSITIVO : []));
    contrarios.forEach((termo) => { if (texto.includes(termo)) achados.push(termo); });
  }

  // (b) Carga da PRÓPRIA fonte que vazou. Lista fixa nunca fica completa —
  //     um caso real trouxe "superação" e "qualidade de vida", que nenhum
  //     léxico genérico previa. Como o interpretador já isola as expressões
  //     avaliativas daquele texto, conferir se elas reapareceram é adaptativo:
  //     vale para qualquer pauta, sem depender do meu vocabulário.
  const carga = (interp && interp.cargaOriginal) || [];
  const viesFonte = String((interp && interp.viesDaFonte) || 'NEUTRO').toUpperCase();
  const fonteContraria = (valencia > 0 && viesFonte === 'NEGATIVO')
    || (valencia < 0 && viesFonte === 'POSITIVO');
  if (fonteContraria || !valencia) {
    carga.forEach((expr) => {
      const e = String(expr).trim().toLowerCase();
      // Expressão curta demais vira ruído (bate com qualquer coisa).
      if (e.length >= 5 && texto.includes(e)) achados.push(expr);
    });
  }
  return Array.from(new Set(achados));
}

/**
 * Acha REPETIÇÃO estrutural: parágrafos que abrem igual e trechos longos
 * repetidos entre parágrafos.
 *
 * Um caso real saiu com quatro parágrafos fazendo a MESMA crítica — três deles
 * abrindo com "A corrida de rua em Cajutiba". A instrução de não repetir já
 * existia no prompt e não bastou: repetição é fácil de medir e cara de deixar
 * passar, então passa a ser verificada e devolvida ao revisor.
 */
function detectarRepeticoes(article) {
  const paras = [article && article.lead, ...((article && article.corpo) || [])]
    .map((x) => String(x || '').trim()).filter(Boolean);
  if (paras.length < 2) return [];
  const achados = [];

  // Aberturas iguais (3 primeiras palavras).
  const aberturas = {};
  paras.forEach((p) => {
    const chave = p.toLowerCase().replace(/[^\wáéíóúâêôãõçà\s]/g, '').split(/\s+/).slice(0, 3).join(' ');
    if (chave) (aberturas[chave] = aberturas[chave] || []).push(p);
  });
  Object.entries(aberturas).forEach(([chave, lista]) => {
    if (lista.length > 1) achados.push(`${lista.length} parágrafos abrem com "${chave}…"`);
  });

  // Trechos de 5+ palavras repetidos entre parágrafos diferentes.
  const norm = (p) => p.toLowerCase().replace(/[^\wáéíóúâêôãõçà\s]/g, ' ').split(/\s+/).filter(Boolean);
  const vistos = new Map();
  paras.forEach((p, idx) => {
    const w = norm(p);
    const nesteParagrafo = new Set();
    for (let i = 0; i + 5 <= w.length; i++) {
      const gram = w.slice(i, i + 5).join(' ');
      if (nesteParagrafo.has(gram)) continue;
      nesteParagrafo.add(gram);
      if (vistos.has(gram) && vistos.get(gram) !== idx) {
        achados.push(`trecho repetido entre parágrafos: "${gram}"`);
      } else if (!vistos.has(gram)) {
        vistos.set(gram, idx);
      }
    }
  });
  return Array.from(new Set(achados)).slice(0, 8);
}

/** Todo o texto visível de uma matéria, para as conferências determinísticas. */
function articleAllText(a) {
  if (!a) return '';
  return [a.titulo, a.subtitulo, a.lead, ...(a.corpo || []), a.resumo].filter(Boolean).join('\n');
}

/** Números de um texto, reduzidos aos dígitos (para "1.500" ≡ "1500"). */
function numericTokens(text) {
  const brutos = String(text || '').match(/\d[\d.,]*/g) || [];
  return brutos.map((n) => n.replace(/\D/g, '')).filter(Boolean);
}

/** Falas entre aspas (retas ou tipográficas). */
function quotedTokens(text) {
  const out = [];
  const re = /[""«"]([^""»"]{8,})[""»"]/g;
  let m;
  while ((m = re.exec(String(text || '')))) out.push(m[1].trim().toLowerCase());
  return out;
}

/**
 * A revisão introduziu conteúdo novo? Compara o texto revisado com o rascunho
 * MAIS o universo de fatos. Devolve a lista do que apareceu do nada (vazia =
 * revisão limpa). Falso positivo aqui só custa a perda do polimento — o
 * rascunho é mantido —, então a checagem pode ser rigorosa sem risco.
 */
function editorIntroduziuFato(rascunho, revisado, interp) {
  const permitido = [
    articleAllText(rascunho),
    (interp && interpretationToBlock(interp)) || '',
  ].join('\n');
  const numsOk = new Set(numericTokens(permitido));
  const quotesOk = new Set(quotedTokens(permitido).concat(
    ((interp && interp.citacoes) || []).map((c) => String(c).trim().toLowerCase())
  ));
  const achados = [];
  numericTokens(articleAllText(revisado)).forEach((n) => {
    if (!numsOk.has(n)) achados.push(`número ${n}`);
  });
  quotedTokens(articleAllText(revisado)).forEach((q) => {
    const conhecida = quotesOk.has(q) || [...quotesOk].some((k) => k.includes(q) || q.includes(k));
    if (!conhecida) achados.push(`citação "${q.slice(0, 40)}…"`);
  });
  return Array.from(new Set(achados));
}

/** Aplica a revisão preservando o que ela não deve mexer (hashtags) e mantendo
 *  o mesmo formato normalizado do redator. */
function mergeEditedArticle(rascunho, data) {
  const revisado = normalizeArticle(data, { assunto: rascunho.titulo, resumo_factual: rascunho.resumo });
  const saida = {
    titulo: revisado.titulo || rascunho.titulo,
    subtitulo: revisado.subtitulo || rascunho.subtitulo,
    lead: revisado.lead || rascunho.lead,
    corpo: revisado.corpo.length ? revisado.corpo : rascunho.corpo,
    resumo: revisado.resumo || rascunho.resumo,
    hashtags: rascunho.hashtags,     // a revisão não mexe em hashtags
  };
  // `_fallback` diz que a matéria veio de texto corrido (o redator não deu
  // JSON). É um sinal de PROCEDÊNCIA: a revisão melhora a forma, não muda de
  // onde o texto veio — perder a marca aqui escondia o fallback de quem lê o
  // resultado depois.
  if (rascunho._fallback) saida._fallback = true;
  return saida;
}

async function runEditorAgent(article, interp, style, tone, call = callLLM, comentarios) {
  const conflitos = detectarConflitosDeTom(article, tone, interp, comentarios);
  const repeticoes = detectarRepeticoes(article);
  try {
    const r = await callLLMJson(buildEditorPrompt(article, interp, style, tone, conflitos, repeticoes, comentarios), call);
    if (!r.data) return { article, ok: false, motivo: 'sem-json', model: r.model, conflitos, repeticoes };
    const revisado = mergeEditedArticle(article, r.data);
    const inventado = editorIntroduziuFato(article, revisado, interp);
    if (inventado.length) {
      // Fidelidade vence polimento: descarta a revisão inteira.
      return { article, ok: false, motivo: 'introduziu-fato', inventado, model: r.model, conflitos, repeticoes,
        promptTokens: r.promptTokens, completionTokens: r.completionTokens };
    }
    return { article: revisado, ok: true, model: r.model, conflitos, repeticoes,
      conflitosRestantes: detectarConflitosDeTom(revisado, tone, interp, comentarios),
      repeticoesRestantes: detectarRepeticoes(revisado),
      promptTokens: r.promptTokens, completionTokens: r.completionTokens };
  } catch (_) {
    // Revisão é opcional: qualquer falha mantém o rascunho.
    return { article, ok: false, motivo: 'erro', conflitos, repeticoes };
  }
}

/* -------------------------------------------------------------------------- */
/* 4) Agente de Otimização — hashtags estratificadas + palavras-chave          */
/*                                                                             */
/* Mesma FILOSOFIA do AutoPost IA (autopost-ia/js/api.js): hashtag não é       */
/* enfeite tirado do texto — é distribuição. Cada uma ocupa um NÍVEL DE        */
/* SEGMENTAÇÃO diferente, do alcance amplo ao público qualificado, e o         */
/* conjunto cobre a escada inteira. As palavras-chave são termos de BUSCA,     */
/* não sinônimos do título.                                                    */
/*                                                                             */
/* Os estratos do AutoPost (ampla · assunto · nicho×2 · intenção) foram        */
/* adaptados ao jornalismo com um nível a mais: LOCAL. Em notícia, a           */
/* geografia é a maior alavanca de indexação — quem busca "obra Calabar" está  */
/* mais perto de ler do que quem busca "obras". Por isso vira estrato próprio  */
/* quando a matéria tem lugar.                                                 */
/* -------------------------------------------------------------------------- */

const OPT_TIPOS = ['ampla', 'assunto', 'nicho', 'local', 'intencao'];
const OPT_TIPO_LABEL = {
  ampla: 'Ampla', assunto: 'Assunto', nicho: 'Nicho', local: 'Local', intencao: 'Intenção',
};

/** Contexto temporal — hashtag e termo de busca envelhecem. Mesmo recurso que
 *  o AutoPost usa para não sugerir tag que já perdeu alcance. */
function optContextoTemporal(hoje) {
  const d = hoje || new Date();
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
    'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `Estamos em ${meses[d.getMonth()]} de ${d.getFullYear()}. Priorize hashtags e termos de busca com alcance HOJE; evite tags datadas ou saturadas.`;
}

function buildOptimizerPrompt(interp, article, hoje) {
  const temLocal = !!(interp && interp.local);
  return [
    'Você é um AGENTE DE OTIMIZAÇÃO de conteúdo jornalístico para redes sociais e busca. Você NÃO reescreve a matéria — só produz a camada de distribuição.',
    '',
    optContextoTemporal(hoje),
    '',
    '═══ MATÉRIA ═══',
    `Título: ${article.titulo || ''}`,
    `Subtítulo: ${article.subtitulo || ''}`,
    `Lead: ${article.lead || ''}`,
    `Categoria: ${(interp && interp.categoria) || 'GERAL'}`,
    `Local: ${(interp && interp.local) || '(sem local)'}`,
    `Entidades citadas: ${((interp && interp.entidades) || []).join(', ') || '(nenhuma)'}`,
    '',
    `═══ REGRAS DAS ${temLocal ? '6' : '5'} HASHTAGS (estratificadas por nível de segmentação) ═══`,
    'Hashtag não é palavra bonita tirada do texto: cada uma tem uma FUNÇÃO na distribuição. Devolva exatamente esta composição:',
    '',
    '1. UMA hashtag AMPLA (tipo "ampla"): alcance grande E coerente com a editoria — #noticias, #politica, #economia, #saude, #educacao, #seguranca, #esporte, #cultura. Escolha pela categoria da matéria, não por moda.',
    '2. UMA hashtag de ASSUNTO (tipo "assunto"): o tema literal da matéria, como o leitor o nomearia — #obras, #concursopublico, #vacinacao, #transporte.',
    '3. DUAS hashtags de NICHO (tipo "nicho"): o recorte específico — subtema, órgão, setor ou programa citado. Volume menor, público qualificado (#mobilidadeurbana, #assistenciasocial, #saudepublica).',
    temLocal
      ? '4. UMA hashtag LOCAL (tipo "local"): a geografia da matéria — cidade, bairro ou estado. Em notícia local é o filtro que mais entrega leitor certo (#salvador, #bahia, #calabar).'
      : '4. (sem hashtag local: a matéria não tem lugar definido — pule este estrato)',
    '5. UMA hashtag de INTENÇÃO (tipo "intencao"): o que o leitor procura ou sente diante do assunto — #servico, #utilidadepublica, #denuncia, #transparencia, #meudinheiro.',
    '',
    'REGRAS DE FORMA: minúsculas, sem "#", sem espaços, sem acentos e sem caracteres especiais ("ação" → "acao"). Devem ser BUSCÁVEIS — alguém digita aquilo na barra de busca. Não repita a mesma tag em dois estratos.',
    'REGRA DE CONTEÚDO: extraia do que a matéria realmente diz. Não crie hashtag sobre assunto que não está lá.',
    '',
    '═══ REGRAS DAS ~10 PALAVRAS-CHAVE ═══',
    '- Devolva de 8 a 12 (idealmente ~10)',
    '- São TERMOS DE BUSCA: o que alguém digitaria no Google para chegar nesta matéria',
    '- Podem ter mais de uma palavra ("obras no centro", "cestas básicas Salvador")',
    '- Em português, minúsculas, COM acentuação normal (são palavras-chave, não hashtags)',
    '- Sem "#" e sem repetir literalmente as hashtags',
    '- Variadas: misture termo amplo do tema, termo de nicho, nome próprio citado e a variação com o local',
    '- Relacionadas ao conteúdo da matéria; não invente assunto que não esteja nela',
    '',
    '═══ FORMATO ═══',
    'Responda APENAS com JSON válido, sem cercas de código:',
    '{',
    '  "hashtags": [{"tag": "noticias", "tipo": "ampla"}, {"tag": "obras", "tipo": "assunto"}],',
    '  "palavras_chave": ["termo um", "termo dois"]',
    '}',
    `Os tipos válidos são EXATAMENTE: ${OPT_TIPOS.map((t) => `"${t}"`).join(', ')}.`,
  ].join('\n');
}

/** Tira acento, "#", espaço e caractere especial — a tag precisa ser digitável
 *  na busca da plataforma. */
function sanitizeHashtag(tag) {
  return String(tag || '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')   // remove diacríticos
    .replace(/^#+/, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

/** Normaliza a saída do otimizador: tipos válidos, tags saneadas e sem
 *  repetição, palavras-chave limpas. */
function normalizeOptimization(data) {
  const brutas = (data && Array.isArray(data.hashtags)) ? data.hashtags : [];
  const vistas = new Set();
  const hashtags = [];
  brutas.forEach((h) => {
    const obj = (h && typeof h === 'object') ? h : { tag: h, tipo: '' };
    const tag = sanitizeHashtag(obj.tag);
    if (!tag || vistas.has(tag)) return;
    vistas.add(tag);
    const tipo = OPT_TIPOS.includes(String(obj.tipo || '').toLowerCase())
      ? String(obj.tipo).toLowerCase() : 'assunto';
    hashtags.push({ tag, tipo });
  });
  const palavras = asList(data && (data.palavras_chave || data.palavrasChave || data.keywords))
    .map((k) => String(k).replace(/^#/, '').trim().toLowerCase())
    .filter((k) => k.length > 1);
  return {
    hashtags: hashtags.slice(0, 8),
    palavrasChave: Array.from(new Set(palavras)).slice(0, 12),
  };
}

/** Reserva determinística: monta a escada a partir do que a interpretação já
 *  isolou, sem custo de rede. Pior que a versão do modelo, mas mantém a
 *  ESTRUTURA — nunca devolve um punhado de tags soltas. */
function fallbackOptimization(interp, article) {
  const i = interp || {};
  const cat = String(i.categoria || 'GERAL').toLowerCase();
  const porCategoria = {
    'política': 'politica', politica: 'politica', economia: 'economia', saúde: 'saude',
    saude: 'saude', educação: 'educacao', educacao: 'educacao', segurança: 'seguranca',
    seguranca: 'seguranca', esporte: 'esporte', cultura: 'cultura', cidade: 'cidades',
  };
  const hashtags = [{ tag: porCategoria[cat] || 'noticias', tipo: 'ampla' }];
  const doAssunto = sanitizeHashtag((i.assunto || article.titulo || '').split(/\s+/).slice(0, 2).join(''));
  if (doAssunto) hashtags.push({ tag: doAssunto, tipo: 'assunto' });
  (i.entidades || []).slice(0, 2).forEach((e) => {
    const t = sanitizeHashtag(String(e).split(/\s+/).slice(0, 2).join(''));
    if (t) hashtags.push({ tag: t, tipo: 'nicho' });
  });
  const loc = sanitizeHashtag(String(i.local || '').split(/[,/]/)[0]);
  if (loc) hashtags.push({ tag: loc, tipo: 'local' });
  hashtags.push({ tag: 'utilidadepublica', tipo: 'intencao' });
  const palavras = [];
  if (i.assunto) palavras.push(String(i.assunto).toLowerCase());
  if (i.local) palavras.push(String(i.local).toLowerCase());
  if (i.assunto && i.local) palavras.push(`${String(i.assunto).toLowerCase()} ${String(i.local).toLowerCase()}`);
  (i.entidades || []).forEach((e) => palavras.push(String(e).toLowerCase()));
  return normalizeOptimization({ hashtags, palavras_chave: palavras });
}

/* -------------------------------------------------------------------------- */
/* Auditoria determinística de RISCO JURÍDICO                                  */
/*                                                                             */
/* O prompt é a prevenção; isto é a rede embaixo. Diferente da trava de         */
/* fidelidade — que DESCARTA a revisão quando ela inventa —, aqui nada é        */
/* reescrito: um alerta é devolvido para o usuário decidir. Software não        */
/* substitui revisão jurídica, e fingir que substitui seria pior do que não     */
/* avisar. O que dá para fazer com segurança é apontar os padrões que as        */
/* redações tratam como sinal amarelo.                                         */
/* -------------------------------------------------------------------------- */

function _temAlgum(texto, termos) {
  const t = String(texto || '').toLowerCase();
  return (termos || []).some((x) => t.includes(String(x).toLowerCase()));
}

/**
 * Aponta padrões de risco no texto final. Devolve [{ tipo, aviso }] — lista
 * vazia quando nada chamou atenção. É conservador de propósito: prefere não
 * avisar a encher a tela de alarme falso, porque aviso que sempre aparece é
 * aviso que ninguém lê.
 */
function auditarRiscoJuridico(article, interp, comentarios) {
  const texto = articleAllText(article);
  const t = texto.toLowerCase();
  const i = interp || {};
  const avisos = [];
  const rotulos = (typeof SAFETY_ROTULOS_CRIMINAIS !== 'undefined') ? SAFETY_ROTULOS_CRIMINAIS : [];
  const atribuicao = (typeof SAFETY_MARCADORES_ATRIBUICAO !== 'undefined') ? SAFETY_MARCADORES_ATRIBUICAO : [];
  const criminais = (typeof SAFETY_TERMOS_CRIMINAIS !== 'undefined') ? SAFETY_TERMOS_CRIMINAIS : [];
  const contraditorio = (typeof SAFETY_MARCADORES_CONTRADITORIO !== 'undefined') ? SAFETY_MARCADORES_CONTRADITORIO : [];

  const status = String(i.statusProcessual || '').toLowerCase();
  const houveCondenacao = /conden/.test(status) || /conden/.test(t);

  // 1) Rótulo definitivo antes de condenação — o risco clássico de difamação.
  const achados = rotulos.filter((r) => new RegExp(`\\b(o|a|os|as)\\s+${r}\\b`, 'i').test(texto));
  if (achados.length && !houveCondenacao) {
    avisos.push({
      tipo: 'rotulo-sem-condenacao',
      aviso: `O texto trata alguém como "${achados[0]}" e o material não registra condenação. Use o termo da fase processual (suspeito, investigado, denunciado, réu).`,
    });
  }

  const assuntoCriminal = _temAlgum(texto, criminais) || (i.sensivel || []).includes('CRIMINAL');

  // 2) Assunto criminal sem nenhuma marca de atribuição no texto inteiro.
  if (assuntoCriminal && !_temAlgum(texto, atribuicao)) {
    avisos.push({
      tipo: 'sem-atribuicao',
      aviso: 'A matéria trata de crime ou apuração sem nenhuma atribuição visível ("segundo…", "de acordo com…"). Toda informação assim precisa de fonte explícita.',
    });
  }

  // 2b) ATRIBUIÇÃO EM QUALQUER PAUTA. A checagem acima só valia para assunto
  // criminal — e o defeito relatado foi num anúncio de obra, onde a matéria
  // assumiu a data prometida como se fosse do veículo. Se o interpretador
  // isolou declarações (há "atribuicoes") e o texto final não traz NENHUMA
  // marca de fonte, a atribuição se perdeu no caminho.
  const declaracoes = (i.atribuicoes || []).length;
  if (!assuntoCriminal && declaracoes && !_temAlgum(texto, atribuicao)) {
    avisos.push({
      tipo: 'sem-atribuicao',
      aviso: `A pauta traz ${declaracoes} informação(ões) declarada(s) por alguém, mas a matéria não usa nenhuma atribuição ("segundo…", "de acordo com…"). Do jeito que está, o texto assume como do veículo o que é de outra pessoa — se a promessa não se cumprir, o erro passa a ser seu.`,
    });
  }

  // 2c) JUÍZO DE VALOR SEM DONO — PARÁGRAFO A PARÁGRAFO.
  //
  // A checagem 2b olha o texto INTEIRO: um único "segundo o prefeito" no lead
  // já a satisfazia. Foi exatamente assim que passou a matéria relatada — lead
  // atribuído, e depois três parágrafos afirmando "é um passo importante", "é
  // um exemplo de gestão eficaz", "é um sinal de que a prefeitura está
  // comprometida", sem dono nenhum. Nenhum aviso era emitido.
  //
  // Aqui a unidade é o parágrafo, que é como o leitor lê: uma fonte bem posta
  // cobre o parágrafo dela, não a matéria toda.
  //
  // Os dois modos são tratados diferente de propósito. Com a camada de
  // comentário LIGADA o usuário pediu opinião do veículo, e acusar todo
  // parágrafo opinativo seria brigar com o recurso — então só o elogio de
  // fórmula é cobrado, que as próprias regras de comentário já proíbem.
  const juizoTodos = (typeof SAFETY_MARCADORES_JUIZO !== 'undefined') ? SAFETY_MARCADORES_JUIZO : [];
  const juizoVazio = (typeof SAFETY_JUIZO_VAZIO !== 'undefined') ? SAFETY_JUIZO_VAZIO : [];
  const comComentario = (typeof comentarioAtivo === 'function') && comentarioAtivo(comentarios);
  const procurados = comComentario ? juizoVazio : juizoTodos;
  const paragrafos = [article && article.lead]
    .concat((article && article.corpo) || [])
    .filter((p) => typeof p === 'string' && p.trim());
  const orfaos = [];
  paragrafos.forEach((p, idx) => {
    if (_temAlgum(p, atribuicao)) return;          // a fonte cobre este parágrafo
    const achado = procurados.find((m) => p.toLowerCase().includes(m));
    if (achado) orfaos.push({ n: idx + 1, frase: achado });
  });
  if (orfaos.length) {
    const quais = orfaos.map((o) => `${o.n}º ("${o.frase}")`).join(', ');
    avisos.push({
      tipo: 'juizo-sem-dono',
      aviso: comComentario
        ? `Elogio de fórmula sem fato ao lado no(s) parágrafo(s) ${quais}. Comentário opinativo é leitura SUA sobre um fato relatado — repetir o vocabulário do release ("passo importante", "exemplo de gestão") devolve ao leitor a opinião da fonte assinada pelo veículo.`
        : `O(s) parágrafo(s) ${quais} avalia(m) sem dizer quem avalia. Quem lê entende que a opinião é do veículo. Se o juízo veio da fonte, devolva o dono ("Segundo o prefeito…"); se não veio de ninguém, corte — a matéria pode ficar mais curta.`,
    });
  }

  // 3) Acusação sem o outro lado — nem a versão, nem o registro da ausência.
  if (assuntoCriminal && (i.entidades || []).length && !_temAlgum(texto, contraditorio)) {
    avisos.push({
      tipo: 'sem-contraditorio',
      aviso: 'Há acusação e pessoas/órgãos nomeados, mas o texto não traz a versão deles nem registra a tentativa de contato. Inclua a defesa (se o material tiver) ou registre a ausência.',
    });
  }

  // 4) Menor de idade identificado. A checagem parte das ENTIDADES já isoladas,
  //    não de varrer a prosa atrás de maiúsculas: procurar "duas palavras
  //    capitalizadas" casava título + subtítulo através da quebra de linha e
  //    alertava em matéria que não tinha nome nenhum.
  const envolveMenor = (i.sensivel || []).includes('MENOR_DE_IDADE')
    || /\b(adolescente|menor de idade)\b/i.test(texto);
  if (envolveMenor) {
    const nomePessoa = (i.entidades || []).find((e) => {
      const nome = String(e).trim();
      return /^[A-ZÁÉÍÓÚÂÊÔÃÕÇ][^\s]+(\s+[A-ZÁÉÍÓÚÂÊÔÃÕÇa-z][^\s]*)+$/.test(nome)
        && nome.split(/\s+/).length >= 2
        && t.includes(nome.toLowerCase());
    });
    if (nomePessoa) {
      avisos.push({
        tipo: 'menor-identificado',
        aviso: `A matéria envolve adolescente e cita "${nomePessoa}". Confirme que o menor não está sendo identificado.`,
      });
    }
  }
  return avisos;
}

async function runOptimizerAgent(interp, article, call = callLLM, hoje) {
  try {
    const r = await callLLMJson(buildOptimizerPrompt(interp, article, hoje), call);
    const opt = r.data ? normalizeOptimization(r.data) : fallbackOptimization(interp, article);
    // Modelo que devolve JSON válido mas vazio não pode zerar a distribuição.
    const final = opt.hashtags.length ? opt : fallbackOptimization(interp, article);
    return { optimization: final, ok: !!r.data && !!opt.hashtags.length, model: r.model,
      promptTokens: r.promptTokens, completionTokens: r.completionTokens };
  } catch (_) {
    return { optimization: fallbackOptimization(interp, article), ok: false };
  }
}

/* -------------------------------------------------------------------------- */
/* Orquestrador                                                                */
/* -------------------------------------------------------------------------- */

/** Junta o article estruturado num TEXTO PLANO no mesmo formato do fluxo antigo,
 *  para que parseArticle/cartazes/carrosséis/histórico continuem funcionando. */
function articleToPlainText(article) {
  const parts = [];
  if (article.titulo) parts.push(article.titulo);
  if (article.subtitulo) parts.push(article.subtitulo);
  if (article.lead) parts.push(article.lead);
  (article.corpo || []).forEach((p) => { if (p) parts.push(p); });
  // Remove duplicata acidental (lead repetido como 1º parágrafo do corpo)
  const seen = new Set();
  const dedup = parts.filter((p) => {
    const k = p.trim().toLowerCase();
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  return dedup.join('\n\n');
}

/** Converte o article estruturado do pipeline no formato "art" consumido por
 *  createPosterFromGeneration / splitIntoSlides — evita reparsear texto plano
 *  (sem perda). Usado quando a geração tem `article` do pipeline. */
function artFromPipeline(g) {
  const a = g && g.article;
  const interp = (g && g.interpretation) || {};
  if (!a) return null;
  const bodyParagraphs = [];
  if (a.lead) bodyParagraphs.push(a.lead);
  (a.corpo || []).forEach((p) => { if (p && p.trim().toLowerCase() !== (a.lead || '').trim().toLowerCase()) bodyParagraphs.push(p); });
  const body = bodyParagraphs.join('\n\n').trim() || a.lead || a.subtitulo || a.titulo || '';
  return {
    title: a.titulo || interp.assunto || '',
    subtitle: a.subtitulo || a.resumo || '',
    lead: a.lead || a.subtitulo || '',
    body,
    bodyParagraphs,
    cta: '',
    category: (interp.categoria || '').toUpperCase(),
    location: interp.local || '',
  };
}

/**
 * Roda o pipeline completo de agentes.
 * @param {object} opts { content, style, tone, onStage? }
 *   onStage(key, title, desc) é chamado antes de cada etapa (UI de progresso).
 * @returns {Promise<object>} resultado com interpretation, article,
 *   content (texto plano), e metadados por agente.
 */
async function runContentPipeline({ content, style, tone, comentarios, onStage, call = callLLM } = {}) {
  const stage = (k, t, d) => { if (typeof onStage === 'function') onStage(k, t, d); };
  const agents = {};

  // 1) Interpretação — precisa rodar; se a rede/quota falhar aqui, propaga o erro.
  stage('interpret', 'Agente de interpretação…', 'Lendo a pauta e isolando os fatos.');
  const iRes = await runInterpreterAgent(content, call);
  agents.interpreter = { model: iRes.model, promptTokens: iRes.promptTokens, completionTokens: iRes.completionTokens, ok: iRes.ok };
  const interpretation = iRes.interpretation;

  // 2) Redação — a partir SÓ dos fatos isolados.
  stage('write', 'Agente redator…', 'Escrevendo título, lead e corpo.');
  const wRes = await runWriterAgent(interpretation, style, tone, call, comentarios);
  agents.writer = { model: wRes.model, promptTokens: wRes.promptTokens, completionTokens: wRes.completionTokens, ok: wRes.ok };
  const article = wRes.article;

  // 3) Revisão — copidesque sobre o rascunho. Só forma; se tentar mexer no
  //    conteúdo, a trava determinística descarta e fica o rascunho.
  stage('edit', 'Agente editor…', 'Revisando coesão, ritmo e transições.');
  const eRes = await runEditorAgent(article, interpretation, style, tone, call, comentarios);
  agents.editor = {
    model: eRes.model || null, ok: eRes.ok, motivo: eRes.motivo || null,
    inventado: eRes.inventado || null,
    conflitosDeTom: eRes.conflitos || [],
    conflitosRestantes: eRes.conflitosRestantes || [],
    repeticoes: eRes.repeticoes || [],
    repeticoesRestantes: eRes.repeticoesRestantes || [],
    promptTokens: eRes.promptTokens || null, completionTokens: eRes.completionTokens || null,
  };
  const articleFinal = eRes.article;

  // 4) Otimização — camada de distribuição (hashtags estratificadas + termos de
  //    busca). Vem depois da revisão para ler o texto FINAL.
  stage('optimize', 'Agente de otimização…', 'Montando hashtags e palavras-chave.');
  const oRes = await runOptimizerAgent(interpretation, articleFinal, call);
  agents.optimizer = {
    model: oRes.model || null, ok: oRes.ok,
    promptTokens: oRes.promptTokens || null, completionTokens: oRes.completionTokens || null,
  };
  const optimization = oRes.optimization;
  // As hashtags vivem no article (consumidores antigos já leem article.hashtags).
  articleFinal.hashtags = optimization.hashtags.map((h) => '#' + h.tag);

  // Auditoria de risco jurídico sobre o texto FINAL — não reescreve nada,
  // devolve pontos para o usuário conferir antes de publicar.
  const riscos = auditarRiscoJuridico(articleFinal, interpretation, comentarios);

  const contentText = articleToPlainText(articleFinal);

  return {
    interpretation,
    article: articleFinal,
    articleDraft: article,        // rascunho pré-revisão (auditoria/diagnóstico)
    optimization,                 // hashtags tipadas + palavras-chave
    riscos,                       // pontos de atenção jurídica (não bloqueiam)
    content: contentText,
    agents,
    // Modelo "principal" (redator) para exibir de forma compacta como antes.
    model: wRes.model || iRes.model || '',
    promptTokens: (iRes.promptTokens || 0) + (wRes.promptTokens || 0) + (eRes.promptTokens || 0) + (oRes.promptTokens || 0) || null,
    completionTokens: (iRes.completionTokens || 0) + (wRes.completionTokens || 0) + (eRes.completionTokens || 0) + (oRes.completionTokens || 0) || null,
  };
}
