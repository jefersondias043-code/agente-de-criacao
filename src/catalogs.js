'use strict';
// Gerado pela refatoração (split do index.html monolítico). Código movido verbatim.

// ---------- Catálogos (port direto do app Flutter) ----------
const STYLES = [
  { group: 'Jornalismo / Informação', items: [
    { id: 'Jornalístico', label: 'Jornalístico', desc: 'Objetivo, informativo e baseado em fatos.' },
    { id: 'Expositivo', label: 'Expositivo', desc: 'Explica conceitos e fatos de forma clara.' },
    { id: 'Analítico', label: 'Analítico', desc: 'Examina informações com profundidade crítica.' },
    { id: 'Técnico', label: 'Técnico', desc: 'Especializado e preciso, com termos específicos.' },
    { id: 'Reportagem', label: 'Reportagem', desc: 'Narrativa detalhada de eventos atuais.' },
    { id: 'Editorial', label: 'Editorial', desc: 'Opinião formal do veículo sobre o tema.' },
    { id: 'Documental', label: 'Documental', desc: 'Baseado em fatos e investigação.' },
    { id: 'Noticioso', label: 'Noticioso', desc: 'Focado em notícias e atualidades.' },
    { id: 'Crônica', label: 'Crônica', desc: 'Narrativa breve com reflexão pessoal.' },
  ]},
  { group: 'Acadêmico / Científico', items: [
    { id: 'Acadêmico', label: 'Acadêmico', desc: 'Rigoroso e fundamentado com referências.' },
    { id: 'Científico', label: 'Científico', desc: 'Metódico e verificável, baseado em evidências.' },
    { id: 'Didático', label: 'Didático', desc: 'Ensina de forma clara e organizada.' },
    { id: 'Tutorial', label: 'Tutorial', desc: 'Passo a passo instrutivo.' },
  ]},
  { group: 'Marketing / Propaganda', items: [
    { id: 'Publicitário', label: 'Publicitário', desc: 'Persuasivo e atrativo para chamar atenção.' },
    { id: 'Persuasivo', label: 'Persuasivo', desc: 'Convincente para mudar opinião ou ação.' },
    { id: 'Blog/Redes Sociais', label: 'Blog / Redes Sociais', desc: 'Moderno e dinâmico para o digital.' },
    { id: 'Copywriting', label: 'Copywriting', desc: 'Textos persuasivos para marketing.' },
    { id: 'Storytelling', label: 'Storytelling', desc: 'Transmite mensagens via histórias.' },
  ]},
  { group: 'Criativo / Artístico', items: [
    { id: 'Narrativo', label: 'Narrativo', desc: 'Conta histórias com personagens e cenários.' },
    { id: 'Poético', label: 'Poético', desc: 'Usa linguagem figurativa e musical.' },
    { id: 'Literário', label: 'Literário', desc: 'Artístico e expressivo.' },
    { id: 'Descritivo', label: 'Descritivo', desc: 'Detalha com riqueza de detalhes.' },
    { id: 'Dramático', label: 'Dramático', desc: 'Intenso e emocional.' },
    { id: 'Satírico', label: 'Satírico', desc: 'Critica através do humor e ironia.' },
  ]},
  { group: 'Corporativo / Profissional', items: [
    { id: 'Corporativo', label: 'Corporativo', desc: 'Formal e institucional.' },
    { id: 'Empresarial', label: 'Empresarial', desc: 'Voltado para empresas.' },
    { id: 'Institucional', label: 'Institucional', desc: 'Representa a organização.' },
    { id: 'Formal', label: 'Formal', desc: 'Linguagem correta e respeitosa.' },
  ]},
];

const TONES = [
  { group: 'Objetivos / Neutros', items: [
    { id: 'Formal', label: 'Formal', desc: 'Linguagem técnica, impessoal e respeitosa.' },
    { id: 'Informal', label: 'Informal', desc: 'Linguagem casual, amigável e descontraída.' },
    { id: 'Neutro', label: 'Neutro', desc: 'Objetivo, sem emoções ou opiniões.' },
    { id: 'Informativo', label: 'Informativo', desc: 'Focado em informar e esclarecer.' },
    { id: 'Sério', label: 'Sério', desc: 'Com seriedade e formalidade.' },
    { id: 'Objetivo', label: 'Objetivo', desc: 'Direto, sem rodeios.' },
    { id: 'Analítico', label: 'Analítico', desc: 'Racional, lógico, baseado em dados.' },
    { id: 'Imparcial', label: 'Imparcial', desc: 'Sem viés, justo, equilibrado.' },
  ]},
  { group: 'Positivos', items: [
    { id: 'Otimista', label: 'Otimista', desc: 'Positivo, esperançoso e motivador.' },
    { id: 'Inspirador', label: 'Inspirador', desc: 'Motiva e eleva o ânimo do leitor.' },
    { id: 'Entusiasmado', label: 'Entusiasmado', desc: 'Energético, animado e vibrante.' },
    { id: 'Empático', label: 'Empático', desc: 'Compreensivo, solidário e acolhedor.' },
    { id: 'Respeitoso', label: 'Respeitoso', desc: 'Cortês, formal e admirável.' },
    { id: 'Humorístico', label: 'Humorístico', desc: 'Leve, engraçado e divertido.' },
  ]},
  { group: 'Negativos', items: [
    { id: 'Pessimista', label: 'Pessimista', desc: 'Crítico, destaca dificuldades e riscos.' },
    { id: 'Alarmista', label: 'Alarmista', desc: 'Preocupante, alerta para perigos.' },
  ]},
  { group: 'Emocionais / Intensos', items: [
    { id: 'Emotivo', label: 'Emotivo', desc: 'Apela aos sentimentos do leitor.' },
    { id: 'Persuasivo', label: 'Persuasivo', desc: 'Convincente, busca mudar opinião ou ação.' },
    { id: 'Urgente', label: 'Urgente', desc: 'Pressionante, exige ação imediata.' },
    { id: 'Nostálgico', label: 'Nostálgico', desc: 'Relembra o passado com saudade.' },
    { id: 'Dramático', label: 'Dramático', desc: 'Intenso, teatral, emocional.' },
    { id: 'Provocativo', label: 'Provocativo', desc: 'Desafia, polemiza e gera debate.' },
  ]},
];

