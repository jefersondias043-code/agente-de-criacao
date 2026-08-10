'use strict';
/* ============================================================
   API — chamada central à IA (Groq · OpenAI-compatible) e as
   regras compartilhadas de prompt (contexto temporal, hashtags,
   palavras-chave). Retentativas com backoff em 429/503.
   ============================================================ */

async function callLLM(systemPrompt, userPrompt, expectJson = false, maxTokens = 1500) {
  const apiKey = await getGroqKey();
  if (!apiKey) throw new Error('Configure sua chave da API Groq (botão ⚙ no topo) para continuar.');

  // REGRA CENTRAL DA APLICAÇÃO: toda e qualquer chamada à IA — independente da
  // funcionalidade ou do modo — recebe primeiro a diretriz de contexto temporal,
  // garantindo conteúdo alinhado ao cenário atual em 100% dos fluxos, sem exceção.
  const systemComContexto = contextoTemporal() + "\n\n" + systemPrompt;

  const body = {
    model: groqModel(),
    max_tokens: maxTokens,
    temperature: expectJson ? 0.4 : 0.8,
    messages: [
      { role: "system", content: systemComContexto },
      { role: "user", content: userPrompt }
    ]
  };
  if (expectJson) body.response_format = { type: "json_object" };

  const MAX_RETRIES = 4;
  for (let attempt = 0; ; attempt++) {
    let response;
    try {
      response = await fetch(GROQ_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + apiKey
        },
        body: JSON.stringify(body)
      });
    } catch (netErr) {
      throw new Error("Falha de conexão. Verifique sua internet e tente novamente.");
    }

    // 429 (limite de taxa) ou 503: respeita Retry-After e tenta de novo com backoff
    if ((response.status === 429 || response.status === 503) && attempt < MAX_RETRIES) {
      const retryAfter = parseFloat(response.headers.get('retry-after'));
      const wait = Number.isFinite(retryAfter) && retryAfter > 0
        ? retryAfter * 1000
        : Math.min(1500 * Math.pow(2, attempt), 20000);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }

    if (!response.ok) {
      await response.text();
      throw new Error("Não foi possível concluir o processamento agora. Tente novamente em instantes.");
    }

    const data = await response.json();
    const text = ((data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || "").trim();
    if (expectJson) {
      const clean = text.replace(/```json|```/g, '').trim();
      try {
        return JSON.parse(clean);
      } catch (e) {
        throw new Error("Tivemos um problema ao montar o pacote. Tente novamente.");
      }
    }
    return text;
  }
}

// Converte o objeto de checklist ({categoria: [opções]}) em texto pra prompt.
// Retorna '' quando nada foi marcado (o checklist é sempre opcional).
function checklistParaTexto(checklist) {
  if (!checklist) return '';
  const blocos = Object.entries(checklist)
    .filter(([, v]) => Array.isArray(v) && v.length)
    .map(([nome, v]) => `- ${nome}: ${v.join(', ')}`);
  return blocos.join('\n');
}

// DIRETRIZ GLOBAL DE CONTEXTO TEMPORAL — esta é a regra central da aplicação.
// É injetada automaticamente em TODA chamada à IA dentro de callLLM (não em funções
// específicas), então VALE PARA TODOS os fluxos e modos sem exceção: criação e análise
// de roteiro, ganchos, estrutura, títulos, legendas, hashtags, palavras-chave, sugestões
// estratégicas e qualquer conteúdo futuro. Calcula ano/mês reais via new Date(), então
// nunca envelhece nem precisa ser editada a cada ano.
function contextoTemporal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const meses = ['janeiro','fevereiro','março','abril','maio','junho','julho','agosto','setembro','outubro','novembro','dezembro'];
  const dataExtenso = `${meses[agora.getMonth()]} de ${ano}`;
  return `==== CONTEXTO TEMPORAL — REGRA GERAL E INEGOCIÁVEL (LEIA PRIMEIRO) ====
A data atual é ${dataExtenso}. Estamos em ${ano}.

O ambiente digital evolui constantemente: plataformas, algoritmos, formatos, linguagem e comportamento de quem assiste mudam de ano para ano. TUDO o que você produzir ou avaliar nesta tarefa — seja roteiro, gancho, estrutura, título, legenda, hashtags, palavras-chave, análise ou sugestão — deve refletir o que funciona AGORA, em ${ano}, no mercado brasileiro de vídeo curto (TikTok, Instagram Reels, YouTube Shorts).

Isso significa, OBRIGATORIAMENTE:
- Usar tendências, formatos e estruturas que estão dando resultado em ${ano} (não em anos anteriores)
- Usar linguagem, gírias e referências contemporâneas, do momento presente
- Refletir os padrões de consumo e o comportamento atual da audiência
- Seguir as boas práticas mais recentes de cada plataforma e de seus algoritmos
- Escolher hashtags e palavras-chave que estão relevantes e buscáveis HOJE — evitar termos saturados, datados ou que já perderam tração
- NÃO reciclar táticas, jargões de marketing ou "fórmulas virais" que faziam sentido no passado mas envelheceram

Na dúvida entre uma abordagem antiga consagrada e uma mais alinhada ao cenário atual, escolha a atual. O resultado tem que parecer feito em ${ano}, por quem acompanha o que está funcionando agora.`;
}

