'use strict';
/* ============================================================
   PACOTE — geração (LLM-C) e juiz de qualidade (LLM-D).
   O gerador monta título + legenda + 5 hashtags + ~10 palavras-
   chave; o juiz pontua com rubrica de 9 critérios e a nota final
   é recalculada no código (não confia na aritmética da LLM).
   ============================================================ */

// Gera título com gancho forte, legenda otimizada, 5 hashtags estratificadas
// e ~10 palavras-chave de SEO — o MESMO pacote completo de todos os modos.
// As práticas seguidas são as do ano corrente (ver contextoTemporal()).
async function gerarPacotePublicacao(roteiroFinal, briefing, feedbackAnterior = null) {
  const sys = `Você é um especialista em SEO e copywriting para plataformas de vídeo curto (TikTok, Instagram Reels, YouTube Shorts) no mercado brasileiro.

Sua tarefa: a partir de um ROTEIRO já pronto e do briefing original, gerar um PACOTE DE PUBLICAÇÃO completo composto de:

1. UM TÍTULO com gancho forte (50–80 caracteres)
2. UMA LEGENDA otimizada (150–300 caracteres no total, hashtags excluídas)
3. CINCO HASHTAGS estratificadas seguindo a fórmula viral brasileira
4. APROXIMADAMENTE 10 PALAVRAS-CHAVE relacionadas ao conteúdo (para SEO e identificação do tema pelos algoritmos)

${REGRAS_SEM_SPOILER}

==== REGRAS DO TÍTULO ====
- Entre 50 e 80 caracteres (ideal para preview sem corte em TikTok/Reels/Shorts)
- Deve abrir LOOP: dar a situação e RETER a resposta (ver a regra do spoiler acima — ela vem antes desta)
- Não usar clickbait barato ("você não vai acreditar"), mas SIM tensão real extraída do conteúdo
- Pode usar: número específico, contradição, pergunta provocadora, frase em 1ª pessoa marcante, revelação parcial
- Em português brasileiro, linguagem de fala natural
- Pode usar até 1 emoji estratégico (opcional, não obrigatório)
- NÃO repetir o gancho do roteiro literalmente — o título é DESCOBERTO pelo espectador antes do vídeo começar

==== REGRAS DA LEGENDA ====
- Entre 150 e 300 caracteres no total (sem contar hashtags)
- Os primeiros 80–100 caracteres são CRÍTICOS: aparecem antes do "ver mais". Tem que conter um mini-gancho ou frase de impacto que faça a pessoa parar
- NÃO é resumo do roteiro: a legenda COMPLEMENTA o vídeo, não compete com ele. Ela dá a situação e PARA antes da resposta — quem revela o final é o vídeo
- NUNCA use no texto uma informação que só aparece no fim do roteiro: é exatamente o que a pessoa iria assistir para descobrir
- Deve incluir UMA pergunta direta ao espectador no final para gerar comentário (regra de ouro do algoritmo: pergunta no caption = +44% de comentários)
- Linguagem natural, primeira pessoa quando fizer sentido
- Pode usar até 2 emojis estratégicos
- Em português brasileiro
- NÃO inclua as hashtags dentro da legenda — elas vão em campo separado

${REGRAS_HASHTAGS}

${REGRAS_PALAVRAS_CHAVE}

==== FORMATO DE RESPOSTA ====
RESPONDA APENAS COM JSON VÁLIDO, sem markdown, sem texto antes ou depois:

{
  "titulo": "string entre 50 e 80 caracteres",
  "legenda": "string entre 150 e 300 caracteres, com pergunta no final",
  "hashtags": [
    {"tag": "<a porta de entrada do assunto deste vídeo>", "tipo": "ampla"},
    {"tag": "<o formato/tipo deste conteúdo>", "tipo": "assunto"},
    {"tag": "<termo específico tirado do conteúdo>", "tipo": "nicho"},
    {"tag": "<outro termo específico tirado do conteúdo>", "tipo": "nicho"},
    {"tag": "<o que a pessoa sente ao assistir>", "tipo": "intencao"}
  ],
  "palavras_chave": ["palavra um", "termo dois", "..."]
}

O texto entre < > descreve O QUE colocar em cada posição — é instrução, não exemplo para copiar. Devolva a hashtag derivada deste conteúdo, sem os sinais < >.

Os tipos de hashtag válidos são EXATAMENTE: "ampla", "assunto", "nicho", "intencao".`;

  // Briefing tolerante: no modo "Já tenho um roteiro" não há duração/tom/nicho
  // (o roteiro colado é a única fonte) — essas linhas são omitidas quando vazias.
  const linhasBrief = [`Resumo da história: ${briefing.theme}`];
  if (briefing.duration) linhasBrief.push(`Duração-alvo: ${briefing.duration}s`);
  if (briefing.tone) linhasBrief.push(`Tom: ${briefing.tone}`);
  if (briefing.niche) linhasBrief.push(`Nicho/palavras-chave do canal: ${briefing.niche}`);
  linhasBrief.push(`Detalhes extras: ${briefing.extra || '(nenhum)'}`);

  const ctxChecklistPkg = checklistParaTexto(briefing.checklist);
  if (ctxChecklistPkg) {
    linhasBrief.push(`\nPreferências do checklist (formato, nicho, emoção, objetivo, plataforma) — use pra calibrar título, legenda, hashtags e palavras-chave:\n${ctxChecklistPkg}`);
  }

  let user = `==== BRIEFING ORIGINAL ====
${linhasBrief.join('\n')}

==== ROTEIRO FINAL APROVADO ====
${roteiroFinal}

==== TAREFA ====
Gere o pacote de publicação completo (título + legenda + 5 hashtags estratificadas + ~10 palavras-chave) seguindo TODAS as regras acima. Devolva APENAS o JSON.`;

  // REFINO: quando o juiz reprovou a versão anterior, anexa o feedback pra a IA corrigir.
  if (feedbackAnterior) {
    const ant = feedbackAnterior.pacoteAnterior || {};
    const hashtagsAnt = Array.isArray(ant.hashtags) ? ant.hashtags.map(h => '#' + (h.tag || '')).join(' ') : '';
    const kwAnt = Array.isArray(ant.palavras_chave) ? ant.palavras_chave.join(', ') : '';
    user += `\n\n===== REFINAMENTO NECESSÁRIO =====
A versão anterior recebeu nota ${feedbackAnterior.nota_total}/100. Os critérios que falharam:
${(feedbackAnterior.falhas || []).map(f => `- ${f.nome} (nota ${f.score}/10): ${f.feedback}`).join('\n') || '- qualidade geral abaixo do mínimo'}

Pacote anterior (para você MELHORAR, não repetir os erros):
- Título: ${ant.titulo || '(vazio)'}
- Legenda: ${ant.legenda || '(vazio)'}
- Hashtags: ${hashtagsAnt || '(vazias)'}
- Palavras-chave: ${kwAnt || '(vazias)'}

==== INSTRUÇÕES DE CORREÇÃO ====
Gere uma NOVA versão do pacote corrigindo cada problema apontado acima. Mantenha tudo que já estava bom. Continue respeitando TODAS as regras (fórmula das hashtags, faixas de caracteres, ~10 palavras-chave) e baseie-se SOMENTE no roteiro/transcrição fornecido — NÃO invente fatos que não estejam nele. Devolva APENAS o JSON.`;

    // Conferência determinística das hashtags: vem do código, não do juiz, e por
    // isso entra em bloco próprio — é constatação, não opinião com nota.
    // O mesmo tratamento para o spoiler: constatação do código, em bloco
    // próprio, sem nota. É o apontamento mais acionável que sai daqui — diz a
    // PALAVRA que vazou, e ela está no texto que a IA acabou de escrever.
    const probSpoiler = feedbackAnterior.problemasSpoiler || [];
    if (probSpoiler.length) {
      user += `\n\n==== CONFERÊNCIA DO SPOILER (verificação automática, não é opinião) ====
${probSpoiler.map((p) => '- ' + p).join('\n')}

Reescreva o título e a legenda mantendo a SITUAÇÃO e retirando a RESPOSTA. Depois de ler o pacote novo, ainda tem de sobrar uma pergunta que só o vídeo responde.`;
    }

    const probTags = feedbackAnterior.problemasHashtags || [];
    if (probTags.length) {
      user += `\n\n==== CONFERÊNCIA DAS HASHTAGS (verificação automática, não é opinião) ====
${probTags.map((p) => '- ' + p).join('\n')}

As hashtags novas TÊM de sair deste conteúdo: assunto concreto, nomes próprios, lugar, objeto, profissão, situação vivida. Refazer o conjunto inteiro é aceitável.`;
    }
  }

  return await callLLM(sys, user, true, 1000);
}

