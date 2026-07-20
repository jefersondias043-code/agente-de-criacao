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

==== REGRAS DO TÍTULO ====
- Entre 50 e 80 caracteres (ideal para preview sem corte em TikTok/Reels/Shorts)
- Deve abrir LOOP: provocar curiosidade SEM entregar o desfecho da história
- Não usar clickbait barato ("você não vai acreditar"), mas SIM tensão real extraída do conteúdo
- Pode usar: número específico, contradição, pergunta provocadora, frase em 1ª pessoa marcante, revelação parcial
- Em português brasileiro, linguagem de fala natural
- Pode usar até 1 emoji estratégico (opcional, não obrigatório)
- NÃO repetir o gancho do roteiro literalmente — o título é DESCOBERTO pelo espectador antes do vídeo começar

==== REGRAS DA LEGENDA ====
- Entre 150 e 300 caracteres no total (sem contar hashtags)
- Os primeiros 80–100 caracteres são CRÍTICOS: aparecem antes do "ver mais". Tem que conter um mini-gancho ou frase de impacto que faça a pessoa parar
- NÃO é resumo do roteiro: a legenda COMPLEMENTA o vídeo, não compete com ele
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
    {"tag": "HASHTAG_AMPLA", "tipo": "ampla"},
    {"tag": "storytime", "tipo": "assunto"},
    {"tag": "historiasdetrabalho", "tipo": "nicho"},
    {"tag": "vidaclt", "tipo": "nicho"},
    {"tag": "indignacao", "tipo": "intencao"}
  ],
  "palavras_chave": ["palavra um", "termo dois", "..."]
}

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
  { id: 'hashtags',           nome: 'Hashtags estratificadas',            desc: 'Exatamente 5 na fórmula 1 ampla · 1 assunto · 2 nicho · 1 intenção; buscáveis; sem acento/espaço; coerentes com o conteúdo.' },
  { id: 'palavras_chave',     nome: 'Palavras-chave de SEO',              desc: '8–12 termos de busca reais e variados (amplos + nicho), sem repetir as hashtags, ligados ao conteúdo informado.' },
  { id: 'coerencia',          nome: 'Coerência geral da publicação',      desc: 'Título, legenda, hashtags e palavras-chave falam do MESMO conteúdo, sem contradição nem promessa que o vídeo não entrega.' },
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
