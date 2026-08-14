'use strict';
/* ============================================================================
 * PACOTE — áudio, vídeo ou texto vira pacote de publicação
 *
 * Sucessora do AutoPost IA (removido no r227, "não faz mais sentido aqui").
 * Mesma finalidade — título com gancho, legenda, hashtags estratificadas e
 * palavras-chave de SEO para vídeo curto —, design enxuto: quase nada aqui é
 * motor novo. É orquestração do que a plataforma já resolveu em outro lugar:
 *
 *   título/legenda + doutrina sem spoiler  →  embalagem.js (nasceu do
 *     próprio AutoPost, r224; migrou para o Julgador no r226)
 *   anonimização contextual na legenda     →  doutrina de resumo.js (r234),
 *     e a conta que pega referência genérica repetida
 *   hashtag estratificada + palavras-chave →  forma e sanitização de
 *     agents.js (o Agente de Otimização), o prompt é que é novo
 *
 * A DIFERENÇA DE FILOSOFIA em relação ao AutoPost original: lá, a "revisão de
 * qualidade" era outra chamada de IA pontuando 9 critérios — um LLM
 * avaliando LLM, o exato risco que esta sessão corrigiu repetidas vezes em
 * Causos e Julgador. Aqui o juiz é CÓDIGO: uma chamada gera, uma conferência
 * determinística audita (spoiler vazando, referência genérica em excesso,
 * hashtag mal formada, poucas palavras-chave), no máximo uma chamada corrige.
 * Mais rápido, mais barato, e sem o risco de aprovação automática do próprio
 * erro.
 * ========================================================================== */

/* ---------------------------------------------------------------------------
 * A DOUTRINA DE ANONIMIZAÇÃO, adaptada para a legenda.
 *
 * Mesmo raciocínio do resumo (r234): trocar nome próprio por quem a pessoa É
 * no lugar certo, sem virar "uma pessoa" em toda frase. O usuário foi
 * explícito sobre o erro a evitar: "não quero que a ferramenta substitua
 * sistematicamente todos os nomes por expressões genéricas".
 * ------------------------------------------------------------------------- */
const PACOTE_REGRA_ANONIMIZACAO = `== SOBRE NOMES DE PESSOAS NA LEGENDA ==
Se o conteúdo cita gente comum (não figura pública, não quem está publicando), prefira não usar o nome — troque por QUEM A PESSOA É na situação: o funcionário, o motorista, o vizinho, a testemunha, o cliente, o comprador. Depende do contexto: a mesma pessoa pode ser qualquer um desses papéis.
NÃO troque tudo por "uma pessoa" ou "um homem" em toda frase — isso fica repetitivo e artificial. Use essas formas só quando o conteúdo não disser mais nada sobre quem é.
Nome de empresa, lugar, produto ou figura pública pode ficar — o que se evita é expor gente comum sem necessidade.`;

/* ---------------------------------------------------------------------------
 * HASHTAGS E PALAVRAS-CHAVE — a mesma filosofia de `buildOptimizerPrompt`
 * (agents.js), com as faixas do AutoPost original: 1 ampla, 1 assunto, 2
 * nicho, 1 intenção. A sanitização (`sanitizeHashtag`) e a normalização
 * (`normalizeOptimization`) são as MESMAS funções, chamadas sem cópia — o
 * contrato JSON usa os mesmos nomes de campo (`hashtags`, `palavras_chave`)
 * de propósito, para que uma função sirva às duas ferramentas.
 * ------------------------------------------------------------------------- */
function pacoteBlocoHashtags() {
  return [
    '== AS 5 HASHTAGS (estratificadas — cada uma tem uma função, não é palavra bonita tirada do texto) ==',
    '1. UMA hashtag AMPLA (tipo "ampla"): alcance grande, do universo de vídeo curto — #curiosidades, #humor, #historias, #foryou, #virou.',
    '2. UMA hashtag de ASSUNTO (tipo "assunto"): o tema literal, como quem assistiu nomearia.',
    '3. DUAS hashtags de NICHO (tipo "nicho"): o recorte específico — subtema, lugar do assunto, o que separa este vídeo de outro do mesmo tema geral.',
    '4. UMA hashtag de INTENÇÃO (tipo "intencao"): o que quem assiste sente ou busca — #chocante, #engracado, #inspirador, #vaiacreditar.',
    '',
    'REGRAS DE FORMA: minúsculas, sem "#", sem espaço, sem acento. Não repita a mesma tag em dois estratos.',
    '',
    '== ~10 PALAVRAS-CHAVE (termos de busca, não hashtag) ==',
    '- De 8 a 12, em português com acentuação normal',
    '- O que alguém digitaria para chegar neste vídeo',
    '- Podem ter mais de uma palavra',
    '- Não repita literalmente as hashtags',
  ].join('\n');
}

