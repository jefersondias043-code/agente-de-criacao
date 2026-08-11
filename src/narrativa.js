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
    entrega: [
      'Marque cada bloco com o intervalo de tempo ("0–3s", "3–10s"…), somando 30 a 60 segundos.',
      'Escreva a FALA — o que sai da boca —, não a descrição da cena.',
      'Nada de saudação nem anúncio do que virá: o tempo é curto demais para pigarro.',
    ],
    elencoMax: 2,
  },
  {
    id: 'carrossel',
    label: 'Carrossel — 8 a 10 slides',
    desc: 'Um slide por passo, com texto curto o bastante para caber na arte.',
    entrega: [
      'Formate como "SLIDE 1 —" em cada bloco, de 8 a 10 slides.',
      'Máximo de 30 palavras por slide; o primeiro, no máximo 8 palavras — é o que cabe na arte e decide se o resto será visto.',
      'Cada slide precisa deixar uma pergunta aberta que o seguinte responde.',
    ],
    elencoMax: 3,
  },
  {
    id: 'legenda',
    label: 'Legenda de post',
    desc: 'Instagram/Facebook: primeira linha que segura, corpo curto, fecho.',
    entrega: [
      'A PRIMEIRA LINHA fica sozinha e precisa funcionar antes do "ver mais".',
      'Corpo em parágrafos curtos, de 3 a 6.',
      'Depois do texto, sugira de 5 a 8 hashtags em uma única linha.',
    ],
    elencoMax: 3,
  },
  {
    id: 'stories',
    label: 'Sequência de Stories',
    desc: '4 a 6 telas encadeadas, cada uma puxando a próxima.',
    entrega: [
      'Uma tela por bloco, marcada como "TELA 1", "TELA 2"…',
      'Cada tela cabe em 2 linhas de texto na vertical — escreva curto de verdade.',
      'Cada tela termina num ponto que obriga a tocar na próxima.',
      'A última tela abre uma interação (caixinha, enquete ou resposta direta).',
    ],
    elencoMax: 2,
  },
  {
    id: 'youtube',
    label: 'Roteiro de vídeo longo',
    desc: 'YouTube: blocos marcados, fala corrida.',
    entrega: [
      'Marque os blocos com um nome curto em maiúsculas.',
      'Escreva a fala corrida, não tópicos.',
      'Nada de apresentação pessoal antes de a história começar.',
    ],
    elencoMax: 5,
  },
  {
    id: 'thread',
    label: 'Thread — X / Threads',
    desc: '6 a 9 posts numerados, cada um sustentando o próximo.',
    entrega: [
      'Numere os posts como "1/", "2/"…, de 6 a 9 no total.',
      'Cada post no máximo 280 caracteres, faz sentido sozinho e ainda assim puxa o próximo.',
    ],
    elencoMax: 3,
  },
  {
    id: 'newsletter',
    label: 'Newsletter / artigo de blog',
    desc: 'Texto corrido, com título e parágrafos curtos.',
    entrega: [
      'Comece por um TÍTULO concreto, sem promessa vazia.',
      'Parágrafos curtos. De 400 a 800 palavras, salvo indicação de tamanho diferente.',
    ],
    elencoMax: 5,
  },
  {
    id: 'ganchos',
    label: 'Só os ganchos — 10 variações',
    desc: 'Dez primeiras frases diferentes para testar a mesma história.',
    entrega: [
      'Devolva 10 ganchos numerados, um por linha, sem explicação.',
      'Máximo de 15 palavras cada. Nenhum entrega o desfecho.',
      'Varie o ângulo de entrada: cada um começa por um ponto diferente da história.',
    ],
    elencoMax: 1,
  },
  {
    id: 'dialogo',
    label: 'Diálogo / esquete — duas vozes ou mais',
    desc: 'Cena falada entre os personagens, com rubricas curtas.',
    entrega: [
      'Escreva como cena: "NOME:" antes de cada fala, rubrica de ação entre parênteses e curta.',
      'Entre no meio da conversa, já em atrito. Nada de cumprimento nem apresentação.',
      'Se não houver outro personagem declarado, escreva como monólogo com fala relatada — não invente um personagem.',
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

/* O PROMPT DE PRODUÇÃO SAIU DAQUI.
 *
 * Ele era uma chamada só: história + estrutura fixa do formato → roteiro. O que
 * saía era correto e sem força — e a estrutura fixa era o motivo. Todo material
 * entrava na mesma fôrma (gancho → problema → solução → chamada), inclusive os
 * que pediam outra coisa.
 *
 * Agora quem escreve é o motor (src/narrativa-motor.js): lê o material, descobre
 * que história existe nele e que DESENHO essa história pede, escreve, critica o
 * que escreveu e reescreve antes de mostrar. O formato voltou a ser só embalagem
 * — ver o campo `entrega` de NARR_FORMATOS. */

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
    // De qual ideia saiu a história derivada acima. Sem esta marca não há como
    // saber se as respostas ainda pertencem ao que está escrito no campo.
    ideiaOrigem: '',
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
  return diag;
}

/* A HISTÓRIA DERIVADA PERTENCE A UMA IDEIA.
 *
 * Defeito relatado: começar um conteúdo novo e ver o antigo aparecer nele.
 * A causa foi uma regra que era certa e virou errada. `narrAplicarSugestao`
 * nunca sobrescrevia uma resposta já preenchida — proteção correta quando as
 * três respostas eram campos VISÍVEIS que o usuário tinha escrito à mão. Ao
 * escondê-las (a simplificação da tela), a mesma regra passou a preservar
 * resposta de OUTRA história, sem que ninguém pudesse ver nem apagar.
 *
 * Agora o rascunho guarda de qual ideia as respostas saíram. Ideia diferente,
 * história descartada: é o único jeito de "texto novo" significar mesmo texto
 * novo. Ideia igual (o usuário só clicou de novo, ou respondeu à pergunta
 * focada) preserva tudo — reextrair ali apagaria o que ele acabou de escrever. */
function narrIdeiaMudou(d) {
  return narrNorm(String((d && d.ideia) || '')) !== narrNorm(String((d && d.ideiaOrigem) || ''));
}

/** Reabrir uma história salva devolve o pacote inteiro — e a marca de origem
 *  junto. Aquelas respostas SAÍRAM daquela ideia; sem a marca, o primeiro
 *  clique as trataria como restos de outra história e as jogaria fora, que é o
 *  oposto do motivo de guardar a história inteira no histórico. */
function narrRestaurarDraft(item) {
  const d = Object.assign(narrativaVazia(), (item && item.narrativa) || {});
  d.ideiaOrigem = d.ideia;
  State.narrativaDraft = d;
  saveNarrativaDraft();
  return d;
}

/** Descarta a história derivada — no rascunho E nos campos, que hoje vivem
 *  fora da vista e por isso não denunciam sozinhos que estão desatualizados. */
function narrDescartarDerivados(d) {
  ['protagonista', 'desejo', 'obstaculo', 'risco'].forEach((c) => {
    d[c] = '';
    const el = $('#n-' + c);
    if (el) el.value = '';
  });
  d.elenco = [];
  if (typeof renderNarrElenco === 'function') renderNarrElenco();
  saveNarrativaDraft();
}

/* A PERGUNTA FOCADA SAIU DE CENA.
 *
 * Ela era o resto do formulário: quando faltava uma das três respostas, a
 * ferramenta parava e cobrava do usuário — "o que ele está disposto a
 * arriscar?" — antes de escrever qualquer coisa. Fazia sentido quando a
 * ferramenta só sabia montar o roteiro a partir de respostas prontas.
 *
 * Não faz mais. Quem é roteirista agora é a ferramenta: ela lê o material e
 * DEDUZ o que está em jogo a partir do que existe ali. Deduzir o que está em
 * jogo não é inventar fato — é ler. E se a dedução ficar fraca, quem cobra é a
 * crítica do motor, que pergunta exatamente isso ("existe algo em jogo?") e
 * manda reescrever. A cobrança mudou de lado: sai do usuário, entra na IA.
 *
 * As três perguntas do lema continuam inteiras. O que mudou é quem responde. */

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

/* Há conteúdo de alguma história à vista? Só isso — para saber se vale a pena
 * retirá-lo quando a ideia no campo passa a ser outra. */
let _narrResultadoVisivel = false;

function renderNarrResultado(item) {
  const area = $('#n-result-area');
  if (!area) return;
  _narrResultadoVisivel = true;
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

  $('#n-result-copy').onclick = () => copyTextComAviso(item.conteudo, 'Conteúdo copiado.');
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
  _narrResultadoVisivel = false;
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
      <div class="empty-desc">Escreva a sua ideia acima — ou anexe um arquivo — e o conteúdo aparece aqui.</div>
    </div>`;
}

/* O CONTEÚDO NA TELA PERTENCE À IDEIA QUE O GEROU.
 *
 * Visto em navegador enquanto se conferia a correção: com a ideia nova já
 * escrita no campo, o cartão logo abaixo continuava exibindo o texto da
 * história ANTERIOR, com o selo "PRONTO". A geração já estava certa, mas a
 * tela dizia o contrário — e é essa a leitura de "continua mencionando texto
 * velho". Ao divergir a ideia, o cartão volta ao estado de espera. Nada se
 * perde: toda geração fica guardada no histórico, ali do lado. */
function narrEsquecerResultadoDeOutraHistoria() {
  if (!_narrResultadoVisivel) return;
  if (!narrIdeiaMudou(narrColetar())) return;
  _narrResultadoVisivel = false;
  narrLimparResultado();
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
      narrRestaurarDraft(it);
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

/* ANEXO — mesma entrada universal das outras ferramentas.
 *
 * A Narrativa era a única que só aceitava texto digitado. O pipeline de
 * ingestão (PDF, imagem com OCR, áudio, vídeo) já existe e é o mesmo do Gerar e
 * do AutoPost; aqui ele apenas despeja o texto extraído na ideia.
 *
 * Mídia GRANDE não é convertida no evento do seletor: a compressão usa Web
 * Audio, que no iPhone só roda a partir de um gesto do usuário. Por isso o
 * cartão com o botão "Transcrever" — é o toque nele que destrava o áudio no
 * iOS. Mesma razão e mesmo desenho do cartão da Gerar. */
function handleNarrAttach(f, ta) {
  if (typeof ingestAnexar !== 'function') return;
  ingestAnexar(f, (text) => {
    const cur = (ta.value || '').trim();
    ta.value = cur ? (cur + '\n\n' + text) : text;
    ta.dispatchEvent(new Event('input', { bubbles: true }));
  }, '#n-attach-pending');
}

function renderNarrativa() {
  { const p = $('#n-attach-pending'); if (p) p.innerHTML = ''; }

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

  // Anexar arquivo — idêntico ao da Gerar (PDF/imagem/áudio/vídeo/TXT → texto).
  const nAttachInput = $('#n-attach-input');
  const nAttachBtn = $('#n-attach-btn');
  const nIdeia = $('#n-ideia');
  if (nAttachInput && nAttachBtn && nIdeia && typeof INGEST_ACCEPT !== 'undefined') {
    nAttachInput.accept = INGEST_ACCEPT;
    nAttachBtn.onclick = () => nAttachInput.click();
    nAttachInput.onchange = () => {
      const f = nAttachInput.files && nAttachInput.files[0];
      if (f) handleNarrAttach(f, nIdeia);
      nAttachInput.value = '';
    };
  }

  // Handoff: texto vindo de outra ferramenta entra como IDEIA BRUTA — nunca
  // como resposta pronta (o material de origem é justamente a situação que
  // ainda precisa virar história). Material diferente = história diferente: a
  // leitura anterior cai aqui mesmo. Antes ela era mantida, com um aviso para
  // usar "Limpar" — botão que a tela de um campo só nem tem mais, e cuja
  // ausência transformou a preservação em texto velho vazando no conteúdo novo.
  if (State.handoff && State.handoff.target === 'narrativa') {
    const d = narrativaDraft();
    const texto = State.handoff.text || '';
    const trocou = narrNorm(texto) !== narrNorm(d.ideia || '');
    const tinhaRespostas = !!(d.desejo || d.obstaculo || d.risco);
    d.ideia = texto;
    State.handoff = null;
    saveNarrativaDraft();
    if (trocou) {
      narrDescartarDerivados(d);
      if (tinhaRespostas) toast('Material recebido. A ferramenta vai lê-lo do zero.', 'info', 5000);
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
            <div class="text-sm text-soft">O diagnóstico funciona sem chave. Para ler o material, escrever e revisar, adicione a chave da ${escapeHtml(nome)}.</div>
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
    // Trocar a ideia retira da tela o conteúdo da história anterior — inclusive
    // quando a troca vem do × ou de um arquivo anexado, que também disparam
    // `input`. O texto continua no histórico.
    if ($('#n-ideia')) $('#n-ideia').addEventListener('input', narrEsquecerResultadoDeOutraHistoria);
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

    // --- O MOTOR: ler → escrever → criticar → reescrever → entregar ---
    //
    // Um clique continua sendo um clique. O que mudou está atrás dele: a
    // primeira versão do roteiro deixou de ser a entrega e virou rascunho.
    if ($('#n-submit')) $('#n-submit').onclick = async () => {
      let d = narrColetar();

      // Ideia nova descarta a história derivada da anterior (r204). Sem isto, o
      // material novo era escrito por cima das respostas do material velho.
      const ideiaNova = narrIdeiaMudou(d);
      if (ideiaNova) narrDescartarDerivados(d);

      const material = String(d.ideia || '').trim();
      if (material.length < 12) {
        renderNarrDiagnostico();
        toast('Escreva ou anexe o material primeiro.', 'info', 5000);
        return;
      }

      const perfis = State.portals || [];
      const perfil = (d.perfilIndex >= 0 && perfis[d.perfilIndex]) ? perfis[d.perfilIndex] : null;
      const formato = narrFormato(d.formatoId);
      const tom = narrTom(d.tomId);
      const tamanho = narrTamanho(d.tamanhoId);

      const btn = $('#n-submit');
      const original = btn.innerHTML;
      btn.disabled = true;
      btn.innerHTML = '<span class="spinner"></span> Trabalhando…';
      // As etapas ficam à vista porque a espera ficou maior: quem enxerga o
      // trabalho acontecendo espera; quem olha para um botão parado desiste.
      $('#n-result-area').innerHTML = `
        <div class="empty">
          <div class="spinner spinner-lg" style="color: var(--accent); border-right-color: transparent; margin: 0 auto 1rem;"></div>
          <div class="empty-title" id="n-loading-title">Lendo o material…</div>
          <div class="empty-desc" id="n-loading-desc">${escapeHtml(formato.label)} · ${escapeHtml(tom.label)}</div>
          <div class="pipeline-steps" id="n-pipeline">
            <span class="pipeline-step" data-step="leitura">Leitura</span>
            <span class="pipeline-step" data-step="escrita">Escrita</span>
            <span class="pipeline-step" data-step="critica">Crítica</span>
            <span class="pipeline-step" data-step="reescrita">Reescrita</span>
          </div>
        </div>`;
      const onEtapa = (chave, titulo, desc) => {
        const t = $('#n-loading-title'), dsc = $('#n-loading-desc');
        if (t) t.textContent = titulo;
        if (dsc) dsc.textContent = desc;
        $$('#n-pipeline .pipeline-step').forEach((el) => {
          if (el.dataset.step === chave) el.classList.add('active');
          else if (el.classList.contains('active')) el.classList.replace('active', 'done');
        });
      };

      // A leitura do motor alimenta os campos internos, que seguem servindo ao
      // diagnóstico e ao histórico. O que ela NÃO faz mais é barrar: material
      // pobre vira roteiro pobre, e quem cobra isso é a crítica do motor — não
      // um campo obrigatório na cara de quem só queria contar uma história.
      let diag = null;
      const aposLeitura = (plano) => {
        narrAplicarSugestao({
          protagonista: plano.protagonista, desejo: plano.desejo,
          obstaculo: plano.obstaculo, risco: plano.risco,
          elenco: (plano.personagens || []).map((p) => ({ nome: p.nome, papel: 'antagonista', quer: p.quer })),
        }, { forcar: ideiaNova });
        const atual = narrativaDraft();
        atual.ideiaOrigem = atual.ideia;
        saveNarrativaDraft();
        d = narrColetar();
        diag = diagnosticarNarrativa(d);
        return true;
      };

      try {
        const res = await runNarrativaPipeline({
          material, formato, tom, tamanho, perfil, cta: d.cta,
          lema: NARR_LEMA, onEtapa, aposLeitura, call: callLLM,
        });

        const item = {
          id: uuid(),
          createdAt: new Date().toISOString(),
          titulo: narrativaTitulo(d),
          narrativa: Object.assign({}, d),
          formato: formato.label,
          tom: tom.label,
          conteudo: res.conteudo,
          model: res.model,
          score: (diag && diag.score) || 0,
          // Rastro do trabalho: qual desenho foi escolhido, o que a crítica
          // apontou e se houve reescrita. Não aparece na tela; serve para
          // entender um resultado ruim sem ter de reproduzir a geração.
          plano: res.plano,
          criticaResumo: (res.critica && res.critica.resumo) || '',
          reescreveu: !!res.reescreveu,
          etapas: res.etapas,
        };
        State.narrativas = State.narrativas || [];
        State.narrativas.unshift(item);
        saveNarrativas();
        renderNarrResultado(item);
        renderNarrHistorico();
        toast(res.reescreveu ? 'Conteúdo pronto — passou por revisão.' : 'Conteúdo pronto.', 'success');
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

  // Sem isto o cartão "Conteúdo" abre como uma caixa branca vazia — parece
  // defeito. O estado de espera só era pintado ao limpar ou ao excluir.
  if (!_narrResultadoVisivel) narrLimparResultado();

  renderNarrElenco();
  renderNarrDiagnostico();
  renderNarrHistorico();
}
