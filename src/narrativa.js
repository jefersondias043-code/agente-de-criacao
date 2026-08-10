'use strict';
/* ============================================================
   NARRATIVA — o construtor de histórias da plataforma.

   POR QUE ESTA FERRAMENTA EXISTE
   As outras ferramentas partem do princípio de que já existe um conteúdo:
   uma pauta, um texto extraído, um post que funcionou. Esta parte de ANTES —
   da pergunta que decide se vale a pena produzir. O lema que rege o trabalho
   (NARR_LEMA, abaixo) diz que uma história só existe quando três perguntas
   têm resposta: o que o protagonista quer, o que o impede e o que ele arrisca.
   Sem isso, não é história — é situação. E situação não prende ninguém.

   A ferramenta faz três coisas, nesta ordem:
     1. COLETA  — as três respostas (com ajuda opcional da IA para extraí-las
                  de uma ideia bruta ou para afiá-las).
     2. JULGA   — um diagnóstico DETERMINÍSTICO, offline, sem chamada de IA:
                  regras derivadas literalmente do lema. É a trava. Enquanto
                  faltar resposta, a ferramenta não escreve conteúdo — porque
                  escrever ali seria produzir uma situação bem redigida.
     3. ESCREVE — só depois do veredito "história", transforma a estrutura em
                  conteúdo pronto para a plataforma escolhida (Reels, carrossel,
                  legenda, thread, roteiro longo…), com o lema embutido no
                  prompt como regra inegociável.

   O diagnóstico ser LOCAL não é detalhe de implementação: é o que garante que
   a disciplina funcione sem chave de API, offline, no celular, de graça — e
   que a resposta seja sempre a mesma para a mesma entrada (o usuário aprende
   a regra em vez de negociar com um modelo).
   ============================================================ */

/* -------------------------------------------------------------------------- */
/* §1 — O LEMA (fonte única da doutrina)                                       */
/* -------------------------------------------------------------------------- */

/* Texto do usuário, verbatim. Aparece na interface E entra em todo prompt de
   IA como regra que governa a escrita. Um só lugar para mudar. */
const NARR_LEMA = [
  'Se o seu protagonista não deseja conquistar nada, sua história perde a força antes mesmo de começar.',
  '',
  'Toda boa história nasce de um desejo. Existe alguém querendo alcançar um objetivo. É esse desejo que impulsiona a narrativa.',
  '',
  'Mas desejo, por si só, não basta. Ele precisa encontrar obstáculos. Quando um personagem consegue tudo com facilidade, não existe conflito. E sem conflito, não existe envolvimento.',
  '',
  'Por isso, toda história deve responder a três perguntas fundamentais:',
  '',
  '• O que o protagonista quer?',
  '• O que o impede de conseguir esse objetivo?',
  '• O que ele está disposto a arriscar para alcançá-lo?',
  '',
  'Se essas perguntas ainda não têm resposta, você provavelmente não tem uma história. Tem apenas uma situação.',
].join('\n');

/* As três perguntas como DADO — a interface, o diagnóstico e os prompts leem
   daqui, então nunca saem de sincronia com o lema. */
const NARR_PERGUNTAS = [
  {
    id: 'desejo',
    campo: 'desejo',
    pergunta: 'O que o protagonista quer?',
    papel: 'Desejo',
    ajuda: 'Um objetivo concreto, que dá para ver acontecendo. "Quer ser feliz" não é objetivo — "quer voltar a morar na cidade onde nasceu" é.',
    placeholder: 'Ex.: quer reabrir a padaria do pai antes do fim do ano',
  },
  {
    id: 'obstaculo',
    campo: 'obstaculo',
    pergunta: 'O que o impede de conseguir esse objetivo?',
    papel: 'Obstáculo',
    ajuda: 'A força que trava. Se o caminho é fácil, não há conflito — e sem conflito não há envolvimento.',
    placeholder: 'Ex.: o imóvel foi penhorado e o irmão quer vender',
  },
  {
    id: 'risco',
    campo: 'risco',
    pergunta: 'O que ele está disposto a arriscar para alcançá-lo?',
    papel: 'Risco',
    ajuda: 'O que ele perde se der errado. Sem nada em jogo, não há tensão — o público assiste sem torcer.',
    placeholder: 'Ex.: as economias da aposentadoria e a relação com o irmão',
  },
];

/* -------------------------------------------------------------------------- */
/* §2 — Catálogos: formatos, tons e tamanhos                                   */
/* -------------------------------------------------------------------------- */

/* Cada formato carrega a ESTRUTURA (os beats) que o prompt entrega ao modelo.
   O que muda entre plataformas não é o tom — é onde o desejo, o obstáculo e o
   risco aparecem no tempo. Por isso a estrutura vive junto do formato.

   `elencoMax` = quantos personagens ALÉM do protagonista o formato sustenta.
   Não é regra de gosto: em 30 segundos não dá tempo de o espectador aprender
   quem é quem. Cinco nomes num Reels viram ruído; num roteiro de 10 minutos,
   não. O diagnóstico usa esse número para avisar (nunca para travar). */
const NARR_FORMATOS = [
  {
    id: 'reels',
    label: 'Reels / TikTok — roteiro falado',
    desc: '30 a 60 segundos, com marcação de tempo e fala pronta para gravar.',
    estrutura: [
      '0–3s GANCHO: uma frase só, que já expõe o DESEJO ou o RISCO. Proibido: saudação, "hoje eu vou falar sobre", "você sabia que".',
      '3–10s CONTEXTO MÍNIMO: o estritamente necessário para entender quem quer o quê.',
      '10–25s OBSTÁCULO: mostre a força que impede. A tensão cresce aqui — não resolva nada ainda.',
      '25–45s O QUE ESTÁ EM JOGO: a decisão e o preço. Diga o que ele perde se der errado.',
      '45–60s FECHAMENTO: uma frase que devolve o tema a quem assiste, seguida de uma chamada natural (comentar, salvar, seguir).',
      'Escreva a FALA — o que sai da boca —, não a descrição da cena. Marque cada bloco com o tempo.',
    ],
    elencoMax: 2,
  },
  {
    id: 'carrossel',
    label: 'Carrossel — 8 a 10 slides',
    desc: 'Um slide por beat, com texto curto o bastante para caber na arte.',
    estrutura: [
      'Slide 1 — GANCHO: no máximo 8 palavras. É o slide que decide se o resto será visto.',
      'Slide 2 — QUEM E O QUE QUER: apresente o protagonista pelo desejo, não pelo currículo.',
      'Slides 3 e 4 — O OBSTÁCULO: por que não é simples. Um obstáculo por slide, o segundo pior que o primeiro.',
      'Slides 5 e 6 — O QUE ESTÁ EM JOGO: o preço, a escolha, o que se perde.',
      'Slides 7 e 8 — A VIRADA: o que mudou e o que isso custou.',
      'Último slide — FECHAMENTO: a frase que a pessoa quer repetir + a chamada.',
      'Formate como "SLIDE 1 —" em cada bloco. Máximo de 30 palavras por slide.',
    ],
    elencoMax: 3,
  },
  {
    id: 'legenda',
    label: 'Legenda de post',
    desc: 'Instagram/Facebook: primeira linha que segura, corpo curto, chamada no fim.',
    estrutura: [
      'PRIMEIRA LINHA: sozinha, é o gancho — precisa funcionar antes do "ver mais".',
      'CORPO: 3 a 6 parágrafos curtos. Desejo → obstáculo → o que está em jogo → virada.',
      'FECHAMENTO: uma frase de sentido + uma pergunta genuína que dê vontade de responder.',
      'Depois do texto, sugira de 5 a 8 hashtags em uma única linha.',
    ],
    elencoMax: 3,
  },
  {
    id: 'stories',
    label: 'Sequência de Stories',
    desc: '4 a 6 telas encadeadas, cada uma puxando a próxima.',
    estrutura: [
      'Uma tela por bloco, marcada como "TELA 1", "TELA 2"…',
      'Cada tela cabe em 2 linhas de texto na vertical — escreva curto de verdade.',
      'TELA 1: o desejo, dito como se você estivesse contando para um amigo.',
      'TELAS DO MEIO: o obstáculo e o que está em jogo, uma informação nova por tela.',
      'ÚLTIMA TELA: a virada e uma interação (caixinha de pergunta, enquete ou "responde aqui").',
      'Cada tela deve terminar em um gancho que obrigue a tocar na próxima.',
    ],
    elencoMax: 2,
  },
  {
    id: 'youtube',
    label: 'Roteiro de vídeo longo',
    desc: 'YouTube: estrutura em atos, com marcação de blocos.',
    estrutura: [
      'ABERTURA (0–30s): o desejo e o risco na mesma respiração. Sem apresentação pessoal antes disso.',
      'ATO 1 — O DESEJO: quem quer, o que quer e por que isso importa agora.',
      'ATO 2 — O OBSTÁCULO: a oposição, em escalada. Cada tentativa que falha aumenta o custo.',
      'ATO 3 — O PREÇO: a decisão, o que foi arriscado, o que se perdeu no caminho.',
      'FECHAMENTO: o sentido do que aconteceu + a chamada.',
      'Marque cada bloco com o nome do ato. Escreva a fala corrida, não tópicos.',
    ],
    elencoMax: 5,
  },
  {
    id: 'thread',
    label: 'Thread — X / Threads',
    desc: '6 a 9 posts numerados, cada um sustentando o próximo.',
    estrutura: [
      'Numere os posts como "1/", "2/"…',
      'Post 1: o gancho — desejo ou risco, em no máximo 200 caracteres.',
      'Posts seguintes: um beat por post. Desejo → obstáculo → escalada → o que está em jogo → virada.',
      'Cada post precisa fazer sentido sozinho e ainda assim puxar o próximo.',
      'Último post: fechamento + chamada.',
    ],
    elencoMax: 3,
  },
  {
    id: 'newsletter',
    label: 'Newsletter / artigo de blog',
    desc: 'Texto corrido, com título, abertura em cena e fechamento.',
    estrutura: [
      'TÍTULO: concreto, sem promessa vazia.',
      'ABERTURA: comece por uma CENA, não por contexto. O leitor entra no meio do desejo.',
      'DESENVOLVIMENTO: obstáculo, escalada e o preço — em parágrafos curtos.',
      'FECHAMENTO: o que isso significa para quem lê.',
      'De 400 a 800 palavras, salvo indicação de tamanho diferente.',
    ],
    elencoMax: 5,
  },
  {
    id: 'ganchos',
    label: 'Só os ganchos — 10 variações',
    desc: 'Dez primeiras frases diferentes para testar a mesma história.',
    estrutura: [
      'Devolva 10 ganchos numerados, um por linha, sem explicação.',
      'Varie o ângulo: 3 partindo do desejo, 3 do obstáculo, 3 do risco, 1 partindo do fim da história.',
      'Máximo de 15 palavras cada. Nenhum pode começar com pergunta retórica batida ("você já parou para pensar").',
      'Nenhum gancho pode entregar o desfecho.',
    ],
    elencoMax: 1,
  },
  {
    id: 'dialogo',
    label: 'Diálogo / esquete — duas vozes ou mais',
    desc: 'Cena falada entre os personagens, com rubricas curtas. Precisa de elenco.',
    estrutura: [
      'Escreva como cena: "NOME:" antes de cada fala, rubrica de ação entre parênteses e curta.',
      'ABERTURA: entre no meio da conversa, já em atrito. Nada de cumprimento nem apresentação.',
      'MEIO: o desejo do protagonista bate no que o outro personagem quer. É esse choque que segura a cena.',
      'VIRADA: alguém diz o que estava calado — e o que está em jogo aparece na fala, não na narração.',
      'FECHAMENTO: uma última fala curta que deixa a decisão no ar ou a devolve para quem assiste.',
      'Ninguém explica a própria motivação em voz alta: a intenção aparece no que a pessoa faz e evita dizer.',
      'Se nenhum outro personagem tiver sido declarado, escreva como monólogo com fala relatada — não invente um personagem.',
    ],
    elencoMax: 3,
  },
];