/**
 * Mapas de instruções específicas para cada tom.
 * Cada entrada substitui o genérico "Tom: ${tone}" por um bloco rico
 * com voz, palavras-pivô, estrutura de lead, vocabulário, armadilhas e exemplo.
 */
const TONE_PROMPTS = {
  Formal: [
    'VOZ: Tom técnico, impessoal, respeitoso. Distanciamento profissional.',
    '',
    'PALAVRAS-PIVÔ: "conforme", "mediante", "cumpre informar", "faz-se necessário", "cabe ressaltar", "senhor(a)".',
    '',
    'LEAD: Informação principal em ordem direta (sujeito-verbo-objeto), sem qualificadores emocionais.',
    '',
    'VOCABULÁRIO: Evite contrações ("não" em vez de "num"), gírias, coloquialismos. Prefira "entregou" a "deu", "comunicou" a "falou".',
    '',
    'ARMADILHAS: Não confundir formal com empolado. Formal é preciso e claro, não burocrático.',
    '',
    'EXEMPLO: "A Prefeitura Municipal de Salvador entregou 50 cestas básicas a moradores do bairro do Calabar nesta semana."',
  ].join('\n'),

  Informal: [
    'VOZ: Tom casual, próximo, como uma conversa entre conhecidos.',
    '',
    'PALAVRAS-PIVÔ: "pois é", "sabe como é", "olha só", "então", "daí", "dá licença".',
    '',
    'LEAD: Pode começar por uma pergunta retórica ou constatação coloquial.',
    '',
    'VOCABULÁRIO: Contrações ("pra", "num", "tá"), expressões cotidianas, gírias moderadas.',
    '',
    'ARMADILHAS: Não perder o respeito pelos envolvidos. Informal não é desrespeitoso.',
    '',
    'EXEMPLO: "Pois é, 50 famílias do Calabar receberam cestas básicas da Prefeitura essa semana."',
  ].join('\n'),

  Neutro: [
    'VOZ: Objetivo, sem emoções ou opiniões. Apenas os fatos.',
    '',
    'PALAVRAS-PIVÔ: Nenhuma. Evite qualificadores.',
    '',
    'LEAD: Fato principal em ordem direta, sem advérbios de intensidade ou julgamento.',
    '',
    'VOCABULÁRIO: Verbos descritivos ("entregou", "disse", "informou"), sem adjetivos valorativos.',
    '',
    'ARMADILHAS: Qualquer palavra que carregue julgamento ("apenas", "felizmente", "infelizmente") quebra a neutralidade.',
    '',
    'EXEMPLO: "A Prefeitura entregou 50 cestas básicas a moradores do Calabar nesta semana."',
  ].join('\n'),

  Informativo: [
    'VOZ: Esclarecedor, focado em transmitir informação com clareza.',
    '',
    'PALAVRAS-PIVÔ: "segundo", "de acordo com", "conforme apurado", "isto é", "ou seja".',
    '',
    'LEAD: Contexto breve + fato principal, com fontes citadas desde o início.',
    '',
    'VOCABULÁRIO: Termos precisos, explicações entre parênteses ou travessões para termos técnicos.',
    '',
    'ARMADILHAS: Não presumir conhecimento prévio do leitor. Explique siglas e termos.',
    '',
    'EXEMPLO: "Cinquenta famílias do Calabar receberam cestas básicas da Prefeitura, conforme informou a Secretaria de Desenvolvimento Social."',
  ].join('\n'),

  Sério: [
    'VOZ: Gravidade e formalidade. O tema é tratado com peso institucional.',
    '',
    'PALAVRAS-PIVÔ: "compromisso", "responsabilidade", "dever", "garantia", "medida necessária".',
    '',
    'LEAD: Contexto de relevância primeiro, depois o fato.',
    '',
    'VOCABULÁRIO: Solene, palavras de significado profundo. Evite leveza ou humor.',
    '',
    'ARMADILHAS: Não confundir sério com pessimista. Sério pode relatar avanços com gravidade.',
    '',
    'EXEMPLO: "Em uma ação de assistência social, a Prefeitura entregou 50 cestas básicas a famílias do Calabar."',
  ].join('\n'),

  Objetivo: [
    'VOZ: Direto, sem rodeios. Vai ao ponto imediatamente.',
    '',
    'PALAVRAS-PIVÔ: Evite todas. Apenas fatos, sem enquadramento.',
    '',
    'LEAD: O fato principal na primeira frase. Sem contextualização prévia.',
    '',
    'VOCABULÁRIO: Substantivos e verbos concretos. Evite adjetivos e advérbios.',
    '',
    'ARMADILHAS: Contexto é diferente de rodeio. Um mínimo de contexto ainda é necessário para compreensão.',
    '',
    'EXEMPLO: "50 cestas básicas foram entregues a moradores do Calabar pela Prefeitura."',
  ].join('\n'),

  Analítico: [
    'VOZ: Racional, lógico, baseado em dados e comparações.',
    '',
    'PALAVRAS-PIVÔ: "em comparação", "enquanto", "por outro lado", "os dados mostram", "proporcionalmente".',
    '',
    'LEAD: Contexto analítico — apresente o dado comparativo ou a tendência antes do fato.',
    '',
    'VOCABULÁRIO: Termos de análise ("percentual", "índice", "média", "recorte", "tendência").',
    '',
    'ARMADILHAS: Não inventar dados de comparação. Só analise o que o Conteúdo fornece.',
    '',
    'EXEMPLO: "As 50 cestas básicas entregues no Calabar representam um recorte da política de assistência social em bairros periféricos."',
  ].join('\n'),

  Imparcial: [
    'VOZ: Sem viés, justo, equilibrado. Apresenta todos os lados.',
    '',
    'PALAVRAS-PIVÔ: "por um lado", "por outro", "contudo", "no entanto", "cabe destacar que".',
    '',
    'LEAD: Fato principal neutro, seguido de diferentes perspectivas quando existirem.',
    '',
    'VOCABULÁRIO: Verbos de atribuição neutra ("segundo", "de acordo com", "informou"). Evite adjetivos.',
    '',
    'ARMADILHAS: Ser imparcial não significa ser omisso. É apresentar sem tomar partido.',
    '',
    'EXEMPLO: "A Prefeitura entregou 50 cestas básicas no Calabar. Moradores avaliam a ação de forma positiva, enquanto lideranças comunitárias pedem ampliação do programa."',
  ].join('\n'),

  Otimista: [
    'VOZ: Positivo, esperançoso, que enquadra fatos como avanços ou conquistas.',
    '',
    'PALAVRAS-PIVÔ: "agora", "finalmente", "passo concreto", "avança", "conquista", "supera", "amplia", "fortalece", "marca".',
    '',
    'LEAD: Abra com a ação, benefício ou avanço — o fato positivo vem primeiro.',
    '',
    'VOCABULÁRIO: Verbos de progresso ("entregou", "ampliou", "conquistou", "alcançou"). Evite "apenas", "se limitou".',
    '',
    'ARMADILHAS: Não superdimensionar. Se o dado é modesto, enquadre como "primeiro passo", não "grande feito".',
    '',
    'EXEMPLO: "Cinquenta famílias do Calabar receberam apoio da Prefeitura nesta semana. A entrega de cestas básicas chegou ao bairro como uma resposta concreta às necessidades."',
  ].join('\n'),

  Inspirador: [
    'VOZ: Motivador, que eleva o ânimo e mostra o lado humano e transformador dos fatos.',
    '',
    'PALAVRAS-PIVÔ: "transformação", "esperança", "futuro", "sonho", "caminho", "construção", "juntos".',
    '',
    'LEAD: Abra pelo impacto humano ou pela superação — a narrativa inspiradora guia o lead.',
    '',
    'VOCABULÁRIO: Palavras de coletividade, futuro e propósito ("comunidade unida", "exemplo de", "mostra que é possível").',
    '',
    'ARMADILHAS: Inspirar não é inventar. Use apenas os fatos reais para construir a narrativa.',
    '',
    'EXEMPLO: "A entrega de 50 cestas básicas no Calabar mostra que a união entre poder público e comunidade pode transformar realidades."',
  ].join('\n'),

  Entusiasmado: [
    'VOZ: Energético, animado, vibrante. Contagiante.',
    '',
    'PALAVRAS-PIVÔ: "incrível", "extraordinário", "imperdível", "sensacional", "sucesso", "explosão".',
    '',
    'LEAD: Abra com exclamação ou constatação entusiasmada.',
    '',
    'VOCABULÁRIO: Adjetivos fortes, exclamações moderadas, ritmo acelerado. Use frases curtas e impactantes.',
    '',
    'ARMADILHAS: Excesso de entusiasmo pode parecer artificial. Mantenha-se ancorado nos fatos.',
    '',
    'EXEMPLO: "Que notícia! A Prefeitura levou 50 cestas básicas ao Calabar — e a comunidade recebeu de braços abertos!"',
  ].join('\n'),

  Empático: [
    'VOZ: Compreensivo, solidário, acolhedor. Mostra que entende a realidade do outro.',
    '',
    'PALAVRAS-PIVÔ: "compreender", "acolher", "cuidado", "olhar sensível", "realidade", "necessidade", "escuta".',
    '',
    'LEAD: Abra pela perspectiva humana — coloque-se no lugar de quem vive o fato.',
    '',
    'VOCABULÁRIO: Linguagem de acolhimento ("famílias que precisam", "moradores que enfrentam", "realidade desafiadora").',
    '',
    'ARMADILHAS: Empatia não é piedade. Evite tom assistencialista ou superior.',
    '',
    'EXEMPLO: "Para as 50 famílias do Calabar que receberam as cestas, o gesto vai além da alimentação — é o reconhecimento de uma necessidade real."',
  ].join('\n'),

  Respeitoso: [
    'VOZ: Cortês, formal, admirável. Reconhece o valor das pessoas e instituições envolvidas.',
    '',
    'PALAVRAS-PIVÔ: "merece destaque", "cabe reconhecer", "importante iniciativa", "respeitosamente".',
    '',
    'LEAD: Contextualize com respeito às partes envolvidas, reconhecendo o mérito.',
    '',
    'VOCABULÁRIO: Palavras de reconhecimento e deferência. Evite informalidade ou crítica gratuita.',
    '',
    'ARMADILHAS: Respeito não é bajulação. Seja cortês sem exagerar.',
    '',
    'EXEMPLO: "Em uma iniciativa que merece destaque, a Prefeitura entregou 50 cestas básicas a famílias do Calabar, demonstrando compromisso com a população."',
  ].join('\n'),

  Humorístico: [
    'VOZ: Leve, engraçado, divertido. Usa ironia suave ou jogos de palavras.',
    '',
    'PALAVRAS-PIVÔ: "como diria", "não é que", "pois então", "é mole?", "olha o detalhe".',
    '',
    'LEAD: Abra com uma observação inusitada ou leve que contextualize o fato com humor.',
    '',
    'VOCABULÁRIO: Expressões populares, trocadilhos moderados, tom de crônica.',
    '',
    'ARMADILHAS: Jamais faça humor com sofrimento, desgraça ou temas sérios. Saiba quando o tema não comporta humor.',
    '',
    'EXEMPLO: "Cinco dezenas de cestas básicas. Ou, para quem prefere números redondos: 50 famílias do Calabar que não vão precisar se preocupar com a janta essa semana."',
  ].join('\n'),

  Pessimista: [
    'VOZ: Crítico, que enquadra fatos como insuficientes, preocupantes ou recorrentes.',
    '',
    'PALAVRAS-PIVÔ: "apenas", "só", "ainda", "mais um", "novamente", "se limita a", "sequer", "nem mesmo".',
    '',
    'LEAD: Abra pela limitação, atraso ou restrição — a falha ou insuficiência vem primeiro.',
    '',
    'VOCABULÁRIO: Verbos de estagnação ("se limitou", "manteve", "ficou", "registrou apenas").',
    '',
    'ARMADILHAS: Não inverter fatos. Se 50 cestas foram entregues, o tom pessimista diz "apenas 50", não inventa que foram 30.',
    '',
    'EXEMPLO: "A Prefeitura distribuiu apenas 50 cestas básicas no Calabar nesta semana. A ação se limitou ao envio das cestas aos moradores."',
  ].join('\n'),

  Alarmista: [
    'VOZ: Preocupante, alerta para perigos, urgência. Destaca riscos iminentes.',
    '',
    'PALAVRAS-PIVÔ: "alerta", "risco", "perigo", "ameaça", "preocupante", "emergência", "crítico".',
    '',
    'LEAD: Abra com o pior cenário possível ou com o alerta mais grave.',
    '',
    'VOCABULÁRIO: Termos de urgência e gravidade. Tom de alerta, quase de aviso.',
    '',
    'ARMADILHAS: Não inventar perigos. Só alerte sobre riscos que estão EXPLÍCITOS no Conteúdo.',
    '',
    'EXEMPLO: "Enquanto 50 famílias do Calabar recebem cestas básicas, a pergunta que fica é: quantas mais continuam sem assistência?"',
  ].join('\n'),

  Emotivo: [
    'VOZ: Apela aos sentimentos do leitor. Toca o coração.',
    '',
    'PALAVRAS-PIVÔ: "coração", "emoção", "lágrimas", "sorriso", "esperança", "medo", "superação".',
    '',
    'LEAD: Abra pelo elemento humano e emocional — uma história, um rosto, um sentimento.',
    '',
    'VOCABULÁRIO: Palavras de carga emocional forte, adjetivos sentimentais.',
    '',
    'ARMADILHAS: Não manipule. A emoção deve vir dos FATOS, não de invenções dramáticas.',
    '',
    'EXEMPLO: "Cada cesta básica entregue no Calabar carrega mais que alimentos — carrega a esperança de 50 famílias que lutam por dias melhores."',
  ].join('\n'),

  Persuasivo: [
    'VOZ: Convincente, busca mudar opinião ou ação. Tem objetivo claro de convencimento.',
    '',
    'PALAVRAS-PIVÔ: "é preciso", "precisamos", "é fundamental", "não podemos ignorar", "chegou a hora".',
    '',
    'LEAD: Abra com a tese ou posicionamento, depois apresente os fatos que a sustentam.',
    '',
    'VOCABULÁRIO: Verbos no imperativo ou no presente do indicativo com carga de convicção.',
    '',
    'ARMADILHAS: Fatos ainda são invioláveis. A persuasão está na ESCOLHA da apresentação, não na invenção.',
    '',
    'EXEMPLO: "A entrega de 50 cestas no Calabar é boa — mas precisamos ir além. É urgente ampliar o programa para atender todas as famílias em vulnerabilidade no bairro."',
  ].join('\n'),

  Urgente: [
    'VOZ: Pressionante, exige ação imediata. Sensação de tempo escasso.',
    '',
    'PALAVRAS-PIVÔ: "já", "agora", "iminente", "urgente", "corre contra o tempo", "horas decisivas", "não há tempo a perder".',
    '',
    'LEAD: Abra com a urgência — o prazo, a iminência, o que está em jogo.',
    '',
    'VOCABULÁRIO: Verbos no presente contínuo, frases curtas, ritmo acelerado.',
    '',
    'ARMADILHAS: Urgência não justifica inventar prazos ou consequências que não existem no Conteúdo.',
    '',
    'EXEMPLO: "As 50 cestas entregues no Calabar já chegaram — mas o estoque da Prefeitura não para por aí. Novas entregas precisam acontecer nos próximos dias."',
  ].join('\n'),

  Nostálgico: [
    'VOZ: Relembra o passado com saudade. Conecta o fato presente a uma memória coletiva.',
    '',
    'PALAVRAS-PIVÔ: "lembrar", "saudade", "antes", "antigamente", "naquele tempo", "memória", "tradição".',
    '',
    'LEAD: Abra com uma referência ao passado ou à memória afetiva, conectando ao fato atual.',
    '',
    'VOCABULÁRIO: Expressões de tempo decorrido, comparações entre passado e presente.',
    '',
    'ARMADILHAS: Não inventar um passado idealizado que não está no Conteúdo.',
    '',
    'EXEMPLO: "Quem conhece o Calabar de antigamente lembra da luta constante por assistência. Hoje, 50 famílias receberam cestas — um passo que traz à memória tempos de espera."',
  ].join('\n'),

  Dramático: [
    'VOZ: Intenso, teatral, emocional. Constrói tensão e impacto.',
    '',
    'PALAVRAS-PIVÔ: "silêncio", "vazio", "espera", "grito", "luta", "sobrevivência", "última chance".',
    '',
    'LEAD: Abra pelo elemento de maior tensão — o número humano, o contraste, a virada.',
    '',
    'VOCABULÁRIO: Palavras de alto impacto emocional, frases que criam suspense.',
    '',
    'ARMADILHAS: Dramático não é ficção. O drama deve vir da intensidade dos FATOS reais.',
    '',
    'EXEMPLO: "Cinquenta famílias. Cinquenta histórias. Cinquenta cestas básicas que chegaram ao Calabar — mas que deixaram perguntas sobre o que vem depois."',
  ].join('\n'),

  Provocativo: [
    'VOZ: Desafia, polemiza e gera debate. Faz perguntas incômodas.',
    '',
    'PALAVRAS-PIVÔ: "será que", "até quando", "enquanto isso", "o que realmente", "vale questionar".',
    '',
    'LEAD: Abra com uma pergunta provocativa ou constatação que desafie o status quo.',
    '',
    'VOCABULÁRIO: Perguntas retóricas, contrastes, oposições. Tom de debate.',
    '',
    'ARMADILHAS: Provocar não é ofender. Desafie ideias, não pessoas. Fatos continuam invioláveis.',
    '',
    'EXEMPLO: "Cinquenta cestas para um bairro inteiro? Enquanto a Prefeitura comemora a entrega, a pergunta que fica é: isso é assistência ou paliativo?"',
  ].join('\n'),
};