// =================== JUIZ DO PACOTE (LLM-D, call separada) ===================
// Um avaliador rigoroso pontua cada elemento + a publicação como um todo
// (0-10 por critério); a nota 0-100 é recalculada no código e o feedback
// alimenta o refino. A diretriz de contexto temporal já entra via callLLM.
const RUBRICA_PACOTE = [
  { id: 'titulo',             nome: 'Título com gancho forte',            desc: 'Abre loop / curiosidade real, 50–80 caracteres, sem clickbait barato, linguagem de fala natural.' },
  { id: 'legenda',            nome: 'Legenda otimizada',                  desc: '150–300 caracteres; os primeiros 80–100 prendem; termina com pergunta que puxa comentário; não embute as hashtags.' },
  { id: 'curiosidade',        nome: 'Retém a resposta (sem spoiler)',     desc: 'Depois de ler título e legenda, ainda sobra uma pergunta cuja resposta só está no vídeo? Entregar o desfecho — como terminou, o que se descobriu, quanto foi, quem era — é falha GRAVE (nota 0-3): quem já sabe não assiste. Ser vago também não vale: a curiosidade nasce de um detalhe concreto da situação com a resposta retida.' },
  { id: 'hashtags',           nome: 'Hashtags específicas deste conteúdo', desc: 'Exatamente 5 na fórmula 1 ampla · 1 assunto · 2 nicho · 1 intenção; buscáveis; sem acento/espaço. DERIVADAS do conteúdo: pelo menos 3 carregam um termo que aparece nele (assunto, nome próprio, lugar, objeto, situação). Conjunto que serviria para qualquer vídeo da mesma categoria, ou tag de plataforma (fyp, parati, viral, reels), é falha grave — nota 0-3. A de ASSUNTO não pode ser o nome da categoria escolhida: nessa posição ela sairia igual em todo conteúdo do nicho.' },
  { id: 'palavras_chave',     nome: 'Palavras-chave de SEO',              desc: '8–12 termos de busca reais e variados (amplos + nicho), sem repetir as hashtags, ligados ao conteúdo informado.' },
  { id: 'coerencia',          nome: 'Coerência geral da publicação',      desc: 'Título, legenda, hashtags e palavras-chave falam do MESMO conteúdo, sem contradição nem promessa que o vídeo não entrega. Coerência é falar do mesmo vídeo — NÃO é contá-lo: um pacote que resume o conteúdo inteiro é incoerente com a função dele, que é fazer assistir.' },
  { id: 'engajamento',        nome: 'Potencial de engajamento',           desc: 'O conjunto provoca ação: comentar, compartilhar, salvar ou assistir até o fim.' },
  { id: 'clareza',            nome: 'Clareza da comunicação',             desc: 'Mensagem nítida e sem ambiguidade; em segundos dá pra entender do que é o vídeo.' },
  { id: 'adequacao_objetivo', nome: 'Adequação ao que o usuário pediu',   desc: 'Reflete a descrição livre e as escolhas do checklist (tipo, nicho, emoção, objetivo, plataforma) sem fugir do solicitado nem inventar dados.' },
  { id: 'tendencias',         nome: 'Alinhamento com tendências atuais',  desc: 'Linguagem, formatos, hashtags e termos compatíveis com o que funciona AGORA (ver CONTEXTO TEMPORAL); evita modas saturadas/datadas.' }
];