/* Papéis do elenco. São DECLARADOS pelo usuário num select, nunca inferidos do
   texto — a lição da heurística de palavras em comum que precisou ser removida
   vale aqui em dobro: adivinhar a função de um personagem por vocabulário erraria
   contra quem escreve bem. Declarado, o papel vira dado confiável: o diagnóstico
   e o prompt sabem exatamente o que cada um faz com o desejo do protagonista. */
const NARR_PAPEIS = [
  { id: 'antagonista', label: 'Antagonista', desc: 'Quer o oposto. É a força que trava o protagonista.' },
  { id: 'rival', label: 'Rival', desc: 'Quer a mesma coisa. Só um consegue.' },
  { id: 'aliado', label: 'Aliado', desc: 'Ajuda — e a ajuda cobra um preço.' },
  { id: 'mentor', label: 'Mentor', desc: 'Ensina o que falta, mas não resolve no lugar dele.' },
  { id: 'vinculo', label: 'Vínculo', desc: 'A relação em jogo: por quem ele faz, ou o que ele perde se seguir.' },
  { id: 'testemunha', label: 'Testemunha', desc: 'Vê de fora e conta. Não decide nada.' },
];

/* Tons pensados para conteúdo de criador — não para jornalismo (esse catálogo
   já existe em catalogs.js e serve à ferramenta Gerar). */
const NARR_TONS = [
  { id: 'direto', label: 'Direto e seco', desc: 'Frases curtas, zero adjetivo decorativo. O fato faz o trabalho.' },
  { id: 'intimo', label: 'Íntimo / confessional', desc: 'Primeira pessoa, como quem conta baixinho para uma pessoa só.' },
  { id: 'provocativo', label: 'Provocativo', desc: 'Confronta uma crença comum logo na primeira linha.' },
  { id: 'inspirador', label: 'Inspirador', desc: 'Eleva sem enfeitar — a esperança vem do custo pago, não de frase pronta.' },
  { id: 'bem-humorado', label: 'Bem-humorado', desc: 'Leve e rápido, com ironia que não zomba do protagonista.' },
  { id: 'documental', label: 'Documental', desc: 'Observa de fora, com precisão. Deixa o fato doer sozinho.' },
  { id: 'urgente', label: 'Urgente', desc: 'Ritmo acelerado, tempo curto, decisão iminente.' },
];

const NARR_TAMANHOS = [
  { id: 'curto', label: 'Curto', desc: 'O essencial, sem respiro.' },
  { id: 'medio', label: 'Médio', desc: 'Espaço para uma escalada.' },
  { id: 'longo', label: 'Longo', desc: 'Cena, detalhe e desenvolvimento.' },
];

/* -------------------------------------------------------------------------- */
/* §3 — Motor de diagnóstico (puro, offline, determinístico)                   */
/* -------------------------------------------------------------------------- */

/* Normaliza para comparação: minúsculas, sem acento, espaço colapsado. Todas as
   listas abaixo são escritas SEM acento porque são comparadas depois disto. */