/* ---------------------------------------------------------------------------
 * O PEDIDO — título e legenda reaproveitam a doutrina sem spoiler de
 * `embalagem.js` (EMB_REGRAS_SEM_SPOILER, EMB_MAX_TITULO_CHARS,
 * EMB_MAX_LEGENDA_CHARS) VERBATIM, sem redeclarar nada aqui.
 * ------------------------------------------------------------------------- */
function buildPacotePrompt(conteudo, opcoes) {
  const o = opcoes || {};
  const linhas = [];
  linhas.push('Você escreve o PACOTE DE PUBLICAÇÃO de um vídeo curto: o título, a legenda, as hashtags e as palavras-chave que aparecem antes de a pessoa dar play.');
  linhas.push('Português do Brasil, na fala de quem publica — não em linguagem de anúncio.');
  linhas.push('');
  linhas.push(typeof EMB_REGRAS_SEM_SPOILER === 'string' ? EMB_REGRAS_SEM_SPOILER : '');
  linhas.push('');
  linhas.push(PACOTE_REGRA_ANONIMIZACAO);
  linhas.push('');
  linhas.push('== O CONTEÚDO ==');
  linhas.push(String(conteudo || ''));
  linhas.push('');
  linhas.push('== O QUE ENTREGAR ==');
  const maxTitulo = (typeof EMB_MAX_TITULO_CHARS === 'number') ? EMB_MAX_TITULO_CHARS : 90;
  const maxLegenda = (typeof EMB_MAX_LEGENDA_CHARS === 'number') ? EMB_MAX_LEGENDA_CHARS : 320;
  linhas.push(`- titulo: até ${maxTitulo} caracteres. Um detalhe concreto da situação + a resposta retida. Sem "você não vai acreditar", sem emoji, sem CAIXA ALTA gritada.`);
  linhas.push(`- legenda: até ${maxLegenda} caracteres. Ela AUMENTA a curiosidade do título, não a encerra.`);
  linhas.push('- pergunta_retida: a pergunta que sobra na cabeça de quem leu os dois e cuja resposta só está no vídeo.');
  linhas.push('- fisgada: em uma frase, qual detalhe você usou como isca e por quê.');
  linhas.push('');
  linhas.push(pacoteBlocoHashtags());
  if (typeof optContextoTemporal === 'function') {
    linhas.push('');
    linhas.push(optContextoTemporal(o.hoje));
  }
  if (Array.isArray(o.problemas) && o.problemas.length) {
    linhas.push('');
    linhas.push('== A TENTATIVA ANTERIOR FOI REPROVADA NA CONFERÊNCIA ==');
    o.problemas.forEach((p) => linhas.push(`- ${p}`));
    linhas.push('Corrija exatamente isso. Não resolva ficando vago.');
  }
  linhas.push('');
  linhas.push('Responda SÓ com JSON:');
  linhas.push('{"titulo": "...", "legenda": "...", "pergunta_retida": "...", "fisgada": "...",');
  linhas.push(' "hashtags": [{"tag": "...", "tipo": "ampla"}], "palavras_chave": ["...", "..."]}');
  return linhas.join('\n');
}

function _pkTexto(v) { return (v == null) ? '' : String(v).trim(); }