/* ============================================================================
 * STYLE_PROMPTS — o ESTILO define a ARQUITETURA do texto.
 *
 * Divisão de trabalho com TONE_PROMPTS: o TOM cuida da VOZ (vocabulário,
 * palavras-pivô, postura); o ESTILO cuida da FORMA (ordem da informação,
 * tamanho de parágrafo, ritmo de frase, atribuição).
 *
 * Antes o redator recebia só o rótulo do estilo ("Jornalístico") e nenhuma
 * instrução — escrevia sempre a mesma matéria genérica, qualquer que fosse a
 * escolha do usuário. Daqui sai a diferença editorial real entre um texto
 * noticioso, uma reportagem, um editorial e um material didático.
 * ========================================================================== */
const STYLE_PROMPTS = {
  'Jornalístico': [
    'ARQUITETURA: pirâmide invertida. A primeira frase do lead entrega o fato central (o quê + quem); a circunstância (quando/onde) vem depois. Cada parágrafo seguinte acrescenta uma camada de menor urgência.',
    'PARÁGRAFO: uma ideia por parágrafo, 2 a 4 frases.',
    'FRASE: ordem direta predominante, 18 a 25 palavras em média. A cada três frases longas, uma curta para dar respiro.',
    'ATRIBUIÇÃO: toda declaração e todo dado que não seja consenso vem com fonte explícita ("segundo a Prefeitura", "de acordo com o relatório").',
    'ARMADILHAS: não abrir pela circunstância ("Na manhã desta terça-feira…") — o fato vem antes da moldura. Não reescrever o título como lead.',
  ].join('\n'),

  'Noticioso': [
    'ARQUITETURA: pirâmide invertida estrita. O lead responde o quê, quem, quando e onde, sem rodeio.',
    'PARÁGRAFO: curtos, 2 a 3 frases. O texto deve poder ser cortado do fim para cima sem perder o essencial.',
    'FRASE: curtas e diretas, 15 a 22 palavras, voz ativa.',
    'ATRIBUIÇÃO: sempre — cada informação tem dono.',
    'ARMADILHAS: sem adjetivação valorativa e sem suspense. Notícia não guarda informação para o final.',
  ].join('\n'),

  'Reportagem': [
    'ARQUITETURA: abertura por um detalhe concreto que ESTEJA nos fatos (uma cena, um número, uma fala), depois contexto e desdobramento. O fato central aparece até o segundo parágrafo.',
    'PARÁGRAFO: 3 a 5 frases, com respiro entre blocos temáticos.',
    'FRASE: alterne longas (contexto) e curtas (impacto) — o contraste de ritmo é a assinatura do estilo.',
    'ATRIBUIÇÃO: as falas são costuradas ao texto, não empilhadas; apresente quem fala antes de citar.',
    'ARMADILHAS: sem detalhe concreto disponível, abra pelo fato central — não invente ambientação.',
  ].join('\n'),

  'Expositivo': [
    'ARQUITETURA: do geral ao específico. Apresente o objeto e destrinche suas partes numa ordem que o leitor consiga acompanhar.',
    'PARÁGRAFO: um conceito por parágrafo, concluído antes de passar ao próximo.',
    'FRASE: clareza acima de elegância. Evite subordinadas encaixadas; prefira duas frases a uma confusa.',
    'ATRIBUIÇÃO: deixe claro o que é dado do material e o que é decorrência dele.',
    'ARMADILHAS: explicar não é encher de definição — só defina o que o leitor precisa para entender o fato.',
  ].join('\n'),

  'Analítico': [
    'ARQUITETURA: fato → recorte → implicação. Estabeleça o que aconteceu, isole o aspecto que merece exame e mostre o que dele decorre.',
    'PARÁGRAFO: 3 a 5 frases, cada um sustentando um passo do raciocínio.',
    'FRASE: mais longas e articuladas, com conectivos de causa e contraste ("porque", "embora", "por outro lado").',
    'ATRIBUIÇÃO: separe com nitidez o que é dado do que é leitura do dado.',
    'ARMADILHAS: análise não é projeção. Toda inferência precisa de um fato que a ancore; sem isso, não escreva.',
  ].join('\n'),

  'Editorial': [
    'ARQUITETURA: tese no início, sustentação no meio, fecho que retoma a tese sem repeti-la literalmente.',
    'PARÁGRAFO: encadeados por argumento, cada um avançando a defesa.',
    'FRASE: firmes e assertivas; evite hedging excessivo ("talvez", "de certa forma").',
    'ATRIBUIÇÃO: a opinião é do veículo; os fatos que a sustentam continuam atribuídos.',
    'ARMADILHAS: posição não autoriza fato novo. Argumente com o que está no material.',
  ].join('\n'),

  'Documental': [
    'ARQUITETURA: cronológica ou por eixo de evidência — o leitor deve conseguir reconstituir o caso.',
    'PARÁGRAFO: densos mas organizados, um elo da cadeia por vez.',
    'FRASE: precisas, sem ornamento. Datas e números no corpo da frase, não em aposto.',
    'ATRIBUIÇÃO: rigorosa e nominal; a força do estilo está na rastreabilidade.',
    'ARMADILHAS: registrar a lacuna é legítimo e melhor que preenchê-la ("o material não informa o prazo").',
  ].join('\n'),

  'Técnico': [
    'ARQUITETURA: objeto, especificação, condição de aplicação — ordem previsível.',
    'PARÁGRAFO: blocos temáticos fechados; cada um responde uma pergunta técnica.',
    'FRASE: exatas, sem ambiguidade referencial. Repetir o termo correto é melhor que buscar sinônimo.',
    'ATRIBUIÇÃO: norma, fonte ou responsável técnico sempre que houver no material.',
    'ARMADILHAS: não simplifique a ponto de perder precisão, nem empilhe jargão sem necessidade.',
  ].join('\n'),

  'Didático': [
    'ARQUITETURA: do conhecido ao novo — ancore no que o leitor já sabe antes de introduzir o termo técnico.',
    'PARÁGRAFO: curtos, um passo de compreensão por vez.',
    'FRASE: 12 a 20 palavras, voz ativa e sujeito explícito.',
    'ATRIBUIÇÃO: distinga o que é fato do material e o que é explicação.',
    'ARMADILHAS: analogia só quando esclarece de fato — e sem introduzir informação que não esteja no material.',
  ].join('\n'),

  'Crônica': [
    'ARQUITETURA: um detalhe pequeno abre o texto e, ao fim, ganha sentido maior — do particular ao geral.',
    'PARÁGRAFO: livres e respirados, variando de tamanho conforme o ritmo.',
    'FRASE: musicais, com variação forte de extensão; aqui o ritmo importa tanto quanto a informação.',
    'ATRIBUIÇÃO: leve, integrada à narrativa.',
    'ARMADILHAS: a subjetividade está no olhar sobre o fato, nunca em fato inventado.',
  ].join('\n'),
};