function narrNorm(s) {
  return String(s == null ? '' : s)
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function narrTokens(s) {
  return narrNorm(s).replace(/[^a-z0-9\s]/g, ' ').split(/\s+/).filter(Boolean);
}

/* Verbo (ação) — heurística: infinitivo em -ar/-er/-ir ou uma forma conjugada
   frequente. Serve só para AVISAR quando a resposta não descreve ação nenhuma
   ("mais reconhecimento" não é um objetivo, é um substantivo). */
const NARR_VERBOS_COMUNS = new Set([
  'quer', 'quero', 'queria', 'deseja', 'desejo', 'precisa', 'preciso', 'busca', 'busco',
  'tenta', 'tento', 'luta', 'luto', 'sonha', 'sonho', 'vai', 'vou', 'tem', 'tenho',
  'pretende', 'planeja', 'decide', 'decidiu', 'corre', 'chega', 'ganha', 'vence', 'prova',
  'conquista', 'constroi', 'salva', 'volta', 'sai', 'foge', 'enfrenta', 'perde', 'perco',
  'arrisca', 'aposta', 'assume', 'paga', 'abre', 'fecha', 'compra', 'vende', 'muda',
]);
function narrTemVerbo(s) {
  return narrTokens(s).some((t) => NARR_VERBOS_COMUNS.has(t) || (t.length >= 5 && /(ar|er|ir)$/.test(t)));
}

/* Abstrações puras: viram desejo de verdade só quando ganham objeto e prazo. */
const NARR_ABSTRATOS = [
  'sucesso', 'felicidade', 'ser feliz', 'paz', 'reconhecimento', 'liberdade', 'realizacao',
  'crescimento', 'crescer', 'evoluir', 'evolucao', 'melhorar', 'melhora', 'mudanca',
  'proposito', 'inspirar pessoas', 'fazer a diferenca', 'ser alguem', 'ser melhor',
];

/* "Consegue tudo com facilidade" — o lema trata isso como ausência de conflito. */
const NARR_FACILIDADE = [
  'facil', 'facilmente', 'basta ', 'e so ', 'simples', 'sem esforco', 'sem dificuldade',
  'sem problema', 'naturalmente', 'rapidinho', 'tranquilo', 'de boa',
];

/* Formas de dizer "não tem" — respondidas assim, a pergunta continua sem resposta. */
const NARR_AUSENCIA = [
  'nada', 'ninguem', 'nenhum', 'nenhuma', 'nao ha', 'nao tem', 'nao sei', 'n/a', 'na', '-', '?',
  'nada mesmo', 'nada o impede', 'nada impede', 'nao perde nada', 'nao arrisca nada',
];

/* Léxico de aposta: o que caracteriza algo EM JOGO. */
const NARR_APOSTA = [
  'perder', 'perde', 'perco', 'perda', 'arriscar', 'arrisca', 'risco', 'custar', 'custa',
  'custo', 'preco', 'sacrificar', 'sacrificio', 'abrir mao', 'deixar de', 'expor', 'exposicao',
  'vergonha', 'humilhacao', 'fracasso', 'fracassar', 'falir', 'quebrar', 'divida', 'emprego',
  'dinheiro', 'economias', 'reputacao', 'credibilidade', 'carreira', 'amizade', 'familia',
  'casamento', 'relacao', 'saude', 'tempo', 'anos', 'estabilidade', 'conforto', 'seguranca',
  'orgulho', 'sozinho', 'tudo', 'nome', 'casa', 'liberdade', 'confianca',
];

function narrContemAlgum(texto, lista) {
  const n = narrNorm(texto);
  return lista.some((termo) => n.indexOf(termo) !== -1);
}

/* Resposta que é só uma negação/evasiva ("nada", "não sei", "-"). Exige que a
   resposta INTEIRA seja isso — "nada me impede além do dinheiro" é conteúdo. */
function narrEhAusencia(texto) {
  const n = narrNorm(texto).replace(/[.!]+$/, '');
  if (!n) return true;
  if (NARR_AUSENCIA.indexOf(n) !== -1) return true;
  return /^(nada|ninguem|nenhum[ao]?)( o| me| lhe)?( impede| impedia| atrapalha| trava)?$/.test(n) ||
    /^(nao (perde|arrisca|arriscaria|tem|ha)( nada)?)$/.test(n) ||
    /^nao sei( ainda)?$/.test(n);
}

/* ----- Elenco -----
   O lema fala de UM protagonista, e é dele o desejo que impulsiona a narrativa.
   O elenco não muda isso: os três portões continuam sendo as três perguntas do
   protagonista. O que o elenco ganha é um teste mais leve, derivado da mesma
   frase de abertura — "se o seu protagonista não deseja conquistar nada, sua
   história perde a força": um personagem que não quer nada é cenário com nome.
   Isso AVISA, não trava, porque quem decide o peso de cada figura é quem escreve. */

function narrElenco(n) {
  const lista = (n && Array.isArray(n.elenco)) ? n.elenco : [];
  // Linhas recém-adicionadas e ainda em branco não são defeito — são o cursor
  // do usuário. Só entram no diagnóstico quando têm nome ou desejo.
  return lista.filter((p) => p && (String(p.nome || '').trim() || String(p.quer || '').trim()));
}

function narrPapel(id) {
  return NARR_PAPEIS.find((p) => p.id === id) || NARR_PAPEIS[0];
}

/** Avisos do elenco. Um aviso por TIPO de defeito, listando os nomes — assim o
 *  placar não desaba por ter muitos personagens, só por ter muitos problemas. */
function narrAvisosElenco(elenco, formato, protagonista) {
  const avisos = [];
  if (!elenco.length) {
    if (formato && formato.id === 'dialogo') {
      avisos.push('O formato Diálogo pede pelo menos um personagem além do protagonista — sem elenco, sai um monólogo. Adicione quem está do outro lado da conversa ou troque de formato.');
    }
    return avisos;
  }

  const semNome = elenco.filter((p) => !String(p.nome || '').trim());
  if (semNome.length) {
    avisos.push(`${semNome.length === 1 ? 'Um personagem está' : `${semNome.length} personagens estão`} sem nome. Quem não tem nome não é lembrado — e quem não é lembrado não sustenta uma cena.`);
  }

  const semDesejo = elenco.filter((p) => String(p.nome || '').trim() && !String(p.quer || '').trim());
  if (semDesejo.length) {
    const nomes = semDesejo.map((p) => p.nome.trim()).join(', ');
    const soAntagonistas = semDesejo.every((p) => p.papel === 'antagonista' || p.papel === 'rival');
    avisos.push(soAntagonistas
      ? `${nomes}: um antagonista que não quer nada não consegue se opor a nada. Diga o que ele quer — é o choque entre os dois desejos que cria o conflito.`
      : `${nomes} não quer nada. Personagem sem desejo é cenário com nome: ou dê a ele um objetivo próprio, ou corte.`);
  }

  const vistos = new Set();
  const repetidos = new Set();
  elenco.forEach((p) => {
    const chave = narrNorm(p.nome);
    if (!chave) return;
    if (vistos.has(chave)) repetidos.add(p.nome.trim());
    vistos.add(chave);
  });
  if (repetidos.size) {
    avisos.push(`Nome repetido no elenco: ${[...repetidos].join(', ')}. Dois personagens com o mesmo nome confundem quem lê.`);
  }

  const prot = narrNorm(protagonista);
  if (prot && vistos.has(prot)) {
    avisos.push('O protagonista está listado também no elenco. Ele já é o centro da história — no elenco vai só quem gira em volta dele.');
  }

  const max = (formato && typeof formato.elencoMax === 'number') ? formato.elencoMax : 3;
  if (elenco.length > max) {
    avisos.push(`${elenco.length} personagens além do protagonista para o formato "${formato.label}" — ele sustenta cerca de ${max}. Quem não mexe no desejo, no obstáculo ou no risco pode sair sem prejuízo.`);
  }

  return avisos;
}

function _check(id, status, mensagem, dica) {
  const p = NARR_PERGUNTAS.find((x) => x.id === id);
  return {
    id,
    papel: p ? p.papel : id,
    pergunta: p ? p.pergunta : '',
    status,       // 'ok' | 'fraco' | 'faltando'
    mensagem,     // o veredito desta pergunta
    dica,         // o que fazer para melhorar (vazio quando 'ok')
  };
}

function narrAvaliarDesejo(desejo) {
  if (!String(desejo || '').trim() || narrEhAusencia(desejo)) {
    return _check('desejo', 'faltando',
      'Sem desejo declarado.',
      'O lema começa por aqui: se o protagonista não deseja conquistar nada, a história perde a força antes de começar. Escreva o objetivo em uma frase, começando por um verbo.');
  }
  const toks = narrTokens(desejo);
  if (toks.length < 3) {
    return _check('desejo', 'fraco',
      'O desejo está curto demais para ser um objetivo.',
      'Diga o quê, de quem e até quando. "Reconhecimento" é um tema; "quer ser chamado para tocar na festa da cidade" é um objetivo.');
  }
  if (!narrTemVerbo(desejo)) {
    return _check('desejo', 'fraco',
      'O desejo está escrito como tema, não como ação.',
      'Reescreva com um verbo: o que ele quer FAZER, alcançar ou conquistar.');
  }
  if (narrContemAlgum(desejo, NARR_ABSTRATOS) && toks.length <= 7) {
    return _check('desejo', 'fraco',
      'O desejo é abstrato — ninguém consegue vê-lo acontecendo.',
      'Concretize: reconhecido por quem? melhor em quê? em quanto tempo? Um objetivo precisa ter um momento em que dá para dizer "conseguiu".');
  }
  return _check('desejo', 'ok', 'Há um objetivo concreto impulsionando a narrativa.', '');
}

function narrAvaliarObstaculo(obstaculo, desejo) {
  if (!String(obstaculo || '').trim() || narrEhAusencia(obstaculo)) {
    return _check('obstaculo', 'faltando',
      'Nada se opõe ao desejo.',
      'Sem obstáculo não há conflito, e sem conflito não há envolvimento. O que trava? Uma pessoa, uma regra, uma falta, um prazo, ele mesmo?');
  }
  if (narrContemAlgum(obstaculo, NARR_FACILIDADE)) {
    return _check('obstaculo', 'faltando',
      'O obstáculo se resolve com facilidade — na prática, não existe.',
      'Quando o personagem consegue tudo com facilidade, não existe conflito. Aumente o custo: o que torna isso realmente difícil de vencer?');
  }
  if (narrTokens(obstaculo).length < 3) {
    return _check('obstaculo', 'fraco',
      'O obstáculo está genérico demais.',
      'Nomeie a força que impede. "Falta de tempo" é vago; "trabalha em dois turnos e só tem os domingos" é um obstáculo.');
  }
  if (narrNorm(obstaculo) === narrNorm(desejo)) {
    return _check('obstaculo', 'fraco',
      'O obstáculo repete o desejo com outras palavras.',
      'O obstáculo é a força CONTRÁRIA ao desejo — não a sua descrição.');
  }
  return _check('obstaculo', 'ok', 'Existe uma força real se opondo ao desejo.', '');
}

function narrAvaliarRisco(risco, desejo) {
  if (!String(risco || '').trim() || narrEhAusencia(risco)) {
    return _check('risco', 'faltando',
      'Não há nada em jogo.',
      'Se ele não arrisca nada, não há tensão: quem assiste não tem motivo para torcer. O que ele perde se der errado?');
  }
  if (narrTokens(risco).length < 2) {
    return _check('risco', 'fraco',
      'O risco está curto demais para pesar.',
      'Diga o que se perde — dinheiro, tempo, uma relação, a reputação, a chance de tentar de novo.');
  }
  if (!narrContemAlgum(risco, NARR_APOSTA)) {
    return _check('risco', 'fraco',
      'O risco não deixa claro o que se perde.',
      'Escreva a perda, não a dificuldade: "pode perder…", "abre mão de…", "fica sem…".');
  }
  if (narrNorm(risco) === narrNorm(desejo)) {
    return _check('risco', 'fraco',
      'O risco repete o desejo.',
      'O risco é o preço de tentar — o que fica para trás se ele seguir em frente e falhar.');
  }
  return _check('risco', 'ok', 'Há um preço declarado — a história tem tensão.', '');
}

/**
 * Diagnostica uma narrativa contra o lema. Função PURA: mesma entrada, mesmo
 * veredito, sem rede e sem DOM (é por isso que ela é testável e funciona
 * offline). Devolve o veredito, o placar e o parecer de cada pergunta.
 *
 * @param {{protagonista?:string, desejo?:string, obstaculo?:string, risco?:string, ideia?:string}} n
 */
function diagnosticarNarrativa(n) {
  const dados = n || {};
  const protagonista = String(dados.protagonista || '').trim();
  const desejo = String(dados.desejo || '').trim();
  const obstaculo = String(dados.obstaculo || '').trim();
  const risco = String(dados.risco || '').trim();
  const ideia = String(dados.ideia || '').trim();

  const perguntas = [
    narrAvaliarDesejo(desejo),
    narrAvaliarObstaculo(obstaculo, desejo),
    narrAvaliarRisco(risco, desejo),
  ];

  /* Avisos: não travam a produção, mas custam pontos. Só entram aqui defeitos
     DECIDÍVEIS pelo texto — ausência de campo, repetição literal. Uma versão
     anterior tentava medir por palavras em comum se o obstáculo "conversava"
     com o desejo; acusava histórias boas (um desejo bem escrito e seu obstáculo
     quase nunca dividem vocabulário: "reabrir a padaria" × "o imóvel foi
     penhorado"). Julgar relação de sentido é tarefa semântica — fica com o
     "Afiar com IA", não com um contador de palavras que erra contra o usuário. */
  const avisos = [];
  if (!protagonista) {
    avisos.push('Ninguém está no comando: o lema diz que existe ALGUÉM querendo alcançar um objetivo. Diga quem é o protagonista — pode ser você, um personagem ou quem assiste.');
  }
  if (ideia && desejo && narrNorm(ideia) === narrNorm(desejo)) {
    avisos.push('O desejo está copiado da ideia bruta. A ideia é a situação; o desejo é o que alguém quer arrancar dela.');
  }
  if (obstaculo && risco && narrNorm(obstaculo) === narrNorm(risco)) {
    avisos.push('O obstáculo e o risco estão iguais. São coisas diferentes: o obstáculo é o que impede de conseguir; o risco é o que se perde por tentar.');
  }
  const elenco = narrElenco(dados);
  narrAvisosElenco(elenco, narrFormato(dados.formatoId), protagonista).forEach((a) => avisos.push(a));

  let score = 100;
  perguntas.forEach((p) => {
    if (p.status === 'faltando') score -= 34;
    else if (p.status === 'fraco') score -= 14;
  });
  score -= avisos.length * 6;
  score = Math.max(0, Math.min(100, score));

  const faltando = perguntas.filter((p) => p.status === 'faltando');
  const fracos = perguntas.filter((p) => p.status === 'fraco');
  const veredito = faltando.length ? 'situacao' : 'historia';

  let resumo;
  if (faltando.length) {
    const nomes = faltando.map((p) => p.papel.toLowerCase()).join(', ');
    resumo = `Ainda é uma situação, não uma história — falta responder: ${nomes}.`;
  } else if (fracos.length) {
    resumo = 'Você tem uma história. Ela funciona — e fica mais forte se você apertar os pontos abaixo.';
  } else {
    resumo = 'Você tem uma história: alguém quer algo, alguma coisa impede e há um preço a pagar.';
  }

  return { veredito, pronto: veredito === 'historia', score, perguntas, avisos, resumo, elenco: elenco.length };
}

/* -------------------------------------------------------------------------- */
/* §4 — Prompts                                                                */
/* -------------------------------------------------------------------------- */

function narrFormato(id) {
  return NARR_FORMATOS.find((f) => f.id === id) || NARR_FORMATOS[0];
}
function narrTom(id) {
  return NARR_TONS.find((t) => t.id === id) || NARR_TONS[0];
}
function narrTamanho(id) {
  return NARR_TAMANHOS.find((t) => t.id === id) || NARR_TAMANHOS[1];
}

/** Bloco comum a todos os prompts: a doutrina que governa a escrita. */
function narrBlocoLema() {
  return ['== DOUTRINA (regra inegociável deste trabalho) ==', NARR_LEMA].join('\n');
}

/** Bloco com a estrutura da história já validada. */
function narrBlocoHistoria(n) {
  const linhas = ['== A HISTÓRIA =='];
  if (n.protagonista) linhas.push(`Protagonista: ${n.protagonista}`);
  linhas.push(`Desejo (o que quer): ${n.desejo}`);
  linhas.push(`Obstáculo (o que impede): ${n.obstaculo}`);
  linhas.push(`Risco (o que arrisca): ${n.risco}`);
  if (n.ideia) linhas.push(`Material bruto / contexto: ${n.ideia}`);
  if (n.publico) linhas.push(`Para quem: ${n.publico}`);
  return linhas.join('\n');
}

/** Bloco do elenco. Só existe quando há elenco — sem personagens, nem o
 *  cabeçalho entra (um cabeçalho vazio convida o modelo a preencher). */
function narrBlocoElenco(n) {
  const elenco = narrElenco(n);
  if (!elenco.length) return '';
  const linhas = ['== ELENCO (além do protagonista) =='];
  elenco.forEach((p) => {
    const papel = narrPapel(p.papel);
    const nome = String(p.nome || '').trim() || 'Personagem sem nome';
    const quer = String(p.quer || '').trim();
    linhas.push(`- ${nome} — ${papel.label}: ${papel.desc}${quer ? ` Quer: ${quer}` : ' (o que essa pessoa quer não foi declarado — não invente; mantenha-a em segundo plano.)'}`);
  });
  linhas.push('');
  linhas.push('REGRAS DO ELENCO:');
  linhas.push('- O centro continua sendo o protagonista: é o desejo DELE que impulsiona a narrativa. Ninguém do elenco toma a história para si.');
  linhas.push('- Cada personagem só entra na cena em que afeta o desejo, o obstáculo ou o risco do protagonista. Quem não afeta, não aparece.');
  linhas.push('- O conflito nasce do choque entre o que o protagonista quer e o que os outros querem — não de mal-entendido nem de coincidência.');
  linhas.push('- Não crie personagens além dos listados. Figurantes necessários ficam sem nome ("o fiscal", "a vizinha").');
  linhas.push('- Use os nomes exatamente como estão escritos acima.');
  return linhas.join('\n');
}

/**
 * Prompt de PRODUÇÃO: transforma a estrutura validada em conteúdo publicável.
 * O lema entra como regra de escrita — não como enfeite —, e a estrutura do
 * formato define onde cada elemento cai no tempo.
 */
function buildNarrativaPrompt(opcoes) {
  const o = opcoes || {};
  const n = o.narrativa || {};
  const f = narrFormato(o.formatoId);
  const t = narrTom(o.tomId);
  const tam = narrTamanho(o.tamanhoId);
  const perfil = o.perfil || null;

  const linhas = [];
  linhas.push('Você é roteirista e redator de conteúdo digital. Escreva em português do Brasil.');
  linhas.push('');
  linhas.push(narrBlocoLema());
  linhas.push('');
  linhas.push(narrBlocoHistoria(n));
  const elenco = narrBlocoElenco(n);
  if (elenco) { linhas.push(''); linhas.push(elenco); }
  linhas.push('');
  linhas.push(`== FORMATO: ${f.label} ==`);
  linhas.push(f.desc);
  f.estrutura.forEach((e) => linhas.push('- ' + e));
  linhas.push('');
  linhas.push(`== TOM: ${t.label} ==`);
  linhas.push(t.desc);
  linhas.push(`Extensão: ${tam.label} — ${tam.desc}`);
  if (perfil && (perfil.name || perfil.handle || perfil.tagline)) {
    linhas.push('');
    linhas.push('== PERFIL QUE PUBLICA ==');
    if (perfil.name) linhas.push(`Nome: ${perfil.name}`);
    if (perfil.handle) linhas.push(`@: ${perfil.handle}`);
    if (perfil.tagline) linhas.push(`Assinatura editorial: ${perfil.tagline}`);
    linhas.push('Escreva na voz desse perfil, sem citar estes dados literalmente.');
  }
  if (o.cta) {
    linhas.push('');
    linhas.push(`== AÇÃO DESEJADA NO FIM ==\n${o.cta}`);
  }
  linhas.push('');
  linhas.push('== REGRAS DE EXECUÇÃO ==');
  linhas.push('1. O desejo tem de aparecer nos primeiros segundos/linhas. É ele que impulsiona tudo.');
  linhas.push('2. O obstáculo NÃO pode ser resolvido por acaso, por sorte nem com facilidade — isso apaga o conflito.');
  linhas.push('3. O que está em jogo precisa ser dito com todas as letras em algum momento.');
  linhas.push('4. Use apenas os fatos da história acima. Não invente números, nomes, datas nem citações.');
  linhas.push('5. Nada de clichê de abertura ("você já parou para pensar", "hoje eu vou falar sobre", "prepare-se").');
  linhas.push('6. Frases curtas. Voz ativa. Corte qualquer adjetivo que não mude o sentido.');
  linhas.push('7. No máximo 2 emojis no total, e só se o tom pedir.');
  if (elenco) {
    linhas.push('8. Todo personagem citado tem de estar no elenco acima, com o nome escrito igual. Ninguém novo entra com nome próprio.');
    linhas.push('9. Devolva SOMENTE o conteúdo final, seguindo a estrutura do formato. Sem introdução, sem explicação, sem comentário sobre o texto.');
  } else {
    linhas.push('8. Devolva SOMENTE o conteúdo final, seguindo a estrutura do formato. Sem introdução, sem explicação, sem comentário sobre o texto.');
  }

  return { prompt: linhas.join('\n'), formato: f, tom: t, tamanho: tam };
}

/**
 * Prompt de EXTRAÇÃO: lê a ideia bruta e tenta responder às três perguntas.
 * Instrução central: deixar VAZIO o que a ideia não sustenta. O valor da
 * ferramenta está em mostrar o buraco, não em preenchê-lo com invenção.
 */
function buildExtracaoNarrativaPrompt(ideia) {
  return [
    'Você analisa ideias de conteúdo e identifica se existe uma história dentro delas.',
    '',
    narrBlocoLema(),
    '',
    '== IDEIA BRUTA ==',
    String(ideia || '').trim(),
    '',
    '== TAREFA ==',
    'Leia a ideia e responda às três perguntas do lema com base APENAS no que está escrito.',
    'Identifique também as OUTRAS pessoas que aparecem na ideia e o papel de cada uma em relação ao objetivo do protagonista.',
    'REGRA CRÍTICA: se a ideia não permitir responder alguma pergunta, devolva string vazia ("") naquele campo.',
    'NÃO invente desejo, obstáculo, risco nem personagens que não estejam no material. Um campo vazio é uma resposta útil — uma invenção não é.',
    'Só entra no elenco quem age sobre o objetivo do protagonista. Quem é apenas mencionado de passagem fica de fora.',
    'O protagonista NÃO entra no elenco.',
    '',
    'Papéis possíveis (use exatamente um destes identificadores):',
    NARR_PAPEIS.map((p) => `  ${p.id} — ${p.desc}`).join('\n'),
    '',
    'Devolva SOMENTE um objeto JSON, sem cercas de código e sem comentários, neste formato:',
    '{',
    '  "protagonista": "quem deseja algo (uma linha)",',
    '  "desejo": "o objetivo concreto, começando por verbo",',
    '  "obstaculo": "a força que impede esse objetivo",',
    '  "risco": "o que essa pessoa perde se falhar",',
    '  "elenco": [{ "nome": "", "papel": "antagonista", "quer": "" }],',
    '  "falta": "em uma frase, o que a ideia ainda não responde (ou string vazia)"',
    '}',
    'Se não houver mais ninguém além do protagonista, devolva "elenco": [].',
  ].join('\n');
}

/**
 * Prompt de AFIAÇÃO: pega respostas que já existem e as torna mais concretas,
 * além de propor uma escalada de obstáculos (o conflito precisa PIORAR).
 */
function buildAfiacaoNarrativaPrompt(n) {
  const d = n || {};
  return [
    'Você é editor de histórias. Seu trabalho é tornar respostas vagas em respostas concretas.',
    '',
    narrBlocoLema(),
    '',
    narrBlocoHistoria({
      protagonista: d.protagonista || '',
      desejo: d.desejo || '',
      obstaculo: d.obstaculo || '',
      risco: d.risco || '',
      ideia: d.ideia || '',
      publico: d.publico || '',
    }),
    narrBlocoElenco(d),
    '',
    '== TAREFA ==',
    'Reescreva as três respostas mantendo os MESMOS fatos, porém mais concretas: com objeto, prazo e consequência visíveis.',
    'Não troque a história por outra. Não acrescente fatos novos — só torne explícito o que já está implícito.',
    'Proponha também uma escalada: três obstáculos em ordem crescente de dificuldade, mostrando que o caminho fica pior antes de melhorar.',
    // Julgar se um personagem serve à história é tarefa de sentido, não de
    // contagem de palavras — por isso mora aqui, no agente que lê, e não no
    // diagnóstico local, que só afirma o que é decidível pelo texto.
    'Sobre o ELENCO (se houver): para cada personagem, diga em uma frase o que ele faz COM o objetivo do protagonista — empurra, trava, cobra um preço ou observa.',
    'Se algum personagem não afetar o desejo, o obstáculo nem o risco do protagonista, aponte-o como dispensável. Não invente personagem novo.',
    '',
    'Devolva SOMENTE um objeto JSON, sem cercas de código, neste formato:',
    '{',
    '  "desejo": "versão mais concreta",',
    '  "obstaculo": "versão mais concreta",',
    '  "risco": "versão mais concreta",',
    '  "escalada": ["obstáculo 1", "obstáculo 2 (pior)", "obstáculo 3 (o pior)"],',
    '  "elenco": [{ "nome": "igual ao recebido", "funcao": "o que faz com o objetivo do protagonista", "dispensavel": false }],',
    '  "porque": "em uma frase, o que ficou mais forte"',
    '}',
  ].join('\n');
}

/* -------------------------------------------------------------------------- */
/* §5 — Estado: rascunho e histórico                                           */
/* -------------------------------------------------------------------------- */

function narrativaVazia() {
  return {
    ideia: '', protagonista: '', desejo: '', obstaculo: '', risco: '',
    elenco: [],                 // personagens além do protagonista
    publico: '', formatoId: 'reels', tomId: 'direto', tamanhoId: 'medio',
    perfilIndex: -1, cta: '',   // -1 = nenhum perfil (os perfis começam vazios)
  };
}

/** Linha nova do elenco. O papel padrão é "antagonista" porque é o que a
 *  maioria das histórias precisa primeiro — quem se opõe ao desejo. */
function narrPersonagemNovo() {
  return { id: uuid(), nome: '', papel: 'antagonista', quer: '' };
}

/** Rascunho atual (o que está nos campos). Persistido a cada digitação para
 *  que trocar de ferramenta — ou fechar o app — nunca custe o trabalho. */
function narrativaDraft() {
  if (!State.narrativaDraft) State.narrativaDraft = narrativaVazia();
  // Migração: rascunhos e histórias salvos antes do elenco não têm o campo.
  // Sem isto, a primeira leitura de um rascunho antigo quebraria o render.
  if (!Array.isArray(State.narrativaDraft.elenco)) State.narrativaDraft.elenco = [];
  return State.narrativaDraft;
}
function saveNarrativaDraft() {
  saveJSON(STORAGE_KEYS.narrativaDraft, State.narrativaDraft || narrativaVazia());
}
function saveNarrativas() {
  saveJSON(STORAGE_KEYS.narrativas, State.narrativas || []);
}

/** Título curto para o histórico: o desejo é o que identifica a história. */
function narrativaTitulo(n) {
  const base = (n && (n.desejo || n.ideia || n.protagonista)) || 'História sem título';
  return truncate(String(base).replace(/\s+/g, ' ').trim(), 70);
}

/* -------------------------------------------------------------------------- */
/* §6 — Interface                                                              */
/* -------------------------------------------------------------------------- */

const NARR_CAMPOS = ['ideia', 'protagonista', 'desejo', 'obstaculo', 'risco', 'publico', 'cta'];

/** Lê os campos da tela para dentro do rascunho (e persiste). */
function narrColetar() {
  const d = narrativaDraft();
  NARR_CAMPOS.forEach((c) => {
    const el = $('#n-' + c);
    if (el) d[c] = el.value;
  });
  ['formatoId', 'tomId', 'tamanhoId'].forEach((c) => {
    const el = $('#n-' + c);
    if (el) d[c] = el.value;
  });
  const perfil = $('#n-perfil');
  if (perfil) {
    const i = parseInt(perfil.value, 10);
    d.perfilIndex = Number.isNaN(i) ? -1 : i;
  }
  saveNarrativaDraft();
  return d;
}

/** Escreve o rascunho nos campos da tela. */
function narrPreencher() {
  const d = narrativaDraft();
  NARR_CAMPOS.forEach((c) => {
    const el = $('#n-' + c);
    if (el) el.value = d[c] || '';
  });
  ['formatoId', 'tomId', 'tamanhoId'].forEach((c) => {
    const el = $('#n-' + c);
    if (el && d[c]) el.value = d[c];
  });
  const perfil = $('#n-perfil');
  if (perfil) perfil.value = String(typeof d.perfilIndex === 'number' ? d.perfilIndex : -1);
  narrAtualizarDescricoes();
}

/** Sincroniza as legendas de formato/tom/extensão com o que os selects mostram.
 *  Mora junto de narrPreencher (que é quem escreve os selects a partir do
 *  modelo) porque toda vez que os dois saíram de sincronia foi por alguém
 *  trocar o valor sem repintar a legenda — reabrir do histórico mostrava o
 *  formato certo com a descrição do formato anterior. */
function narrAtualizarDescricoes() {
  const par = [
    ['#n-formatoId', '#n-formato-desc', narrFormato],
    ['#n-tomId', '#n-tom-desc', narrTom],
    ['#n-tamanhoId', '#n-tamanho-desc', narrTamanho],
  ];
  par.forEach(([sel, alvo, resolve]) => {
    const s = $(sel), a = $(alvo);
    if (s && a) a.textContent = resolve(s.value).desc;
  });
}

/* ----- Elenco: lista editável -----
   A lista é pintada UMA vez por mudança estrutural (adicionar/remover/carregar).
   Digitar num campo NÃO repinta a lista: o handler escreve direto no modelo e só
   o diagnóstico é redesenhado. Repintar a cada tecla arrancaria o foco do campo
   e o usuário perderia a posição do cursor a cada letra. */
function renderNarrElenco() {
  const host = $('#n-elenco-list');
  if (!host) return;
  const d = narrativaDraft();
  const lista = d.elenco;

  if (!lista.length) {
    host.innerHTML = `
      <div class="narr-cast-empty">
        Só o protagonista, por enquanto. Adicione quem empurra, trava ou cobra um preço — e o que essa pessoa quer.
      </div>`;
    return;
  }

  const opcoes = (sel) => NARR_PAPEIS.map((p) =>
    `<option value="${p.id}"${p.id === sel ? ' selected' : ''}>${escapeHtml(p.label)}</option>`).join('');

  host.innerHTML = lista.map((p, i) => `
    <div class="narr-cast" data-cast="${i}">
      <div class="narr-cast-row">
        <input class="input narr-cast-nome" data-cast-campo="nome" placeholder="Nome"
               value="${escapeHtml(p.nome || '')}" aria-label="Nome do personagem ${i + 1}" />
        <select class="select narr-cast-papel" data-cast-campo="papel" aria-label="Papel do personagem ${i + 1}">
          ${opcoes(p.papel)}
        </select>
        <button type="button" class="btn btn-ghost btn-sm narr-cast-del" data-cast-del="${i}"
                title="Remover personagem" aria-label="Remover personagem ${i + 1}">✕</button>
      </div>
      <input class="input" data-cast-campo="quer" placeholder="O que essa pessoa quer?"
             value="${escapeHtml(p.quer || '')}" aria-label="Desejo do personagem ${i + 1}" />
      <div class="narr-cast-hint">${escapeHtml(narrPapel(p.papel).desc)}</div>
    </div>`).join('');

  host.querySelectorAll('.narr-cast').forEach((linha) => {
    const i = parseInt(linha.dataset.cast, 10);
    linha.querySelectorAll('[data-cast-campo]').forEach((campo) => {
      const chave = campo.dataset.castCampo;
      const atualizar = () => {
        if (!d.elenco[i]) return;
        d.elenco[i][chave] = campo.value;
        // O papel muda a dica exibida; nome e desejo não mexem no layout.
        if (chave === 'papel') {
          const dica = linha.querySelector('.narr-cast-hint');
          if (dica) dica.textContent = narrPapel(campo.value).desc;
        }
        renderNarrDiagnostico();   // já persiste (narrColetar)
      };
      campo.addEventListener(chave === 'papel' ? 'change' : 'input', atualizar);
    });
  });

  host.querySelectorAll('[data-cast-del]').forEach((b) => {
    b.onclick = () => {
      const i = parseInt(b.dataset.castDel, 10);
      d.elenco.splice(i, 1);
      saveNarrativaDraft();
      renderNarrElenco();
      renderNarrDiagnostico();
    };
  });
}

function narrAdicionarPersonagem(dados) {
  const d = narrativaDraft();
  d.elenco.push(Object.assign(narrPersonagemNovo(), dados || {}));
  saveNarrativaDraft();
  renderNarrElenco();
  renderNarrDiagnostico();
  // Leva o cursor direto ao nome recém-criado: adicionar e ter de clicar no
  // campo é um passo a mais em toda vez que se monta um elenco.
  const campos = $$('#n-elenco-list .narr-cast-nome');
  const ultimo = campos[campos.length - 1];
  if (ultimo && !dados) ultimo.focus();
}

function narrStatusIcone(status) {
  if (status === 'ok') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
  }
  if (status === 'fraco') {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="8" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>';
  }
  return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>';
}