async function avaliarPacote(pacote, contextoUsuario) {
  const rubricaTexto = RUBRICA_PACOTE.map(r => `- ${r.id}: ${r.nome} — ${r.desc}`).join('\n');
  const hashtagsStr = Array.isArray(pacote.hashtags)
    ? pacote.hashtags.map(h => `#${h.tag} (${h.tipo})`).join('  ')
    : '(vazias)';
  const kwStr = Array.isArray(pacote.palavras_chave) && pacote.palavras_chave.length
    ? pacote.palavras_chave.join(', ')
    : '(vazias)';

  const sys = `Você é um avaliador rigoroso e EXPERIENTE de pacotes de publicação para vídeos curtos (TikTok, Instagram Reels, YouTube Shorts) no mercado brasileiro. Você NUNCA infla notas — sua reputação depende de honestidade brutal. Avalie pelos padrões que funcionam AGORA, não por modas já saturadas.

Você recebe (1) O QUE O USUÁRIO PEDIU (descrição do conteúdo + escolhas de checklist) e (2) O PACOTE gerado (título, legenda, 5 hashtags, ~10 palavras-chave). Avalie cada critério da rubrica com nota de 0 a 10:
- 0-3: falha grave
- 4-6: deficiente, precisa melhorar
- 7-8: aceitável
- 9-10: excelente

Para cada critério dê: score (0-10) e feedback objetivo (1-2 frases), apontando o problema específico ou validando o acerto. No critério "adequacao_objetivo", verifique se o pacote NÃO inventa fatos que o usuário não informou e se respeita o objetivo/plataforma escolhidos.

RUBRICA COMPLETA:
${rubricaTexto}

RESPONDA APENAS COM JSON VÁLIDO no formato:
{
  "avaliacoes": [
    {"id": "titulo", "score": 8, "feedback": "..."},
    {"id": "legenda", "score": 7, "feedback": "..."},
    {"id": "curiosidade", "score": 6, "feedback": "..."},
    ...
  ],
  "nota_total": 82,
  "veredito": "string curta de 1 frase sobre o pacote como um todo"
}

A nota_total é (soma dos scores / total possível) * 100. Use cálculo correto.`;

  const user = `==== O QUE O USUÁRIO PEDIU ====
${contextoUsuario}

==== PACOTE A SER AVALIADO ====
Título: ${pacote.titulo || '(vazio)'}
Legenda: ${pacote.legenda || '(vazio)'}
Hashtags: ${hashtagsStr}
Palavras-chave: ${kwStr}

Avalie cada critério da rubrica agora. Seja honesto e rigoroso. Devolva APENAS o JSON.`;

  const resultado = await callLLM(sys, user, true, 1500);
  // Recalcula a nota a partir dos scores devolvidos, sem depender da aritmética da LLM
  if (resultado && Array.isArray(resultado.avaliacoes) && resultado.avaliacoes.length) {
    const soma = resultado.avaliacoes.reduce((acc, a) => acc + (Number(a.score) || 0), 0);
    const max = resultado.avaliacoes.length * 10;
    resultado.nota_total = Math.round((soma / max) * 100);
  }
  return resultado;
}