/* Guia por GRUPO — usado nos estilos sem prompt dedicado, para que nenhuma
   escolha do usuário chegue ao redator sem orientação de forma. */
const STYLE_GROUP_PROMPTS = {
  'Jornalismo / Informação': 'ARQUITETURA: informação essencial primeiro, desdobramentos depois.\nPARÁGRAFO: 2 a 4 frases, uma ideia cada.\nATRIBUIÇÃO: toda afirmação relevante tem fonte.',
  'Acadêmico / Científico': 'ARQUITETURA: objeto, evidência, decorrência — nessa ordem.\nPARÁGRAFO: um argumento por parágrafo, concluído.\nFRASE: precisão acima de fluência; termos consistentes do início ao fim.\nARMADILHAS: nenhuma conclusão além do que a evidência do material sustenta.',
  'Marketing / Propaganda': 'ARQUITETURA: benefício concreto na frente, sustentação depois, fecho com direção clara.\nPARÁGRAFO: curtos e escaneáveis.\nFRASE: diretas, voz ativa, sem subordinada longa.\nARMADILHAS: persuasão vive de fato verificável — promessa sem lastro no material está proibida.',
  'Criativo / Artístico': 'ARQUITETURA: uma imagem ou detalhe conduz o texto do início ao fim.\nFRASE: variação de ritmo é o recurso principal.\nARMADILHAS: a licença é de linguagem, nunca de conteúdo — cenário, sensação e personagem precisam estar no material.',
  'Corporativo / Profissional': 'ARQUITETURA: assunto, posição da organização, providência.\nPARÁGRAFO: objetivos, sem preâmbulo.\nFRASE: ordem direta, impessoalidade sem burocratês.\nARMADILHAS: institucional não é vago — evite frase que não afirma nada.',
};