/** Pinta o diagnóstico e habilita/desabilita a produção de conteúdo. */
function renderNarrDiagnostico() {
  const host = $('#n-diag');
  if (!host) return null;
  const d = narrColetar();
  const diag = diagnosticarNarrativa(d);

  // TELA VAZIA NÃO LEVA VEREDITO. Abrir a ferramenta e receber "SITUAÇÃO" com
  // três X vermelhos é a mesma intimidação que os cinco campos em branco
  // causavam: o usuário ainda não escreveu nada, não há o que diagnosticar. O
  // painel entra quando existe matéria-prima — e aí ele ajuda, em vez de
  // repreender.
  const vazia = !String(d.ideia || '').trim() && !String(d.desejo || '').trim()
    && !String(d.obstaculo || '').trim() && !String(d.risco || '').trim();
  if (vazia) {
    host.innerHTML = '';
    const btn0 = $('#n-submit');
    if (btn0) { btn0.disabled = false; btn0.title = ''; }
    if (typeof renderNarrPerguntaFoco === 'function') renderNarrPerguntaFoco(diag);
    return diag;
  }

  const checks = diag.perguntas.map((p) => `
    <div class="narr-check narr-${p.status}">
      <span class="narr-check-icon">${narrStatusIcone(p.status)}</span>
      <div class="narr-check-body">
        <div class="narr-check-q">${escapeHtml(p.pergunta)}</div>
        <div class="narr-check-msg">${escapeHtml(p.mensagem)}</div>
        ${p.dica ? `<div class="narr-check-tip">${escapeHtml(p.dica)}</div>` : ''}
      </div>
    </div>`).join('');

  const avisos = diag.avisos.length
    ? `<ul class="narr-avisos">${diag.avisos.map((a) => `<li>${escapeHtml(a)}</li>`).join('')}</ul>`
    : '';

  host.innerHTML = `
    <div class="narr-verdict narr-verdict-${diag.veredito}">
      <div class="narr-verdict-head">
        <span class="badge ${diag.veredito === 'historia' ? 'success' : 'danger'}">
          ${diag.veredito === 'historia' ? 'História' : 'Situação'}
        </span>
        <span class="narr-score">${diag.score}<span class="narr-score-max">/100</span></span>
      </div>
      <div class="narr-verdict-text">${escapeHtml(diag.resumo)}</div>
      <div class="narr-meter" role="img" aria-label="Força da história: ${diag.score} de 100">
        <div class="narr-meter-fill" style="width:${diag.score}%"></div>
      </div>
    </div>
    <div class="narr-checks">${checks}</div>
    ${avisos}`;

  // O BOTÃO NÃO TRAVA MAIS. A trava existia para impedir que a ferramenta
  // escrevesse sobre uma situação — o que continua valendo —, mas ela cobrava
  // isso do jeito mais caro possível: cinco campos em branco e um botão morto,
  // sem dizer como sair dali. Agora quem responde as três perguntas primeiro é
  // a IA, lendo a ideia; se ainda faltar alguma, a ferramenta pergunta UMA
  // coisa, na hora do clique. O lema continua inteiro — muda quem carrega o
  // peso de satisfazê-lo.
  const btn = $('#n-submit');
  if (btn) { btn.disabled = false; btn.title = ''; }
  const hint = $('#n-submit-hint');
  if (hint) hint.textContent = '⌘/Ctrl + Enter';
  if (typeof renderNarrPerguntaFoco === 'function') renderNarrPerguntaFoco(diag);
  return diag;
}