/* =================== CONFERÊNCIA DAS HASHTAGS (no código) ===================
 *
 * Instrução em prompt é pedido, não garantia. Esta conferência é determinística
 * e roda depois de toda geração: mede se as hashtags saíram DESTE conteúdo ou
 * se são as que caberiam em qualquer vídeo. O que ela encontra vira feedback
 * para o refino — a mesma iteração que já existia — e desempata entre as duas
 * versões geradas.
 *
 * Ela NÃO apaga nem reescreve hashtag: um acerto legítimo que a heurística não
 * reconheça continua na tela. O que ela faz é impedir que um pacote genérico
 * passe batido por ter tirado nota boa no resto. */

// Tags que existem para a plataforma, não para o assunto — cabem em qualquer
// vídeo, que é o contrário de um pacote personalizado.
const HASHTAGS_GENERICAS = [
  'fyp', 'fypage', 'fypbrasil', 'fyptiktok', 'foryou', 'foryoupage', 'foryoupageofficiall',
  'parati', 'paratii', 'paravoce', 'pravoce', 'viral', 'viralizar', 'viralvideo', 'viralizando',
  'tiktok', 'tiktokbrasil', 'reels', 'reelsinstagram', 'instagram', 'insta', 'shorts',
  'youtube', 'youtubeshorts', 'explorar', 'explore', 'trending', 'trend', 'tendencia',
  'seguidores', 'curtidas', 'likes', 'followers', 'video', 'videos', 'edit', 'capcut',
];

/* Palavras frequentes demais para valer como âncora: aparecem em qualquer texto
 * em português, então casá-las provaria nada. Sem esta lista, "parati" contaria
 * como ancorada em qualquer conteúdo que tivesse a palavra "para". */
const _PALAVRAS_VAZIAS = new Set([
  'para', 'pela', 'pelo', 'pelas', 'pelos', 'como', 'mais', 'menos', 'muito', 'muita',
  'todo', 'toda', 'todos', 'todas', 'esse', 'essa', 'esses', 'essas', 'este', 'esta',
  'isso', 'aquilo', 'aquele', 'aquela', 'quando', 'porque', 'entao', 'ainda', 'depois',
  'antes', 'sobre', 'entre', 'sempre', 'nunca', 'tambem', 'apenas', 'assim', 'onde',
  'quem', 'qual', 'quais', 'seja', 'foram', 'estava', 'estao', 'tinha', 'tinham',
  'fazer', 'fazendo', 'disse', 'dizer', 'gente', 'coisa', 'coisas', 'vezes', 'cada',
  'outro', 'outra', 'outros', 'outras', 'mesmo', 'mesma', 'aqui', 'agora', 'hoje',
  'bem', 'pouco', 'nada', 'tudo', 'algum', 'alguma', 'nao', 'sim', 'voce', 'voces',
]);