/** Orientação de FORMA para um estilo: prompt dedicado quando existe; senão o
 *  guia do grupo somado à descrição do próprio estilo. Nenhum estilo do
 *  catálogo chega ao redator sem instrução. */
function stylePrompt(styleId) {
  if (STYLE_PROMPTS[styleId]) return STYLE_PROMPTS[styleId];
  let grupo = '', desc = '';
  for (const g of STYLES) {
    const achado = g.items.find((i) => i.id === styleId);
    if (achado) { grupo = g.group; desc = achado.desc || ''; break; }
  }
  const base = STYLE_GROUP_PROMPTS[grupo] || STYLE_GROUP_PROMPTS['Jornalismo / Informação'];
  return desc ? `${base}\nCARÁTER DO ESTILO: ${desc}` : base;
}

/* ============================================================================
 * EDITORIAL_SAFETY — práticas de redação que reduzem risco jurídico.
 *
 * Vale para TODO estilo e TODO tom. Não é censura de opinião: é a diferença
 * entre uma crítica que se sustenta e uma acusação que expõe quem publica.
 * As técnicas abaixo são as que redações profissionais usam há décadas —
 * atribuição, vocabulário processual correto, separação entre fato e leitura,
 * e registro do contraditório.
 *
 * O erro que este bloco PRECISA evitar é o oposto: virar desculpa para um
 * texto covarde, cheio de "talvez" e sem afirmar nada. Segurança jurídica se
 * conquista com PRECISÃO e ATRIBUIÇÃO, não com hesitação — por isso o bloco
 * termina com o contraste dos três textos.
 * ========================================================================== */
