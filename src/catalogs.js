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
/* ============================================================================
 * ATRIBUIÇÃO — de quem é a afirmação.
 *
 * Defeito relatado em uso real: a matéria escrevia "as obras da Ponte
 * Salvador-Itaparica começam em 1º de agosto" como se o veículo garantisse a
 * data. O que existe é um governador tendo anunciado isso — e a diferença não é
 * de estilo: a obra pode atrasar, e aí o erro passa a ser do jornal.
 *
 * A regra já existia, mas enterrada no item 1 do bloco de segurança jurídica,
 * enquadrada como precaução para pauta de crime. Aqui ela vira o que é: regra
 * de redação, válida para toda matéria, aplicada a toda informação que tem
 * dono. O bloco entra alto no prompt, nos dois modos de geração.
 * ========================================================================== */
const EDITORIAL_ATTRIBUTION = [
  '═══ ATRIBUIÇÃO — TODA INFORMAÇÃO TEM DONO ═══',
  '',
  'A matéria NÃO afirma por conta própria o que uma pessoa, um órgão ou uma empresa afirmou. Ela relata QUEM afirmou. Escrever a declaração de alguém como se fosse fato apurado pelo veículo é o erro mais comum e o mais caro: quando a promessa não se cumpre, o erro vira do jornal.',
  '',
  'O QUE PRECISA DE FONTE — praticamente tudo que não é acontecimento observado:',
  '• anúncio, promessa e cronograma ("as obras começam em…", "o serviço será ampliado…");',
  '• previsão, estimativa, projeção e meta ("devem ser gerados 5 mil empregos");',
  '• número, valor e balanço ("R$ 4,5 bilhões", "atendeu 500 famílias");',
  '• causa, motivo e explicação ("o atraso se deve à chuva");',
  '• avaliação e diagnóstico ("a situação está controlada");',
  '• acusação, suspeita e apuração — aqui a fonte é obrigatória e a fase processual também.',
  '',
  'O QUE DISPENSA FONTE: o acontecimento que o material apresenta como ocorrido e verificável por qualquer um ("a ponte foi interditada", "o evento reuniu público na praça").',
  '',
  'COMO ATRIBUIR',
  '• Construções: "segundo X", "de acordo com X", "conforme X", "X informou que", "X anunciou", "X afirmou", "na avaliação de X", "de acordo com o relatório/o comunicado/a nota".',
  '• A fonte aparece na PRIMEIRA vez que a informação é dada. Nas retomadas seguintes do mesmo assunto não precisa repetir a cada frase — mas se um parágrafo novo traz informação nova daquela fonte, ela volta.',
  '• Verbos NEUTROS de atribuição: disse, afirmou, declarou, informou, anunciou, apontou, estima. Evite os que já julgam: "admitiu" e "confessou" pressupõem culpa; "alegou" insinua descrédito; "revelou" pressupõe verdade oculta.',
  '• Nomeie a fonte com o cargo quando o material der: "o governador Jerônimo Rodrigues", "a Secretaria de Infraestrutura", "o relatório do TCE".',
  '• Se o material NÃO diz quem informou, isso é matéria-prima honesta: "o material não informa a origem da data" é melhor do que assumir a informação como sua.',
  '',
  'EXEMPLO — o mesmo fato, errado e certo:',
  '✗ ERRADO (o veículo assume a promessa): "As obras da Ponte Salvador-Itaparica começam em 1º de agosto."',
  '✓ CERTO (a promessa tem dono): "Segundo o governador Jerônimo Rodrigues, as obras da Ponte Salvador-Itaparica começam em 1º de agosto."',
  '✓ TAMBÉM CERTO: "As obras da ponte devem começar em 1º de agosto, de acordo com o anúncio do governo do estado."',
  '',
  'ATENÇÃO: atribuir NÃO é encher o texto de "segundo" em toda frase — isso emperra a leitura. É garantir que o leitor sempre saiba de quem é cada afirmação. Uma fonte bem posicionada cobre o parágrafo inteiro.',
  '',
  '─── JUÍZO DE VALOR TAMBÉM TEM DONO ───',
  '',
  'A regra acima costuma ser aplicada só a data, número e promessa — e aí a matéria atribui o fato certinho no primeiro parágrafo e passa os seguintes ELOGIANDO por conta própria. O leitor entende que quem está avaliando é o veículo.',
  '',
  'AVALIAÇÃO NÃO É DESCRIÇÃO. Estas construções parecem relato e são julgamento — nenhuma delas é verificável, então nenhuma pode ficar órfã:',
  '"é um exemplo de…", "é um sinal de…", "é um passo importante", "é um marco", "é um avanço", "é uma conquista", "demonstra o compromisso de…", "reforça o compromisso…", "é um reconhecimento do esforço…", "é motivo de orgulho", "é louvável", "é inegável que", "sem dúvida", "gestão eficaz", "gestão responsável".',
  '',
  'A ARMADILHA DO MATERIAL INSTITUCIONAL: quando a origem é release, nota oficial ou anúncio, o material JÁ VEM elogioso. Esse elogio é da fonte — ele não vira avaliação do veículo por ser reescrito com outras palavras. Reescrever "o prefeito destacou que a gestão é eficaz" como "é um exemplo de gestão eficaz" TROCA O AUTOR da opinião. É o erro mais comum em pauta de prefeitura, e o mais grave: transforma o veículo em porta-voz.',
  '',
  'DIANTE DE UM JUÍZO, TRÊS SAÍDAS — nesta ordem:',
  '1. TEM DONO NO MATERIAL → atribua: "Segundo o prefeito, a compra é um exemplo de gestão eficaz.", "Para a Secretaria, o investimento demonstra o compromisso com a saúde."',
  '2. NÃO TEM DONO → corte. Um juízo sem dono não é informação; é enfeite que compromete o veículo.',
  '3. NUNCA invente um dono ("para especialistas", "na avaliação de moradores") que o material não traz.',
  '',
  'E A MATÉRIA PODE FICAR MAIS CURTA. Se o material tem um fato só, escreva o fato só. Encher parágrafo com juízo sem dono para alcançar tamanho é pior do que entregar um texto menor e correto — e é exatamente assim que o erro costuma entrar.',
  '',
  'EXEMPLO — o caso real que motivou esta regra:',
  'MATERIAL: o prefeito de Acajutiba anunciou a compra de seis veículos, mais de R$ 900 mil, e disse que a aquisição mostra uma gestão eficaz e responsável.',
  '✗ ERRADO (o portal vira quem elogia): "A aquisição dos veículos é um passo importante para a melhoria dos serviços públicos. É um exemplo de como a gestão pública pode ser eficaz. O investimento é um sinal de que a prefeitura está comprometida com a população."',
  '✓ CERTO (o elogio volta para quem o fez): "Segundo o prefeito, a nova frota deve melhorar o atendimento à população e é um exemplo de gestão eficaz. Ele afirmou ainda que o investimento demonstra o compromisso da prefeitura com os moradores."',
  '✓ TAMBÉM CERTO (sem dono, some): "A prefeitura informou que os seis veículos custaram mais de R$ 900 mil. O material não detalha quais secretarias serão atendidas."',
].join('\n');

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
/* JUÍZO DE VALOR — as construções que avaliam sem dizer quem avalia.
 *
 * O defeito relatado em uso real: numa matéria sobre a compra de veículos, o
 * lead atribuía direito ("Segundo o prefeito…") e os três parágrafos seguintes
 * seguiam afirmando "é um exemplo de gestão eficaz", "é um sinal de que a
 * prefeitura está comprometida", "é um passo importante" — sem dono nenhum. O
 * leitor entende que quem está elogiando é o portal, quando na verdade eram
 * palavras do prefeito.
 *
 * O que estas expressões têm em comum: parecem descrição e são julgamento.
 * Nenhuma delas é verificável, então nenhuma pode ficar sem dono.
 *
 * Nenhum item pode ser trecho de outro (há teste travando isso): marcador que
 * casa dentro de outro conta duas vezes e distorce o diagnóstico. */