function pacoteNormalizarSugestao(obj) {
  const o = obj || {};
  const opt = (typeof normalizeOptimization === 'function')
    ? normalizeOptimization(o)
    : { hashtags: [], palavrasChave: [] };
  return {
    titulo: _pkTexto(o.titulo).replace(/^["'“”]+|["'“”]+$/g, ''),
    legenda: _pkTexto(o.legenda),
    pergunta: _pkTexto(o.pergunta_retida || o.pergunta),
    fisgada: _pkTexto(o.fisgada),
    hashtags: opt.hashtags,
    palavrasChave: opt.palavrasChave,
  };
}

/* ---------------------------------------------------------------------------
 * A CONFERÊNCIA — três verificações, três funções já testadas em outro
 * lugar, chamadas sem cópia. Só o mínimo de hashtags/palavras-chave é conta
 * nova, porque é a única coisa que nenhuma das três já media.
 * ------------------------------------------------------------------------- */
const PACOTE_MIN_HASHTAGS = 3;
const PACOTE_MIN_PALAVRAS_CHAVE = 5;

function auditarPacote(sugestao, conteudo) {
  const s = sugestao || {};
  const problemas = [];

  const spoiler = (typeof embAuditarSpoiler === 'function')
    ? embAuditarSpoiler(s, conteudo, '')
    : { ok: true, problemas: [] };
  problemas.push(...spoiler.problemas);

  const genericos = (typeof resumoGenericosRepetidos === 'function')
    ? resumoGenericosRepetidos(s.legenda)
    : [];
  if (genericos.length) {
    const lista = genericos.map((r) => `"${r.termo}" ${r.vezes}×`).join(', ');
    problemas.push(`referência genérica repetida na legenda: ${lista}. Diga quem a pessoa É naquele trecho — o motorista, a vizinha, o dono da loja.`);
  }

  if ((s.hashtags || []).length < PACOTE_MIN_HASHTAGS) {
    problemas.push(`só ${(s.hashtags || []).length} hashtag(s) — o pacote precisa de pelo menos ${PACOTE_MIN_HASHTAGS}, cobrindo faixas diferentes (ampla, assunto, nicho, intenção).`);
  }
  if ((s.palavrasChave || []).length < PACOTE_MIN_PALAVRAS_CHAVE) {
    problemas.push(`só ${(s.palavrasChave || []).length} palavra(s)-chave — o pacote precisa de pelo menos ${PACOTE_MIN_PALAVRAS_CHAVE} termos de busca.`);
  }

  return { problemas, ok: problemas.length === 0, spoiler };
}

/**
 * Uma chamada, uma conferência e — só se reprovar — uma segunda chamada com
 * o que falhou. No máximo duas, como `runEmbalagemPipeline`.
 *
 * Quando a segunda também falha, o pacote VAI para a tela mesmo assim, com o
 * problema declarado — esconder seria pior: quem publica fica sem nada.
 */
async function runPacotePipeline(opts) {
  const o = opts || {};
  const chamar = o.call || (typeof callLLM === 'function' ? callLLM : null);
  if (!chamar) throw new Error('Sem função de chamada de IA.');
  const conteudo = String(o.conteudo || '').trim();
  if (!conteudo) throw new Error('Não há conteúdo para ler.');
  const etapa = (k, t, d) => { if (typeof o.onEtapa === 'function') o.onEtapa(k, t, d); };
  const lerJSON = (r) => (typeof extractJSON === 'function' ? extractJSON(r && r.content) : null);

  let sugestao = null;
  let auditoria = null;
  let modelo = '';
  let tentativas = 0;

  for (let i = 0; i < 2; i++) {
    etapa(i === 0 ? 'lendo' : 'corrigindo',
      i === 0 ? 'Lendo e empacotando…' : 'Corrigindo o que a conferência achou…',
      i === 0 ? 'Título, legenda, hashtags e palavras-chave a partir do conteúdo.'
        : (auditoria.problemas[0] || ''));
    const r = await chamar(buildPacotePrompt(conteudo, {
      problemas: auditoria ? auditoria.problemas : null,
    }));
    tentativas++;
    if (r && r.model) modelo = r.model;
    const nova = pacoteNormalizarSugestao(lerJSON(r));
    if (!nova.titulo && !nova.legenda) throw new Error('A IA não devolveu o pacote.');
    sugestao = nova;
    auditoria = auditarPacote(nova, conteudo);
    if (auditoria.ok) break;
  }

  etapa('pronto', 'Pronto.', auditoria.ok ? 'A conferência passou.' : 'A conferência reprovou — veja o aviso.');
  return { ...sugestao, auditoria, tentativas, model: modelo, conteudo };
}