const EDITORIAL_SAFETY = [
  '═══ REDAÇÃO JURIDICAMENTE RESPONSÁVEL (vale para qualquer estilo e qualquer tom) ═══',
  '',
  '1. ATRIBUIÇÃO — informação tem dono',
  '• Tudo que não é fato notório vem com fonte explícita: "segundo a Prefeitura", "de acordo com o relatório", "a empresa informou".',
  '• Use verbos NEUTROS de atribuição: disse, afirmou, declarou, informou, apontou.',
  '• Evite verbos que já julgam: "admitiu" e "confessou" pressupõem culpa; "alegou" insinua descrédito; "revelou" pressupõe que era verdade oculta. Só use se for exatamente o caso.',
  '• Se o material não diz de onde vem a informação, ou você a atribui corretamente, ou não a escreve.',
  '',
  '2. PRESUNÇÃO DE INOCÊNCIA — quando houver apuração, acusação ou crime',
  '• Ninguém é culpado antes da condenação. NUNCA use o rótulo definitivo: "o criminoso", "o assassino", "o ladrão", "o corrupto", "o traficante".',
  '• Use o termo da FASE PROCESSUAL em que a pessoa está, e só até onde o material comprova: suspeito → investigado → indiciado → denunciado → réu → condenado (em 1ª instância / com trânsito em julgado).',
  '• Não afirme autoria: "é acusado de", "é suspeito de", "segundo a denúncia", "teria" — nunca "fulano desviou o dinheiro" quando não há condenação.',
  '• Inquérito não é processo; denúncia não é condenação; prisão não é culpa formada. Não troque um pelo outro.',
  '• Adolescente em conflito com a lei não é identificado: use "adolescente de 16 anos", sem nome.',
  '',
  '3. FATO × INTERPRETAÇÃO — a fronteira precisa ficar visível ao leitor',
  '• O fato entra afirmado; a leitura entra marcada como leitura ("o valor chama atenção", "o prazo é apertado", "a explicação não convence").',
  '• Não apresente conclusão como fato provado. Argumento é bem-vindo; veredito disfarçado de notícia, não.',
  '',
  '4. AFIRMAÇÃO CATEGÓRICA — só até onde o material sustenta',
  '• Sem prova no material, não afirme causa, culpa ou resultado como certos.',
  '• Prefira o específico ao generalizante: critique o ato e o dado, não a categoria inteira nem o caráter da pessoa.',
  '',
  '5. CONTRADITÓRIO — o outro lado',
  '• Se o material traz a versão do acusado, ela ENTRA na matéria. Suprimir defesa existente é o erro mais caro.',
  '• Se o material não traz, registre a ausência ("a reportagem não teve acesso à manifestação da empresa") em vez de fingir que ela não existe.',
  '• Nunca invente a resposta do outro lado.',
  '',
  '6. LINGUAGEM — crítica sim, ofensa não',
  '• Sem adjetivo desqualificador sobre pessoas ("incompetente", "picareta", "mentiroso").',
  '• A dureza do texto vem do fato exposto, não do xingamento.',
  '',
  '═══ ISTO NÃO É PEDIDO DE NEUTRALIDADE ═══',
  'Cuidado jurídico NÃO significa texto morno. Um texto covarde é tão ruim quanto um texto temerário. Compare:',
  '',
  '✗ COVARDE (não afirma nada, não informa): "A obra talvez possa ter enfrentado algum tipo de problema."',
  '✗ TEMERÁRIO (acusa sem respaldo): "A empreiteira roubou o dinheiro da obra."',
  '✓ FORTE E SEGURO: "Dois anos depois do prazo, a obra segue inacabada. Segundo o relatório do TCE, R$ 2 milhões já foram pagos à empreiteira — que, procurada, não se manifestou."',
  '',
  'A terceira é a mais dura das três: ela informa, cobra e se sustenta. É esse o alvo — a força vem da precisão e da atribuição, nunca da hesitação nem do adjetivo.',
].join('\n');