const SAFETY_MARCADORES_JUIZO = [
  'é um exemplo de', 'e um exemplo de', 'é um sinal de', 'e um sinal de',
  'passo importante', 'é um reconhecimento', 'e um reconhecimento',
  'é um marco', 'e um marco', 'é um avanço', 'e um avanco',
  'é uma conquista', 'e uma conquista', 'grande iniciativa', 'motivo de orgulho',
  'demonstra o compromisso', 'reforça o compromisso', 'reforca o compromisso',
  'gestão eficaz', 'gestao eficaz', 'gestão responsável', 'gestao responsavel',
  'é louvável', 'e louvavel', 'é inegável', 'e inegavel', 'sem dúvida', 'sem duvida',
];

/* Subconjunto VAZIO: elogio de fórmula, que não diz nada nem quando é opinião
 * assumida. As regras de comentário opinativo já o proíbem com todas as letras
 * ("elogio genérico não vale nada"), então ele é defeito NOS DOIS MODOS — com
 * ou sem a camada de comentário ligada. */
const SAFETY_JUIZO_VAZIO = [
  'é um exemplo de', 'e um exemplo de', 'é um sinal de', 'e um sinal de',
  'passo importante', 'grande iniciativa', 'é um marco', 'e um marco',
  'demonstra o compromisso', 'reforça o compromisso', 'reforca o compromisso',
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

/* ============================================================================
 * COERÊNCIA DE TOM — léxicos de valência.
 *
 * Servem à varredura determinística que encontra, no rascunho, expressões de
 * juízo puxando para o lado CONTRÁRIO ao tom escolhido. É o vazamento clássico:
 * a fonte diz "sucesso extraordinário", o usuário pede tom pessimista e a
 * palavra atravessa para a matéria, que passa a se contradizer.
 *
 * Só entram palavras claramente AVALIATIVAS. Termos ambíguos que também podem
 * ser factuais ("queda", "denúncia", "problema") ficam de fora de propósito —
 * o resultado alimenta o revisor, e apontar demais faria o revisor mexer no
 * que estava certo.
 * ========================================================================== */
const TOM_LEXICO_POSITIVO = [
  'sucesso', 'êxito', 'exito', 'conquista', 'avanço', 'avanco', 'melhoria',
  'benefício', 'beneficio', 'celebra', 'comemora', 'excelente', 'ótimo', 'otimo',
  'exemplar', 'fortalece', 'moderniza', 'premiado', 'elogiad', 'orgulho',
  'esperança', 'esperanca', 'vitória', 'vitoria', 'triunfo', 'extraordinári',
  'notável', 'notavel', 'impecável', 'impecavel', 'promissor',
  // Vazamentos vistos em produção: elogio que não usa a palavra "bom" — vem
  // como virtude atribuída ao evento ("celebra saúde, superação e qualidade
  // de vida"). Sem estes termos a varredura passava batido.
  'superação', 'superacao', 'qualidade de vida', 'celebração', 'celebracao',
  'festa do esporte', 'grande festa', 'inspirador', 'emocionante', 'histórica',
  'historica', 'consagr', 'brilhante', 'maravilhos', 'espetacular', 'incrível',
  'incrivel', 'referência', 'referencia', 'marco', 'valoriza', 'engrandece',
];
const TOM_LEXICO_NEGATIVO = [
  'fracasso', 'caos', 'caótic', 'caotic', 'precári', 'precari', 'abandono',
  'descaso', 'sucateamento', 'colapso', 'desastre', 'desastros', 'lamentável',
  'lamentavel', 'péssim', 'pessim', 'insuficiente', 'deficiente', 'revolta',
  'indignação', 'indignacao', 'vergonhos', 'calamidade', 'ineficaz', 'ineficiente',
  'fiasco', 'retrocesso', 'fracassad', 'decepcion', 'frustr', 'negligência',
  'negligencia', 'caótico', 'desorganiz', 'improvis', 'mediocr', 'tímido',
  'timido', 'aquém', 'aquem', 'esvaziad',
];

/** Valência do tom, derivada do GRUPO do catálogo — assim todo tom novo já
 *  nasce classificado, sem lista paralela para manter. 0 = sem verificação
 *  (tons neutros e emocionais não têm lado a defender). */
function toneValence(tone) {
  for (const g of TONES) {
    if (!g.items.some((i) => i.id === tone)) continue;
    if (g.group === 'Positivos') return 1;
    if (g.group === 'Negativos') return -1;
    return 0;
  }
  return 0;
}

/** Catálogo de modelos disponíveis por provedor */
/* ============================================================================
 * COMENTÁRIOS OPINATIVOS — a camada de leitura sobre os fatos.
 *
 * Estilo e tom mudam COMO o fato é contado. Este controle acrescenta outra
 * coisa: uma opinião assumida sobre o que cada parágrafo apresenta. São eixos
 * independentes de propósito — dá para narrar em tom otimista e comentar com
 * crítica, e isso NÃO é contradição: é a matéria dizendo "isto aconteceu" e,
 * em seguida, "e a leitura disso é esta".
 *
 * Duas travas herdadas do resto da ferramenta valem aqui inteiras:
 *   1. Comentário COMENTA, não informa. Ele se apoia em algo literalmente
 *      presente no material — nunca em fato novo, comparação inexistente ou
 *      causa deduzida. É o mesmo teste do "de onde você tirou isso?".
 *   2. A fronteira fato × leitura fica VISÍVEL ao leitor. Não é preciosismo
 *      de estilo: é o item 3 do bloco de segurança jurídica. Opinião marcada
 *      como opinião é protegida; opinião disfarçada de fato provado é risco.
 *
 * Por isso o modo crítico ataca o ATO, o DADO, o PRAZO e a AUSÊNCIA — nunca o
 * caráter de quem quer que seja.
 * ========================================================================== */
const COMENTARIOS = [
  { id: 'nenhum', label: 'Sem comentários', desc: 'A matéria sai como sempre: só os fatos, no estilo e no tom escolhidos.' },
  { id: 'positivos', label: 'Positivos', desc: 'Reforça o que o material apresenta de positivo, parágrafo a parágrafo.' },
  { id: 'negativos', label: 'Negativos', desc: 'Desenvolve crítica sobre os fatos — mesmo quando o material é elogioso.' },
  { id: 'ambos', label: 'Positivos e negativos', desc: 'Reconhece o que avança e cobra o que falta, cada um ancorado no seu parágrafo.' },
];

/** O modo está ativo? (qualquer coisa fora de 'nenhum'/vazio) */
function comentarioAtivo(id) {
  return !!id && id !== 'nenhum' && COMENTARIOS.some((c) => c.id === id && c.id !== 'nenhum');
}

/** Rótulo legível para histórico e selos. */
function comentarioLabel(id) {
  const c = COMENTARIOS.find((x) => x.id === id);
  return c ? c.label : COMENTARIOS[0].label;
}

/**
 * Quais valências passam a ser INTENCIONAIS no texto.
 *
 * Existe porque a varredura determinística de coerência de tom
 * (detectarConflitosDeTom) foi escrita para achar juízo do lado CONTRÁRIO ao
 * tom e mandar o revisor apagar. Com comentário ligado, esse juízo contrário
 * pode ser exatamente o que o usuário PEDIU — apagá-lo seria a ferramenta
 * desfazendo a escolha dele. Daí a valência intencional: o que foi pedido não
 * é vazamento.
 */
function comentarioValencias(id) {
  switch (id) {
    case 'positivos': return { positivo: true, negativo: false };
    case 'negativos': return { positivo: false, negativo: true };
    case 'ambos': return { positivo: true, negativo: true };
    default: return { positivo: false, negativo: false };
  }
}

/* Vocabulário de MARCAÇÃO da opinião, separado por DIREÇÃO.
 *
 * Duas funções, uma fonte só. No prompt, é o que ensina a marcar a leitura como
 * leitura (a exigência jurídica de fronteira visível). Na saída, é o que permite
 * conferir de forma determinística se a camada foi aplicada E se veio na direção
 * pedida — sem tentar "detectar opinião" em geral, que é problema semântico, e
 * sim procurar as construções que a própria ferramenta mandou usar. */
const COMENTARIO_MARCADORES_RECONHECIMENTO = [
  // Marcação de leitura
  'não é pouco', 'nao e pouco', 'não é trivial', 'não é detalhe', 'não é banal',
  'vale registrar', 'ganha peso', 'pesa a favor', 'diz muito', 'é o tipo de',
  'sinaliza', 'representa um', 'é um passo', 'faz diferença', 'não é comum',
  'chama atenção pela', 'salta aos olhos',
  // Veredito afirmativo — o registro incisivo, que é o padrão pedido.
  // ATENÇÃO ao escolher termo novo: nenhum pode ser substring de um marcador da
  // outra lista, nem virar o oposto com um "não" na frente. 'entregou' e
  // 'cumpriu' saíram daqui exatamente por isso ("não entregou", "não cumpriu"
  // marcariam crítica como elogio); 'saiu do papel' e 'deu certo' idem. Há
  // teste travando a regra.
  'é entrega', 'é resultado', 'merece registro', 'é raro', 'é concreto',
  'é o que se esperava', 'é exceção', 'está acima do', 'supera o',
];
const COMENTARIO_MARCADORES_COBRANCA = [
  // Marcação de leitura
  'resta saber', 'deixa em aberto', 'fica em aberto', 'segue sem', 'continua sem',
  'o material não', 'não informa', 'nao informa', 'não explica', 'nao explica',
  'não detalha', 'não esclarece', 'não responde', 'não diz quanto', 'não diz quantas',
  'sem que se saiba', 'ainda depende', 'é apertado', 'fica a pergunta', 'a dúvida que',
  'nada garante', 'não há prazo', 'não se sabe', 'passa longe', 'fica aquém',
  // Veredito frontal — o registro incisivo, que é o padrão pedido
  'não se sustenta', 'não convence', 'é insuficiente', 'insuficiente', 'é vago',
  'é tardio', 'é o mínimo', 'desproporcional', 'não entregou', 'sem dizer',
  'nenhuma explicação', 'nenhum número', 'o silêncio', 'não apresenta',
  'não cumpriu', 'atrasada', 'atrasado', 'incompleto', 'incompleta',
  'não resolve', 'longe de', 'não muda', 'nada além', 'é só o começo',
];
const COMENTARIO_MARCADORES = COMENTARIO_MARCADORES_RECONHECIMENTO.concat(COMENTARIO_MARCADORES_COBRANCA);

/* Bloco comum a qualquer direção de comentário: COMO ele entra no texto.
 *
 * Duas correções moram aqui, e as duas vieram de defeito relatado em uso real:
 *
 * 1. A primeira versão não produzia comentário NENHUM. Era feita quase só de
 *    tetos ("no máximo um", "melhor faltar do que forçar"). Um prompt só de
 *    limites converge para zero. Daí o PISO: todo parágrafo do corpo leva um.
 *
 * 2. A segunda produzia sempre comentário POSITIVO, qualquer que fosse a
 *    escolha. A causa: em nenhum lugar se proibia a direção contrária — a
 *    instrução descrevia o que fazer sem excluir o oposto —, e a direção
 *    crítica carregava cinco proibições próprias somadas a catorze do bloco
 *    jurídico, enquanto o elogio corria solto. Diante de pauta institucional,
 *    o caminho de menor resistência era elogiar, e nenhuma regra era violada.
 *    Daí a EXCLUSIVIDADE, que abre cada direção, e o reequilíbrio: a direção
 *    crítica agora tem menu de movimentos permitidos, não só lista de vetos. */
const COMENTARIO_BASE = [
  '═══ CAMADA DE COMENTÁRIO OPINATIVO (pedida pelo usuário — não é opcional) ═══',
  'Além de relatar, esta matéria leva COMENTÁRIO: uma leitura opinativa assumida sobre o que cada parágrafo apresenta.',
  '',
  'QUANTIDADE — o piso, não o teto',
  '• CADA parágrafo do corpo leva UM comentário. Um por parágrafo: nem zero, nem dois.',
  '• O comentário é uma FRASE INTEIRA, própria, normalmente a última do parágrafo. Não é adjetivo solto nem oração subordinada escondida no meio da frase do fato — assim ninguém percebe que ela está lá.',
  '• "O parágrafo não dava base para comentar" NÃO é resposta aceitável: quando faltar base, o comentário é sobre a LACUNA (veja abaixo). Essa saída está sempre disponível, então não existe parágrafo sem comentário.',
  '• Varie a construção entre os parágrafos. Se todos terminam com a mesma fórmula, vira cacoete.',
  '',
  'DIREÇÃO — a escolha do usuário é EXCLUSIVA, não uma sugestão',
  '• A direção definida adiante vale para TODOS os comentários da matéria. Comentário na direção contrária é ERRO DE EXECUÇÃO, não variação de estilo.',
  '• O material de origem NÃO decide a direção. Pauta institucional e elogiosa recebe a direção pedida do mesmo jeito — é justamente aí que a escolha do usuário tem valor.',
  '• A lista "Ângulos editoriais" e o tom da fonte também não decidem: são insumo neutro. Quem decide a direção do comentário é a instrução abaixo, e só ela.',
  '• Ao terminar, releia cada comentário e pergunte: este está na direção pedida? Qualquer um que não esteja, reescreva antes de responder.',
  '',
  'DE QUEM É ESTA OPINIÃO — e de quem ela NUNCA pode ser',
  '• O comentário é leitura DO VEÍCULO sobre o fato. Por isso ele só pode existir onde o fato já foi relatado e atribuído: primeiro o leitor sabe o que aconteceu e quem disse, só então lê a sua leitura.',
  '• NÃO É COMENTÁRIO reescrever com outras palavras o elogio (ou a queixa) que a FONTE já fez. Isso não é opinião do veículo: é a opinião da fonte com o autor trocado — e o leitor passa a atribuir ao portal o que o prefeito, a empresa ou o órgão disse. Quando o juízo veio da fonte, ele volta para ela com "segundo", "para", "na avaliação de" — e o comentário, se couber, é OUTRA coisa, sua.',
  '• Pauta institucional é onde isso mais acontece: o release já vem cheio de "passo importante", "compromisso", "exemplo de gestão". Repetir esse vocabulário é assinar o release.',
  '• PARÁGRAFO SÓ DE JUÍZO NÃO EXISTE. Se um parágrafo não tem fato relatado, ele não tem o que comentar — e vira elogio (ou ataque) solto no ar. Falta fato? O comentário é sobre a LACUNA, e o parágrafo diz qual fato falta.',
  '',
  'A REGRA QUE NÃO SE QUEBRA: COMENTÁRIO COMENTA, NÃO INFORMA',
  '• Ele só se apoia em algo que está literalmente no material. Vale o mesmo teste do resto da matéria: "de onde você tirou isso?" precisa ter resposta apontável.',
  '• Nunca é fato novo, comparação que o material não faz, causa deduzida, número estimado nem reação de terceiros que ninguém relatou.',
  '• O COMENTÁRIO DE LACUNA é o mais seguro quando falta base: aponta o que o material deixou de responder. "O material não informa o custo da obra" é verificável, honesto e não inventa nada.',
  '',
  'FRONTEIRA VISÍVEL — exigência jurídica, não capricho de estilo',
  '• O comentário entra MARCADO como leitura, nunca como veredito disfarçado de notícia ("ficou provado que", "é evidente que houve").',
  '• Sem adjetivo que desqualifique PESSOA. Comenta-se o ato, o dado, a decisão, o prazo, o silêncio — nunca o caráter de alguém.',
  '• Em pauta de crime ou apuração, o comentário obedece à presunção de inocência e à fase processual igual ao resto do texto.',
  '',
  'FORMA — o comentário é do texto, não um puxadinho',
  '• Integrado ao parágrafo, no mesmo fluxo de leitura. NUNCA em bloco separado, entre parênteses, em itálico, em nota ou com rótulo do tipo "Comentário:", "Análise:", "Opinião:".',
  '• Sempre DEPOIS do fato que ele comenta: primeiro o leitor sabe o que aconteceu, só então lê a leitura.',
  '',
  'INTENSIDADE — o comentário é VEREDITO, não anotação de rodapé',
  '• Quem lê tem de saber exatamente o que você está dizendo. Comentário morno é pior que comentário nenhum: ocupa o lugar e não entrega nada.',
  '• PROIBIDO amortecer. Fora com "talvez", "de certa forma", "pode-se dizer", "aparentemente", "em certa medida", "cabe questionar se", "seria interessante saber". Não peça licença para opinar: se cabe questionar, QUESTIONE; se seria interessante saber, COBRE.',
  '• Fora também com muleta de abertura: "é importante ressaltar", "vale destacar", "por outro lado" usado como amortecedor. O comentário começa direto no que interessa.',
  '• Nomeie a coisa com a palavra que ela merece. O adjetivo certo sobre o FATO é o que dá força: insuficiente, atrasado, vago, incoerente, incompleto, tardio, desproporcional, concreto, inédito, raro.',
  '• TESTE FINAL: leia SÓ as frases de comentário, uma atrás da outra. Elas formam uma opinião nítida, que dá para atribuir a alguém? Se soarem como legenda de foto ou pudessem ser assinadas por qualquer lado da discussão, estão fracas — reescreva com convicção.',
  '',
  'ALVO — onde a força pode bater, e onde ela se perde',
  '• Bata no ATO, no DADO, no PRAZO, na DECISÃO, na OMISSÃO e na INSTITUIÇÃO. Prefeitura, empresa, órgão, gestão e programa NÃO são blindados: podem ser cobrados com todas as letras.',
  '• NÃO bata no caráter de pessoa identificável ("incompetente", "picareta", "mentiroso", "vagabundo"). Isso não é pedido de moderação: é o único trecho que um advogado consegue derrubar, e ele derruba a matéria inteira junto.',
  '• Compare a força das duas: "o secretário é um incompetente" é frágil, atacável e diz pouco. "O secretário anunciou a mesma obra três vezes e não entregou nenhuma" é devastador, verificável e ninguém tira do ar. A segunda é a que se escreve aqui.',
].join('\n');

/* Direção do comentário. Cada bloco abre pela EXCLUSIVIDADE (a regra que
   faltava), segue com o MENU do que fazer — com as construções de marcação
   correspondentes — e só então os limites, comprimidos. Ordem proposital: o
   modelo lê primeiro o que deve fazer, não o que não pode. */
const COMENTARIO_PROMPTS = {
  positivos: [
    'DIREÇÃO DO COMENTÁRIO: POSITIVA, ENFÁTICA — e SOMENTE positiva.',
    '',
    'EXCLUSIVIDADE: nenhum comentário crítico nesta matéria. Zero. Se um comentário cobra, aponta falha, lamenta ausência ou relativiza o mérito, ele está na direção ERRADA — reescreva-o como reconhecimento. Ressalva também é crítica: "embora ainda faltem…" não entra.',
    '',
    'INTENSIDADE: elogio morno não serve. O comentário AFIRMA o mérito com convicção, sem pedir licença e sem se equilibrar em cima do muro. Se a frase pudesse aparecer numa matéria neutra sem ninguém notar, ela está fraca.',
    '',
    'O QUE FAZER — reconheça, com todas as letras, o que os fatos sustentam:',
    '• O ALCANCE do que foi feito, dito sem timidez ("cinquenta famílias em uma semana, num único bairro, é entrega concreta").',
    '• O QUE SAIU DO PAPEL: separe o que foi cumprido do que costuma ficar em anúncio — quando o material permitir essa leitura.',
    '• O INEDITISMO, quando o material o afirma ("é o primeiro levantamento que o município divulga sobre o tema").',
    '• QUEM GANHA, nomeando o benefício concreto que está no material.',
    '• VELOCIDADE, VOLUME OU ABRANGÊNCIA, quando houver dado que os mostre.',
    '• O MÉRITO DO DADO MODESTO: mesmo um número pequeno pode ser o primeiro que existe, e isso vale registro.',
    'Construções úteis: ' + COMENTARIO_MARCADORES_RECONHECIMENTO.slice(0, 8).map((m) => `"${m}…"`).join(', ') + '.',
    '',
    'LIMITES: ancore cada elogio num fato daquele parágrafo — elogio genérico ("uma grande iniciativa", "um passo importante") não vale nada e ainda enfraquece o texto. Entusiasmo não autoriza superlativo sem base: "o maior da região" só entra se o material disser isso. E nunca elogio inventado.',
    '',
    'EXEMPLO — a diferença entre discreto e incisivo:',
    'FATO: "A Prefeitura entregou 50 cestas básicas a moradores do Calabar nesta semana."',
    'FRACO (não faça): "O número não é pouco para o bairro."',
    'FORTE (faça): "Cinquenta famílias atendidas numa única semana, em um só bairro, é entrega concreta — do tipo que costuma parar no anúncio e não chegar à porta de ninguém."',
  ].join('\n'),

  negativos: [
    'DIREÇÃO DO COMENTÁRIO: CRÍTICA FRONTAL — e SOMENTE crítica.',
    '',
    'EXCLUSIVIDADE: nenhum comentário elogioso nesta matéria. Zero. Se um comentário reconhece mérito, celebra, tranquiliza ou termina em nota positiva, ele está na direção ERRADA — reescreva-o como cobrança. Isso vale principalmente quando o material de origem é elogioso: é exatamente esse o caso em que o usuário escolheu crítica, e o anúncio da fonte não muda a direção.',
    'Também não vale o "elogio com ressalva" ("a medida é positiva, embora…"), nem fechar o parágrafo em esperança ("resta torcer para que"). A frase inteira é crítica, do começo ao fim.',
    '',
    'INTENSIDADE: esta é a parte em que os modelos costumam falhar por excesso de cautela. Não falhe. A crítica aqui é DURA, DIRETA e SEM ANESTESIA. Não suavize, não compense, não termine amaciando.',
    '• Chame o problema pelo nome: insuficiente, atrasado, vago, incoerente, mal explicado, incompleto, tardio, desproporcional, "não se sustenta", "não convence", "é o mínimo".',
    '• Instituição não é blindada. "A Prefeitura não explica", "a empresa não apresentou um número sequer", "a gestão anuncia o que não entrega" são frases permitidas e desejáveis.',
    '• Cobre a conduta pública de quem tem cargo — o que a pessoa FEZ, DEIXOU DE FAZER, prometeu e não cumpriu. Conduta é alvo legítimo; caráter não é.',
    '• Use o silêncio como acusação: o que não foi dito costuma ser a informação mais reveladora do anúncio.',
    '',
    'O QUE FAZER — a crítica sai destes ângulos, todos ancorados no material e todos inatacáveis:',
    '• O QUE FICOU DE FORA: custo, prazo, responsável, quantas pessoas, de onde vem o dinheiro.',
    '• O TAMANHO DIANTE DO PROBLEMA: o feito comparado ao que o próprio material descreve como necessidade.',
    '• O TEMPO: quanto se levou, quantas vezes foi anunciado, há quanto tempo o problema existe.',
    '• O QUE SEGUE EM ABERTO: o que a medida não resolve e o texto não responde.',
    '• ANÚNCIO × ENTREGA: a distância entre o que se promete e o que se comprova.',
    '• O SILÊNCIO: a falta do outro lado, da explicação ou do dado que sustentaria a versão apresentada.',
    'Construções úteis: ' + COMENTARIO_MARCADORES_COBRANCA.slice(0, 8).map((m) => `"${m}…"`).join(', ') + '.',
    '',
    'LIMITES — curtos, e nenhum deles autoriza recuar para o elogio nem amolecer o texto:',
    '• O alvo é o ato, o dado, a decisão, o prazo, a omissão e a instituição — não o caráter da pessoa. Adjetivo contra a pessoa ("incompetente", "picareta") é o único trecho frágil que você pode escrever: enfraquece o argumento e derruba a matéria.',
    '• Não impute crime, fraude ou má-fé sem que o material traga a apuração; se trouxer, use a fase processual correta e atribua.',
    '• Não transforme suspeita em conclusão. A dureza vem do fato exposto, não da acusação solta.',
    '• Falta de base para criticar o mérito NUNCA é motivo para elogiar: critique a lacuna, que existe em quase toda pauta.',
    '',
    'EXEMPLO — a diferença entre discreto e incisivo:',
    'FATO: "A Prefeitura entregou a obra da praça nesta semana, dois anos depois do prazo previsto."',
    'FRACO (não faça): "O material não informa o custo da obra."',
    'FORTE (faça): "Dois anos depois do prazo, a Prefeitura entrega a praça sem dizer quanto ela custou — e o silêncio sobre o valor é a informação mais eloquente do anúncio."',
  ].join('\n'),

  ambos: [
    'DIREÇÃO DO COMENTÁRIO: OS DOIS LADOS — e os dois precisam APARECER, os dois com força.',
    '',
    'EXCLUSIVIDADE ÀS AVESSAS: aqui o erro é ficar de um lado só. A matéria tem de conter, obrigatoriamente, pelo menos UM comentário de reconhecimento E pelo menos UM de cobrança. Se ao revisar você vir que todos elogiam (ou todos cobram), reescreva o comentário de pelo menos um parágrafo para a outra direção. Matéria só elogiosa é o erro mais comum aqui — confira isso especificamente.',
    '',
    'INTENSIDADE: os dois lados entram com a mesma convicção. O elogio afirma o mérito sem timidez; a crítica é frontal e sem anestesia. Equilibrar NÃO é amornar — o erro fatal aqui é produzir dois comentários mornos que se anulam e não dizem nada.',
    '',
    'COMO DISTRIBUIR:',
    '• Cada parágrafo continua levando UM comentário. O que varia é a direção: um parágrafo recebe o reconhecimento, outro a cobrança.',
    '• Não é alternância mecânica um-para-um: é reconhecer o que avança e cobrar o que falta, onde cada um couber.',
    '• Também cabe o contraste dentro do mesmo movimento — mas com peso dos dois lados: "as 200 famílias listadas foram atendidas; sobre as que ficaram fora da lista, o material não diz uma palavra".',
    'Construções úteis — reconhecimento: ' + COMENTARIO_MARCADORES_RECONHECIMENTO.slice(0, 5).map((m) => `"${m}…"`).join(', ') + '.',
    'Construções úteis — cobrança: ' + COMENTARIO_MARCADORES_COBRANCA.slice(0, 5).map((m) => `"${m}…"`).join(', ') + '.',
    '',
    'LIMITES: valem os das duas direções — elogio sempre ancorado em fato, crítica sempre sobre o ato/dado/omissão/instituição e nunca sobre o caráter de pessoa identificável.',
    '',
    'EXEMPLO (dois parágrafos seguidos, com direções diferentes e a mesma convicção):',
    'P1: "A Prefeitura entregou 50 cestas básicas no Calabar nesta semana. Cinquenta famílias atendidas em sete dias, num só bairro, é entrega concreta."',
    'P2: "A distribuição integra o programa de assistência social do município. Quantas famílias seguem na fila, o material não diz — e é justamente esse número que mediria o programa."',
  ].join('\n'),
};

/** Rótulo curto da direção, para injetar no contrato de saída e no editor. */
const COMENTARIO_DIRECAO_CURTA = {
  positivos: 'POSITIVO (reconhecimento — nunca crítica)',
  negativos: 'CRÍTICO (cobrança — nunca elogio)',
  ambos: 'alternando reconhecimento e cobrança (os dois têm de aparecer)',
};
function comentarioDirecaoCurta(id) {
  return COMENTARIO_DIRECAO_CURTA[id] || '';
}

/**
 * A camada de comentário aparece no texto — e na DIREÇÃO pedida?
 *
 * NÃO é um detector de opinião: isso é problema semântico, e a ferramenta já
 * aprendeu (na Narrativa, com a heurística de palavras em comum) o preço de
 * fingir que varredura lexical decide questão de sentido. O que se faz aqui é
 * estreito: procurar as CONSTRUÇÕES DE MARCAÇÃO que o próprio prompt mandou
 * usar, separadas por direção.
 *
 * Regra de prudência: só se acusa a AUSÊNCIA da direção pedida. Nunca se acusa
 * pela presença da outra — um comentário crítico pode legitimamente conter
 * "chama atenção", e reprovar quem cumpriu seria o erro caro. Falso positivo
 * apenas silencia o aviso; é o lado barato de errar.
 *
 * Devolve { reconhecimento, cobranca, ok } — `ok` já considerando o modo.
 */
function comentarioDirecaoAplicada(texto, id) {
  const t = String(texto || '').toLowerCase();
  const tem = (lista) => lista.some((m) => t.indexOf(m) !== -1);
  const reconhecimento = !!t.trim() && tem(COMENTARIO_MARCADORES_RECONHECIMENTO);
  const cobranca = !!t.trim() && tem(COMENTARIO_MARCADORES_COBRANCA);
  let ok;
  switch (id) {
    case 'positivos': ok = reconhecimento; break;
    case 'negativos': ok = cobranca; break;
    case 'ambos': ok = reconhecimento && cobranca; break;
    default: ok = true; break;   // sem pedido, nada a conferir
  }
  return { reconhecimento, cobranca, ok };
}

/** A camada apareceu de alguma forma (qualquer direção)? */
function comentarioAplicado(texto) {
  const d = comentarioDirecaoAplicada(texto, null);
  return d.reconhecimento || d.cobranca;
}

/**
 * Monta o bloco completo de comentário para injetar num prompt. Devolve string
 * vazia quando o modo está desligado — nada muda no prompt de quem não pediu.
 */
function comentarioBloco(id, tone) {
  if (!comentarioAtivo(id)) return '';
  const direcao = COMENTARIO_PROMPTS[id] || '';
  return [
    COMENTARIO_BASE,
    '',
    direcao,
    '',
    '═══ COMENTÁRIO × TOM — não confunda os dois ═══',
    `O tom "${tone}" continua mandando na NARRAÇÃO: escolha de verbo, adjetivação do relato, ordem dos fatos, ritmo. Isso não muda.`,
    'O comentário é uma camada À PARTE, e a direção dele foi escolhida pelo usuário. Quando os dois apontarem para lados diferentes, isso NÃO é contradição nem descuido: é a matéria relatando no tom pedido e, em seguida, oferecendo a leitura pedida.',
    'O que precisa ficar claro é a passagem entre uma coisa e outra — o leitor tem de perceber onde termina o relato e começa a opinião. O que não pode, nunca, é o comentário se disfarçar de fato.',
  ].join('\n');
}

/* Catálogo Groq — atualizado em agosto de 2026.
 *
 * A Groq retirou TODA a família Llama que este catálogo oferecia. O Maverick
 * saiu em março de 2026; o Llama 3.3 70B, o Llama 3.1 8B Instant e o Llama 4
 * Scout foram anunciados em junho e deixaram de ser atendidos em agosto de
 * 2026 — pedidos a esses IDs voltam com erro, não com texto. Os sucessores
 * abaixo são os indicados pela própria Groq na migração.
 *
 * O primeiro item é o PADRÃO: quem tinha um modelo retirado salvo no navegador
 * cai nele sozinho no boot (syncGroqModel, em apikey-sync.js, normaliza contra
 * este catálogo). Manter o mais capaz na frente é o que preserva a qualidade
 * de quem nunca abriu as Configurações.
 *
 * Ao mexer aqui, confira a lista viva em console.groq.com/docs/models — um ID
 * fora do catálogo da Groq derruba todas as ferramentas de uma vez. */
const PROVIDER_MODELS = {
  groq: [
    { id: 'openai/gpt-oss-120b', label: 'GPT-OSS 120B', desc: 'Recomendado · o mais capaz, sucessor do Llama 3.3 70B' },
    { id: 'openai/gpt-oss-20b', label: 'GPT-OSS 20B', desc: 'Rápido e econômico · sucessor do Llama 3.1 8B' },
    { id: 'qwen/qwen3.6-27b', label: 'Qwen3.6 27B', desc: 'Prévia da Groq · para experimentar, não para produção' },
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