function _normalizarTag(s) {
  return String(s == null ? '' : s)
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

/** Uma hashtag genérica de plataforma? */
function hashtagEhGenerica(tag) {
  return HASHTAGS_GENERICAS.indexOf(_normalizarTag(tag)) >= 0;
}

/** Termos do conteúdo que servem de âncora (≥4 letras, fora da lista de vazias). */
function palavrasDoConteudo(texto) {
  const brutas = String(texto || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/);
  return [...new Set(brutas.filter((w) => w.length >= 4 && !_PALAVRAS_VAZIAS.has(w)))];
}

/** ANCORADA = carrega um termo que aparece no conteúdo. Vale nos dois sentidos:
 *  "historiasdetrabalho" contém "trabalho"; "sanfona" está dentro de "sanfoneiro". */
function hashtagAncorada(tag, palavras) {
  const t = _normalizarTag(tag);
  if (!t) return false;
  return (palavras || []).some((w) => t.indexOf(w) >= 0 || (t.length >= 5 && w.indexOf(t) >= 0));
}

// Mínimo de hashtags que precisam vir do conteúdo. Três das cinco é o que o
// prompt pede; aqui o piso é 2 de propósito — a conferência existe para pegar o
// pacote genérico, não para reprovar um conjunto bom por uma palavra.
const MIN_HASHTAGS_ANCORADAS = 2;

/* A TAG DE ASSUNTO NÃO É O NOME DO NICHO.
 *
 * Relatado: com a categoria selecionada, a tag de assunto vem fixa — todo
 * conteúdo daquele nicho sai com a mesma. A regra anterior dizia, com todas as
 * letras, que ali uma tag reaproveitável entre vídeos era aceitável; com o
 * rótulo da categoria escrito no prompt, o caminho mais curto era copiá-lo.
 *
 * A verificação abaixo é DE PROPÓSITO a mais estreita possível: olha só a
 * posição de assunto e só compara com as palavras do rótulo da categoria. Não
 * proíbe vocabulário nenhum além dessas — uma tentativa anterior de guiar a
 * variação por lista de proibições produziu hashtags sem relação com o conteúdo
 * e teve de ser desfeita. Aqui não há lista: há uma palavra que não cabe
 * naquela posição, que é justamente o nome do balcão. */
function palavrasDaCategoria(texto) {
  return [...new Set(String(texto || '')
    .toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length >= 4))];
}

function hashtagEhNomeDaCategoria(tag, categoriaTexto) {
  const t = _normalizarTag(tag);
  return !!t && palavrasDaCategoria(categoriaTexto).indexOf(t) >= 0;
}

/** A hashtag marcada como "assunto", quando a IA marcou os tipos. Depois de uma
 *  edição manual as tags viram texto puro e o tipo se perde — aí não há o que
 *  conferir, e conferir errado seria pior. */
function hashtagDeAssunto(pacote) {
  const lista = Array.isArray(pacote && pacote.hashtags) ? pacote.hashtags : [];
  const achada = lista.find((h) => h && typeof h === 'object' && h.tipo === 'assunto');
  return achada ? String(achada.tag || '') : '';
}

function auditarHashtags(pacote, conteudo, categoriaTexto) {
  const tags = (Array.isArray(pacote && pacote.hashtags) ? pacote.hashtags : [])
    .map((h) => (typeof h === 'string' ? h : (h && h.tag) || ''))
    .filter(Boolean);
  const palavras = palavrasDoConteudo(conteudo);
  const genericas = tags.filter(hashtagEhGenerica);
  const ancoradas = tags.filter((t) => !hashtagEhGenerica(t) && hashtagAncorada(t, palavras));

  const assunto = hashtagDeAssunto(pacote);
  const assuntoEhNicho = !!assunto && hashtagEhNomeDaCategoria(assunto, categoriaTexto);

  const problemas = [];
  if (assuntoEhNicho) {
    problemas.push(`a hashtag de assunto (#${_normalizarTag(assunto)}) é o nome da categoria escolhida. Nessa posição ela sai igual em TODO conteúdo deste nicho — e é a posição que deveria dizer que tipo de história é esta. Troque pelo que acontece neste vídeo.`);
  }
  if (genericas.length) {
    problemas.push(`${genericas.length} hashtag(s) de plataforma (${genericas.map((t) => '#' + _normalizarTag(t)).join(' ')}): elas cabem em qualquer vídeo e ninguém as busca procurando este assunto. Troque por termos tirados do conteúdo.`);
  }
  if (tags.length && ancoradas.length < MIN_HASHTAGS_ANCORADAS) {
    problemas.push(`só ${ancoradas.length} de ${tags.length} hashtags trazem um termo que aparece no conteúdo — o mínimo é ${MIN_HASHTAGS_ANCORADAS}, e o alvo é 3. O conjunto atual serviria para qualquer vídeo da mesma categoria. Use o assunto concreto, os nomes próprios, o lugar e a situação do conteúdo.`);
  }
  return { tags, genericas, ancoradas, assunto, assuntoEhNicho, problemas, ok: problemas.length === 0 };
}