// Regras das ~10 palavras-chave, compartilhadas entre o pacote padrão e o Modo Rápido,
// pra que TODOS os modos entreguem o mesmo modelo de pacote (título + legenda + hashtags + palavras-chave).
const REGRAS_PALAVRAS_CHAVE = `==== REGRAS DAS ~10 PALAVRAS-CHAVE ====
- Devolva de 8 a 12 palavras-chave (idealmente ~10)
- São TERMOS DE BUSCA do tema do vídeo — o que alguém digitaria pra achar esse conteúdo
- Podem ter mais de uma palavra (ex: "economizar no mercado", "lista de compras")
- Em português brasileiro, minúsculas, COM acentuação normal (são palavras-chave, não hashtags)
- Sem "#" e sem repetir as hashtags literalmente
- Variadas: misture termos amplos do tema, termos de nicho e variações que as pessoas realmente buscam
- Relacionadas ao conteúdo (tema/roteiro fornecido); NÃO invente um assunto que não esteja nele
- ATUAIS (ver CONTEXTO TEMPORAL no topo): use os termos como as pessoas REALMENTE buscam hoje, no ano corrente; evite jargões datados ou expressões que caíram em desuso`;

/* Regras de hashtags compartilhadas entre o pacote padrão e o Modo Rápido.
 *
 * O QUE MUDOU E POR QUÊ: estas regras entregavam um MENU. Traziam 24 hashtags
 * prontas — entre elas um mapa explícito "nicho → tag" (trabalho → #trabalho,
 * receitas → #culinaria, lifestyle → #parati…) — e o molde da resposta vinha
 * com um conjunto real e colável. Com um cardápio desses no prompt, o caminho
 * mais barato para o modelo é escolher do cardápio, e o resultado fica preso à
 * CATEGORIA em vez de sair do conteúdo: dois vídeos diferentes do mesmo nicho
 * recebiam praticamente as mesmas tags.
 *
 * A categoria é contexto — diz quem assiste e com que vocabulário busca. Não é
 * fonte de hashtag. Agora as regras descrevem o CAMINHO até a tag (o que olhar
 * no conteúdo) em vez de oferecer as tags, e cobram uma prova de especificidade
 * antes de devolver. */
const REGRAS_HASHTAGS = `==== REGRAS DAS 5 HASHTAGS ====
As hashtags são DERIVADAS DESTE CONTEÚDO. Não existe lista pronta, nem conjunto padrão por categoria.

Antes de escrever qualquer hashtag, levante no conteúdo:
- o assunto concreto (do que este vídeo fala, em poucas palavras)
- os nomes próprios que aparecem: pessoa, lugar, cidade, marca, produto, obra, time, prato, modelo, ferramenta
- a situação específica vivida (o que exatamente acontece)
- o que a pessoa sente ou procura ao assistir

A categoria informada pelo usuário serve para você entender o público e o vocabulário de busca dele. Ela NÃO é fonte de hashtag: não transforme o nome da categoria em tag e não use um conjunto "padrão do nicho". Dois vídeos da mesma categoria, com assuntos diferentes, têm de receber hashtags diferentes.

Devolva EXATAMENTE 5, nesta distribuição:
1. AMPLA — a maior porta de entrada DO ASSUNTO deste vídeo (não da categoria escolhida, não da plataforma). É por onde alguém interessado no tema chegaria.
2. ASSUNTO — o formato/tipo deste conteúdo. É o ÚNICO lugar onde uma tag reaproveitável entre vídeos é aceitável.
3 e 4. NICHO (duas) — as mais específicas do conjunto. É aqui que entram o nome próprio, o lugar, o objeto, a profissão ou a situação exata que aparecem no conteúdo.
5. INTENÇÃO / EMOÇÃO — o que a pessoa sente ao assistir ou o estado que ela procura.

PROVA OBRIGATÓRIA ANTES DE DEVOLVER:
- Pelo menos 3 das 5 precisam carregar um termo tirado do conteúdo. Se o mesmo conjunto serviria para outro vídeo da mesma categoria com assunto diferente, ele está errado — refaça.
- NUNCA use tag de plataforma ou de alcance vazio: fyp, foryou, foryoupage, parati, paravoce, viral, viralizar, tiktok, reels, shorts, explorar, trending, tendencia, seguidores, curtidas. Ninguém busca por elas procurando este assunto.

EXEMPLO DE RACIOCÍNIO (as tags abaixo pertencem ÀQUELE vídeo; não as reaproveite):
Vídeo: um sanfoneiro de 80 anos volta a tocar num forró em Caruaru.
✗ vago — poderia ter sido escrito sem assistir: musica, viral, parati, trend, artista
✓ derivado — só serve para este vídeo: forro, historiareal, sanfoneiro, caruaru, saudade
A diferença: a segunda linha saiu do conteúdo; a primeira, não.

REGRAS DE FORMA:
- Em português brasileiro; tag em inglês só quando for genuinamente a mais usada na plataforma para aquele assunto
- Sem espaços, sem acentos, sem caracteres especiais ("ação" vira "acao", "história" vira "historia")
- Minúsculas, e sem escrever o "#" (o app adiciona depois)
- Devem ser BUSCÁVEIS: alguém digita aquilo na barra de busca da plataforma
- Misture alcance: a ampla abre a porta, as de nicho qualificam o público
- ATUAIS (ver CONTEXTO TEMPORAL no topo): priorize o que é relevante e buscado no ano corrente; evite tag datada ou saturada`;
