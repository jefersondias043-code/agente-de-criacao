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
//                                 escreve título/subtítulo/lead/corpo/hashtags.
//                                 Como os fatos já vêm separados, é muito mais
//                                 difícil alucinar (o redator não vê "texto
//                                 solto" para preencher lacunas por conta).
//   3) Agente de Design         → dado o assunto e a forma da matéria, ESCOLHE
//                                 modelo + formato + paleta do catálogo já
//                                 existente (posters/carousels). É a peça nova:
//                                 antes a escolha visual era 100% manual.
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
    '  "fatos": ["cada fato atômico como uma frase curta e literal"],',
    '  "entidades": ["pessoas, órgãos, empresas citados"],',
    '  "datas": ["datas/prazos citados"],',
    '  "numeros": ["números, valores, quantidades citados com sua unidade"],',
    '  "citacoes": ["falas entre aspas atribuídas a alguém, se houver"],',
    '  "lacunas": ["informações que faltam ou estão ambíguas — para o redator NÃO inventar"]',
    '}',
    '',
    'Regras: mantenha nomes, números e datas EXATAMENTE como no texto. Não traduza. Não arredonde números. Arrays vazios são permitidos.',
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
  bullets('Lacunas (NÃO preencher com invenção)', interp.lacunas);
  return lines.join('\n');
}