/* Termos de alto risco usados pela auditoria determinística de risco jurídico
   (agents.js). Rótulos definitivos condenam antes do juiz. */
const SAFETY_ROTULOS_CRIMINAIS = [
  'criminoso', 'criminosa', 'assassino', 'assassina', 'ladrão', 'ladra', 'ladrao',
  'bandido', 'bandida', 'corrupto', 'corrupta', 'estuprador', 'traficante',
  'golpista', 'fraudador', 'pedófilo', 'pedofilo', 'terrorista',
];
/* Marcadores de que a informação foi atribuída a alguém. */
const SAFETY_MARCADORES_ATRIBUICAO = [
  'segundo', 'de acordo com', 'conforme', 'afirmou', 'disse', 'declarou',
  'informou', 'apontou', 'denúncia', 'denuncia', 'acusado', 'suspeito',
  'investigado', 'indiciado', 'réu', 'apurou', 'relatou',
];
/* Vocabulário que indica assunto criminal/judicial em pauta. */
const SAFETY_TERMOS_CRIMINAIS = [
  'crime', 'roubo', 'furto', 'homicídio', 'homicidio', 'assassinato', 'corrupção',
  'corrupcao', 'fraude', 'desvio', 'propina', 'lavagem de dinheiro', 'tráfico',
  'trafico', 'estupro', 'abuso', 'prisão', 'prisao', 'preso', 'detido',
  'operação policial', 'operacao policial', 'inquérito', 'inquerito', 'denúncia',
];
/* Marcadores de que o contraditório foi registrado. */
const SAFETY_MARCADORES_CONTRADITORIO = [
  'procurad', 'não se manifest', 'nao se manifest', 'defesa', 'não respondeu',
  'nao respondeu', 'não foi localizad', 'nao foi localizad', 'negou', 'nega ',
  'em nota', 'contatad', 'não comentou', 'nao comentou',
];