/* PERGUNTA FOCADA — o substituto do formulário.
 *
 * Quando falta uma das três respostas, a ferramenta mostra UMA pergunta, com o
 * texto do lema que explica por que ela importa, e um campo só. Responder ali
 * grava no rascunho e segue. Cinco campos vazios de uma vez é o que fazia a
 * ferramenta parecer difícil; uma pergunta por vez é uma conversa. */
function renderNarrPerguntaFoco(diag) {
  const alvo = $('#n-pergunta-foco');
  if (!alvo) return;
  const falta = (diag.perguntas || []).find((q) => q.status === 'faltando');
  // Só cobra depois que existe matéria-prima. Numa tela vazia, uma pergunta
  // aberta é exatamente o formulário que esta mudança veio eliminar.
  const temIdeia = String(narrativaDraft().ideia || '').trim().length >= 12;
  if (!falta || !temIdeia) { alvo.innerHTML = ''; return; }
  const campo = falta.id;
  alvo.innerHTML = `
    <div class="narr-foco">
      <div class="narr-foco-tit">${escapeHtml(falta.pergunta || falta.papel)}</div>
      <div class="narr-foco-dica">${escapeHtml(falta.dica || falta.mensagem || '')}</div>
      <textarea class="textarea textarea-answer" id="n-foco-input" rows="2"
        placeholder="${escapeHtml(falta.dica || 'Responda em uma linha')}"></textarea>
      <button type="button" class="btn btn-sm" id="n-foco-ok">Pronto, continuar</button>
    </div>`;
  const input = $('#n-foco-input');
  const ok = $('#n-foco-ok');
  const gravar = () => {
    const v = String(input.value || '').trim();
    if (!v) { toast('Escreva uma linha para continuar.', 'error'); return; }
    const d = narrativaDraft();
    d[campo] = v;
    const espelho = $('#n-' + campo);
    if (espelho) espelho.value = v;
    saveNarrativaDraft();
    renderNarrDiagnostico();
  };
  if (ok) ok.onclick = gravar;
  if (input) input.onkeydown = (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); gravar(); } };
}

