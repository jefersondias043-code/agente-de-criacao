'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

const MAX_CONTENT_CHARS = 12000;


function buildPrompt(style, tone, content) {
  let truncated = content;
  let wasTruncated = false;
  if (content.length > MAX_CONTENT_CHARS) {
    truncated = content.slice(0, MAX_CONTENT_CHARS);
    wasTruncated = true;
  }

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
    'Conteúdo:',
    truncated,
    '',
    'FORMATO DA MATÉRIA:',
    '',
    '*Título: chamativo e informativo, JÁ refletindo o tom',
    '*Subtítulo: ângulo COMPLEMENTAR ao título, com palavras-pivô do tom',
    '*Lead: primeiro parágrafo com as informações essenciais, ordem alinhada ao estilo e ao tom',
    '*Corpo: parágrafos de desenvolvimento com microintervenções consistentes',
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
    '',
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

async function callGroq({ apiKey, model, prompt }) {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
      if (j?.error?.message) msg = j.error.message;
    } catch {}
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

async function callOpenAI({ apiKey, model, prompt }) {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
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
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
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