/** Desconto de desempate: entre duas versões, a que personaliza ganha. Não é
 *  mostrado ao usuário — a nota exibida continua sendo a do juiz. */
function penalidadeHashtags(auditoria) {
  if (!auditoria) return 0;
  const faltando = Math.max(0, MIN_HASHTAGS_ANCORADAS - auditoria.ancoradas.length);
  return auditoria.genericas.length * 5 + faltando * 5 + (auditoria.assuntoEhNicho ? 5 : 0);
}

/* ===================== SPOILER: O PACOTE NÃO CONTA O FIM =====================
 *
 * Relatado: título e legenda entregavam tanta informação que o vídeo perdia a
 * razão de ser. Quem lê já sabe o que aconteceu — e não assiste.
 *
 * O que dá para MEDIR no código, e é justamente o que importa: o DESFECHO fica
 * no fim do roteiro. Palavras que só aparecem no último terço são o pagamento
 * da história — o que a pessoa deveria descobrir assistindo. Se elas estão no
 * título, o fim vazou.
 *
 * A conferência é de propósito estreita. Ela não julga se o título é curioso —
 * isso é gosto, e é trabalho do juiz. Ela responde a uma pergunta objetiva:
 * "esta frase usa uma palavra que só existe no final do vídeo?". Um "não" não
 * garante um bom título; um "sim" é vazamento quase sempre.
 * ========================================================================== */

/* O QUE CONTA COMO DESFECHO — e a estreiteza aqui é decisão, não descuido.
 *
 * A primeira versão desta conta olhava QUALQUER palavra de conteúdo que só
 * aparecesse no último terço. Medido no roteiro de teste, ela devolveu
 * "pediu", "olhou", "virou", "ficou", "verdade", "dentro" e "reais" como
 * desfecho — verbos comuns que por acaso estreiam tarde. Um título honesto
 * ("o vizinho me vendeu por vinte reais") era acusado de entregar o fim.
 * Máquina de falso positivo, e falso positivo aqui empurra o pacote para o
 * vago, que é um defeito pior do que o que se queria corrigir.
 *
 * Então a conta olha só o que é spoiler quase sempre: NÚMERO e NOME PRÓPRIO
 * que estreiam no fim. "Revendi por duzentos", "era o Sabido", "eram quarenta
 * ovos" — é assim que um desfecho vaza. Um verbo comum não vaza nada.
 *
 * Isso deixa passar spoiler contado sem número nem nome. Deixa mesmo: quem
 * julga isso é o juiz, com a rubrica. Esta conta existe para pegar o vazamento
 * inequívoco, e para não acusar ninguém à toa. */
const SPOILER_MIN_PALAVRAS_ROTEIRO = 60;

/* Número por extenso — o roteiro pode trazer a quantia escrita de qualquer
 * uma das duas formas, e as duas são o mesmo desfecho. */
const _NUMEROS_ESCRITOS = new Set([
  'dois', 'duas', 'tres', 'quatro', 'cinco', 'seis', 'sete', 'oito', 'nove',
  'dez', 'onze', 'doze', 'treze', 'catorze', 'quatorze', 'quinze', 'dezesseis',
  'dezessete', 'dezoito', 'dezenove', 'vinte', 'trinta', 'quarenta', 'cinquenta',
  'sessenta', 'setenta', 'oitenta', 'noventa', 'cem', 'cento', 'duzentos',
  'trezentos', 'quatrocentos', 'quinhentos', 'seiscentos', 'setecentos',
  'oitocentos', 'novecentos', 'mil', 'milhao', 'milhoes', 'bilhao', 'bilhoes',
]);

function _ehNumero(palavraNormalizada) {
  return /^\d+$/.test(palavraNormalizada) || _NUMEROS_ESCRITOS.has(palavraNormalizada);
}

/* Nome próprio: maiúscula que não abre a frase. A primeira palavra de cada
 * frase é sempre maiúscula e não diz nada sobre ser nome. */
function _nomesProprios(trecho) {
  const nomes = new Set();
  String(trecho || '').split(/(?<=[.!?…])\s+|\n+/).forEach((frase) => {
    frase.trim().split(/\s+/).slice(1).forEach((bruta) => {
      const limpa = bruta.replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ]+$/g, '');
      if (limpa.length < 3) return;
      if (!/^[A-ZÁÂÃÀÉÊÍÓÔÕÚÜÇ]/.test(limpa)) return;
      nomes.add(_normalizarTag(limpa));
    });
  });
  return nomes;
}