function buildWriterPrompt(interp, style, tone) {
  const tonePrompt = (typeof TONE_PROMPTS !== 'undefined' && (TONE_PROMPTS[tone] || TONE_PROMPTS['Neutro'])) || `Tom: ${tone}`;
  return [
    'Você é um AGENTE REDATOR jornalístico. Recebe FATOS JÁ ISOLADOS por outro agente e escreve a matéria. Você NÃO tem acesso ao texto original — só aos fatos abaixo.',
    '',
    'PRINCÍPIO CENTRAL: estilo e tom se aplicam por MICROINTERVENÇÕES INTERPRETATIVAS (escolha de vocabulário, palavras-pivô, ordem de apresentação e ritmo) — NUNCA inventando fatos. Todo nome, número, data, local e citação DEVE vir da lista de fatos. Não use nada que não esteja lá.',
    '',
    'Se um fato necessário estiver ausente (veja "Lacunas"), escreva sem ele — não preencha com suposição.',
    '',
    '═══ FATOS ISOLADOS (sua única fonte da verdade) ═══',
    interpretationToBlock(interp),
    '',
    `═══ ESTILO: ${style} ═══`,
    `═══ INSTRUÇÕES DE TOM "${tone}" ═══`,
    tonePrompt,
    '',
    'Responda APENAS com um objeto JSON válido, sem cercas de código, com EXATAMENTE estas chaves:',
    '{',
    '  "titulo": "chamativo e informativo, JÁ refletindo o tom",',
    '  "subtitulo": "resumo dos pontos principais, com palavras-pivô do tom",',
    '  "lead": "primeiro parágrafo com o essencial, ordem alinhada ao tom",',
    '  "corpo": ["parágrafo de desenvolvimento 1", "parágrafo de desenvolvimento 2"],',
    '  "resumo": "1 frase para legenda de rede social",',
    '  "hashtags": ["#semEspaços", "3 a 6 hashtags relevantes ao assunto e ao local"]',
    '}',
    '',
    'Regras: título sem prefixo "Título:". Corpo com 2 parágrafos. Hashtags em minúsculas, sem acento, sem espaço, começando com #. Não repita o título inteiro no subtítulo.',
    '',
    'VERIFICAÇÃO antes de responder: cada elemento das suas frases é sustentado por um fato da lista? Se algum não for, REESCREVA sem ele.',
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

async function runWriterAgent(interp, style, tone, call = callLLM) {
  const r = await callLLMJson(buildWriterPrompt(interp, style, tone), call);
  const article = r.data ? normalizeArticle(r.data, interp) : articleFromPlainText(r.raw, interp);
  return { article, model: r.model, promptTokens: r.promptTokens, completionTokens: r.completionTokens, ok: !!r.data };
}

/* -------------------------------------------------------------------------- */
/* 3) Agente de Design                                                         */
/* -------------------------------------------------------------------------- */

// Cardápio CURADO que o agente de design enxerga. Os ids são validados contra
// os catálogos reais (POSTER_TEMPLATES / POSTER_PALETTES) na saída — se o modelo
// inventar um id, caímos no default. Manter esta lista enxuta melhora a escolha.
const DESIGN_TEMPLATE_MENU = [
  ['manchete', 'notícia padrão com foto (uso geral)'],
  ['headline-premium', 'manchete sofisticada com foto, para destaque'],
  ['breaking-alert', 'plantão / urgente / alerta'],
  ['destaque-foto', 'capa com foto dominante e pouco texto'],
  ['quote-impact', 'citação forte acompanhada de foto'],
  ['citacao', 'citação forte sem foto'],
  ['numbers-data', 'o fato central é um número ou dado'],
  ['kpis', 'vários indicadores numéricos'],
  ['topicos', 'lista de pontos / tópicos'],
  ['minimalista', 'texto limpo e elegante, sem foto'],
  ['editorial-signature', 'opinião / editorial assinado'],
];

const DESIGN_PALETTE_MENU = [
  ['vermelho-noticia', 'notícia geral, urgência, política — fundo escuro'],
  ['vermelho-premium', 'jornalístico elegante — fundo claro'],
  ['azul-institucional', 'governo, serviço público, institucional — escuro'],
  ['azul-editorial', 'economia, análise — fundo claro'],
  ['verde-editorial', 'saúde, meio ambiente, agro, notícia positiva — claro'],
  ['roxo-premium', 'cultura, tecnologia, criativo — escuro'],
  ['dourado-premium', 'especial, premiação, celebração — escuro'],
  ['preto-elegante', 'editorial sóbrio, luto, esporte premium — escuro'],
  ['cinza-corporativo', 'corporativo, neutro — escuro'],
  ['laranja-criativo', 'entretenimento, esporte, energia — escuro'],
  ['tons-tecnologicos', 'tecnologia, ciência, inovação — escuro'],
  ['tons-corporativos', 'negócios, economia — fundo claro'],
];

const DESIGN_FORMATS = [
  ['4:5', 'feed do Instagram (recomendado padrão)'],
  ['1:1', 'feed quadrado'],
  ['3:4', 'retrato para feed'],
  ['9:16', 'stories / reels'],
];

const DESIGN_DEFAULT = { template: 'manchete', format: '4:5', palette: 'vermelho-noticia' };

function buildDesignPrompt(interp, article) {
  const menu = (rows) => rows.map(([id, hint]) => `  - ${id}: ${hint}`).join('\n');
  const hasQuote = interp.citacoes && interp.citacoes.length > 0;
  const hasNumbers = interp.numeros && interp.numeros.length > 0;
  return [
    'Você é um AGENTE DE DESIGN editorial. Escolha a melhor combinação visual para publicar esta matéria em rede social. Você NÃO reescreve o texto — só decide a apresentação.',
    '',
    'Contexto da matéria:',
    `- Assunto: ${interp.assunto || article.titulo}`,
    `- Categoria: ${interp.categoria || 'GERAL'}`,
    `- Local: ${interp.local || '—'}`,
    `- Título: ${article.titulo}`,
    `- Tem citação forte: ${hasQuote ? 'sim' : 'não'}`,
    `- Tem número/dado central: ${hasNumbers ? 'sim' : 'não'}`,
    '',
    'MODELOS disponíveis (escolha um id):',
    menu(DESIGN_TEMPLATE_MENU),
    '',
    'PALETAS disponíveis (escolha um id, combine com a categoria/tom):',
    menu(DESIGN_PALETTE_MENU),
    '',
    'FORMATOS disponíveis (escolha um id):',
    menu(DESIGN_FORMATS),
    '',
    'Responda APENAS com um objeto JSON válido, sem cercas de código:',
    '{ "template": "id", "format": "id", "palette": "id", "justificativa": "1 frase curta" }',
    '',
    'Coerência: use "quote-impact"/"citacao" só quando há citação forte; "numbers-data"/"kpis" só quando o número é o centro; "breaking-alert" só em urgência real. Na dúvida, prefira "manchete".',
  ].join('\n');
}

/** Valida a escolha do design contra os catálogos reais; corrige o que for
 *  inválido para um default seguro. Roda no clique, então os catálogos já
 *  existem no escopo global (poster-templates.js carregado). */
function normalizeDesign(data) {
  const out = Object.assign({}, DESIGN_DEFAULT);
  if (data && typeof data === 'object') {
    const t = asText(data.template);
    const f = asText(data.format);
    const p = asText(data.palette);
    const templates = (typeof POSTER_TEMPLATES !== 'undefined') ? POSTER_TEMPLATES : null;
    const palettes = (typeof POSTER_PALETTES !== 'undefined') ? POSTER_PALETTES : null;
    const formats = DESIGN_FORMATS.map((x) => x[0]);
    if (t && (!templates || templates[t])) out.template = t;
    if (formats.includes(f)) out.format = f;
    if (p && (!palettes || palettes[p])) out.palette = p;
    out.justificativa = asText(data.justificativa);
  }
  // Rótulo amigável da paleta (para exibir no resultado)
  if (typeof POSTER_PALETTES !== 'undefined' && POSTER_PALETTES[out.palette]) {
    out.paletteLabel = POSTER_PALETTES[out.palette].label || out.palette;
  } else {
    out.paletteLabel = out.palette;
  }
  if (typeof POSTER_TEMPLATES !== 'undefined' && POSTER_TEMPLATES[out.template]) {
    out.templateLabel = POSTER_TEMPLATES[out.template].label || out.template;
  } else {
    out.templateLabel = out.template;
  }
  return out;
}

/** Heurística de reserva quando o agente de design falha: escolhe pela
 *  categoria/estrutura sem custo de rede. */
function fallbackDesign(interp, article) {
  const cat = (interp.categoria || '').toUpperCase();
  const d = Object.assign({}, DESIGN_DEFAULT);
  if (interp.citacoes && interp.citacoes.length) d.template = 'quote-impact';
  else if (interp.numeros && interp.numeros.length >= 2) d.template = 'numbers-data';
  const byCat = {
    'ECONOMIA': 'tons-corporativos', 'NEGÓCIOS': 'tons-corporativos',
    'SAÚDE': 'verde-editorial', 'MEIO AMBIENTE': 'verde-editorial',
    'CULTURA': 'roxo-premium', 'TECNOLOGIA': 'tons-tecnologicos',
    'ESPORTE': 'laranja-criativo', 'POLÍTICA': 'azul-institucional',
    'EDUCAÇÃO': 'azul-editorial', 'SEGURANÇA': 'preto-elegante',
  };
  if (byCat[cat]) d.palette = byCat[cat];
  return normalizeDesign(d);
}

async function runDesignAgent(interp, article, call = callLLM) {
  try {
    const r = await callLLMJson(buildDesignPrompt(interp, article), call);
    const design = r.data ? normalizeDesign(r.data) : fallbackDesign(interp, article);
    return { design, model: r.model, promptTokens: r.promptTokens, completionTokens: r.completionTokens, ok: !!r.data };
  } catch (_) {
    // Design é a etapa menos crítica: qualquer falha vira heurística local.
    return { design: fallbackDesign(interp, article), model: null, ok: false, _error: true };
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
 * @returns {Promise<object>} resultado com interpretation, article, design,
 *   content (texto plano), e metadados por agente.
 */
async function runContentPipeline({ content, style, tone, onStage, call = callLLM } = {}) {
  const stage = (k, t, d) => { if (typeof onStage === 'function') onStage(k, t, d); };
  const agents = {};

  // 1) Interpretação — precisa rodar; se a rede/quota falhar aqui, propaga o erro.
  stage('interpret', 'Agente de interpretação…', 'Lendo a pauta e isolando os fatos.');
  const iRes = await runInterpreterAgent(content, call);
  agents.interpreter = { model: iRes.model, promptTokens: iRes.promptTokens, completionTokens: iRes.completionTokens, ok: iRes.ok };
  const interpretation = iRes.interpretation;

  // 2) Redação — a partir SÓ dos fatos isolados.
  stage('write', 'Agente redator…', 'Escrevendo título, lead, corpo e hashtags.');
  const wRes = await runWriterAgent(interpretation, style, tone, call);
  agents.writer = { model: wRes.model, promptTokens: wRes.promptTokens, completionTokens: wRes.completionTokens, ok: wRes.ok };
  const article = wRes.article;

  // 3) Design — escolha visual (degrada para heurística local se falhar).
  stage('design', 'Agente de design…', 'Escolhendo modelo, formato e paleta.');
  const dRes = await runDesignAgent(interpretation, article, call);
  agents.design = { model: dRes.model, ok: dRes.ok };
  const design = dRes.design;

  const contentText = articleToPlainText(article);

  return {
    interpretation,
    article,
    design,
    content: contentText,
    agents,
    // Modelo "principal" (redator) para exibir de forma compacta como antes.
    model: wRes.model || iRes.model || (agents.design && agents.design.model) || '',
    promptTokens: (iRes.promptTokens || 0) + (wRes.promptTokens || 0) || null,
    completionTokens: (iRes.completionTokens || 0) + (wRes.completionTokens || 0) || null,
  };
}