/** Catálogo de modelos disponíveis por provedor */
const PROVIDER_MODELS = {
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B', desc: 'Recomendado · ótimo custo-benefício, 128k ctx' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant', desc: 'Rápido e econômico' },
    { id: 'meta-llama/llama-4-scout-17b-16e-instruct', label: 'Llama 4 Scout 17B', desc: 'Novo · contexto longo' },
    { id: 'meta-llama/llama-4-maverick-17b-128e-instruct', label: 'Llama 4 Maverick 17B', desc: 'Novo · mais capaz' },
  ],
  openai: [
    { id: 'gpt-5.5', label: 'GPT-5.5', desc: 'Último e mais capaz da OpenAI' },
    { id: 'gpt-5.4', label: 'GPT-5.4', desc: 'Excelente equilíbrio qualidade/preço' },
    { id: 'gpt-5.4-mini', label: 'GPT-5.4 Mini', desc: 'Custo-benefício para alto volume' },
    { id: 'gpt-4.1', label: 'GPT-4.1', desc: '1M tokens, ótimo em seguir formato' },
  ],
  anthropic: [
    { id: 'claude-sonnet-4-6', label: 'Claude Sonnet 4.6', desc: 'Inteligência Opus a preço Sonnet' },
    { id: 'claude-opus-4-7', label: 'Claude Opus 4.7', desc: 'Mais capaz, 1M tokens, visão HD' },
    { id: 'claude-haiku-4-5', label: 'Claude Haiku 4.5', desc: 'Rápido, econômico, 200k tokens' },
  ],
};

