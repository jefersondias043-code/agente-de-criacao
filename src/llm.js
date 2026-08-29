'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

const MAX_CONTENT_CHARS = 12000;


// `comentarios` é opcional e default 'nenhum': quem não pediu a camada
// opinativa recebe exatamente o prompt de antes, byte a byte.
function buildPrompt(style, tone, content, comentarios) {
  let truncated = content;
  let wasTruncated = false;
  if (content.length > MAX_CONTENT_CHARS) {
    truncated = content.slice(0, MAX_CONTENT_CHARS);
    wasTruncated = true;
  }

  const blocoComentario = (typeof comentarioBloco === 'function') ? comentarioBloco(comentarios, tone) : '';

  // Prompt V4 — microintervenções interpretativas.
  // Ensina à IA os mecanismos linguísticos que aplicam tom sem inventar fato.
  const prompt = [
    'Você é um jornalista profissional experiente. Transforme o conteúdo abaixo em uma matéria envolvente que reflita FORTEMENTE o estilo e o tom escolhidos.',
    '',
    'PRINCÍPIO CENTRAL: estilo e tom NÃO se aplicam inventando fatos. Eles se aplicam por meio de MICROINTERVENÇÕES INTERPRETATIVAS — pequenas escolhas de linguagem que orientam a percepção do leitor sem alterar a realidade narrada.',
    '',
    'Os fatos (pessoas, locais, datas, números, ações, declarações) DEVEM vir LITERALMENTE do Conteúdo. Mas COMO esses fatos são apresentados é onde estilo e tom ganham força.',
    '',
    '═══ OS 5 MECANISMOS DE MICROINTERVENÇÃO (use-os) ═══',
    '',
    '1. VOCABULÁRIO COM PESO INTERPRETATIVO',
    'Verbos e adjetivos sinônimos carregam tons diferentes. Mesmo fato, percepções opostas:',
    '• "A obra ENCERROU" (neutro) / "A obra FINALMENTE CHEGOU AO FIM" (positivo) / "A obra FOI PARALISADA" (negativo)',
    '• "200 moradias" (neutro) / "APENAS 200 moradias" (insuficiente) / "200 NOVAS moradias" (positivo)',
    'Escolha verbos, adjetivos e advérbios que carregam o peso interpretativo do tom.',
    '',
    '2. PALAVRAS-PIVÔ QUE ENQUADRAM',
    'Palavras pequenas mudam a percepção:',
    '• "apenas", "só", "ainda", "mais um", "novamente", "se limita a" → enquadram como insuficiente/recorrente (negativo)',
    '• "agora", "finalmente", "passo concreto", "marca", "sinaliza" → enquadram como avanço (positivo)',
    '• "no entanto", "porém", "contudo", "entretanto" → introduzem reservas',
    '• "também", "além disso", "soma-se" → reforço aditivo',
    'Use 2 a 4 palavras-pivô espalhadas pela matéria, alinhadas ao tom.',
    '',
    '3. ORDEM DE APRESENTAÇÃO',
    'A primeira frase do lead define a leitura. Coloque na frente o aspecto que reflete o tom:',
    '• Tom positivo → começar pela ação/benefício/avanço',
    '• Tom pessimista → começar pela limitação/atraso/restrição',
    '• Tom dramático → começar pelo número humano ou pelo impacto',
    '• Tom neutro → começar pela informação principal sem qualificação',
    '',
    '4. RITMO DAS FRASES',
    '• Frases curtas e isoladas → ênfase, drama, urgência ("Duzentas famílias. É o número que...")',
    '• Frases longas com subordinadas → análise, ponderação, formalidade',
    '• Frases médias e diretas → objetividade, neutralidade',
    'Combine ritmos conforme o tom pede.',
    '',
    '5. OBSERVAÇÕES JORNALÍSTICAS LEGÍTIMAS',
    'Pequenos comentários sobre a NATUREZA do fato em si — sem adicionar fato novo:',
    '• "trata-se da maior intervenção do tipo" → SÓ se o Conteúdo trouxer comparação. Senão, NÃO escreva.',
    '• "o anúncio chama atenção pelo valor" → legítimo se o valor está no texto e a observação é sobre o valor mencionado.',
    '• "a expectativa é alta" → INVENÇÃO se o texto não menciona expectativa.',
    'Regra prática: a observação só vale se ela COMENTA algo que está literalmente no Conteúdo. Não traz informação nova.',
    '',
    '═══ EXEMPLO PRÁTICO — MESMO FATO, 3 TONS ═══',
    '',
    'Conteúdo: "A Prefeitura entregou 50 cestas básicas a moradores do Calabar nesta semana."',
    '',
    'Tom OTIMISTA:',
    '"Cinquenta famílias do Calabar receberam apoio da Prefeitura nesta semana. A entrega de cestas básicas chegou ao bairro como uma resposta concreta às necessidades dos moradores."',
    '(Microintervenções: "receberam apoio", "chegou ao bairro", "resposta concreta às necessidades" — comenta o fato sem inventar.)',
    '',
    'Tom PESSIMISTA:',
    '"A Prefeitura distribuiu apenas 50 cestas básicas no Calabar nesta semana. A ação se limitou ao envio das cestas aos moradores."',
    '(Microintervenções: "apenas", "se limitou", postura passiva.)',
    '',
    'Tom NEUTRO:',
    '"A Prefeitura entregou 50 cestas básicas a moradores do Calabar nesta semana."',
    '(Sem microintervenções — verbo descritivo, sem qualificadores.)',
    '',
    'Note: NENHUMA versão inventa nomes, valores extras, contexto histórico, programas governamentais, depoimentos, problemas socioeconômicos do bairro. Tudo vem dos fatos do Conteúdo.',
    '',
    '═══ INVENTAR FATO × DESENVOLVER ARGUMENTO ═══',
    '',
    'PROIBIDO — é invenção de fato:',
    '• pessoas, cargos, valores, datas, locais que não estão no Conteúdo',
    '• declarações, citações, opiniões atribuídas que não estão no Conteúdo',
    '• acontecimento, medida, causa ou consequência apresentada como OCORRIDA sem estar no Conteúdo',
    '• contexto histórico, comparação com outros casos, dado trazido de fora',
    '• reações e sensações de terceiros que o Conteúdo não menciona',
    '',
    'PERMITIDO E ESPERADO — é trabalho editorial:',
    '• INTERPRETAR o que os fatos significam e dizer isso com todas as letras',
    '• ARGUMENTAR a partir deles: sustentar uma leitura, mostrar tensão, contrapor um dado a outro',
    '• ENQUADRAR: decidir o que abre, o que ganha parágrafo próprio, o que fica subordinado',
    '• QUALIFICAR com juízo assumido como leitura ("o valor chama atenção", "o prazo é apertado"), desde que o fato que sustenta esteja no Conteúdo',
    '• usar recursos retóricos: pergunta, contraste, repetição deliberada, frase curta de impacto',
    '',
    'Teste prático: se um leitor perguntasse "de onde você tirou isso?", você apontaria o trecho exato do Conteúdo? Se sim, mesmo sendo INTERPRETAÇÃO dele, pode escrever. Se a resposta for "deduzi" ou "costuma ser assim", corte.',
    '',
    '═══ OFÍCIO EDITORIAL (é aqui que a matéria fica boa) ═══',
    '',
    'Fidelidade sem qualidade de escrita não basta: o texto precisa ler bem.',
    'COESÃO: cada parágrafo puxa o anterior. Retome por elipse, pronome ou sinônimo em vez de repetir o mesmo sujeito ("A Prefeitura… O órgão… A gestão municipal…").',
    'TRANSIÇÕES: conecte pelo sentido, não por muleta. Prefira a relação lógica explícita ("com a entrega", "desde então", "o mesmo levantamento") a conectivos genéricos ("além disso", "vale ressaltar", "é importante destacar").',
    'ABERTURAS: nenhum parágrafo pode começar com a mesma palavra ou a mesma estrutura do anterior.',
    'ECONOMIA: corte perífrase e redundância ("realizou a entrega de" → "entregou"; "por meio da utilização de" → "com"). Nada de frase que não afirma nada ("A notícia repercutiu", "Confira os detalhes").',
    'HIERARQUIA: título, subtítulo e lead informam coisas DIFERENTES. Se o subtítulo é o título reescrito, troque o ângulo.',
    'SÍNTESE: não transcreva o Conteúdo frase a frase na ordem em que aparece. Agrupe o que pertence à mesma ideia e subordine o secundário ao principal.',
    '',
    '═══ QUEM MANDA NO TOM É A ESCOLHA DO USUÁRIO, NÃO O CONTEÚDO ═══',
    'O Conteúdo abaixo tem um tom próprio — e ele pode ser o OPOSTO do que foi pedido. Nesse caso o tom do Conteúdo NÃO tem autoridade nenhuma.',
    'O erro a evitar: aproveitar um trecho junto com a avaliação que vinha nele, produzindo uma matéria que elogia e critica o mesmo acontecimento.',
    'Adjetivo, advérbio e construção de juízo do Conteúdo NÃO são fatos: são a opinião de quem escreveu. Troque, remova ou inverta para servir ao tom pedido. O ACONTECIMENTO é que não muda.',
    '• "a obra foi um sucesso e atendeu 500 famílias" + tom pessimista → o fato é "atendeu 500 famílias"; "sucesso" é juízo alheio e sai.',
    '• "o caos no trânsito piorou com a obra" + tom otimista → o fato é "a obra alterou o trânsito"; "caos" é juízo alheio e sai.',
    'ÚNICA EXCEÇÃO: fala entre aspas é reproduzida LITERALMENTE, mesmo contrariando seu tom — o fato ali é "fulano disse isso". Seu é o enquadramento em volta dela.',
    'UNIDADE: a matéria inteira precisa soar como UMA voz. Nenhum parágrafo pode puxar para o lado contrário.',
    '',
    'O TOM ENQUADRA O FATO — NÃO FABRICA FATO NOVO. Ao aplicar um tom forte existe a tentação de inventar a premissa que o justifica; isso é alucinação, não estilo.',
    'PODE: escolher a palavra-pivô ("apenas 2 mil atletas" / "já são 2 mil atletas") — o número é o mesmo, a leitura é sua.',
    'NÃO PODE: criar comparação que o Conteúdo não faz ("baixo em relação a outras corridas"); apresentar sua avaliação como consenso alheio ("foi considerado baixo") sem dizer por quem; deduzir causa ou consequência que o Conteúdo não afirma.',
    'Para sustentar a crítica ou o elogio, use o que EXISTE — inclusive a ausência: "o material não informa quantas pessoas eram esperadas" é uma frase forte e honesta.',
    '',
    'CADA PARÁGRAFO AVANÇA: um argumento, uma vez. Repetir a mesma crítica (ou o mesmo elogio) em todos os parágrafos não intensifica — cansa. Se o Conteúdo só sustenta um argumento, entregue MENOS parágrafos.',
    '',
    (typeof EDITORIAL_ATTRIBUTION !== 'undefined' ? EDITORIAL_ATTRIBUTION : ''),
    '',
    (typeof EDITORIAL_SAFETY !== 'undefined' ? EDITORIAL_SAFETY : ''),
    '',
    `Estilo: ${style}`,
    'ARQUITETURA DESTE ESTILO:',
    (typeof stylePrompt === 'function' ? stylePrompt(style) : ''),
    '',
    `INSTRUÇÕES ESPECÍFICAS PARA O TOM "${tone}":`,
    TONE_PROMPTS[tone] || TONE_PROMPTS['Neutro'],
    '',
    `INTENSIDADE: o tom "${tone}" precisa ser INEQUÍVOCO. Ele deve aparecer no título, no subtítulo, no lead, em CADA parágrafo e no fecho — não só numa palavra-pivô solta. Se você trocasse o tom por outro e precisasse reescrever poucas frases, o tom NÃO está aplicado.`,
    '',
    ...(blocoComentario ? [blocoComentario, ''] : []),
    'Conteúdo:',
    truncated,
    '',
    'FORMATO DA MATÉRIA:',
    '',
    '*Título: chamativo e informativo, JÁ refletindo o tom',
    '*Subtítulo: ângulo COMPLEMENTAR ao título, com palavras-pivô do tom',
    '*Lead: primeiro parágrafo com as informações essenciais, ordem alinhada ao estilo e ao tom',
    blocoComentario
      ? `*Corpo: parágrafos de desenvolvimento com microintervenções consistentes — e CADA parágrafo termina com uma frase de comentário ${comentarioDirecaoCurta(comentarios)}`
      : '*Corpo: parágrafos de desenvolvimento com microintervenções consistentes',
    '',
    'Extensão: 2 a 4 parágrafos de corpo, conforme o material comportar. Pauta curta rende 2; pauta rica rende 4. Não encha linguiça para alongar, nem espreme fatos para encurtar.',
    '',
    'VERIFICAÇÃO FINAL antes de responder:',
    '1. Cada nome, número, data, local e citação está LITERALMENTE no Conteúdo?',
    '2. Trocando o tom por outro, quantas frases eu reescreveria? Se forem poucas, o tom está fraco — reforce.',
    '3. Se eu apagasse o Conteúdo, alguém conseguiria apontar a parte exata que sustenta cada elemento das minhas frases?',
    '4. As microintervenções comentam ou enquadram fatos existentes — ou trazem fatos novos?',
    '5. Algum parágrafo é o Conteúdo transcrito em ordem, um fato por frase? Se sim, reescreva agrupando.',
    '6. Duas frases seguidas começam igual ou têm o mesmo comprimento? Se sim, varie.',
    '7. Eu me limitei a repetir o Conteúdo, ou também o interpretei e argumentei a partir dele? Matéria sem leitura é boletim.',
    '8. Há acusação, crime ou apuração? Usei o termo da fase processual correta, atribuí a informação e registrei o outro lado (ou a ausência dele)?',
    '8b. ATRIBUIÇÃO: percorra as afirmações uma a uma. Alguma promessa, previsão, número, causa ou avaliação está escrita como se fosse do veículo, quando na verdade é de alguém? Devolva a fonte ("segundo…", "de acordo com…"). O leitor tem de saber de quem é cada afirmação.',
    '8c. JUÍZO SEM DONO: leia cada parágrafo isolado. Ele avalia alguma coisa ("é um exemplo de…", "é um passo importante", "é um sinal de…", "demonstra o compromisso…", "gestão eficaz")? O dono do juízo precisa estar NAQUELE parágrafo — fonte citada no primeiro não cobre o terceiro. Sem dono, corte a frase: matéria mais curta é melhor do que o veículo assinando a opinião de outro.',
    '9. Sobrou alguma palavra de juízo herdada do Conteúdo puxando para o lado CONTRÁRIO ao tom pedido? Fora dela — sem tirar o acontecimento.',
    '10. Inventei comparação, avaliação sem dono ou consequência para sustentar o tom? Troque pelo que o Conteúdo traz.',
    '11. Dois parágrafos dizem a mesma coisa com outras palavras? Funda-os e traga um aspecto novo.',
    '',
    ...(blocoComentario ? [
      `12. DIREÇÃO: releia UM A UM os comentários. Todos estão na direção pedida (${comentarioDirecaoCurta(comentarios)})? Qualquer um fora dela é erro de execução — reescreva antes de responder.`,
      '13. Cada comentário se apoia em algo que está no Conteúdo, ou algum deles trouxe informação que ninguém escreveu?',
      '14. Algum comentário está escrito como fato provado em vez de leitura assumida? Marque-o como leitura.',
      '15. Algum comentário desqualifica uma PESSOA em vez de comentar o ato, o dado ou a ausência? Reescreva mirando o ato.',
      '16. Todos os parágrafos terminam com a mesma fórmula de comentário? Varie a construção.',
    ] : []),
    'Se 2 estiver "sim", o tom está aplicado. Se 1, 3 ou 4 estiverem problemáticos, REESCREVA.',
    '',
    'Responda APENAS com a matéria final, sem cabeçalhos como "Título:" e sem comentários introdutórios.',
  ].join('\n');

  return { prompt, wasTruncated, originalCharCount: content.length, finalCharCount: truncated.length };
}