/** Número e nome próprio que SÓ aparecem no último terço — o desfecho vazável. */
function palavrasDoDesfecho(roteiro) {
  const brutas = String(roteiro || '').trim().split(/\s+/).filter(Boolean);
  if (brutas.length < SPOILER_MIN_PALAVRAS_ROTEIRO) return [];
  const corte = Math.floor((brutas.length * 2) / 3);
  const inicio = brutas.slice(0, corte).join(' ');
  const fim = brutas.slice(corte).join(' ');

  const antes = new Set(palavrasDoConteudo(inicio).concat([..._nomesProprios(inicio)]));
  const nomesDoFim = _nomesProprios(fim);
  return palavrasDoConteudo(fim)
    .filter((w) => (_ehNumero(w) || nomesDoFim.has(w)) && !antes.has(w));
}

/** Quais dessas palavras o texto usa. */
function spoilersEm(texto, desfecho) {
  const usadas = new Set(palavrasDoConteudo(texto));
  return (desfecho || []).filter((w) => usadas.has(w));
}

/* HOUVE UMA SEGUNDA CONFERÊNCIA AQUI, E ELA FOI REMOVIDA.
 *
 * A ideia era medir "resumo" pela abrangência: se a legenda encosta nos três
 * terços do roteiro, ela conta o vídeo inteiro. Parecia boa e não sobreviveu à
 * medição — palavras comuns ("reais", "vinte", "porta", "dinheiro") se repetem
 * ao longo de qualquer roteiro, então QUALQUER legenda encosta nos três terços,
 * inclusive uma que retém o desfecho de propósito. Na prática ela reprovava o
 * pacote certo.
 *
 * Ficou uma conferência só, estreita e confiável, em vez de duas com uma
 * gritando à toa: um alarme falso empurra o pacote para o vago, que é defeito
 * pior do que o spoiler que se queria corrigir. Julgar a dose de revelação sem
 * número nem nome é trabalho do juiz, pela rubrica. */

/* No título, UMA palavra do desfecho já é o fim entregue: ele tem 50 a 80
 * caracteres, não há palavra ali por acaso. Na legenda o limite é 2 — ela tem
 * espaço para contextualizar, e uma coincidência isolada não é spoiler. */
const SPOILER_MAX_TITULO = 0;
const SPOILER_MAX_LEGENDA = 1;

function auditarSpoiler(pacote, roteiro) {
  const p = pacote || {};
  const desfecho = palavrasDoDesfecho(roteiro);
  const noTitulo = spoilersEm(p.titulo, desfecho);
  const naLegenda = spoilersEm(p.legenda, desfecho);

  const problemas = [];
  if (noTitulo.length > SPOILER_MAX_TITULO) {
    problemas.push(`o título entrega o desfecho: "${noTitulo.join('", "')}" só acontece no fim do vídeo. Quem lê isso já sabe como termina e não precisa assistir. Diga o que está em jogo, não como acaba.`);
  }
  if (naLegenda.length > SPOILER_MAX_LEGENDA) {
    problemas.push(`a legenda entrega o desfecho: "${naLegenda.join('", "')}" só acontece no fim do vídeo. A legenda contextualiza; quem revela o final é o vídeo.`);
  }
  return {
    desfecho, noTitulo, naLegenda,
    problemas, ok: problemas.length === 0,
    // Sem roteiro longo o bastante não há terços, e não há o que conferir:
    // dizer "ok" aqui seria afirmar o que não foi medido.
    conferido: desfecho.length > 0,
  };
}

/** Desconto de desempate, no mesmo espírito do das hashtags. Entregar o fim no
 *  título custa mais do que na legenda: o título é o que decide o clique. */
function penalidadeSpoiler(auditoria) {
  if (!auditoria) return 0;
  const t = Math.max(0, auditoria.noTitulo.length - SPOILER_MAX_TITULO);
  const l = Math.max(0, auditoria.naLegenda.length - SPOILER_MAX_LEGENDA);
  return t * 8 + l * 4;
}