/** Preenche os campos com o que a IA devolveu, respeitando o que já existe
 *  (nunca sobrescreve resposta do usuário sem ele pedir). */
function narrAplicarSugestao(obj, opcoes) {
  const forcar = !!(opcoes && opcoes.forcar);
  const d = narrativaDraft();
  let mudou = 0;
  ['protagonista', 'desejo', 'obstaculo', 'risco'].forEach((c) => {
    const valor = String((obj && obj[c]) || '').trim();
    if (!valor) return;
    if (!forcar && String(d[c] || '').trim()) return;
    d[c] = valor;
    const el = $('#n-' + c);
    if (el) el.value = valor;
    mudou++;
  });

  // Elenco sugerido: só entra se o usuário ainda não montou o dele. Mesclar
  // duas listas de personagens automaticamente geraria duplicatas silenciosas
  // ("Marlene" e "Dona Marlene") — pior do que não sugerir nada.
  const sugerido = Array.isArray(obj && obj.elenco) ? obj.elenco : [];
  if (sugerido.length && !narrElenco(d).length) {
    const papeisValidos = NARR_PAPEIS.map((x) => x.id);
    d.elenco = sugerido
      .filter((p) => p && String(p.nome || '').trim())
      .slice(0, 6)
      .map((p) => Object.assign(narrPersonagemNovo(), {
        nome: String(p.nome).trim(),
        papel: papeisValidos.indexOf(p.papel) !== -1 ? p.papel : 'antagonista',
        quer: String(p.quer || '').trim(),
      }));
    mudou += d.elenco.length;
    renderNarrElenco();
  }

  saveNarrativaDraft();
  renderNarrDiagnostico();
  return mudou;
}