function cleanText(input) {
  if (!input) return '';
  return input
    .replace(/\*+/g, '')
    .replace(/^#+\s*/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/\t/g, ' ')
    .replace(/[ ]{2,}/g, ' ')
    .split('\n').map(l => l.replace(/\s+$/g, '')).join('\n')
    .trim();
}

/* ============================================================
   ENDEREÇO DA API — o que o usuário digita vira uma base utilizável

   O campo é livre, e a documentação de cada provedor mostra o endereço de um
   jeito diferente: uns com /v1, outros sem; uns com a rota completa até
   /chat/completions; quase todos com barra sobrando no fim. Recusar tudo que
   não venha no formato exato transformaria um campo de conveniência num campo
   de armadilha — então a normalização é tolerante de propósito.

   O que ela faz, em ordem: apara espaços e barras finais; assume https:// se
   o usuário só colou o domínio; corta a rota final quando ele colou o endereço
   COMPLETO (é o erro mais comum, porque é o que aparece no exemplo de curl); e
   acrescenta /v1 apenas quando o endereço não tem caminho nenhum — nunca sobre
   um caminho que o usuário escreveu, porque aí ele sabia o que estava fazendo
   (OpenRouter é /api/v1, a Groq é /openai/v1).

   Endereço que não vira URL válida não derruba a geração: volta ao padrão de
   fábrica. O campo é um atalho, não um jeito de quebrar o app.
   ============================================================ */
const LLM_ROTAS_FINAIS = ['/chat/completions', '/messages', '/responses'];

function normalizarBaseUrl(bruto, padrao) {
  let v = String(bruto || '').trim();
  if (!v) return padrao;
  // Só completa o esquema quando NÃO há esquema nenhum ("meu-gateway.com"). Se
  // o usuário escreveu um, ele vale como escrito: colar https:// na frente de
  // "ftp://x.com" produziria a URL torta "https://ftp//x.com" em vez de recusar.
  const temEsquema = /^[a-z][a-z0-9+.-]*:/i.test(v);
  if (!temEsquema) v = `https://${v}`;
  let u;
  try { u = new URL(v); } catch (_) { return padrao; }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return padrao;
  let caminho = u.pathname.replace(/\/+$/, '');
  for (const rota of LLM_ROTAS_FINAIS) {
    if (caminho.toLowerCase().endsWith(rota)) { caminho = caminho.slice(0, -rota.length); break; }
  }
  caminho = caminho.replace(/\/+$/, '');
  if (!caminho) caminho = '/v1';
  return `${u.origin}${caminho}`;
}

/** Endereço em uso por um provedor: o personalizado, se houver; senão o padrão. */
function baseUrlDe(provider) {
  const padrao = (typeof PROVIDER_ENDPOINTS !== 'undefined' && PROVIDER_ENDPOINTS[provider]) || '';
  const salvo = (typeof State !== 'undefined' && State.endpoints) ? State.endpoints[provider] : '';
  return normalizarBaseUrl(salvo, padrao);
}

/* ============================================================
   FALHA DE REDE — quando o pedido nem chega a sair

   Erro de API vem com status e corpo, e a tela já sabia traduzir. Falha de
   REDE é outra coisa: o fetch é REJEITADO, sem status e sem corpo, e o
   navegador entrega só um TypeError seco — "Load failed" no Safari, "Failed to
   fetch" no Chrome. Era esse texto cru, em inglês, que chegava ao usuário.

   Os três provedores ACEITAM chamada direto do navegador — é o padrão "cada
   usuário com a própria chave", que é como esta plataforma funciona. A Groq
   libera qualquer origem; a Anthropic libera sob pedido, com o cabeçalho
   'anthropic-dangerous-direct-browser-access'; a OpenAI libera a API (é assim
   que apps estáticos de BYOK falam com ela).

   Sobrando o quê, então, para um fetch rejeitado? Conexão caída, e sobretudo
   BLOQUEADOR — extensão de anúncios/rastreamento, filtro de DNS ou rede que
   derruba o domínio antes de o pedido sair. Como não dá para saber qual foi,
   a mensagem cita os dois E aponta a saída que independe da causa: trocar o
   endereço da API nas Configurações, que é justamente para isso que ele existe.
   ============================================================ */
/* Chave colada de um PDF, de um e-mail ou de uma página costuma vir com espaço,
   quebra de linha ou espaço-duro no meio. Nenhum deles é válido num cabeçalho
   HTTP: o fetch morre ANTES de sair, com exatamente o mesmo sintoma de uma
   falha de rede — e aí o usuário vai procurar defeito na internet. Chave de API
   não tem espaço em lugar nenhum, então limpar é seguro. */
function chaveLimpa(apiKey) {
  return String(apiKey || '').replace(/[\s\u00a0\u200b-\u200d\ufeff]+/g, '');
}

const LLM_PROVEDOR_NOME = { groq: 'Groq', openai: 'OpenAI', anthropic: 'Anthropic' };

/** fetch com a falha de rede já traduzida. Só o fetch entra no try: um erro
 *  vindo da leitura da resposta é outra história e não pode virar "sem rede". */
async function fetchLLM(provider, url, init) {
  try {
    return await fetch(url, init);
  } catch (e) {
    const nome = LLM_PROVEDOR_NOME[provider] || 'IA';
    let host = '';
    try { host = new URL(url).host; } catch (_) { /* */ }
    throw new Error(
      `Não foi possível falar com a ${nome}: o pedido não chegou a sair do navegador. `
      + `Verifique sua conexão e libere o domínio ${host} se você usa bloqueador de `
      + 'anúncios, de rastreamento ou filtro de DNS.'
      + (provider === 'openai'
        ? ' Se não for bloqueio seu, é a própria OpenAI que não autoriza chamada de '
          + 'navegador. O caminho é publicar a ponte que acompanha o projeto '
          + '(pasta ponte/) e pôr o endereço dela em Configurações → Endereço da API.'
        : ' Se o bloqueio não for seu, dá para apontar outro caminho: '
          + 'Configurações → Endereço da API.'));
  }
}

async function callGroq({ apiKey, model, prompt }) {
  const res = await fetchLLM('groq', `${baseUrlDe('groq')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${chaveLimpa(apiKey)}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
    }),
  });
  if (res.status === 401) throw new Error('A chave de API é inválida ou expirou.');
  if (res.status === 429) throw new Error('Limite de requisições da Groq excedido. Tente novamente em alguns instantes.');
  if (!res.ok) {
    let msg = `Erro na Groq (${res.status})`;
    try {
      const j = await res.json();
      const code = j?.error?.code || '';
      const bruto = j?.error?.message || '';
      // A Groq aposenta modelos periodicamente (a família Llama saiu em 2026).
      // O texto cru vem em inglês e manda ler a documentação — quem está no meio
      // de uma matéria precisa saber o que FAZER. O catálogo da plataforma já
      // traz os sucessores, então o conserto é trocar o modelo ou só recarregar.
      if (code === 'model_decommissioned' || code === 'model_not_found'
          || /decommissioned|has been deprecated|does not exist/i.test(bruto)) {
        msg = `O modelo "${model}" foi retirado do ar pela Groq e não atende mais. `
            + 'Recarregue a página — a plataforma reajusta sozinha para um modelo atual. '
            + 'Se preferir escolher, abra as Configurações e selecione outro modelo da lista.';
      } else if (bruto) {
        msg = bruto;
      }
    } catch { /* corpo não-JSON: fica a mensagem genérica com o status */ }
    throw new Error(msg);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Resposta vazia da Groq.');
  return {
    content,
    model: json.model || model,
    promptTokens: json.usage?.prompt_tokens,
    completionTokens: json.usage?.completion_tokens,
  };
}

/* Modelos de RACIOCÍNIO não aceitam 'temperature' — pegam a família GPT-5
   (gpt-5, gpt-5.4, gpt-5.6-terra…) e a linha "o" (o1, o3, o4-mini). Mandar o
   parâmetro devolve 400, então a checagem é pelo NOME do modelo e não pelo
   provedor: no endereço configurável, o mesmo caminho atende servidores
   compatíveis onde roda gente que aceita. Na dúvida, manda — é o
   comportamento de sempre, e o catálogo desses modelos é conhecido. */
function modeloAceitaTemperatura(model) {
  const m = String(model || '').toLowerCase();
  const nu = m.indexOf('/') === -1 ? m : m.slice(m.indexOf('/') + 1);
  return !(/^gpt-5/.test(nu) || /^o[1-9](-|$|\.)/.test(nu));
}

async function callOpenAI({ apiKey, model, prompt }) {
  const res = await fetchLLM('openai', `${baseUrlDe('openai')}/chat/completions`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${chaveLimpa(apiKey)}`,
      'Content-Type': 'application/json',
    },
    // 'temperature' entra ou não conforme o MODELO, não conforme o provedor: a
    // família GPT-5 e a linha "o" raciocinam antes de responder, deixaram de
    // aceitar o parâmetro e devolvem 400 em cima dele — era a geração inteira
    // caindo. Mas com endereço configurável este mesmo caminho serve a qualquer
    // servidor compatível, onde pode estar rodando um modelo que aceita.
    body: JSON.stringify(Object.assign({
      model,
      messages: [
        { role: 'user', content: prompt },
      ],
    }, modeloAceitaTemperatura(model) ? { temperature: 0.6 } : {})),
  });
  if (res.status === 401) throw new Error('A chave de API da OpenAI é inválida ou expirou.');
  if (res.status === 429) throw new Error('Limite de requisições da OpenAI excedido. Tente novamente em alguns instantes.');
  if (!res.ok) {
    let msg = `Erro na OpenAI (${res.status})`;
    try { const j = await res.json(); if (j?.error?.message) msg = j.error.message; } catch {}
    throw new Error(msg);
  }
  const json = await res.json();
  const content = json.choices?.[0]?.message?.content?.trim();
  if (!content) throw new Error('Resposta vazia da OpenAI.');
  return {
    content,
    model: json.model || model,
    promptTokens: json.usage?.prompt_tokens,
    completionTokens: json.usage?.completion_tokens,
  };
}