// =================== VARIAÇÃO DE UM ÚNICO ITEM (regeneração por card) ===================
// Gera uma NOVA versão de UM campo do pacote (título/legenda/hashtags/palavras-
// chave), mantendo coerência com o resto e respeitando as mesmas regras/opções.
// Devolve o valor novo desse campo (string, ou array para hashtags/palavras).
async function gerarVariacaoCampo(campo, roteiro, pacoteAtual, briefing, problemas) {
  const p = pacoteAtual || {};
  const hashtagsAtual = Array.isArray(p.hashtags)
    ? p.hashtags.map(h => '#' + (typeof h === 'string' ? h : (h && h.tag) || '')).join(' ')
    : '';
  const kwAtual = Array.isArray(p.palavras_chave) ? p.palavras_chave.join(', ') : '';
  const ctxChecklist = checklistParaTexto(briefing && briefing.checklist);
  const prefs = [
    ctxChecklist,
    (briefing && briefing.tone) ? `Tom desejado: ${briefing.tone}` : ''
  ].filter(Boolean).join('\n');

  const contexto = `==== CONTEÚDO (ÚNICA FONTE — não invente fatos fora dele) ====
${roteiro}

==== PACOTE ATUAL (mantenha coerência; gere algo DIFERENTE só do item pedido) ====
Título: ${p.titulo || '(vazio)'}
Legenda: ${p.legenda || '(vazio)'}
Hashtags: ${hashtagsAtual || '(vazias)'}
Palavras-chave: ${kwAtual || '(vazias)'}${prefs ? `\n\n==== PREFERÊNCIAS DO USUÁRIO ====\n${prefs}` : ''}`;

  if (campo === 'titulo') {
    const sys = `Você é especialista em copywriting para vídeo curto (TikTok/Reels/Shorts) no mercado brasileiro. Gere UMA NOVA versão do TÍTULO, claramente DIFERENTE da atual, coerente com a legenda e o conteúdo.
${REGRAS_SEM_SPOILER}

==== REGRAS DO TÍTULO ====
- Entre 50 e 80 caracteres; dá a situação e retém a resposta; sem clickbait barato; linguagem de fala natural; pode usar até 1 emoji.
RESPONDA APENAS COM JSON: {"titulo": "..."}`;
    const r = await callLLM(sys, contexto + '\n\nGere só um novo título. Devolva APENAS o JSON.', true, 300);
    return String((r && r.titulo) || '').trim();
  }

  if (campo === 'legenda') {
    const sys = `Você é especialista em copywriting para vídeo curto (TikTok/Reels/Shorts) no mercado brasileiro. Gere UMA NOVA versão da LEGENDA, claramente DIFERENTE da atual, coerente com o título e o conteúdo.
${REGRAS_SEM_SPOILER}

==== REGRAS DA LEGENDA ====
- Entre 150 e 300 caracteres; os primeiros 80–100 prendem; termina com UMA pergunta ao espectador; até 2 emojis; NÃO inclua hashtags.
- Dá a situação e PARA antes da resposta. Nada que só aparece no fim do roteiro entra aqui.
RESPONDA APENAS COM JSON: {"legenda": "..."}`;
    const r = await callLLM(sys, contexto + '\n\nGere só uma nova legenda. Devolva APENAS o JSON.', true, 400);
    return String((r && r.legenda) || '').trim();
  }

  if (campo === 'hashtags') {
    const sys = `Você é especialista em SEO para vídeo curto no mercado brasileiro. Gere um NOVO conjunto de 5 HASHTAGS, DIFERENTE do atual, derivado DESTE conteúdo.
${REGRAS_HASHTAGS}
RESPONDA APENAS COM JSON: {"hashtags":[{"tag":"...","tipo":"ampla|assunto|nicho|intencao"}, ...5 itens]}`;
    // Segunda tentativa: a conferência do código já disse o que saiu genérico.
    const correcao = (problemas && problemas.length)
      ? `\n\n==== CONFERÊNCIA DA TENTATIVA ANTERIOR (verificação automática) ====\n${problemas.map((p) => '- ' + p).join('\n')}\nO conjunto novo tem de sair deste conteúdo.`
      : '';
    const r = await callLLM(sys, contexto + correcao + '\n\nGere 5 novas hashtags estratificadas. Devolva APENAS o JSON.', true, 400);
    return Array.isArray(r && r.hashtags) ? r.hashtags : [];
  }

  if (campo === 'palavras_chave') {
    const sys = `Você é especialista em SEO para vídeo curto no mercado brasileiro. Gere um NOVO conjunto de ~10 PALAVRAS-CHAVE, DIFERENTE do atual, coerente com o conteúdo.
${REGRAS_PALAVRAS_CHAVE}
RESPONDA APENAS COM JSON: {"palavras_chave":["...", ...]}`;
    const r = await callLLM(sys, contexto + '\n\nGere ~10 novas palavras-chave. Devolva APENAS o JSON.', true, 400);
    return Array.isArray(r && r.palavras_chave) ? r.palavras_chave : [];
  }

  throw new Error('Campo desconhecido: ' + campo);
}
