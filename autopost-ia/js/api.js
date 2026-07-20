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

// Regras de hashtags compartilhadas entre o pacote padrão e o Modo Rápido,
// pra que as hashtags saiam SEMPRE com a mesma fórmula (1 ampla · 1 assunto · 2 nicho · 1 intenção).
const REGRAS_HASHTAGS = `==== REGRAS DAS 5 HASHTAGS (fórmula viral brasileira) ====
Você deve devolver EXATAMENTE 5 hashtags, distribuídas assim:

1. UMA hashtag AMPLA / viral: amplo alcance E relevante para a categoria do conteúdo — NÃO use sempre #fyp ou #foryou. Escolha a tag ampla que mais se alinhe com o ASSUNTO do vídeo: para conteúdo de trabalho/carreira → #trabalho, para saúde/bem-estar → #saude, para receitas → #culinaria, para humor/entretenimento geral → #viral, para lifestyle → #parati, para educação → #aprender, para esportes → #esportes, para relacionamentos → #relacionamentos, para empreendedorismo → #negocios, etc. Use #fyp/#foryou APENAS quando o conteúdo for genuinamente de entretenimento geral sem categoria dominante.
2. UMA hashtag de ASSUNTO / categoria: descreve literalmente o tipo de conteúdo, volume médio (ex: #storytime, #relato, #historiareal, #desabafo, #conselho)
3. DUAS hashtags de NICHO: específicas do tema/canal, volume menor mas público qualificado (extraídas do tema/nicho informado e do conteúdo — ex: #historiasdetrabalho, #vidaclt, #rh, #empreendedorismo)
4. UMA hashtag de INTENÇÃO / EMOÇÃO: o que a pessoa SENTE ao assistir ou busca quando procura esse conteúdo (ex: #indignacao, #justicapoetica, #reflexao, #lifelesson, #aprendizado)

REGRAS DAS HASHTAGS:
- Todas em português brasileiro quando aplicável; tags em inglês são aceitas quando genuinamente mais usadas na plataforma para aquele nicho
- Sem espaços, sem acentos, sem caracteres especiais (transformar "ação" em "acao", "história" em "historia")
- Sem # repetido — escreva só uma vez: "fyp" (o app adiciona o # depois)
- Minúsculas
- Evite hashtags de mais de 1 bilhão de views como ÚNICA estratégia — misture amplas com nicho
- Devem ser BUSCÁVEIS: alguém digita aquilo na barra de busca da plataforma
- ATUAIS (ver CONTEXTO TEMPORAL no topo): priorize hashtags relevantes e em alta no ano corrente; evite tags datadas, saturadas ou que já perderam alcance — uma hashtag que bombou anos atrás pode não fazer mais sentido hoje`;