async function callAnthropic({ apiKey, model, prompt }) {
  const res = await fetchLLM('anthropic', `${baseUrlDe('anthropic')}/messages`, {
    method: 'POST',
    headers: {
      'x-api-key': chaveLimpa(apiKey),
      'anthropic-version': '2023-06-01',
      // Sem este cabeçalho a Anthropic recusa a chamada vinda do navegador e o
      // fetch nem recebe resposta ("Load failed"). É o opt-in oficial dela para
      // o padrão que este app usa: a chave é do usuário, fica no aparelho dele
      // e nunca passa por um servidor nosso.
      'anthropic-dangerous-direct-browser-access': 'true',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      messages: [
        { role: 'user', content: prompt },
      ],
      temperature: 0.6,
    }),
  });
  if (res.status === 401) throw new Error('A chave de API da Anthropic é inválida ou expirou.');
  if (res.status === 429) throw new Error('Limite de requisições da Anthropic excedido. Tente novamente em alguns instantes.');
  if (!res.ok) {
    let msg = `Erro na Anthropic (${res.status})`;
    try { const j = await res.json(); if (j?.error?.message) msg = j.error.message; } catch {}
    throw new Error(msg);
  }
  const json = await res.json();
  const content = json.content?.[0]?.text?.trim();
  if (!content) throw new Error('Resposta vazia da Anthropic.');
  return {
    content,
    model: json.model || model,
    promptTokens: json.usage?.input_tokens,
    completionTokens: json.usage?.output_tokens,
  };
}

async function callLLM(prompt) {
  // Workspace bloqueado e ainda não aberto nesta sessão → pede a senha primeiro.
  if (State.locked && !State.unlocked && typeof ensureUnlocked === 'function') {
    await ensureUnlocked();
  }
  const provider = State.provider || 'groq';
  const apiKey = State.apiKeys[provider];
  const model = State.models[provider];
  if (!apiKey) throw new Error(`Configure a chave de API do provedor "${provider}" nas Configurações.`);
  if (!model) throw new Error(`Nenhum modelo selecionado para "${provider}".`);
  switch (provider) {
    case 'openai': return callOpenAI({ apiKey, model, prompt });
    case 'anthropic': return callAnthropic({ apiKey, model, prompt });
    default: return callGroq({ apiKey, model, prompt });
  }
}