/** Ação de IA com estado de botão — as três chamadas (extrair, afiar, escrever)
 *  compartilham o mesmo tratamento de erro e de carregamento. */
async function narrChamarIA(btn, rotuloCarregando, prompt) {
  const original = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> ${escapeHtml(rotuloCarregando)}`;
  try {
    return await callLLM(prompt);
  } finally {
    btn.disabled = false;
    btn.innerHTML = original;
  }
}

/** Parecer do "Afiar" sobre o elenco: o que cada personagem faz com o objetivo
 *  do protagonista, e quem sobra. É a checagem de sentido que o diagnóstico
 *  local não pode fazer — por isso vem rotulada como opinião da IA, e nada é
 *  removido automaticamente: cortar personagem é decisão de quem escreve. */
function narrParecerElenco(lista) {
  const itens = (Array.isArray(lista) ? lista : [])
    .filter((p) => p && String(p.nome || '').trim());
  if (!itens.length) return '';
  return `
    <div class="narr-escalada">
      <div class="narr-escalada-title">O que cada personagem faz pela história</div>
      <ul class="narr-parecer">${itens.map((p) => `
        <li${p.dispensavel ? ' class="narr-parecer-corta"' : ''}>
          <strong>${escapeHtml(String(p.nome).trim())}</strong>${p.funcao ? ' — ' + escapeHtml(String(p.funcao)) : ''}
          ${p.dispensavel ? '<span class="badge warn">pode sair</span>' : ''}
        </li>`).join('')}</ul>
      <div class="text-xs text-mute">Leitura da IA sobre o elenco que você montou. Nada foi removido — a decisão é sua.</div>
    </div>`;
}

function narrEscalada(lista) {
  const itens = (Array.isArray(lista) ? lista : []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!itens.length) return '';
  return `
    <div class="narr-escalada">
      <div class="narr-escalada-title">Escalada de obstáculos — o conflito precisa piorar</div>
      <ol>${itens.map((i) => `<li>${escapeHtml(i)}</li>`).join('')}</ol>
      <div class="text-xs text-mute">Sugestão da IA sobre a sua própria história. Use como próximo beat, não como substituição.</div>
    </div>`;
}

function renderNarrResultado(item) {
  const area = $('#n-result-area');
  if (!area) return;
  const badge = $('#n-result-badge');
  if (badge) badge.innerHTML = '<span class="badge success">Pronto</span>';
  setMtab('#view-narrativa', 'b');
  area.innerHTML = `
    <div class="article-preview" id="n-result-content">${escapeHtml(item.conteudo)}</div>
    <div class="flex gap-1 flex-wrap mt-2">
      <button class="btn btn-ghost btn-sm" id="n-result-copy">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
        Copiar
      </button>
      <button class="btn btn-ghost btn-sm" id="n-result-edit">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
        Editar
      </button>
      <button class="btn btn-danger btn-sm" id="n-result-delete" title="Excluir do histórico">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </button>
    </div>
    ${typeof sendToBarHtml === 'function' ? sendToBarHtml(['narrativa']) : ''}
    <div class="text-xs text-mute mt-2">
      ${escapeHtml(item.formato)} · ${escapeHtml(item.tom)}${item.model ? ' · ' + escapeHtml(item.model) : ''}
    </div>`;

  if (typeof wireSendTo === 'function') wireSendTo(area, () => item.conteudo);

  $('#n-result-copy').onclick = () => {
    navigator.clipboard.writeText(item.conteudo);
    toast('Conteúdo copiado.', 'success');
  };
  $('#n-result-edit').onclick = () => {
    const atual = $('#n-result-content');
    const ta = document.createElement('textarea');
    ta.className = 'textarea textarea-serif';
    ta.style.minHeight = '320px';
    ta.value = item.conteudo;
    atual.replaceWith(ta);
    $('#n-result-edit').outerHTML = '<button class="btn btn-primary btn-sm" id="n-result-save">Salvar</button>';
    $('#n-result-save').onclick = () => {
      item.conteudo = ta.value;
      saveNarrativas();
      renderNarrResultado(item);
      if (typeof renderNarrHistorico === 'function') renderNarrHistorico();
      toast('Conteúdo atualizado.', 'success');
    };
  };
  $('#n-result-delete').onclick = () => {
    if (!confirm('Remover este conteúdo do histórico?')) return;
    State.narrativas = (State.narrativas || []).filter((x) => x.id !== item.id);
    saveNarrativas();
    narrLimparResultado();
    renderNarrHistorico();
    toast('Removido.', 'success');
  };
}

function narrLimparResultado() {
  const badge = $('#n-result-badge');
  if (badge) badge.innerHTML = '';
  const area = $('#n-result-area');
  if (!area) return;
  area.innerHTML = `
    <div class="empty">
      <div class="empty-icon">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
      </div>
      <div class="empty-title">Aguardando</div>
      <div class="empty-desc">Responda às três perguntas e o conteúdo aparece aqui, no formato da plataforma que você escolher.</div>
    </div>`;
}

/* ----- Histórico ----- */

function renderNarrHistorico() {
  const lista = $('#n-history-list');
  if (!lista) return;
  const itens = State.narrativas || [];
  if (!itens.length) {
    lista.innerHTML = '<div class="text-sm text-mute" style="padding:0.5rem;">Nada salvo ainda.</div>';
    return;
  }
  lista.innerHTML = itens.map((it) => `
    <div class="list-item" data-narr-id="${escapeHtml(it.id)}" role="button" tabindex="0">
      <div class="list-item-header">
        <div class="list-item-title">${escapeHtml(it.titulo || 'História')}</div>
        <button class="list-item-del" data-narr-del="${escapeHtml(it.id)}" title="Excluir" aria-label="Excluir">✕</button>
      </div>
      <div class="list-item-meta">${escapeHtml(it.formato || '')} · ${escapeHtml(formatDate(it.createdAt))}</div>
    </div>`).join('');

  lista.querySelectorAll('[data-narr-id]').forEach((el) => {
    const abrir = () => {
      const it = (State.narrativas || []).find((x) => x.id === el.dataset.narrId);
      if (!it) return;
      // Reabrir devolve a história INTEIRA aos campos: o conteúdo sozinho não
      // permitiria refazer/variar sem redigitar as três respostas.
      State.narrativaDraft = Object.assign(narrativaVazia(), it.narrativa || {});
      saveNarrativaDraft();
      narrPreencher();
      renderNarrElenco();
      renderNarrDiagnostico();
      renderNarrResultado(it);
      fecharNarrHistorico();
    };
    el.onclick = (e) => { if (!e.target.closest('[data-narr-del]')) abrir(); };
    el.onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); abrir(); } };
  });
  lista.querySelectorAll('[data-narr-del]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      State.narrativas = (State.narrativas || []).filter((x) => x.id !== b.dataset.narrDel);
      saveNarrativas();
      renderNarrHistorico();
    };
  });
}

function abrirNarrHistorico() {
  renderNarrHistorico();
  const d = $('#n-history-drawer'), b = $('#n-history-backdrop');
  if (d) d.classList.add('open');
  if (b) b.classList.remove('hidden');
}
function fecharNarrHistorico() {
  const d = $('#n-history-drawer'), b = $('#n-history-backdrop');
  if (d) d.classList.remove('open');
  if (b) b.classList.add('hidden');
}

/* ----- Montagem da view ----- */

let _narrWired = false;

function renderNarrativa() {
  wireMtabs('#view-narrativa');

  // Texto do lema (fonte única) — pintado uma vez.
  const lema = $('#n-lema-text');
  if (lema && !lema.textContent.trim()) lema.textContent = NARR_LEMA;

  // Catálogos
  const fSel = $('#n-formatoId');
  if (fSel && !fSel.options.length) {
    fSel.innerHTML = NARR_FORMATOS.map((f) => `<option value="${f.id}">${escapeHtml(f.label)}</option>`).join('');
    $('#n-tomId').innerHTML = NARR_TONS.map((t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join('');
    $('#n-tamanhoId').innerHTML = NARR_TAMANHOS.map((t) => `<option value="${t.id}">${escapeHtml(t.label)}</option>`).join('');
  }

  // Perfis da plataforma (mesmos das outras ferramentas) — a voz de quem publica.
  const pSel = $('#n-perfil');
  if (pSel) {
    const perfis = State.portals || [];
    pSel.innerHTML = '<option value="-1">Nenhum</option>' + perfis.map((p, i) =>
      `<option value="${i}">${escapeHtml(p.name || `Perfil ${i + 1}`)}</option>`).join('');
  }

  // Handoff: texto vindo de outra ferramenta entra como IDEIA BRUTA — nunca
  // como resposta pronta (o material de origem é justamente a situação que
  // ainda precisa virar história). As três respostas já escritas NÃO são
  // apagadas: perder o trabalho do usuário em silêncio seria pior do que a
  // mistura. Em vez disso, avisamos que elas continuam de pé.
  if (State.handoff && State.handoff.target === 'narrativa') {
    const d = narrativaDraft();
    const tinhaRespostas = !!(d.desejo || d.obstaculo || d.risco);
    d.ideia = State.handoff.text || '';
    State.handoff = null;
    saveNarrativaDraft();
    if (tinhaRespostas) {
      toast('Material recebido em "A ideia". As respostas anteriores continuam preenchidas — use "Limpar" se for outra história.', 'info', 7000);
    }
  }

  narrPreencher();

  narrAtualizarDescricoes();

  // Aviso de chave de API — as três ações de IA dependem dela; o diagnóstico não.
  const aviso = $('#n-api-warning');
  if (aviso) {
    const provider = State.provider || 'groq';
    if (State.apiKeys && State.apiKeys[provider]) aviso.classList.add('hidden');
    else {
      const nome = provider.charAt(0).toUpperCase() + provider.slice(1);
      aviso.innerHTML = `
        <div class="flex items-center gap-2">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--amber); flex-shrink: 0;">
            <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
          </svg>
          <div class="flex-1">
            <strong>Configure sua chave de API</strong>
            <div class="text-sm text-soft">O diagnóstico funciona sem chave. Para extrair, afiar e escrever, adicione a chave da ${escapeHtml(nome)}.</div>
          </div>
          <button class="btn btn-ghost btn-sm" data-go="settings">Configurar</button>
        </div>`;
      aviso.classList.remove('hidden');
    }
  }

  if (!_narrWired) {
    _narrWired = true;

    // Diagnóstico ao vivo: cada tecla re-julga a história (é barato — roda local).
    NARR_CAMPOS.forEach((c) => {
      const el = $('#n-' + c);
      if (el) el.addEventListener('input', () => renderNarrDiagnostico());
    });
    ['formatoId', 'tomId', 'tamanhoId'].forEach((c) => {
      const el = $('#n-' + c);
      // O diagnóstico também é redesenhado: o limite de elenco vem do formato,
      // então trocar de Reels para vídeo longo muda o que é excesso de gente.
      if (el) el.addEventListener('change', () => { narrAtualizarDescricoes(); renderNarrDiagnostico(); });
    });
    const perfilSel = $('#n-perfil');
    if (perfilSel) perfilSel.addEventListener('change', () => narrColetar());

    if ($('#n-elenco-add')) $('#n-elenco-add').onclick = () => narrAdicionarPersonagem();

    if ($('#n-history-open')) $('#n-history-open').onclick = abrirNarrHistorico;
    if ($('#n-history-close')) $('#n-history-close').onclick = fecharNarrHistorico;
    if ($('#n-history-backdrop')) $('#n-history-backdrop').onclick = fecharNarrHistorico;
    if ($('#n-history-clear')) $('#n-history-clear').onclick = () => {
      if (!(State.narrativas || []).length) return;
      if (!confirm('Apagar todo o histórico de histórias?')) return;
      State.narrativas = [];
      saveNarrativas();
      renderNarrHistorico();
      toast('Histórico limpo.', 'success');
    };

    if ($('#n-limpar')) $('#n-limpar').onclick = () => {
      if (!confirm('Limpar os campos desta história? O histórico não é afetado.')) return;
      State.narrativaDraft = narrativaVazia();
      saveNarrativaDraft();
      narrPreencher();
      renderNarrElenco();
      narrLimparResultado();
      renderNarrDiagnostico();
    };

    // --- IA 1: extrair as três respostas da ideia bruta ---
    if ($('#n-extrair')) $('#n-extrair').onclick = async () => {
      const d = narrColetar();
      if (!String(d.ideia || '').trim()) {
        toast('Escreva a ideia bruta primeiro.', 'error');
        return;
      }
      const btn = $('#n-extrair');
      try {
        const r = await narrChamarIA(btn, 'Lendo…', buildExtracaoNarrativaPrompt(d.ideia));
        const obj = typeof extractJSON === 'function' ? extractJSON(r.content) : null;
        if (!obj) { toast('A IA não devolveu um resultado legível. Tente de novo.', 'error'); return; }
        const n = narrAplicarSugestao(obj, { forcar: false });
        const falta = String(obj.falta || '').trim();
        if (!n && !falta) toast('Nada novo a preencher — os campos já estão respondidos.', 'info');
        else if (falta) toast(`Preenchi ${n} campo(s). Ainda falta: ${falta}`, 'info', 7000);
        else toast(`Preenchi ${n} campo(s) a partir da ideia.`, 'success');
      } catch (err) {
        toast(err.message || 'Não foi possível ler a ideia.', 'error', 6000);
      }
    };

    // --- IA 2: afiar as respostas já escritas ---
    if ($('#n-afiar')) $('#n-afiar').onclick = async () => {
      const d = narrColetar();
      if (!String(d.desejo || '').trim() && !String(d.obstaculo || '').trim() && !String(d.risco || '').trim()) {
        toast('Responda pelo menos uma das três perguntas antes de afiar.', 'error');
        return;
      }
      const btn = $('#n-afiar');
      try {
        const r = await narrChamarIA(btn, 'Afiando…', buildAfiacaoNarrativaPrompt(d));
        const obj = typeof extractJSON === 'function' ? extractJSON(r.content) : null;
        if (!obj) { toast('A IA não devolveu um resultado legível. Tente de novo.', 'error'); return; }
        // Aqui a substituição é INTENCIONAL: o usuário pediu para melhorar o que
        // escreveu. Guardamos a versão anterior para desfazer em um clique.
        const antes = { desejo: d.desejo, obstaculo: d.obstaculo, risco: d.risco };
        narrAplicarSugestao(obj, { forcar: true });
        const host = $('#n-afiacao');
        if (host) {
          host.innerHTML = narrEscalada(obj.escalada) +
            narrParecerElenco(obj.elenco) +
            (obj.porque ? `<div class="text-sm text-soft mt-1">${escapeHtml(String(obj.porque))}</div>` : '') +
            '<button class="btn btn-ghost btn-sm mt-2" id="n-desfazer">Desfazer afiação</button>';
          $('#n-desfazer').onclick = () => {
            Object.assign(narrativaDraft(), antes);
            saveNarrativaDraft();
            narrPreencher();
            host.innerHTML = '';
            renderNarrDiagnostico();
            toast('Versão anterior restaurada.', 'success');
          };
        }
        toast('Respostas afiadas.', 'success');
      } catch (err) {
        toast(err.message || 'Não foi possível afiar.', 'error', 6000);
      }
    };

    // --- IA 3: escrever o conteúdo ---
    if ($('#n-submit')) $('#n-submit').onclick = async () => {
      let d = narrColetar();
      let diag = diagnosticarNarrativa(d);

      // UM CLIQUE, NÃO ONZE CAMPOS. Se as três perguntas ainda não têm resposta,
      // a ferramenta lê a ideia e responde por conta própria antes de qualquer
      // cobrança. Só se AINDA faltar alguma é que o usuário é chamado — e para
      // uma pergunta, não para um formulário.
      if (!diag.pronto && String(d.ideia || '').trim().length >= 12) {
        const btn0 = $('#n-submit');
        try {
          const r = await narrChamarIA(btn0, 'Lendo a sua ideia…', buildExtracaoNarrativaPrompt(d.ideia));
          const obj = (typeof extractJSON === 'function') ? extractJSON(r && r.content) : null;
          if (obj) narrAplicarSugestao(obj);
        } catch (err) { /* segue: o usuário responde à mão */ }
        d = narrColetar();
        diag = diagnosticarNarrativa(d);
      }

      if (!diag.pronto) {
        renderNarrDiagnostico();
        const foco = $('#n-foco-input');
        if (foco) { foco.scrollIntoView({ behavior: 'smooth', block: 'center' }); foco.focus(); }
        toast('Falta uma resposta para a história existir — é só uma linha.', 'info', 6000);
        return;
      }
      const perfis = State.portals || [];
      const perfil = (d.perfilIndex >= 0 && perfis[d.perfilIndex]) ? perfis[d.perfilIndex] : null;
      const built = buildNarrativaPrompt({
        narrativa: d, formatoId: d.formatoId, tomId: d.tomId, tamanhoId: d.tamanhoId,
        perfil, cta: d.cta,
      });

      const btn = $('#n-submit');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Escrevendo…';
      $('#n-result-area').innerHTML = `
        <div class="empty">
          <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
          <div class="empty-title">Escrevendo…</div>
          <div class="empty-desc">${escapeHtml(built.formato.label)} · ${escapeHtml(built.tom.label)}</div>
        </div>`;
      try {
        const r = await callLLM(built.prompt);
        const item = {
          id: uuid(),
          createdAt: new Date().toISOString(),
          titulo: narrativaTitulo(d),
          narrativa: Object.assign({}, d),
          formato: built.formato.label,
          tom: built.tom.label,
          conteudo: cleanText(r.content),
          model: r.model,
          score: diag.score,
        };
        State.narrativas = State.narrativas || [];
        State.narrativas.unshift(item);
        saveNarrativas();
        renderNarrResultado(item);
        renderNarrHistorico();
        toast('Conteúdo pronto.', 'success');
      } catch (err) {
        toast(err.message || 'Não foi possível escrever o conteúdo.', 'error', 6000);
        $('#n-result-area').innerHTML = `
          <div class="empty">
            <div class="empty-title">Erro</div>
            <div class="empty-desc">${escapeHtml(err.message || 'Tente novamente.')}</div>
          </div>`;
      } finally {
        btn.disabled = false;
        btn.innerHTML = original;
        renderNarrDiagnostico();
      }
    };
  }

  renderNarrElenco();
  renderNarrDiagnostico();
  renderNarrHistorico();
}
